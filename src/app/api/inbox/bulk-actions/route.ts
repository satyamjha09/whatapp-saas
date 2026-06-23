import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { bulkUpdateInboxConversations } from "@/server/services/inbox.service";
import { bulkInboxActionSchema } from "@/server/validators/inbox-bulk-action.validator";

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

    const body: unknown = await request.json();
    const validation = bulkInboxActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid bulk action",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await bulkUpdateInboxConversations(
      context.membership.companyId,
      validation.data,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.conversations.bulk_updated",
      entityType: "Contact",
      entityId: null,
      metadata: {
        action: result.action,
        status: result.status,
        priority: result.priority,
        assignedToUserId: result.assignedToUserId,
        tagId: result.tagId,
        tagName: result.tagName,
        snoozedUntil: result.snoozedUntil,
        count: result.count,
        messageCount: result.messageCount,
        contactIds: result.contactIds,
      },
    });

    return NextResponse.json({
      message: "Bulk action completed successfully",
      result,
    });
  } catch (error) {
    console.error("BULK_INBOX_ACTION_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "No valid conversations found",
        "Assigned user is not a member of this company",
        "Tag not found",
        "Snooze time must be in the future",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to complete bulk action" },
      { status: 500 },
    );
  }
}
