// 统一 Provider 入口导出，便于在页面与模块中按需引用
// 说明：仅集中 re-export，不在此处编写逻辑，以保持模块化与职责清晰。

export { default as AppProviders } from "./AppProviders";
export { default as SessionRoot } from "./SessionRoot";

export { QueryProvider } from "./QueryProvider";
export { ThemeProvider, useTheme } from "./ThemeProvider";
export { PersistGate } from "./PersistGate";
export { ToasterProvider, useToaster } from "./ToasterProvider";
export { SessionProvider, useSession } from "./SessionProvider";

export { SEOProvider, useSEO } from "./SEOProvider";
export { AnalyticsProvider } from "@src/observability/analytics/Provider";