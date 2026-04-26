import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getProperties } from "@/lib/store";

export const dynamic = "force-dynamic";

type FunnelStepDefinition = {
  label: string;
  aliases: string[];
  color?: string;
};

function toBreakdown(items: string[]) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = item || "Unassigned";
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function normalizeStage(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mapStageColorToClass(title: string, color: string | null) {
  if (color?.includes("border-")) {
    return color;
  }

  const byTitle: Record<string, string> = {
    "novo lead": "border-blue-500/30 text-blue-400 bg-blue-500/10",
    qualificacao: "border-purple-500/30 text-purple-400 bg-purple-500/10",
    "qualificação": "border-purple-500/30 text-purple-400 bg-purple-500/10",
    agendado: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
    atendimento: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
    proposta: "border-orange-500/30 text-orange-400 bg-orange-500/10",
    "proposta gerada": "border-orange-500/30 text-orange-400 bg-orange-500/10",
    fechado: "border-green-500/30 text-green-400 bg-green-500/10",
    captado: "border-green-500/30 text-green-400 bg-green-500/10",
    "análise de ia": "border-purple-500/30 text-purple-400 bg-purple-500/10",
    "analise da ia": "border-purple-500/30 text-purple-400 bg-purple-500/10",
    "contato feito": "border-orange-500/30 text-orange-400 bg-orange-500/10",
    "oportunidades (web)": "border-blue-500/30 text-blue-400 bg-blue-500/10",
  };

  return byTitle[title.trim().toLowerCase()] || "border-blue-500/30 text-blue-400 bg-blue-500/10";
}

function toFunnelBreakdown(steps: FunnelStepDefinition[], items: string[]) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = normalizeStage(item || "Unassigned");
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const ordered = steps.map((step) => {
    // Unique aliases after normalization to prevent double-counting
    const uniqueAliases = Array.from(new Set(step.aliases.map(normalizeStage)));
    return {
      label: step.label,
      count: uniqueAliases.reduce((total, alias) => total + (counts.get(alias) || 0), 0),
      color: step.color || null,
    };
  });

  const knownSteps = new Set(steps.flatMap((step) => step.aliases.map(normalizeStage)));
  const extraStages = Array.from(counts.entries())
    .filter(([label]) => !knownSteps.has(normalizeStage(label)))
    .filter(([label]) => {
      const norm = normalizeStage(label);
      return norm !== "excluido" && norm !== "perdido";
    })
    .map(([label, count]) => ({ label, count, color: null }))
    .sort((a, b) => b.count - a.count);

  return [...ordered, ...extraStages];
}

