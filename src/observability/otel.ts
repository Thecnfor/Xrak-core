// SSR-safe OpenTelemetry initialization for Node runtime
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

declare global {
  // Prevent re-initialization in dev/HMR
  var __otel_sdk__: NodeSDK | undefined;
}

function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try {
    // new URL 既校验协议也校验结构
    // 仅接受 http/https 端点
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function shouldInit() {
  // 仅在服务端且非 Edge 运行时初始化；必须提供有效的 OTLP 端点
  const isServer = typeof window === "undefined";
  const isEdge = process.env.NEXT_RUNTIME === "edge";
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const hasValidEndpoint = isValidUrl(endpoint?.trim());
  return isServer && !isEdge && hasValidEndpoint;
}

export async function initOTel() {
  if (!shouldInit()) return;
  if (global.__otel_sdk__) return;

  // 将 OpenTelemetry 诊断日志降低到 WARN，避免开发环境噪音
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  try {
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT!,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : undefined,
    });

    const sdk = new NodeSDK({ traceExporter });
    await sdk.start();
    global.__otel_sdk__ = sdk;
  } catch (e) {
    // 若初始化失败（如 URL 非法），则跳过并输出简洁警告，不阻塞页面渲染
    console.warn("[otel] 初始化已跳过：", (e as Error)?.message ?? e);
  }
}

// Auto-init on import in SSR (server components / API routes)
void initOTel();