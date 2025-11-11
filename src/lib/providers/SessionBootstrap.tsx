"use client";
import { useEffect, useRef } from "react";
import { useSession } from "./SessionProvider";
import { useAnalytics } from "@src/observability/analytics/Provider";

// 客户端挂件：首次渲染时刷新会话，采集访问信息
export function SessionBootstrap() {
  const { refreshSession, session } = useSession();
  const analytics = useAnalytics();
  const didRefreshRef = useRef(false);
  const lastUidRef = useRef<string | null>(null);

  useEffect(() => {
    // 刷新会话以确保首次访问自动获取 sid 与上下文
    // 注意：在 React 严格模式下，开发环境会触发双调用，这里用标记防止重复刷新
    if (didRefreshRef.current) return;
    didRefreshRef.current = true;
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    // 当会话变化时进行识别与事件采集（匿名或登录）
    // 仅在分析 SDK 就绪后再采集，避免未初始化时的无效调用
    if (!analytics.ready) return;
    const uid = session?.userId ? String(session.userId) : null;

    // 去重：相同会话状态不重复上报（避免初始 null 与刷新后匿名 0 的双重匿名事件）
    if (uid === lastUidRef.current) return;
    lastUidRef.current = uid;

    // 业务约定：userId 为 "0" 代表匿名会话
    if (uid && uid !== "0") {
      analytics.identify(uid);
      analytics.capture("session-active", { userId: uid });
    } else {
      analytics.capture("session-anonymous", {});
    }
  }, [session, analytics]);

  return null;
}
