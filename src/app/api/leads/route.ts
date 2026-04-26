import { NextResponse } from "next/server";
import { createLead } from "@/lib/chatStore";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .not("crm_status", "is", null)
      .neq("crm_status", "Oportunidades (Web)")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const dbLeads = (data || []).map((row) => ({
      id: row.id,
      title: row.full_name && row.full_name !== "Lead" ? row.full_name : `Lead: ${row.primary_phone}`,
      phone: row.primary_phone,
      preview: row.last_interaction_preview || "Sem mensagens",
      status: row.crm_status,
      unread: row.crm_unread,
      score: row.crm_score,
      funnelId: row.crm_funnel_id,
      customData: row.metadata || {},
      time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      agentIds: [],
      leadId: row.id,
    }));

    return NextResponse.json({ leads: dbLeads });
  } catch (e) {
    console.error("Error fetching leads:", e);
    return NextResponse.json({ leads: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const newLead = await createLead({
      personId: typeof body.personId === "string" ? body.personId : null,
      phone: body.phone,
      title: body.name,
      status: body.status,
      funnelId: body.funnelId,
      customData: body.customData,
    });

    return NextResponse.json({ success: true, lead: newLead });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
