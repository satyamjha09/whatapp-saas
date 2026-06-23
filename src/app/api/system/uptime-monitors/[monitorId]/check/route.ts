import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { runUptimeMonitorCheck } from "@/server/services/uptime-monitoring.service";
import { createAuditLog } from "@/server/services/audit.service";

type RouteContext = {
  params: Promise<{
    monitorId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { monitorId } = await context.params;

  const result = await runUptimeMonitorCheck({
    monitorId,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "uptime_monitor.checked",
    entityType: "UptimeMonitor",
    entityId: monitorId,
    metadata: result,
  });

  return NextResponse.json({
    ok: true,
    result,
  });
}
