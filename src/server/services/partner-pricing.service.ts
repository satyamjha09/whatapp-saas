import {
  BillingPlan,
  PartnerClientSubscriptionStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { platformAssignCompanyPlan } from "@/server/services/company-plan-assignment.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  AssignPartnerClientSubscriptionInput,
  PartnerPriceBookInput,
  PartnerPriceBookItemInput,
} from "@/server/validators/partner-pricing.validator";

export class PartnerPricingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerPricingError";
    this.status = status;
  }
}

const ACTIVE_SUBSCRIPTION_STATUSES: PartnerClientSubscriptionStatus[] = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "SUSPENDED",
];

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function normalizeCurrency(value?: string | null) {
  return (value?.trim().toUpperCase() || "INR").slice(0, 3);
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function assertPaise(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new PartnerPricingError(`${label} must be a valid amount in paise.`);
  }
}

export function assertRetailPriceMeetsFloor({
  minimumRetailPaise,
  retailAmountPaise,
}: {
  retailAmountPaise: number;
  minimumRetailPaise: number;
}) {
  assertPaise(retailAmountPaise, "Retail amount");
  assertPaise(minimumRetailPaise, "Minimum retail amount");

  if (retailAmountPaise < minimumRetailPaise) {
    throw new PartnerPricingError(
      "Retail price cannot be lower than the minimum retail floor.",
    );
  }
}

export function buildPartnerSubscriptionPriceSnapshot({
  priceBook,
  priceBookItem,
  retailAmountPaise,
}: {
  priceBook: {
    id: string;
    partnerCompanyId: string;
    name: string;
    currency: string;
  };
  priceBookItem: {
    id: string;
    platformPlanCode: BillingPlan;
    wholesaleMonthlyPaise: number;
    minimumRetailPaise: number;
    suggestedRetailPaise: number | null;
    includedMessages: number | null;
    extraMessagePaise: number | null;
  };
  retailAmountPaise: number;
}) {
  assertRetailPriceMeetsFloor({
    retailAmountPaise,
    minimumRetailPaise: priceBookItem.minimumRetailPaise,
  });

  return {
    source: "partner_price_book",
    priceBookId: priceBook.id,
    priceBookName: priceBook.name,
    priceBookItemId: priceBookItem.id,
    partnerCompanyId: priceBook.partnerCompanyId,
    platformPlanCode: priceBookItem.platformPlanCode,
    currency: priceBook.currency,
    wholesaleMonthlyPaise: priceBookItem.wholesaleMonthlyPaise,
    minimumRetailPaise: priceBookItem.minimumRetailPaise,
    suggestedRetailPaise: priceBookItem.suggestedRetailPaise,
    retailAmountPaise,
    includedMessages: priceBookItem.includedMessages,
    extraMessagePaise: priceBookItem.extraMessagePaise,
    capturedAt: new Date().toISOString(),
  };
}

async function assertPartnerCompany(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: {
      id: partnerCompanyId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      type: true,
    },
  });

  if (!partner) {
    throw new PartnerPricingError("Partner company not found.", 404);
  }

  if (partner.type !== "PARTNER") {
    throw new PartnerPricingError("Selected company is not a partner.");
  }

  if (partner.status === "DISABLED") {
    throw new PartnerPricingError("Disabled partners cannot manage pricing.");
  }

  return partner;
}

async function assertActivePartnerClient({
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
}) {
  const relationship = await prisma.partnerClientRelationship.findUnique({
    where: {
      partnerCompanyId_clientCompanyId: {
        partnerCompanyId,
        clientCompanyId,
      },
    },
    include: {
      clientCompany: {
        select: {
          id: true,
          name: true,
          parentCompanyId: true,
          type: true,
          billingOwnerType: true,
        },
      },
    },
  });

  if (!relationship) {
    throw new PartnerPricingError(
      "Client workspace does not belong to this partner.",
      404,
    );
  }

  if (relationship.status !== "ACTIVE" && relationship.status !== "INVITED") {
    throw new PartnerPricingError(
      "Client relationship is not active enough for subscription assignment.",
    );
  }

  if (
    relationship.clientCompany.type !== "PARTNER_CLIENT" ||
    relationship.clientCompany.parentCompanyId !== partnerCompanyId
  ) {
    throw new PartnerPricingError(
      "Client workspace is not owned by this partner.",
    );
  }

  return relationship;
}

