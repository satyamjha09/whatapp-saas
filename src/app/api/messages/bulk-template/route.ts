import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { ConsentRequiredError } from "@/server/services/contact-consent.service";
import { sendBulkTemplateMessages } from "@/server/services/bulk-message.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";
import { sendBulkTemplateMessageSchema } from "@/server/validators/bulk-message.validator";
import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";
import {
  enforceApiRateLimit,
  isRateLimitResponse,
} from "@/server/utils/api-rate-limit";
import {
  createRequestBodyErrorResponse,
  readRequestJsonWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";
import { assertRouteFeatureEntitlement, createFeatureEntitlementErrorResponse } from "@/server/auth/feature-entitlement-guard";

export async function POST(request: Request) {
  const rateLimit = await enforceApiRateLimit({
    request,
    rule: RATE_LIMIT_RULES.bulkMessageCreate,
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
        { message: "Only owners and admins can send bulk messages" },
        { status: 403 },
      );
    }

    try {
      await assertRouteFeatureEntitlement({ request, workspace: context });
    } catch (error) {
      return createFeatureEntitlementErrorResponse(error);
    }

    let body: unknown;

    try {
      body = await readRequestJsonWithLimit({
        request,
        maxBytes: REQUEST_BODY_LIMITS.bulkMessage(),
      });
    } catch (error) {
      return createRequestBodyErrorResponse({
        request,
        error,
        source: "bulk-message-create",
      });
    }

    const validation = sendBulkTemplateMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid bulk message details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await assertSystemWritesAllowed({
      operation: "Sending bulk messages",
    });

    const result = await sendBulkTemplateMessages(
      context.membership.companyId,
      validation.data,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "message.bulk_template.queued",
      entityType: "Message",
      metadata: {
        batchId: result.batch.id,
        templateId: result.template.id,
        templateName: result.template.name,
        requestedCount: result.requestedCount,
        queuedCount: result.queuedCount,
        failedCount: result.failedCount,
        skippedDuplicateCount: result.skippedDuplicateCount,
        skippedBlockedCount: result.skippedBlockedCount,
        missingMarketingConsent: result.missingMarketingConsent,
        contactGroupId: result.contactGroup?.id ?? null,
        contactGroupName: result.contactGroup?.name ?? null,
        scheduledAt: result.batch.scheduledAt,
        status: result.batch.status,
      },
    });

    return NextResponse.json(
      {
        message:
          result.batch.status === "SCHEDULED"
            ? "Bulk messages scheduled successfully"
            : "Bulk messages queued successfully",
        result: {
          batchId: result.batch.id,
          requestedCount: result.requestedCount,
          queuedCount: result.queuedCount,
          failedCount: result.failedCount,
          skippedDuplicateCount: result.skippedDuplicateCount,
          skippedBlockedCount: result.skippedBlockedCount,
          missingMarketingConsent: result.missingMarketingConsent,
          scheduledAt: result.batch.scheduledAt,
          status: result.batch.status,
          contactGroupId: result.contactGroup?.id ?? null,
          contactGroupName: result.contactGroup?.name ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SEND_BULK_TEMPLATE_MESSAGE_ERROR:", error);

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
        "Contact group not found",
        "Contact group has no contacts",
        "Contact group has no sendable contacts",
        "Company not found",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Subscription is past due") {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message.includes("plan allows maximum")
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message.includes("BULK_CAMPAIGNS is not available")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      (error.message.startsWith("This template requires") ||
        error.message.startsWith("Recipient +"))
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
      error.message === "Unable to enqueue bulk messages"
    ) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { message: "Unable to queue bulk messages" },
      { status: 500 },
    );
  }
}
