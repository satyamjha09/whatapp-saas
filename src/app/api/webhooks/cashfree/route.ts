import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completePlanCheckoutFromWebhook } from "@/server/services/plan-checkout-reconciliation.service";
import {
  extractCashfreePaymentFromWebhook,
  getCashfreeWebhookEventId,
  type CashfreeWebhookPayload,
  verifyCashfreeWebhookSignature,
} from "@/server/services/cashfree-payment.service";
import {
  markCashfreeSubscriptionPaymentFailedFromWebhook,
  markCashfreeSubscriptionPaymentPaidFromWebhook,
} from "@/server/services/cashfree-subscription.service";
import {
  processRefundWebhookPayload,
  type CashfreeRefundWebhookPayload,
} from "@/server/services/billing-refund-reconciliation.service";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createRequestBodyErrorResponse,
  InvalidRequestBodyError,
  readRequestTextWithLimit,
  REQUEST_BODY_LIMITS,
} from "@/server/utils/request-body-guard";
import {
  detectWebhookReplay,
  recordWebhookSignatureFailure,
  WebhookReplayError,
} from "@/server/services/webhook-signature.service";
import {
  completeProviderWebhookEvent,
  failProviderWebhookEvent,
  startProviderWebhookEvent,
} from "@/server/services/provider-webhook-event.service";

const successEvents = new Set(["PAYMENT_SUCCESS_WEBHOOK"]);
const failedEvents = new Set([
  "PAYMENT_FAILED_WEBHOOK",
  "PAYMENT_USER_DROPPED_WEBHOOK",
]);

async function markEvent({
  companyId,
  errorMessage,
  eventRecordId,
  status,
}: {
  companyId?: string;
  errorMessage?: string;
  eventRecordId: string;
  status: "PROCESSED" | "FAILED" | "IGNORED";
}) {
  await prisma.cashfreeWebhookEvent.update({
    where: { id: eventRecordId },
    data: {
      companyId,
      status,
      errorMessage: errorMessage ?? null,
      processedAt: new Date(),
    },
  });
}

