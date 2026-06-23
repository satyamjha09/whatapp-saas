import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { importContactsToGroup } from "@/server/services/contact-group.service";
import { importContactsToGroupSchema } from "@/server/validators/contact-group.validator";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.contactImport,
  });

  if (isRateLimitResponse(rateLimit)) {
    return rateLimit;
  }

  try {
    const { groupId } = await params;
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
        { message: "Only owners and admins can add group members" },
        { status: 403 },
      );
    }

    await assertCompanyFeature(
      context.membership.companyId,
      "CONTACT_GROUPS",
    );

    const validation = importContactsToGroupSchema.safeParse(
      (await request.json()) as unknown,
    );
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid group import",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await importContactsToGroup(
      context.membership.companyId,
      groupId,
      validation.data,
    );
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "contact_group.members.imported",
      entityType: "ContactGroup",
      entityId: groupId,
      metadata: result,
    });

    return NextResponse.json({
      message: "Contacts added to group successfully",
      result,
    });
  } catch (error) {
    console.error("IMPORT_CONTACTS_TO_GROUP_ERROR:", error);
    if (error instanceof Error && error.message === "Contact group not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("CONTACT_GROUPS is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { message: "Unable to add contacts to group" },
      { status: 500 },
    );
  }
}
