import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { serializeTemplateVariables } from "@/lib/whatsapp-template/template-variable-parser";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { CreateTemplateInput } from "@/server/validators/template.validator";

export async function getTemplatesByCompany(companyId: string) {
  return prisma.template.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createTemplateForCompany(
  companyId: string,
  input: CreateTemplateInput,
) {
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "TEMPLATES",
    amount: 1,
  });

  const templateLike = {
    body: input.body,
    components: input.components,
  };
  const variables = serializeTemplateVariables(templateLike);

  const template = await prisma.template.create({
    data: {
      companyId,
      name: input.name,
      language: input.language,
      category: input.category,
      body: input.body,
      variables,
      components: input.components
        ? (JSON.parse(JSON.stringify(input.components)) as Prisma.InputJsonValue)
        : undefined,
      status: "DRAFT",
    },
  });

  await incrementUsageQuota({
    companyId,
    featureKey: "TEMPLATES",
    amount: 1,
    idempotencyKey: `template-created:${template.id}`,
    reason: "template-created",
    metadata: {
      templateId: template.id,
    },
  });

  return template;
}
