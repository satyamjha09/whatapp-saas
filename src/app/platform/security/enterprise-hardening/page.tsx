import Link from "next/link";
import { CompanyType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requirePlatformPermission,
} from "@/server/tenant/tenant-context";
import { roleHasPlatformPermission } from "@/server/tenant/platform-permissions";
import {
  ApprovalDecisionActions,
  ClientTransferRequestForm,
  DomainChallengeVerifyButton,
  OffboardingRequestForm,
} from "./enterprise-hardening-actions";

function dateLabel(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusClass(status: string) {
  if (["APPROVED", "COMPLETED", "VERIFIED"].includes(status)) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (["PENDING", "PENDING_APPROVAL", "IN_PROGRESS"].includes(status)) {
    return "bg-amber-50 text-amber-700";
  }

  if (["REJECTED", "FAILED", "CANCELED", "EXPIRED"].includes(status)) {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function compactJson(value: unknown) {
  if (!value) return "No metadata";

  try {
    return JSON.stringify(value).slice(0, 180);
  } catch {
    return "Metadata unavailable";
  }
}

export default async function PlatformEnterpriseHardeningPage() {
  const platform = await requirePlatformPermission("PLATFORM_SECURITY_VIEW");
  const canManagePartners = roleHasPlatformPermission(
    platform.platformRole,
    "PLATFORM_PARTNER_MANAGE",
  );
  const canVerifyDomains = roleHasPlatformPermission(
    platform.platformRole,
    "PLATFORM_DOMAIN_APPROVE",
  );

  const [
    approvals,
    partners,
    relationships,
    offboardingRuns,
    transferRequests,
    domainChallenges,
  ] = await Promise.all([
    prisma.platformApprovalRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        company: { select: { id: true, name: true, type: true, status: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        rejectedBy: { select: { id: true, name: true, email: true } },
      },
      take: 100,
    }),
    prisma.company.findMany({
      where: { type: CompanyType.PARTNER },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.partnerClientRelationship.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        partnerCompany: { select: { id: true, name: true } },
        clientCompany: { select: { id: true, name: true, status: true } },
      },
      take: 200,
    }),
    prisma.partnerOffboardingRun.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        partnerCompany: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, email: true, name: true } },
        approvalRequest: { select: { id: true, status: true } },
      },
      take: 50,
    }),
    prisma.partnerClientTransferRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        fromPartnerCompany: { select: { id: true, name: true } },
        toPartnerCompany: { select: { id: true, name: true } },
        clientCompany: { select: { id: true, name: true, status: true } },
        requestedBy: { select: { id: true, email: true, name: true } },
        approvalRequest: { select: { id: true, status: true } },
      },
      take: 50,
    }),
    prisma.partnerDomainOwnershipChallenge.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        partnerCompany: { select: { id: true, name: true } },
        domain: {
          select: {
            id: true,
            domain: true,
            normalizedHost: true,
            status: true,
            sslStatus: true,
          },
        },
      },
      take: 100,
    }),
  ]);

  const pendingApprovals = approvals.filter((approval) => approval.status === "PENDING");
  const pendingOffboarding = offboardingRuns.filter(
    (run) => run.status === "PENDING_APPROVAL",
  ).length;
  const pendingTransfers = transferRequests.filter(
    (request) => request.status === "PENDING_APPROVAL",
  ).length;
  const pendingDomains = domainChallenges.filter(
    (challenge) => challenge.status === "PENDING",
  ).length;

  const partnerOptions = partners.map((partner) => ({
    id: partner.id,
    name: `${partner.name} (${partner.status})`,
  }));
  const relationshipOptions = relationships.map((relationship) => ({
    id: relationship.id,
    partnerCompanyId: relationship.partnerCompanyId,
    clientCompanyId: relationship.clientCompanyId,
    clientName: `${relationship.clientCompany.name} (${relationship.clientCompany.status})`,
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Enterprise hardening
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              High-risk operation control
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Operate two-person approvals, partner offboarding, client
              transfers, and domain ownership checks from one secure console.
            </p>
          </div>

          <Link
            href="/platform/security"
            className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          >
            Back to security
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Pending approvals</p>
          <p className="mt-2 text-3xl font-black text-blue-700">
            {pendingApprovals.length}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Offboarding</p>
          <p className="mt-2 text-3xl font-black text-amber-700">
            {pendingOffboarding}
          </p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Client transfers</p>
          <p className="mt-2 text-3xl font-black text-purple-700">
            {pendingTransfers}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Domain TXT checks</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {pendingDomains}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <OffboardingRequestForm
          canCreate={canManagePartners}
          partners={partnerOptions}
        />
        <ClientTransferRequestForm
          canCreate={canManagePartners}
          partners={partnerOptions}
          relationships={relationshipOptions}
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">
            Approval queue
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Super admins can approve, reject, or cancel pending high-risk
            requests. Requesters cannot approve their own request.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Request</th>
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Requester</th>
                <th className="px-5 py-4">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvals.map((approval) => (
                <tr key={approval.id} className="align-top">
                  <td className="px-5 py-5">
                    <p className="font-black text-slate-950">{approval.type}</p>
                    <p className="mt-1 text-sm text-slate-600">{approval.action}</p>
                    <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
                      {approval.reason}
                    </p>
                    <code className="mt-2 block max-w-lg rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      {compactJson(approval.metadata)}
                    </code>
                  </td>
                  <td className="px-5 py-5">
                    <p className="font-semibold text-slate-900">
                      {approval.company?.name ?? "No company"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {approval.entityType}: {approval.entityId}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                        approval.status,
                      )}`}
                    >
                      {approval.status}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      Risk {approval.riskLevel}/5
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Expires {dateLabel(approval.expiresAt)}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    <p className="font-semibold text-slate-900">
                      {approval.requestedBy?.email ?? "System"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dateLabel(approval.requestedAt)}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    {approval.status === "PENDING" ? (
                      <ApprovalDecisionActions
                        approvalId={approval.id}
                        canDecide={platform.isPlatformSuperAdmin}
                        requestedByCurrentUser={
                          approval.requestedByUserId === platform.user.id
                        }
                      />
                    ) : (
                      <div className="text-sm text-slate-600">
                        <p>
                          Decided {dateLabel(approval.decidedAt)}
                        </p>
                        <p className="mt-1">
                          {approval.approvedBy?.email ??
                            approval.rejectedBy?.email ??
                            "No actor"}
                        </p>
                        {approval.decisionReason ? (
                          <p className="mt-2 text-xs">{approval.decisionReason}</p>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {approvals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No approval requests found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-black text-slate-950">
              Offboarding runs
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {offboardingRuns.map((run) => (
              <article key={run.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">
                      {run.partnerCompany.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{run.clientPolicy}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                      run.status,
                    )}`}
                  >
                    {run.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{run.reason}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Approval: {run.approvalRequest?.status ?? "None"} - Requested{" "}
                  {dateLabel(run.requestedAt)}
                </p>
              </article>
            ))}
            {offboardingRuns.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No offboarding runs yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-black text-slate-950">
              Client transfer requests
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {transferRequests.map((request) => (
              <article key={request.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">
                      {request.clientCompany.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {request.fromPartnerCompany.name}
                      {request.toPartnerCompany
                        ? ` -> ${request.toPartnerCompany.name}`
                        : " -> MetaWhat"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                      request.status,
                    )}`}
                  >
                    {request.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {request.reason}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {request.transferMode} - Approval{" "}
                  {request.approvalRequest?.status ?? "None"} - Requested{" "}
                  {dateLabel(request.requestedAt)}
                </p>
              </article>
            ))}
            {transferRequests.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No client transfer requests yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">
            Domain ownership challenges
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Verify the DNS TXT challenge before approving or transferring custom
            domains.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Domain</th>
                <th className="px-5 py-4">Partner</th>
                <th className="px-5 py-4">TXT record</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {domainChallenges.map((challenge) => (
                <tr key={challenge.id} className="align-top">
                  <td className="px-5 py-5">
                    <p className="font-black text-slate-950">
                      {challenge.domain?.domain ?? challenge.normalizedHost}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Expires {dateLabel(challenge.expiresAt)}
                    </p>
                  </td>
                  <td className="px-5 py-5 font-semibold text-slate-900">
                    {challenge.partnerCompany.name}
                  </td>
                  <td className="px-5 py-5">
                    <code className="block rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                      {challenge.txtName}
                      <br />
                      {challenge.txtValue}
                    </code>
                    {challenge.failureReason ? (
                      <p className="mt-2 text-xs font-semibold text-red-600">
                        {challenge.failureReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                        challenge.status,
                      )}`}
                    >
                      {challenge.status}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      Last checked {dateLabel(challenge.lastCheckedAt)}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    {challenge.domainId && challenge.status === "PENDING" ? (
                      <DomainChallengeVerifyButton
                        canVerify={canVerifyDomains}
                        domainId={challenge.domainId}
                      />
                    ) : (
                      <span className="text-xs text-slate-500">
                        No verification action.
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {domainChallenges.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No domain ownership challenges found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
