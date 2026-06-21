import { messageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
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

  const requiredBalancePaise = pendingContacts.length * MESSAGE_PRICE_PAISE;
  const wallet = await prisma.wallet.findUnique({
    where: {
      companyId,
    },
  });

  if (!wallet || wallet.balancePaise < requiredBalancePaise) {
    throw new Error("Insufficient wallet balance");
  }

  const createdMessages = [];

  for (const campaignContact of pendingContacts) {
    const toPhoneNumber = `${campaignContact.contact.countryCode}${campaignContact.contact.phoneNumber}`;

    const body = renderTemplateBody(
      campaign.template.body,
      campaignContact.variables,
    );

    const message = await prisma.$transaction(async (tx) => {
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

      await tx.wallet.update({
        where: {
          companyId,
        },
        data: {
          balancePaise: {
            decrement: MESSAGE_PRICE_PAISE,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          companyId,
          type: "DEBIT",
          status: "SUCCESS",
          amountPaise: MESSAGE_PRICE_PAISE,
          description: "Campaign message queued",
          referenceId: createdMessage.id,
        },
      });

      return createdMessage;
    });

    createdMessages.push(message);
  }

  await prisma.campaign.update({
    where: {
      id: campaign.id,
    },
    data: {
      status: "RUNNING",
      queuedCount: {
        increment: createdMessages.length,
      },
    },
  });

  for (const message of createdMessages) {
    await messageQueue.add("send-template-message", {
      messageId: message.id,
      companyId,
    });
  }

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
