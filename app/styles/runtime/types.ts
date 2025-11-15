export type TokensVars = {
  "--document-width"?: string;
  "--document-height"?: string;
  "--dvw"?: string;
  "--dvh"?: string;
  "--pixel-ratio"?: string;
  "--reduced-motion"?: "0" | "1";
};

export function setCssVars(scope: HTMLElement | Document, vars: TokensVars) {
  const el = scope instanceof Document ? scope.documentElement : scope;
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) el.style.setProperty(k, v);
  }
}