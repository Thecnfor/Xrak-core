"use client";
import React from "react";
import { PersistGate } from "./PersistGate";
import { ThemeProvider } from "./ThemeProvider";
import { QueryProvider } from "./QueryProvider";
import { ToasterProvider } from "./ToasterProvider";
import { SEOProvider } from "../../utils/seo/Provider";
import { AnalyticsProvider } from "../../observability/analytics/Provider";

type Props = React.PropsWithChildren<{ locale?: string }>;

export default function AppProviders({ children, locale = "zh-CN" }: Props) {
  return (
    <PersistGate>
      <ThemeProvider>
        <QueryProvider>
          <AnalyticsProvider locale={locale}>
            <ToasterProvider>
              <SEOProvider locale={locale}>{children}</SEOProvider>
            </ToasterProvider>
          </AnalyticsProvider>
        </QueryProvider>
      </ThemeProvider>
    </PersistGate>
  );
}
