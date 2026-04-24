import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireAdminApiUser, requireInternalApiUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonRole = Database["public"]["Enums"]["person_role"];

function normalizeRoleList(value: unknown) {
  const roles = Array.isArray(value)
    ? value
        .map((item) => String(item))
        .filter((item): item is PersonRole => ["lead", "client", "buyer", "seller"].includes(item))
    : [];

  return roles as PersonRole[];
}

function normalizeTagList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          String(item)
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
        )
        .filter(Boolean),
    ),
  );
}

export async function GET(req: Request) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const funnelId = searchParams.get("funnelId");

  if (!funnelId) {
    return NextResponse.json({ error: "Missing funnelId" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const [{ data: stages, error: stagesError }, { data: rules, error: rulesError }] = await Promise.all([
    supabase
      .from("funnel_stages")
      .select("id, title, color, order")
      .eq("funnel_id", funnelId)
      .order("order", { ascending: true }),
    supabase
      .from("funnel_stage_people_rules")
      .select("*")
      .eq("funnel_id", funnelId),
  ]);

  if (stagesError || rulesError) {
    console.error(stagesError || rulesError);
    return NextResponse.json({ error: "Failed to load automation rules" }, { status: 500 });
  }

  const rulesByTitle = new Map((rules || []).map((rule) => [rule.stage_title, rule]));
  const items = (stages || []).map((stage) => {
    const rule = rulesByTitle.get(stage.title);
    return {
      stageId: stage.id,
      stageTitle: stage.title,
      stageColor: stage.color,
      addRoles: rule?.add_roles || [],
      removeRoles: rule?.remove_roles || [],
      addTags: rule?.add_tags || [],
      removeTags: rule?.remove_tags || [],
      pointsDelta: rule?.points_delta || 0,
    };
  });

  return NextResponse.json({ rules: items });
}

export async function PUT(req: Request) {
  const appUser = await requireAdminApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const funnelId = String(body.funnelId ?? "").trim();
    const rules = Array.isArray(body.rules) ? body.rules : [];

    if (!funnelId) {
      return NextResponse.json({ error: "Missing funnelId" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { error: deleteError } = await supabase
      .from("funnel_stage_people_rules")
      .delete()
      .eq("funnel_id", funnelId);

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json({ error: "Failed to reset automation rules" }, { status: 500 });
    }

    const sanitizedRules = rules
      .map((rule: Record<string, unknown>) => ({
        funnel_id: funnelId,
        stage_id: typeof rule.stageId === "string" ? rule.stageId : null,
        stage_title: String(rule.stageTitle ?? "").trim(),
        add_roles: normalizeRoleList(rule.addRoles),
        remove_roles: normalizeRoleList(rule.removeRoles),
        add_tags: normalizeTagList(rule.addTags),
        remove_tags: normalizeTagList(rule.removeTags),
        points_delta: Number(rule.pointsDelta || 0),
      }))
      .filter((rule: { stage_title: string }) => Boolean(rule.stage_title));

    if (sanitizedRules.length > 0) {
      const { error: insertError } = await supabase
        .from("funnel_stage_people_rules")
        .insert(sanitizedRules);

      if (insertError) {
        console.error(insertError);
        return NextResponse.json({ error: "Failed to save automation rules" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
