import { Prisma } from "@/generated/prisma/client";
import type {
  Contact,
  TallyMappingMatchSource,
  WhatsAppCatalogProduct,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ListTallyMappingsQuery,
  UpdateTallyCustomerMappingInput,
  UpdateTallyProductMappingInput,
} from "@/server/validators/tally-order-sync.validator";

export class TallyMappingError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "TALLY_MAPPING_ERROR",
  ) {
    super(message);
  }
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function normalizePhone(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

type CustomerMatchInput = {
  companyId: string;
  tallyCompanyId: string;
  tallyLedgerId: string;
  tallyLedgerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerGstin?: string | null;
};

type ProductMatchInput = {
  companyId: string;
  tallyCompanyId: string;
  tallyStockItemId: string;
  tallyStockItemName: string;
  sku?: string | null;
  retailerId?: string | null;
};

type CustomerMatchResult = {
  contact: Pick<Contact, "id" | "name" | "phoneNumber" | "email"> | null;
  matchSource: TallyMappingMatchSource;
  confidence: number;
};

type ProductMatchResult = {
  product: Pick<WhatsAppCatalogProduct, "id" | "name" | "retailerId" | "priceAmount" | "currency"> | null;
  matchSource: TallyMappingMatchSource;
};

export async function resolveTallyCustomerMapping(
  input: CustomerMatchInput,
): Promise<CustomerMatchResult> {
  const existing = await prisma.tallyCustomerMapping.findUnique({
    where: {
      companyId_tallyCompanyId_tallyLedgerId: {
        companyId: input.companyId,
        tallyCompanyId: input.tallyCompanyId,
        tallyLedgerId: input.tallyLedgerId,
      },
    },
    include: {
      contact: {
        select: { id: true, name: true, phoneNumber: true, email: true },
      },
    },
  });

  if (existing?.contact) {
    await prisma.tallyCustomerMapping.update({
      where: { id: existing.id },
      data: { lastSyncedAt: new Date() },
    });

    return {
      contact: existing.contact,
      confidence: existing.confidence,
      matchSource: existing.matchSource,
    };
  }

  const phone = normalizePhone(input.customerPhone);
  const email = normalizeText(input.customerEmail);
  const ledgerName = normalizeText(input.tallyLedgerName);

  let matchedContact: CustomerMatchResult | null = null;

  if (phone) {
    const contact = await prisma.contact.findFirst({
      where: {
        companyId: input.companyId,
        OR: [
          { phoneNumber: phone },
          { phoneNumber: phone.replace(/^91/, "") },
        ],
      },
      select: { id: true, name: true, phoneNumber: true, email: true },
    });
    if (contact) {
      matchedContact = { contact, confidence: 95, matchSource: "PHONE" };
    }
  }

  if (!matchedContact && email) {
    const contact = await prisma.contact.findFirst({
      where: { companyId: input.companyId, email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true, phoneNumber: true, email: true },
    });
    if (contact) {
      matchedContact = { contact, confidence: 90, matchSource: "EMAIL" };
    }
  }

  if (!matchedContact && ledgerName) {
    const contacts = await prisma.contact.findMany({
      where: { companyId: input.companyId, name: { not: null } },
      select: { id: true, name: true, phoneNumber: true, email: true },
      take: 500,
    });
    const contact = contacts.find((item) => normalizeText(item.name) === ledgerName);
    if (contact) {
      matchedContact = { contact, confidence: 70, matchSource: "LEDGER_NAME" };
    }
  }

  const result = matchedContact ?? {
    contact: null,
    confidence: 0,
    matchSource: "MANUAL_REVIEW" as TallyMappingMatchSource,
  };

  await prisma.tallyCustomerMapping.upsert({
    where: {
      companyId_tallyCompanyId_tallyLedgerId: {
        companyId: input.companyId,
        tallyCompanyId: input.tallyCompanyId,
        tallyLedgerId: input.tallyLedgerId,
      },
    },
    update: {
      tallyLedgerName: input.tallyLedgerName,
      contactId: result.contact?.id ?? null,
      confidence: result.confidence,
      matchSource: result.matchSource,
      lastSyncedAt: new Date(),
      metadata: {
        customerEmail: input.customerEmail ?? null,
        customerGstin: input.customerGstin ?? null,
        customerPhone: input.customerPhone ?? null,
      } satisfies Prisma.InputJsonValue,
    },
    create: {
      companyId: input.companyId,
      tallyCompanyId: input.tallyCompanyId,
      tallyLedgerId: input.tallyLedgerId,
      tallyLedgerName: input.tallyLedgerName,
      contactId: result.contact?.id ?? null,
      confidence: result.confidence,
      matchSource: result.matchSource,
      lastSyncedAt: new Date(),
      metadata: {
        customerEmail: input.customerEmail ?? null,
        customerGstin: input.customerGstin ?? null,
        customerPhone: input.customerPhone ?? null,
      } satisfies Prisma.InputJsonValue,
    },
  });

  return result;
}

export async function resolveTallyProductMapping(
  input: ProductMatchInput,
): Promise<ProductMatchResult> {
  const existing = await prisma.tallyProductMapping.findUnique({
    where: {
      companyId_tallyCompanyId_tallyStockItemId: {
        companyId: input.companyId,
        tallyCompanyId: input.tallyCompanyId,
        tallyStockItemId: input.tallyStockItemId,
      },
    },
    include: {
      localProduct: {
        select: { id: true, name: true, retailerId: true, priceAmount: true, currency: true },
      },
    },
  });

  if (existing?.localProduct) {
    await prisma.tallyProductMapping.update({
      where: { id: existing.id },
      data: { lastSyncedAt: new Date() },
    });

    return { product: existing.localProduct, matchSource: existing.matchSource };
  }

  const retailerId = input.retailerId?.trim() || input.sku?.trim() || "";
  const stockName = normalizeText(input.tallyStockItemName);
  let result: ProductMatchResult = { product: null, matchSource: "MANUAL_REVIEW" };

  if (retailerId) {
    const product = await prisma.whatsAppCatalogProduct.findFirst({
      where: { companyId: input.companyId, retailerId },
      select: { id: true, name: true, retailerId: true, priceAmount: true, currency: true },
    });
    if (product) {
      result = { product, matchSource: input.sku ? "SKU" : "RETAILER_ID" };
    }
  }

  if (!result.product && stockName) {
    const products = await prisma.whatsAppCatalogProduct.findMany({
      where: { companyId: input.companyId },
      select: { id: true, name: true, retailerId: true, priceAmount: true, currency: true },
      take: 500,
    });
    const product = products.find((item) => normalizeText(item.name) === stockName);
    if (product) {
      result = { product, matchSource: "STOCK_ITEM_NAME" };
    }
  }

  await prisma.tallyProductMapping.upsert({
    where: {
      companyId_tallyCompanyId_tallyStockItemId: {
        companyId: input.companyId,
        tallyCompanyId: input.tallyCompanyId,
        tallyStockItemId: input.tallyStockItemId,
      },
    },
    update: {
      tallyStockItemName: input.tallyStockItemName,
      localProductId: result.product?.id ?? null,
      matchSource: result.matchSource,
      lastSyncedAt: new Date(),
      metadata: {
        retailerId: input.retailerId ?? null,
        sku: input.sku ?? null,
      } satisfies Prisma.InputJsonValue,
    },
    create: {
      companyId: input.companyId,
      tallyCompanyId: input.tallyCompanyId,
      tallyStockItemId: input.tallyStockItemId,
      tallyStockItemName: input.tallyStockItemName,
      localProductId: result.product?.id ?? null,
      matchSource: result.matchSource,
      lastSyncedAt: new Date(),
      metadata: {
        retailerId: input.retailerId ?? null,
        sku: input.sku ?? null,
      } satisfies Prisma.InputJsonValue,
    },
  });

  return result;
}

export async function listTallyMappingsForCompany(
  companyId: string,
  query: ListTallyMappingsQuery,
) {
  const tallyCompanyFilter = query.tallyCompanyId
    ? { tallyCompanyId: query.tallyCompanyId }
    : {};

  const [customers, products] = await Promise.all([
    prisma.tallyCustomerMapping.findMany({
      where: {
        companyId,
        ...tallyCompanyFilter,
        ...(query.onlyUnmapped ? { contactId: null } : {}),
      },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true } },
      },
      orderBy: [{ contactId: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.tallyProductMapping.findMany({
      where: {
        companyId,
        ...tallyCompanyFilter,
        ...(query.onlyUnmapped ? { localProductId: null } : {}),
      },
      include: {
        localProduct: { select: { id: true, name: true, retailerId: true } },
      },
      orderBy: [{ localProductId: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
  ]);

  return { customers, products };
}

export async function updateTallyCustomerMappingForCompany(
  companyId: string,
  userId: string,
  mappingId: string,
  input: UpdateTallyCustomerMappingInput,
) {
  const [mapping, contact] = await Promise.all([
    prisma.tallyCustomerMapping.findFirst({ where: { id: mappingId, companyId } }),
    prisma.contact.findFirst({ where: { id: input.contactId, companyId }, select: { id: true } }),
  ]);

  if (!mapping) throw new TallyMappingError("Customer mapping not found", 404, "MAPPING_NOT_FOUND");
  if (!contact) throw new TallyMappingError("Contact does not belong to this workspace", 404, "CONTACT_NOT_FOUND");

  return prisma.tallyCustomerMapping.update({
    where: { id: mapping.id },
    data: {
      contactId: contact.id,
      confidence: 100,
      matchSource: "EXPLICIT",
      updatedByUserId: userId,
      lastSyncedAt: new Date(),
    },
  });
}

export async function updateTallyProductMappingForCompany(
  companyId: string,
  userId: string,
  mappingId: string,
  input: UpdateTallyProductMappingInput,
) {
  const [mapping, product] = await Promise.all([
    prisma.tallyProductMapping.findFirst({ where: { id: mappingId, companyId } }),
    prisma.whatsAppCatalogProduct.findFirst({
      where: { id: input.localProductId, companyId },
      select: { id: true },
    }),
  ]);

  if (!mapping) throw new TallyMappingError("Product mapping not found", 404, "MAPPING_NOT_FOUND");
  if (!product) throw new TallyMappingError("Product does not belong to this workspace", 404, "PRODUCT_NOT_FOUND");

  return prisma.tallyProductMapping.update({
    where: { id: mapping.id },
    data: {
      localProductId: product.id,
      matchSource: "EXPLICIT",
      updatedByUserId: userId,
      lastSyncedAt: new Date(),
    },
  });
}
