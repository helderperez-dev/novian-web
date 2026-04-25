import type { Database, Json } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LeadCustomData =
  | Database["public"]["Tables"]["leads"]["Row"]["custom_data"]
  | Database["public"]["Tables"]["leads"]["Insert"]["custom_data"]
  | Database["public"]["Tables"]["leads"]["Update"]["custom_data"];

type JsonObject = { [key: string]: Json | undefined };

function toObject(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as JsonObject;
  }

  return value as JsonObject;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getCityFromAddress(address: string | null) {
  if (!address) {
    return null;
  }

  const segments = address
    .split("-")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return segments[0] || null;
  }

  return segments[segments.length - 2] || null;
}

export async function recordLeadAnalyticsEvent(input: {
  leadId: string;
  personId?: string | null;
  customData?: LeadCustomData;
}) {
  const metadata = toObject(input.customData);
  const analytics = toObject(metadata.analytics as Json | null | undefined);
  const eventName = toStringOrNull(analytics.eventName);

  if (!eventName) {
    return;
  }

  const propertyAddress = toStringOrNull(metadata.propertyAddress);

  const insertPayload: Database["public"]["Tables"]["lead_analytics_events"]["Insert"] = {
    lead_id: input.leadId,
    person_id: input.personId ?? null,
    event_name: eventName,
    event_category: "marketing",
    event_source: toStringOrNull(metadata.source) || "website",
    event_channel: "lead_form",
    posthog_distinct_id: toStringOrNull(analytics.posthogDistinctId),
    property_id: toStringOrNull(metadata.propertyId),
    property_slug: toStringOrNull(metadata.propertySlug),
    property_title: toStringOrNull(metadata.property),
    property_price: toNumberOrNull(metadata.propertyPrice),
    property_city: getCityFromAddress(propertyAddress),
    current_url: toStringOrNull(analytics.current_url),
    pathname: toStringOrNull(analytics.pathname),
    referrer: toStringOrNull(analytics.referrer),
    utm_source: toStringOrNull(analytics.utm_source),
    utm_medium: toStringOrNull(analytics.utm_medium),
    utm_campaign: toStringOrNull(analytics.utm_campaign),
    utm_term: toStringOrNull(analytics.utm_term),
    utm_content: toStringOrNull(analytics.utm_content),
    payload: metadata,
  };

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("lead_analytics_events").insert(insertPayload);

  if (error) {
    throw error;
  }
}
