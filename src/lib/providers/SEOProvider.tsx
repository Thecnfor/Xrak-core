"use client";
import React, { createContext, useContext, useMemo } from "react";

export interface SEOContextValue {
  locale: string;
  overrides?: Record<string, unknown>;
}

const SEOContext = createContext<SEOContextValue>({ locale: "zh-CN" });

export function SEOProvider({
  children,
  locale = "zh-CN",
  overrides,
}: React.PropsWithChildren<SEOContextValue>) {
  const value = useMemo(() => ({ locale, overrides }), [locale, overrides]);
  return <SEOContext.Provider value={value}>{children}</SEOContext.Provider>;
}

export function useSEO() {
  return useContext(SEOContext);
}