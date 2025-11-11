import React from "react";
import { redirect } from "next/navigation";
import { getAuthFlags } from "@src/services/auth/guard";

// 仪表盘分组布局：要求登录（普通用户与管理员均可访问）
// 匿名访问将重定向到首页（/）
export default async function DashboardLayout({ children }: React.PropsWithChildren) {
  const { isLoggedIn } = await getAuthFlags();
  if (!isLoggedIn) {
    redirect("/");
  }
  return <>{children}</>;
}