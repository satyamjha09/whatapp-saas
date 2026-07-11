"use client";

/* eslint-disable @next/next/no-img-element -- Product image hosts come from Meta catalogs and are not known at build time. */

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  actionButtonClass,
  EmptyState,
  fieldClass,
  Panel,
  StatusPill,
} from "@/app/dashboard/dashboard-ui";

type CatalogSummary = {
  id: string;
  isUsable: boolean;
  lastSyncedAt: string | null;
  metaCatalogId: string;
  name: string;
  productCount: number;
  remoteMissingAt: string | null;
  status: string;
  vertical: string | null;
  whatsAppAccount: {
    businessName: string | null;
    id: string;
    status: string;
    wabaId: string | null;
  };
};

type ProductRow = {
  availability: string | null;
  brand: string | null;
  category: string | null;
  condition: string | null;
  currency: string | null;
  description: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  isUsable: boolean;
  lastSyncedAt: string | null;
  metaProductId: string;
  name: string;
  priceAmount: string | null;
  productUrl: string | null;
  remoteMissingAt: string | null;
  retailerId: string | null;
  updatedAt: string;
};

type SyncResponse = {
  message?: string;
  result?: {
    summary?: {
      created: number;
      markedMissing: number;
      remoteFound: number;
      unchanged: number;
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

function formatPrice(product: ProductRow) {
  if (!product.priceAmount) return "-";

  const amount = Number(product.priceAmount);
  if (!Number.isFinite(amount)) return product.priceAmount;

  return new Intl.NumberFormat("en-IN", {
    currency: product.currency || "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function productStatus(product: ProductRow) {
  if (product.remoteMissingAt) {
    return { label: "Missing from Meta", tone: "red" as const };
  }

  if (!product.isActive) {
    return { label: "Inactive", tone: "amber" as const };
  }

  if (product.isUsable) {
    return { label: "Usable", tone: "green" as const };
  }

  return { label: "Unavailable", tone: "zinc" as const };
}

function buildHref({
  availability,
  catalogId,
  page,
  search,
  usableOnly,
}: {
  availability: string;
  catalogId: string;
  page?: number;
  search: string;
  usableOnly: boolean;
}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (availability && availability !== "ALL") params.set("availability", availability);
  if (usableOnly) params.set("usableOnly", "true");
  if (page && page > 1) params.set("page", String(page));

  const query = params.toString();
  return `/dashboard/catalogs/${catalogId}${query ? `?${query}` : ""}`;
}

export default function CatalogProductsClient({
  availabilityOptions,
  canSync,
  catalog,
  filters,
  pagination,
  products,
}: {
  availabilityOptions: string[];
  canSync: boolean;
  catalog: CatalogSummary;
  filters: {
    availability: string;
    search: string;
    usableOnly: boolean;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  products: ProductRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [availability, setAvailability] = useState(filters.availability);
  const [usableOnly, setUsableOnly] = useState(filters.usableOnly);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildHref({
        availability,
        catalogId: catalog.id,
        search,
        usableOnly,
      }),
    );
  }

  function handleSync() {
    setSyncError("");
    setSyncMessage("");
    setIsSyncing(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/whatsapp/catalogs/${catalog.id}/products/sync`,
          {
            method: "POST",
          },
        );
        const data = (await response.json()) as SyncResponse;

        if (!response.ok) {
          throw new Error(data.message || "Product sync failed");
        }

        const summary = data.result?.summary;
        setSyncMessage(
          summary
            ? `${summary.remoteFound} product(s) synced. ${summary.created} new, ${summary.updated} updated, ${summary.markedMissing} unavailable.`
            : data.message || "Products synced.",
        );
        router.refresh();
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Product sync failed.",
        );
      } finally {
        setIsSyncing(false);
      }
    })();
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[#128C7E]">
                Meta Catalog ID
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-[#081B3A]">
                {catalog.metaCatalogId}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#128C7E]">
                WABA ID
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-[#081B3A]">
                {catalog.whatsAppAccount.wabaId || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#128C7E]">
                Product count
              </p>
              <p className="mt-1 text-sm font-semibold text-[#081B3A]">
                {catalog.productCount.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#128C7E]">
                Last product sync
              </p>
              <p className="mt-1 text-sm font-semibold text-[#081B3A]">
                {formatDate(products[0]?.lastSyncedAt ?? null)}
              </p>
            </div>
          </div>

          <button
            className={actionButtonClass()}
            disabled={!canSync || isSyncing || !catalog.isUsable}
            onClick={handleSync}
            type="button"
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? "Syncing Products..." : "Sync Products"}
          </button>
        </div>

        {!canSync ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Only owners and admins can sync product metadata.
          </p>
        ) : null}

        {catalog.remoteMissingAt ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            This Catalog is missing from Meta. Sync Catalogs before syncing
            products.
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
        <form
          className="grid gap-3 border-b border-[#BFE9D0] p-4 lg:grid-cols-[minmax(0,1fr)_190px_150px_auto]"
          onSubmit={applyFilters}
        >
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
            <input
              className={`${fieldClass} pl-10`}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product name, retailer ID, brand, description"
              value={search}
            />
          </label>
          <select
            className={fieldClass}
            onChange={(event) => setAvailability(event.target.value)}
            value={availability}
          >
            <option value="ALL">All availability</option>
            {availabilityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm font-medium text-[#102040]">
            <input
              checked={usableOnly}
              className="h-4 w-4 accent-[#128C7E]"
              onChange={(event) => setUsableOnly(event.target.checked)}
              type="checkbox"
            />
            Usable only
          </label>
          <button className={actionButtonClass()} type="submit">
            Apply
          </button>
        </form>

        {products.length === 0 ? (
          <div className="p-5">
            <EmptyState>
              <div className="flex items-start gap-3">
                <PackageSearch className="mt-0.5 h-5 w-5 text-[#128C7E]" />
                <div>
                  <p className="font-semibold text-[#081B3A]">
                    No products found.
                  </p>
                  <p className="mt-1">
                    Sync products from Meta first, or adjust your local
                    filters. Search never calls Meta directly.
                  </p>
                </div>
              </div>
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#BFE9D0] text-left text-sm">
                <thead className="bg-[#E7F8EF] text-xs uppercase tracking-normal text-[#128C7E]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Image</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Retailer ID</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Availability</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Last synced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BFE9D0] bg-white">
                  {products.map((product) => {
                    const status = productStatus(product);

                    return (
                      <tr key={product.id}>
                        <td className="px-4 py-4">
                          {product.imageUrl ? (
                            <img
                              alt=""
                              className="h-14 w-14 rounded-xl border border-[#BFE9D0] object-cover"
                              src={product.imageUrl}
                            />
                          ) : (
                            <div className="grid h-14 w-14 place-items-center rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]">
                              <PackageSearch className="h-5 w-5" />
                            </div>
                          )}
                        </td>
                        <td className="max-w-xs px-4 py-4">
                          <p className="font-semibold text-[#081B3A]">
                            {product.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#526173]">
                            {product.brand ? `${product.brand} · ` : ""}
                            {product.description || product.category || "-"}
                          </p>
                          {product.productUrl ? (
                            <a
                              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E]"
                              href={product.productUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              View source
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-xs leading-5 text-[#526173]">
                          <p className="font-semibold text-[#081B3A]">
                            {product.retailerId || "-"}
                          </p>
                          <p>Meta: {product.metaProductId}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#081B3A]">
                          {formatPrice(product)}
                        </td>
                        <td className="px-4 py-4 text-[#526173]">
                          {product.availability || "-"}
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        </td>
                        <td className="px-4 py-4 text-[#526173]">
                          {formatDate(product.lastSyncedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#BFE9D0] p-4 text-sm text-[#526173] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing page {pagination.page} of {pagination.totalPages} ·{" "}
                {pagination.total} product{pagination.total === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                {pagination.page > 1 ? (
                  <Link
                    className={actionButtonClass("secondary")}
                    href={buildHref({
                      availability,
                      catalogId: catalog.id,
                      page: pagination.page - 1,
                      search,
                      usableOnly,
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {pagination.page < pagination.totalPages ? (
                  <Link
                    className={actionButtonClass("secondary")}
                    href={buildHref({
                      availability,
                      catalogId: catalog.id,
                      page: pagination.page + 1,
                      search,
                      usableOnly,
                    })}
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
