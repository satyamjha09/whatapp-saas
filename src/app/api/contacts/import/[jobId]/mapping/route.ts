import { NextResponse } from "next/server";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { ContactImportMappingSchema } from "@/server/validators/contact-import.validator";
import {
  saveContactImportMapping,
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
    const body = ContactImportMappingSchema.parse(await request.json());

    const job = await saveContactImportMapping({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      jobId,
      columnMapping: body.columnMapping,
      defaultCountryCode: body.defaultCountryCode,
      duplicateStrategy: body.duplicateStrategy,
      tags: body.tags,
      contactGroupId: body.contactListId,
      createGroupName: body.createListName,
    });

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        duplicateStrategy: job.duplicateStrategy,
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
