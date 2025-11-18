import { getPrisma } from "../prisma"

export const permissionRepo = {
  async listByRole(role: "user" | "admin" | "super_admin") {
    return getPrisma().rolePermission.findMany({ where: { role }, include: { permission: true } })
  },
}