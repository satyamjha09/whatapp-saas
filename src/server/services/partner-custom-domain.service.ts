import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import tls from "node:tls";
import {
  CompanyType,
  PartnerCustomDomainHealthStatus,
  PartnerCustomDomainSslStatus,
  PartnerCustomDomainStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createPartnerDomainOwnershipChallenge } from "@/server/services/enterprise-hardening.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  PartnerCustomDomainActionInput,
  PartnerCustomDomainCreateInput,
} from "@/server/validators/partner-custom-domain.validator";
import { normalizeCustomDomain } from "@/server/validators/partner-custom-domain.validator";

export class PartnerCustomDomainError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerCustomDomainError";
    this.status = status;
  }
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function expectedCnameTarget() {
  return (process.env.CUSTOM_DOMAIN_CNAME_TARGET || "metawhat.in")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function expectedATarget() {
  return process.env.CUSTOM_DOMAIN_A_TARGET?.trim() || null;
}

function verificationForHost(host: string, token = randomBytes(18).toString("hex")) {
  return {
    token,
    txtName: `_metawhat.${host}`,
    txtValue: `metawhat-domain-verification=${token}`,
  };
}

async function assertPartnerCompany(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: { id: partnerCompanyId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      supportEmail: true,
    },
  });

  if (!partner || partner.type !== CompanyType.PARTNER) {
    throw new PartnerCustomDomainError("Partner company not found.", 404);
  }

  return partner;
}

async function resolveTxtValues(name: string) {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((record) => record.join(""));
  } catch {
    return [];
  }
}

async function checkDnsRecord({
  host,
  txtName,
  txtValue,
}: {
  host: string;
  txtName: string;
  txtValue: string;
}) {
  const txtValues = await resolveTxtValues(txtName);
  const txtVerified = txtValues.includes(txtValue);

  let cnameVerified = false;
  let aVerified = false;
  let resolvedCname: string[] = [];
  let resolvedA: string[] = [];

  try {
    resolvedCname = (await dns.resolveCname(host)).map((value) =>
      value.toLowerCase().replace(/\.$/, ""),
    );
    cnameVerified = resolvedCname.includes(expectedCnameTarget());
  } catch {
    resolvedCname = [];
  }

  const expectedA = expectedATarget();
  if (expectedA) {
    try {
      resolvedA = await dns.resolve4(host);
      aVerified = resolvedA.includes(expectedA);
    } catch {
      resolvedA = [];
    }
  }

  return {
    txtVerified,
    hostResolved: cnameVerified || aVerified,
    resolvedCname,
    resolvedA,
    expectedCname: expectedCnameTarget(),
    expectedA,
    txtValues,
  };
}

async function checkSsl(host: string) {
  return new Promise<{
    status: PartnerCustomDomainSslStatus;
    error: string | null;
  }>((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        timeout: 6000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
        const hasValidCertificate =
          socket.authorized && (!validTo || validTo.getTime() > Date.now());

        socket.end();
        resolve({
          status: hasValidCertificate
            ? PartnerCustomDomainSslStatus.ISSUED
            : PartnerCustomDomainSslStatus.FAILED,
          error: hasValidCertificate
            ? null
            : socket.authorizationError?.toString() || "SSL certificate is not trusted.",
        });
      },
    );

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        status: PartnerCustomDomainSslStatus.FAILED,
        error: "SSL check timed out.",
      });
    });

    socket.on("error", (error) => {
      resolve({
        status: PartnerCustomDomainSslStatus.FAILED,
        error: error.message,
      });
    });
  });
}

