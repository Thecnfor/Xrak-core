"use client";
import { useEffect, useMemo, useRef } from "react";
import { useSession } from "./SessionProvider";
import { useAppStore, ThemeMode } from "@src/store/app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// 偏好设置引导：在 QueryProvider 之后运行，负责将服务端偏好与客户端状态对齐
// - 登录用户：读取 /api/preferences?namespace=ui，若有值则覆盖本地 theme
// - 当本地 theme 变更时，同步 PUT /api/preferences（带 CSRF），保持一致性

type PreferencesResponse = { preferences?: Record<string, unknown> };

function getThemeFromPrefs(prefs: Record<string, unknown> | undefined): ThemeMode | null {
  const raw = prefs?.["theme_mode"] as any;
  const mode = raw?.mode as string | undefined;
  const allowed: ThemeMode[] = ["light", "dark", "system"];
  return allowed.includes(mode as ThemeMode) ? (mode as ThemeMode) : null;
}

export function PrefsBootstrap() {
  const { session } = useSession();
  const uid = session?.userId ? Number(session.userId) : 0;
  const queryClient = useQueryClient();

  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  // 读取 UI 命名空间偏好
  const { data } = useQuery<PreferencesResponse | null>({
    queryKey: ["prefs", "ui", uid],
    queryFn: async () => {
      if (uid <= 0) return null; // 匿名不请求
      const res = await fetch(`/api/preferences?namespace=ui`, { credentials: "same-origin" });
      if (!res.ok) return null;
      return (await res.json()) as PreferencesResponse;
    },
    enabled: uid > 0,
    staleTime: 60_000,
  });

  // 首次加载时以服务端值覆盖本地主题（若合法）
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const prefs = data?.preferences;
    const serverTheme = getThemeFromPrefs(prefs);
    if (serverTheme && serverTheme !== theme) {
      setTheme(serverTheme);
    }
  }, [data, theme, setTheme]);

  // 变更时同步写入服务端
  const mutation = useMutation({
    mutationKey: ["prefs", "ui", "set", uid],
    mutationFn: async (next: ThemeMode) => {
      if (uid <= 0) return; // 匿名不写入
      const csrf = (session as any)?.csrfSecret ?? "";
      await fetch(`/api/preferences`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ namespace: "ui", key: "theme_mode", value: { mode: next } }),
      });
      // 更新本地缓存
      await queryClient.invalidateQueries({ queryKey: ["prefs", "ui", uid] });
    },
  });

  // 订阅主题变化并触发同步（防抖）
  const lastPersistedRef = useRef<ThemeMode | null>(null);
  useEffect(() => {
    if (uid <= 0) return; // 匿名不写入
    if (lastPersistedRef.current === theme) return;
    lastPersistedRef.current = theme;
    const t = setTimeout(() => mutation.mutate(theme), 300);
    return () => clearTimeout(t);
  }, [theme, uid]);

  return null;
}