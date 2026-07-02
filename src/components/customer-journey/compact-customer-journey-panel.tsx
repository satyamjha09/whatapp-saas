"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, History } from "lucide-react";
import type { CustomerJourneyEvent } from "@/lib/customer-journey/journey-types";
import CustomerJourneyEventIcon from "./customer-journey-event-icon";

type CompactCustomerJourneyPanelProps = {
  contactId: string;
};

export default function CompactCustomerJourneyPanel({ contactId }: CompactCustomerJourneyPanelProps) {
  const [events, setEvents] = useState<CustomerJourneyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const res = await fetch(`/api/contacts/${contactId}/journey?pageSize=10`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {
        // Silent catch for compact panel
      } finally {
        setLoading(false);
      }
    }

    void fetchEvents();
  }, [contactId]);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#0052CC]" />
          <h3 className="text-xs font-bold text-[#081B3A] uppercase tracking-wider">
            Customer Journey
          </h3>
        </div>
        <Link
          href={`/dashboard/contacts/${contactId}/timeline`}
          className="text-[11px] font-semibold text-[#0052CC] hover:underline flex items-center gap-1"
        >
          <span>Full Journey</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-500 py-2 text-center">No journey activity yet.</p>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {events.map((ev) => {
            const timeStr = new Date(ev.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={ev.id}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="mt-0.5 shrink-0">
                  <CustomerJourneyEventIcon type={ev.type} className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-bold text-slate-800 truncate">{ev.title}</p>
                    <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>
                  </div>
                  {ev.description && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {ev.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
