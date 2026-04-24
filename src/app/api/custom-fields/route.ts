import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireAdminApiUser, requireInternalApiUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CustomFieldType = Database["public"]["Enums"]["custom_field_type"];

function normalizeFieldType(value: unknown): CustomFieldType {
  if (value === "number" || value === "dropdown" || value === "date") {
    return value;
  }

  return "text";
}

export async function GET(req: Request) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetEntity = searchParams.get("targetEntity") || "people";
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("target_entity", targetEntity)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load custom fields" }, { status: 500 });
  }

  return NextResponse.json({ fields: data || [] });
}

export async function POST(req: Request) {
  const appUser = await requireAdminApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const targetEntity = String(body.targetEntity ?? "people").trim();
    const options = Array.isArray(body.options)
      ? body.options.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];

    if (!name || !targetEntity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("custom_fields")
      .insert({
        name,
        target_entity: targetEntity,
        type: normalizeFieldType(body.type),
        required: Boolean(body.required),
        options: options.length > 0 ? options : null,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to create custom field" }, { status: 500 });
    }

    return NextResponse.json({ success: true, field: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
