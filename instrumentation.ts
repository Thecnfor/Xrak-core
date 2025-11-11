// Next.js 16 Instrumentation：在应用启动阶段统一初始化可观测性
// 说明：仅在 Node 运行时且配置了有效 OTLP 端点时初始化 OpenTelemetry；Edge 环境自动跳过。

export async function register() {
  try {
    // 延迟导入，避免在 Edge 环境造成不必要的依赖加载
    await import("./src/observability/otel");
  } catch (e) {
    // 初始化失败不阻塞应用启动，仅记录简要信息（Next 会在终端打印栈）
    console.warn("[instrumentation] 可观测性初始化失败已跳过：", (e as Error)?.message ?? e);
  }
}