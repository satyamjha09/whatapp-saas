import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CompanyPlanAssignmentError,
  getCompanyPlanAccessSummary,
  platformAssignCompanyPlan,
} from "@/server/services/company-plan-assignment.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

const assignPlanSchema = z.object({
  planCode: z.string().min(1).max(100),
  status: z.enum(["TRIAL", "ACTIVE"]).default("ACTIVE"),
  days: z.number().int().min(1).max(3650),
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePlatformPermission("PLATFORM_COMPANY_VIEW");
    const { companyId } = await context.params;
    const summary = await getCompanyPlanAccessSummary(companyId);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const platform = await requirePlatformPermission("PLATFORM_PLAN_MANAGE");
    const { companyId } = await context.params;
    const body = assignPlanSchema.parse(await request.json());
    const assignment = await platformAssignCompanyPlan({
      companyId,
      actorUserId: platform.user.id,
      planCode: body.planCode,
      status: body.status,
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
