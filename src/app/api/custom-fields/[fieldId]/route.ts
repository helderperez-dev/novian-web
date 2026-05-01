import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireAdminApiUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type CustomFieldType = Database["public"]["Enums"]["custom_field_type"];

function normalizeFieldType(value: unknown): CustomFieldType {
  if (value === "number" || value === "dropdown" || value === "date" || value === "boolean" || value === "multiselect") {
    return value;
  }

  return "text";
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  const appUser = await requireAdminApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fieldId } = await context.params;
    const body = await req.json();
    const options = Array.isArray(body.options)
      ? body.options.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];

    const payload: Database["public"]["Tables"]["custom_fields"]["Update"] = {
      name: String(body.name ?? "").trim() || undefined,
      type: body.type ? normalizeFieldType(body.type) : undefined,
      options: body.options ? (options.length > 0 ? options : null) : undefined,
      required: body.required === undefined ? undefined : Boolean(body.required),
      description: body.description === undefined ? undefined : normalizeOptionalString(body.description),
      icon_name: body.iconName === undefined ? undefined : normalizeOptionalString(body.iconName),
      unit: body.unit === undefined ? undefined : normalizeOptionalString(body.unit),
      sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : undefined,
      show_on_property_card: body.showOnPropertyCard === undefined ? undefined : Boolean(body.showOnPropertyCard),
      show_on_property_page: body.showOnPropertyPage === undefined ? undefined : Boolean(body.showOnPropertyPage),
      show_on_property_filters: body.showOnPropertyFilters === undefined ? undefined : Boolean(body.showOnPropertyFilters),
    };

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("custom_fields")
      .update(payload)
      .eq("id", fieldId)
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to update custom field" }, { status: 500 });
    }

    return NextResponse.json({ success: true, field: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  const appUser = await requireAdminApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fieldId } = await context.params;
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from("custom_fields").delete().eq("id", fieldId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to delete custom field" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
