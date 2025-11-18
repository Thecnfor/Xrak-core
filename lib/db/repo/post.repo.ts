import { getPrisma } from "../prisma"
import { getRedis } from "../redis"
import { Keys } from "../keys"
import { jsonGet, jsonSet } from "../services/cache.service"
import { TTL } from "../config"
import { Prisma, PostStatus } from "@prisma/client"

export const postRepo = {
  async getById(id: number) {
    const cache = await jsonGet<unknown>(Keys.postDetail(id))
    if (cache) return cache
    const post = await getPrisma().blogPost.findUnique({ where: { id } })
    if (post) await jsonSet(Keys.postDetail(id), post, TTL.POST_DETAIL)
    return post
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
  async incrementView(id: number) {
    const r = await getRedis()
    await r.hIncrBy(Keys.postViews(id), "count", 1)
    await r.hSet(Keys.postViews(id), "lastUpdate", new Date().toISOString())
  },
}