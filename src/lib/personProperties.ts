import type { Database, Json } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type JsonObject = { [key: string]: Json | undefined };
type PersonPropertyRelationshipType = Database["public"]["Tables"]["person_properties"]["Row"]["relationship_type"];
type PersonPropertyRow = Database["public"]["Tables"]["person_properties"]["Row"];
type PersonPropertyInsert = Database["public"]["Tables"]["person_properties"]["Insert"];
type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];

export type PersonPropertyLinkInput = {
  propertyId: string;
  relationshipType: PersonPropertyRelationshipType;
  source?: string | null;
  notes?: string | null;
  metadata?: JsonObject | null;
};

export type PersonPropertyLinkSummary = {
  id: string;
  personId: string;
  propertyId: string;
  relationshipType: PersonPropertyRelationshipType;
  source: string;
  notes: string | null;
  metadata: JsonObject;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    title: string;
    slug: string | null;
    address: string | null;
    price: number;
    status: Database["public"]["Enums"]["property_status"];
    coverImage: string | null;
  } | null;
};

function asJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonObject;
}

function buildLinkKey(link: Pick<PersonPropertyRow, "property_id" | "relationship_type">) {
  return `${link.property_id}:${link.relationship_type}`;
}

function mapLinkSummary(row: PersonPropertyRow, property: PropertyRow | undefined): PersonPropertyLinkSummary {
  return {
    id: row.id,
    personId: row.person_id,
    propertyId: row.property_id,
    relationshipType: row.relationship_type,
    source: row.source,
    notes: row.notes,
    metadata: asJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    property: property
      ? {
          id: property.id,
          title: property.title,
          slug: property.slug,
          address: property.address,
          price: property.price,
          status: property.status,
          coverImage: property.cover_image,
        }
      : null,
  };
}

export async function listPersonPropertyLinksByPersonIds(personIds: string[]) {
  const uniquePersonIds = Array.from(new Set(personIds.filter(Boolean)));
  const emptyResult = new Map<string, PersonPropertyLinkSummary[]>();

  if (uniquePersonIds.length === 0) {
    return emptyResult;
  }

  const supabase = createAdminSupabaseClient();
  const { data: linkRows, error: linksError } = await supabase
    .from("person_properties")
    .select("*")
    .in("person_id", uniquePersonIds)
    .order("updated_at", { ascending: false });

  if (linksError) {
    throw linksError;
  }

  const propertyIds = Array.from(new Set((linkRows || []).map((row) => row.property_id)));
  const propertyMap = new Map<string, PropertyRow>();

  if (propertyIds.length > 0) {
    const { data: propertyRows, error: propertiesError } = await supabase
      .from("properties")
      .select("id, title, slug, address, price, status, cover_image")
      .in("id", propertyIds);

    if (propertiesError) {
      throw propertiesError;
    }

    for (const property of propertyRows || []) {
      propertyMap.set(property.id, property as PropertyRow);
    }
  }

  const grouped = new Map<string, PersonPropertyLinkSummary[]>();
  for (const personId of uniquePersonIds) {
    grouped.set(personId, []);
  }

  for (const row of linkRows || []) {
    const summaries = grouped.get(row.person_id) || [];
    summaries.push(mapLinkSummary(row, propertyMap.get(row.property_id)));
    grouped.set(row.person_id, summaries);
  }

  return grouped;
}

export async function replacePersonPropertyLinks(personId: string, links: PersonPropertyLinkInput[]) {
  const supabase = createAdminSupabaseClient();
  const normalizedLinks = Array.from(
    new Map(
      links
        .filter((link) => link.propertyId)
        .map((link) => [
          `${link.propertyId}:${link.relationshipType}`,
          {
            person_id: personId,
            property_id: link.propertyId,
            relationship_type: link.relationshipType,
            source: String(link.source ?? "manual").trim() || "manual",
            notes: link.notes?.trim() || null,
            metadata: asJsonObject(link.metadata),
          } satisfies PersonPropertyInsert,
        ]),
    ).values(),
  );

  const { data: currentLinks, error: currentError } = await supabase
    .from("person_properties")
    .select("id, property_id, relationship_type")
    .eq("person_id", personId);

  if (currentError) {
    throw currentError;
  }

  if (normalizedLinks.length > 0) {
    const { error: upsertError } = await supabase
      .from("person_properties")
      .upsert(normalizedLinks, { onConflict: "person_id,property_id,relationship_type" });

    if (upsertError) {
      throw upsertError;
    }
  }

  const nextKeys = new Set(normalizedLinks.map(buildLinkKey));
  const deleteIds = (currentLinks || [])
    .filter((link) => !nextKeys.has(buildLinkKey(link)))
    .map((link) => link.id);

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase.from("person_properties").delete().in("id", deleteIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (normalizedLinks.length === 0 && (currentLinks || []).length > 0) {
    const { error: clearError } = await supabase.from("person_properties").delete().eq("person_id", personId);

    if (clearError) {
      throw clearError;
    }
  }

  const grouped = await listPersonPropertyLinksByPersonIds([personId]);
  return grouped.get(personId) || [];
}
