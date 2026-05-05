import "server-only";

import type { Database } from "@/lib/database.types";
import type { LandingPageConfig, Property, PropertyCustomDataValue, PropertyOffer } from "@/lib/store";
import { normalizeAssetUrl, normalizeAssetUrls } from "@/lib/assets";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listBrokerSummariesByIds } from "@/lib/brokers";
import { ensurePropertyReferenceCode } from "@/lib/property-reference";
import { PROPERTY_SYSTEM_FIELD_KEYS, synchronizePropertyStructuredData } from "@/lib/property-attributes";

type PropertyInsert = Database["public"]["Tables"]["properties"]["Insert"];
type PropertyUpdate = Database["public"]["Tables"]["properties"]["Update"];
type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
type PropertyOfferInsert = Database["public"]["Tables"]["property_offers"]["Insert"];
type PropertyOfferRow = Database["public"]["Tables"]["property_offers"]["Row"];
type PropertyRowWithOffers = PropertyRow & { property_offers?: PropertyOfferRow[] | null };
type PropertyOfferDraft = Omit<PropertyOfferInsert, "property_id">;

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

async function loadPropertyRowsWithOffers(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rows: PropertyRow[],
): Promise<PropertyRowWithOffers[]> {
  if (rows.length === 0) {
    return [];
  }

  const propertyIds = rows.map((row) => row.id);
  const { data: offers, error: offersError } = await supabase
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
  for (const offer of offers || []) {
    const propertyOffers = offersByPropertyId.get(offer.property_id) || [];
    propertyOffers.push(offer);
    offersByPropertyId.set(offer.property_id, propertyOffers);
  }

  return rows.map((row) => ({
    ...row,
    property_offers: offersByPropertyId.get(row.id) || [],
  }));
}

function mapFallbackOffers(row: PropertyRow): PropertyOffer[] {
  if (!Number.isFinite(row.price)) {
    return [];
  }

  const customData = (row.custom_data as Record<string, unknown> | null) || {};

  return [
    {
      offerType: "sale",
      price: row.price,
      ownerPrice: typeof customData.owner_price === "number" ? customData.owner_price : null,
      commissionRate: typeof customData.commission_rate === "number" ? customData.commission_rate : null,
      isPrimary: true,
    },
  ];
}

function mapPropertyOffers(row: PropertyRowWithOffers): PropertyOffer[] {
  if (!Array.isArray(row.property_offers) || row.property_offers.length === 0) {
    return mapFallbackOffers(row);
  }

  return row.property_offers
    .map((offer) => ({
      id: offer.id,
      offerType: offer.offer_type,
      price: offer.price,
      ownerPrice: offer.owner_price,
      commissionRate: offer.commission_rate,
      isPrimary: offer.is_primary,
    }))
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.offerType.localeCompare(right.offerType));
}

function getPrimaryOffer(offers: PropertyOffer[]) {
  return offers.find((offer) => offer.isPrimary) || offers[0] || null;
}

function mapPropertyRow(row: PropertyRowWithOffers): Property {
  const offers = mapPropertyOffers(row);
  const primaryOffer = getPrimaryOffer(offers);
  const referenceAwareCustomData = ensurePropertyReferenceCode(
    (row.custom_data as Record<string, PropertyCustomDataValue> | null) || {},
    { id: row.id, slug: row.slug, title: row.title },
  );
  const structured = synchronizePropertyStructuredData({
    propertyType: row.property_type,
    street: row.street,
    streetNumber: row.street_number,
    complement: row.complement,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    amenities: row.amenities,
    address: row.address,
    customData: referenceAwareCustomData,
  });

  return {
    id: row.id,
    title: row.title,
    slug: row.slug || row.id,
    description: row.description || "",
    price: primaryOffer?.price ?? row.price,
    status: row.status,
    isExclusiveNovian: Boolean(row.is_exclusive_novian),
    coverImage: normalizeAssetUrl(row.cover_image),
    images: normalizeAssetUrls(row.images),
    address: structured.address,
    propertyType: structured.propertyType,
    street: structured.street,
    streetNumber: structured.streetNumber,
    complement: structured.complement,
    neighborhood: structured.neighborhood,
    city: structured.city,
    state: structured.state,
    postalCode: structured.postalCode,
    country: structured.country,
    amenities: structured.amenities,
    mapEmbedUrl: row.map_embed_url || undefined,
    customData: structured.customData as Record<string, PropertyCustomDataValue>,
    landingPage: (row.landing_page as unknown as LandingPageConfig) || {},
    offers,
    brokerUserId: row.broker_user_id,
    broker: null,
  };
}

