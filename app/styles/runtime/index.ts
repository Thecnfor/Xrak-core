import { bindViewportListeners } from "./viewport";
import { bindMotionPref } from "./motion";

export function init() {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const doc = document;
  const cleanups: Array<() => void> = [];
  cleanups.push(bindViewportListeners(doc));
  cleanups.push(bindMotionPref(doc));
  return () => {
    for (const c of cleanups) {
      try { c(); } catch {}
    }
  };
}