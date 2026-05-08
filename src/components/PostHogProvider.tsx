"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";
import { isPublicAnalyticsPath, posthogConfig } from "@/lib/posthog";

let isPostHogInitialized = false;

function ensurePostHog() {
  if (isPostHogInitialized || !posthogConfig.apiKey) {
    return;
  }

  posthog.init(posthogConfig.apiKey, {
    api_host: posthogConfig.apiHost,
    defaults: "2026-01-30",
    capture_pageview: "history_change",
    capture_pageleave: "if_capture_pageview",
    autocapture: true,
    capture_performance: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    before_send: (event) => {
      if (!event) {
        return event;
      }

      const currentUrl = event.properties?.$current_url;

      if (typeof currentUrl !== "string") {
        return event;
      }

      try {
        const { pathname } = new URL(currentUrl);
        return isPublicAnalyticsPath(pathname) ? event : null;
      } catch {
        return event;
      }
    },
  });

  isPostHogInitialized = true;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = isPublicAnalyticsPath(pathname);

  useEffect(() => {
    if (!posthogConfig.apiKey) {
      return;
    }

    ensurePostHog();

    if (isPublicRoute) {
      posthog.startSessionRecording();
      return;
    }

    posthog.stopSessionRecording();
  }, [isPublicRoute, pathname]);

  if (!posthogConfig.apiKey) {
    return children;
  }

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
