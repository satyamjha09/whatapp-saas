import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  extractCreditPaymentFromWebhook,
  markRazorpayCreditPurchaseFailedFromWebhook,
  markRazorpayCreditPurchasePaidFromWebhook,
  type RazorpayWebhookPayload,
  verifyRazorpayWebhookSignature,
} from "@/server/services/razorpay-credit.service";
import { createAuditLog } from "@/server/services/audit.service";
import {
  markRazorpaySubscriptionPaymentFailedFromWebhook,
  markRazorpaySubscriptionPaymentPaidFromWebhook,
} from "@/server/services/razorpay-subscription.service";
import { NextResponse } from "next/server";

const handledEvents = new Set([
  "payment.captured",
  "order.paid",
  "payment.failed",
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
  await prisma.razorpayWebhookEvent.update({
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
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  let eventRecordId: string | undefined;

  if (!signature) {
    return NextResponse.json(
      { message: "Missing Razorpay signature" },
      { status: 400 },
    );
  }

  try {
    if (!verifyRazorpayWebhookSignature({ rawBody, signature })) {
      return NextResponse.json(
        { message: "Invalid Razorpay webhook signature" },
        { status: 400 },
      );
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const eventType = payload.event ?? "unknown";
    const razorpayEventId =
      request.headers.get("x-razorpay-event-id") ??
      payload.event_id ??
      payload.id ??
      null;
    const eventPayload = payload as Prisma.InputJsonValue;

    if (razorpayEventId) {
      const existingEvent = await prisma.razorpayWebhookEvent.findUnique({
        where: { razorpayEventId },
      });

      if (
        existingEvent?.status === "PROCESSED" ||
        existingEvent?.status === "IGNORED"
      ) {
        return NextResponse.json({ message: "Webhook already processed" });
      }

      if (existingEvent) {
        const resetEvent = await prisma.razorpayWebhookEvent.update({
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
    }

    if (!eventRecordId) {
      try {
        const eventRecord = await prisma.razorpayWebhookEvent.create({
          data: {
            razorpayEventId,
            eventType,
            payload: eventPayload,
          },
        });
        eventRecordId = eventRecord.id;
      } catch (error) {
        if (
          razorpayEventId &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const racedEvent = await prisma.razorpayWebhookEvent.findUniqueOrThrow(
            { where: { razorpayEventId } },
          );
          eventRecordId = racedEvent.id;
        } else {
          throw error;
        }
      }
    }

    if (!handledEvents.has(eventType)) {
      await markEvent({
        eventRecordId,
        status: "IGNORED",
        errorMessage: `Unhandled event type: ${eventType}`,
      });

      return NextResponse.json({ message: "Webhook ignored" });
    }

    const paymentData = extractCreditPaymentFromWebhook(payload);

    if (
      !paymentData.razorpayOrderId ||
      ((eventType === "payment.captured" || eventType === "order.paid") &&
        !paymentData.razorpayPaymentId)
    ) {
      await markEvent({
        eventRecordId,
        status: "IGNORED",
        errorMessage: "Webhook does not contain required payment IDs",
      });

      return NextResponse.json({ message: "Webhook ignored" });
    }

    const [matchedPurchase, matchedSubscription] = await Promise.all([
      prisma.creditPurchase.findUnique({
        where: { razorpayOrderId: paymentData.razorpayOrderId },
        select: { companyId: true },
      }),
      prisma.subscriptionPayment.findUnique({
        where: { razorpayOrderId: paymentData.razorpayOrderId },
        select: { id: true, companyId: true, userId: true, plan: true, amountPaise: true },
      }),
    ]);

    if (!matchedPurchase && !matchedSubscription) {
      await markEvent({
        eventRecordId,
        status: "IGNORED",
        errorMessage: "No matching TallyKonnect payment order",
      });
      return NextResponse.json({ message: "Webhook ignored" });
    }

    const matchedCompanyId =
      matchedSubscription?.companyId ?? matchedPurchase!.companyId;

    try {
      if (matchedSubscription) {
        if (eventType === "payment.failed") {
          await markRazorpaySubscriptionPaymentFailedFromWebhook({
            razorpayOrderId: paymentData.razorpayOrderId,
            razorpayPaymentId: paymentData.razorpayPaymentId,
            failureReason: paymentData.failureReason,
          });
          await markEvent({
            eventRecordId,
            companyId: matchedCompanyId,
            status: "PROCESSED",
          });
          return NextResponse.json({ message: "Razorpay subscription failure processed" });
        }

        const subscriptionResult = await markRazorpaySubscriptionPaymentPaidFromWebhook({
          razorpayOrderId: paymentData.razorpayOrderId,
          razorpayPaymentId: paymentData.razorpayPaymentId!,
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
              plan: matchedSubscription.plan,
              amountPaise: matchedSubscription.amountPaise,
              razorpayOrderId: paymentData.razorpayOrderId,
              razorpayPaymentId: paymentData.razorpayPaymentId,
            },
          });
        }
        await markEvent({
          eventRecordId,
          companyId: matchedCompanyId,
          status: "PROCESSED",
        });
        return NextResponse.json({ message: "Razorpay subscription processed" });
      }

      if (eventType === "payment.failed") {
        await markRazorpayCreditPurchaseFailedFromWebhook({
          razorpayOrderId: paymentData.razorpayOrderId,
          razorpayPaymentId: paymentData.razorpayPaymentId,
          failureReason: paymentData.failureReason,
        });
        await markEvent({
          eventRecordId,
          companyId: matchedCompanyId,
          status: "PROCESSED",
        });

        return NextResponse.json({
          message: "Razorpay payment failure processed",
        });
      }

      await markRazorpayCreditPurchasePaidFromWebhook({
        razorpayOrderId: paymentData.razorpayOrderId,
        razorpayPaymentId: paymentData.razorpayPaymentId!,
        amountPaise: paymentData.amountPaise,
        currency: paymentData.currency,
      });
      await markEvent({
        eventRecordId,
        companyId: matchedCompanyId,
        status: "PROCESSED",
      });

      return NextResponse.json({
        message: "Razorpay credit purchase processed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (
        message === "Credit purchase not found" ||
        message === "Subscription payment not found"
      ) {
        await markEvent({
          eventRecordId,
          status: "IGNORED",
          errorMessage: "No matching TallyKonnect payment order",
        });
        return NextResponse.json({ message: "Webhook ignored" });
      }

      if (
        message === "Razorpay payment amount mismatch" ||
        message === "Razorpay payment currency mismatch" ||
        message === "Credit purchase has an invalid credit quantity"
      ) {
        await markEvent({
          eventRecordId,
          companyId: matchedCompanyId,
          status: "FAILED",
          errorMessage: message,
        });
        return NextResponse.json({ message: "Webhook rejected" });
      }

      throw error;
    }
  } catch (error) {
    console.error("RAZORPAY_WEBHOOK_ERROR:", error);

    if (eventRecordId) {
      try {
        await markEvent({
          eventRecordId,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown webhook error",
        });
      } catch {
        // The original processing error is the useful failure to retry.
      }
    }

    return NextResponse.json(
      { message: "Unable to process Razorpay webhook" },
      { status: 500 },
    );
  }
}
