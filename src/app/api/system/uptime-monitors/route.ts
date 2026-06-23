import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  createUptimeMonitor,
  listUptimeMonitors,
} from "@/server/services/uptime-monitoring.service";
import { createAuditLog } from "@/server/services/audit.service";

const CreateMonitorSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  method: z.string().default("GET"),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
  intervalMinutes: z.number().int().min(1).max(1440).default(5),
  failureThreshold: z.number().int().min(1).max(20).default(3),
  recoveryThreshold: z.number().int().min(1).max(20).default(2),
});

export async function GET(request: Request) {
  try {
    await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const monitors = await listUptimeMonitors();

  return NextResponse.json({
    ok: true,
    monitors,
  });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const body = CreateMonitorSchema.parse(await request.json());

  const monitor = await createUptimeMonitor(body);

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "uptime_monitor.created",
    entityType: "UptimeMonitor",
    entityId: monitor.id,
    metadata: {
      name: monitor.name,
      url: monitor.url,
    },
  });

  return NextResponse.json({
    ok: true,
    monitor,
  });
}
