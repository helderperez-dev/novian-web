import type { Database, Json } from "@/lib/database.types";
import { normalizeAssetUrl } from "@/lib/assets";
import type { PropertyOffer } from "@/lib/store";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type JsonObject = { [key: string]: Json | undefined };
type PersonPropertyRelationshipType = Database["public"]["Tables"]["person_properties"]["Row"]["relationship_type"];
type PersonPropertyRow = Database["public"]["Tables"]["person_properties"]["Row"];
type PersonPropertyInsert = Database["public"]["Tables"]["person_properties"]["Insert"];
type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
type PropertyOfferRow = Database["public"]["Tables"]["property_offers"]["Row"];
type PropertyRowWithOffers = PropertyRow & { property_offers?: PropertyOfferRow[] | null };

function isMissingPropertyOffersTableError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return (
    Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "PGRST205") &&
    message.includes("property_offers")
  );
}

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
    offers: PropertyOffer[];
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

function mapPropertyOffers(property: PropertyRowWithOffers): PropertyOffer[] {
  if (!Array.isArray(property.property_offers) || property.property_offers.length === 0) {
    return Number.isFinite(property.price)
      ? [
          {
            offerType: "sale",
            price: property.price,
            isPrimary: true,
          },
        ]
      : [];
  }

  return property.property_offers
    .map((offer) => ({
      id: offer.id,
      offerType: offer.offer_type,
      price: offer.price,
      ownerPrice: offer.owner_price,
      commissionRate: offer.commission_rate,
      isPrimary: offer.is_primary,
    }))
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
}

function mapLinkSummary(row: PersonPropertyRow, property: PropertyRowWithOffers | undefined): PersonPropertyLinkSummary {
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
          offers: mapPropertyOffers(property),
          status: property.status,
          coverImage: normalizeAssetUrl(property.cover_image),
        }
      : null,
  };
}

async function loadPropertyRowsWithOffers(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rows: PropertyRow[],
): Promise<PropertyRowWithOffers[]> {
  if (rows.length === 0) {
    return [];
  }

  const propertyIds = rows.map((row) => row.id);
  const { data: offerRows, error: offersError } = await supabase
    .from("property_offers")
    .select("*")
    .in("property_id", propertyIds);

  if (offersError) {
    if (isMissingPropertyOffersTableError(offersError)) {
      return rows.map((row) => ({ ...row, property_offers: [] }));
    }
    throw offersError;
  }

  const offersByPropertyId = new Map<string, PropertyOfferRow[]>();
  for (const offer of offerRows || []) {
    const offers = offersByPropertyId.get(offer.property_id) || [];
    offers.push(offer);
    offersByPropertyId.set(offer.property_id, offers);
  }

  return rows.map((row) => ({
    ...row,
    property_offers: offersByPropertyId.get(row.id) || [],
  }));
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
  const propertyMap = new Map<string, PropertyRowWithOffers>();

  if (propertyIds.length > 0) {
    const { data: propertyRows, error: propertiesError } = await supabase
      .from("properties")
      .select("id, title, slug, address, price, status, cover_image")
      .in("id", propertyIds);

    if (propertiesError) {
      throw propertiesError;
    }

    const rowsWithOffers = await loadPropertyRowsWithOffers(supabase, (propertyRows || []) as PropertyRow[]);
    for (const property of rowsWithOffers) {
      propertyMap.set(property.id, property);
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