export async function POST(request: Request) {
  let rawBody = "";
  let payload: CashfreeWebhookPayload;
  let eventRecordId: string | undefined;
  let providerWebhookEventId: string | undefined;

  async function completeAndRespond(
    body: Parameters<typeof NextResponse.json>[0],
    init?: Parameters<typeof NextResponse.json>[1],
  ) {
    if (providerWebhookEventId) {
      await completeProviderWebhookEvent({
        eventId: providerWebhookEventId,
      });
    }

    return NextResponse.json(body, init);
  }

  try {
    try {
      rawBody = await readRequestTextWithLimit({
        request,
        maxBytes: REQUEST_BODY_LIMITS.webhook(),
      });

      const signature = request.headers.get("x-webhook-signature");
      const timestamp = request.headers.get("x-webhook-timestamp");
      const verified = verifyCashfreeWebhookSignature({
        rawBody,
        signatureHeader: signature,
        timestampHeader: timestamp,
      });

      if (!verified) {
        await recordWebhookSignatureFailure({
          request,
          provider: "CASHFREE",
          reason: "Invalid Cashfree webhook signature",
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

      payload = JSON.parse(rawBody) as CashfreeWebhookPayload;

      await detectWebhookReplay({
        provider: "CASHFREE",
        replayKey: getCashfreeWebhookEventId({
          body: payload,
          signature,
          timestamp,
        }),
        request,
      });
    } catch (error) {
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
          source: "cashfree-webhook",
        });
      }

      if (
        error instanceof Error &&
        (error.message.includes("signature") ||
          error.message.includes("Cashfree credentials"))
      ) {
        await recordWebhookSignatureFailure({
          request,
          provider: "CASHFREE",
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

      return createRequestBodyErrorResponse({
        request,
        error,
        source: "cashfree-webhook",
      });
    }

    const cashfreeEventId = getCashfreeWebhookEventId({
      body: payload,
      signature: request.headers.get("x-webhook-signature"),
      timestamp: request.headers.get("x-webhook-timestamp"),
    });
    const providerWebhookEvent = await startProviderWebhookEvent({
      provider: "CASHFREE",
      providerEventId: cashfreeEventId,
      eventType: payload.type ?? "cashfree.webhook",
      rawBody,
      metadata: {
        source: "cashfree-webhook",
        signaturePresent: Boolean(request.headers.get("x-webhook-signature")),
      },
    });

    providerWebhookEventId = providerWebhookEvent.event.id;

    if (!providerWebhookEvent.shouldProcess) {
      return Response.json({
        ok: true,
        duplicate: true,
      });
    }

    const eventType = payload.type ?? "unknown";
    const eventPayload = payload as Prisma.InputJsonValue;
    const existingEvent = await prisma.cashfreeWebhookEvent.findUnique({
      where: { cashfreeEventId: cashfreeEventId },
    });

    if (
      existingEvent?.status === "PROCESSED" ||
      existingEvent?.status === "IGNORED"
    ) {
      return completeAndRespond({ message: "Webhook already processed" });
    }

    if (existingEvent) {
      const resetEvent = await prisma.cashfreeWebhookEvent.update({
        where: { id: existingEvent.id },
        data: {
          eventType,
          payload: eventPayload,
          status: "RECEIVED",
          errorMessage: null,
          processedAt: null,
        },
      });
      eventRecordId = resetEvent.id;
    }

    if (!eventRecordId) {
      const eventRecord = await prisma.cashfreeWebhookEvent.create({
        data: {
          cashfreeEventId: cashfreeEventId,
          eventType,
          payload: eventPayload,
        },
      });
      eventRecordId = eventRecord.id;
    }

    if (eventType.toUpperCase().includes("REFUND")) {
      const refundResult = await processRefundWebhookPayload({
        payload: payload as CashfreeRefundWebhookPayload,
      });

      if ("skipped" in refundResult && refundResult.skipped) {
        const reason =
          "reason" in refundResult && typeof refundResult.reason === "string"
            ? refundResult.reason
            : "Refund status already reconciled";

        await markEvent({
          eventRecordId,
          status: "IGNORED",
          errorMessage: reason,
        });

        return completeAndRespond({
          message: "Cashfree refund webhook ignored",
          reason,
        });
      }

      await markEvent({
        eventRecordId,
        status: "PROCESSED",
      });

      return completeAndRespond({ message: "Cashfree refund webhook processed" });
    }

    if (!successEvents.has(eventType) && !failedEvents.has(eventType)) {
      await markEvent({
        eventRecordId,
        status: "IGNORED",
        errorMessage: `Unhandled event type: ${eventType}`,
      });

      return completeAndRespond({ message: "Webhook ignored" });
    }

    const paymentData = extractCashfreePaymentFromWebhook(payload);

    if (
      !paymentData.orderId ||
      (successEvents.has(eventType) && !paymentData.paymentId)
    ) {
      await markEvent({
        eventRecordId,
        status: "IGNORED",
        errorMessage: "Webhook does not contain required payment IDs",
      });

      return completeAndRespond({ message: "Webhook ignored" });
    }

    const [matchedCheckout, matchedSubscription] = await Promise.all([
      prisma.planCheckout.findFirst({
        where: {
          cashfreeOrderId: paymentData.orderId,
        },
      }),
      prisma.subscriptionPayment.findUnique({
        where: { cashfreeOrderId: paymentData.orderId },
        select: { id: true, companyId: true, userId: true, plan: true, amountPaise: true },
      }),
    ]);

    if (!matchedCheckout && !matchedSubscription) {
      await markEvent({
        eventRecordId,
        status: "IGNORED",
        errorMessage: "No matching TallyKonnect payment order",
      });
      return completeAndRespond({ message: "Webhook ignored" });
    }

    const matchedCompanyId =
      matchedCheckout?.companyId ?? matchedSubscription!.companyId;

    if (matchedCheckout) {
      if (failedEvents.has(eventType)) {
        await prisma.planCheckout.updateMany({
          where: {
            id: matchedCheckout.id,
            status: { not: "PAID" },
          },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: paymentData.failureReason ?? "Cashfree payment failed",
          },
        });

        await markEvent({
          eventRecordId,
          companyId: matchedCompanyId,
          status: "PROCESSED",
        });

        return completeAndRespond({
          message: "Cashfree plan checkout payment failure processed",
        });
      }

      await completePlanCheckoutFromWebhook({
        cashfreeOrderId: paymentData.orderId,
        cashfreePaymentId: paymentData.paymentId!,
        amountPaise: paymentData.amountPaise,
        currency: paymentData.currency,
        payload,
      });

      await markEvent({
        eventRecordId,
        companyId: matchedCompanyId,
        status: "PROCESSED",
      });

      return completeAndRespond({
        message: "Cashfree plan checkout processed",
      });
    }

    if (matchedSubscription) {
      if (failedEvents.has(eventType)) {
        await markCashfreeSubscriptionPaymentFailedFromWebhook({
          cashfreeOrderId: paymentData.orderId,
          cashfreePaymentId: paymentData.paymentId,
          failureReason: paymentData.failureReason,
        });
        await markEvent({
          eventRecordId,
          companyId: matchedCompanyId,
          status: "PROCESSED",
        });
        return completeAndRespond({
          message: "Cashfree subscription failure processed",
        });
      }

      const subscriptionResult = await markCashfreeSubscriptionPaymentPaidFromWebhook({
        cashfreeOrderId: paymentData.orderId,
        cashfreePaymentId: paymentData.paymentId!,
        amountPaise: paymentData.amountPaise,
        currency: paymentData.currency,
      });
      if (!subscriptionResult.alreadyPaid) {
        await createAuditLog({
          companyId: matchedSubscription.companyId,
          actorUserId: matchedSubscription.userId,
          action: "billing.subscription_payment.webhook_verified",
          entityType: "SubscriptionPayment",
          entityId: matchedSubscription.id,
          metadata: {
            provider: "CASHFREE",
            plan: matchedSubscription.plan,
            amountPaise: matchedSubscription.amountPaise,
            cashfreeOrderId: paymentData.orderId,
            cashfreePaymentId: paymentData.paymentId,
          },
        });
      }
      await markEvent({
        eventRecordId,
        companyId: matchedCompanyId,
        status: "PROCESSED",
      });
      return completeAndRespond({ message: "Cashfree subscription processed" });
    }

    await markEvent({
      eventRecordId,
      status: "IGNORED",
      errorMessage: "No matching Cashfree payment handler",
    });
    return completeAndRespond({ message: "Webhook ignored" });
  } catch (error) {
    console.error("CASHFREE_WEBHOOK_ERROR:", error);

    if (eventRecordId) {
      try {
        await markEvent({
          eventRecordId,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown webhook error",
        });
      } catch {
        // Preserve the original route failure.
      }
    }

    if (providerWebhookEventId) {
      try {
        await failProviderWebhookEvent({
          eventId: providerWebhookEventId,
          errorMessage:
            error instanceof Error ? error.message : "Unknown Cashfree webhook error",
        });
      } catch {
        // Preserve the original route failure.
      }
    }

    return NextResponse.json(
      { message: "Unable to process Cashfree webhook" },
      { status: 500 },
    );
  }
}
