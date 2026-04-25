"use client";

import { useEffect, useMemo } from "react";
import { usePostHog } from "posthog-js/react";
import { getBrowserContextProps, getPropertyAnalyticsProps } from "@/lib/posthog";

type PropertyEngagementTrackerProps = {
  property: {
    id: string;
    slug: string;
    title: string;
    price: number;
    address: string;
  };
  primaryColor: string;
  callToActionText: string;
  showLeadMagnet: boolean;
  leadMagnetTitle?: string;
  variant: "nav" | "hero";
  trackPageView?: boolean;
};

export default function PropertyEngagementTracker({
  property,
  primaryColor,
  callToActionText,
  showLeadMagnet,
  leadMagnetTitle,
  variant,
  trackPageView = false,
}: PropertyEngagementTrackerProps) {
  const posthog = usePostHog();

  const eventProps = useMemo(
    () => ({
      ...getPropertyAnalyticsProps({
        ...property,
        showLeadMagnet,
      }),
      primary_color: primaryColor,
      call_to_action_text: callToActionText,
      lead_magnet_title: leadMagnetTitle || null,
    }),
    [callToActionText, leadMagnetTitle, primaryColor, property, showLeadMagnet],
  );

  useEffect(() => {
    if (!trackPageView) {
      return;
    }

    posthog?.capture("external_property_page_viewed", {
      ...eventProps,
      ...getBrowserContextProps(),
    });
  }, [eventProps, posthog, trackPageView]);

  const captureContactIntent = (placement: "nav" | "hero_primary") => {
    posthog?.capture("external_property_contact_intent", {
      ...eventProps,
      placement,
      ...getBrowserContextProps(),
    });
  };

  const captureSubscribeIntent = () => {
    posthog?.capture("external_property_subscribe_intent", {
      ...eventProps,
      placement: "hero_secondary",
      ...getBrowserContextProps(),
    });
  };

  if (variant === "nav") {
    return (
      <a
        href="#contato"
        onClick={() => captureContactIntent("nav")}
        className="text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
        style={{ backgroundColor: primaryColor, color: "#0d1514" }}
      >
        Falar com Especialista
      </a>
    );
  }

  return (
    <>
      <div className="pt-4 flex flex-col sm:flex-row gap-4">
        <a
          href="#contato"
          onClick={() => captureContactIntent("hero_primary")}
          className="inline-flex items-center justify-center px-8 py-4 rounded-full text-sm font-bold transition-transform hover:scale-105"
          style={{ backgroundColor: primaryColor, color: "#0d1514" }}
        >
          {callToActionText}
        </a>

        {showLeadMagnet ? (
          <a
            href="#contato"
            onClick={captureSubscribeIntent}
            className="inline-flex items-center justify-center px-8 py-4 rounded-full text-sm font-bold border border-white/20 backdrop-blur-sm hover:bg-white/5 transition-colors text-white"
          >
            {leadMagnetTitle || "Baixar Apresentacao"}
          </a>
        ) : null}
      </div>
    </>
  );
}
