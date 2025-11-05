"use client";
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

export interface SessionData {
  userId?: string;
  roles?: string[];
  expiresAt?: number;
  [key: string]: unknown;
}

interface SessionContextValue {
  session: SessionData | null;
  cookies: Record<string, string>;
  getCookie: (name: string) => string | undefined;
  setClientCookie: (name: string, value: string, opts?: { maxAge?: number; path?: string; sameSite?: "lax" | "strict" | "none"; secure?: boolean }) => void;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
  setSession: (s: SessionData | null) => void;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  cookies: {},
  getCookie: () => undefined,
  setClientCookie: () => {},
  refreshSession: async () => {},
  clearSession: () => {},
  setSession: () => {},
});

export function SessionProvider({ children, initialCookies = {}, initialSession = null }: React.PropsWithChildren<{ initialCookies?: Record<string, string>; initialSession?: SessionData | null }>) {
  const [session, setSession] = useState<SessionData | null>(initialSession ?? null);
  const [cookiesState, setCookiesState] = useState<Record<string, string>>(initialCookies);

  const getCookie = useCallback((name: string) => cookiesState[name], [cookiesState]);

  const setClientCookie = useCallback((name: string, value: string, opts?: { maxAge?: number; path?: string; sameSite?: "lax" | "strict" | "none"; secure?: boolean }) => {
    if (typeof document === "undefined") return; // SSR 安全
    const parts = [
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
      `path=${opts?.path ?? "/"}`,
    ];
    if (typeof opts?.maxAge === "number") parts.push(`max-age=${opts.maxAge}`);
    if (opts?.sameSite) parts.push(`samesite=${opts.sameSite}`);
    if (opts?.secure) parts.push(`secure`);
    document.cookie = parts.join("; ");
    // 客户端更新本地快照（仅非 HttpOnly）
    setCookiesState((prev) => ({ ...prev, [name]: value }));
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { session?: SessionData; cookies?: Record<string, string> };
      if (data.session !== undefined) setSession(data.session ?? null);
      if (data.cookies) setCookiesState(data.cookies);
    } catch {
      // ignore
    }
  }, []);

  const clearSession = useCallback(() => setSession(null), []);

  const value = useMemo<SessionContextValue>(() => ({
    session,
    cookies: cookiesState,
    getCookie,
    setClientCookie,
    refreshSession,
    clearSession,
    setSession,
  }), [session, cookiesState, getCookie, setClientCookie, refreshSession, clearSession]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}