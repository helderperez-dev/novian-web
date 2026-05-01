import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireAdminApiUser, requireInternalApiUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CustomFieldType = Database["public"]["Enums"]["custom_field_type"];
type CustomFieldRow = Database["public"]["Tables"]["custom_fields"]["Row"];

const NEW_PROPERTY_SYSTEM_FIELD_DEFAULTS: Database["public"]["Tables"]["custom_fields"]["Insert"][] = [
  {
    name: "Banheiros",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "bathrooms",
    description: "Quantidade total de banheiros do imóvel.",
    icon_name: "building-2",
    unit: "",
    sort_order: 25,
    show_on_property_card: true,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Condominio",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "condominium_fee",
    description: "Valor mensal do condomínio.",
    icon_name: "building-2",
    unit: "R$",
    sort_order: 31,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "IPTU",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "iptu",
    description: "Valor do IPTU.",
    icon_name: "building-2",
    unit: "R$",
    sort_order: 32,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Transação",
    target_entity: "properties",
    type: "dropdown",
    required: false,
    options: ["Venda", "Locação", "Venda e locação"],
    field_key: "transaction_type",
    description: "Define se o imóvel está disponível para venda, locação ou ambos.",
    icon_name: "building-2",
    unit: "",
    sort_order: 33,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Finalidade",
    target_entity: "properties",
    type: "dropdown",
    required: false,
    options: ["Residencial", "Comercial", "Industrial", "Rural", "Temporada"],
    field_key: "property_purpose",
    description: "Finalidade principal do imóvel.",
    icon_name: "building-2",
    unit: "",
    sort_order: 34,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Lavabos",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "lavabos",
    description: "Quantidade de lavabos do imóvel.",
    icon_name: "building-2",
    unit: "",
    sort_order: 35,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: false,
  },
  {
    name: "Área construída",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "built_area",
    description: "Área construída em metros quadrados.",
    icon_name: "ruler",
    unit: "m²",
    sort_order: 36,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Área privativa",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "private_area",
    description: "Área privativa em metros quadrados.",
    icon_name: "ruler",
    unit: "m²",
    sort_order: 37,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Área total",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "total_area",
    description: "Área total do imóvel em metros quadrados.",
    icon_name: "ruler",
    unit: "m²",
    sort_order: 38,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Idade do imóvel",
    target_entity: "properties",
    type: "number",
    required: false,
    options: null,
    field_key: "property_age",
    description: "Idade aproximada do imóvel em anos.",
    icon_name: "building-2",
    unit: "anos",
    sort_order: 39,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Aceita permuta",
    target_entity: "properties",
    type: "boolean",
    required: false,
    options: null,
    field_key: "accepts_exchange",
    description: "Indica se o proprietário aceita permuta.",
    icon_name: "building-2",
    unit: "",
    sort_order: 41,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
  {
    name: "Aceita financiamento",
    target_entity: "properties",
    type: "boolean",
    required: false,
    options: null,
    field_key: "accepts_financing",
    description: "Indica se o imóvel aceita financiamento.",
    icon_name: "building-2",
    unit: "",
    sort_order: 42,
    show_on_property_card: false,
    show_on_property_page: true,
    show_on_property_filters: true,
  },
];

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

function mapCustomFieldRow(row: CustomFieldRow) {
  const fieldKey =
    typeof row.field_key === "string" && row.field_key.trim().length > 0
      ? row.field_key.trim()
      : row.id;

  return {
    id: fieldKey,
    dbId: row.id,
    name: row.name || "",
    description: row.description || undefined,
    iconName: row.icon_name || undefined,
    type: row.type || "text",
    options: Array.isArray(row.options) ? row.options : undefined,
    required: Boolean(row.required),
    unit: row.unit || undefined,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    showOnPropertyCard: Boolean(row.show_on_property_card),
    showOnPropertyPage: row.show_on_property_page !== false,
    showOnPropertyFilters: Boolean(row.show_on_property_filters),
    targetEntity: row.target_entity || "people",
  };
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

  if (targetEntity === "properties") {
    const existingFieldKeys = new Set(
      (data || [])
        .map((row) => (typeof row.field_key === "string" ? row.field_key : ""))
        .filter(Boolean),
    );

    const missingDefaults = NEW_PROPERTY_SYSTEM_FIELD_DEFAULTS.filter(
      (field) => typeof field.field_key === "string" && !existingFieldKeys.has(field.field_key),
    );

    if (missingDefaults.length > 0) {
      const { data: insertedRows, error: insertError } = await supabase
        .from("custom_fields")
        .insert(missingDefaults)
        .select("*");

      if (insertError) {
        console.error(insertError);
      } else if (insertedRows && insertedRows.length > 0) {
        data = [...(data || []), ...insertedRows];
        data.sort((left, right) => {
          const leftSort = typeof left.sort_order === "number" ? left.sort_order : 0;
          const rightSort = typeof right.sort_order === "number" ? right.sort_order : 0;
          return leftSort - rightSort;
        });
      }
    }
  }

  const fields = (data || []).map(mapCustomFieldRow);
  return NextResponse.json({ fields });
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
    const showOnPropertyFilters = Boolean(body.showOnPropertyFilters);
    const unit = normalizeOptionalString(body.unit);
    const description = normalizeOptionalString(body.description);
    const iconName = normalizeOptionalString(body.iconName);

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
      description,
      icon_name: iconName,
      unit,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      show_on_property_card: targetEntity === "properties" ? showOnPropertyCard : false,
      show_on_property_filters: targetEntity === "properties" ? showOnPropertyFilters : false,
      show_on_property_page: targetEntity === "properties" ? showOnPropertyPage : false,
    };

    let { data, error } = await supabase
      .from("custom_fields")
      .insert(payload)
      .select("*")
      .single();

    if (isMissingSortOrderColumnError(error)) {
      const fallbackPayload: Partial<typeof payload> = { ...payload };
      delete fallbackPayload.sort_order;
      const fallback = await supabase
        .from("custom_fields")
        .insert(fallbackPayload as typeof payload)
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