export async function listPlatformCustomDomains() {
  return prisma.partnerCustomDomain.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      partnerCompany: {
        select: {
          id: true,
          name: true,
          status: true,
          childCompanies: {
            select: { id: true },
          },
        },
      },
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function listPartnerCustomDomains(partnerCompanyId: string) {
  await assertPartnerCompany(partnerCompanyId);

  return prisma.partnerCustomDomain.findMany({
    where: { partnerCompanyId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createPartnerCustomDomain({
  actorEmail,
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: PartnerCustomDomainCreateInput & { partnerCompanyId: string };
}) {
  const partner = await assertPartnerCompany(input.partnerCompanyId);
  const normalizedHost = normalizeCustomDomain(input.domain);
  const existing = await prisma.partnerCustomDomain.findUnique({
    where: { normalizedHost },
  });

  if (existing) {
    if (existing.partnerCompanyId === partner.id) return existing;
    throw new PartnerCustomDomainError("This domain is already registered.", 409);
  }

  const verification = verificationForHost(normalizedHost);
  const domain = await prisma.partnerCustomDomain.create({
    data: {
      partnerCompanyId: partner.id,
      domain: normalizedHost,
      normalizedHost,
      verificationToken: verification.token,
      verificationTxtName: verification.txtName,
      verificationTxtValue: verification.txtValue,
      status: PartnerCustomDomainStatus.REQUESTED,
      sslStatus: PartnerCustomDomainSslStatus.UNKNOWN,
      healthStatus: PartnerCustomDomainHealthStatus.UNKNOWN,
      metadata: safeJson({
        expectedCname: expectedCnameTarget(),
        expectedA: expectedATarget(),
      }),
    },
  });

  await createPartnerDomainOwnershipChallenge({
    partnerCompanyId: partner.id,
    domainId: domain.id,
    normalizedHost,
  }).catch(() => undefined);

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_domain.requested",
    entityType: "PartnerCustomDomain",
    entityId: domain.id,
    metadata: {
      partnerCompanyId: partner.id,
      domain: normalizedHost,
    },
  }).catch(() => undefined);

  return domain;
}

export async function resolvePartnerCustomDomainByHost(host: string) {
  let normalizedHost: string;

  try {
    normalizedHost = normalizeCustomDomain(host);
  } catch {
    return null;
  }

  return prisma.partnerCustomDomain.findFirst({
    where: {
      normalizedHost,
      status: PartnerCustomDomainStatus.APPROVED,
      disabledAt: null,
    },
    include: {
      partnerCompany: true,
    },
  });
}

export async function listPartnerDomainRecords() {
  return prisma.company.findMany({
    where: {
      type: CompanyType.PARTNER,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      status: true,
      childCompanies: {
        select: { id: true },
      },
      partnerCustomDomains: {
        orderBy: { updatedAt: "desc" },
        include: {
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

export async function checkPartnerCustomDomain({
  actorEmail,
  actorUserId,
  domainId,
  partnerCompanyId,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  domainId: string;
  partnerCompanyId?: string | null;
}) {
  const domain = await prisma.partnerCustomDomain.findUnique({
    where: { id: domainId },
  });

  if (!domain || (partnerCompanyId && domain.partnerCompanyId !== partnerCompanyId)) {
    throw new PartnerCustomDomainError("Custom domain not found.", 404);
  }

  const dnsResult = await checkDnsRecord({
    host: domain.normalizedHost,
    txtName: domain.verificationTxtName,
    txtValue: domain.verificationTxtValue,
  });
  const sslResult = dnsResult.hostResolved
    ? await checkSsl(domain.normalizedHost)
    : {
        status: PartnerCustomDomainSslStatus.PENDING,
        error: "Domain is not pointing to MetaWhat yet.",
      };
  const now = new Date();
  const healthStatus =
    dnsResult.txtVerified && dnsResult.hostResolved && sslResult.status === "ISSUED"
      ? PartnerCustomDomainHealthStatus.HEALTHY
      : PartnerCustomDomainHealthStatus.UNHEALTHY;

  const nextStatus = dnsResult.txtVerified
    ? domain.status === PartnerCustomDomainStatus.REQUESTED ||
      domain.status === PartnerCustomDomainStatus.PENDING_DNS
      ? PartnerCustomDomainStatus.DNS_VERIFIED
      : domain.status
    : domain.status === PartnerCustomDomainStatus.REQUESTED
      ? PartnerCustomDomainStatus.PENDING_DNS
      : domain.status;

  const updated = await prisma.partnerCustomDomain.update({
    where: { id: domain.id },
    data: {
      status: nextStatus,
      dnsVerifiedAt: dnsResult.txtVerified ? domain.dnsVerifiedAt ?? now : null,
      lastDnsCheckAt: now,
      lastHostResolvedAt: dnsResult.hostResolved ? now : domain.lastHostResolvedAt,
      sslStatus: sslResult.status,
      lastSslCheckAt: now,
      healthStatus,
      lastHealthCheckAt: now,
      lastError:
        healthStatus === PartnerCustomDomainHealthStatus.HEALTHY
          ? null
          : sslResult.error ||
            (!dnsResult.txtVerified
              ? "Verification TXT record was not found."
              : "Domain host record is not pointing to MetaWhat."),
      metadata: safeJson({
        expectedCname: dnsResult.expectedCname,
        expectedA: dnsResult.expectedA,
        resolvedCname: dnsResult.resolvedCname,
        resolvedA: dnsResult.resolvedA,
        txtVerified: dnsResult.txtVerified,
        hostResolved: dnsResult.hostResolved,
      }),
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_domain.checked",
    entityType: "PartnerCustomDomain",
    entityId: updated.id,
    metadata: {
      partnerCompanyId: updated.partnerCompanyId,
      status: updated.status,
      healthStatus: updated.healthStatus,
      sslStatus: updated.sslStatus,
    },
  }).catch(() => undefined);

  return updated;
}

export async function transitionPartnerCustomDomain({
  actorEmail,
  actorUserId,
  input,
  partnerCompanyId,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  partnerCompanyId?: string | null;
  input: PartnerCustomDomainActionInput;
}) {
  const existing = await prisma.partnerCustomDomain.findUnique({
    where: { id: input.domainId },
  });

  if (!existing || (partnerCompanyId && existing.partnerCompanyId !== partnerCompanyId)) {
    throw new PartnerCustomDomainError("Custom domain not found.", 404);
  }

  if (input.action === "verify_dns" || input.action === "check_health") {
    return checkPartnerCustomDomain({
      actorEmail,
      actorUserId,
      domainId: existing.id,
      partnerCompanyId,
    });
  }

  const now = new Date();
  let data: Prisma.PartnerCustomDomainUpdateInput;

  if (input.action === "submit") {
    if (!existing.dnsVerifiedAt) {
      throw new PartnerCustomDomainError("Verify DNS before submitting for approval.");
    }
    data = {
      status: PartnerCustomDomainStatus.PENDING_APPROVAL,
      submittedAt: now,
      rejectionReason: null,
    };
  } else if (input.action === "approve") {
    if (!existing.dnsVerifiedAt) {
      throw new PartnerCustomDomainError("DNS must be verified before approval.");
    }
    data = {
      status: PartnerCustomDomainStatus.APPROVED,
      approvedAt: now,
      ...(actorUserId
        ? { approvedBy: { connect: { id: actorUserId } } }
        : {}),
      rejectionReason: null,
      disabledAt: null,
      sslStatus:
        existing.sslStatus === PartnerCustomDomainSslStatus.ISSUED
          ? PartnerCustomDomainSslStatus.ISSUED
          : PartnerCustomDomainSslStatus.PENDING,
    };
  } else if (input.action === "reject") {
    data = {
      status: PartnerCustomDomainStatus.REJECTED,
      rejectionReason:
        input.rejectionReason?.trim() || "Rejected by platform admin.",
    };
  } else {
    data = {
      status: PartnerCustomDomainStatus.DISABLED,
      disabledAt: now,
      healthStatus: PartnerCustomDomainHealthStatus.UNHEALTHY,
    };
  }

  const updated = await prisma.partnerCustomDomain.update({
    where: { id: existing.id },
    data,
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: `partner_domain.${input.action}`,
    entityType: "PartnerCustomDomain",
    entityId: updated.id,
    metadata: {
      partnerCompanyId: updated.partnerCompanyId,
      domain: updated.normalizedHost,
      status: updated.status,
      rejectionReason: input.rejectionReason,
    },
  }).catch(() => undefined);

  return updated;
}
