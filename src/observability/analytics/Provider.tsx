"use client";
import React, { createContext, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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

export function AnalyticsProvider({ children }: React.PropsWithChildren<{ locale?: string }>) {
  // 已移除第三方分析 SDK；提供空实现以保持上下文 API 不变
  const pathname = usePathname();
  const searchParams = useSearchParams();
  void pathname;
  void searchParams;

  const value = useMemo<AnalyticsContextValue>(
    () => ({ ready: false, capture: noop, identify: noop, setProps: noop, getFeatureFlag: () => undefined }),
    []
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  return React.useContext(AnalyticsContext);
}