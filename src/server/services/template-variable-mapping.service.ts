import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { extractVariablesFromText } from "@/lib/whatsapp-template/template-variable-parser";
import { createAuditLog } from "@/server/services/audit.service";
import { getSegmentContactsForCampaign } from "@/server/services/contact-segment-builder.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class TemplateVariableMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateVariableMappingError";
  }
}

export type MappingInput = {
  variableKey: string;
  source: "CONTACT_FIELD" | "CUSTOM_FIELD" | "STATIC_VALUE" | "SYSTEM_VALUE";
  contactField?: string | null;
  customFieldKey?: string | null;
  staticValue?: string | null;
  systemValueKey?: string | null;
  fallbackValue?: string | null;
  isRequired?: boolean;
};

type SegmentContact = Awaited<ReturnType<typeof getSegmentContactsForCampaign>>[number];

function isEnabled() {
  return process.env.TEMPLATE_VARIABLE_MAPPING_ENABLED !== "false";
}

function requireAllVariables() {
  return process.env.TEMPLATE_VARIABLE_MAPPING_REQUIRE_ALL_VARIABLES !== "false";
}

function sampleCount() {
  const value = Number(process.env.TEMPLATE_VARIABLE_MAPPING_SAMPLE_COUNT ?? 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

export function parseTemplateVariables(body: string) {
  return extractVariablesFromText(body).map((variable) => variable.variableName);
}

function getContactValue(contact: SegmentContact, field?: string | null) {
  if (!field) return null;
  const value = (contact as unknown as Record<string, unknown>)[field];
  return value ?? null;
}

function getSystemValue(key?: string | null) {
  if (!key) return null;
  if (key === "today") return new Date().toISOString().slice(0, 10);
  if (key === "current_month") {
    return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
  }
  if (key === "company_name") return process.env.NEXT_PUBLIC_APP_NAME || "metawhat";
  return null;
}

function resolveMappingValue(contact: SegmentContact, mapping: MappingInput) {
  let value: unknown = null;

  if (mapping.source === "CONTACT_FIELD") value = getContactValue(contact, mapping.contactField);
  if (mapping.source === "STATIC_VALUE") value = mapping.staticValue ?? null;
  if (mapping.source === "SYSTEM_VALUE") value = getSystemValue(mapping.systemValueKey);
  if (mapping.source === "CUSTOM_FIELD") value = null;

  const rendered = value === null || value === undefined || value === "" ? mapping.fallbackValue : value;

  if ((rendered === null || rendered === undefined || rendered === "") && mapping.isRequired !== false) {
    throw new TemplateVariableMappingError(`Missing required value for {{${mapping.variableKey}}}.`);
  }

  return String(rendered ?? "");
}

function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (token, key: string) => values[key] ?? token);
}

function toOrderedBodyParameters(templateVariables: string[], values: Record<string, string>) {
  return templateVariables.map((variable) => values[variable] ?? "");
}

async function loadSavedMappings(input: {
  companyId: string;
  templateName: string;
  templateLanguage?: string | null;
  segmentId?: string | null;
}) {
  return prisma.templateVariableMapping.findMany({
    where: {
      companyId: input.companyId,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage ?? null,
      segmentId: input.segmentId ?? null,
      status: "ACTIVE",
    },
    orderBy: { variableKey: "asc" },
  });
}

function normalizeSavedMappings(mappings: Awaited<ReturnType<typeof loadSavedMappings>>): MappingInput[] {
  return mappings.map((mapping) => ({
    variableKey: mapping.variableKey,
    source: mapping.source,
    contactField: mapping.contactField,
    customFieldKey: mapping.customFieldKey,
    staticValue: mapping.staticValue,
    systemValueKey: mapping.systemValueKey,
    fallbackValue: mapping.fallbackValue,
    isRequired: mapping.isRequired,
  }));
}

function assertMappingsCoverVariables(templateVariables: string[], mappings: MappingInput[]) {
  if (!requireAllVariables()) return;

  const mapped = new Set(mappings.map((mapping) => mapping.variableKey));
  const missing = templateVariables.filter((variable) => !mapped.has(variable));

  if (missing.length > 0) {
    throw new TemplateVariableMappingError(`Missing mapping for template variable(s): ${missing.join(", ")}.`);
  }
}

