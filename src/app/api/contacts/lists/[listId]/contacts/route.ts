import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  ContactListError,
  getListContactsPage,
} from "@/server/services/contact-list.service";
import { ContactListContactsQuerySchema } from "@/server/validators/contact-list.validator";

type RouteContext = {
  params: Promise<{
    listId: string;
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

    const { listId } = await context.params;
    const url = new URL(request.url);

    const query = ContactListContactsQuerySchema.parse({
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const result = await getListContactsPage({
      companyId: workspace.membership.companyId,
      listId,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ContactListError) {
      return NextResponse.json(
        { ok: false, code: "CONTACT_LIST_ERROR", message: error.message },
        { status: 404 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Invalid query" },
        { status: 400 },
      );
    }

    return createRoutePermissionErrorResponse(error);
  }
}
