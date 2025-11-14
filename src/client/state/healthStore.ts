import { create } from "zustand";
export type HealthStatus = "unknown" | "up" | "down" | "recovering";
type HealthState = { status: HealthStatus; backoffMs?: number; lastChange?: number };
type HealthActions = { setStatus: (s: HealthState) => void; setSnapshot: (s: HealthState) => void };
export const useHealthStore = create<HealthState & HealthActions>((set) => ({
  status: "unknown",
  setStatus: (s) => set({ status: s.status, backoffMs: s.backoffMs, lastChange: s.lastChange }),
  setSnapshot: (s) => set({ status: s.status, backoffMs: s.backoffMs, lastChange: s.lastChange }),
}));