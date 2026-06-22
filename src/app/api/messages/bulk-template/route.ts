import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { sendBulkTemplateMessages } from "@/server/services/bulk-message.service";
import { sendBulkTemplateMessageSchema } from "@/server/validators/bulk-message.validator";

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
        { message: "Only owners and admins can send bulk messages" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = sendBulkTemplateMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid bulk message details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await sendBulkTemplateMessages(
      context.membership.companyId,
      validation.data,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "message.bulk_template.queued",
      entityType: "Message",
      metadata: {
        batchId: result.batch.id,
        templateId: result.template.id,
        templateName: result.template.name,
        requestedCount: result.requestedCount,
        queuedCount: result.queuedCount,
        failedCount: result.failedCount,
        skippedDuplicateCount: result.skippedDuplicateCount,
        skippedBlockedCount: result.skippedBlockedCount,
        contactGroupId: result.contactGroup?.id ?? null,
        contactGroupName: result.contactGroup?.name ?? null,
        scheduledAt: result.batch.scheduledAt,
        status: result.batch.status,
      },
    });

    return NextResponse.json(
      {
        message:
          result.batch.status === "SCHEDULED"
            ? "Bulk messages scheduled successfully"
            : "Bulk messages queued successfully",
        result: {
          batchId: result.batch.id,
          requestedCount: result.requestedCount,
          queuedCount: result.queuedCount,
          failedCount: result.failedCount,
          skippedDuplicateCount: result.skippedDuplicateCount,
          skippedBlockedCount: result.skippedBlockedCount,
          scheduledAt: result.batch.scheduledAt,
          status: result.batch.status,
          contactGroupId: result.contactGroup?.id ?? null,
          contactGroupName: result.contactGroup?.name ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SEND_BULK_TEMPLATE_MESSAGE_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Approved template not found",
        "WhatsApp account is not connected",
        "Contact group not found",
        "Contact group has no contacts",
        "Contact group has no sendable contacts",
        "Company not found",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Subscription is past due") {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message.includes("plan allows maximum")
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message.includes("BULK_CAMPAIGNS is not available")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      (error.message.startsWith("This template requires") ||
        error.message.startsWith("Recipient +"))
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message === "Insufficient wallet balance"
    ) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Monthly message limit exceeded")
    ) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    if (
      error instanceof Error &&
      error.message === "Unable to enqueue bulk messages"
    ) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { message: "Unable to queue bulk messages" },
      { status: 500 },
    );
  }
}
