import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  ContactBulkActionError,
  runBulkContactAction,
} from "@/server/services/contact-bulk-action.service";
import { BulkContactActionSchema } from "@/server/validators/contact-list.validator";

export async function POST(request: Request) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_UPDATE",
    });

    const body = BulkContactActionSchema.parse(await request.json());

    const result = await runBulkContactAction({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      input: body,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ContactBulkActionError) {
      return NextResponse.json(
        { ok: false, code: "CONTACT_BULK_ACTION_ERROR", message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Invalid bulk action", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    return createRoutePermissionErrorResponse(error);
  }
}
