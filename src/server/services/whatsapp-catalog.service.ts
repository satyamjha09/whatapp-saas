import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import {
  isMetaNumericId,
  NUMERIC_WABA_ID_MESSAGE,
} from "@/server/whatsapp/meta-ids";

const MAX_CATALOG_SYNC_PAGES = 100;
const MAX_PRODUCT_SYNC_PAGES = 100;

type RemoteWhatsAppCatalog = {
  id: string;
  metaRaw: Prisma.InputJsonValue;
  name: string;
  productCount: number;
  vertical: string | null;
};

type MetaCatalogResponse = {
  data?: unknown;
  paging?: {
    cursors?: {
      after?: unknown;
    };
    next?: unknown;
  };
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
};

type RemoteCatalogProduct = {
  availability: string | null;
  brand: string | null;
  category: string | null;
  condition: string | null;
  currency: string | null;
  description: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  isUsable: boolean;
  metaRaw: Prisma.InputJsonValue;
  name: string;
  priceAmount: Prisma.Decimal | null;
  productUrl: string | null;
  retailerId: string | null;
};

export class WhatsAppCatalogSyncError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "WhatsAppCatalogSyncError";
    this.code = code;
    this.status = status;
  }
}

function getMetaGraphBaseUrl() {
  const version = process.env.WHATSAPP_API_VERSION ?? "v25.0";

  return `https://graph.facebook.com/${version}`;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  return 0;
}

function publicUrlValue(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    return url.toString();
  } catch {
    return null;
  }
}

function decimalValue(value: unknown) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Prisma.Decimal(String(value));
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return new Prisma.Decimal(normalized);
  }

  const numericPart = normalized.replace(/[^\d.-]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numericPart)) {
    return new Prisma.Decimal(numericPart);
  }

  return null;
}

function productIsActive(value: Record<string, unknown>) {
  const status = stringValue(value.status || value.approval_status).toLowerCase();
  const availability = stringValue(value.availability).toLowerCase();

  return !["archived", "deleted", "disabled", "rejected"].includes(status) &&
    !["deleted", "disabled"].includes(availability);
}

function productIsUsable(value: Record<string, unknown>) {
  const availability = stringValue(value.availability).toLowerCase();

  return (
    productIsActive(value) &&
    !["out of stock", "out_of_stock", "unavailable"].includes(availability)
  );
}

function readRemoteProduct(value: unknown): RemoteCatalogProduct | null {
  if (!isRecord(value)) return null;

  const id = stringValue(value.id);
  if (!id) return null;

  return {
    availability: stringValue(value.availability) || null,
    brand: stringValue(value.brand) || null,
    category:
      stringValue(value.category) ||
      stringValue(value.google_product_category) ||
      null,
    condition: stringValue(value.condition) || null,
    currency:
      stringValue(value.currency) ||
      stringValue(value.price_currency) ||
      stringValue(value.sale_price_currency) ||
      null,
    description: stringValue(value.description) || null,
    id,
    imageUrl:
      publicUrlValue(value.image_url) ||
      publicUrlValue(value.imageUrl) ||
      publicUrlValue(value.main_image_url),
    isActive: productIsActive(value),
    isUsable: productIsUsable(value),
    metaRaw: safeJson(value),
    name: stringValue(value.name) || `Product ${id}`,
    priceAmount:
      decimalValue(value.price_amount) ||
      decimalValue(value.price) ||
      decimalValue(value.sale_price),
    productUrl: publicUrlValue(value.url) || publicUrlValue(value.product_url),
    retailerId:
      stringValue(value.retailer_id) ||
      stringValue(value.retailerId) ||
      stringValue(value.content_id) ||
      null,
  };
}

function readRemoteCatalog(value: unknown): RemoteWhatsAppCatalog | null {
  if (!isRecord(value)) return null;

  const id = stringValue(value.id);
  if (!id) return null;

  return {
    id,
    metaRaw: safeJson(value),
    name: stringValue(value.name) || `Catalog ${id}`,
    productCount:
      numberValue(value.product_count) ||
      numberValue(value.product_count_upper_bound) ||
      numberValue(value.products_count),
    vertical: stringValue(value.vertical) || null,
  };
}

