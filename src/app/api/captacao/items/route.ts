import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const funnelId = searchParams.get("funnelId");
    const supabase = createAdminSupabaseClient();

    let query = supabase.from("captacao_items").select("*").order("created_at", { ascending: false });
    if (funnelId) {
      query = query.eq("funnel_id", funnelId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const items = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      phone: row.external_id || row.id,
      preview: row.preview || "Sem descricao",
      time: row.created_at,
      agentIds: [],
      status: row.status || "Oportunidades (Web)",
      customData: row.custom_data || {},
      unread: false,
      score: 0,
      funnelId: row.funnel_id || undefined,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Captacao items GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
