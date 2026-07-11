"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  actionButtonClass,
  EmptyState,
  MetricCard,
  Panel,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";

type CatalogRow = {
  createdAt: string;
  id: string;
  isUsable: boolean;
  lastSyncedAt: string | null;
  metaCatalogId: string;
  name: string;
  productCount: number;
  remoteMissingAt: string | null;
  status: string;
  updatedAt: string;
  vertical: string | null;
  whatsAppAccount: {
    businessName: string | null;
    id: string;
    status: string;
    wabaId: string | null;
  };
  whatsAppAccountId: string;
};

type ConnectedAccountSummary = {
  hasAccessToken: boolean;
  id: string;
  status: string;
  wabaId: string | null;
} | null;

type SyncResponse = {
  message?: string;
  result?: {
    summary?: {
      created: number;
      markedMissing: number;
      remoteFound: number;
      updated: number;
      usable: number;
    };
  };
};

function formatDate(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function relativeDate(value: string | null) {
  if (!value) return "Never synced";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never synced";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function pageHref(page: number) {
  return `/dashboard/catalogs?page=${page}`;
}

export default function WhatsAppCatalogManagementClient({
  canSync,
  catalogs,
  connectedAccount,
  pagination,
}: {
  canSync: boolean;
  catalogs: CatalogRow[];
  connectedAccount: ConnectedAccountSummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}) {
  const router = useRouter();
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const latestSync = useMemo(() => {
    const synced = catalogs
      .map((catalog) => catalog.lastSyncedAt)
      .filter((value): value is string => Boolean(value))
      .sort();

    return synced.at(-1) ?? null;
  }, [catalogs]);

  const usableCount = catalogs.filter(
    (catalog) => catalog.isUsable && !catalog.remoteMissingAt,
  ).length;
  const totalProducts = catalogs.reduce(
    (sum, catalog) => sum + catalog.productCount,
    0,
  );

  function handleSync() {
    setSyncError("");
    setSyncMessage("");
    setIsSyncing(true);

    void (async () => {
      try {
        const response = await fetch("/api/whatsapp/catalogs", {
          method: "POST",
        });
        const data = (await response.json()) as SyncResponse;

        if (!response.ok) {
          throw new Error(data.message || "Catalog sync failed");
        }

        const summary = data.result?.summary;
        setSyncMessage(
          summary
            ? `${summary.remoteFound} Catalog(s) synced. ${summary.created} new, ${summary.updated} updated, ${summary.markedMissing} unavailable.`
            : data.message || "Catalogs synced.",
        );
        router.refresh();
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Catalog sync failed.",
        );
      } finally {
        setIsSyncing(false);
      }
    })();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Local catalog records synced from Meta"
          icon={Database}
          label="Synced catalogs"
          value={pagination.total}
        />
        <MetricCard
          detail="Catalogs returned by the latest Meta sync"
          icon={ShieldCheck}
          label="Usable catalogs"
          value={usableCount}
        />
        <MetricCard
          detail="Metadata count only; product sync comes later"
          icon={Boxes}
          label="Remote products"
          value={totalProducts}
        />
      </div>

      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#081B3A]">
              Last successful sync: {relativeDate(latestSync)}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              This page stores Commerce Catalog metadata for the connected WABA.
              It does not sync products or send catalog messages yet.
            </p>
          </div>

          <button
            className={actionButtonClass()}
            disabled={!canSync || isSyncing}
            onClick={handleSync}
            type="button"
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? "Syncing Catalogs..." : "Sync from Meta"}
          </button>
        </div>

        {!connectedAccount ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Connect a WhatsApp Business Account before syncing Catalogs.
          </p>
        ) : !connectedAccount.wabaId || !connectedAccount.hasAccessToken ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            The connected WhatsApp account is missing a WABA ID or access token.
            Reconnect the account, then sync again.
          </p>
        ) : null}

        {!canSync ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Only owners and admins can sync Catalog metadata.
          </p>
        ) : null}

        {syncMessage ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {syncMessage}
          </p>
        ) : null}

        {syncError ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {syncError}
          </p>
        ) : null}
      </Panel>

      <Panel className="p-0 sm:p-0">
        {catalogs.length === 0 ? (
          <div className="p-5">
            <EmptyState>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[#081B3A]">
                    No WhatsApp Catalogs synced yet.
                  </p>
                  <p className="mt-1">
                    Click Sync from Meta after your WhatsApp account is
                    connected. If Meta returns no Catalogs, this company may not
                    have a Commerce Catalog attached to its WABA yet.
                  </p>
                </div>
                <button
                  className={actionButtonClass()}
                  disabled={!canSync || isSyncing}
                  onClick={handleSync}
                  type="button"
                >
                  Sync from Meta
                </button>
              </div>
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#BFE9D0] text-left text-sm">
                <thead className="bg-[#E7F8EF] text-xs uppercase tracking-normal text-[#128C7E]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Catalog</th>
                    <th className="px-4 py-3 font-semibold">Meta IDs</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Products</th>
                    <th className="px-4 py-3 font-semibold">Last synced</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BFE9D0] bg-white">
                  {catalogs.map((catalog) => (
                    <tr key={catalog.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#081B3A]">
                          {catalog.name}
                        </p>
                        <p className="mt-1 text-xs text-[#526173]">
                          {catalog.vertical || "No vertical from Meta"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs leading-5 text-[#526173]">
                        <p>
                          <span className="font-semibold text-[#081B3A]">
                            Local:
                          </span>{" "}
                          {catalog.id}
                        </p>
                        <p>
                          <span className="font-semibold text-[#081B3A]">
                            Meta:
                          </span>{" "}
                          {catalog.metaCatalogId}
                        </p>
                        <p>
                          <span className="font-semibold text-[#081B3A]">
                            WABA:
                          </span>{" "}
                          {catalog.whatsAppAccount.wabaId || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill
                          tone={
                            catalog.remoteMissingAt
                              ? "red"
                              : statusTone(catalog.status)
                          }
                        >
                          {catalog.remoteMissingAt
                            ? "Missing from Meta"
                            : catalog.status}
                        </StatusPill>
                        <p className="mt-2 text-xs text-[#526173]">
                          {catalog.isUsable
                            ? "Connected to this workspace"
                            : "Not usable for new template work"}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-semibold text-[#081B3A]">
                        {catalog.productCount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#526173]">
                        {formatDate(catalog.lastSyncedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          className={actionButtonClass("secondary")}
                          href={`/dashboard/catalogs/${catalog.id}`}
                        >
                          Open Catalog
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#BFE9D0] p-4 text-sm text-[#526173] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing page {pagination.page} of {pagination.totalPages} ·{" "}
                {pagination.total} catalog record
                {pagination.total === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                {pagination.page > 1 ? (
                  <Link
                    className={actionButtonClass("secondary")}
                    href={pageHref(pagination.page - 1)}
                  >
                    Previous
                  </Link>
                ) : null}
                {pagination.page < pagination.totalPages ? (
                  <Link
                    className={actionButtonClass("secondary")}
                    href={pageHref(pagination.page + 1)}
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
