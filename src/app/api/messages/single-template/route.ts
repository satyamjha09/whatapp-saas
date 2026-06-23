import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { sendSingleTemplateMessage } from "@/server/services/single-message.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { sendSingleTemplateMessageSchema } from "@/server/validators/single-message.validator";

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
    const validation = sendSingleTemplateMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid message details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await assertSystemWritesAllowed({
      operation: "Sending messages",
    });

    const result = await sendSingleTemplateMessage(
      context.membership.companyId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "message.single_template.queued",
      entityType: "Message",
      entityId: result.message.id,
      metadata: {
        contactId: result.contact.id,
        templateId: result.template.id,
        templateName: result.template.name,
      },
    });

    return NextResponse.json(
      {
        message: "Message queued successfully",
        result: {
          messageId: result.message.id,
          contactId: result.contact.id,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SEND_SINGLE_TEMPLATE_MESSAGE_ERROR:", error);

    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (
      error instanceof Error &&
      [
        "Approved template not found",
        "WhatsApp account is not connected",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Subscription is past due") {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message.startsWith("This template requires")
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
      error.message === "Unable to enqueue message"
    ) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { message: "Unable to send message" },
      { status: 500 },
    );
  }
}
