"use client";
import { ReactNode, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getJson } from "@client/net/apiClient";
import { useGlobalStore } from "@client/state/globalStore";

export default function PrefsLoader({ children, initial }: { children: ReactNode; initial?: Record<string, unknown> }) {
  const setPrefs = useGlobalStore((s) => s.setPrefs);
  const q = useQuery<Record<string, unknown>>({ queryKey: ["prefs"], queryFn: async () => { const r = await getJson<{ prefs: Record<string, unknown> }>("/api/prefs", "prefs", "current"); return r?.prefs ?? {}; }, refetchOnReconnect: true });
  useEffect(() => { if (initial) setPrefs(initial); }, [initial, setPrefs]);
  const prefs = useMemo(() => q.data ?? {}, [q.data]);
  useEffect(() => { setPrefs(prefs); }, [prefs, setPrefs]);
  return <>{children}</>;
}