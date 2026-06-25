import type { Prisma } from "@/generated/prisma/client";
import type {
  MessageDirection,
  MessageStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const messageReportDirections = ["INBOUND", "OUTBOUND"] as const;
export const messageReportStatuses = [
  "QUEUED",
  "SENDING",
  "RETRY_PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "RECEIVED",
  "CANCELED",
] as const;

export type MessageReportFilters = {
  direction?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: string;
};

function parseDate(value?: string, endOfDay = false) {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

function normalizePage(value?: string) {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function includesValue<T extends string>(
  values: readonly T[],
  value: string | undefined,
): value is T {
  return Boolean(value && values.includes(value as T));
}

function buildWhere(
  companyId: string,
  filters: MessageReportFilters,
): Prisma.MessageWhereInput {
  const direction = includesValue(messageReportDirections, filters.direction)
    ? (filters.direction as MessageDirection)
    : undefined;
  const status = includesValue(messageReportStatuses, filters.status)
    ? (filters.status as MessageStatus)
    : undefined;
  const from = parseDate(filters.from);
  const to = parseDate(filters.to, true);
  const search = filters.search?.trim();

  return {
    companyId,
    ...(direction ? { direction } : {}),
    ...(status ? { status } : {}),
    ...((from || to) && {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    }),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { body: { contains: search, mode: "insensitive" } },
            {
              metaMessageId: { contains: search, mode: "insensitive" },
            },
            {
              toPhoneNumber: { contains: search, mode: "insensitive" },
            },
            {
              contact: {
                name: { contains: search, mode: "insensitive" },
              },
            },
            {
              contact: {
                phoneNumber: { contains: search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
}

const reportInclude = {
  contact: {
    select: { name: true, countryCode: true, phoneNumber: true },
  },
  template: {
    select: { name: true, language: true },
  },
} satisfies Prisma.MessageInclude;

export async function getMessageReportsByCompany(
  companyId: string,
  filters: MessageReportFilters,
) {
  const page = normalizePage(filters.page);
  const pageSize = 50;
  const where = buildWhere(companyId, filters);

  const [messages, totalCount, statusCounts, directionCounts] =
    await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: reportInclude,
      }),
      prisma.message.count({ where }),
      prisma.message.groupBy({
        by: ["status"],
        where: { companyId },
        orderBy: { status: "asc" },
        _count: { status: true },
      }),
      prisma.message.groupBy({
        by: ["direction"],
        where: { companyId },
        orderBy: { direction: "asc" },
        _count: { direction: true },
      }),
    ]);

  const statusSummary = Object.fromEntries(
    messageReportStatuses.map((item) => [item, 0]),
  ) as Record<(typeof messageReportStatuses)[number], number>;
  for (const item of statusCounts) {
    statusSummary[item.status] = item._count.status;
  }

  const directionSummary: Record<MessageDirection, number> = {
    INBOUND: 0,
    OUTBOUND: 0,
  };
  for (const item of directionCounts) {
    directionSummary[item.direction] = item._count.direction;
  }

  return {
    messages,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
    statusSummary,
    directionSummary,
  };
}

export function getMessageReportsForExport(
  companyId: string,
  filters: MessageReportFilters,
) {
  return prisma.message.findMany({
    where: buildWhere(companyId, filters),
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: reportInclude,
  });
}
