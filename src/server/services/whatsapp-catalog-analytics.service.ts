import {
  safePercent,
  WHATSAPP_CATALOG_ANALYTICS_METRICS,
} from "@/lib/whatsapp-catalog-analytics";
import { prisma } from "@/lib/prisma";
import type { WhatsAppCatalogAnalyticsQuery } from "@/server/validators/whatsapp-catalog-analytics.validator";

const DAY_MS = 24 * 60 * 60 * 1000;
const DELIVERED_STATUSES = new Set(["DELIVERED", "READ"]);
const READ_STATUSES = new Set(["READ"]);

type CatalogSentEvent = Awaited<ReturnType<typeof loadSentEvents>>[number];
type CatalogInboundMessage = Awaited<ReturnType<typeof loadInboundMessages>>[number];
type CatalogMessageMetadata = {
  catalog: {
    localCatalogId: string;
    metaCatalogId: string;
    name?: string | null;
  };
  isAutomation: boolean;
  retailerIds: string[];
  selectedLocalProductIds: string[];
};
type CatalogInteractionMetadata = {
  inboundMessageId?: string | null;
  interactionType: "ORDER" | "PRODUCT_REPLY";
  localCatalogId?: string | null;
  localProductIds: string[];
  metaCatalogId?: string | null;
  outboundMessageId?: string | null;
  products: Array<{
    localProductId: string | null;
    name: string | null;
    quantity: number | null;
    retailerId: string | null;
  }>;
  retailerIds: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readCatalogMessageMetadata(metadata: unknown): CatalogMessageMetadata | null {
  const record = asRecord(metadata);
  const catalog = asRecord(record.catalog);
  const localCatalogId = stringValue(catalog.localCatalogId);
  const metaCatalogId = stringValue(catalog.metaCatalogId);

  if (record.messageType !== "CATALOG_TEMPLATE" || !localCatalogId || !metaCatalogId) {
    return null;
  }

  return {
    catalog: {
      localCatalogId,
      metaCatalogId,
      name: stringValue(catalog.name) || null,
    },
    isAutomation:
      stringValue(record.source) === "automation_runtime" ||
      Boolean(stringValue(record.automationExecutionId)),
    retailerIds: stringArray(record.retailerIds),
    selectedLocalProductIds: stringArray(record.selectedLocalProductIds),
  };
}

function readCatalogInteractionMetadata(
  metadata: unknown,
): CatalogInteractionMetadata | null {
  const interaction = asRecord(asRecord(metadata).catalogInteraction);
  const interactionType = stringValue(interaction.interactionType);

  if (!["ORDER", "PRODUCT_REPLY"].includes(interactionType)) return null;

  const products = Array.isArray(interaction.products)
    ? interaction.products.map((item) => {
        const product = asRecord(item);

        return {
          localProductId: stringValue(product.localProductId) || null,
          name: stringValue(product.name) || null,
          quantity:
            typeof product.quantity === "number" && Number.isFinite(product.quantity)
              ? product.quantity
              : null,
          retailerId: stringValue(product.retailerId) || null,
        };
      })
    : [];

  return {
    inboundMessageId: stringValue(interaction.inboundMessageId) || null,
    interactionType: interactionType as CatalogInteractionMetadata["interactionType"],
    localCatalogId: stringValue(interaction.localCatalogId) || null,
    localProductIds: stringArray(interaction.localProductIds),
    metaCatalogId: stringValue(interaction.metaCatalogId) || null,
    outboundMessageId: stringValue(interaction.outboundMessageId) || null,
    products,
    retailerIds: stringArray(interaction.retailerIds),
  };
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function resolveDateRange(filters: WhatsAppCatalogAnalyticsQuery) {
  const endDate = filters.endDate ?? endOfUtcDay(new Date());

  if (filters.range === "custom" && filters.startDate && filters.endDate) {
    return {
      endDate: filters.endDate,
      startDate: filters.startDate,
    };
  }

  const days = filters.range === "7d" ? 7 : filters.range === "90d" ? 90 : 30;
  const end = endOfUtcDay(endDate);
  const start = startOfUtcDay(new Date(end.getTime() - (days - 1) * DAY_MS));

  return {
    endDate: end,
    startDate: start,
  };
}

async function loadSentEvents(companyId: string, startDate: Date, endDate: Date) {
  return prisma.messageEvent.findMany({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      message: {
        select: {
          createdAt: true,
          events: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              createdAt: true,
              status: true,
            },
          },
          id: true,
          metadata: true,
          status: true,
          template: {
            select: {
              id: true,
              language: true,
              name: true,
            },
          },
          templateId: true,
        },
      },
      messageId: true,
    },
    where: {
      companyId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      message: {
        direction: "OUTBOUND",
      },
      status: "SENT",
    },
  });
}

