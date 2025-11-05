import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type?: ToastType;
  durationMs?: number;
}

export interface AppState {
  // hydration
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // theme
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;

  // toasts (not persisted)
  toasts: ToastItem[];
  addToast: (t: Omit<ToastItem, "id"> & { id?: string }) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      theme: "system",
      setTheme: (m) => set({ theme: m }),

      toasts: [],
      addToast: (t) => {
        const id = t.id ?? genId();
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        return id;
      },
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
      clearToasts: () => set({ toasts: [] }),
    }),
    {
      name: "xrak-app",
      version: 2,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // SSR / 无 localStorage 时的内存回退，避免报错
          const mem = new Map<string, string>();
          const memoryStorage = {
            getItem: (name: string) => (mem.has(name) ? mem.get(name)! : null),
            setItem: (name: string, value: string) => {
              mem.set(name, value);
            },
            removeItem: (name: string) => {
              mem.delete(name);
            },
            clear: () => mem.clear(),
            key: (index: number) => Array.from(mem.keys())[index] ?? null,
            get length() {
              return mem.size;
            },
          } as Storage;
          return memoryStorage;
        }
        try {
          const k = "__xrak_storage_check__";
          window.localStorage.setItem(k, "1");
          window.localStorage.removeItem(k);
          return window.localStorage;
        } catch {
          // Safari 私有模式等场景下回退到内存存储
          const mem = new Map<string, string>();
          const memoryStorage = {
            getItem: (name: string) => (mem.has(name) ? mem.get(name)! : null),
            setItem: (name: string, value: string) => {
              mem.set(name, value);
            },
            removeItem: (name: string) => {
              mem.delete(name);
            },
            clear: () => mem.clear(),
            key: (index: number) => Array.from(mem.keys())[index] ?? null,
            get length() {
              return mem.size;
            },
          } as Storage;
          return memoryStorage;
        }
      }),
      // only persist stable app preferences
      partialize: (s) => ({ theme: s.theme }),
      migrate: (persisted, version) => {
        const prev = persisted as { theme?: unknown };
        let t = prev?.theme as ThemeMode | string | undefined;
        if (typeof version === "number" && version < 2) {
          if (t === "auto") t = "system";
        }
        const allowed: ThemeMode[] = ["light", "dark", "system"];
        const normalized: ThemeMode = allowed.includes(t as ThemeMode) ? (t as ThemeMode) : "system";
        return { theme: normalized } as Partial<AppState>;
      },
      onRehydrateStorage: () => () => {
        // 异步设置，避免同步状态更新带来的渲染阶段警告
        const setHydrated = () => useAppStore.getState().setHasHydrated(true);
        if (typeof Promise !== "undefined") {
          Promise.resolve().then(setHydrated);
        } else {
          setTimeout(setHydrated, 0);
        }
      },
    }
  )
);