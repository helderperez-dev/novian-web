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
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
  });

  isPostHogInitialized = true;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = isPublicAnalyticsPath(pathname);

  useEffect(() => {
    if (!posthogConfig.apiKey || !isPublicRoute) {
      if (isPostHogInitialized) {
        posthog.opt_out_capturing();
      }
      return;
    }

    ensurePostHog();
    posthog.opt_in_capturing();
  }, [isPublicRoute]);

  if (!posthogConfig.apiKey) {
    return children;
  }

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
