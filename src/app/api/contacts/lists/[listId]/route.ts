import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  ContactListError,
  deleteContactList,
  getContactList,
  updateContactList,
} from "@/server/services/contact-list.service";
import { UpdateContactListSchema } from "@/server/validators/contact-list.validator";

type RouteContext = {
  params: Promise<{
    listId: string;
  }>;
};

function listErrorResponse(error: unknown) {
  if (error instanceof ContactListError) {
    return NextResponse.json(
      { ok: false, code: "CONTACT_LIST_ERROR", message: error.message },
      { status: error.message === "Contact list not found." ? 404 : 400 },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Invalid list details", errors: error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  return createRoutePermissionErrorResponse(error);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_VIEW",
    });

    const { listId } = await context.params;

    const list = await getContactList({
      companyId: workspace.membership.companyId,
      listId,
    });

    return NextResponse.json({ ok: true, list });
  } catch (error) {
    return listErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_UPDATE",
    });

    const { listId } = await context.params;
    const body = UpdateContactListSchema.parse(await request.json());

    const list = await updateContactList({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      listId,
      name: body.name,
      description: body.description,
    });

    return NextResponse.json({ ok: true, list });
  } catch (error) {
    return listErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_UPDATE",
    });

    const { listId } = await context.params;

    const result = await deleteContactList({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      listId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return listErrorResponse(error);
  }
}
