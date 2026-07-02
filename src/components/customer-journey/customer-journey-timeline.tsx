"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import type { CustomerJourneyEvent, CustomerJourneyResponse } from "@/lib/customer-journey/journey-types";
import CustomerJourneySummaryCards from "./customer-journey-summary";
import CustomerJourneyFilters from "./customer-journey-filters";
import CustomerJourneyEventCard from "./customer-journey-event-card";
import CustomerJourneyEmptyState from "./customer-journey-empty-state";

type CustomerJourneyTimelineProps = {
  contactId: string;
  showSummary?: boolean;
};

function formatGroupDateKey(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CustomerJourneyTimeline({
  contactId,
  showSummary = true,
}: CustomerJourneyTimelineProps) {
  const [journeyData, setJourneyData] = useState<CustomerJourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters State
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [dateRange, setDateRange] = useState("90d");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    async function fetchJourney() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("pageSize", pageSize.toString());
        params.set("sortOrder", sortOrder);

        if (selectedSource !== "ALL") {
          params.set("source", selectedSource);
        }

        if (dateRange !== "all") {
          const days = parseInt(dateRange.replace("d", ""), 10) || 90;
          const start = new Date(Date.now() - days * 86400 * 1000).toISOString();
          params.set("startDate", start);
        }

        const res = await fetch(`/api/contacts/${contactId}/journey?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Unable to load customer journey timeline.");
        }

        const data = await res.json();
        setJourneyData(data);
      } catch (err: unknown) {
        const errorVal = err as Error;
        setError(errorVal.message || "Failed to load timeline.");
      } finally {
        setLoading(false);
      }
    }

    void fetchJourney();
  }, [contactId, page, selectedSource, dateRange, sortOrder]);

  // Group events by Date string
  const groupedEvents = useMemo(() => {
    if (!journeyData?.events) return [];

    const groups: Array<{ dateHeader: string; events: CustomerJourneyEvent[] }> = [];
    let currentHeader = "";
    let currentGroup: CustomerJourneyEvent[] = [];

    journeyData.events.forEach((event) => {
      const header = formatGroupDateKey(event.timestamp);
      if (header !== currentHeader) {
        if (currentGroup.length > 0) {
          groups.push({ dateHeader: currentHeader, events: currentGroup });
        }
        currentHeader = header;
        currentGroup = [event];
      } else {
        currentGroup.push(event);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ dateHeader: currentHeader, events: currentGroup });
    }

    return groups;
  }, [journeyData]);

  if (loading && !journeyData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 text-[#0052CC] animate-spin" />
        <p className="text-xs text-[#526173]">Loading customer journey...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Summary Cards */}
      {showSummary && journeyData?.summary && (
        <CustomerJourneySummaryCards summary={journeyData.summary} />
      )}

      {/* Filter Toolbar */}
      <CustomerJourneyFilters
        selectedType="ALL"
        selectedSource={selectedSource}
        selectedDateRange={dateRange}
        sortOrder={sortOrder}
        onTypeChange={() => {}}
        onSourceChange={(src) => {
          setSelectedSource(src);
          setPage(1);
        }}
        onDateRangeChange={(rng) => {
          setDateRange(rng);
          setPage(1);
        }}
        onSortOrderChange={(ord) => {
          setSortOrder(ord);
          setPage(1);
        }}
      />

      {/* Timeline List */}
      {!journeyData || journeyData.events.length === 0 ? (
        <CustomerJourneyEmptyState />
      ) : (
        <div className="space-y-8 bg-white p-6 rounded-xl border border-[#D8E6F3]">
          {groupedEvents.map((group) => (
            <div key={group.dateHeader} className="space-y-4">
              {/* Date Group Header */}
              <div className="sticky top-0 z-20 inline-block rounded-full border border-[#D8E6F3] bg-[#F8FAFC] px-3 py-1 text-xs font-bold text-[#081B3A] shadow-2xs">
                {group.dateHeader}
              </div>

              {/* Events in date group */}
              <div className="pt-2">
                {group.events.map((event) => (
                  <CustomerJourneyEventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {journeyData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-600">
              <span>
                Page {journeyData.pagination.page} of {journeyData.pagination.totalPages} ({journeyData.pagination.total} events)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={page >= journeyData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
