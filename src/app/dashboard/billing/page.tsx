import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getBillingSummary } from "@/server/services/wallet.service";

function formatMoney(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amountPaise / 100);
}

export default async function BillingPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { wallet, transactions, summary } = await getBillingSummary(
    context.membership.companyId,
  );

  const stats = [
    {
      label: "Current Balance",
      value: formatMoney(wallet.balancePaise),
    },
    {
      label: "Total Added",
      value: formatMoney(summary.totalCreditPaise),
    },
    {
      label: "Total Spent",
      value: formatMoney(summary.totalDebitPaise),
    },
    {
      label: "Total Refunded",
      value: formatMoney(summary.totalRefundPaise),
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to dashboard
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">Billing</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Billing Transactions
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                {summary.successfulTransactionCount} successful transaction(s)
              </p>
            </div>

            <Link
              href="/dashboard/wallet"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Top Up Wallet
            </Link>
          </div>

          {transactions.length === 0 ? (
            <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              No billing transactions yet.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Reference</th>
                    <th className="py-3 pr-4">Description</th>
                    <th className="py-3 pr-4">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {transaction.type}
                        </span>
                      </td>

                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {formatMoney(transaction.amountPaise)}
                      </td>

                      <td className="py-3 pr-4">{transaction.status}</td>

                      <td className="max-w-[180px] truncate py-3 pr-4 text-gray-600">
                        {transaction.referenceId ?? "-"}
                      </td>

                      <td className="py-3 pr-4">
                        {transaction.description ?? "-"}
                      </td>

                      <td className="py-3 pr-4">
                        {transaction.createdAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
