"use client";
import { ReactNode } from "react";
import QueryProvider from "./QueryProvider";
import PrefsLoader from "@features/prefs/client/PrefsLoader";
import AppEffects from "./AppEffects";
export default function AppProviders({ children, initialPrefs }: { children: ReactNode; initialPrefs?: Record<string, unknown> }) {
  return (
    <QueryProvider>
      <PrefsLoader initial={initialPrefs}>
        <AppEffects>{children}</AppEffects>
      </PrefsLoader>
    </QueryProvider>
  );
}