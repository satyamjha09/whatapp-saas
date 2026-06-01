import { messageQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { SendTemplateMessageInput } from "@/server/validators/message.validator";

function renderTemplateBody(body: string, variables: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    const value = variables[Number(index) - 1];

    return value ?? `{{${index}}}`;
  });
}

export async function getMessagesByCompany(companyId: string) {
  return prisma.message.findMany({
    where: {
      companyId,
    },
    include: {
      contact: true,
      template: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createQueuedTemplateMessage(
  companyId: string,
  input: SendTemplateMessageInput,
) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: input.contactId,
      companyId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const template = await prisma.template.findFirst({
    where: {
      id: input.templateId,
      companyId,
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

  const toPhoneNumber = `${contact.countryCode}${contact.phoneNumber}`;
  const body = renderTemplateBody(template.body, input.variables);

  const message = await prisma.message.create({
    data: {
      companyId,
      contactId: contact.id,
      templateId: template.id,
      toPhoneNumber,
      body,
      variables: input.variables,
      status: "QUEUED",
      direction: "OUTBOUND",
      events: {
        create: {
          companyId,
          status: "QUEUED",
          raw: {
            source: "api",
            reason: "Template message queued",
          },
        },
      },
    },
    include: {
      contact: true,
      template: true,
      events: true,
    },
  });

  await messageQueue.add("send-template-message", {
    messageId: message.id,
    companyId,
  });

  return message;
}