async function loadInboundMessages(companyId: string, startDate: Date, endDate: Date) {
  return prisma.message.findMany({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      id: true,
      metadata: true,
    },
    where: {
      companyId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      direction: "INBOUND",
    },
  });
}

function messageHasStatus(
  sentEvent: CatalogSentEvent,
  statuses: Set<string>,
) {
  if (statuses.has(sentEvent.message.status)) return true;

  return sentEvent.message.events.some((event) => statuses.has(event.status));
}

function firstMessageEventDate(
  sentEvent: CatalogSentEvent,
  statuses: Set<string>,
  startDate: Date,
  endDate: Date,
) {
  return (
    sentEvent.message.events.find(
      (event) =>
        statuses.has(event.status) &&
        event.createdAt >= startDate &&
        event.createdAt <= endDate,
    )?.createdAt ?? null
  );
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildTrendBuckets(startDate: Date, endDate: Date) {
  const buckets = new Map<
    string,
    {
      automationResumed: number;
      date: string;
      delivered: number;
      productInteractions: number;
      read: number;
      sent: number;
    }
  >();
  const cursor = startOfUtcDay(startDate);
  const final = startOfUtcDay(endDate);

  while (cursor <= final) {
    const key = dateKey(cursor);
    buckets.set(key, {
      automationResumed: 0,
      date: key,
      delivered: 0,
      productInteractions: 0,
      read: 0,
      sent: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}

function incrementBucket(
  buckets: ReturnType<typeof buildTrendBuckets>,
  date: Date | null | undefined,
  metric: "automationResumed" | "delivered" | "productInteractions" | "read" | "sent",
) {
  if (!date) return;

  const bucket = buckets.get(dateKey(date));
  if (!bucket) return;

  bucket[metric] += 1;
}

function matchesSource(metadata: CatalogMessageMetadata, source: string) {
  if (source === "ALL") return true;
  if (source === "AUTOMATION") return metadata.isAutomation;
  if (source === "MANUAL") return !metadata.isAutomation;

  return true;
}

function templateTypeFromComponents(components: unknown) {
  return stringValue(asRecord(components).templateType).toUpperCase();
}

export async function getWhatsAppCatalogAnalytics(
  companyId: string,
  filters: WhatsAppCatalogAnalyticsQuery,
) {
  const { endDate, startDate } = resolveDateRange(filters);
  const [rawSentEvents, inboundMessages, catalogs, templates, products] =
    await Promise.all([
      loadSentEvents(companyId, startDate, endDate),
      loadInboundMessages(companyId, startDate, endDate),
      prisma.whatsAppCatalog.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
        where: {
          companyId,
        },
      }),
      prisma.template.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          components: true,
          id: true,
          language: true,
          name: true,
        },
        where: {
          companyId,
        },
      }),
      prisma.whatsAppCatalogProduct.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          catalogId: true,
          id: true,
          name: true,
          retailerId: true,
        },
        where: {
          companyId,
          ...(filters.catalogId ? { catalogId: filters.catalogId } : {}),
        },
        take: 250,
      }),
    ]);

  const sentByMessageId = new Map<string, CatalogSentEvent>();

  for (const event of rawSentEvents) {
    const metadata = readCatalogMessageMetadata(event.message.metadata);

    if (!metadata) continue;
    if (filters.catalogId && metadata.catalog.localCatalogId !== filters.catalogId) {
      continue;
    }
    if (filters.templateId && event.message.templateId !== filters.templateId) {
      continue;
    }
    if (
      filters.productId &&
      !metadata.selectedLocalProductIds.includes(filters.productId)
    ) {
      continue;
    }
    if (!matchesSource(metadata, filters.source)) continue;

    if (!sentByMessageId.has(event.messageId)) {
      sentByMessageId.set(event.messageId, event);
    }
  }

  const sentEvents = Array.from(sentByMessageId.values());
  const outboundIds = new Set(sentEvents.map((event) => event.messageId));
  const interactionCandidates = inboundMessages
    .map((message) => ({
      interaction: readCatalogInteractionMetadata(message.metadata),
      message,
    }))
    .filter(
      (
        item,
      ): item is {
        interaction: CatalogInteractionMetadata;
        message: CatalogInboundMessage;
      } => Boolean(item.interaction),
    );
  const missingOutboundIds = Array.from(
    new Set(
      interactionCandidates
        .map((item) => item.interaction.outboundMessageId)
        .filter((value): value is string => Boolean(value))
        .filter((id) => !outboundIds.has(id)),
    ),
  );
  const linkedOutboundMessages =
    missingOutboundIds.length > 0
      ? await prisma.message.findMany({
          select: {
            id: true,
            metadata: true,
            templateId: true,
          },
          where: {
            companyId,
            direction: "OUTBOUND",
            id: {
              in: missingOutboundIds,
            },
          },
        })
      : [];
  const outboundMetadataById = new Map<string, CatalogMessageMetadata>();

  for (const event of sentEvents) {
    const metadata = readCatalogMessageMetadata(event.message.metadata);
    if (metadata) outboundMetadataById.set(event.messageId, metadata);
  }

  for (const message of linkedOutboundMessages) {
    const metadata = readCatalogMessageMetadata(message.metadata);
    if (metadata) outboundMetadataById.set(message.id, metadata);
  }

  const interactions = interactionCandidates.filter(({ interaction }) => {
    const outboundMetadata = interaction.outboundMessageId
      ? outboundMetadataById.get(interaction.outboundMessageId)
      : null;

    if (!outboundMetadata) return false;
    if (
      filters.catalogId &&
      outboundMetadata.catalog.localCatalogId !== filters.catalogId
    ) {
      return false;
    }
    if (
      filters.productId &&
      !interaction.localProductIds.includes(filters.productId)
    ) {
      return false;
    }
    if (!matchesSource(outboundMetadata, filters.source)) return false;

    return true;
  });
  const inboundIds = interactions.map((item) => item.message.id);
  const resumedExecutions =
    inboundIds.length > 0
      ? await prisma.automationExecution.findMany({
          select: {
            conversionType: true,
            triggerMessageId: true,
          },
          where: {
            companyId,
            triggerMessageId: {
              in: inboundIds,
            },
          },
        })
      : [];
  const resumedInboundIds = new Set(
    resumedExecutions
      .map((execution) => execution.triggerMessageId)
      .filter((value): value is string => Boolean(value)),
  );
  const convertedInboundIds = new Set(
    resumedExecutions
      .filter((execution) => Boolean(execution.conversionType))
      .map((execution) => execution.triggerMessageId)
      .filter((value): value is string => Boolean(value)),
  );
  const uniqueInteractedMessages = new Set(
    interactions
      .map((item) => item.interaction.outboundMessageId)
      .filter((value): value is string => Boolean(value)),
  );
  const summary = {
    automationResumed: resumedInboundIds.size,
    businessConversions: convertedInboundIds.size,
    delivered: sentEvents.filter((event) =>
      messageHasStatus(event, DELIVERED_STATUSES),
    ).length,
    productEnquiryRate: safePercent(uniqueInteractedMessages.size, sentEvents.length),
    productInteractions: interactions.length,
    read: sentEvents.filter((event) => messageHasStatus(event, READ_STATUSES)).length,
    sent: sentEvents.length,
    uniqueInteractedMessages: uniqueInteractedMessages.size,
  };
  const trendBuckets = buildTrendBuckets(startDate, endDate);

  for (const event of sentEvents) {
    incrementBucket(trendBuckets, event.createdAt, "sent");
    incrementBucket(
      trendBuckets,
      firstMessageEventDate(event, DELIVERED_STATUSES, startDate, endDate),
      "delivered",
    );
    incrementBucket(
      trendBuckets,
      firstMessageEventDate(event, READ_STATUSES, startDate, endDate),
      "read",
    );
  }

  for (const item of interactions) {
    incrementBucket(trendBuckets, item.message.createdAt, "productInteractions");

    if (resumedInboundIds.has(item.message.id)) {
      incrementBucket(trendBuckets, item.message.createdAt, "automationResumed");
    }
  }

  const topProducts = new Map<
    string,
    {
      count: number;
      localProductId: string | null;
      name: string;
      orderCount: number;
      retailerId: string | null;
    }
  >();

  for (const { interaction } of interactions) {
    for (const product of interaction.products) {
      const key = product.localProductId || product.retailerId || "unknown";
      const existing =
        topProducts.get(key) ??
        {
          count: 0,
          localProductId: product.localProductId,
          name: product.name || "Unknown product",
          orderCount: 0,
          retailerId: product.retailerId,
        };

      existing.count += 1;
      if (interaction.interactionType === "ORDER") existing.orderCount += 1;
      topProducts.set(key, existing);
    }
  }

  const topCatalogs = new Map<
    string,
    { catalogId: string; interactions: number; name: string; sent: number }
  >();

  for (const event of sentEvents) {
    const metadata = readCatalogMessageMetadata(event.message.metadata);
    if (!metadata) continue;
    const existing =
      topCatalogs.get(metadata.catalog.localCatalogId) ??
      {
        catalogId: metadata.catalog.localCatalogId,
        interactions: 0,
        name: metadata.catalog.name || "Catalog",
        sent: 0,
      };

    existing.sent += 1;
    topCatalogs.set(existing.catalogId, existing);
  }

  for (const { interaction } of interactions) {
    const catalogId = interaction.localCatalogId;
    if (!catalogId) continue;
    const existing =
      topCatalogs.get(catalogId) ??
      {
        catalogId,
        interactions: 0,
        name: catalogs.find((catalog) => catalog.id === catalogId)?.name ?? "Catalog",
        sent: 0,
      };

    existing.interactions += 1;
    topCatalogs.set(catalogId, existing);
  }

  const topTemplates = new Map<
    string,
    { language: string; name: string; sent: number; templateId: string }
  >();

  for (const event of sentEvents) {
    if (!event.message.template) continue;
    const existing =
      topTemplates.get(event.message.template.id) ??
      {
        language: event.message.template.language,
        name: event.message.template.name,
        sent: 0,
        templateId: event.message.template.id,
      };

    existing.sent += 1;
    topTemplates.set(existing.templateId, existing);
  }

  return {
    catalogOptions: catalogs,
    dateRange: {
      endDate: endDate.toISOString(),
      startDate: startDate.toISOString(),
    },
    metricDefinitions: WHATSAPP_CATALOG_ANALYTICS_METRICS,
    productOptions: products,
    summary,
    templateOptions: templates
      .filter((template) => templateTypeFromComponents(template.components) === "CATALOG")
      .map((template) => ({
        id: template.id,
        language: template.language,
        name: template.name,
      })),
    topCatalogs: Array.from(topCatalogs.values())
      .sort((left, right) => right.interactions - left.interactions || right.sent - left.sent)
      .slice(0, 8),
    topProducts: Array.from(topProducts.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    topTemplates: Array.from(topTemplates.values())
      .sort((left, right) => right.sent - left.sent)
      .slice(0, 8),
    trend: Array.from(trendBuckets.values()),
  };
}