export async function GET() {
  const currentUser = await getCurrentAppUser();
  if (!currentUser || currentUser.user_type !== "internal" || !currentUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabaseClient();

    const [
      properties,
      crmLeadsResponse,
      crmFunnelsResponse,
      captacaoLeadsResponse,
      captacaoFunnelsResponse,
      appUsersResponse,
      clientProcessesResponse,
      clientDocumentsResponse,
      messagesResponse,
    ] = await Promise.all([
      getProperties(),
      supabase
        .from("people")
        .select("id, crm_status, crm_funnel_id")
        .not("crm_status", "is", null)
        .neq("crm_status", "Oportunidades (Web)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("funnels")
        .select("id, name, type, stages:funnel_stages(id, title, color, order)")
        .eq("type", "lead"),
      supabase
        .from("captacao_items")
        .select("id, title, status, created_at, custom_data, funnel_id, source")
        .order("created_at", { ascending: false }),
      supabase
        .from("funnels")
        .select("id, name, type, stages:funnel_stages(id, title, color, order)")
        .eq("type", "captacao"),
      supabase.from("app_users").select("id, user_type, role, is_active"),
      supabase.from("client_processes").select("id, title, status, updated_at").order("updated_at", { ascending: false }),
      supabase.from("client_documents").select("id"),
      supabase.from("messages").select("id", { count: "exact", head: true }),
    ]);

    if (
      crmLeadsResponse.error ||
      crmFunnelsResponse.error ||
      captacaoLeadsResponse.error ||
      captacaoFunnelsResponse.error ||
      appUsersResponse.error ||
      clientProcessesResponse.error ||
      clientDocumentsResponse.error ||
      messagesResponse.error
    ) {
      console.error(
        crmLeadsResponse.error ||
          crmFunnelsResponse.error ||
          captacaoLeadsResponse.error ||
          captacaoFunnelsResponse.error ||
          appUsersResponse.error ||
          clientProcessesResponse.error ||
          clientDocumentsResponse.error ||
          messagesResponse.error,
      );
      return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
    }

    const crmFunnelIds = new Set((crmFunnelsResponse.data || []).map((funnel) => funnel.id));
    const crmLeads = (crmLeadsResponse.data || []).filter((lead) =>
      lead.crm_funnel_id ? crmFunnelIds.has(lead.crm_funnel_id) : true,
    );
    const captacaoFunnelIds = new Set((captacaoFunnelsResponse.data || []).map((funnel) => funnel.id));
    const captacaoLeads = (captacaoLeadsResponse.data || []).filter((lead) =>
      lead.funnel_id ? captacaoFunnelIds.has(lead.funnel_id) : true,
    );
    const crmFunnelSteps =
      ((crmFunnelsResponse.data || [])[0]?.stages || [])
        .sort((a, b) => Number(a.order) - Number(b.order))
        .map((stage) => ({
          label: stage.title,
          aliases: [stage.title],
          color: mapStageColorToClass(stage.title, stage.color || null),
        })) || [];
    const captacaoFunnelStages = (captacaoFunnelsResponse.data || [])[0]?.stages || [];
    const captacaoFunnelSteps = [...captacaoFunnelStages]
      .sort((a, b) => Number(a.order) - Number(b.order))
      .filter((stage) => {
        const norm = normalizeStage(stage.title);
        return norm !== "excluido" && norm !== "perdido";
      })
      .map((stage) => ({
        label: stage.title,
        aliases: [stage.title],
        color: mapStageColorToClass(stage.title, stage.color || null),
      }));

    const internalUsers = (appUsersResponse.data || []).filter((user) => user.user_type === "internal");
    const clients = (appUsersResponse.data || []).filter((user) => user.user_type === "client");
    const activeProperties = properties.filter((property) => property.status === "active");

    const recentCaptacao = captacaoLeads.slice(0, 5).map((lead) => {
      const customData = lead.custom_data as Record<string, unknown> | null;
      let coverImage = "";
      
      if (customData?.image) {
        coverImage = String(customData.image);
      } else if (Array.isArray(customData?.images) && customData.images.length > 0) {
        coverImage = String(customData.images[0]);
      }
      
      // Sanitiza url (remove aspas se tiver)
      coverImage = coverImage.replace(/[`"]/g, "").trim();

      return {
        id: lead.id,
        title: lead.title,
        status: lead.status || "Unassigned",
        source: String(lead.source || customData?.source || "captacao"),
        image: coverImage,
        createdAt: lead.created_at,
      };
    });

    const recentProperties = [...properties]
      .slice(0, 5)
      .map((property) => ({
        id: property.id,
        title: property.title,
        status: property.status,
        price: property.price,
        address: property.address,
        image: property.images?.[0] || "",
      }));

    return NextResponse.json({
      overview: {
        crmLeads: crmLeads.length,
        crmFunnels: (crmFunnelsResponse.data || []).length,
        captacaoLeads: captacaoLeads.length,
        captacaoFunnels: (captacaoFunnelsResponse.data || []).length,
        totalProperties: properties.length,
        activeProperties: activeProperties.length,
        internalUsers: internalUsers.length,
        clients: clients.length,
        clientProcesses: (clientProcessesResponse.data || []).length,
        clientDocuments: (clientDocumentsResponse.data || []).length,
        totalMessages: messagesResponse.count || 0,
      },
      crmStatusBreakdown: toFunnelBreakdown(crmFunnelSteps, crmLeads.map((lead) => lead.crm_status || "Unassigned")),
      captacaoStatusBreakdown: toFunnelBreakdown(captacaoFunnelSteps, captacaoLeads.map((lead) => lead.status || "Unassigned")),
      propertyStatusBreakdown: toBreakdown(properties.map((property) => property.status)),
      clientProcessBreakdown: toBreakdown((clientProcessesResponse.data || []).map((process) => process.status || "Pending")),
      recentCaptacao,
      recentProperties,
      recentClientProcesses: (clientProcessesResponse.data || []).slice(0, 5),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
