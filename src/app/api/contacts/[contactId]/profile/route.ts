import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { getContactProfileDrawer } from "@/server/services/contact.service";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    const { contactId } = await params;

    try {
      await assertTenantEntityAccess({
        request,
        companyId: context.membership.companyId,
        entityType: "Contact",
        entityId: contactId,
      });
    } catch (error) {
      return createTenantErrorResponse(error);
    }

    const contact = await getContactProfileDrawer({
      companyId: context.membership.companyId,
      contactId,
    });

    if (!contact) {
      return NextResponse.json({ message: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("GET_CONTACT_PROFILE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch contact profile" },
      { status: 500 },
    );
  }
}