function readMetaCatalogResponse(data: MetaCatalogResponse) {
  const catalogs = Array.isArray(data.data)
    ? data.data
        .map(readRemoteCatalog)
        .filter(
          (catalog): catalog is RemoteWhatsAppCatalog => Boolean(catalog),
        )
    : [];
  const after = data.paging?.next ? stringValue(data.paging.cursors?.after) : "";

  return {
    after: after || null,
    catalogs,
  };
}

function readMetaProductResponse(data: MetaCatalogResponse) {
  const products = Array.isArray(data.data)
    ? data.data
        .map(readRemoteProduct)
        .filter((product): product is RemoteCatalogProduct => Boolean(product))
    : [];
  const after = data.paging?.next ? stringValue(data.paging.cursors?.after) : "";

  return {
    after: after || null,
    products,
  };
}

function classifyMetaCatalogError(data: MetaCatalogResponse, status: number) {
  const message = data.error?.message || "Unable to fetch WhatsApp catalogs";
  const lowered = message.toLowerCase();

  if (lowered.includes("unsupported get request")) {
    return new WhatsAppCatalogSyncError(
      "CATALOG_SYNC_WABA_INVALID",
      "Meta rejected this WABA ID. Confirm the connected account has catalog access and the token can read this WhatsApp Business Account.",
      status || 400,
    );
  }

  if (
    lowered.includes("permission") ||
    lowered.includes("access token") ||
    lowered.includes("oauth")
  ) {
    return new WhatsAppCatalogSyncError(
      "CATALOG_SYNC_PERMISSION_DENIED",
      message,
      status || 403,
    );
  }

  return new WhatsAppCatalogSyncError(
    "CATALOG_SYNC_META_ERROR",
    message,
    status || 502,
  );
}

async function fetchRemoteCatalogPage({
  accessToken,
  after,
  wabaId,
}: {
  accessToken: string;
  after?: string;
  wabaId: string;
}) {
  const url = new URL(`${getMetaGraphBaseUrl()}/${wabaId}/product_catalogs`);
  url.searchParams.set(
    "fields",
    "id,name,vertical,product_count,product_count_upper_bound",
  );
  url.searchParams.set("limit", "100");
  if (after) url.searchParams.set("after", after);

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: "GET",
  });
  const data = (await response.json()) as MetaCatalogResponse;

  if (!response.ok || data.error) {
    throw classifyMetaCatalogError(data, response.status);
  }

  return readMetaCatalogResponse(data);
}

async function fetchRemoteProductPage({
  accessToken,
  after,
  metaCatalogId,
}: {
  accessToken: string;
  after?: string;
  metaCatalogId: string;
}) {
  const url = new URL(`${getMetaGraphBaseUrl()}/${metaCatalogId}/products`);
  url.searchParams.set(
    "fields",
    [
      "id",
      "retailer_id",
      "name",
      "description",
      "brand",
      "category",
      "google_product_category",
      "image_url",
      "url",
      "price",
      "price_amount",
      "currency",
      "availability",
      "condition",
      "status",
      "approval_status",
    ].join(","),
  );
  url.searchParams.set("limit", "100");
  if (after) url.searchParams.set("after", after);

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: "GET",
  });
  const data = (await response.json()) as MetaCatalogResponse;

  if (!response.ok || data.error) {
    throw classifyMetaCatalogError(data, response.status);
  }

  return readMetaProductResponse(data);
}

export async function listRemoteWhatsAppCatalogs({
  accessToken,
  wabaId,
}: {
  accessToken: string;
  wabaId: string;
}) {
  if (!isMetaNumericId(wabaId)) {
    throw new WhatsAppCatalogSyncError(
      "CATALOG_SYNC_WABA_MISSING",
      NUMERIC_WABA_ID_MESSAGE,
      400,
    );
  }

  const catalogs: RemoteWhatsAppCatalog[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page < MAX_CATALOG_SYNC_PAGES; page += 1) {
    const result = await fetchRemoteCatalogPage({ accessToken, after, wabaId });
    catalogs.push(...result.catalogs);

    if (!result.after || seenCursors.has(result.after)) {
      return catalogs;
    }

    seenCursors.add(result.after);
    after = result.after;
  }

  throw new WhatsAppCatalogSyncError(
    "CATALOG_SYNC_RESPONSE_INVALID",
    "Meta Catalog pagination did not finish safely.",
    502,
  );
}

