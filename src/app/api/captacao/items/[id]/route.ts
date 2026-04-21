import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.from("captacao_items").select("*").eq("id", decodeURIComponent(id)).single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("Captacao item GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updatePayload: Database["public"]["Tables"]["captacao_items"]["Update"] = {};

    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.preview !== undefined) updatePayload.preview = body.preview;
    if (body.funnelId !== undefined) updatePayload.funnel_id = body.funnelId;
    if (body.customData !== undefined) {
      updatePayload.custom_data = body.customData as Database["public"]["Tables"]["captacao_items"]["Update"]["custom_data"];
    }

    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from("captacao_items")
      .update(updatePayload)
      .eq("id", decodeURIComponent(id));

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Captacao item PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from("captacao_items").delete().eq("id", decodeURIComponent(id));

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Captacao item DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
