import { getPrisma } from "../adapters/prisma"
import { getMongoDb } from "../adapters/mongodb"
import { Prisma } from "@prisma/client"

export const auditRepo = {
  async logSummary(data: { userId?: number; sessionId?: string; action: string; module?: string; ipAddress?: string; userAgent?: string; requestMethod?: string; requestUrl?: string; requestParams?: unknown; responseStatus?: number; executionTimeMs?: number }) {
    return getPrisma().auditLog.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        action: data.action,
        module: data.module,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestMethod: data.requestMethod,
        requestUrl: data.requestUrl,
        requestParams: data.requestParams as Prisma.InputJsonValue,
        responseStatus: data.responseStatus,
        executionTimeMs: data.executionTimeMs,
      },
    })
  },
  async logDetail(auditLogId: number, payload: { requestHeaders?: unknown; requestBody?: unknown; responseBody?: unknown; errorStack?: unknown; performanceMetrics?: unknown }) {
    const db = await getMongoDb()
    return db.collection("audit_details").insertOne({ auditLogId, ...payload, createdAt: new Date() })
  },
}