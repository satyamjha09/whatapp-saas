import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  actionButtonClass,
  PageHeader,
  Panel,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import TallySyncClient from "./tally-sync-client";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function TallyOrderSyncPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const canManage =
    context.membership.role === "OWNER" || context.membership.role === "ADMIN";

  const [runs, mappings, contacts, products] = await Promise.all([
    prisma.tallyOrderSyncRun.findMany({
      where: { companyId },
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
    Promise.all([
      prisma.tallyCustomerMapping.findMany({
        where: { companyId },
        orderBy: [{ contactId: "asc" }, { updatedAt: "desc" }],
        take: 100,
      }),
      prisma.tallyProductMapping.findMany({
        where: { companyId },
        orderBy: [{ localProductId: "asc" }, { updatedAt: "desc" }],
        take: 100,
      }),
    ]),
    prisma.contact.findMany({
      where: { companyId },
      orderBy: [{ name: "asc" }, { phoneNumber: "asc" }],
      select: { id: true, name: true, phoneNumber: true },
      take: 500,
    }),
    prisma.whatsAppCatalogProduct.findMany({
      where: { companyId },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, retailerId: true },
      take: 500,
    }),
  ]);

  const [customerMappings, productMappings] = mappings;

  return (
    <div>
      <PageHeader
        actions={
          <Link className={actionButtonClass("secondary")} href="/dashboard/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        }
        description="Import Tally Sales Orders, map ledgers to contacts, map stock items to catalog products, and keep order history idempotent. Tally-owned fields are order number, date, items, amounts, and known external status. Local WhatsApp state stays local."
        eyebrow={context.membership.company.name}
        title="Tally Order Sync"
      />

      <Panel>
        {canManage ? (
          <TallySyncClient
            contacts={contacts.map((contact) => ({
              id: contact.id,
              label: `${contact.name || "Unnamed"} (+91${contact.phoneNumber})`,
            }))}
            customerMappings={customerMappings.map((mapping) => ({
              confidence: mapping.confidence,
              contactId: mapping.contactId,
              id: mapping.id,
              matchSource: mapping.matchSource,
              tallyCompanyId: mapping.tallyCompanyId,
              tallyLedgerId: mapping.tallyLedgerId,
              tallyLedgerName: mapping.tallyLedgerName,
            }))}
            productMappings={productMappings.map((mapping) => ({
              id: mapping.id,
              localProductId: mapping.localProductId,
              matchSource: mapping.matchSource,
              tallyCompanyId: mapping.tallyCompanyId,
              tallyStockItemId: mapping.tallyStockItemId,
              tallyStockItemName: mapping.tallyStockItemName,
            }))}
            products={products.map((product) => ({
              id: product.id,
              label: `${product.name}${product.retailerId ? ` (${product.retailerId})` : ""}`,
            }))}
          />
        ) : (
          <p className="text-sm text-[#526173]">
            You can view sync history, but only owners and admins can run Tally syncs.
          </p>
        )}
      </Panel>

      <Panel className="mt-5">
        <h2 className="text-lg font-bold text-[#081B3A]">Recent sync runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-[#E7F8EF] text-xs uppercase text-[#526173]">
              <tr>
                <th className="px-3 py-3">Started</th>
                <th className="px-3 py-3">Tally company</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Found</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Updated</th>
                <th className="px-3 py-3">Failed</th>
                <th className="px-3 py-3">Unmapped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7F8EF]">
              {runs.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-[#526173]" colSpan={8}>
                    No Tally sync runs yet.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-3 py-4 text-[#526173]">{formatDate(run.startedAt)}</td>
                    <td className="px-3 py-4 text-[#081B3A]">{run.tallyCompanyId}</td>
                    <td className="px-3 py-4">
                      <StatusPill tone={statusTone(run.status)}>{run.status}</StatusPill>
                    </td>
                    <td className="px-3 py-4">{run.ordersFound}</td>
                    <td className="px-3 py-4">{run.createdCount}</td>
                    <td className="px-3 py-4">{run.updatedCount}</td>
                    <td className="px-3 py-4">{run.failedCount}</td>
                    <td className="px-3 py-4">
                      {run.unmappedCustomerCount + run.unmappedProductCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
