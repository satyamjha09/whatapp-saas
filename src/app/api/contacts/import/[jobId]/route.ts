import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  getContactImportWizardJob,
  ContactImportError,
} from "@/server/services/contact-import.service";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_VIEW",
    });

    const { jobId } = await context.params;

    const job = await getContactImportWizardJob({
      companyId: workspace.membership.companyId,
      jobId,
    });

    return NextResponse.json({
      ok: true,
      job,
    });
  } catch (error) {
    if (error instanceof ContactImportError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CONTACT_IMPORT_ERROR",
          message: error.message,
        },
        {
          status: 404,
        },
      );
    }

    return createRoutePermissionErrorResponse(error);
  }
}
