# 多层级数据库架构设计方案

我为你设计一个完整的多数据库架构，充分利用每个数据库的特性。

## 一、数据库分工策略

### **MySQL（主数据库 - 持久化存储）**

负责核心业务数据的持久化存储

```sql
-- 1. 用户表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    bio TEXT,
    member_level ENUM('free', 'basic', 'premium', 'vip') DEFAULT 'free',
    role ENUM('user', 'admin', 'super_admin') DEFAULT 'user',
    status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_member_level (member_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 博客文章表
CREATE TABLE blog_posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    author_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    summary TEXT,
    content LONGTEXT NOT NULL,
    cover_image VARCHAR(500),
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_author (author_id),
    INDEX idx_status (status),
    INDEX idx_published (published_at),
    INDEX idx_slug (slug),
    FULLTEXT INDEX ft_content (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 文章分类表
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    post_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 文章-分类关联表
CREATE TABLE post_categories (
    post_id BIGINT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. 标签表
CREATE TABLE tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(30) NOT NULL UNIQUE,
    slug VARCHAR(30) NOT NULL UNIQUE,
    post_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 文章-标签关联表
CREATE TABLE post_tags (
    post_id BIGINT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. 评论表
CREATE TABLE comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    parent_id BIGINT NULL,
    content TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    like_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_post (post_id),
    INDEX idx_user (user_id),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 会员等级配置表
CREATE TABLE membership_tiers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    level ENUM('free', 'basic', 'premium', 'vip') UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    duration_days INT DEFAULT 0,
    max_posts INT DEFAULT -1,  -- -1 表示无限制
    max_storage_mb INT DEFAULT 100,
    features JSON,  -- 存储权益列表
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. 用户会员记录表
CREATE TABLE user_memberships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    tier_id INT NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES membership_tiers(id),
    INDEX idx_user_active (user_id, is_active),
    INDEX idx_end_date (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. 权限表
CREATE TABLE permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. 角色-权限关联表
CREATE TABLE role_permissions (
    role ENUM('user', 'admin', 'super_admin') NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role, permission_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. 会话审计表
CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,
    session_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_method VARCHAR(10),
    request_url VARCHAR(500),
    request_params JSON,
    response_status INT,
    execution_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_session (session_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. 登录历史表
CREATE TABLE login_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    location VARCHAR(100),
    status ENUM('success', 'failed', 'blocked') NOT NULL,
    failure_reason VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_time (user_id, created_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 二、Redis（缓存层 - 热数据缓存）

### **数据结构设计**

```javascript
// 1. 用户会话 (String + Hash)
// Key: session:{sessionId}
// Expire: 24小时
{
  "userId": "123",
  "username": "john",
  "role": "user",
  "memberLevel": "premium",
  "loginAt": "2025-11-18T10:00:00Z"
}

// 2. 用户在线状态 (Set)
// Key: online_users
// Members: userId
SADD online_users 123 456 789

// 3. 文章浏览计数 (Hash)
// Key: post:views:{postId}
HINCRBY post:views:1001 count 1
HSET post:views:1001 lastUpdate "2025-11-18T10:00:00Z"

// 4. 热门文章缓存 (Sorted Set)
// Key: trending_posts
// Score: 综合分数 (浏览+点赞+评论)
ZADD trending_posts 9500 "post:1001" 8200 "post:1002"

// 5. 用户权限缓存 (Set)
// Key: user:permissions:{userId}
SADD user:permissions:123 "post.create" "post.edit" "comment.delete"

// 6. 文章详情缓存 (String - JSON)
// Key: post:detail:{postId}
// Expire: 1小时
SET post:detail:1001 '{"id":1001,"title":"...",...}' EX 3600

// 7. 评论列表缓存 (List)
// Key: post:comments:{postId}
LPUSH post:comments:1001 '{"id":501,"content":"...",...}'

// 8. 用户配置缓存 (Hash)
// Key: user:config:{userId}
HSET user:config:123 theme "dark" language "zh-CN" fontSize "16"

// 9. 登录失败计数 (String)
// Key: login:failed:{ip}
// Expire: 15分钟
INCR login:failed:192.168.1.1
EXPIRE login:failed:192.168.1.1 900

// 10. 访问频率限制 (String)
// Key: rate_limit:{userId}:{action}
INCR rate_limit:123:post_create
EXPIRE rate_limit:123:post_create 3600

// 11. 最新文章列表 (List)
// Key: latest_posts
LPUSH latest_posts "post:1005"
LTRIM latest_posts 0 49  // 保持最新50篇