function toPropertyInsert(data: Omit<Property, "id">): PropertyInsert {
  const structured = synchronizePropertyStructuredData({
    propertyType: data.propertyType,
    street: data.street,
    streetNumber: data.streetNumber,
    complement: data.complement,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country,
    amenities: data.amenities,
    address: data.address,
    customData: data.customData,
  });

  return {
    title: data.title,
    slug: data.slug,
    description: data.description,
    price: data.price,
    status: data.status,
    is_exclusive_novian: Boolean(data.isExclusiveNovian),
    cover_image: data.coverImage,
    images: data.images,
    address: structured.address,
    property_type: structured.propertyType,
    street: structured.street,
    street_number: structured.streetNumber,
    complement: structured.complement,
    neighborhood: structured.neighborhood,
    city: structured.city,
    state: structured.state,
    postal_code: structured.postalCode,
    country: structured.country,
    amenities: structured.amenities,
    map_embed_url: data.mapEmbedUrl,
    custom_data: structured.customData as PropertyInsert["custom_data"],
    landing_page: data.landingPage as unknown as PropertyInsert["landing_page"],
    broker_user_id: data.brokerUserId ?? null,
  };
}

function toPropertyUpdate(data: Partial<Property>): PropertyUpdate {
  const next: PropertyUpdate = {};
  const structured = synchronizePropertyStructuredData({
    propertyType: data.propertyType,
    street: data.street,
    streetNumber: data.streetNumber,
    complement: data.complement,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country,
    amenities: data.amenities,
    address: data.address,
    customData: data.customData,
  });

  if (data.title !== undefined) next.title = data.title;
  if (data.slug !== undefined) next.slug = data.slug;
  if (data.description !== undefined) next.description = data.description;
  if (data.price !== undefined) next.price = data.price;
  if (data.status !== undefined) next.status = data.status;
  if (data.isExclusiveNovian !== undefined) next.is_exclusive_novian = data.isExclusiveNovian;
  if (data.coverImage !== undefined) next.cover_image = data.coverImage;
  if (data.images !== undefined) next.images = data.images;
  if (data.address !== undefined || data.street !== undefined || data.city !== undefined || data.neighborhood !== undefined || data.state !== undefined || data.country !== undefined) next.address = structured.address;
  if (data.propertyType !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.propertyType] !== undefined) next.property_type = structured.propertyType;
  if (data.street !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.street] !== undefined) next.street = structured.street;
  if (data.streetNumber !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.streetNumber] !== undefined) next.street_number = structured.streetNumber;
  if (data.complement !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.complement] !== undefined) next.complement = structured.complement;
  if (data.neighborhood !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.neighborhood] !== undefined) next.neighborhood = structured.neighborhood;
  if (data.city !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.city] !== undefined) next.city = structured.city;
  if (data.state !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.state] !== undefined) next.state = structured.state;
  if (data.postalCode !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.postalCode] !== undefined) next.postal_code = structured.postalCode;
  if (data.country !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.country] !== undefined) next.country = structured.country;
  if (data.amenities !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.amenities] !== undefined) next.amenities = structured.amenities;
  if (data.mapEmbedUrl !== undefined) next.map_embed_url = data.mapEmbedUrl;
  if (data.customData !== undefined) next.custom_data = structured.customData as PropertyUpdate["custom_data"];
  if (data.landingPage !== undefined) next.landing_page = data.landingPage as unknown as PropertyUpdate["landing_page"];
  if (data.brokerUserId !== undefined) next.broker_user_id = data.brokerUserId ?? null;

  return next;
}

async function attachPropertyBrokers(properties: Property[]) {
  const brokerIds = properties.map((property) => property.brokerUserId).filter((value): value is string => Boolean(value));
  const brokersById = await listBrokerSummariesByIds(brokerIds);

  return properties.map((property) => ({
    ...property,
    broker: property.brokerUserId ? brokersById.get(property.brokerUserId) || null : null,
  }));
}

function normalizeOffers(data: Pick<Property, "price" | "offers" | "customData">): PropertyOfferDraft[] {
  const offers = (data.offers || [])
    .filter((offer) => Number.isFinite(offer.price) && offer.price >= 0)
    .map((offer, index) => ({
      offer_type: offer.offerType,
      price: offer.price,
      owner_price: offer.ownerPrice ?? null,
      commission_rate: offer.commissionRate ?? null,
      is_primary: Boolean(offer.isPrimary) || index === 0,
    }));

  if (offers.length > 0) {
    return offers;
  }

  return [
    {
      offer_type: "sale",
      price: data.price,
      owner_price: typeof data.customData?.owner_price === "number" ? data.customData.owner_price : null,
      commission_rate: typeof data.customData?.commission_rate === "number" ? data.customData.commission_rate : null,
      is_primary: true,
    },
  ];
}

