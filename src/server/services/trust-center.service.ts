import crypto from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  Prisma,
  TrustDocumentAcceptanceSource,
  TrustDocumentType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  companyTrustAcceptanceCacheTag,
  TRUST_CENTER_ACCEPTANCE_CACHE_TAG,
  TRUST_CENTER_DOCUMENTS_CACHE_TAG,
} from "@/server/cache-tags";

const DEFAULT_REQUIRED_DOCUMENT_TYPES: TrustDocumentType[] = [
  "TERMS_OF_SERVICE",
  "PRIVACY_POLICY",
  "DATA_PROCESSING_AGREEMENT",
];

const DEFAULT_DOCUMENTS: Array<{
  type: TrustDocumentType;
  title: string;
  slug: string;
  version: string;
  content: string;
}> = [
  {
    type: "TERMS_OF_SERVICE",
    title: "Terms of Service",
    slug: "terms-of-service",
    version: "2026-06-24",
    content:
      "# Terms of Service\n\nThese Terms govern access to and use of metawhat. By accepting them on behalf of a company, you confirm that you are authorized to bind that company and that its use of the service will comply with applicable law and platform policies.",
  },
  {
    type: "PRIVACY_POLICY",
    title: "Privacy Policy",
    slug: "privacy-policy",
    version: "2026-06-24",
    content:
      "# Privacy Policy\n\nThis policy describes how metawhat processes account, contact, messaging, billing, security, and usage data to provide, secure, support, and improve the service, and how data-subject requests can be submitted.",
  },
  {
    type: "DATA_PROCESSING_AGREEMENT",
    title: "Data Processing Agreement",
    slug: "data-processing-agreement",
    version: "2026-06-24",
    content:
      "# Data Processing Agreement\n\nThis agreement defines the parties' controller and processor responsibilities, security obligations, subprocessors, assistance with data-subject requests, incident notification, deletion, and audit cooperation.",
  },
];

export class LegalAcceptanceRequiredError extends Error {
  constructor(
    message = "Required legal documents must be accepted before using this API endpoint.",
  ) {
    super(message);
    this.name = "LegalAcceptanceRequiredError";
  }
}

function revalidateTrustCenterDocumentsCache() {
  revalidateTag(TRUST_CENTER_DOCUMENTS_CACHE_TAG, "max");
  revalidateTag(TRUST_CENTER_ACCEPTANCE_CACHE_TAG, "max");
}

function revalidateTrustCenterAcceptanceCache(companyId: string) {
  revalidateTag(companyTrustAcceptanceCacheTag(companyId), "max");
}

function isEnabled() {
  return process.env.TRUST_CENTER_ENABLED !== "false";
}

export function requireTermsAcceptance() {
  return process.env.TRUST_CENTER_REQUIRE_TERMS_ACCEPTANCE !== "false";
}

export function requirePublicApiAcceptance() {
  return (
    process.env.TRUST_CENTER_REQUIRE_ACCEPTANCE_FOR_PUBLIC_API !== "false"
  );
}

export function requiredDocumentTypes(): TrustDocumentType[] {
  const validTypes = new Set(Object.values(TrustDocumentType));
  const configured = (
    process.env.TRUST_CENTER_REQUIRED_DOCUMENT_TYPES ??
    DEFAULT_REQUIRED_DOCUMENT_TYPES.join(",")
  )
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is TrustDocumentType =>
      validTypes.has(item as TrustDocumentType),
    );

  return [...new Set(configured)];
}

function contentHash(content: string) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export async function seedDefaultTrustDocuments() {
  const documents = [];

  for (const input of DEFAULT_DOCUMENTS) {
    const hash = contentHash(input.content);
    const document = await prisma.trustDocument.upsert({
      where: {
        slug_version: {
          slug: input.slug,
          version: input.version,
        },
      },
      create: {
        ...input,
        contentHash: hash,
        status: "PUBLISHED",
        publishedAt: new Date(),
        effectiveAt: new Date(),
      },
      update: {
        type: input.type,
        title: input.title,
        content: input.content,
        contentHash: hash,
        status: "PUBLISHED",
      },
    });

    documents.push(document);
  }

  revalidateTrustCenterDocumentsCache();

  return documents;
}