// 12. 分类文章数缓存 (Hash)
// Key: category:post_counts
HSET category:post_counts tech 150 life 80
```

---

## 三、MongoDB（灵活数据存储）

### **集合设计**

```javascript
// 1. 用户个性化配置集合
db.user_preferences.insertOne({
  _id: ObjectId(),
  userId: 123,
  theme: {
    mode: "dark",
    primaryColor: "#3b82f6",
    fontSize: 16,
    fontFamily: "system-ui"
  },
  layout: {
    sidebarPosition: "left",
    showAvatar: true,
    compactMode: false
  },
  notifications: {
    email: true,
    push: false,
    comment: true,
    like: true,
    follow: true
  },
  privacy: {
    showEmail: false,
    showOnlineStatus: true,
    allowMessages: "followers"
  },
  editor: {
    autoSave: true,
    autoSaveInterval: 30,
    defaultFormat: "markdown",
    shortcuts: {}
  },
  customCSS: "",
  bookmarks: [1001, 1005, 1020],
  readingHistory: [
    { postId: 1001, timestamp: ISODate("2025-11-18T10:00:00Z") }
  ],
  updatedAt: ISODate("2025-11-18T10:00:00Z")
});

// 索引
db.user_preferences.createIndex({ userId: 1 }, { unique: true });

// 2. 文章草稿版本控制
db.post_drafts.insertOne({
  _id: ObjectId(),
  postId: 1001,
  userId: 123,
  version: 5,
  title: "文章标题",
  content: "文章内容...",
  metadata: {
    wordCount: 1500,
    readTime: 8,
    lastEditPosition: 120
  },
  autoSaved: true,
  createdAt: ISODate("2025-11-18T10:00:00Z")
});

// 索引
db.post_drafts.createIndex({ postId: 1, version: -1 });
db.post_drafts.createIndex({ userId: 1, createdAt: -1 });

// 3. 用户行为分析
db.user_analytics.insertOne({
  _id: ObjectId(),
  userId: 123,
  date: ISODate("2025-11-18T00:00:00Z"),
  sessions: [
    {
      sessionId: "sess_abc123",
      startTime: ISODate("2025-11-18T10:00:00Z"),
      endTime: ISODate("2025-11-18T11:30:00Z"),
      pageViews: 15,
      actions: [
        { type: "view", target: "post:1001", timestamp: ISODate() },
        { type: "like", target: "post:1001", timestamp: ISODate() }
      ]
    }
  ],
  summary: {
    totalPageViews: 15,
    totalLikes: 3,
    totalComments: 1,
    avgSessionDuration: 5400
  }
});

// 索引
db.user_analytics.createIndex({ userId: 1, date: -1 });

// 4. 系统通知
db.notifications.insertOne({
  _id: ObjectId(),
  userId: 123,
  type: "comment",  // comment, like, follow, system
  title: "新评论",
  content: "用户 @Jane 评论了你的文章",
  data: {
    postId: 1001,
    commentId: 501,
    fromUserId: 456
  },
  isRead: false,
  createdAt: ISODate("2025-11-18T10:00:00Z")
});

// 索引
db.notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 });

// 5. 完整会话审计详情（MySQL只存摘要）
db.audit_details.insertOne({
  _id: ObjectId(),
  auditLogId: 10001,  // 关联MySQL的审计记录
  userId: 123,
  sessionId: "sess_abc123",
  requestHeaders: {},
  requestBody: {},
  responseBody: {},
  errorStack: null,
  performanceMetrics: {
    dbQueryTime: 50,
    cacheHitRate: 0.85,
    memoryUsage: 128
  },
  createdAt: ISODate("2025-11-18T10:00:00Z")
});

// 索引
db.audit_details.createIndex({ auditLogId: 1 });
db.audit_details.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90天过期

// 6. 搜索历史
db.search_history.insertOne({
  _id: ObjectId(),
  userId: 123,
  query: "Vue3教程",
  results: 25,
  clickedResults: [1001, 1003],
  timestamp: ISODate("2025-11-18T10:00:00Z")
});

// 索引
db.search_history.createIndex({ userId: 1, timestamp: -1 });
```

---

## 四、IndexedDB（浏览器端存储）

### **数据库结构**

```javascript
// 数据库名称: BlogDB
// 版本: 1

// 1. 离线文章缓存
const offlinePostsStore = {
  name: "offlinePosts",
  keyPath: "id",
  indexes: [
    { name: "updatedAt", keyPath: "updatedAt" },
    { name: "isFavorite", keyPath: "isFavorite" }
  ]
};

// 数据示例
{
  id: 1001,
  title: "文章标题",
  content: "文章内容...",
  author: {},
  cachedAt: "2025-11-18T10:00:00Z",
  updatedAt: "2025-11-18T09:00:00Z",
  isFavorite: true
}

// 2. 草稿本地备份
const draftsStore = {
  name: "drafts",
  keyPath: "localId",
  autoIncrement: true,
  indexes: [
    { name: "postId", keyPath: "postId" },
    { name: "lastModified", keyPath: "lastModified" }
  ]
};

// 数据示例
{
  localId: 1,
  postId: null,  // null表示新文章
  title: "草稿标题",
  content: "草稿内容...",
  lastModified: "2025-11-18T10:00:00Z",
  syncStatus: "pending"  // pending, synced, conflict
}

// 3. 用户配置本地缓存
const userConfigStore = {
  name: "userConfig",
  keyPath: "key"
};

// 数据示例
{
  key: "theme",
  value: { mode: "dark", primaryColor: "#3b82f6" },
  lastSync: "2025-11-18T10:00:00Z"
}

