import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { updateStatusPageIncident } from "@/server/services/status-page.service";
import { createAuditLog } from "@/server/services/audit.service";

const UpdateIncidentSchema = z.object({
  status: z.enum([
    "INVESTIGATING",
    "IDENTIFIED",
    "MONITORING",
    "RESOLVED",
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
  ]),
  message: z.string().min(1).max(5000),
});

type RouteContext = {
  params: Promise<{
    incidentId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { incidentId } = await context.params;
  const body = UpdateIncidentSchema.parse(await request.json());

  const incident = await updateStatusPageIncident({
    incidentId,
    status: body.status,
    message: body.message,
    actorUserId: workspace.user.id,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "status_page.incident_updated",
    entityType: "StatusPageIncident",
    entityId: incidentId,
    metadata: {
      status: body.status,
    },
  });

  return NextResponse.json({
    ok: true,
    incident,
  });
}
