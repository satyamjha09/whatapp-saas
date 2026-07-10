import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  buildStoredTemplateComponents,
  buildTemplateVariableKeys,
} from "@/lib/whatsapp-template/template-definition";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { recordTemplateLifecycleEvent } from "@/server/services/template-lifecycle.service";
import { getTemplateMediaAssetForCompany } from "@/server/services/template-media-asset.service";
import { isFlowUsableForTemplate } from "@/server/services/whatsapp-flow.service";
import { CreateTemplateInput } from "@/server/validators/template.validator";

export class TemplateDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateDraftError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function hydrateTemplateMediaComponents({
  companyId,
  components,
}: {
  companyId: string;
  components: unknown;
}) {
  if (!isRecord(components) || !Array.isArray(components.components)) {
    return components;
  }

  const hydratedComponents = await Promise.all(
    components.components.map(async (component) => {
      if (!isRecord(component)) return component;
      const type = String(component.type ?? "").toUpperCase();
      const format = String(component.format ?? "").toUpperCase();

      if (
        type !== "HEADER" ||
        !["IMAGE", "VIDEO", "DOCUMENT"].includes(format)
      ) {
        return component;
      }

      const mediaAssetId = String(component.mediaAssetId ?? "").trim();

      if (!mediaAssetId) {
        throw new TemplateDraftError("Media header requires an uploaded media asset.");
      }

      const asset = await getTemplateMediaAssetForCompany({
        companyId,
        mediaAssetId,
      });

      if (!asset) {
        throw new TemplateDraftError("Selected media asset was not found for this workspace.");
      }

      if (asset.mediaType !== format) {
        throw new TemplateDraftError("Selected media asset type does not match the header type.");
      }

      if (!asset.metaHandle) {
        throw new TemplateDraftError(
          "Selected media asset is missing a Meta-compatible review handle. Upload the media again after connecting WhatsApp and configuring META_APP_ID.",
        );
      }

      return {
        ...component,
        example: {
          header_handle: [asset.metaHandle],
        },
        fileName: asset.fileName,
        mediaAssetId: asset.id,
        mediaUrl: asset.publicUrl,
        mimeType: asset.mimeType,
        publicUrl: asset.publicUrl,
        sizeBytes: asset.sizeBytes,
        metaHandle: asset.metaHandle,
      };
    }),
  );

  return {
    ...components,
    components: hydratedComponents,
  };
}

