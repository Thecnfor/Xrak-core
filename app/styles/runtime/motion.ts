import { setCssVars } from "./types";

export function bindMotionPref(doc: Document) {
  const html = doc.documentElement;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const apply = () => {
    const reduced = mq.matches;
    setCssVars(doc, { "--reduced-motion": reduced ? "1" : "0" });
    if (reduced) html.classList.add("motion-reduced"); else html.classList.remove("motion-reduced");
  };
  apply();
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}