import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { ConsentRequiredError } from "@/server/services/contact-consent.service";
import {
  sendSingleTemplateMessage,
  uploadSingleMessageMedia,
} from "@/server/services/single-message.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";
import { sendSingleTemplateMessageSchema } from "@/server/validators/single-message.validator";

async function readSingleMessageRequest(
  request: Request,
  companyId: string,
) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }

  const formData = await request.formData();
  const mediaFile = formData.get("mediaFile");
  let uploadedMediaId: string | undefined;

  if (mediaFile instanceof File && mediaFile.size > 0) {
    const upload = await uploadSingleMessageMedia(companyId, mediaFile);
    uploadedMediaId = upload.mediaId;
  }

  return {
    messageType: formData.get("messageType")?.toString(),
    countryCode: formData.get("countryCode")?.toString(),
    phoneNumber: formData.get("phoneNumber")?.toString(),
    name: formData.get("name")?.toString() || undefined,
    scheduledAt: formData.get("scheduledAt")?.toString() || undefined,
    templateId: formData.get("templateId")?.toString() || undefined,
    bodyParameters: formData.getAll("bodyParameters").map((value) =>
      value.toString(),
    ),
    media:
      formData.get("messageType")?.toString() === "Media"
        ? {
            type: formData.get("mediaType")?.toString(),
            id: uploadedMediaId,
            url: formData.get("mediaUrl")?.toString() || undefined,
            name: formData.get("mediaName")?.toString() || undefined,
            caption: formData.get("mediaCaption")?.toString() || undefined,
          }
        : undefined,
  };
}

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

    const body: unknown = await readSingleMessageRequest(
      request,
      context.membership.companyId,
    );
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
        templateId: result.template?.id ?? null,
        templateName: result.template?.name ?? null,
        messageType: validation.data.messageType,
        scheduledAt: result.message.scheduledAt,
      },
    });

    return NextResponse.json(
      {
        message: result.message.scheduledAt
          ? "Message scheduled successfully"
          : "Message queued successfully",
        result: {
          messageId: result.message.id,
          contactId: result.contact.id,
          scheduledAt: result.message.scheduledAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SEND_SINGLE_TEMPLATE_MESSAGE_ERROR:", error);

    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error instanceof ConsentRequiredError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    if (
      error instanceof Error &&
      [
        "Approved template not found",
        "WhatsApp account is not connected",
        "Schedule time must be in the future",
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
