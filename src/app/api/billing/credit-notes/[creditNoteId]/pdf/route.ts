import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  BillingDocumentPdfError,
  generateCreditNotePdf,
} from "@/server/services/billing-document-pdf.service";

type RouteContext = {
  params: Promise<{
    creditNoteId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAuthenticatedWorkspace({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { creditNoteId } = await context.params;

  try {
    const pdf = await generateCreditNotePdf({
      companyId: workspace.membership.companyId,
      creditNoteId,
    });

    return new Response(new Uint8Array(pdf.buffer), {
      headers: {
        "Content-Type": pdf.contentType,
        "Content-Disposition": `inline; filename="${pdf.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof BillingDocumentPdfError) {
      return Response.json(
        {
          ok: false,
          code: "BILLING_PDF_ERROR",
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
