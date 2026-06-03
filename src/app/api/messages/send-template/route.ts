import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createQueuedTemplateMessage } from "@/server/services/message.service";
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

    return NextResponse.json(
      {
        message: "Template message queued successfully",
        data: message,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SEND_TEMPLATE_MESSAGE_ERROR:", error);

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
      error.message === "Insufficient wallet balance"
    ) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { message: "Unable to queue template message" },
      { status: 500 },
    );
  }
}
