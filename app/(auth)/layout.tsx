import React from "react";
import { redirect } from "next/navigation";
import { getAuthFlags } from "@src/services/auth/guard";

// 认证分组布局：
// - 匿名用户可访问（用于登录/注册等）
// - 已登录的普通用户不可访问，重定向到首页
// - 管理员可访问所有页面
export default async function AuthLayout({ children }: React.PropsWithChildren) {
  const { isLoggedIn, isAdmin } = await getAuthFlags();
  if (isLoggedIn && !isAdmin) {
    // 普通用户已登录，不允许访问认证页面
    redirect("/");
  }
  return <>{children}</>;
}