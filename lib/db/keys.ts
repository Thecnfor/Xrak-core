export const Keys = {
  session: (sessionId: string) => `session:${sessionId}`,
  userPermissions: (userId: number) => `user:permissions:${userId}`,
  userConfig: (userId: number) => `user:config:${userId}`,
  postDetail: (postId: number) => `post:detail:${postId}`,
  postComments: (postId: number) => `post:comments:${postId}`,
  postViews: (postId: number) => `post:views:${postId}`,
  loginFailed: (ip: string) => `login:failed:${ip}`,
  rateLimit: (userId: number, action: string) => `rate_limit:${userId}:${action}`,
  trendingPosts: () => `trending_posts`,
  latestPosts: () => `latest_posts`,
  categoryPostCounts: () => `category:post_counts`,
}