async function replacePropertyOffers(propertyId: string, offers: PropertyOfferDraft[]) {
  const supabase = createAdminSupabaseClient();
  const { error: deleteError } = await supabase.from("property_offers").delete().eq("property_id", propertyId);

  if (deleteError) {
    throw deleteError;
  }

  if (offers.length === 0) {
    return;
  }

  const payload = offers.map((offer, index) => ({
    ...offer,
    property_id: propertyId,
    is_primary: Boolean(offer.is_primary) || index === 0,
  }));

  const { error: insertError } = await supabase.from("property_offers").insert(payload);

  if (insertError) {
    throw insertError;
  }
}

export async function listAllProperties() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rowsWithOffers = await loadPropertyRowsWithOffers(supabase, data || []);
  return attachPropertyBrokers(rowsWithOffers.map((row) => mapPropertyRow(row)));
}

export async function getActivePropertyBySlug(slug: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [propertyWithOffers] = await loadPropertyRowsWithOffers(supabase, [data]);
  const [property] = await attachPropertyBrokers([mapPropertyRow(propertyWithOffers)]);
  return property || null;
}

export async function createPropertyAdmin(data: Omit<Property, "id">) {
  const supabase = createAdminSupabaseClient();
  const { data: result, error } = await supabase
    .from("properties")
    .insert([toPropertyInsert(data)])
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const enrichedCustomData = synchronizePropertyStructuredData({
    propertyType: result.property_type,
    street: result.street,
    streetNumber: result.street_number,
    complement: result.complement,
    neighborhood: result.neighborhood,
    city: result.city,
    state: result.state,
    postalCode: result.postal_code,
    country: result.country,
    amenities: result.amenities,
    address: result.address,
    customData: ensurePropertyReferenceCode(data.customData, {
      id: result.id,
      slug: result.slug,
      title: result.title,
    }),
  }).customData;

  const { error: customDataError } = await supabase
    .from("properties")
    .update({ custom_data: enrichedCustomData as PropertyUpdate["custom_data"] })
    .eq("id", result.id);

  if (customDataError) {
    throw customDataError;
  }

  await replacePropertyOffers(result.id, normalizeOffers(data));

  const { data: propertyRow, error: reloadError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", result.id)
    .single();

  if (reloadError) {
    throw reloadError;
  }

  const [propertyWithOffers] = await loadPropertyRowsWithOffers(supabase, [propertyRow]);
  const [property] = await attachPropertyBrokers([mapPropertyRow(propertyWithOffers)]);
  return property;
}

export async function updatePropertyAdmin(id: string, data: Partial<Property>) {
  const supabase = createAdminSupabaseClient();
  const { data: result, error } = await supabase
    .from("properties")
    .update(toPropertyUpdate(data))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const enrichedCustomData = synchronizePropertyStructuredData({
    propertyType: result.property_type,
    street: result.street,
    streetNumber: result.street_number,
    complement: result.complement,
    neighborhood: result.neighborhood,
    city: result.city,
    state: result.state,
    postalCode: result.postal_code,
    country: result.country,
    amenities: result.amenities,
    address: result.address,
    customData: ensurePropertyReferenceCode(
      (result.custom_data as Record<string, PropertyCustomDataValue> | null) || {},
      { id: result.id, slug: result.slug, title: result.title },
    ),
  }).customData;

  const { error: customDataError } = await supabase
    .from("properties")
    .update({ custom_data: enrichedCustomData as PropertyUpdate["custom_data"] })
    .eq("id", result.id);

  if (customDataError) {
    throw customDataError;
  }

  if (data.offers !== undefined) {
    const currentProperty = mapPropertyRow(result as PropertyRow);
    await replacePropertyOffers(result.id, normalizeOffers({
      price: data.price ?? currentProperty.price,
      customData: data.customData ?? currentProperty.customData,
      offers: data.offers,
    }));
  }

  const { data: propertyRow, error: reloadError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", result.id)
    .single();

  if (reloadError) {
    throw reloadError;
  }

  const [propertyWithOffers] = await loadPropertyRowsWithOffers(supabase, [propertyRow]);
  const [property] = await attachPropertyBrokers([mapPropertyRow(propertyWithOffers)]);
  return property;
}

export async function deletePropertyAdmin(id: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
