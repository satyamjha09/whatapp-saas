import { prisma } from "@/lib/prisma";
import type { DeveloperWebhookEndpointStatus } from "@/generated/prisma/enums";
import { createCompanyNotification } from "@/server/services/company-notification.service";

const WEBHOOK_AUTO_DISABLE_FAILURE_THRESHOLD = 10;
const WEBHOOK_DEGRADED_FAILURE_THRESHOLD = 5;

export async function markDeveloperWebhookDeliverySuccess(endpointId: string) {
  return prisma.developerWebhookEndpoint.update({
    where: {
      id: endpointId,
    },
    data: {
      consecutiveFailureCount: 0,
      lastSuccessAt: new Date(),
      lastFailureAt: null,
      autoDisabledReason: null,
    },
  });
}

export async function markDeveloperWebhookDeliveryFailure({
  endpointId,
  reason,
}: {
  endpointId: string;
  reason: string;
}) {
  const endpoint = await prisma.developerWebhookEndpoint.findUnique({
    where: {
      id: endpointId,
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      url: true,
      status: true,
      consecutiveFailureCount: true,
    },
  });

  if (!endpoint) {
    return null;
  }

  const nextFailureCount = endpoint.consecutiveFailureCount + 1;
  const shouldAutoDisable =
    endpoint.status === "ACTIVE" &&
    nextFailureCount >= WEBHOOK_AUTO_DISABLE_FAILURE_THRESHOLD;

  const updatedEndpoint = await prisma.developerWebhookEndpoint.update({
    where: {
      id: endpointId,
    },
    data: {
      consecutiveFailureCount: nextFailureCount,
      lastFailureAt: new Date(),
      ...(shouldAutoDisable
        ? {
            status: "AUTO_DISABLED" as const,
            autoDisabledAt: new Date(),
            autoDisabledReason:
              reason || "Webhook auto-disabled after repeated failures",
          }
        : {}),
    },
  });

  if (shouldAutoDisable) {
    await createCompanyNotification({
      companyId: endpoint.companyId,
      type: "WEBHOOK",
      severity: "ERROR",
      title: "Developer webhook auto-disabled",
      message: `${endpoint.name} was disabled after repeated delivery failures.`,
      actionHref: "/dashboard/developer/webhooks",
      idempotencyKey: `developer-webhook-auto-disabled:${endpoint.id}`,
      metadata: {
        webhookId: endpoint.id,
        webhookName: endpoint.name,
        webhookUrl: endpoint.url,
        reason,
      },
    });
  }

  return updatedEndpoint;
}

export async function reEnableDeveloperWebhookEndpoint(endpointId: string) {
  return prisma.developerWebhookEndpoint.update({
    where: {
      id: endpointId,
    },
    data: {
      status: "ACTIVE",
      consecutiveFailureCount: 0,
      lastFailureAt: null,
      autoDisabledAt: null,
      autoDisabledReason: null,
    },
  });
}

export function getDeveloperWebhookHealthLabel({
  status,
  consecutiveFailureCount,
  autoDisabledAt,
}: {
  status: DeveloperWebhookEndpointStatus;
  consecutiveFailureCount: number;
  autoDisabledAt: Date | null;
}) {
  if (autoDisabledAt || status === "AUTO_DISABLED") {
    return "AUTO_DISABLED";
  }

  if (status !== "ACTIVE") {
    return "DISABLED";
  }

  if (consecutiveFailureCount >= WEBHOOK_DEGRADED_FAILURE_THRESHOLD) {
    return "DEGRADED";
  }

  return "HEALTHY";
}
