"use client";
import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useAppStore, ThemeMode } from "../../store/app";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "system", setTheme: () => {} });

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effective = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  root.classList.toggle("dark", effective === "dark");
  root.setAttribute("data-theme", effective);
}

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // respond to system changes when using system mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const t = useAppStore.getState().theme;
      if (t === "system") applyTheme("system");
    };
    media.addEventListener?.("change", handler);
    return () => media.removeEventListener?.("change", handler);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}