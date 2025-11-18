import { getPrisma } from "../prisma"

export const commentRepo = {
  async create(data: { postId: number; userId: number; content: string; parentId?: number }) {
    return getPrisma().comment.create({ data })
  },
  async listByPost(postId: number, limit = 20, offset = 0) {
    return getPrisma().comment.findMany({ where: { postId }, skip: offset, take: limit, orderBy: { createdAt: "desc" } })
  },
  async remove(id: number) {
    return getPrisma().comment.delete({ where: { id } })
  },
}