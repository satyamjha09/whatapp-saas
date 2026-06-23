import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/server/auth/platform-admin";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import {
  getPlatformOverview,
  listPlatformCompanies,
} from "@/server/services/platform-ops.service";

type PlatformPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function formatPaise(value: number | null | undefined) {
  return `INR ${((value ?? 0) / 100).toFixed(2)}`;
}

export default async function PlatformPage({
  searchParams,
}: PlatformPageProps) {
  let platformAdmin;

  try {
    platformAdmin = await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q?.trim();

  const [overview, companies] = await Promise.all([
    getPlatformOverview(),
    listPlatformCompanies({
      query,
      take: 50,
    }),
  ]);

  await createPlatformAuditLog({
    actorUserId: platformAdmin.user?.id,
    actorEmail: platformAdmin.email,
    action: "platform.dashboard.viewed",
    entityType: "Platform",
    metadata: {
      query,
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Platform Ops</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Super Admin Console
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Internal view of companies, usage, billing, WhatsApp status, and risk signals.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-5">
        {[
          ["Companies", overview.companyCount],
          ["Users", overview.userCount],
          ["WA Connected", overview.connectedWhatsAppAccounts],
          ["Messages / 24h", overview.messages24h],
          ["Failed / 24h", overview.failedMessages24h],
          ["Inbound / 24h", overview.inboundMessages24h],
          ["Credit Purchases Today", overview.creditPurchasesToday],
          ["Subscriptions Today", overview.subscriptionPaymentsToday],
          ["Webhook Failures / 24h", overview.failedWebhookEvents24h],
          ["Active API Keys", overview.activeApiKeys],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <form className="mt-8 flex gap-3">
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search company name or exact company ID"
          className="w-full rounded-xl border px-4 py-2 text-sm outline-none focus:border-gray-900"
        />
        <button className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Companies</h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Subscription</th>
                <th className="px-6 py-3">WhatsApp</th>
                <th className="px-6 py-3">Wallet</th>
                <th className="px-6 py-3">Counts</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {companies.map((company) => {
                const wa = company.whatsAppAccounts[0];

                return (
                  <tr key={company.id}>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/platform/companies/${company.id}`}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {company.name}
                      </Link>
                      <div className="font-mono text-xs text-gray-500">
                        {company.id}
                      </div>
                    </td>

                    <td className="px-6 py-4">{company.billingPlan}</td>
                    <td className="px-6 py-4">{company.subscriptionStatus}</td>

                    <td className="px-6 py-4">
                      {wa ? (
                        <div>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              wa.status === "CONNECTED"
                                ? "bg-green-50 text-green-700"
                                : "bg-yellow-50 text-yellow-700"
                            }`}
                          >
                            {wa.status}
                          </span>
                          <div className="mt-1 max-w-xs truncate text-xs text-gray-500">
                            {wa.businessName ?? wa.wabaId ?? "-"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {formatPaise(company.wallet?.balancePaise)}
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-600">
                      Users {company._count.users} · Contacts{" "}
                      {company._count.contacts} · Msg {company._count.messages}
                    </td>

                    <td className="px-6 py-4">
                      {company.createdAt.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
