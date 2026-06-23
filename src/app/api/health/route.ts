import { NextResponse } from "next/server";
import {
  getDatabaseHealth,
  getRedisHealth,
} from "@/server/services/operations-health.service";
import { getSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const [database, redis, maintenanceMode] = await Promise.all([
    getDatabaseHealth(),
    getRedisHealth(),
    getSystemMaintenanceMode(),
  ]);

  const ok = database.ok && redis.ok;

  return NextResponse.json(
    {
      ok,
      service: "tallykonnect",
      database: database.ok ? "ok" : "error",
      redis: redis.ok ? "ok" : "error",
      maintenanceMode: maintenanceMode.enabled,
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
