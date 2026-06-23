import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/server/auth/platform-admin";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { getPlatformCompanyDetail } from "@/server/services/platform-ops.service";

type CompanyOpsPageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

function formatPaise(value: number | null | undefined) {
  return `INR ${((value ?? 0) / 100).toFixed(2)}`;
}

export default async function CompanyOpsPage({ params }: CompanyOpsPageProps) {
  let platformAdmin;

  try {
    platformAdmin = await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const { companyId } = await params;
  const detail = await getPlatformCompanyDetail({ companyId });

  if (!detail) {
    notFound();
  }

  const { company } = detail;

  await createPlatformAuditLog({
    actorUserId: platformAdmin.user?.id,
    actorEmail: platformAdmin.email,
    action: "platform.company.viewed",
    entityType: "Company",
    entityId: company.id,
    metadata: {
      companyName: company.name,
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/dashboard/platform"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Back to Platform
      </Link>

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Company</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              {company.name}
            </h1>
            <p className="mt-1 font-mono text-xs text-gray-500">{company.id}</p>
          </div>

          <div className="flex gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {company.billingPlan}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {company.subscriptionStatus}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Wallet</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatPaise(company.wallet?.balancePaise)}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Contacts</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {company._count.contacts}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Messages</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {company._count.messages}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Messages / 24h</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {detail.stats.messages24h}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Failed / 24h</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {detail.stats.failedMessages24h}
            </p>
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Team</h2>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {company.users.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {member.user.name ?? member.user.email}
                    </div>
                    <div className="text-xs text-gray-500">
                      {member.user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">{member.role}</td>
                  <td className="px-4 py-3">
                    {member.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">WhatsApp Accounts</h2>

        <div className="mt-4 space-y-3">
          {company.whatsAppAccounts.length === 0 ? (
            <p className="text-sm text-gray-600">No WhatsApp account connected.</p>
          ) : (
            company.whatsAppAccounts.map((account) => (
              <div key={account.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {account.businessName ?? "Unnamed Business"}
                    </p>
                    <p className="font-mono text-xs text-gray-500">
                      WABA: {account.wabaId ?? "-"}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {account.status}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {account.phoneNumbers.map((phone) => (
                    <div key={phone.id} className="rounded-lg bg-gray-50 p-3">
                      <p className="text-sm font-medium text-gray-900">
                        {phone.displayPhoneNumber ?? "-"}
                      </p>
                      <p className="font-mono text-xs text-gray-500">
                        {phone.phoneNumberId ?? "-"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Quality: {phone.qualityRating ?? "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Latest Messages</h2>
          <div className="mt-4 space-y-3">
            {detail.latestMessages.map((message) => (
              <div key={message.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-gray-900">
                    {message.direction} · {message.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {message.createdAt.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  To {message.toPhoneNumber}
                </p>
                {message.status === "FAILED" && (
                  <p className="mt-1 text-xs text-red-600">
                    {message.body.slice(0, 160)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Latest Webhooks</h2>
          <div className="mt-4 space-y-3">
            {detail.latestWebhookEvents.map((event) => (
              <div key={event.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-gray-900">
                    {event.source} · {event.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {event.createdAt.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {event.eventType ?? "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Latest Company Audit Logs
        </h2>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {detail.latestAuditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.entityType} {log.entityId ?? ""}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
