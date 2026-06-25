import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CompanyPlanAssignmentError,
  suspendCompanyPlan,
} from "@/server/services/company-plan-assignment.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";

const schema = z.object({
  reason: z.string().min(2).max(1000),
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformAdmin();
    const { companyId } = await context.params;
    const body = schema.parse(await request.json());
    const assignment = await suspendCompanyPlan({
      companyId,
      actorUserId: platform.user.id,
      reason: body.reason,
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
