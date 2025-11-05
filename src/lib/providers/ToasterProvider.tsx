"use client";
import React, { createContext, useContext } from "react";
import { useAppStore, ToastType } from "../../store/app";

interface ToasterContextValue {
  toast: (title: string, opts?: { description?: string; type?: ToastType; durationMs?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToasterContext = createContext<ToasterContextValue>({ toast: () => "", dismiss: () => {}, clear: () => {} });

export function ToasterProvider({ children }: React.PropsWithChildren) {
  const addToast = useAppStore((s) => s.addToast);
  const removeToast = useAppStore((s) => s.removeToast);
  const clearToasts = useAppStore((s) => s.clearToasts);

  const value: ToasterContextValue = {
    toast: (title, opts) => addToast({ title, description: opts?.description, type: opts?.type ?? "info", durationMs: opts?.durationMs ?? 4000 }),
    dismiss: (id) => removeToast(id),
    clear: () => clearToasts(),
  };

  return (
    <ToasterContext.Provider value={value}>
      {children}
    </ToasterContext.Provider>
  );
}

export function useToaster() {
  return useContext(ToasterContext);
}