export async function saveTemplateVariableMappings(input: {
  companyId: string;
  actorUserId?: string | null;
  templateId?: string | null;
  templateName: string;
  templateLanguage?: string | null;
  segmentId?: string | null;
  mappings: MappingInput[];
}) {
  if (!isEnabled()) throw new TemplateVariableMappingError("Template Variable Mapping is disabled.");
  if (!input.templateName.trim()) throw new TemplateVariableMappingError("Template name is required.");

  const saved = await prisma.$transaction(async (tx) => {
    await tx.templateVariableMapping.updateMany({
      where: {
        companyId: input.companyId,
        templateName: input.templateName,
        templateLanguage: input.templateLanguage ?? null,
        segmentId: input.segmentId ?? null,
      },
      data: { status: "DISABLED" },
    });

    const rows = [];
    for (const mapping of input.mappings) {
      rows.push(
        await tx.templateVariableMapping.create({
          data: {
            companyId: input.companyId,
            createdByUserId: input.actorUserId ?? null,
            templateId: input.templateId ?? null,
            templateName: input.templateName,
            templateLanguage: input.templateLanguage ?? null,
            segmentId: input.segmentId ?? null,
            variableKey: mapping.variableKey.trim(),
            source: mapping.source,
            contactField: mapping.contactField?.trim() || null,
            customFieldKey: mapping.customFieldKey?.trim() || null,
            staticValue: mapping.staticValue ?? null,
            systemValueKey: mapping.systemValueKey?.trim() || null,
            fallbackValue: mapping.fallbackValue ?? null,
            isRequired: mapping.isRequired ?? true,
          },
        }),
      );
    }

    return rows;
  });

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "template.variable_mapping_saved",
    entityType: "TemplateVariableMapping",
    metadata: safeJson({
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      segmentId: input.segmentId,
      mappingCount: input.mappings.length,
    }),
  }).catch(() => undefined);

  return saved;
}

export async function previewTemplateVariableMapping(input: {
  companyId: string;
  templateName: string;
  templateLanguage?: string | null;
  templateBody: string;
  segmentId: string;
}) {
  if (!isEnabled()) throw new TemplateVariableMappingError("Template Variable Mapping is disabled.");

  const templateVariables = parseTemplateVariables(input.templateBody);
  const mappings = normalizeSavedMappings(
    await loadSavedMappings({
      companyId: input.companyId,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      segmentId: input.segmentId,
    }),
  );

  assertMappingsCoverVariables(templateVariables, mappings);

  const contacts = await getSegmentContactsForCampaign({
    companyId: input.companyId,
    segmentId: input.segmentId,
    limit: sampleCount(),
  });

  const previews = contacts.map((contact) => {
    const values: Record<string, string> = {};

    for (const mapping of mappings) {
      values[mapping.variableKey] = resolveMappingValue(contact, mapping);
    }

    return {
      contactId: contact.id,
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      values,
      bodyParameters: toOrderedBodyParameters(templateVariables, values),
      renderedBody: renderTemplate(input.templateBody, values),
    };
  });

  return {
    templateVariables,
    sampleCount: previews.length,
    previews,
  };
}

export async function buildCampaignRecipientsFromSegmentAndMapping(input: {
  companyId: string;
  segmentId: string;
  templateName: string;
  templateLanguage?: string | null;
  templateBody: string;
  limit?: number;
}) {
  if (!isEnabled()) throw new TemplateVariableMappingError("Template Variable Mapping is disabled.");

  const templateVariables = parseTemplateVariables(input.templateBody);
  const mappings = normalizeSavedMappings(
    await loadSavedMappings({
      companyId: input.companyId,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      segmentId: input.segmentId,
    }),
  );

  assertMappingsCoverVariables(templateVariables, mappings);

  const contacts = await getSegmentContactsForCampaign({
    companyId: input.companyId,
    segmentId: input.segmentId,
    limit: input.limit,
  });

  return contacts.map((contact) => {
    const values: Record<string, string> = {};

    for (const mapping of mappings) {
      values[mapping.variableKey] = resolveMappingValue(contact, mapping);
    }

    return {
      contactId: contact.id,
      countryCode: contact.countryCode,
      phoneNumber: contact.phoneNumber,
      phone: `${contact.countryCode}${contact.phoneNumber}`,
      name: contact.name ?? undefined,
      isBlocked: contact.isBlocked,
      variables: values,
      renderedBody: renderTemplate(input.templateBody, values),
      bodyParameters: toOrderedBodyParameters(templateVariables, values),
    };
  });
}

export async function getTemplateVariableMappingHealth() {
  const [activeMappings, disabledMappings, grouped] = await Promise.all([
    prisma.templateVariableMapping.count({ where: { status: "ACTIVE" } }),
    prisma.templateVariableMapping.count({ where: { status: "DISABLED" } }),
    prisma.templateVariableMapping.groupBy({
      by: ["companyId", "templateName", "templateLanguage"],
      where: { status: "ACTIVE" },
    }),
  ]);

  return {
    enabled: isEnabled(),
    activeMappings,
    disabledMappings,
    mappedTemplates: grouped.length,
    isHealthy: isEnabled(),
  };
}
