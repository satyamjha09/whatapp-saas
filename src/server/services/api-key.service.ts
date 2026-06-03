import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CreateApiKeyInput } from "@/server/validators/api-key.validator";

const apiKeyDisplaySelect = {
  id: true,
  companyId: true,
  name: true,
  keyPrefix: true,
  keyLast4: true,
  status: true,
  lastUsedAt: true,
  expiresAt: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
};

function hashApiKey(apiKey: string) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

function generateApiKey() {
  return `wsaas_${crypto.randomBytes(32).toString("hex")}`;
}

export async function getApiKeysByCompany(companyId: string) {
  return prisma.apiKey.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: apiKeyDisplaySelect,
  });
}

export async function createApiKeyForCompany(
  companyId: string,
  createdByUserId: string,
  input: CreateApiKeyInput,
) {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);

  const createdKey = await prisma.apiKey.create({
    data: {
      companyId,
      createdByUserId,
      name: input.name,
      keyHash,
      keyPrefix: apiKey.slice(0, 12),
      keyLast4: apiKey.slice(-4),
      status: "ACTIVE",
    },
    select: apiKeyDisplaySelect,
  });

  return {
    apiKey,
    record: createdKey,
  };
}

export async function revokeApiKey(companyId: string, apiKeyId: string) {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      companyId,
    },
  });

  if (!apiKey) {
    throw new Error("API key not found");
  }

  if (apiKey.status === "REVOKED") {
    throw new Error("API key is already revoked");
  }

  return prisma.apiKey.update({
    where: {
      id: apiKey.id,
    },
    data: {
      status: "REVOKED",
    },
    select: apiKeyDisplaySelect,
  });
}

export async function validateApiKey(rawApiKey: string) {
  const keyHash = hashApiKey(rawApiKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: {
      keyHash,
    },
    include: {
      company: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  if (apiKey.status !== "ACTIVE") {
    return null;
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  await prisma.apiKey.update({
    where: {
      id: apiKey.id,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });

  return apiKey;
}
