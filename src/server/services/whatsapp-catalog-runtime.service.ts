import { Prisma, type Template } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readTemplateComponentsRecord(template: Template) {
  return isRecord(template.components)
    ? (template.components as Record<string, unknown>)
    : null;
}

export function readTemplateType(template: Template) {
  return stringValue(
    readTemplateComponentsRecord(template)?.templateType,
  ).toUpperCase();
}

export async function buildCatalogTemplateSendMetadata({
  companyId,
  selectedLocalProductIds = [],
  template,
}: {
  companyId: string;
  selectedLocalProductIds?: string[];
  template: Template;
}): Promise<Prisma.InputJsonObject | undefined> {
  if (readTemplateType(template) !== "CATALOG") return undefined;

  const components = readTemplateComponentsRecord(template);
  const catalog = isRecord(components?.catalog) ? components.catalog : null;
  const localCatalogId = stringValue(catalog?.localCatalogId);

  if (!localCatalogId) {
    throw new Error("Catalog template is missing its connected catalog");
  }

  const catalogRecord = await prisma.whatsAppCatalog.findFirst({
    where: {
      companyId,
      id: localCatalogId,
    },
    select: {
      id: true,
      isUsable: true,
      metaCatalogId: true,
      name: true,
      remoteMissingAt: true,
      status: true,
    },
  });

  if (!catalogRecord) {
    throw new Error("Catalog template is connected to a missing catalog");
  }

  if (
    !catalogRecord.isUsable ||
    catalogRecord.remoteMissingAt ||
    !catalogRecord.metaCatalogId
  ) {
    throw new Error("Catalog is not available for sending");
  }

  const uniqueProductIds = Array.from(
    new Set(selectedLocalProductIds.map((value) => value.trim()).filter(Boolean)),
  );
  const products =
    uniqueProductIds.length > 0
      ? await prisma.whatsAppCatalogProduct.findMany({
          where: {
            catalogId: catalogRecord.id,
            companyId,
            id: { in: uniqueProductIds },
          },
          select: {
            id: true,
            isUsable: true,
            name: true,
            remoteMissingAt: true,
            retailerId: true,
          },
        })
      : [];

  if (products.length !== uniqueProductIds.length) {
    throw new Error("One or more selected catalog products were not found");
  }

  const unavailableProduct = products.find(
    (product) =>
      !product.isUsable || product.remoteMissingAt || !product.retailerId,
  );

  if (unavailableProduct) {
    throw new Error("One or more selected catalog products are not available");
  }

  return {
    catalog: {
      localCatalogId: catalogRecord.id,
      metaCatalogId: catalogRecord.metaCatalogId,
      name: catalogRecord.name,
      status: catalogRecord.status,
    },
    messageType: "CATALOG_TEMPLATE",
    mode: "CATALOG_OPEN",
    retailerIds: products.map((product) => product.retailerId).filter(Boolean),
    selectedLocalProductIds: uniqueProductIds,
  };
}
