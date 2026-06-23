import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  getIncidentById,
  resolveIncident,
} from "@/server/services/incident.service";
import { createAuditLog } from "@/server/services/audit.service";

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

  const incident = await getIncidentById({
    incidentId,
    companyId: workspace.membership.companyId,
  });

  if (!incident) {
    return NextResponse.json({ message: "Incident not found" }, { status: 404 });
  }

  await resolveIncident({
    incidentId,
    actorUserId: workspace.user.id,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "incident.resolved",
    entityType: "Incident",
    entityId: incidentId,
  });

  return NextResponse.json({ ok: true });
}