export async function listRemoteCatalogProducts({
  accessToken,
  metaCatalogId,
}: {
  accessToken: string;
  metaCatalogId: string;
}) {
  if (!isMetaNumericId(metaCatalogId)) {
    throw new WhatsAppCatalogSyncError(
      "PRODUCT_SYNC_CATALOG_INVALID",
      "Meta Catalog ID must be a numeric Meta ID.",
      400,
    );
  }

  const products: RemoteCatalogProduct[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page < MAX_PRODUCT_SYNC_PAGES; page += 1) {
    const result = await fetchRemoteProductPage({
      accessToken,
      after,
      metaCatalogId,
    });
    products.push(...result.products);

    if (!result.after || seenCursors.has(result.after)) {
      return products;
    }

    seenCursors.add(result.after);
    after = result.after;
  }

  throw new WhatsAppCatalogSyncError(
    "PRODUCT_SYNC_RESPONSE_INVALID",
    "Meta product pagination did not finish safely.",
    502,
  );
}

export async function getWhatsAppCatalogDetail({
  catalogId,
  companyId,
}: {
  catalogId: string;
  companyId: string;
}) {
  return prisma.whatsAppCatalog.findFirst({
    where: {
      companyId,
      id: catalogId,
    },
    include: {
      _count: {
        select: {
          products: true,
        },
      },
      whatsAppAccount: {
        select: {
          businessName: true,
          id: true,
          status: true,
          wabaId: true,
        },
      },
    },
  });
}

