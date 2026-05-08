"use client";

import { useEffect, useRef } from "react";
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
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    capture_performance: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
  });

  isPostHogInitialized = true;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = isPublicAnalyticsPath(pathname);
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthogConfig.apiKey || !isPublicRoute) {
      if (isPostHogInitialized) {
        posthog.stopSessionRecording();
        posthog.opt_out_capturing();
      }
      lastTrackedPathRef.current = null;
      return;
    }

    ensurePostHog();
    posthog.opt_in_capturing();
    posthog.startSessionRecording();

    if (pathname && lastTrackedPathRef.current !== pathname) {
      posthog.capture("$pageview");
      lastTrackedPathRef.current = pathname;
    }
  }, [isPublicRoute, pathname]);

  if (!posthogConfig.apiKey) {
    return children;
  }

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
