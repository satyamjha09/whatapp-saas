import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { releaseLegalHold } from "@/server/services/data-retention.service";
import { createAuditLog } from "@/server/services/audit.service";

type RouteContext = {
  params: Promise<{
    legalHoldId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { legalHoldId } = await context.params;
  const hold = await releaseLegalHold({
    legalHoldId,
    releasedByUserId: workspace.user.id,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "legal_hold.released",
    entityType: "LegalHold",
    entityId: legalHoldId,
  });

  return NextResponse.json({
    ok: true,
    hold,
  });
}
