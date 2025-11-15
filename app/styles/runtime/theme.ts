export type Scheme = "light" | "dark";

export function applyThemeClass(doc: Document, scheme?: Scheme) {
  if (!scheme) return;
  const el = doc.documentElement;
  if (scheme === "dark") el.classList.add("dark"); else el.classList.remove("dark");
}