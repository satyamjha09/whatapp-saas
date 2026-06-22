import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { createContactGroup } from "@/server/services/contact-group.service";
import { createContactGroupSchema } from "@/server/validators/contact-group.validator";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";

export async function POST(request: Request) {
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
    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "Only owners and admins can create contact groups" },
        { status: 403 },
      );
    }

    await assertCompanyFeature(
      context.membership.companyId,
      "CONTACT_GROUPS",
    );

    const validation = createContactGroupSchema.safeParse(
      (await request.json()) as unknown,
    );
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid contact group",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const group = await createContactGroup(
      context.membership.companyId,
      validation.data,
    );
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "contact_group.created",
      entityType: "ContactGroup",
      entityId: group.id,
      metadata: { name: group.name },
    });

    return NextResponse.json(
      { message: "Contact group created successfully", group },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_CONTACT_GROUP_ERROR:", error);
    if (
      error instanceof Error &&
      error.message === "A contact group with this name already exists"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("CONTACT_GROUPS is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { message: "Unable to create contact group" },
      { status: 500 },
    );
  }
}
