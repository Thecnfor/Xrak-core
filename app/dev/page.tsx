"use client";
import { useEffect, useState } from "react";
import { useGlobalStore } from "@client/state/globalStore";
import * as observ from "@features/telemetry/client/observability";
import type { OutboxRow, SyncStateRow } from "@client/storage/indexeddb";
import { useQuery } from "@tanstack/react-query";
import { getJson, postJson } from "@client/net/apiClient";
import { listOutbox, getSyncState, db } from "@client/storage/indexeddb";

export default function DevPage() {
  const prefs = useGlobalStore((s) => s.prefs as Record<string, unknown>);
  const [healthTs, setHealthTs] = useState<number>(0);
  const [lastEventTs, setLastEventTs] = useState<number>(0);
  const [lastLogTs, setLastLogTs] = useState<number>(0);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [outboxAll, setOutboxAll] = useState<OutboxRow[]>([]);
  const [syncState, setSyncStateState] = useState<SyncStateRow | null>(null);
  const [online, setOnline] = useState<string>(() => String(typeof navigator !== "undefined" ? navigator.onLine : ""));
  const [swActive, setSwActive] = useState<string>(() => String(typeof navigator !== "undefined" && !!navigator.serviceWorker && !!navigator.serviceWorker.controller));

  const health = useQuery({ queryKey: ["health"], queryFn: async () => {
    const r = await getJson<{ ok: boolean; ts?: number }>("/api/health", "health", "latest");
    setHealthTs(Date.now());
    return r;
  }, refetchOnReconnect: true });

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const s = await getSyncState(); setSyncStateState(s);
      const obs = await listOutbox(50); setOutbox(obs); const oa = await db.outbox.toArray(); setOutboxAll(oa);
      t = setInterval(async () => { const s2 = await getSyncState(); setSyncStateState(s2); const o2 = await listOutbox(50); setOutbox(o2); const oa2 = await db.outbox.toArray(); setOutboxAll(oa2); }, 2000);
    })();
    return () => { if (t) clearInterval(t); };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const on = () => setOnline("true");
      const off = () => setOnline("false");
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener("controllerchange", () => { setSwActive(String(!!navigator.serviceWorker?.controller)); });
      }
    }
  }, []);

  async function sendEvent() { await observ.trackEvent("dev_click", { at: Date.now() }); setLastEventTs(Date.now()); }
  async function sendLog() { await observ.log("info", "dev_log", { at: Date.now() }); setLastLogTs(Date.now()); }
  async function queueFailingPost() { await postJson("/api/telemetry/logs", { level: "info", msg: "dev_queue" }); const o = await listOutbox(50); setOutbox(o); const oa = await db.outbox.toArray(); setOutboxAll(oa); }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <section>
        <h2>Layout/Providers</h2>
        <div>Prefs keys: {String(Object.keys(prefs || {}).length)} | Theme: {String((() => { const v = (prefs as Record<string, unknown>)["theme"]; return typeof v === "string" ? v : ""; })())}</div>
        <div>Query defaults: staleTime=60s retry=2</div>
        <div>navigator.onLine: {online}</div>
      </section>
      <section>
        <h2>Health Query</h2>
        <div>status: {health.status} | ok: {String(health.data?.ok)} | last: {String(healthTs)}</div>
        <button onClick={() => health.refetch()}>Refetch</button>
      </section>
      <section>
        <h2>Observability/Outbox</h2>
        <button onClick={sendEvent}>Track Event (enqueue on failure)</button>
        <button onClick={sendLog}>Log Info (enqueue on failure)</button>
        <button onClick={queueFailingPost}>Queue Failing POST</button>
        <div>lastEventTs: {String(lastEventTs)} | lastLogTs: {String(lastLogTs)}</div>
        <div>outbox.pending: {JSON.stringify(outbox || [])}</div>
        <div>outbox.all: {JSON.stringify(outboxAll || [])}</div>
      </section>
      <section>
        <h2>Sync/SW</h2>
        <div>sw.active: {swActive}</div>
        <div>syncState: {JSON.stringify(syncState || {})}</div>
      </section>
    </div>
  );
}