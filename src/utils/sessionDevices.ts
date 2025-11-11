// 设备列表工具：基于 KV 的用户会话索引，输出当前用户的所有会话（设备）摘要
// 说明：此工具仅用于开发/管理页展示设备列表；生产环境建议结合更强的设备指纹与风控。

import { listUserSessions } from "@src/services/session/kv";

export type DeviceSession = {
  sid: string;
  userId: number;
  issuedAt?: number;
  expiresAt?: number;
  uaHash?: string;
};

/**
 * 获取用户的设备（会话）列表
 * @param userId 目标用户 ID
 * @returns 设备会话摘要数组
 */
export async function getDeviceList(userId: number): Promise<DeviceSession[]> {
  const items = await listUserSessions(userId);
  // 过滤空上下文并映射为设备摘要
  const out: DeviceSession[] = items
    .filter(({ ctx }) => !!ctx)
    .map(({ sid, ctx }) => ({
      sid,
      userId: ctx!.userId,
      issuedAt: ctx!.issuedAt,
      expiresAt: ctx!.expiresAt,
      uaHash: ctx!.uaHash,
    }));
  // 时间降序，最近的在前
  out.sort((a, b) => (b.issuedAt ?? 0) - (a.issuedAt ?? 0));
  return out;
}
