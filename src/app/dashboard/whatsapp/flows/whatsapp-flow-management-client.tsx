"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Workflow,
} from "lucide-react";
import {
  actionButtonClass,
  EmptyState,
  fieldClass,
  Panel,
  StatusPill,
} from "@/app/dashboard/dashboard-ui";

type FlowStatusFilter = "ALL" | "USABLE" | "PUBLISHED" | "DRAFT" | "UNAVAILABLE";

type FlowRow = {
  categories: unknown;
  defaultCta: string;
  defaultScreen: string | null;
  id: string;
  isUsableForTemplates: boolean;
  lastSyncedAt: string | null;
  metaFlowId: string;
  name: string;
  remoteMissingAt: string | null;
  remoteStatus: string | null;
  responseCount: number;
  status: string;
  updatedAt: string;
  validationErrors: unknown;
};

type SyncResponse = {
  message?: string;
  result?: {
    summary?: {
      created: number;
      markedMissing: number;
      remoteFound: number;
      updated: number;
      usableForTemplates: number;
    };
    syncedAt?: string;
  };
};

function statusTone(flow: FlowRow) {
  if (flow.remoteMissingAt) return "red" as const;
  if (flow.status === "PUBLISHED") return "green" as const;
  if (flow.status === "DRAFT") return "blue" as const;
  if (flow.status === "DISABLED" || flow.status === "DEPRECATED") {
    return "red" as const;
  }

  return "zinc" as const;
}

function displayStatus(flow: FlowRow) {
  if (flow.remoteMissingAt) return "Unavailable";
  return flow.remoteStatus ?? flow.status;
}

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

function categoryText(categories: unknown) {
  if (Array.isArray(categories) && categories.length > 0) {
    return categories
      .map((category) => String(category))
      .filter(Boolean)
      .join(", ");
  }

  return "-";
}

function validationSummary(validationErrors: unknown) {
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    return `${validationErrors.length} validation issue${
      validationErrors.length === 1 ? "" : "s"
    }`;
  }

  return "No validation issues stored";
}

function buildTemplateHref(flow: FlowRow) {
  const params = new URLSearchParams({
    category: "MARKETING",
    flowId: flow.id,
    language: "en_US",
    name: flow.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80),
  });

  return `/dashboard/templates/new/flow?${params.toString()}`;
}

