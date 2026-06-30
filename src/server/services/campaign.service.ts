import { getMessageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import { publishCampaignDeveloperWebhookEvent } from "@/server/services/developer-webhook-event-publisher.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { CreateCampaignInput } from "@/server/validators/campaign.validator";

export async function getCampaignsByCompany(companyId: string) {
  return prisma.campaign.findMany({
    where: {
      companyId,
    },
    include: {
      template: true,
      contacts: {
        include: {
          contact: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createCampaignForCompany(
  companyId: string,
  input: CreateCampaignInput,
) {
  await assertCompanyFeature(companyId, "BULK_CAMPAIGNS");
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "CAMPAIGNS",
    amount: 1,
  });

  const template = await prisma.template.findFirst({
    where: {
      id: input.templateId,
      companyId,
      status: "APPROVED",
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  const requiredVariableCount = template.variables.length;

  if (input.variables.length !== requiredVariableCount) {
    throw new Error(
      `This template requires ${requiredVariableCount} variable value(s)`,
    );
  }

  const uniqueContactIds = Array.from(new Set(input.contactIds));

  const contacts = await prisma.contact.findMany({
    where: {
      companyId,
      id: {
        in: uniqueContactIds,
      },
    },
  });

  if (contacts.length !== uniqueContactIds.length) {
    throw new Error("One or more contacts were not found");
  }

  const campaign = await prisma.campaign.create({
    data: {
      companyId,
      templateId: template.id,
      name: input.name,
      variables: input.variables,
      totalContacts: contacts.length,
      status: "DRAFT",
      contacts: {
        create: contacts.map((contact) => ({
          companyId,
          contactId: contact.id,
          variables: input.variables,
          status: "PENDING",
        })),
      },
    },
    include: {
      template: true,
      contacts: {
        include: {
          contact: true,
        },
      },
    },
  });

  await publishCampaignDeveloperWebhookEvent({
    companyId,
    campaign,
    operation: "created",
  });

  await incrementUsageQuota({
    companyId,
    featureKey: "CAMPAIGNS",
    amount: 1,
    idempotencyKey: `campaign-created:${campaign.id}`,
    reason: "campaign-created",
    metadata: {
      campaignId: campaign.id,
    },
  });

  return campaign;
}

function renderTemplateBody(body: string, variables: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    const value = variables[Number(index) - 1];

    return value ?? `{{${index}}}`;
  });
}

export async function startCampaignForCompany(
  companyId: string,
  campaignId: string,
) {
  await assertCompanyFeature(companyId, "BULK_CAMPAIGNS");
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      companyId,
    },
    include: {
      template: true,
      contacts: {
        include: {
          contact: true,
          message: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.status !== "DRAFT") {
    throw new Error("Only draft campaigns can be started");
  }

  if (campaign.template.status !== "APPROVED") {
    throw new Error("Campaign template is no longer approved");
  }

  const pendingContacts = campaign.contacts.filter(
    (campaignContact) =>
      campaignContact.status === "PENDING" && !campaignContact.message,
  );

  if (pendingContacts.length === 0) {
    throw new Error("Campaign has no pending contacts");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true },
  });
  if (!company) throw new Error("Company not found");
  const plan = getBillingPlanConfig(company.billingPlan);

  if (pendingContacts.length > plan.maxBulkRecipients) {
    throw new Error(
      `Your ${plan.name} plan allows maximum ${plan.maxBulkRecipients.toLocaleString("en-IN")} bulk recipients`,
    );
  }
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId, pendingContacts.length);
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: pendingContacts.length,
  });

  const requiredBalancePaise = pendingContacts.length * MESSAGE_PRICE_PAISE;

  const createdMessages = await prisma.$transaction(async (tx) => {
    const debitResult = await tx.wallet.updateMany({
      where: {
        companyId,
        balancePaise: {
          gte: requiredBalancePaise,
        },
      },
      data: {
        balancePaise: {
          decrement: requiredBalancePaise,
        },
      },
    });

    if (debitResult.count !== 1) {
      throw new Error("Insufficient wallet balance");
    }

    const messages: Array<{ id: string }> = [];

    for (const campaignContact of pendingContacts) {
      const toPhoneNumber = `${campaignContact.contact.countryCode}${campaignContact.contact.phoneNumber}`;

      const body = renderTemplateBody(
        campaign.template.body,
        campaignContact.variables,
      );

      const createdMessage = await tx.message.create({
        data: {
          companyId,
          contactId: campaignContact.contactId,
          templateId: campaign.templateId,
          campaignId: campaign.id,
          campaignContactId: campaignContact.id,
          toPhoneNumber,
          body,
          variables: campaignContact.variables,
          status: "QUEUED",
          direction: "OUTBOUND",
          events: {
            create: {
              companyId,
              status: "QUEUED",
              raw: {
                source: "campaign",
                campaignId: campaign.id,
                campaignContactId: campaignContact.id,
              },
            },
          },
        },
      });

      await tx.campaignContact.update({
        where: {
          id: campaignContact.id,
        },
        data: {
          status: "QUEUED",
        },
      });

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          companyId,
          type: "DEBIT",
          status: "SUCCESS",
          amountPaise: MESSAGE_PRICE_PAISE,
          description: "Campaign message queued",
          referenceType: "MESSAGE_USAGE",
          referenceId: createdMessage.id,
        },
      });

      await tx.messageUsageLedger.create({
        data: {
          companyId,
          messageId: createdMessage.id,
          walletTransactionId: walletTransaction.id,
          status: "CHARGED",
          amountPaise: MESSAGE_PRICE_PAISE,
        },
      });

      messages.push(createdMessage);
    }

    await tx.campaign.update({
      where: {
        id: campaign.id,
      },
      data: {
        status: "RUNNING",
        queuedCount: {
          increment: messages.length,
        },
      },
    });

    return messages;
  });

  for (const message of createdMessages) {
    await getMessageQueue().add("send-template-message", {
      messageId: message.id,
      companyId,
    });
  }

  await incrementUsageQuota({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: createdMessages.length,
    idempotencyKey: `campaign-messages-created:${campaign.id}`,
    reason: "campaign-messages-created",
    metadata: {
      campaignId: campaign.id,
      messageCount: createdMessages.length,
    },
  });

  const updatedCampaign = await prisma.campaign.findUnique({
    where: {
      id: campaign.id,
    },
    include: {
      template: true,
      contacts: {
        include: {
          contact: true,
        },
      },
    },
  });

  return updatedCampaign;
}

export async function getCampaignByCompany(
  campaignId: string,
  companyId: string,
) {
  return prisma.campaign.findFirst({
    where: {
      id: campaignId,
      companyId,
    },
    include: {
      template: true,
      contacts: {
        include: {
          contact: true,
          message: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      messages: {
        include: {
          contact: true,
          template: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}
