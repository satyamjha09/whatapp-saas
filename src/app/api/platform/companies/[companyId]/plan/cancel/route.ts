import { NextResponse } from "next/server";
import {
  cancelCompanyPlan,
  CompanyPlanAssignmentError,
} from "@/server/services/company-plan-assignment.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PLAN_MANAGE");
    const { companyId } = await context.params;
    const assignment = await cancelCompanyPlan({
      companyId,
      actorUserId: platform.user.id,
    });

    return NextResponse.json({
      ok: true,
      assignment,
    });
  } catch (error) {
    if (error instanceof CompanyPlanAssignmentError) {
      return NextResponse.json(
        {
          ok: false,
          code: "COMPANY_PLAN_ASSIGNMENT_ERROR",
          message: error.message,
        },
        {
          status: 400,
        },
      );
    }

    return createTenantErrorResponse(error);
  }
}
