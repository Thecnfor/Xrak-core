import { getPrisma } from "../prisma"
import { getRedis } from "../redis"
import { Keys } from "../keys"
import { jsonGet, jsonSet } from "../services/cache.service"

export const postRepo = {
  async getById(id: number) {
    const cache = await jsonGet<unknown>(Keys.postDetail(id))
    if (cache) return cache
    const post = await getPrisma().blogPost.findUnique({ where: { id } })
    if (post) await jsonSet(Keys.postDetail(id), post, 3600)
    return post
  },
  async update(id: number, data: Partial<{ title: string; content: string; status: string; coverImage: string }>) {
    const p = await getPrisma().blogPost.update({ where: { id }, data })
    await jsonSet(Keys.postDetail(id), p, 3600)
    return p
  },
  async incrementView(id: number) {
    const r = await getRedis()
    await r.hIncrBy(Keys.postViews(id), "count", 1)
    await r.hSet(Keys.postViews(id), "lastUpdate", new Date().toISOString())
  },
}