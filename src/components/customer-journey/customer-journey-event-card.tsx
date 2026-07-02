"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { CustomerJourneyEvent } from "@/lib/customer-journey/journey-types";
import CustomerJourneyEventIcon from "./customer-journey-event-icon";

type CustomerJourneyEventCardProps = {
  event: CustomerJourneyEvent;
};

export default function CustomerJourneyEventCard({ event }: CustomerJourneyEventCardProps) {
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const formattedTime = new Date(event.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

  return (
    <div className="relative flex gap-4 pb-6 group">
      {/* Connector line */}
      <div className="absolute left-4 top-8 -bottom-2 w-0.5 bg-slate-200 group-last:hidden" />

      {/* Icon circle */}
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-xs">
        <CustomerJourneyEventIcon type={event.type} className="h-4 w-4" />
      </div>

      {/* Card content */}
      <div className="flex-1 rounded-xl border border-[#D8E6F3] bg-white p-4 shadow-xs transition hover:border-[#0052CC]/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-[#081B3A]">{event.title}</h4>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {event.source}
              </span>
            </div>
            {event.description && (
              <p className="mt-1 text-xs text-[#526173] leading-relaxed">{event.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">{formattedTime}</span>
            {event.status && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                  event.status === "COMPLETED" || event.status === "READ" || event.status === "DELIVERED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : event.status === "FAILED"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                {event.status}
              </span>
            )}
          </div>
        </div>

        {/* Action Links */}
        {event.links && (
          <div className="mt-3 flex flex-wrap gap-3 pt-2 border-t border-slate-100 text-xs">
            {event.links.automationExecutionId && (
              <Link
                href={`/dashboard/automation/executions/${event.links.automationExecutionId}`}
                className="flex items-center gap-1 font-semibold text-[#0052CC] hover:underline"
              >
                <span>View Execution Log</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {event.links.campaignId && (
              <Link
                href={`/dashboard/campaigns/${event.links.campaignId}`}
                className="flex items-center gap-1 font-semibold text-[#0052CC] hover:underline"
              >
                <span>View Campaign</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {event.links.inboxContactId && (
              <Link
                href={`/dashboard/inbox/${event.links.inboxContactId}`}
                className="flex items-center gap-1 font-semibold text-[#128C7E] hover:underline"
              >
                <span>Open in Inbox</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {/* Collapsible Metadata */}
        {hasMetadata && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"
            >
              <span>{isMetadataExpanded ? "Hide Details" : "Show Event Details"}</span>
              {isMetadataExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {isMetadataExpanded && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100 font-mono">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