export const listLatestRequiredTrustDocuments = unstable_cache(
async function listLatestRequiredTrustDocuments() {
  const requiredTypes = requiredDocumentTypes();
  const documents = await prisma.trustDocument.findMany({
    where: {
      status: "PUBLISHED",
      type: { in: requiredTypes },
    },
    orderBy: [{ type: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });
  const latestByType = new Map<TrustDocumentType, (typeof documents)[number]>();

  for (const document of documents) {
    if (!latestByType.has(document.type)) latestByType.set(document.type, document);
  }

  return requiredTypes
    .map((type) => latestByType.get(type))
    .filter((document): document is (typeof documents)[number] => Boolean(document));
},
  ["latest-required-trust-documents"],
  {
    revalidate: 60,
    tags: [TRUST_CENTER_DOCUMENTS_CACHE_TAG],
  },
);

async function getPublishedTrustDocumentBySlugUncached(slug: string) {
  return prisma.trustDocument.findFirst({
    where: { slug, status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export function getPublishedTrustDocumentBySlug(slug: string) {
  return unstable_cache(
    async () => getPublishedTrustDocumentBySlugUncached(slug),
    ["published-trust-document-by-slug", slug],
    {
      revalidate: 60,
      tags: [TRUST_CENTER_DOCUMENTS_CACHE_TAG],
    },
  )();
}

async function getCompanyTrustAcceptanceStatusUncached({
  companyId,
}: {
  companyId: string;
}) {
  const types = requiredDocumentTypes();
  const documents = await listLatestRequiredTrustDocuments();
  const acceptances = documents.length
    ? await prisma.trustDocumentAcceptance.findMany({
        where: { companyId, documentId: { in: documents.map(({ id }) => id) } },
      })
    : [];
  const acceptedDocumentIds = new Set(
    acceptances.map((acceptance) => acceptance.documentId),
  );
  const publishedTypes = new Set(documents.map((document) => document.type));
  const missingDocumentTypes = types.filter((type) => !publishedTypes.has(type));
  const missingDocuments = documents.filter(
    (document) => !acceptedDocumentIds.has(document.id),
  );

  return {
    required: requireTermsAcceptance(),
    documents,
    acceptances,
    missingDocuments,
    missingDocumentTypes,
    isComplete:
      missingDocumentTypes.length === 0 && missingDocuments.length === 0,
  };
}

export function getCompanyTrustAcceptanceStatus({
  companyId,
}: {
  companyId: string;
}) {
  return unstable_cache(
    async () => getCompanyTrustAcceptanceStatusUncached({ companyId }),
    ["company-trust-acceptance-status", companyId],
    {
      revalidate: 60,
      tags: [
        TRUST_CENTER_DOCUMENTS_CACHE_TAG,
        companyTrustAcceptanceCacheTag(companyId),
      ],
    },
  )();
}

export async function acceptTrustDocument({
  companyId,
  userId,
  documentId,
  source,
  ipAddress,
  userAgent,
  metadata,
}: {
  companyId: string;
  userId?: string | null;
  documentId: string;
  source: TrustDocumentAcceptanceSource;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const document = await prisma.trustDocument.findFirst({
    where: { id: documentId, status: "PUBLISHED" },
  });

  if (!document) throw new Error("Published trust document not found");

  const acceptance = await prisma.trustDocumentAcceptance.upsert({
    where: { companyId_documentId: { companyId, documentId } },
    create: {
      companyId,
      userId: userId ?? null,
      documentId,
      documentType: document.type,
      documentVersion: document.version,
      documentHash: document.contentHash,
      source,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      metadata: metadata ?? {},
    },
    update: {},
  });

  revalidateTrustCenterAcceptanceCache(companyId);

  return acceptance;
}

export async function acceptAllRequiredTrustDocuments({
  companyId,
  userId,
  ipAddress,
  userAgent,
}: {
  companyId: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const status = await getCompanyTrustAcceptanceStatus({ companyId });

  if (status.missingDocumentTypes.length > 0) {
    throw new Error(
      `Required legal documents are not published: ${status.missingDocumentTypes.join(", ")}`,
    );
  }

  const acceptances = [];
  for (const document of status.missingDocuments) {
    acceptances.push(
      await acceptTrustDocument({
        companyId,
        userId,
        documentId: document.id,
        source: "DASHBOARD",
        ipAddress,
        userAgent,
        metadata: { acceptedFrom: "required-legal-acceptance-gate" },
      }),
    );
  }

  return { acceptedCount: acceptances.length, acceptances };
}

export async function assertCompanyAcceptedRequiredTrustDocuments({
  companyId,
}: {
  companyId: string;
}) {
  const status = await getCompanyTrustAcceptanceStatus({ companyId });
  if (status.required && !status.isComplete) {
    throw new LegalAcceptanceRequiredError();
  }
}

export async function getTrustCenterHealth() {
  const [publishedDocuments, draftDocuments, archivedDocuments, acceptances24h, requiredDocuments] =
    await Promise.all([
      prisma.trustDocument.count({ where: { status: "PUBLISHED" } }),
      prisma.trustDocument.count({ where: { status: "DRAFT" } }),
      prisma.trustDocument.count({ where: { status: "ARCHIVED" } }),
      prisma.trustDocumentAcceptance.count({
        where: { acceptedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      listLatestRequiredTrustDocuments(),
    ]);
  const requiredTypes = requiredDocumentTypes();

  return {
    enabled: isEnabled(),
    requireTermsAcceptance: requireTermsAcceptance(),
    publishedDocuments,
    draftDocuments,
    archivedDocuments,
    acceptances24h,
    requiredDocuments: requiredDocuments.length,
    requiredDocumentTypes: requiredTypes,
    isHealthy:
      isEnabled() &&
      publishedDocuments > 0 &&
      requiredDocuments.length === requiredTypes.length,
  };
}
