import { getPrisma } from "../adapters/prisma"

export const categoryRepo = {
  async create(data: { name: string; slug: string; description?: string }) {
    return getPrisma().category.create({ data })
  },
  async findById(id: number) {
    return getPrisma().category.findUnique({ where: { id } })
  },
  async findBySlug(slug: string) {
    return getPrisma().category.findUnique({ where: { slug } })
  },
  async list(limit = 50, offset = 0) {
    return getPrisma().category.findMany({ skip: offset, take: limit, orderBy: { createdAt: "desc" } })
  },
  async update(id: number, data: Partial<{ name: string; slug: string; description: string }>) {
    return getPrisma().category.update({ where: { id }, data })
  },
  async attachToPost(postId: number, categoryId: number) {
    return getPrisma().postCategory.create({ data: { postId, categoryId } })
  },
  async detachFromPost(postId: number, categoryId: number) {
    return getPrisma().postCategory.delete({ where: { postId_categoryId: { postId, categoryId } } })
  },
}