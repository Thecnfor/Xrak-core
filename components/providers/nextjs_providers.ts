// ==========================================
// app/layout.tsx - 根布局入口
// ==========================================
import { Providers } from '@/providers'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import 'nprogress/nprogress.css'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

// ==========================================
// providers/index.tsx - Provider 组合层
// ==========================================
import { NextThemesProvider } from './theme-provider'
import { ReactQueryProvider } from './react-query-provider'
import { ZustandStoreProvider } from './zustand-provider'
import { NextAuthProvider } from './auth-provider'
import { DatabaseProvider } from './database-provider'
import { SessionAuditProvider } from './session-audit-provider'
import { SecurityProvider } from './security-provider'
import { AnalyticsProvider } from './analytics-provider'
import { ErrorBoundaryProvider } from './error-boundary-provider'
import { ToasterProvider } from './toaster-provider'
import { ProgressProvider } from './progress-provider'
import { OfflineProvider } from './offline-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // ============================================
    // 第 1 层：错误边界 - 最外层捕获所有错误
    // ============================================
    <ErrorBoundaryProvider>
      
      {/* ============================================
          第 2 层：主题系统 - 避免闪烁，必须最先初始化
          ============================================ */}
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        
        {/* ============================================
            第 3 层：数据库连接层 - 为数据层提供基础
            ============================================ */}
        <DatabaseProvider>
          
          {/* ============================================
              第 4 层：服务端状态管理 - React Query
              ============================================ */}
          <ReactQueryProvider>
            
            {/* ============================================
                第 5 层：客户端状态管理 - Zustand + 持久化
                ============================================ */}
            <ZustandStoreProvider>
              
              {/* ============================================
                  第 6 层：身份认证 - NextAuth.js
                  ============================================ */}
              <NextAuthProvider>
                
                {/* ============================================
                    第 7 层：会话审计 - 监控用户行为
                    ============================================ */}
                <SessionAuditProvider>
                  
                  {/* ============================================
                      第 8 层：安全防护 - CSRF, XSS, CSP
                      ============================================ */}
                  <SecurityProvider>
                    
                    {/* ============================================
                        第 9 层：离线支持 - PWA + Service Worker
                        ============================================ */}
                    <OfflineProvider>
                      
                      {/* ============================================
                          第 10 层：分析统计 - 埋点、监控
                          ============================================ */}
                      <AnalyticsProvider>
                        
                        {/* ============================================
                            第 11 层：UI 反馈层
                            ============================================ */}
                        <ToasterProvider />
                        <ProgressProvider />
                        
                        {/* ============================================
                            第 12 层：实际内容
                            ============================================ */}
                        {children}
                        
                      </AnalyticsProvider>
                    </OfflineProvider>
                  </SecurityProvider>
                </SessionAuditProvider>
              </NextAuthProvider>
            </ZustandStoreProvider>
          </ReactQueryProvider>
        </DatabaseProvider>
      </NextThemesProvider>
    </ErrorBoundaryProvider>
  )
}

// ==========================================
// providers/database-provider.tsx
// ==========================================
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface DatabaseContextType {
  indexedDB: IDBPDatabase<MyDB> | null
  redis: any // 客户端不直接连接，通过 API
  isOnline: boolean
}

interface MyDB extends DBSchema {
  'user-cache': {
    key: string
    value: {
      id: string
      data: any
      timestamp: number
    }
  }
  'offline-queue': {
    key: number
    value: {
      url: string
      method: string
      body: any
      timestamp: number
    }
  }
}

const DatabaseContext = createContext<DatabaseContextType | null>(null)

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [indexedDB, setIndexedDB] = useState<IDBPDatabase<MyDB> | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // 初始化 IndexedDB
    async function initIndexedDB() {
      const db = await openDB<MyDB>('app-database', 1, {
        upgrade(db) {
          // 用户缓存表
          if (!db.objectStoreNames.contains('user-cache')) {
            db.createObjectStore('user-cache')
          }
          // 离线队列表
          if (!db.objectStoreNames.contains('offline-queue')) {
            db.createObjectStore('offline-queue', { autoIncrement: true })
          }
        },
      })
      setIndexedDB(db)
    }

    initIndexedDB()

    // 监听网络状态
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <DatabaseContext.Provider value={{ indexedDB, redis: null, isOnline }}>
      {children}
    </DatabaseContext.Provider>
  )
}

export const useDatabase = () => {
  const context = useContext(DatabaseContext)
  if (!context) throw new Error('useDatabase must be used within DatabaseProvider')
  return context
}