async function hydrateFlowTemplateComponents({
  companyId,
  components,
}: {
  companyId: string;
  components: unknown;
}) {
  if (!isRecord(components) || components.templateType !== "FLOWS") {
    return components;
  }

  const flowConfig = isRecord(components.flow) ? components.flow : {};
  const localFlowId =
    typeof flowConfig.localFlowId === "string" ? flowConfig.localFlowId.trim() : "";

  if (!localFlowId) {
    throw new TemplateDraftError("Select a published WhatsApp Flow.");
  }

  const flow = await prisma.whatsAppFlow.findFirst({
    where: {
      companyId,
      id: localFlowId,
    },
    select: {
      defaultScreen: true,
      id: true,
      isUsableForTemplates: true,
      metaFlowId: true,
      name: true,
      remoteMissingAt: true,
      remoteStatus: true,
      status: true,
    },
  });

  if (!flow || !isFlowUsableForTemplate(flow)) {
    throw new TemplateDraftError("Selected Flow was not found or is not published.");
  }

  if (!flow.metaFlowId) {
    throw new TemplateDraftError("Selected Flow is missing its Meta Flow ID.");
  }

  const action =
    String(flowConfig.action ?? "").toUpperCase() === "DATA_EXCHANGE"
      ? "DATA_EXCHANGE"
      : "NAVIGATE";
  const buttonText =
    typeof flowConfig.buttonText === "string" && flowConfig.buttonText.trim()
      ? flowConfig.buttonText.trim()
      : "Complete form";
  const navigateScreen =
    typeof flowConfig.navigateScreen === "string" && flowConfig.navigateScreen.trim()
      ? flowConfig.navigateScreen.trim()
      : flow.defaultScreen;

  const hydratedComponents = Array.isArray(components.components)
    ? components.components.map((component) => {
        if (
          !isRecord(component) ||
          String(component.type ?? "").toUpperCase() !== "BUTTONS" ||
          !Array.isArray(component.buttons)
        ) {
          return component;
        }

        return {
          ...component,
          buttons: component.buttons.map((button) => {
            if (
              !isRecord(button) ||
              String(button.type ?? "").toUpperCase() !== "FLOW"
            ) {
              return button;
            }

            const { flowToken, flow_token: flowTokenSnake, ...safeButton } = button;
            void flowToken;
            void flowTokenSnake;

            return {
              ...safeButton,
              flowAction: action,
              flowId: flow.metaFlowId,
              navigateScreen: navigateScreen || undefined,
              text: buttonText,
              type: "FLOW",
            };
          }),
        };
      })
    : components.components;

  return {
    ...components,
    components: hydratedComponents,
    flow: {
      action,
      buttonText,
      localFlowId: flow.id,
      metaFlowId: flow.metaFlowId,
      name: flow.name,
      navigateScreen: navigateScreen || null,
      status: flow.status,
    },
    templateType: "FLOWS",
  };
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

  const hydratedInputComponents = await hydrateTemplateMediaComponents({
    companyId,
    components: input.components,
  });
  const hydratedFlowComponents = await hydrateFlowTemplateComponents({
    companyId,
    components: hydratedInputComponents,
  });
  const storedComponents = buildStoredTemplateComponents({
    body: input.body,
    components: hydratedFlowComponents,
    templateType: input.templateType,
  });
  const variables = buildTemplateVariableKeys({
    body: input.body,
    components: storedComponents,
  });

  const template = await prisma.template.create({
    data: {
      companyId,
      name: input.name,
      language: input.language,
      category: input.category,
      body: input.body,
      variables,
      components: JSON.parse(JSON.stringify(storedComponents)) as Prisma.InputJsonValue,
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

async function buildDuplicateTemplateName(companyId: string, sourceName: string) {
  const baseName = `${sourceName}_copy`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 480);

  for (let index = 1; index <= 50; index += 1) {
    const candidate = index === 1 ? baseName : `${baseName}_${index}`;
    const existing = await prisma.template.findFirst({
      where: {
        companyId,
        name: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing) return candidate;
  }

  return `${baseName}_${Date.now()}`;
}

export async function duplicateTemplateForCompany({
  actorUserId,
  companyId,
  templateId,
}: {
  actorUserId: string;
  companyId: string;
  templateId: string;
}) {
  const sourceTemplate = await prisma.template.findFirst({
    where: {
      companyId,
      id: templateId,
    },
  });

  if (!sourceTemplate) {
    throw new Error("Template not found");
  }

  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "TEMPLATES",
    amount: 1,
  });

  const duplicate = await prisma.template.create({
    data: {
      companyId,
      name: await buildDuplicateTemplateName(companyId, sourceTemplate.name),
      language: sourceTemplate.language,
      category: sourceTemplate.category,
      body: sourceTemplate.body,
      variables: sourceTemplate.variables,
      components: sourceTemplate.components ?? undefined,
      status: "DRAFT",
    },
  });

  await incrementUsageQuota({
    companyId,
    featureKey: "TEMPLATES",
    amount: 1,
    idempotencyKey: `template-created:${duplicate.id}`,
    reason: "template-duplicated",
    metadata: {
      sourceTemplateId: sourceTemplate.id,
      templateId: duplicate.id,
    },
  });

  await recordTemplateLifecycleEvent({
    actorUserId,
    companyId,
    eventType: "DUPLICATED",
    newStatus: "DRAFT",
    payload: {
      sourceTemplateId: sourceTemplate.id,
    },
    source: "APP",
    templateId: duplicate.id,
  });

  return duplicate;
}

export async function archiveTemplateForCompany({
  actorUserId,
  companyId,
  templateId,
}: {
  actorUserId: string;
  companyId: string;
  templateId: string;
}) {
  const template = await prisma.template.findFirst({
    where: {
      companyId,
      id: templateId,
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (template.status === "APPROVED") {
    throw new Error("Approved templates must be paused or disabled in Meta before local archive");
  }

  const archivedTemplate = await prisma.template.update({
    where: {
      id: template.id,
    },
    data: {
      status: "DISABLED",
    },
  });

  await recordTemplateLifecycleEvent({
    actorUserId,
    companyId,
    eventType: "ARCHIVED_LOCALLY",
    newStatus: archivedTemplate.status,
    previousStatus: template.status,
    source: "APP",
    templateId: template.id,
  });

  return archivedTemplate;
}

export async function deleteDraftTemplateForCompany({
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
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (!["DRAFT", "REJECTED", "DISABLED"].includes(template.status)) {
    throw new Error("Only draft, rejected, or locally archived templates can be deleted");
  }

  await prisma.template.delete({
    where: {
      id: template.id,
    },
  });
}
