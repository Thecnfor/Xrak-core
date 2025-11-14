import { cookies } from "next/headers";
import { getMysql } from "@infra/db/mysql";
import { getSession } from "@features/auth/server/session/kv";
import { SESSION_COOKIE_NAME } from "@features/auth/shared/session";

export async function getInitialPrefs() {
  try {
    const db = await getMysql();
    const appRows = await db.execute("SELECT `key`,`value` FROM prefs_app", []);
    const appArr = appRows[0] as Array<{ key: string; value: string }>;
    const appPrefs: Record<string, unknown> = {};
    for (const r of appArr) { try { appPrefs[r.key] = JSON.parse(r.value as unknown as string); } catch { appPrefs[r.key] = r.value; } }
    const ck = (await cookies()).get(SESSION_COOKIE_NAME)?.value || "";
    const session = ck ? await getSession(ck) : null;
    const uid = session?.userId ?? 0;
    const userPrefs: Record<string, unknown> = {};
    if (uid > 0) {
      const userRows = await db.execute("SELECT `key`,`value` FROM prefs_user WHERE user_id=", [uid]);
      const userArr = userRows[0] as Array<{ key: string; value: string }>;
      for (const r of userArr) { try { userPrefs[r.key] = JSON.parse(r.value as unknown as string); } catch { userPrefs[r.key] = r.value; } }
    }
    return { ...appPrefs, ...userPrefs } as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}