import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import { enqueueDeveloperWebhookOutboxEvent } from "@/server/services/developer-webhook-outbox.service";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";

type RetryOutboxRouteContext = {
  params: Promise<{ outboxEventId: string }>;
};

export async function POST(
  request: Request,
  { params }: RetryOutboxRouteContext,
) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.developerWebhookRetry,
  });

  if (isRateLimitResponse(rateLimit)) {
    return rateLimit;
  }

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
        { message: "Only owners and admins can retry webhook events" },
        { status: 403 },
      );
    }

    const companyId = context.membership.companyId;
    await assertCompanyFeature(companyId, "DEVELOPER_WEBHOOKS");
    const { outboxEventId } = await params;

    try {
      await assertTenantEntityAccess({
        request,
        companyId,
        entityType: "DeveloperWebhookOutboxEvent",
        entityId: outboxEventId,
      });
    } catch (error) {
      return createTenantErrorResponse(error);
    }

    const event = await prisma.developerWebhookOutbox.findFirst({
      where: { id: outboxEventId, companyId },
    });

    if (!event) {
      return NextResponse.json(
        { message: "Webhook outbox event not found" },
        { status: 404 },
      );
    }
    if (event.status === "DELIVERED") {
      return NextResponse.json(
        { message: "Delivered events do not need retrying" },
        { status: 400 },
      );
    }
    if (event.status === "PROCESSING") {
      return NextResponse.json(
        { message: "Webhook event is already processing" },
        { status: 409 },
      );
    }

    const updatedEvent = await prisma.developerWebhookOutbox.update({
      where: { id: event.id },
      data: {
        status: "PENDING",
        lockedAt: null,
        lastError: null,
        processedAt: null,
      },
    });
    const queued = await enqueueDeveloperWebhookOutboxEvent(event.id);

    await createAuditLog({
      companyId,
      actorUserId: context.user.id,
      action: "developer.webhook.outbox_retried",
      entityType: "DeveloperWebhookOutbox",
      entityId: event.id,
      metadata: {
        eventType: event.eventType,
        previousStatus: event.status,
        queued,
      },
    });

    return NextResponse.json({
      message: queued
        ? "Webhook outbox event queued for retry"
        : "Webhook outbox event reset to pending and will be recovered when Redis is available",
      event: updatedEvent,
    });
  } catch (error) {
    console.error("RETRY_DEVELOPER_WEBHOOK_OUTBOX_ERROR:", error);

    if (
      error instanceof Error &&
      (error.message.includes("DEVELOPER_WEBHOOKS is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to retry webhook outbox event" },
      { status: 500 },
    );
  }
}
