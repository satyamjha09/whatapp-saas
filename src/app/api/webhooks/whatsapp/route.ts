import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  createWebhookEvent,
  findCompanyByPhoneNumberId,
} from "@/server/services/webhook.service";

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
  try {
    const payload: unknown = await request.json();

    const dedupeKey = createPayloadDedupeKey(payload);
    const eventType = getWebhookEventType(payload);
    const phoneNumberId = getPhoneNumberIdFromPayload(payload);

    const companyId = phoneNumberId
      ? await findCompanyByPhoneNumberId(phoneNumberId)
      : null;

    const result = await createWebhookEvent({
      payload,
      eventType,
      companyId,
      dedupeKey,
    });

    return NextResponse.json(
      {
        received: true,
        duplicate: result.isDuplicate,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("WHATSAPP_WEBHOOK_ERROR:", error);

    return NextResponse.json(
      { message: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
