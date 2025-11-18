import { getPrisma } from "../prisma"
import { getMongoDb } from "../mongodb"
import { getRedis } from "../redis"
import { Keys } from "../keys"
import { Prisma } from "@prisma/client"

export const userRepo = {
  async findById(id: number) {
    return getPrisma().user.findUnique({ where: { id } })
  },
  async findByEmail(email: string) {
    return getPrisma().user.findUnique({ where: { email } })
  },
  async create(data: { username: string; email: string; passwordHash: string }) {
    return getPrisma().user.create({ data })
  },
  async recordLogin(userId: number, meta?: { ip?: string; ua?: string; location?: string; status?: "success" | "failed" | "blocked"; reason?: string }) {
    return getPrisma().loginHistory.create({
      data: {
        userId,
        ipAddress: meta?.ip,
        userAgent: meta?.ua,
        location: meta?.location,
        status: (meta?.status ?? "success") as Prisma.LoginStatus,
        failureReason: meta?.reason,
      },
    })
  },
  async setSession(sessionId: string, payload: unknown, ttlSeconds = 86400) {
    const r = await getRedis()
    await r.hSet(Keys.session(sessionId), { data: JSON.stringify(payload) })
    await r.expire(Keys.session(sessionId), ttlSeconds)
  },
  async getPreferences(userId: number) {
    const db = await getMongoDb()
    return db.collection("user_preferences").findOne({ userId })
  },
  async savePreferences(userId: number, preferences: Record<string, unknown>) {
    const db = await getMongoDb()
    return db.collection("user_preferences").updateOne({ userId }, { $set: { ...preferences, updatedAt: new Date() } }, { upsert: true })
  },
  async listPermissionsByRole(role: "user" | "admin" | "super_admin") {
    return getPrisma().rolePermission.findMany({ where: { role }, include: { permission: true } })
  },
  async isAdmin(userId: number) {
    const u = await getPrisma().user.findUnique({ where: { id: userId }, select: { role: true } })
    return u?.role === "admin" || u?.role === "super_admin"
  },
}