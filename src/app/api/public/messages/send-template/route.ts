import { NextResponse } from "next/server";
import { authenticatePublicApiRequest } from "@/server/auth/public-api";
import { createAuditLog } from "@/server/services/audit.service";
import { createQueuedPublicTemplateMessage } from "@/server/services/message.service";
import { publicSendTemplateMessageSchema } from "@/server/validators/public-message.validator";

export async function POST(request: Request) {
  try {
    const auth = await authenticatePublicApiRequest(request);

    if (!auth.success) {
      return auth.response;
    }

    const { apiKeyRecord } = auth;

    const body: unknown = await request.json();

    const validation = publicSendTemplateMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid message details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const message = await createQueuedPublicTemplateMessage(
      apiKeyRecord.companyId,
      validation.data,
    );

    await createAuditLog({
      companyId: apiKeyRecord.companyId,
      actorUserId: apiKeyRecord.createdByUserId,
      action: "public_api.message.queued",
      entityType: "Message",
      entityId: message.id,
      metadata: {
        apiKeyId: apiKeyRecord.id,
        apiKeyName: apiKeyRecord.name,
        to: validation.data.to,
        templateName: validation.data.templateName,
        language: validation.data.language,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Template message queued successfully",
        messageId: message.id,
        status: message.status,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("PUBLIC_SEND_TEMPLATE_MESSAGE_ERROR:", error);

    if (error instanceof Error && error.message === "Template not found") {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "Subscription is past due") {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 },
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("This template requires")
    ) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Insufficient wallet balance"
    ) {
      return NextResponse.json(
        { success: false, message: "Insufficient wallet balance" },
        { status: 402 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Monthly message limit exceeded")
    ) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 402 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to queue template message" },
      { status: 500 },
    );
  }
}