export async function getCatalogProducts({
  availability,
  catalogId,
  companyId,
  page = 1,
  pageSize = 20,
  search,
  usableOnly = false,
}: {
  availability?: string | null;
  catalogId: string;
  companyId: string;
  page?: number;
  pageSize?: number;
  search?: string | null;
  usableOnly?: boolean;
}) {
  const catalog = await getWhatsAppCatalogDetail({ catalogId, companyId });
  if (!catalog) {
    throw new WhatsAppCatalogSyncError(
      "CATALOG_NOT_FOUND",
      "Catalog not found for this workspace.",
      404,
    );
  }

  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const normalizedSearch = search?.trim();
  const normalizedAvailability = availability?.trim();
  const where: Prisma.WhatsAppCatalogProductWhereInput = {
    catalogId: catalog.id,
    companyId,
    ...(usableOnly ? { isUsable: true, remoteMissingAt: null } : {}),
    ...(normalizedAvailability && normalizedAvailability !== "ALL"
      ? { availability: normalizedAvailability }
      : {}),
    ...(normalizedSearch
      ? {
          OR: [
            { name: { contains: normalizedSearch, mode: "insensitive" } },
            { retailerId: { contains: normalizedSearch, mode: "insensitive" } },
            { brand: { contains: normalizedSearch, mode: "insensitive" } },
            {
              description: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [products, total, availabilityOptions] = await Promise.all([
    prisma.whatsAppCatalogProduct.findMany({
      where,
      orderBy: [
        { isUsable: "desc" },
        { lastSyncedAt: "desc" },
        { name: "asc" },
      ],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    prisma.whatsAppCatalogProduct.count({ where }),
    prisma.whatsAppCatalogProduct.findMany({
      distinct: ["availability"],
      where: {
        catalogId: catalog.id,
        companyId,
        availability: {
          not: null,
        },
      },
      orderBy: {
        availability: "asc",
      },
      select: {
        availability: true,
      },
    }),
  ]);

  return {
    availabilityOptions: availabilityOptions
      .map((option) => option.availability)
      .filter((option): option is string => Boolean(option)),
    catalog,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
    products,
  };
}

export async function getCatalogProduct({
  companyId,
  productId,
}: {
  companyId: string;
  productId: string;
}) {
  return prisma.whatsAppCatalogProduct.findFirst({
    where: {
      companyId,
      id: productId,
    },
    include: {
      catalog: true,
    },
  });
}

export async function isCatalogProductUsable({
  companyId,
  productId,
}: {
  companyId: string;
  productId: string;
}) {
  const product = await getCatalogProduct({ companyId, productId });

  return Boolean(
    product?.isUsable &&
      product.isActive &&
      !product.remoteMissingAt &&
      product.catalog.isUsable &&
      !product.catalog.remoteMissingAt,
  );
}

export async function getWhatsAppCatalogsByCompany({
  companyId,
  page = 1,
  pageSize = 20,
  usableOnly = false,
}: {
  companyId: string;
  page?: number;
  pageSize?: number;
  usableOnly?: boolean;
}) {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const where: Prisma.WhatsAppCatalogWhereInput = {
    companyId,
    ...(usableOnly
      ? {
          isUsable: true,
          metaCatalogId: {
            not: "",
          },
          remoteMissingAt: null,
        }
      : {}),
  };

  const [catalogs, total, connectedAccount] = await Promise.all([
    prisma.whatsAppCatalog.findMany({
      where,
      include: {
        whatsAppAccount: {
          select: {
            businessName: true,
            id: true,
            status: true,
            wabaId: true,
          },
        },
      },
      orderBy: [
        { isUsable: "desc" },
        { lastSyncedAt: "desc" },
        { name: "asc" },
      ],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    prisma.whatsAppCatalog.count({ where }),
    prisma.whatsAppAccount.findFirst({
      where: {
        companyId,
        status: "CONNECTED",
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        accessToken: true,
        id: true,
        status: true,
        wabaId: true,
      },
    }),
  ]);

  return {
    catalogs,
    connectedAccount: connectedAccount
      ? {
          hasAccessToken: Boolean(connectedAccount.accessToken),
          id: connectedAccount.id,
          status: connectedAccount.status,
          wabaId: connectedAccount.wabaId,
        }
      : null,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  };
}

export async function syncWhatsAppCatalogsForCompany(companyId: string) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
      status: "CONNECTED",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!account) {
    throw new WhatsAppCatalogSyncError(
      "WHATSAPP_NOT_CONNECTED",
      "Connect WhatsApp before syncing Catalogs.",
      400,
    );
  }

  if (!account.wabaId) {
    throw new WhatsAppCatalogSyncError(
      "CATALOG_SYNC_WABA_MISSING",
      "Connected WhatsApp account is missing a WABA ID.",
      400,
    );
  }

  if (!account.accessToken) {
    throw new WhatsAppCatalogSyncError(
      "CATALOG_SYNC_TOKEN_MISSING",
      "Connected WhatsApp account is missing an access token.",
      400,
    );
  }

  const accessToken = await getWhatsAppAccessToken({ companyId });
  const remoteCatalogs = await listRemoteWhatsAppCatalogs({
    accessToken,
    wabaId: account.wabaId,
  });
  const now = new Date();
  const remoteIds = new Set(remoteCatalogs.map((catalog) => catalog.id));
  let created = 0;
  let updated = 0;

  for (const remoteCatalog of remoteCatalogs) {
    const existing = await prisma.whatsAppCatalog.findUnique({
      where: {
        companyId_metaCatalogId: {
          companyId,
          metaCatalogId: remoteCatalog.id,
        },
      },
      select: {
        id: true,
      },
    });

    await prisma.whatsAppCatalog.upsert({
      where: {
        companyId_metaCatalogId: {
          companyId,
          metaCatalogId: remoteCatalog.id,
        },
      },
      update: {
        isUsable: true,
        lastSyncedAt: now,
        metaRaw: remoteCatalog.metaRaw,
        name: remoteCatalog.name,
        productCount: remoteCatalog.productCount,
        remoteMissingAt: null,
        status: "CONNECTED",
        vertical: remoteCatalog.vertical,
        whatsAppAccountId: account.id,
      },
      create: {
        companyId,
        isUsable: true,
        lastSyncedAt: now,
        metaCatalogId: remoteCatalog.id,
        metaRaw: remoteCatalog.metaRaw,
        name: remoteCatalog.name,
        productCount: remoteCatalog.productCount,
        status: "CONNECTED",
        vertical: remoteCatalog.vertical,
        whatsAppAccountId: account.id,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const missingResult = await prisma.whatsAppCatalog.updateMany({
    where: {
      companyId,
      ...(remoteIds.size > 0
        ? {
            metaCatalogId: {
              notIn: [...remoteIds],
            },
          }
        : {}),
      remoteMissingAt: null,
      whatsAppAccountId: account.id,
    },
    data: {
      isUsable: false,
      remoteMissingAt: now,
      status: "MISSING",
    },
  });

  return {
    ok: true,
    summary: {
      created,
      markedMissing: missingResult.count,
      remoteFound: remoteCatalogs.length,
      unchanged: Math.max(remoteCatalogs.length - created - updated, 0),
      updated,
      usable: remoteCatalogs.length,
    },
    syncedAt: now.toISOString(),
  };
}

export async function syncCatalogProducts({
  catalogId,
  companyId,
}: {
  catalogId: string;
  companyId: string;
}) {
  const catalog = await prisma.whatsAppCatalog.findFirst({
    where: {
      companyId,
      id: catalogId,
    },
    include: {
      whatsAppAccount: true,
    },
  });

  if (!catalog) {
    throw new WhatsAppCatalogSyncError(
      "CATALOG_NOT_FOUND",
      "Catalog not found for this workspace.",
      404,
    );
  }

  if (!catalog.isUsable || catalog.remoteMissingAt) {
    throw new WhatsAppCatalogSyncError(
      "CATALOG_NOT_USABLE",
      "This Catalog is not currently usable. Sync Catalogs from Meta first.",
      400,
    );
  }

  if (!catalog.whatsAppAccount.accessToken) {
    throw new WhatsAppCatalogSyncError(
      "PRODUCT_SYNC_TOKEN_MISSING",
      "Connected WhatsApp account is missing an access token.",
      400,
    );
  }

  const accessToken = await getWhatsAppAccessToken({ companyId });
  const remoteProducts = await listRemoteCatalogProducts({
    accessToken,
    metaCatalogId: catalog.metaCatalogId,
  });
  const now = new Date();
  const remoteIds = new Set(remoteProducts.map((product) => product.id));
  let created = 0;
  let updated = 0;
  let usable = 0;

  for (const remoteProduct of remoteProducts) {
    if (remoteProduct.isUsable) usable += 1;

    const existing = await prisma.whatsAppCatalogProduct.findUnique({
      where: {
        catalogId_metaProductId: {
          catalogId: catalog.id,
          metaProductId: remoteProduct.id,
        },
      },
      select: {
        id: true,
      },
    });

    await prisma.whatsAppCatalogProduct.upsert({
      where: {
        catalogId_metaProductId: {
          catalogId: catalog.id,
          metaProductId: remoteProduct.id,
        },
      },
      update: {
        availability: remoteProduct.availability,
        brand: remoteProduct.brand,
        category: remoteProduct.category,
        condition: remoteProduct.condition,
        currency: remoteProduct.currency,
        description: remoteProduct.description,
        imageUrl: remoteProduct.imageUrl,
        isActive: remoteProduct.isActive,
        isUsable: remoteProduct.isUsable,
        lastSyncedAt: now,
        metaRaw: remoteProduct.metaRaw,
        name: remoteProduct.name,
        priceAmount: remoteProduct.priceAmount,
        productUrl: remoteProduct.productUrl,
        remoteMissingAt: null,
        retailerId: remoteProduct.retailerId,
      },
      create: {
        availability: remoteProduct.availability,
        brand: remoteProduct.brand,
        catalogId: catalog.id,
        category: remoteProduct.category,
        companyId,
        condition: remoteProduct.condition,
        currency: remoteProduct.currency,
        description: remoteProduct.description,
        imageUrl: remoteProduct.imageUrl,
        isActive: remoteProduct.isActive,
        isUsable: remoteProduct.isUsable,
        lastSyncedAt: now,
        metaProductId: remoteProduct.id,
        metaRaw: remoteProduct.metaRaw,
        name: remoteProduct.name,
        priceAmount: remoteProduct.priceAmount,
        productUrl: remoteProduct.productUrl,
        retailerId: remoteProduct.retailerId,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const missingResult = await prisma.whatsAppCatalogProduct.updateMany({
    where: {
      catalogId: catalog.id,
      companyId,
      ...(remoteIds.size > 0
        ? {
            metaProductId: {
              notIn: [...remoteIds],
            },
          }
        : {}),
      remoteMissingAt: null,
    },
    data: {
      isUsable: false,
      remoteMissingAt: now,
    },
  });

  await prisma.whatsAppCatalog.update({
    where: {
      id: catalog.id,
    },
    data: {
      productCount: remoteProducts.length,
    },
  });

  return {
    ok: true,
    summary: {
      created,
      markedMissing: missingResult.count,
      remoteFound: remoteProducts.length,
      unchanged: Math.max(remoteProducts.length - created - updated, 0),
      updated,
      usable,
    },
    syncedAt: now.toISOString(),
  };
}
