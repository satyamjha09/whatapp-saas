import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { updateContactCrmProfile } from "@/server/services/contact-crm.service";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";

const updateContactCrmSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().max(300).optional().nullable(),
  companyName: z.string().max(300).optional().nullable(),
  externalCustomerId: z.string().max(300).optional().nullable(),
  lifecycleStage: z.string().max(100).optional().nullable(),
});

type ContactCrmRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: ContactCrmRouteContext,
) {
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

    const body: unknown = await request.json();
    const validation = updateContactCrmSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid CRM profile",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const contact = await updateContactCrmProfile({
      companyId: context.membership.companyId,
      contactId,
      actorUserId: context.user.id,
      data: validation.data,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "contact.crm_profile_updated",
      entityType: "Contact",
      entityId: contactId,
    });

    return NextResponse.json({
      message: "CRM profile updated successfully",
      contact,
    });
  } catch (error) {
    console.error("UPDATE_CONTACT_CRM_ERROR:", error);

    if (error instanceof Error && error.message === "Contact not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to update CRM profile" },
      { status: 500 },
    );
  }
}
