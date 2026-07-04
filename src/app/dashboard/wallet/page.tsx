import { CreditCard, ReceiptText, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getOrCreateWallet,
  getWalletTransactions,
  isManualWalletTopUpEnabled,
} from "@/server/services/wallet.service";
import { isCashfreeCheckoutConfigured } from "@/server/services/cashfree-payment.service";
import { getCreditPacks } from "@/server/services/credit-purchase.service";
import CreditPurchaseCheckout from "./credit-purchase-checkout";
import WalletTopupForm from "./wallet-topup-form";

function formatMoney(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    style: "currency",
  }).format(amountPaise / 100);
}

export default async function WalletPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const companyId = context.membership.companyId;

  const [wallet, transactions] = await Promise.all([
    getOrCreateWallet(companyId),
    getWalletTransactions(companyId),
  ]);
  const manualTopUpEnabled = isManualWalletTopUpEnabled();
  const cashfreeConfigured = isCashfreeCheckoutConfigured();
  const creditPacks = getCreditPacks();

  const credits = transactions
    .filter((transaction) => transaction.type === "CREDIT")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);
  const debits = transactions
    .filter((transaction) => transaction.type === "DEBIT")
    .reduce((total, transaction) => total + transaction.amountPaise, 0);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Wallet"
        description="Track the real stored wallet balance and transaction ledger used by message sending."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Wallet}
          label="Current balance"
          value={formatMoney(wallet.balancePaise)}
          detail="Stored internally in paise"
        />
        <MetricCard
          icon={CreditCard}
          label="Total credits"
          value={formatMoney(credits)}
          detail="Successful top-ups and adjustments"
        />
        <MetricCard
          icon={ReceiptText}
          label="Total debits"
          value={formatMoney(debits)}
          detail="Message and campaign charges"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {manualTopUpEnabled ? (
          <WalletTopupForm />
        ) : (
          <CreditPurchaseCheckout
            cashfreeConfigured={cashfreeConfigured}
            packs={creditPacks}
          />
        )}

        <Panel>
          <PanelTitle
            title="Transactions"
            description="Real wallet transaction history for this workspace."
          />

          {transactions.length === 0 ? (
            <div className="mt-6">
              <EmptyState>No wallet transactions yet.</EmptyState>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-zinc-500">
                    <th className="py-3 pr-4 font-medium">Type</th>
                    <th className="py-3 pr-4 font-medium">Amount</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Description</th>
                    <th className="py-3 pr-4 font-medium">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b border-white/[0.06] text-zinc-300 last:border-0"
                    >
                      <td className="py-4 pr-4">
                        <StatusPill tone={statusTone(transaction.type)}>
                          {transaction.type}
                        </StatusPill>
                      </td>

                      <td className="py-4 pr-4 font-medium text-white">
                        {formatMoney(transaction.amountPaise)}
                      </td>

                      <td className="py-4 pr-4">
                        <StatusPill tone={statusTone(transaction.status)}>
                          {transaction.status}
                        </StatusPill>
                      </td>

                      <td className="py-4 pr-4 text-zinc-500">
                        {transaction.description ?? "-"}
                      </td>

                      <td className="py-4 pr-4 text-zinc-500">
                        {transaction.createdAt.toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
