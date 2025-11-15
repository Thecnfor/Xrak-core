import { setCssVars } from "./types";

function roundPx(n: number) {
  return Math.round(n);
}

function readViewport() {
  const vv = typeof window !== "undefined" ? (window.visualViewport ?? null) : null;
  const width = vv ? vv.width : (typeof window !== "undefined" ? window.innerWidth : 0);
  const height = vv ? vv.height : (typeof window !== "undefined" ? window.innerHeight : 0);
  const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return { width, height, ratio };
}

export function updateViewportVars(doc: Document) {
  const { width, height, ratio } = readViewport();
  setCssVars(doc, {
    "--document-width": `${roundPx(width)}px`,
    "--document-height": `${roundPx(height)}px`,
    "--dvw": `${roundPx(width)}px`,
    "--dvh": `${roundPx(height)}px`,
    "--pixel-ratio": `${ratio}`,
  });
}

export function bindViewportListeners(doc: Document) {
  let raf = 0;
  let lastW = 0;
  let lastH = 0;
  const schedule = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      const vv = readViewport();
      if (Math.abs(vv.width - lastW) >= 1 || Math.abs(vv.height - lastH) >= 1) {
        lastW = vv.width;
        lastH = vv.height;
        updateViewportVars(doc);
      }
    });
  };
  const onResize = () => schedule();
  updateViewportVars(doc);
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", onResize, { passive: true });
    vv.addEventListener("scroll", onResize, { passive: true });
  }
  const force = () => updateViewportVars(doc);
  setTimeout(force, 0);
  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    if (vv) {
      vv.removeEventListener("resize", onResize as EventListener);
      vv.removeEventListener("scroll", onResize as EventListener);
    }
    if (raf) cancelAnimationFrame(raf);
  };
}