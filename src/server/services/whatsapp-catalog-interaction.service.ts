import { prisma } from "@/lib/prisma";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import type { Prisma } from "@/generated/prisma/client";

type JsonRecord = Record<string, unknown>;

type CatalogInteractionProduct = {
  currency: string | null;
  quantity: number | null;
  retailerId: string;
};

type CatalogInteraction = {
  contextMetaMessageId: string | null;
  interactionType: "ORDER" | "PRODUCT_REPLY";
  metaCatalogId: string | null;
  products: CatalogInteractionProduct[];
};

type CatalogRuntimeMetadata = {
  catalog: {
    localCatalogId: string;
    metaCatalogId: string;
  };
  messageType: "CATALOG_TEMPLATE";
  retailerIds: string[];
  selectedLocalProductIds: string[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function getContextMetaMessageId(message: JsonRecord) {
  const context = asRecord(message.context);
  return stringValue(context?.id) || null;
}

function readCatalogRuntimeMetadata(
  metadata: unknown,
): CatalogRuntimeMetadata | null {
  const record = asRecord(metadata);
  const catalog = asRecord(record?.catalog);

  if (
    record?.messageType !== "CATALOG_TEMPLATE" ||
    !catalog ||
    typeof catalog.localCatalogId !== "string" ||
    typeof catalog.metaCatalogId !== "string"
  ) {
    return null;
  }

  return {
    catalog: {
      localCatalogId: catalog.localCatalogId,
      metaCatalogId: catalog.metaCatalogId,
    },
    messageType: "CATALOG_TEMPLATE",
    retailerIds: Array.isArray(record.retailerIds)
      ? record.retailerIds.filter((value): value is string => typeof value === "string")
      : [],
    selectedLocalProductIds: Array.isArray(record.selectedLocalProductIds)
      ? record.selectedLocalProductIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

export function parseWhatsAppCatalogInteraction(
  message: JsonRecord,
): CatalogInteraction | null {
  if (message.type === "interactive") {
    const interactive = asRecord(message.interactive);
    const productReply = asRecord(interactive?.product_reply);
    const retailerId = stringValue(productReply?.product_retailer_id);

    if (interactive?.type === "product_reply" && retailerId) {
      return {
        contextMetaMessageId: getContextMetaMessageId(message),
        interactionType: "PRODUCT_REPLY",
        metaCatalogId: stringValue(productReply?.catalog_id) || null,
        products: [{ currency: null, quantity: null, retailerId }],
      };
    }
  }

  if (message.type === "order") {
    const order = asRecord(message.order);
    const productItems = Array.isArray(order?.product_items)
      ? order.product_items
      : [];
    const products = productItems
      .map((item) => {
        const product = asRecord(item);
        const retailerId = stringValue(product?.product_retailer_id);
        if (!retailerId) return null;

        return {
          currency: stringValue(product?.currency) || null,
          quantity: numberValue(product?.quantity),
          retailerId,
        };
      })
      .filter((product): product is CatalogInteractionProduct =>
        Boolean(product),
      );

    if (products.length > 0) {
      return {
        contextMetaMessageId: getContextMetaMessageId(message),
        interactionType: "ORDER",
        metaCatalogId: stringValue(order?.catalog_id) || null,
        products,
      };
    }
  }

  return null;
}

function createReadableCatalogBody({
  interaction,
  resolvedProducts,
}: {
  interaction: CatalogInteraction;
  resolvedProducts: Array<{
    name: string;
    retailerId: string | null;
  }>;
}) {
  const productLines = interaction.products.map((product) => {
    const resolved = resolvedProducts.find(
      (item) => item.retailerId === product.retailerId,
    );
    const name = resolved?.name ?? "Unknown catalog product";
    const quantity =
      interaction.interactionType === "ORDER" && product.quantity
        ? ` x ${product.quantity}`
        : "";

    return `${name}${quantity}\nRetailer ID: ${product.retailerId}`;
  });

  return [
    interaction.interactionType === "ORDER"
      ? "Customer sent a catalog order:"
      : "Customer selected a catalog product:",
    ...productLines,
  ].join("\n\n");
}

export async function recordWhatsAppCatalogInteraction({
  companyId,
  contactId,
  inboundMessageId,
  providerMessageId,
  rawMessage,
}: {
  companyId: string;
  contactId: string;
  inboundMessageId: string;
  providerMessageId: string;
  rawMessage: JsonRecord;
}) {
  const interaction = parseWhatsAppCatalogInteraction(rawMessage);

  if (!interaction) return null;

  const outboundMessage = interaction.contextMetaMessageId
    ? await prisma.message.findFirst({
        where: {
          companyId,
          contactId,
          direction: "OUTBOUND",
          metaMessageId: interaction.contextMetaMessageId,
        },
        select: {
          id: true,
          metadata: true,
        },
      })
    : null;
  const runtime = readCatalogRuntimeMetadata(outboundMessage?.metadata);
  const catalog =
    runtime &&
    (!interaction.metaCatalogId ||
      interaction.metaCatalogId === runtime.catalog.metaCatalogId)
      ? await prisma.whatsAppCatalog.findFirst({
          where: {
            companyId,
            id: runtime.catalog.localCatalogId,
            metaCatalogId: runtime.catalog.metaCatalogId,
          },
          select: {
            id: true,
            metaCatalogId: true,
            name: true,
          },
        })
      : null;
  const retailerIds = interaction.products.map((product) => product.retailerId);
  const resolvedProducts = catalog
    ? await prisma.whatsAppCatalogProduct.findMany({
        where: {
          catalogId: catalog.id,
          companyId,
          retailerId: {
            in: retailerIds,
          },
        },
        select: {
          id: true,
          name: true,
          retailerId: true,
        },
      })
    : [];
  const resolvedRetailerIds = new Set(
    resolvedProducts
      .map((product) => product.retailerId)
      .filter((value): value is string => Boolean(value)),
  );
  const unresolvedRetailerIds = retailerIds.filter(
    (retailerId) => !resolvedRetailerIds.has(retailerId),
  );
  const readableBody = createReadableCatalogBody({
    interaction,
    resolvedProducts,
  });
  const currentInboundMessage = await prisma.message.findFirst({
    where: {
      companyId,
      id: inboundMessageId,
    },
    select: {
      metadata: true,
    },
  });
  const catalogInteractionMetadata = {
    contextMetaMessageId: interaction.contextMetaMessageId,
    inboundMessageId,
    interactionType: interaction.interactionType,
    localCatalogId: catalog?.id ?? runtime?.catalog.localCatalogId ?? null,
    localProductIds: resolvedProducts.map((product) => product.id),
    metaCatalogId:
      catalog?.metaCatalogId ??
      runtime?.catalog.metaCatalogId ??
      interaction.metaCatalogId,
    outboundMessageId: outboundMessage?.id ?? null,
    products: interaction.products.map((product) => {
      const resolved = resolvedProducts.find(
        (item) => item.retailerId === product.retailerId,
      );

      return {
        localProductId: resolved?.id ?? null,
        name: resolved?.name ?? null,
        quantity: product.quantity,
        retailerId: product.retailerId,
      };
    }),
    retailerIds,
    unresolvedRetailerIds,
  } satisfies Prisma.InputJsonObject;
  const messageMetadata = {
    ...(asRecord(currentInboundMessage?.metadata) ?? {}),
    catalogInteraction: catalogInteractionMetadata,
  } satisfies Prisma.InputJsonObject;
  const dedupeKey = [
    "catalog_interaction",
    companyId,
    providerMessageId,
    interaction.interactionType,
    retailerIds.join(","),
  ].join(":");

  await prisma.message.update({
    where: {
      id: inboundMessageId,
    },
    data: {
      body: readableBody,
      metadata: messageMetadata,
    },
  });

  await recordContactActivity({
    companyId,
    contactId,
    type: "MESSAGE_INBOUND",
    title:
      interaction.interactionType === "ORDER"
        ? "Sent catalog order"
        : "Selected catalog product",
    description: readableBody,
    dedupeKey,
    metadata: catalogInteractionMetadata,
  });

  return {
    body: readableBody,
    catalogId: catalog?.id ?? null,
    interactionType: interaction.interactionType,
    productIds: resolvedProducts.map((product) => product.id),
    unresolvedRetailerIds,
  };
}
