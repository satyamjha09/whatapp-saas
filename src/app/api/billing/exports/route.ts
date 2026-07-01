import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { BILLING_EXPORT_REPORTS } from "@/server/services/billing-export.service";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedWorkspace({ request });

    return NextResponse.json({
      ok: true,
      reports: BILLING_EXPORT_REPORTS,
    });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }
}
