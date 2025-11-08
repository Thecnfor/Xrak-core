import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readMySQLEnv } from './env'

describe('MySQL 环境切换', () => {
  const backupEnv = { ...process.env }

  beforeEach(() => {
    // 还原环境变量
    process.env = { ...backupEnv }
    process.env.MYSQL_DATABASE = 'xrak-user'
    process.env.MYSQL_USER = 'XRAK-user'
    process.env.MYSQL_PASSWORD = 'secret'
    process.env.MYSQL_REMOTE_HOST = '116.205.183.125'
    process.env.MYSQL_REMOTE_PORT = '13306'
    process.env.MYSQL_LOCAL_HOST = '127.0.0.1'
    process.env.MYSQL_LOCAL_PORT = '3306'
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('development 使用远程 MySQL', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const cfg = readMySQLEnv()
    expect(cfg.host).toBe('116.205.183.125')
    expect(cfg.port).toBe(13306)
    expect(cfg.MYSQL_DATABASE).toBe('xrak-user')
    expect(cfg.MYSQL_USER).toBe('XRAK-user')
  })

  it('production 使用本地 MySQL', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const cfg = readMySQLEnv()
    expect(cfg.host).toBe('127.0.0.1')
    expect(cfg.port).toBe(3306)
    expect(cfg.MYSQL_DATABASE).toBe('xrak-user')
    expect(cfg.MYSQL_USER).toBe('XRAK-user')
  })
})