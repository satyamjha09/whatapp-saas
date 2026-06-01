import { prisma } from "@/lib/prisma";
import { CreateTemplateInput } from "@/server/validators/template.validator";

function extractTemplateVariables(body: string) {
  const matches = body.match(/{{\d+}}/g);

  if (!matches) {
    return [];
  }

  return Array.from(new Set(matches));
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

  return template;
}