// 4. 离线队列（待同步的操作）
const syncQueueStore = {
  name: "syncQueue",
  keyPath: "id",
  autoIncrement: true,
  indexes: [
    { name: "timestamp", keyPath: "timestamp" },
    { name: "status", keyPath: "status" }
  ]
};

// 数据示例
{
  id: 1,
  action: "createComment",
  data: { postId: 1001, content: "评论内容" },
  timestamp: "2025-11-18T10:00:00Z",
  status: "pending",  // pending, syncing, failed
  retryCount: 0
}

// 5. 媒体文件缓存
const mediaCacheStore = {
  name: "mediaCache",
  keyPath: "url",
  indexes: [
    { name: "cachedAt", keyPath: "cachedAt" },
    { name: "size", keyPath: "size" }
  ]
};

// 数据示例
{
  url: "https://example.com/image.jpg",
  blob: Blob,  // 实际的文件数据
  mimeType: "image/jpeg",
  size: 204800,
  cachedAt: "2025-11-18T10:00:00Z"
}
```

---

## 五、同步策略设计

### **1. 降级策略**

```javascript
// 数据访问优先级
const dataAccessStrategy = {
  // 1. 首选 Redis (最快)
  tryRedis: async (key) => {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
    return null;
  },
  
  // 2. 降级到 MySQL (可靠)
  fallbackToMySQL: async (query) => {
    const result = await mysql.query(query);
    // 回填 Redis
    if (result) {
      await redis.setex(key, 3600, JSON.stringify(result));
    }
    return result;
  },
  
  // 3. 浏览器端降级到 IndexedDB
  fallbackToIndexedDB: async (storeName, key) => {
    const db = await openIndexedDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return await store.get(key);
  }
};
```

### **2. 异步同步策略**

```javascript
// 同步优先级队列
const syncPriorities = {
  HIGH: ['userConfig', 'drafts'],      // 立即同步
  MEDIUM: ['comments', 'likes'],        // 5秒延迟
  LOW: ['analytics', 'searchHistory']   // 30秒批量
};

// 同步流程
class SyncManager {
  // IndexedDB -> Server
  async syncToServer() {
    const queue = await this.getSyncQueue();
  
    for (const item of queue) {
      try {
        await this.executeSync(item);
        await this.markSynced(item.id);
      } catch (error) {
        await this.handleSyncError(item, error);
      }
    }
  }
  
  // Server -> IndexedDB (定期拉取)
  async syncFromServer() {
    const lastSync = await this.getLastSyncTime();
    const updates = await api.getUpdates(lastSync);
  
    await this.updateLocalCache(updates);
    await this.setLastSyncTime(Date.now());
  }
  
  // 冲突解决
  async resolveConflict(local, remote) {
    if (local.updatedAt > remote.updatedAt) {
      return { action: 'upload', data: local };
    } else {
      return { action: 'download', data: remote };
    }
  }
}
```

### **3. 离线支持策略**

```javascript
// Service Worker 缓存策略
const cacheStrategy = {
  // 网络优先，失败降级到缓存
  networkFirst: ['api/posts', 'api/user'],
  
  // 缓存优先，后台更新
  cacheFirst: ['assets', 'images'],
  
  // 仅缓存
  cacheOnly: ['offline-page'],
  
  // 仅网络
  networkOnly: ['api/auth']
};

// 离线检测
window.addEventListener('online', () => {
  syncManager.syncToServer();
});

window.addEventListener('offline', () => {
  showOfflineNotification();
});
```

---

## 六、数据流转示意

```
用户操作
   ↓
IndexedDB (浏览器本地) ←→ 异步同步队列
   ↓
API 服务器
   ↓
Redis (缓存层) ←→ 热数据更新
   ↓
MySQL (主库) + MongoDB (灵活数据)
   ↓
定时任务: 冷数据归档、统计分析
```

---

## 七、核心配置建议

### **1. MySQL 优化**

* InnoDB 引擎，支持事务
* 合理建立索引，避免过度索引
* 定期分析慢查询日志
* 大文本字段考虑分表存储

### **2. Redis 配置**

* 设置合理的过期时间
* 使用 RDB + AOF 持久化
* 监控内存使用，配置 maxmemory-policy
* 热点数据使用 Hash 结构减少内存

### **3. MongoDB 配置**

* 灵活的 Schema 设计
* 复合索引优化查询
* 设置 TTL 索引自动清理过期数据
* 使用聚合管道做复杂查询

### **4. IndexedDB 管理**

* 限制缓存大小（如 50MB）
* 定期清理过期数据
* 压缩大数据再存储
* 版本升级时做好数据迁移

---

## 八、安全建议

1. **密码** : bcrypt 加密，盐值至少 10 轮
2. **会话** : 使用 HTTP-only Cookie + CSRF Token
3. **SQL 注入** : 使用参数化查询
4. **XSS** : 内容输出时转义
5. **审计** : 记录所有敏感操作
6. **备份** : MySQL 每日全量 + 增量备份

这个架构可以支撑中大型博客网站的需求，并具备良好的扩展性！有任何具体问题欢迎继续问我。
