import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireAdminApiUser, requireInternalApiUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CustomFieldType = Database["public"]["Enums"]["custom_field_type"];

function isMissingSortOrderColumnError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "42703",
  );
}

function slugifyFieldKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "campo_personalizado";
}

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
  let { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("target_entity", targetEntity)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (isMissingSortOrderColumnError(error)) {
    const fallback = await supabase
      .from("custom_fields")
      .select("*")
      .eq("target_entity", targetEntity)
      .order("created_at", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

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
    const sortOrder = Number(body.sortOrder ?? 0);
    const fieldKey = String(body.fieldKey ?? slugifyFieldKey(name)).trim() || slugifyFieldKey(name);
    const showOnPropertyCard = Boolean(body.showOnPropertyCard);
    const showOnPropertyPage = body.showOnPropertyPage !== false;
    const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : null;

    if (!name || !targetEntity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const payload = {
      name,
      target_entity: targetEntity,
      type: normalizeFieldType(body.type),
      required: Boolean(body.required),
      options: options.length > 0 ? options : null,
      field_key: fieldKey,
      unit,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      show_on_property_card: targetEntity === "properties" ? showOnPropertyCard : false,
      show_on_property_page: targetEntity === "properties" ? showOnPropertyPage : false,
    };

    let { data, error } = await supabase
      .from("custom_fields")
      .insert(payload)
      .select("*")
      .single();

    if (isMissingSortOrderColumnError(error)) {
      const { sort_order: _sortOrder, ...fallbackPayload } = payload;
      const fallback = await supabase
        .from("custom_fields")
        .insert(fallbackPayload)
        .select("*")
        .single();
      data = fallback.data;
      error = fallback.error;
    }

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
