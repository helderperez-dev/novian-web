"use client";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export type LeadConversionPayload = {
  formName: string;
  propertyId?: string | null;
  propertySlug?: string | null;
  propertyTitle?: string | null;
  propertyPrice?: number | null;
  propertyOfferType?: string | null;
  leadMagnetTitle?: string | null;
  leadMagnetEnabled?: boolean;
  callToActionText?: string | null;
  currentUrl?: string | null;
  pathname?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
};

function getEventValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function trackLeadConversion(payload: LeadConversionPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const eventValue = getEventValue(payload.propertyPrice);
  const sharedEventParams = {
    form_name: payload.formName,
    property_id: payload.propertyId || undefined,
    property_slug: payload.propertySlug || undefined,
    property_title: payload.propertyTitle || undefined,
    property_offer_type: payload.propertyOfferType || undefined,
    lead_magnet_title: payload.leadMagnetTitle || undefined,
    lead_magnet_enabled: Boolean(payload.leadMagnetEnabled),
    call_to_action_text: payload.callToActionText || undefined,
    page_location: payload.currentUrl || undefined,
    page_path: payload.pathname || undefined,
    page_referrer: payload.referrer || undefined,
    utm_source: payload.utmSource || undefined,
    utm_medium: payload.utmMedium || undefined,
    utm_campaign: payload.utmCampaign || undefined,
    utm_term: payload.utmTerm || undefined,
    utm_content: payload.utmContent || undefined,
    currency: eventValue ? "BRL" : undefined,
    value: eventValue,
  };

  window.dataLayer?.push({
    event: "generate_lead",
    ...sharedEventParams,
  });

  window.gtag?.("event", "generate_lead", sharedEventParams);

  window.fbq?.("track", "Lead", {
    content_name: payload.propertyTitle || payload.formName,
    content_category: "real_estate_lead",
    content_ids: payload.propertyId ? [payload.propertyId] : undefined,
    currency: eventValue ? "BRL" : undefined,
    value: eventValue,
  });
}
