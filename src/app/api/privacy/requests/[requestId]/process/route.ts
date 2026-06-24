import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  getPrivacyRequest,
  processPrivacyRequest,
} from "@/server/services/privacy-center.service";
import { createAuditLog } from "@/server/services/audit.service";

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { requestId } = await context.params;
  const existing = await getPrivacyRequest({
    companyId: workspace.membership.companyId,
    requestId,
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "Privacy request not found" },
      { status: 404 },
    );
  }

  const result = await processPrivacyRequest({ requestId });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "privacy.request_processed",
    entityType: "PrivacyRequest",
    entityId: requestId,
    metadata: { type: existing.type, status: result.status },
  });

  return NextResponse.json({ ok: true, result });
}
