import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CompanyPlanAssignmentError,
  extendCompanyTrial,
} from "@/server/services/company-plan-assignment.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";

const schema = z.object({
  days: z.number().int().min(1).max(365),
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
    const assignment = await extendCompanyTrial({
      companyId,
      actorUserId: platform.user.id,
      days: body.days,
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
