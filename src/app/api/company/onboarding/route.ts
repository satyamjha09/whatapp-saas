import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CompanyOnboardingStateError,
  completeCompanyOnboardingIfReady,
  getCompanyOnboardingState,
  updateCompanyOnboardingProfile,
} from "@/server/services/company-onboarding-state.service";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";

const onboardingProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  businessCategory: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  pinCode: z.string().trim().min(4).max(12),
  employeeCode: z.string().trim().max(80).optional().nullable(),
});

export async function GET() {
  try {
    const context = await requireCompanyAdmin();
    const state = await getCompanyOnboardingState(context.companyId);

    return NextResponse.json({
      ok: true,
      state,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireCompanyAdmin();
    const parsed = onboardingProfileSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid company onboarding profile.",
          errors: parsed.error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    await updateCompanyOnboardingProfile({
      actorUserId: context.user.id,
      companyId: context.companyId,
      ...parsed.data,
    });

    const state = await getCompanyOnboardingState(context.companyId);

    return NextResponse.json({
      ok: true,
      state,
    });
  } catch (error) {
    if (error instanceof CompanyOnboardingStateError) {
      return NextResponse.json(
        {
          ok: false,
          code: "COMPANY_ONBOARDING_ERROR",
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

export async function POST() {
  try {
    const context = await requireCompanyAdmin();

    await completeCompanyOnboardingIfReady({
      actorUserId: context.user.id,
      companyId: context.companyId,
    });

    const state = await getCompanyOnboardingState(context.companyId);

    return NextResponse.json({
      ok: true,
      state,
    });
  } catch (error) {
    if (error instanceof CompanyOnboardingStateError) {
      return NextResponse.json(
        {
          ok: false,
          code: "COMPANY_ONBOARDING_ERROR",
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
