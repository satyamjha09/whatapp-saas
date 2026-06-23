import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createStatusPageIncident } from "@/server/services/status-page.service";
import { createAuditLog } from "@/server/services/audit.service";

const CreateIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional().nullable(),
  impact: z
    .enum(["NONE", "MINOR", "MAJOR", "CRITICAL", "MAINTENANCE"])
    .default("MINOR"),
  status: z
    .enum([
      "INVESTIGATING",
      "IDENTIFIED",
      "MONITORING",
      "RESOLVED",
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
    ])
    .default("INVESTIGATING"),
});

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const body = CreateIncidentSchema.parse(await request.json());

  const incident = await createStatusPageIncident({
    ...body,
    createdByUserId: workspace.user.id,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "status_page.incident_created",
    entityType: "StatusPageIncident",
    entityId: incident.id,
    metadata: {
      title: incident.title,
      impact: incident.impact,
      status: incident.status,
    },
  });

  return NextResponse.json({
    ok: true,
    incident,
  });
}
