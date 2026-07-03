import type {
  Template,
  TemplateCategory,
  TemplateStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTemplatePreview } from "@/lib/automation-builder/template-preview";
import { extractTemplateVariables } from "@/lib/automation-builder/template-variables";
import type { AutomationTemplateQuery } from "@/server/validators/automation-template.validator";

function toAutomationTemplateDto(template: Template) {
  const variableMetadata = extractTemplateVariables(template);
  const preview = buildTemplatePreview(template);

  return {
    body: template.body,
    category: template.category,
    components: template.components,
    id: template.id,
    languageCode: template.language,
    name: template.name,
    preview,
    status: template.status,
    variableMetadata,
  };
}

export async function listAutomationTemplates({
  category,
  companyId,
  languageCode,
  limit,
  search,
  status,
}: AutomationTemplateQuery & { companyId: string }) {
  const templates = await prisma.template.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
    where: {
      category: category as TemplateCategory | undefined,
      companyId,
      language: languageCode,
      status: status as TemplateStatus,
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                body: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
  });

  return templates.map(toAutomationTemplateDto);
}

export async function getAutomationTemplateDetails({
  companyId,
  templateId,
}: {
  companyId: string;
  templateId: string;
}) {
  const template = await prisma.template.findFirst({
    where: {
      companyId,
      id: templateId,
      status: "APPROVED",
    },
  });

  return template ? toAutomationTemplateDto(template) : null;
}
