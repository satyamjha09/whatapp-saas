import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { createAuditLog } from "@/server/services/audit.service";
import { acceptAllRequiredTrustDocuments } from "@/server/services/trust-center.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { getRequestIp } from "@/server/utils/request-ip";

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const result = await acceptAllRequiredTrustDocuments({
      companyId: workspace.membership.companyId,
      userId: workspace.user.id,
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "trust_documents.required_accepted",
      entityType: "Company",
      entityId: workspace.membership.companyId,
      metadata: {
        acceptedCount: result.acceptedCount,
        acceptanceIds: result.acceptances.map((item) => item.id),
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to accept documents",
      },
      { status: 400 },
    );
  }
}
