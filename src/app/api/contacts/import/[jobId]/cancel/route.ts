import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  cancelContactImport,
  ContactImportError,
} from "@/server/services/contact-import.service";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_UPDATE",
    });

    const { jobId } = await context.params;

    const job = await cancelContactImport({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      jobId,
    });

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
      },
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
          status: 400,
        },
      );
    }

    return createRoutePermissionErrorResponse(error);
  }
}
