// SSR-safe OpenTelemetry initialization for Node runtime
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

declare global {
  // Prevent re-initialization in dev/HMR
  var __otel_sdk__: NodeSDK | undefined;
}

function shouldInit() {
  const isServer = typeof window === "undefined";
  const isEdge = process.env.NEXT_RUNTIME === "edge";
  const hasEndpoint = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  return isServer && !isEdge && hasEndpoint;
}

export async function initOTel() {
  if (!shouldInit()) return;
  if (global.__otel_sdk__) return;

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : undefined,
  });

  const sdk = new NodeSDK({ traceExporter });
  await sdk.start();
  global.__otel_sdk__ = sdk;
}

// Auto-init on import in SSR (server components / API routes)
void initOTel();