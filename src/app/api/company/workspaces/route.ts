import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/server/tenant/tenant-context";
import { createTenantErrorResponse } from "@/server/tenant/tenant-api-error";
import {
  CompanyOnboardingError,
  createCompanyWorkspace,
  listUserCompanies,
} from "@/server/services/company-onboarding.service";

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  type: z
    .enum(["DIRECT_COMPANY", "PARTNER", "PARTNER_CLIENT"])
    .default("DIRECT_COMPANY"),
  parentCompanyId: z.string().optional().nullable(),
  legalName: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    const memberships = await listUserCompanies(user.id);

    return NextResponse.json({
      ok: true,
      memberships,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    const body = createCompanySchema.parse(await request.json());

    const company = await createCompanyWorkspace({
      ownerUserId: user.id,
      name: body.name,
      type: body.type,
      parentCompanyId: body.parentCompanyId,
      legalName: body.legalName,
      website: body.website,
      industry: body.industry,
    });

    return NextResponse.json({
      ok: true,
      company,
    });
  } catch (error) {
    if (error instanceof CompanyOnboardingError) {
      return NextResponse.json(
        {
          ok: false,
          code: "COMPANY_ONBOARDING_ERROR",
          message: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    return createTenantErrorResponse(error);
  }
}
