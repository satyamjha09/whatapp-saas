import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { resolveUsageQuotaAlert } from "@/server/services/usage-quota-alert.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

type RouteContext = {
  params: Promise<{
    alertId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { alertId } = await context.params;

  const alert = await resolveUsageQuotaAlert({
    companyId: workspace.membership.companyId,
    alertId,
  });

  return NextResponse.json({
    ok: true,
    alert,
  });
}
