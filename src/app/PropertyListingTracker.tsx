"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { getBrowserContextProps, getPropertyAnalyticsProps } from "@/lib/posthog";

type PropertyListingTrackerProps = {
  property: {
    id: string;
    slug: string;
    title: string;
    price: number;
    address: string;
  };
  children: React.ReactNode;
};

export default function PropertyListingTracker({ property, children }: PropertyListingTrackerProps) {
  const posthog = usePostHog();

  return (
    <Link
      href={`/imoveis/${property.slug}`}
      onClick={() => {
        posthog?.capture("external_property_listing_clicked", {
          ...getPropertyAnalyticsProps(property),
          click_area: "property_card",
          ...getBrowserContextProps(),
        });
      }}
      className="group block"
    >
      {children}
    </Link>
  );
}
