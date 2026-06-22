import {
  type ProductionChecklistGroup,
  type ProductionChecklistItem,
} from "@/lib/production-checklist";
import { prisma } from "@/lib/prisma";
import { isRazorpayWebhookConfigured } from "@/server/services/razorpay-credit.service";
import { isRazorpayCheckoutConfigured } from "@/server/services/razorpay-subscription.service";
import type { UpdateProductionChecklistSettingsInput } from "@/server/validators/production-checklist.validator";

function buildItem(input: ProductionChecklistItem): ProductionChecklistItem {
  return input;
}

export async function getProductionChecklistByCompany(companyId: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const hasWebhookVerifyToken = Boolean(
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  );

  const [
    companySettings,
    whatsappAccount,
    inboundMessageCount,
    successfulOutboundMessageCount,
    approvedTemplateCount,
    memberCount,
    quickReplyCount,
    tagCount,
  ] = await prisma.$transaction([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        metaPaymentMethodAdded: true,
        metaBusinessVerificationStatus: true,
        productionChecklistNotes: true,
        productionChecklistUpdatedAt: true,
        billingPlan: true,
        subscriptionStatus: true,
        monthlyMessageLimit: true,
      },
    }),
    prisma.whatsAppAccount.findFirst({
      where: { companyId },
      include: {
        phoneNumbers: {
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "INBOUND",
        status: "RECEIVED",
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "OUTBOUND",
        metaMessageId: { not: null },
        status: { in: ["SENT", "DELIVERED", "READ"] },
      },
    }),
    prisma.template.count({
      where: { companyId, status: "APPROVED" },
    }),
    prisma.companyUser.count({ where: { companyId } }),
    prisma.quickReply.count({ where: { companyId } }),
    prisma.inboxTag.count({ where: { companyId } }),
  ]);

  const phoneNumber = whatsappAccount?.phoneNumbers[0];
  const hasWhatsAppCredentials =
    Boolean(whatsappAccount?.wabaId) &&
    Boolean(whatsappAccount?.accessToken) &&
    whatsappAccount?.status === "CONNECTED";
  const hasPhoneNumber =
    Boolean(phoneNumber?.phoneNumberId) &&
    Boolean(phoneNumber?.displayPhoneNumber);
  const hasPublicAppUrl =
    appUrl.startsWith("https://") &&
    !appUrl.includes("localhost") &&
    !appUrl.includes("127.0.0.1");
  const hasWebhookConfig = hasPublicAppUrl && hasWebhookVerifyToken;

  const groups: ProductionChecklistGroup[] = [
    {
      title: "WhatsApp Cloud API",
      description: "Core Meta setup required to send and receive messages.",
      items: [
        buildItem({
          id: "whatsapp-credentials",
          title: "WhatsApp credentials connected",
          description: hasWhatsAppCredentials
            ? "WABA ID and encrypted access token are saved."
            : "Save the WABA ID and access token in WhatsApp Settings.",
          status: hasWhatsAppCredentials ? "complete" : "pending",
          required: true,
          actionLabel: "WhatsApp Settings",
          actionHref: "/dashboard/whatsapp",
        }),
        buildItem({
          id: "phone-number",
          title: "Phone number connected",
          description: hasPhoneNumber
            ? `Connected number: ${phoneNumber?.displayPhoneNumber}`
            : "Save the Meta Phone Number ID and display number.",
          status: hasPhoneNumber ? "complete" : "pending",
          required: true,
          actionLabel: "WhatsApp Settings",
          actionHref: "/dashboard/whatsapp",
        }),
        buildItem({
          id: "webhook-config",
          title: "Webhook environment configured",
          description: hasWebhookConfig
            ? `Callback ready at ${appUrl}/api/webhooks/whatsapp`
            : hasWebhookVerifyToken && !hasPublicAppUrl
              ? "The verify token exists, but the app URL is not public HTTPS."
              : "Set a public app URL and WhatsApp webhook verify token.",
          status: hasWebhookConfig
            ? "complete"
            : hasWebhookVerifyToken
              ? "warning"
              : "pending",
          required: true,
          actionLabel: "WhatsApp Settings",
          actionHref: "/dashboard/whatsapp",
        }),
        buildItem({
          id: "inbound-test",
          title: "Inbound message test passed",
          description:
            inboundMessageCount > 0
              ? `${inboundMessageCount} inbound message(s) received.`
              : "Send a WhatsApp message to your business number.",
          status: inboundMessageCount > 0 ? "complete" : "pending",
          required: true,
          actionLabel: "Open Inbox",
          actionHref: "/dashboard/inbox",
        }),
        buildItem({
          id: "outbound-test",
          title: "Outbound reply test passed",
          description:
            successfulOutboundMessageCount > 0
              ? `${successfulOutboundMessageCount} outbound message(s) sent through Meta.`
              : "Reply from the inbox to confirm the full send pipeline.",
          status: successfulOutboundMessageCount > 0 ? "complete" : "pending",
          required: true,
          actionLabel: "Open Inbox",
          actionHref: "/dashboard/inbox",
        }),
      ],
    },
    {
      title: "Messaging readiness",
      description: "Templates and inbox tools for reliable customer support.",
      items: [
        buildItem({
          id: "approved-template",
          title: "Approved message template",
          description:
            approvedTemplateCount > 0
              ? `${approvedTemplateCount} approved template(s) available.`
              : "Create and approve at least one WhatsApp template.",
          status: approvedTemplateCount > 0 ? "complete" : "pending",
          required: true,
          actionLabel: "Open Templates",
          actionHref: "/dashboard/templates",
        }),
        buildItem({
          id: "team-setup",
          title: "Team members added",
          description:
            memberCount > 1
              ? `${memberCount} team members are in this workspace.`
              : "Invite at least one teammate before production.",
          status: memberCount > 1 ? "complete" : "warning",
          required: false,
          actionLabel: "Open Team",
          actionHref: "/dashboard/settings/team",
        }),
        buildItem({
          id: "team-plan-limits",
          title: "Team member plan limits enabled",
          description:
            "Workspace invitations and acceptance are protected by subscription seat limits.",
          status: "complete",
          required: true,
          actionLabel: "Open Team",
          actionHref: "/dashboard/settings/team",
        }),
        buildItem({
          id: "inbox-tools",
          title: "Inbox tools configured",
          description:
            quickReplyCount > 0 || tagCount > 0
              ? `${quickReplyCount} quick replies and ${tagCount} tags configured.`
              : "Add quick replies and tags for faster support.",
          status: quickReplyCount > 0 || tagCount > 0 ? "complete" : "warning",
          required: false,
          actionLabel: "Configure Tools",
          actionHref: "/dashboard/inbox/quick-replies",
        }),
      ],
    },
    {
      title: "Production business setup",
      description: "Operational items to confirm before serving customers.",
      items: [
        buildItem({
          id: "billing",
          title: "Billing plan initialized",
          description:
            companySettings?.billingPlan &&
            companySettings.monthlyMessageLimit > 0
              ? `Plan: ${companySettings.billingPlan}, status: ${companySettings.subscriptionStatus}.`
              : "The billing plan has not been initialized.",
          status:
            companySettings?.billingPlan &&
            companySettings.monthlyMessageLimit > 0
              ? "complete"
              : "pending",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "razorpay-webhook",
          title: "Razorpay webhook backup enabled",
          description: isRazorpayWebhookConfigured()
            ? "Signed Razorpay events are processed idempotently for credit purchases and subscription upgrades."
            : "Configure the Razorpay webhook secret before accepting payments.",
          status: isRazorpayWebhookConfigured() ? "complete" : "pending",
          required: true,
          actionLabel: "Open Credit Center",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "subscription-plan-limits",
          title: "Subscription plan limits enabled",
          description:
            "Monthly message quota and bulk recipient limits follow the workspace plan.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "plan-feature-gates",
          title: "Plan-based feature gates enabled",
          description:
            "Bulk campaigns, contact groups, developer API, and webhooks follow subscription access.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "developer-api-plan-rate-limits",
          title: "Developer API plan rate limits enabled",
          description:
            "Daily API usage is recorded atomically and blocked at the workspace plan limit.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-analytics",
          title: "Developer API key analytics enabled",
          description:
            "API keys track last-used time, per-key request analytics, and can be revoked by owners/admins.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-scopes",
          title: "Developer API key scopes enabled",
          description:
            "API keys can be limited to specific permissions such as messages, contacts, templates, campaigns, and webhooks.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-editing",
          title: "Developer API key editing enabled",
          description:
            "Owners and admins can rename active API keys and adjust scopes without exposing or rotating the secret.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-ip-expiry",
          title: "Developer API key IP allowlist and expiry enabled",
          description:
            "API keys can be restricted to trusted IP addresses and automatically blocked after expiry.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-webhook-signatures",
          title: "Developer webhook signatures enabled",
          description:
            "Outbound developer webhooks are signed with HMAC SHA-256 and support signing secret rotation.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer Webhooks",
          actionHref: "/dashboard/developer/webhooks",
        }),
        buildItem({
          id: "developer-webhook-health-auto-disable",
          title: "Developer webhook health monitoring enabled",
          description:
            "Webhook endpoints track consecutive failures, last success/failure, and auto-disable after repeated delivery failures.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer Webhooks",
          actionHref: "/dashboard/developer/webhooks",
        }),
        buildItem({
          id: "developer-webhook-event-subscriptions",
          title: "Developer webhook event subscriptions enabled",
          description:
            "Developer webhooks can subscribe to selected event types and include a payload version for compatibility.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer Webhooks",
          actionHref: "/dashboard/developer/webhooks",
        }),
        buildItem({
          id: "developer-webhook-outbox",
          title: "Developer webhook outbox enabled",
          description:
            "Webhook events are stored and delivered asynchronously through a reliable outbox worker with retries and idempotency.",
          status: "complete",
          required: true,
          actionLabel: "Open Webhook Outbox",
          actionHref: "/dashboard/developer/webhooks/outbox",
        }),
        buildItem({
          id: "developer-webhook-outbox-detail",
          title: "Developer webhook outbox detail enabled",
          description:
            "Webhook outbox events can be inspected with payload, status, retry action, and linked delivery attempts.",
          status: "complete",
          required: true,
          actionLabel: "Open Webhook Outbox",
          actionHref: "/dashboard/developer/webhooks/outbox",
        }),
        buildItem({
          id: "subscription-expiry-guard",
          title: "Subscription expiry guard enabled",
          description:
            "Expired paid plans are marked past due automatically and blocked from sending until renewed.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "paid-plan-upgrade",
          title: "Paid plan upgrade enabled",
          description: isRazorpayCheckoutConfigured()
            ? "Paid plans activate only after Razorpay payment verification."
            : "Configure the Razorpay key ID and key secret before accepting plan payments.",
          status: isRazorpayCheckoutConfigured() ? "complete" : "pending",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "subscription-renewal-flow",
          title: "Subscription renewal flow enabled",
          description: isRazorpayCheckoutConfigured()
            ? "Past-due and expiring paid plans can renew through verified Razorpay checkout."
            : "Configure Razorpay credentials to enable paid plan renewals.",
          status: isRazorpayCheckoutConfigured() ? "complete" : "pending",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "subscription-cancel-resume",
          title: "Subscription cancel and resume enabled",
          description:
            "Paid plans can cancel at period end, resume before expiry, and downgrade automatically afterward.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "meta-payment",
          title: "Meta payment method added",
          description: companySettings?.metaPaymentMethodAdded
            ? "Payment method confirmed in Meta Business Manager."
            : "Confirm a payment method is active in Meta Business Manager.",
          status: companySettings?.metaPaymentMethodAdded
            ? "complete"
            : "warning",
          required: true,
          actionLabel: "Update Confirmation",
          actionHref: "/dashboard/production-checklist#manual-confirmations",
        }),
        buildItem({
          id: "business-verification",
          title: "Business verification",
          description:
            companySettings?.metaBusinessVerificationStatus === "APPROVED"
              ? "Meta Business Verification is approved."
              : companySettings?.metaBusinessVerificationStatus === "SUBMITTED"
                ? "Verification is submitted and waiting for Meta approval."
                : companySettings?.metaBusinessVerificationStatus === "REJECTED"
                  ? "Verification was rejected. Review Meta requirements."
                  : "Confirm Meta Business Verification is submitted or approved.",
          status:
            companySettings?.metaBusinessVerificationStatus === "APPROVED"
              ? "complete"
              : companySettings?.metaBusinessVerificationStatus === "SUBMITTED"
                ? "warning"
                : "pending",
          required: true,
          actionLabel: "Update Confirmation",
          actionHref: "/dashboard/production-checklist#manual-confirmations",
        }),
      ],
    },
  ];

  const allItems = groups.flatMap((group) => group.items);
  const requiredItems = allItems.filter((item) => item.required);
  const completedItems = allItems.filter((item) => item.status === "complete");
  const completedRequiredItems = requiredItems.filter(
    (item) => item.status === "complete",
  );

  return {
    groups,
    summary: {
      totalItems: allItems.length,
      completedItems: completedItems.length,
      requiredItems: requiredItems.length,
      completedRequiredItems: completedRequiredItems.length,
      isProductionReady:
        completedRequiredItems.length === requiredItems.length,
    },
  };
}

export async function getProductionChecklistSettingsByCompany(
  companyId: string,
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      metaPaymentMethodAdded: true,
      metaBusinessVerificationStatus: true,
      productionChecklistNotes: true,
      productionChecklistUpdatedAt: true,
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  return company;
}

export async function updateProductionChecklistSettings(
  companyId: string,
  input: UpdateProductionChecklistSettingsInput,
) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      metaPaymentMethodAdded: input.metaPaymentMethodAdded,
      metaBusinessVerificationStatus: input.metaBusinessVerificationStatus,
      productionChecklistNotes: input.productionChecklistNotes || null,
      productionChecklistUpdatedAt: new Date(),
    },
    select: {
      metaPaymentMethodAdded: true,
      metaBusinessVerificationStatus: true,
      productionChecklistNotes: true,
      productionChecklistUpdatedAt: true,
    },
  });
}
