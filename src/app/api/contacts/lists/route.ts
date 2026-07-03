import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  ContactListError,
  createContactList,
  listContactLists,
} from "@/server/services/contact-list.service";
import { CreateContactListSchema } from "@/server/validators/contact-list.validator";

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

export async function GET(request: Request) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_VIEW",
    });

    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;

    const lists = await listContactLists({
      companyId: workspace.membership.companyId,
      search,
    });

    return NextResponse.json({ ok: true, lists });
  } catch (error) {
    return listErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_UPDATE",
    });

    const body = CreateContactListSchema.parse(await request.json());

    const list = await createContactList({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      name: body.name,
      description: body.description,
    });

    return NextResponse.json({ ok: true, list }, { status: 201 });
  } catch (error) {
    return listErrorResponse(error);
  }
}
