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
import { getTemplateMediaAssetForCompany } from "@/server/services/template-media-asset.service";
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
  const storedComponents = buildStoredTemplateComponents({
    body: input.body,
    components: hydratedInputComponents,
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
