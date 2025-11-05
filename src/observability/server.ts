import { context, trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("xrak");

export async function withSpan<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  return await tracer.startActiveSpan(name, {}, context.active(), async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (e: unknown) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error)?.message });
      throw e;
    } finally {
      span.end();
    }
  });
}

export function startSpan(name: string) {
  return tracer.startSpan(name);
}