import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  BillingProfileError,
  getOrCreateCompanyBillingProfile,
  listBillingProfileUpdateEvents,
  updateCompanyBillingProfile,
} from "@/server/services/company-billing-profile.service";

const BillingProfileSchema = z.object({
  legalName: z.string().max(300).optional().nullable(),
  billingEmail: z.string().email().optional().nullable(),
  billingPhone: z.string().max(50).optional().nullable(),

  addressLine1: z.string().max(300).optional().nullable(),
  addressLine2: z.string().max(300).optional().nullable(),
  city: z.string().max(150).optional().nullable(),
  state: z.string().max(150).optional().nullable(),
  postalCode: z.string().max(50).optional().nullable(),
  country: z.string().max(150).optional().nullable(),

  taxIdLabel: z.string().max(80).optional().nullable(),
  taxId: z.string().max(100).optional().nullable(),

  invoiceNotes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const [profile, events] = await Promise.all([
    getOrCreateCompanyBillingProfile({
      companyId: workspace.membership.companyId,
    }),
    listBillingProfileUpdateEvents({
      companyId: workspace.membership.companyId,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    profile,
    events,
  });
}

export async function PATCH(request: Request) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = BillingProfileSchema.parse(await request.json());

    const profile = await updateCompanyBillingProfile({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      source: "CUSTOMER",
      data: body,
      reason: "customer-profile-update",
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error) {
    if (error instanceof BillingProfileError) {
      return NextResponse.json(
        {
          ok: false,
          code: "BILLING_PROFILE_ERROR",
          message: error.message,
        },
        {
          status: 400,
        },
      );
    }

    throw error;
  }
}
