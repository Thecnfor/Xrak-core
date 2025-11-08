-- 初始化认证相关表结构与索引（幂等）
-- users：基础用户信息与合规字段
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  passwordSalt VARCHAR(255) NULL,
  displayName VARCHAR(255) NULL,
  emailVerifiedAt DATETIME NULL,
  lastLoginAt DATETIME NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  UNIQUE KEY uniq_users_email (email),
  INDEX idx_users_last_login (lastLoginAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- auth_session_audit：会话发放与撤销的审计记录，含来源元数据
CREATE TABLE IF NOT EXISTS auth_session_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sessionId VARCHAR(128) NOT NULL,
  userId INT NOT NULL,
  ip VARCHAR(64) NULL,
  uaHash VARCHAR(64) NULL,
  userAgent VARCHAR(512) NULL,
  country VARCHAR(64) NULL,
  city VARCHAR(64) NULL,
  issuedAt DATETIME NULL,
  revokedAt DATETIME NULL,
  INDEX idx_auth_session_id (sessionId),
  INDEX idx_auth_session_user (userId),
  INDEX idx_auth_session_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- auth_login_attempts：登录尝试记录（成功/失败、原因、来源）
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  userId INT NULL,
  success TINYINT(1) NOT NULL,
  reason VARCHAR(64) NULL,
  ip VARCHAR(64) NULL,
  uaHash VARCHAR(64) NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_login_email (email),
  INDEX idx_auth_login_user (userId),
  INDEX idx_auth_login_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;