async function recordPriceBookEvent({
  actorUserId,
  message,
  metadata,
  partnerCompanyId,
  priceBookId,
  type,
}: {
  partnerCompanyId: string;
  priceBookId: string;
  actorUserId?: string | null;
  type:
    | "CREATED"
    | "UPDATED"
    | "ACTIVATED"
    | "DEACTIVATED"
    | "ITEM_UPSERTED"
    | "ITEM_DEACTIVATED";
  message?: string | null;
  metadata?: unknown;
}) {
  await prisma.partnerPriceBookEvent.create({
    data: {
      partnerCompanyId,
      priceBookId,
      actorUserId: actorUserId ?? null,
      type,
      message: message ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

async function recordSubscriptionEvent({
  actorUserId,
  clientCompanyId,
  message,
  metadata,
  newValues,
  partnerCompanyId,
  previousValues,
  subscriptionId,
  type,
}: {
  subscriptionId: string;
  partnerCompanyId: string;
  clientCompanyId: string;
  actorUserId?: string | null;
  type:
    | "CREATED"
    | "PLAN_CHANGED"
    | "PRICE_CHANGED"
    | "STATUS_CHANGED"
    | "CANCELED"
    | "RENEWED"
    | "SNAPSHOT_RECORDED";
  previousValues?: unknown;
  newValues?: unknown;
  message?: string | null;
  metadata?: unknown;
}) {
  await prisma.partnerClientSubscriptionEvent.create({
    data: {
      subscriptionId,
      partnerCompanyId,
      clientCompanyId,
      actorUserId: actorUserId ?? null,
      type,
      previousValues: previousValues ? safeJson(previousValues) : undefined,
      newValues: newValues ? safeJson(newValues) : undefined,
      message: message ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

export async function getPartnerPricingDashboard() {
  return prisma.company.findMany({
    where: {
      type: "PARTNER",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      partnerPriceBooks: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          items: {
            orderBy: {
              platformPlanCode: "asc",
            },
          },
          events: {
            orderBy: {
              createdAt: "desc",
            },
            take: 5,
          },
        },
      },
      partnerClientRelationshipsAsPartner: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          clientCompany: {
            select: {
              id: true,
              name: true,
              billingPlan: true,
              billingOwnerType: true,
              subscriptionStatus: true,
            },
          },
          subscriptions: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              priceBookItem: true,
              events: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 3,
              },
            },
            take: 3,
          },
        },
      },
    },
  });
}

export async function upsertPartnerPriceBook({
  actorUserId,
  input,
}: {
  actorUserId: string;
  input: PartnerPriceBookInput;
}) {
  await assertPartnerCompany(input.partnerCompanyId);

  const name = normalizeName(input.name);
  const currency = normalizeCurrency(input.currency);
  const existing = input.priceBookId
    ? await prisma.partnerPriceBook.findUnique({
        where: {
          id: input.priceBookId,
        },
        include: {
          items: true,
        },
      })
    : null;

  if (existing && existing.partnerCompanyId !== input.partnerCompanyId) {
    throw new PartnerPricingError("Price book belongs to another partner.", 403);
  }

  if (existing && existing.currency !== currency) {
    const subscriptionCount = await prisma.partnerClientSubscription.count({
      where: {
        priceBookItemId: {
          in: existing.items.map((item) => item.id),
        },
      },
    });

    if (subscriptionCount > 0) {
      throw new PartnerPricingError(
        "Currency cannot be changed after subscriptions are created.",
      );
    }
  }

  const priceBook = existing
    ? await prisma.partnerPriceBook.update({
        where: {
          id: existing.id,
        },
        data: {
          name,
          currency,
          active: input.active ?? existing.active,
        },
        include: {
          items: true,
        },
      })
    : await prisma.partnerPriceBook.create({
        data: {
          partnerCompanyId: input.partnerCompanyId,
          name,
          currency,
          active: input.active ?? true,
        },
        include: {
          items: true,
        },
      });

  await recordPriceBookEvent({
    partnerCompanyId: priceBook.partnerCompanyId,
    priceBookId: priceBook.id,
    actorUserId,
    type: existing ? "UPDATED" : "CREATED",
    message: existing ? "Partner price book updated." : "Partner price book created.",
    metadata: {
      name: priceBook.name,
      currency: priceBook.currency,
      active: priceBook.active,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    action: existing
      ? "partner_price_book.updated"
      : "partner_price_book.created",
    entityType: "PartnerPriceBook",
    entityId: priceBook.id,
    metadata: safeJson({
      partnerCompanyId: priceBook.partnerCompanyId,
      name: priceBook.name,
      currency: priceBook.currency,
      active: priceBook.active,
    }),
  }).catch(() => undefined);

  return priceBook;
}

export async function upsertPartnerPriceBookItem({
  actorUserId,
  input,
  priceBookId,
}: {
  actorUserId: string;
  priceBookId: string;
  input: PartnerPriceBookItemInput;
}) {
  const priceBook = await prisma.partnerPriceBook.findUnique({
    where: {
      id: priceBookId,
    },
  });

  if (!priceBook) {
    throw new PartnerPricingError("Price book not found.", 404);
  }

  await assertPartnerCompany(priceBook.partnerCompanyId);
  assertPaise(input.wholesaleMonthlyPaise, "Wholesale monthly amount");
  assertPaise(input.minimumRetailPaise, "Minimum retail amount");

  if (
    input.suggestedRetailPaise !== undefined &&
    input.suggestedRetailPaise !== null
  ) {
    assertRetailPriceMeetsFloor({
      retailAmountPaise: input.suggestedRetailPaise,
      minimumRetailPaise: input.minimumRetailPaise,
    });
  }

  const item = await prisma.partnerPriceBookItem.upsert({
    where: {
      priceBookId_platformPlanCode: {
        priceBookId,
        platformPlanCode: input.platformPlanCode,
      },
    },
    update: {
      wholesaleMonthlyPaise: input.wholesaleMonthlyPaise,
      minimumRetailPaise: input.minimumRetailPaise,
      suggestedRetailPaise: input.suggestedRetailPaise ?? null,
      includedMessages: input.includedMessages ?? null,
      extraMessagePaise: input.extraMessagePaise ?? null,
      active: input.active ?? true,
    },
    create: {
      priceBookId,
      platformPlanCode: input.platformPlanCode,
      wholesaleMonthlyPaise: input.wholesaleMonthlyPaise,
      minimumRetailPaise: input.minimumRetailPaise,
      suggestedRetailPaise: input.suggestedRetailPaise ?? null,
      includedMessages: input.includedMessages ?? null,
      extraMessagePaise: input.extraMessagePaise ?? null,
      active: input.active ?? true,
    },
  });

  await recordPriceBookEvent({
    partnerCompanyId: priceBook.partnerCompanyId,
    priceBookId,
    actorUserId,
    type: item.active ? "ITEM_UPSERTED" : "ITEM_DEACTIVATED",
    message: `${item.platformPlanCode} pricing updated.`,
    metadata: {
      item,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_price_book.item_upserted",
    entityType: "PartnerPriceBookItem",
    entityId: item.id,
    metadata: safeJson({
      partnerCompanyId: priceBook.partnerCompanyId,
      priceBookId,
      item,
    }),
  }).catch(() => undefined);

  return item;
}

export async function assignPartnerClientSubscription({
  actorUserId,
  input,
}: {
  actorUserId: string;
  input: AssignPartnerClientSubscriptionInput;
}) {
  const item = await prisma.partnerPriceBookItem.findUnique({
    where: {
      id: input.priceBookItemId,
    },
    include: {
      priceBook: true,
    },
  });

  if (!item) {
    throw new PartnerPricingError("Price book item not found.", 404);
  }

  if (!item.active || !item.priceBook.active) {
    throw new PartnerPricingError("Selected price book item is not active.");
  }

  const partnerCompanyId = item.priceBook.partnerCompanyId;
  await assertPartnerCompany(partnerCompanyId);
  const relationship = await assertActivePartnerClient({
    partnerCompanyId,
    clientCompanyId: input.clientCompanyId,
  });

  const retailAmountPaise =
    input.retailAmountPaise ??
    item.suggestedRetailPaise ??
    item.minimumRetailPaise;
  const now = new Date();
  const billingDays = input.billingDays ?? 30;
  const startsAt = input.startsAt ? new Date(input.startsAt) : now;
  const currentPeriodEnd = input.currentPeriodEnd
    ? new Date(input.currentPeriodEnd)
    : addDays(startsAt, billingDays);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(currentPeriodEnd.getTime())) {
    throw new PartnerPricingError("Subscription dates are invalid.");
  }

  if (currentPeriodEnd <= startsAt) {
    throw new PartnerPricingError("Current period end must be after start date.");
  }

  const priceSnapshot = buildPartnerSubscriptionPriceSnapshot({
    priceBook: item.priceBook,
    priceBookItem: item,
    retailAmountPaise,
  });

  const existingCurrent = await prisma.partnerClientSubscription.findFirst({
    where: {
      clientCompanyId: input.clientCompanyId,
      status: {
        in: ACTIVE_SUBSCRIPTION_STATUSES,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const subscription = await prisma.$transaction(async (tx) => {
    if (existingCurrent) {
      await tx.partnerClientSubscription.update({
        where: {
          id: existingCurrent.id,
        },
        data: {
          status: "EXPIRED",
          currentPeriodEnd: now,
        },
      });
    }

    const created = await tx.partnerClientSubscription.create({
      data: {
        partnerCompanyId,
        clientCompanyId: input.clientCompanyId,
        relationshipId: relationship.id,
        priceBookItemId: item.id,
        platformPlanCode: item.platformPlanCode,
        billingOwnerType: "PARENT_PARTNER",
        wholesaleAmountPaise: item.wholesaleMonthlyPaise,
        retailAmountPaise,
        currency: item.priceBook.currency,
        status: input.status ?? "ACTIVE",
        startsAt,
        currentPeriodStart: startsAt,
        currentPeriodEnd,
        priceSnapshot: safeJson(priceSnapshot),
        metadata: input.metadata ? safeJson(input.metadata) : undefined,
      },
      include: {
        priceBookItem: true,
      },
    });

    await tx.company.update({
      where: {
        id: input.clientCompanyId,
      },
      data: {
        billingOwnerType: "PARENT_PARTNER",
      },
    });

    await tx.partnerClientSubscriptionEvent.create({
      data: {
        subscriptionId: created.id,
        partnerCompanyId,
        clientCompanyId: input.clientCompanyId,
        actorUserId,
        type: existingCurrent ? "PLAN_CHANGED" : "CREATED",
        previousValues: existingCurrent
          ? safeJson({
              id: existingCurrent.id,
              platformPlanCode: existingCurrent.platformPlanCode,
              retailAmountPaise: existingCurrent.retailAmountPaise,
              status: existingCurrent.status,
            })
          : undefined,
        newValues: safeJson(priceSnapshot),
        message: existingCurrent
          ? "Partner client subscription changed."
          : "Partner client subscription created.",
      },
    });

    return created;
  });

  await platformAssignCompanyPlan({
    actorUserId,
    companyId: input.clientCompanyId,
    days: billingDays,
    planCode: item.platformPlanCode.toLowerCase(),
    status: subscription.status === "TRIALING" ? "TRIAL" : "ACTIVE",
    source: "PARTNER",
    metadata: {
      partnerCompanyId,
      subscriptionId: subscription.id,
      priceSnapshot,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_client_subscription.assigned",
    entityType: "PartnerClientSubscription",
    entityId: subscription.id,
    metadata: safeJson({
      partnerCompanyId,
      clientCompanyId: input.clientCompanyId,
      relationshipId: relationship.id,
      priceSnapshot,
    }),
  }).catch(() => undefined);

  return subscription;
}

export async function cancelPartnerClientSubscription({
  actorUserId,
  cancellationNote,
  subscriptionId,
}: {
  actorUserId: string;
  subscriptionId: string;
  cancellationNote?: string | null;
}) {
  const existing = await prisma.partnerClientSubscription.findUnique({
    where: {
      id: subscriptionId,
    },
  });

  if (!existing) {
    throw new PartnerPricingError("Subscription not found.", 404);
  }

  const canceledAt = new Date();
  const updated = await prisma.partnerClientSubscription.update({
    where: {
      id: subscriptionId,
    },
    data: {
      status: "CANCELED",
      canceledAt,
      cancellationNote: cancellationNote?.trim() || null,
    },
  });

  await recordSubscriptionEvent({
    subscriptionId,
    partnerCompanyId: existing.partnerCompanyId,
    clientCompanyId: existing.clientCompanyId,
    actorUserId,
    type: "CANCELED",
    previousValues: {
      status: existing.status,
      currentPeriodEnd: existing.currentPeriodEnd,
    },
    newValues: {
      status: updated.status,
      canceledAt,
      cancellationNote: updated.cancellationNote,
    },
    message: "Partner client subscription canceled.",
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_client_subscription.canceled",
    entityType: "PartnerClientSubscription",
    entityId: subscriptionId,
    metadata: safeJson({
      partnerCompanyId: updated.partnerCompanyId,
      clientCompanyId: updated.clientCompanyId,
      cancellationNote: updated.cancellationNote,
    }),
  }).catch(() => undefined);

  return updated;
}
