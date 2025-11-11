"use client";

// 客户端测试面板：统一验证 Provider 与客户端上下文的协作
import React from "react";
import { useSession } from "@src/lib/providers/SessionProvider";
import { useToaster } from "@src/lib/providers/ToasterProvider";
import { useTheme } from "@src/lib/providers/ThemeProvider";
import { useAnalytics } from "@src/observability/analytics/Provider";

export default function ClientTestArea() {
  const { session, refreshSession, setClientCookie } = useSession();
  const { toast } = useToaster();
  const { theme, setTheme } = useTheme();
  const analytics = useAnalytics();

  // 触发一次匿名/登录测试事件
  const captureEvent = (name: string) => {
    analytics.capture(name, {
      when: Date.now(),
      userId: session?.userId ?? "",
    });
    toast(`已上报事件：${name}`, { type: "success" });
  };

  return (
    <div
      style={{
        marginTop: 24,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
      }}
    >
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          客户端会话（useSession）
        </h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            data-testid="btn-refresh-session"
            onClick={() => refreshSession()}
            style={{ padding: "8px 12px" }}
          >
            刷新会话（调用 /api/session）
          </button>
          <button
            data-testid="btn-set-debug-cookie"
            onClick={() => setClientCookie("debug", "1", { path: "/" })}
            style={{ padding: "8px 12px" }}
          >
            写入可见 Cookie（debug=1）
          </button>
        </div>
        <pre
          data-testid="pre-client-session"
          style={{
            background: "#0b1220",
            color: "#e5e7eb",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {JSON.stringify(session ?? { status: "no-session" }, null, 2)}
        </pre>
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          主题与吐司
        </h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            data-testid="btn-theme-light"
            onClick={() => setTheme("light")}
            style={{ padding: "8px 12px" }}
          >
            切换亮色
          </button>
          <button
            data-testid="btn-theme-dark"
            onClick={() => setTheme("dark")}
            style={{ padding: "8px 12px" }}
          >
            切换暗色
          </button>
          <button
            data-testid="btn-theme-system"
            onClick={() => setTheme("system")}
            style={{ padding: "8px 12px" }}
          >
            跟随系统
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.8 }}>当前主题：{theme}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            data-testid="btn-toast-info"
            onClick={() => toast("信息提示", { type: "info" })}
            style={{ padding: "8px 12px" }}
          >
            弹出 Info Toast
          </button>
          <button
            data-testid="btn-toast-success"
            onClick={() => toast("成功提示", { type: "success" })}
            style={{ padding: "8px 12px" }}
          >
            弹出 Success Toast
          </button>
          <button
            data-testid="btn-toast-warning"
            onClick={() => toast("警告提示", { type: "warning" })}
            style={{ padding: "8px 12px" }}
          >
            弹出 Warning Toast
          </button>
          <button
            data-testid="btn-toast-error"
            onClick={() => toast("错误提示", { type: "error" })}
            style={{ padding: "8px 12px" }}
          >
            弹出 Error Toast
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          分析埋点（PostHog）
        </h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            data-testid="btn-capture-anonymous"
            onClick={() => captureEvent("dev-test-anonymous")}
            style={{ padding: "8px 12px" }}
          >
            上报匿名事件
          </button>
          <button
            data-testid="btn-capture-active"
            onClick={() => captureEvent("dev-test-active")}
            style={{ padding: "8px 12px" }}
          >
            上报登录事件
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.8 }}>
          说明：事件命名采用 kebab-case；实际落盘与查看需配置
          NEXT_PUBLIC_POSTHOG_KEY。
        </p>
      </section>
    </div>
  );
}
