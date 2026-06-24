import { prisma } from "@/lib/prisma";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { CreateTemplateInput } from "@/server/validators/template.validator";

function extractTemplateVariables(body: string) {
  const matches = body.match(/{{\d+}}/g);

  if (!matches) {
    return [];
  }

  return Array.from(new Set(matches)).sort((left, right) => {
    return Number(left.slice(2, -2)) - Number(right.slice(2, -2));
  });
}

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

  const variables = extractTemplateVariables(input.body);

  const template = await prisma.template.create({
    data: {
      companyId,
      name: input.name,
      language: input.language,
      category: input.category,
      body: input.body,
      variables,
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