function isStaleSync(flows: FlowRow[]) {
  const synced = flows
    .map((flow) => flow.lastSyncedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (synced.length === 0) return false;

  const latest = Math.max(...synced);
  return Date.now() - latest > 7 * 24 * 60 * 60 * 1000;
}

export default function WhatsAppFlowManagementClient({
  canSync,
  flows,
}: {
  canSync: boolean;
  flows: FlowRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FlowStatusFilter>("ALL");
  const [selectedFlow, setSelectedFlow] = useState<FlowRow | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const filteredFlows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return flows.filter((flow) => {
      const matchesQuery =
        !normalizedQuery ||
        flow.name.toLowerCase().includes(normalizedQuery) ||
        flow.metaFlowId.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;

      if (statusFilter === "USABLE") return flow.isUsableForTemplates;
      if (statusFilter === "PUBLISHED") return flow.status === "PUBLISHED";
      if (statusFilter === "DRAFT") return flow.status === "DRAFT";
      if (statusFilter === "UNAVAILABLE") return Boolean(flow.remoteMissingAt);

      return true;
    });
  }, [flows, query, statusFilter]);

  const latestSync = useMemo(() => {
    const synced = flows
      .map((flow) => flow.lastSyncedAt)
      .filter((value): value is string => Boolean(value))
      .sort();

    return synced.at(-1) ?? null;
  }, [flows]);

  function handleSync() {
    setSyncError("");
    setSyncMessage("");
    setIsSyncing(true);

    void (async () => {
      try {
        const response = await fetch("/api/whatsapp-flows/sync", {
          method: "POST",
        });
        const data = (await response.json()) as SyncResponse;

        if (!response.ok) {
          throw new Error(data.message || "Flow sync failed");
        }

        const summary = data.result?.summary;
        setSyncMessage(
          summary
            ? `${summary.remoteFound} Flow asset(s) synced. ${summary.created} new, ${summary.updated} updated, ${summary.markedMissing} unavailable.`
            : data.message || "Flow assets synced.",
        );
        router.refresh();
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Flow sync failed.",
        );
      } finally {
        setIsSyncing(false);
      }
    })();
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#081B3A]">
              Last successful sync: {relativeDate(latestSync)}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              Flow Template Builder reads this local list. It does not call Meta
              on every page load.
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
            {isSyncing ? "Syncing Flows..." : "Sync from Meta"}
          </button>
        </div>

        {!canSync ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Only owners and admins can sync Flow assets.
          </p>
        ) : null}

        {isStaleSync(flows) ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Flow data may be outdated. Sync again before creating new Flow
            templates.
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
        <div className="grid gap-3 border-b border-[#BFE9D0] p-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526173]" />
            <input
              className={`${fieldClass} pl-10`}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Flow name or Meta Flow ID"
              value={query}
            />
          </label>

          <select
            className={fieldClass}
            onChange={(event) =>
              setStatusFilter(event.target.value as FlowStatusFilter)
            }
            value={statusFilter}
          >
            <option value="ALL">All statuses</option>
            <option value="USABLE">Usable</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>
        </div>

        {flows.length === 0 ? (
          <div className="p-5">
            <EmptyState>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  No Flows synced yet. Connect WhatsApp, then sync your Flow
                  assets from Meta.
                </span>
                <button
                  className={actionButtonClass("secondary")}
                  disabled={!canSync || isSyncing}
                  onClick={handleSync}
                  type="button"
                >
                  Sync from Meta
                </button>
              </div>
            </EmptyState>
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="p-5">
            <EmptyState>No Flows match your search.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#E7F8EF] text-xs uppercase text-[#526173]">
                <tr>
                  <th className="px-5 py-3">Flow</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Template availability</th>
                  <th className="px-5 py-3">Last synced</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BFE9D0]">
                {filteredFlows.map((flow) => (
                  <tr key={flow.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#E7F8EF] text-[#128C7E]">
                          <Workflow className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#081B3A]">
                            {flow.name}
                          </p>
                          <p className="truncate text-xs text-[#526173]">
                            Meta Flow ID: {flow.metaFlowId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={statusTone(flow)}>
                        {displayStatus(flow)}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      {categoryText(flow.categories)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill
                        tone={flow.isUsableForTemplates ? "green" : "zinc"}
                      >
                        {flow.isUsableForTemplates
                          ? "Ready for templates"
                          : "Not available"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4 text-[#526173]">
                      <span className="block font-medium text-[#081B3A]">
                        {relativeDate(flow.lastSyncedAt)}
                      </span>
                      <span className="text-xs">{formatDate(flow.lastSyncedAt)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={actionButtonClass("secondary")}
                          onClick={() => setSelectedFlow(flow)}
                          type="button"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View details
                        </button>
                        {flow.isUsableForTemplates ? (
                          <Link
                            className={actionButtonClass()}
                            href={buildTemplateHref(flow)}
                          >
                            Use in template
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selectedFlow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#081B3A]/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-xl rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-[#128C7E]">
                  Flow details
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#081B3A]">
                  {selectedFlow.name}
                </h2>
              </div>
              <button
                className={actionButtonClass("secondary")}
                onClick={() => setSelectedFlow(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-[#F8FCFA] p-3">
                <dt className="text-xs font-bold uppercase text-[#526173]">
                  Local ID
                </dt>
                <dd className="mt-1 break-all font-semibold text-[#081B3A]">
                  {selectedFlow.id}
                </dd>
              </div>
              <div className="rounded-xl bg-[#F8FCFA] p-3">
                <dt className="text-xs font-bold uppercase text-[#526173]">
                  Meta Flow ID
                </dt>
                <dd className="mt-1 break-all font-semibold text-[#081B3A]">
                  {selectedFlow.metaFlowId}
                </dd>
              </div>
              <div className="rounded-xl bg-[#F8FCFA] p-3">
                <dt className="text-xs font-bold uppercase text-[#526173]">
                  Remote status
                </dt>
                <dd className="mt-1 font-semibold text-[#081B3A]">
                  {displayStatus(selectedFlow)}
                </dd>
              </div>
              <div className="rounded-xl bg-[#F8FCFA] p-3">
                <dt className="text-xs font-bold uppercase text-[#526173]">
                  Last synced
                </dt>
                <dd className="mt-1 font-semibold text-[#081B3A]">
                  {formatDate(selectedFlow.lastSyncedAt)}
                </dd>
              </div>
              <div className="rounded-xl bg-[#F8FCFA] p-3">
                <dt className="text-xs font-bold uppercase text-[#526173]">
                  Category
                </dt>
                <dd className="mt-1 font-semibold text-[#081B3A]">
                  {categoryText(selectedFlow.categories)}
                </dd>
              </div>
              <div className="rounded-xl bg-[#F8FCFA] p-3">
                <dt className="text-xs font-bold uppercase text-[#526173]">
                  Responses
                </dt>
                <dd className="mt-1 font-semibold text-[#081B3A]">
                  {selectedFlow.responseCount.toLocaleString("en-IN")}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] p-3 text-sm text-[#526173]">
              {validationSummary(selectedFlow.validationErrors)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
