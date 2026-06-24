import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { listCompanyBillingInvoices } from "@/server/services/billing-invoice.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const invoices = await listCompanyBillingInvoices({
    companyId: workspace.membership.companyId,
  });

  return NextResponse.json({
    ok: true,
    invoices,
  });
}
