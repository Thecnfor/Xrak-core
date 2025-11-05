"use client";
import React, { useEffect } from "react";
import { useAppStore, ToastItem } from "../../store/app";

function ToastView({ t }: { t: ToastItem }) {
  useEffect(() => {
    if (t.durationMs && t.durationMs > 0) {
      const id = setTimeout(() => {
        useAppStore.getState().removeToast(t.id);
      }, t.durationMs);
      return () => clearTimeout(id);
    }
  }, [t.durationMs, t.id]);

  const bg = t.type === "success" ? "#10b981" : t.type === "warning" ? "#f59e0b" : t.type === "error" ? "#ef4444" : "#334155";
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 4,
      padding: "10px 12px",
      margin: 8,
      borderRadius: 8,
      color: "white",
      backgroundColor: bg,
      boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
      maxWidth: 360,
    }}>
      <strong style={{ fontSize: 14 }}>{t.title}</strong>
      {t.description ? <span style={{ fontSize: 13, opacity: 0.9 }}>{t.description}</span> : null}
    </div>
  );
}

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div style={{ position: "fixed", top: 12, right: 12, zIndex: 1000, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastView t={t} />
        </div>
      ))}
    </div>
  );
}