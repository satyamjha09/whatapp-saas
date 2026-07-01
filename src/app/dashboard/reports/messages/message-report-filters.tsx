"use client";

import { Download, Filter, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";

type InitialFilters = {
  direction?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
};

export default function MessageReportFilters({
  initialFilters,
}: {
  initialFilters: InitialFilters;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState(initialFilters.direction ?? "");
  const [status, setStatus] = useState(initialFilters.status ?? "");
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");

  function buildQuery() {
    const params = new URLSearchParams();
    if (direction) params.set("direction", direction);
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = buildQuery().toString();
    router.push(`/dashboard/reports/messages${query ? `?${query}` : ""}`);
  }

  const exportQuery = buildQuery().toString();

  return (
    <form
      onSubmit={applyFilters}
      className="mb-6 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)]"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label htmlFor="report-direction" className={labelClass}>
            Direction
          </label>
          <select
            id="report-direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className={fieldClass}
          >
            <option value="">All directions</option>
            <option value="INBOUND">Inbound</option>
            <option value="OUTBOUND">Outbound</option>
          </select>
        </div>
        <div>
          <label htmlFor="report-status" className={labelClass}>
            Status
          </label>
          <select
            id="report-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={fieldClass}
          >
            <option value="">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENDING">Sending</option>
            <option value="RETRY_PENDING">Retry pending</option>
            <option value="RECEIVED">Received</option>
            <option value="SENT">Sent</option>
            <option value="DELIVERED">Delivered</option>
            <option value="READ">Read</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </div>
        <div>
          <label htmlFor="report-from" className={labelClass}>
            From
          </label>
          <input
            id="report-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="report-to" className={labelClass}>
            To
          </label>
          <input
            id="report-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="report-search" className={labelClass}>
            Search
          </label>
          <input
            id="report-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Phone, name, message or Meta ID"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" className={actionButtonClass()}>
          <Filter className="mr-2 h-4 w-4" />
          Apply Filters
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/reports/messages")}
          className={actionButtonClass("secondary")}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </button>
        <a
          href={`/api/reports/messages/export${exportQuery ? `?${exportQuery}` : ""}`}
          className={actionButtonClass("secondary")}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </a>
      </div>
    </form>
  );
}
