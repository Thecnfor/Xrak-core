import { NextRequest } from "next/server";
import { withApi } from "@server/middleware/api";
import { notImplemented } from "@server/api/respond";
export async function POST(req: NextRequest) {
  return withApi(req, [], async () => notImplemented("not_enabled"));
}
