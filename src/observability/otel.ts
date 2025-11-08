// SSR-safe OpenTelemetry initialization for Node runtime
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

declare global {
  // Prevent re-initialization in dev/HMR
  var __otel_sdk__: NodeSDK | undefined;
}

function shouldInit() {
  // 仅在服务端且非 Edge 运行时初始化；必须提供有效的 OTLP 端点
  const isServer = typeof window === "undefined";
  const isEdge = process.env.NEXT_RUNTIME === "edge";
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const hasEndpoint = typeof endpoint === "string" && endpoint.trim().length > 0;
  return isServer && !isEdge && hasEndpoint;
}

export async function initOTel() {
  if (!shouldInit()) return;
  if (global.__otel_sdk__) return;

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  try {
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : undefined,
    });

    const sdk = new NodeSDK({ traceExporter });
    await sdk.start();
    global.__otel_sdk__ = sdk;
  } catch (e) {
    // 若初始化失败（如 URL 非法），则跳过并输出警告，不阻塞页面渲染
    console.warn("[otel] 初始化跳过：", (e as Error)?.message ?? e);
  }
}

// Auto-init on import in SSR (server components / API routes)
void initOTel();