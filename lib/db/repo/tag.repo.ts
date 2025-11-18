import { getPrisma } from "../adapters/prisma"

export const tagRepo = {
  async create(data: { name: string; slug: string }) {
    return getPrisma().tag.create({ data })
  },
  async findById(id: number) {
    return getPrisma().tag.findUnique({ where: { id } })
  },
  async findBySlug(slug: string) {
    return getPrisma().tag.findUnique({ where: { slug } })
  },
  async list(limit = 50, offset = 0) {
    return getPrisma().tag.findMany({ skip: offset, take: limit, orderBy: { createdAt: "desc" } })
  },
  async update(id: number, data: Partial<{ name: string; slug: string }>) {
    return getPrisma().tag.update({ where: { id }, data })
  },
  async attachToPost(postId: number, tagId: number) {
    return getPrisma().postTag.create({ data: { postId, tagId } })
  },
  async detachFromPost(postId: number, tagId: number) {
    return getPrisma().postTag.delete({ where: { postId_tagId: { postId, tagId } } })
  },
}