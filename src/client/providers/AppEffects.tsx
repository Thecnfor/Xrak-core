"use client";
import { useEffect } from "react";
import { useGlobalStore } from "@client/state/globalStore";
import { start, stop } from "@client/sync/syncManager";
import type { HealthStatus } from "@client/state/globalStore";
export default function AppEffects({ children }: { children: React.ReactNode }) {
  const setSnapshot = useGlobalStore((s) => s.setSnapshot);
  const setStatus = useGlobalStore((s) => s.setStatus);
  const status = useGlobalStore((s) => s.status);
  const prefs = useGlobalStore((s) => s.prefs);
  const setScheme = useGlobalStore((s) => s.setScheme);
  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 1000;
    function connect() {
      try {
        es = new EventSource("/api/health/stream");
        es.addEventListener("status", (ev) => {
          try {
            const d = JSON.parse((ev as MessageEvent).data || "{}");
            const s = String(d.status);
            const status: HealthStatus = s === "up" || s === "down" || s === "recovering" || s === "unknown" ? (s as HealthStatus) : "unknown";
            setSnapshot({ status, backoffMs: Number(d.backoffMs) || undefined, lastChange: Number(d.at) || undefined });
          } catch {}
        });
        es.addEventListener("ping", () => {});
        es.onerror = () => { try { es?.close(); } catch {} es = null; setStatus({ status: "unknown" }); setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); };
      } catch { setStatus({ status: "unknown" }); setTimeout(connect, retry); retry = Math.min(retry * 2, 30000); }
    }
    connect();
    return () => { try { es?.close(); } catch {} };
  }, [setSnapshot, setStatus]);
  useEffect(() => { if (typeof navigator !== "undefined" && "serviceWorker" in navigator) { navigator.serviceWorker.register("/sw.js"); } }, []);
  useEffect(() => { if (status === "up") start(); else stop(); }, [status]);
  useEffect(() => {
    const el = typeof document !== "undefined" ? document.documentElement : null;
    if (!el) return;
    const rawTheme = (prefs as Record<string, unknown>)["theme"];
    const prefTheme = typeof rawTheme === "string" ? rawTheme.toLowerCase() : "";
    if (prefTheme === "dark" || prefTheme === "light") {
      setScheme(prefTheme as "dark" | "light");
      if (prefTheme === "dark") el.classList.add("dark"); else el.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        const s = mq.matches ? "dark" : "light" as const;
        setScheme(s);
        if (s === "dark") el.classList.add("dark"); else el.classList.remove("dark");
      };
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    const title = typeof (prefs as Record<string, unknown>)["seo.title"] === "string" ? String((prefs as Record<string, unknown>)["seo.title"]) : undefined;
    const desc = typeof (prefs as Record<string, unknown>)["seo.description"] === "string" ? String((prefs as Record<string, unknown>)["seo.description"]) : undefined;
    if (title) document.title = title;
    if (desc) { let el2 = document.querySelector('meta[name="description"]'); if (!el2) { el2 = document.createElement("meta"); el2.setAttribute("name", "description"); document.head.appendChild(el2); } el2.setAttribute("content", desc); }
  }, [prefs, setScheme]);
  return <>{children}</>;
}