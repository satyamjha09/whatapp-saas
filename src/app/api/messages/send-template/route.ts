import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createQueuedTemplateMessage } from "@/server/services/message.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";
import { sendTemplateMessageSchema } from "@/server/validators/message.validator";

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

    const validation = sendTemplateMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid message details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const message = await createQueuedTemplateMessage(
      context.membership.companyId,
      validation.data,
    );

    const metadata =
      message.metadata &&
      typeof message.metadata === "object" &&
      !Array.isArray(message.metadata)
        ? (message.metadata as Record<string, unknown>)
        : null;
    const flowInteractionId =
      typeof metadata?.flowInteractionId === "string"
        ? metadata.flowInteractionId
        : null;

    return NextResponse.json(
      {
        message: "Template message queued successfully",
        data: {
          ...message,
          ...(flowInteractionId ? { flowInteractionId } : {}),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SEND_TEMPLATE_MESSAGE_ERROR:", error);

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    if (
      error instanceof Error &&
      ["Contact not found", "Template not found"].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message.includes("This template requires")
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message === "Flow not found or not published"
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message === "Insufficient wallet balance"
    ) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    if (error instanceof Error && error.message === "Subscription is past due") {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message === "Complete company onboarding first"
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Monthly message limit exceeded")
    ) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { message: "Unable to queue template message" },
      { status: 500 },
    );
  }
}
