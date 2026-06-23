import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publicApiError } from "@/server/public-api/public-api-response";
import { logger } from "@/server/utils/safe-logger";

type IdempotencyErrorCode =
  | "idempotency_key_required"
  | "idempotency_conflict"
  | "processing"
  | "internal_error";

export class PublicApiIdempotencyError extends Error {
  status: number;
  code: IdempotencyErrorCode;

  constructor({ message, status, code }: { message: string; status: number; code: IdempotencyErrorCode }) {
    super(message);
    this.name = "PublicApiIdempotencyError";
    this.status = status;
    this.code = code;
  }
}

function isEnabled() {
  return process.env.PUBLIC_API_IDEMPOTENCY_ENABLED !== "false";
}

function requireForMutations() {
  return process.env.PUBLIC_API_REQUIRE_IDEMPOTENCY_FOR_MUTATIONS !== "false";
}

function ttlHours() {
  const parsed = Number(process.env.PUBLIC_API_IDEMPOTENCY_TTL_HOURS ?? 24);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

function isMutation(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function hashPublicApiRequestBody(body: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

export async function startPublicApiIdempotency({
  request,
  companyId,
  apiKeyId,
  body,
}: {
  request: Request;
  companyId: string;
  apiKeyId?: string | null;
  body: unknown;
}) {
  if (!isEnabled() || !isMutation(request.method)) {
    return { enabled: false as const, recordId: null, replayResponse: null };
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey && requireForMutations()) {
    throw new PublicApiIdempotencyError({
      status: 400,
      code: "idempotency_key_required",
      message: "Idempotency-Key header is required for mutating API requests",
    });
  }
  if (!idempotencyKey) {
    return { enabled: false as const, recordId: null, replayResponse: null };
  }
  if (idempotencyKey.length > 200) {
    throw new PublicApiIdempotencyError({
      status: 400,
      code: "idempotency_conflict",
      message: "Idempotency-Key must be 200 characters or fewer",
    });
  }

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const requestHash = hashPublicApiRequestBody(body);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours() * 60 * 60 * 1000);
  const lockedUntil = new Date(now.getTime() + 5 * 60 * 1000);

  try {
    const record = await prisma.publicApiIdempotencyRecord.create({
      data: {
        companyId,
        apiKeyId: apiKeyId ?? null,
        idempotencyKey,
        method,
        path: url.pathname,
        requestHash,
        status: "PROCESSING",
        lockedUntil,
        expiresAt,
      },
    });
    return { enabled: true as const, recordId: record.id, replayResponse: null };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    let existing = await prisma.publicApiIdempotencyRecord.findUnique({
      where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
    });
    if (!existing) throw error;

    if (existing.expiresAt <= now) {
      const claimed = await prisma.publicApiIdempotencyRecord.updateMany({
        where: { id: existing.id, expiresAt: { lte: now } },
        data: {
          apiKeyId: apiKeyId ?? null,
          method,
          path: url.pathname,
          requestHash,
          status: "PROCESSING",
          responseStatus: null,
          responseBody: Prisma.DbNull,
          lockedUntil,
          completedAt: null,
          failedAt: null,
          expiresAt,
        },
      });
      if (claimed.count === 1) {
        return { enabled: true as const, recordId: existing.id, replayResponse: null };
      }
      existing = await prisma.publicApiIdempotencyRecord.findUniqueOrThrow({
        where: { id: existing.id },
      });
    }

    if (existing.method !== method || existing.path !== url.pathname || existing.requestHash !== requestHash) {
      throw new PublicApiIdempotencyError({
        status: 409,
        code: "idempotency_conflict",
        message: "Idempotency-Key was already used with a different request",
      });
    }

    if (existing.status === "COMPLETED" && existing.responseStatus) {
      return {
        enabled: true as const,
        recordId: existing.id,
        replayResponse: NextResponse.json(existing.responseBody, {
          status: existing.responseStatus,
          headers: { "idempotency-replayed": "true" },
        }),
      };
    }

    const claimed = await prisma.publicApiIdempotencyRecord.updateMany({
      where: {
        id: existing.id,
        OR: [
          { status: "FAILED" },
          { status: "PROCESSING", lockedUntil: { lte: now } },
          { status: "PROCESSING", lockedUntil: null },
        ],
      },
      data: { status: "PROCESSING", lockedUntil, failedAt: null, expiresAt },
    });
    if (claimed.count === 1) {
      return { enabled: true as const, recordId: existing.id, replayResponse: null };
    }

    throw new PublicApiIdempotencyError({
      status: 409,
      code: "processing",
      message: "Request with this Idempotency-Key is still processing",
    });
  }
}

export async function completePublicApiIdempotency({
  recordId,
  responseStatus,
  responseBody,
}: {
  recordId: string | null;
  responseStatus: number;
  responseBody: unknown;
}) {
  if (!recordId) return;
  await prisma.publicApiIdempotencyRecord.update({
    where: { id: recordId },
    data: {
      status: "COMPLETED",
      responseStatus,
      responseBody: responseBody as Prisma.InputJsonValue,
      completedAt: new Date(),
      failedAt: null,
      lockedUntil: null,
    },
  });
}

export async function failPublicApiIdempotency({ recordId }: { recordId: string | null }) {
  if (!recordId) return;
  await prisma.publicApiIdempotencyRecord
    .update({
      where: { id: recordId },
      data: { status: "FAILED", failedAt: new Date(), lockedUntil: null },
    })
    .catch((error) => {
      logger.error("Failed to mark public API idempotency record as failed", { error, recordId });
    });
}

export function createPublicApiIdempotencyErrorResponse(
  error: unknown,
  requestId?: string | null,
) {
  if (error instanceof PublicApiIdempotencyError) {
    return publicApiError({
      status: error.status,
      code: error.code,
      message: error.message,
      requestId,
    });
  }
  throw error;
}
