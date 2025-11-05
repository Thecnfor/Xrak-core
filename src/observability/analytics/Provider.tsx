"use client";
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

type CaptureProps = Record<string, unknown>;

export interface AnalyticsContextValue {
  ready: boolean;
  capture: (event: string, props?: CaptureProps) => void;
  identify: (id: string, props?: CaptureProps) => void;
  setProps: (props: CaptureProps) => void;
  getFeatureFlag: (flag: string) => unknown;
}

const noop = () => {};
const AnalyticsContext = createContext<AnalyticsContextValue>({
  ready: false,
  capture: noop,
  identify: noop,
  setProps: noop,
  getFeatureFlag: () => undefined,
});

// 使用静态导入 posthog-js，遵循工程化最佳实践

export function AnalyticsProvider({ children, locale }: React.PropsWithChildren<{ locale?: string }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const phRef = useRef<typeof posthog | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";
    if (!key) {
      console.warn("PostHog key missing: set NEXT_PUBLIC_POSTHOG_KEY to enable analytics");
      return;
    }
    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // we capture manually for App Router
      capture_pageleave: true,
      autocapture: true,
      // Respect DNT by default
      respect_dnt: true,
    });
    phRef.current = posthog;
    if (locale) {
      posthog.register({ locale });
    }
    queueMicrotask(() => setReady(true));
  }, [locale]);

  // Track pageviews on route changes
  useEffect(() => {
    const ph = phRef.current;
    if (!ph) return;
    const url = typeof window !== "undefined" ? window.location.href : pathname ?? "/";
    ph.capture("$pageview", {
      $current_url: url,
      path: pathname,
      query: searchParams?.toString() ?? "",
      locale,
    });
  }, [pathname, searchParams, locale]);

  const capture = useCallback((event: string, props?: CaptureProps) => {
    phRef.current?.capture?.(event, props ?? {});
  }, []);

  const identify = useCallback((id: string, props?: CaptureProps) => {
    phRef.current?.identify?.(id, props ?? {});
  }, []);

  const setProps = useCallback((props: CaptureProps) => {
    phRef.current?.register?.(props ?? {});
  }, []);

  const getFeatureFlag = useCallback((flag: string) => {
    return phRef.current?.getFeatureFlag?.(flag);
  }, []);

  const value = useMemo<AnalyticsContextValue>(
    () => ({ ready, capture, identify, setProps, getFeatureFlag }),
    [ready, capture, identify, setProps, getFeatureFlag]
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  return React.useContext(AnalyticsContext);
}