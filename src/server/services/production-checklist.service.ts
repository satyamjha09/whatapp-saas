import {
  type ProductionChecklistGroup,
  type ProductionChecklistItem,
} from "@/lib/production-checklist";
import { prisma } from "@/lib/prisma";
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
