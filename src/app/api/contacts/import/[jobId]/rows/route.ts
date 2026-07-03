import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { ContactImportRowsQuerySchema } from "@/server/validators/contact-import.validator";
import {
  listContactImportRows,
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
    const url = new URL(request.url);

    const query = ContactImportRowsQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const result = await listContactImportRows({
      companyId: workspace.membership.companyId,
      jobId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });

    return NextResponse.json({
      ok: true,
      ...result,
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
