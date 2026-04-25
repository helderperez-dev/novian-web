"use client";

import type { Property } from "@/lib/store";

type PropertyAnalyticsInput = Pick<Property, "id" | "slug" | "title" | "price" | "address"> & {
  showLeadMagnet?: boolean;
};

export const posthogConfig = {
  apiKey: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  apiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
};

export function isPublicAnalyticsPath(pathname: string | null) {
  if (!pathname) return false;

  return pathname === "/" || pathname.startsWith("/imoveis/");
}

function getCityFromAddress(address: string | null | undefined) {
  if (!address) return null;

  const segments = address
    .split("-")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return segments[0] || null;
  }

  return segments[segments.length - 2] || null;
}

export function getPropertyAnalyticsProps(property: PropertyAnalyticsInput) {
  return {
    property_id: property.id,
    property_slug: property.slug,
    property_title: property.title,
    property_price: property.price,
    property_city: getCityFromAddress(property.address),
    property_address: property.address || null,
    lead_magnet_enabled: Boolean(property.showLeadMagnet),
  };
}

export function getBrowserContextProps() {
  if (typeof window === "undefined") {
    return {};
  }

  const currentUrl = new URL(window.location.href);

  return {
    current_url: currentUrl.toString(),
    pathname: currentUrl.pathname,
    referrer: document.referrer || null,
    utm_source: currentUrl.searchParams.get("utm_source"),
    utm_medium: currentUrl.searchParams.get("utm_medium"),
    utm_campaign: currentUrl.searchParams.get("utm_campaign"),
    utm_term: currentUrl.searchParams.get("utm_term"),
    utm_content: currentUrl.searchParams.get("utm_content"),
  };
}
