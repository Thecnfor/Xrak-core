import { create } from "zustand";
type Prefs = Record<string, unknown>;
import type { SessionContext } from "@shared/types/session";

export type HealthStatus = "unknown" | "up" | "down" | "recovering";

type PrefsSlice = { prefs: Prefs; setPrefs: (p: Prefs) => void };
type HealthSlice = { status: HealthStatus; backoffMs?: number; lastChange?: number; setStatus: (s: { status: HealthStatus; backoffMs?: number; lastChange?: number }) => void; setSnapshot: (s: { status: HealthStatus; backoffMs?: number; lastChange?: number }) => void };
type SessionSlice = { session?: SessionContext; setSession: (s?: SessionContext) => void };

export const useGlobalStore = create<PrefsSlice & HealthSlice & SessionSlice>((set) => ({
  prefs: {},
  setPrefs: (p) => set({ prefs: p }),
  status: "unknown",
  setStatus: (s) => set({ status: s.status, backoffMs: s.backoffMs, lastChange: s.lastChange }),
  setSnapshot: (s) => set({ status: s.status, backoffMs: s.backoffMs, lastChange: s.lastChange }),
  session: undefined,
  setSession: (s) => set({ session: s }),
}));