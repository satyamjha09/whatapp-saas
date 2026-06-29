import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  createUnmappedWebhookEvent,
  createWebhookEvent,
  findCompanyByPhoneNumberId,
} from "@/server/services/webhook.service";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";
import {
  createRequestBodyErrorResponse,
  InvalidRequestBodyError,
  readRequestTextWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";
import {
  detectWebhookReplay,
  recordWebhookSignatureFailure,
  verifyMetaWebhookSignature,
  WebhookReplayError,
  WebhookSignatureError,
} from "@/server/services/webhook-signature.service";
import {
  completeProviderWebhookEvent,
  failProviderWebhookEvent,
  getMetaWebhookEventId,
  getMetaWebhookEventType,
  startProviderWebhookEvent,
} from "@/server/services/provider-webhook-event.service";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] : undefined;
}

function getWebhookValue(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  return asRecord(change?.value);
}

function getWebhookEventType(payload: unknown) {
  const value = getWebhookValue(payload);

  if (Array.isArray(value?.messages) && value.messages.length > 0) {
    return "message";
  }

  if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
    return "status";
  }

  return "unknown";
}

function getPhoneNumberIdFromPayload(payload: unknown) {
  const value = getWebhookValue(payload);
  const metadata = asRecord(value?.metadata);
  const phoneNumberId = metadata?.phone_number_id;

  return typeof phoneNumberId === "string" ? phoneNumberId : undefined;
}

function createPayloadDedupeKey(payload: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
    });
  }

  return NextResponse.json(
    { message: "Webhook verification failed" },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.whatsappWebhook,
  });

  if (isRateLimitResponse(rateLimit)) {
    return rateLimit;
  }

  try {
    let rawBody = "";
    let payload: unknown;

    try {
      rawBody = await readRequestTextWithLimit({
        request,
        maxBytes: REQUEST_BODY_LIMITS.webhook(),
      });

      verifyMetaWebhookSignature({
        rawBody,
        signatureHeader: request.headers.get("x-hub-signature-256"),
        appSecret: process.env.META_APP_SECRET,
      });

      payload = JSON.parse(rawBody);

      const replayKey =
        request.headers.get("x-hub-signature-256") ?? crypto.randomUUID();

      await detectWebhookReplay({
        provider: "META",
        replayKey,
        request,
      });
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        await recordWebhookSignatureFailure({
          request,
          provider: "META",
          reason: error.message,
        });

        return Response.json(
          {
            message: "Invalid webhook signature",
          },
          {
            status: 401,
          },
        );
      }

      if (error instanceof WebhookReplayError) {
        return Response.json(
          {
            message: "Webhook replay blocked",
          },
          {
            status: 409,
          },
        );
      }

      if (error instanceof SyntaxError) {
        return createRequestBodyErrorResponse({
          request,
          error: new InvalidRequestBodyError("Webhook body must be valid JSON"),
          source: "whatsapp-webhook",
        });
      }

      return createRequestBodyErrorResponse({
        request,
        error,
        source: "whatsapp-webhook",
      });
    }

    const providerWebhookEvent = await startProviderWebhookEvent({
      provider: "META",
      providerEventId: getMetaWebhookEventId(payload),
      eventType: getMetaWebhookEventType(payload),
      rawBody,
      metadata: {
        source: "whatsapp-webhook",
        signaturePresent: Boolean(request.headers.get("x-hub-signature-256")),
      },
    });

    if (!providerWebhookEvent.shouldProcess) {
      return Response.json({
        ok: true,
        duplicate: true,
      });
    }

    try {
      const dedupeKey = createPayloadDedupeKey(payload);
      const eventType = getWebhookEventType(payload);
      const phoneNumberId = getPhoneNumberIdFromPayload(payload);

      const companyId = phoneNumberId
        ? await findCompanyByPhoneNumberId(phoneNumberId)
        : null;

      if (!companyId) {
        const unmappedResult = await createUnmappedWebhookEvent({
          payload,
          eventType,
          phoneNumberId,
          dedupeKey,
          reason: phoneNumberId
            ? "NO_COMPANY_FOR_PHONE_NUMBER_ID"
            : "MISSING_PHONE_NUMBER_ID",
        });

        console.error("UNMAPPED_WHATSAPP_WEBHOOK:", {
          phoneNumberId,
          eventType,
          unmappedWebhookEventId:
            unmappedResult.unmappedWebhookEvent.id,
          duplicate: unmappedResult.isDuplicate,
        });

        await completeProviderWebhookEvent({
          eventId: providerWebhookEvent.event.id,
        });

        return NextResponse.json(
          {
            received: true,
            unmapped: true,
            duplicate: unmappedResult.isDuplicate,
          },
          { status: 200 },
        );
      }

      const result = await createWebhookEvent({
        payload,
        eventType,
        companyId,
        dedupeKey,
      });

      await completeProviderWebhookEvent({
        eventId: providerWebhookEvent.event.id,
      });

      return NextResponse.json(
        {
          received: true,
          duplicate: result.isDuplicate,
        },
        { status: 200 },
      );
    } catch (error) {
      await failProviderWebhookEvent({
        eventId: providerWebhookEvent.event.id,
        errorMessage:
          error instanceof Error ? error.message : "Unknown WhatsApp webhook error",
      });

      throw error;
    }
  } catch (error) {
    console.error("WHATSAPP_WEBHOOK_ERROR:", error);

    return NextResponse.json(
      { message: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
