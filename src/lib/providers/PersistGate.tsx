"use client";
import React from "react";
import { useAppStore } from "../../store/app";

export function PersistGate({ children, fallback }: React.PropsWithChildren<{ fallback?: React.ReactNode }>) {
  const hasHydrated = useAppStore((s) => s.hasHydrated);

  // If SSR, render once hydration completes to avoid mismatch
  if (!hasHydrated) {
    // 默认不渲染任何占位内容；可通过传入 fallback 自定义
    return (fallback ?? null);
  }
  return <>{children}</>;
}