// ==========================================
// providers/session-audit-provider.tsx
// ==========================================
'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function SessionAuditProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sessionStartTime = useRef(Date.now())
  const lastActivityTime = useRef(Date.now())

  useEffect(() => {
    if (status !== 'authenticated') return

    // 记录页面访问
    const logPageView = async () => {
      await fetch('/api/audit/page-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          path: pathname,
          query: searchParams.toString(),
          timestamp: new Date().toISOString(),
          sessionDuration: Date.now() - sessionStartTime.current,
        }),
      })
    }

    logPageView()

    // 记录用户活动（点击、滚动等）
    const logActivity = () => {
      lastActivityTime.current = Date.now()
    }

    window.addEventListener('click', logActivity)
    window.addEventListener('scroll', logActivity)
    window.addEventListener('keydown', logActivity)

    // 每 30 秒发送心跳
    const heartbeatInterval = setInterval(async () => {
      const idleTime = Date.now() - lastActivityTime.current
      
      await fetch('/api/audit/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          userId: session.user.id,
          idleTime,
          sessionDuration: Date.now() - sessionStartTime.current,
        }),
      })
    }, 30000)

    // 记录会话结束
    const logSessionEnd = async () => {
      await fetch('/api/audit/session-end', {
        method: 'POST',
        body: JSON.stringify({
          userId: session.user.id,
          sessionDuration: Date.now() - sessionStartTime.current,
          endReason: 'page_unload',
        }),
      })
    }

    window.addEventListener('beforeunload', logSessionEnd)

    return () => {
      clearInterval(heartbeatInterval)
      window.removeEventListener('click', logActivity)
      window.removeEventListener('scroll', logActivity)
      window.removeEventListener('keydown', logActivity)
      window.removeEventListener('beforeunload', logSessionEnd)
    }
  }, [session, status, pathname, searchParams])

  return <>{children}</>
}

// ==========================================
// providers/security-provider.tsx
// ==========================================
'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import DOMPurify from 'isomorphic-dompurify'

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  useEffect(() => {
    // 1. CSRF Token 管理
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    if (csrfToken) {
      // 为所有请求添加 CSRF Token
      const originalFetch = window.fetch
      window.fetch = function (input, init) {
        const headers = new Headers(init?.headers)
        headers.set('X-CSRF-Token', csrfToken)
        return originalFetch(input, { ...init, headers })
      }
    }

    // 2. XSS 防护 - 全局 DOMPurify
    window.sanitizeHTML = (dirty: string) => DOMPurify.sanitize(dirty)

    // 3. 点击劫持防护
    if (window.self !== window.top) {
      console.warn('检测到可能的点击劫持攻击')
    }

    // 4. 会话固定防护 - 定期刷新 session
    if (session) {
      const refreshInterval = setInterval(async () => {
        await fetch('/api/auth/session', { method: 'POST' })
      }, 15 * 60 * 1000) // 每 15 分钟

      return () => clearInterval(refreshInterval)
    }

    // 5. 控制台警告（防止社会工程学攻击）
    console.log(
      '%c🛑 停止！',
      'color: red; font-size: 50px; font-weight: bold;'
    )
    console.log(
      '%c这是浏览器功能，专供开发者使用。如果有人让你在这里复制粘贴内容，这是诈骗，会导致账户被盗！',
      'font-size: 18px;'
    )
  }, [session])

  return <>{children}</>
}

// ==========================================
// providers/offline-provider.tsx
// ==========================================
'use client'

import { useEffect, useState } from 'react'
import { useDatabase } from './database-provider'

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { indexedDB, isOnline } = useDatabase()
  const [showOfflineBanner, setShowOfflineBanner] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineBanner(true)
    } else {
      setShowOfflineBanner(false)
      // 恢复在线后，同步离线队列
      syncOfflineQueue()
    }
  }, [isOnline])

  const syncOfflineQueue = async () => {
    if (!indexedDB) return

    const tx = indexedDB.transaction('offline-queue', 'readonly')
    const store = tx.objectStore('offline-queue')
    const allRequests = await store.getAll()

    for (const req of allRequests) {
      try {
        await fetch(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
        })
        // 成功后删除
        const deleteTx = indexedDB.transaction('offline-queue', 'readwrite')
        await deleteTx.objectStore('offline-queue').delete(req.timestamp)
      } catch (error) {
        console.error('离线同步失败:', error)
      }
    }
  }

  return (
    <>
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
          ⚠️ 您当前处于离线状态，部分功能受限
        </div>
      )}
      {children}
    </>
  )
}

// ==========================================
// providers/analytics-provider.tsx
// ==========================================
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  useEffect(() => {
    // Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
        page_path: pathname,
        user_id: session?.user?.id,
      })
    }

    // 自定义埋点
    const trackEvent = {
      page: pathname,
      userId: session?.user?.id,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    }

    fetch('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(trackEvent),
    })
  }, [pathname, searchParams, session])

  return <>{children}</>
}

// ==========================================
// providers/error-boundary-provider.tsx
// ==========================================
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundaryProvider extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // 发送错误日志到服务器
    fetch('/api/error-log', {
      method: 'POST',
      body: JSON.stringify({
        error: error.toString(),
        errorInfo,
        timestamp: new Date().toISOString(),
      }),
    })

    console.error('Error Boundary 捕获到错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">出错了 😢</h1>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || '应用遇到了一个错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}