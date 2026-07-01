import { NextResponse } from "next/server";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { ConsentRequiredError } from "@/server/services/contact-consent.service";
import {
  assertSingleMessageSendPreconditions,
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

const PENDING_MEDIA_UPLOAD_ID = "__pending_media_upload__";

type SingleMessageRequest = {
  body: unknown;
  mediaFile?: File;
};

function stringValue(value: FormDataEntryValue | null) {
  return value?.toString() || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMediaFile(formData: FormData) {
  const mediaFile = formData.get("mediaFile");

  return mediaFile instanceof File && mediaFile.size > 0
    ? mediaFile
    : undefined;
}

function createValidationBody(input: SingleMessageRequest) {
  if (!input.mediaFile || !isRecord(input.body)) return input.body;
  if (input.body.messageType !== "Media") return input.body;

  const media = isRecord(input.body.media) ? input.body.media : {};
  if (media.id || media.url) return input.body;

  return {
    ...input.body,
    media: {
      ...media,
      id: PENDING_MEDIA_UPLOAD_ID,
    },
  };
}

async function readSingleMessageRequest(
  request: Request,
): Promise<SingleMessageRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return { body: await request.json() };
  }

  const formData = await request.formData();

  return {
    mediaFile: readMediaFile(formData),
    body: {
      messageType: stringValue(formData.get("messageType")),
      countryCode: stringValue(formData.get("countryCode")),
      phoneNumber: stringValue(formData.get("phoneNumber")),
      name: stringValue(formData.get("name")),
      scheduledAt: stringValue(formData.get("scheduledAt")),
      templateId: stringValue(formData.get("templateId")),
      bodyParameters: formData.getAll("bodyParameters").map((value) =>
        value.toString(),
      ),
      media:
        formData.get("messageType")?.toString() === "Media"
          ? {
              type: stringValue(formData.get("mediaType")),
              id: stringValue(formData.get("mediaId")),
              url: stringValue(formData.get("mediaUrl")),
              name: stringValue(formData.get("mediaName")),
              caption: stringValue(formData.get("mediaCaption")),
            }
          : undefined,
    },
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

    try {
      await assertRoutePermission({
        request,
        workspace: context,
        permission: "CAMPAIGN_SEND",
      });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const requestInput = await readSingleMessageRequest(request);
    const validation = sendSingleTemplateMessageSchema.safeParse(
      createValidationBody(requestInput),
    );

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

    await assertSingleMessageSendPreconditions(context.membership.companyId);

    let messageInput = validation.data;
    if (
      requestInput.mediaFile &&
      messageInput.messageType === "Media" &&
      messageInput.media
    ) {
      const upload = await uploadSingleMessageMedia(
        context.membership.companyId,
        requestInput.mediaFile,
      );

      messageInput = {
        ...messageInput,
        media: {
          ...messageInput.media,
          id: upload.mediaId,
        },
      };
    }

    const result = await sendSingleTemplateMessage(
      context.membership.companyId,
      messageInput,
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
        messageType: messageInput.messageType,
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
