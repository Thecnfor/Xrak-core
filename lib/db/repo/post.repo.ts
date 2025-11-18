import { getPrisma } from "../adapters/prisma"
import { getRedis } from "../adapters/redis"
import { Keys } from "../core/keys"
import { jsonGet, jsonSet } from "../services/cache.service"
import { TTL } from "../core/config"
import { Prisma, PostStatus } from "@prisma/client"

export const postRepo = {
  async create(data: { authorId: number; title: string; slug: string; content: string; summary?: string; coverImage?: string; status?: PostStatus }) {
    return getPrisma().blogPost.create({ data: { authorId: data.authorId, title: data.title, slug: data.slug, content: data.content, summary: data.summary, coverImage: data.coverImage, status: data.status ?? "draft" } })
  },
  async getById(id: number) {
    const cache = await jsonGet<unknown>(Keys.postDetail(id))
    if (cache) return cache
    const post = await getPrisma().blogPost.findUnique({ where: { id } })
    if (post) await jsonSet(Keys.postDetail(id), post, TTL.POST_DETAIL)
    return post
  },
  async findBySlug(slug: string) {
    return getPrisma().blogPost.findUnique({ where: { slug } })
  },
  async update(id: number, data: Partial<{ title: string; content: string; status: string; coverImage: string }>) {
    const update: Prisma.BlogPostUpdateInput = {}
    if (data.title !== undefined) update.title = data.title
    if (data.content !== undefined) update.content = data.content
    if (data.coverImage !== undefined) update.coverImage = data.coverImage
    if (data.status !== undefined) update.status = data.status as PostStatus
    const p = await getPrisma().blogPost.update({ where: { id }, data: update })
    await jsonSet(Keys.postDetail(id), p, TTL.POST_DETAIL)
    return p
  },
  async listByAuthor(authorId: number, limit = 20, offset = 0, status?: PostStatus) {
    return getPrisma().blogPost.findMany({ where: { authorId, ...(status ? { status } : {}) }, skip: offset, take: limit, orderBy: { createdAt: "desc" } })
  },
  async addCategory(postId: number, categoryId: number) {
    return getPrisma().postCategory.create({ data: { postId, categoryId } })
  },
  async removeCategory(postId: number, categoryId: number) {
    return getPrisma().postCategory.delete({ where: { postId_categoryId: { postId, categoryId } } })
  },
  async addTag(postId: number, tagId: number) {
    return getPrisma().postTag.create({ data: { postId, tagId } })
  },
  async removeTag(postId: number, tagId: number) {
    return getPrisma().postTag.delete({ where: { postId_tagId: { postId, tagId } } })
  },
  async incrementView(id: number) {
    const r = await getRedis()
    await r.hIncrBy(Keys.postViews(id), "count", 1)
    await r.hSet(Keys.postViews(id), "lastUpdate", new Date().toISOString())
  },
  async setTrendingScore(id: number, score: number) {
    const r = await getRedis()
    await r.zAdd(Keys.trendingPosts(), [{ score, value: String(id) }])
  },
  async incrementTrending(id: number, by = 1) {
    const r = await getRedis()
    await r.zIncrBy(Keys.trendingPosts(), by, String(id))
  },
  async topTrending(limit = 10) {
    const r = await getRedis()
    const ids = await r.zRange(Keys.trendingPosts(), -limit, -1, { rev: true })
    return Promise.all(ids.map((s) => this.getById(Number(s))))
  },
}