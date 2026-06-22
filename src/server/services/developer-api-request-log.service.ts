import { prisma } from "@/lib/prisma";
import type { DeveloperApiRequestLogStatus } from "@/generated/prisma/enums";

const DEFAULT_PAGE_SIZE = 25;

type LogDeveloperApiRequestInput = {
  companyId: string;
  apiKeyId?: string | null;
  request: Request;
  status: DeveloperApiRequestLogStatus;
  statusCode?: number;
  errorMessage?: string;
  requiredScope?: string | null;
};

type GetDeveloperApiRequestLogsInput = {
  companyId: string;
  page?: number;
  pageSize?: number;
  status?: DeveloperApiRequestLogStatus;
  apiKeyId?: string;
};

function getRequestPath(request: Request) {
  try {
    const url = new URL(request.url);
    return `${url.pathname}${url.search}`;
  } catch {
    return request.url;
  }
}

export async function logDeveloperApiRequest({
  companyId,
  apiKeyId,
  request,
  status,
  statusCode,
  errorMessage,
  requiredScope,
}: LogDeveloperApiRequestInput) {
  return prisma.developerApiRequestLog.create({
    data: {
      companyId,
      apiKeyId: apiKeyId ?? null,
      method: request.method,
      path: getRequestPath(request),
      status,
      statusCode,
      errorMessage,
      requiredScope: requiredScope ?? null,
    },
  });
}

export async function getDeveloperApiRequestLogs({
  companyId,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  status,
  apiKeyId,
}: GetDeveloperApiRequestLogsInput) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
    ...(apiKeyId ? { apiKeyId } : {}),
  };
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * pageSize;

  const [logs, total] = await Promise.all([
    prisma.developerApiRequestLog.findMany({
      where,
      include: {
        apiKey: {
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            keyLast4: true,
            revokedAt: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: pageSize,
    }),
    prisma.developerApiRequestLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page: safePage,
    pageSize,
    pageCount: Math.max(Math.ceil(total / pageSize), 1),
  };
}

export async function getDeveloperApiKeyAnalytics(companyId: string) {
  const keys = await prisma.apiKey.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      keyLast4: true,
      scopes: true,
      allowedIps: true,
      expiresAt: true,
      status: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return Promise.all(
    keys.map(async (apiKey) => {
      const [total24h, success24h, failed24h, blocked24h, rateLimited24h] =
        await Promise.all([
          prisma.developerApiRequestLog.count({
            where: { companyId, apiKeyId: apiKey.id, createdAt: { gte: since24h } },
          }),
          prisma.developerApiRequestLog.count({
            where: {
              companyId,
              apiKeyId: apiKey.id,
              status: "SUCCESS",
              createdAt: { gte: since24h },
            },
          }),
          prisma.developerApiRequestLog.count({
            where: {
              companyId,
              apiKeyId: apiKey.id,
              status: "FAILED",
              createdAt: { gte: since24h },
            },
          }),
          prisma.developerApiRequestLog.count({
            where: {
              companyId,
              apiKeyId: apiKey.id,
              status: "BLOCKED",
              createdAt: { gte: since24h },
            },
          }),
          prisma.developerApiRequestLog.count({
            where: {
              companyId,
              apiKeyId: apiKey.id,
              status: "RATE_LIMITED",
              createdAt: { gte: since24h },
            },
          }),
        ]);

      return {
        apiKey,
        total24h,
        success24h,
        failed24h,
        blocked24h,
        rateLimited24h,
      };
    }),
  );
}
