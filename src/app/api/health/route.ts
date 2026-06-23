import { NextResponse } from "next/server";
import {
  getDatabaseHealth,
  getRedisHealth,
} from "@/server/services/operations-health.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const [database, redis] = await Promise.all([
    getDatabaseHealth(),
    getRedisHealth(),
  ]);

  const ok = database.ok && redis.ok;

  return NextResponse.json(
    {
      ok,
      service: "tallykonnect",
      database: database.ok ? "ok" : "error",
      redis: redis.ok ? "ok" : "error",
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
