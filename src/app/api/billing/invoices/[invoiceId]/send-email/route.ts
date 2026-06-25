import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  BillingDocumentEmailError,
  sendBillingInvoiceEmail,
} from "@/server/services/billing-document-email.service";

type RouteContext = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { invoiceId } = await context.params;

  try {
    const delivery = await sendBillingInvoiceEmail({
      companyId: workspace.membership.companyId,
      invoiceId,
      actorUserId: workspace.user.id,
      force: true,
    });

    return NextResponse.json({
      ok: true,
      delivery,
    });
  } catch (error) {
    if (error instanceof BillingDocumentEmailError) {
      return NextResponse.json(
        {
          ok: false,
          code: "BILLING_DOCUMENT_EMAIL_ERROR",
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
