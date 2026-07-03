"use client";

import {
  Calendar,
  Clock,
  MessageSquare,
  Send,
  Workflow,
  UserCheck,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import type { CustomerJourneySummary } from "@/lib/customer-journey/journey-types";

type CustomerJourneySummaryProps = {
  summary: CustomerJourneySummary;
};

export default function CustomerJourneySummaryCards({ summary }: CustomerJourneySummaryProps) {
  const firstSeenDate = summary.firstSeenAt
    ? new Date(summary.firstSeenAt).toLocaleDateString()
    : "N/A";
  const lastActivityDate = summary.lastActivityAt
    ? new Date(summary.lastActivityAt).toLocaleDateString()
    : "N/A";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">First Seen</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">{firstSeenDate}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Last Activity</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">{lastActivityDate}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
          <Send className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Messages Sent</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">{summary.messagesReceived}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-600">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Customer Replies</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">{summary.repliesCount}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
          <Workflow className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Automations</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">
            {summary.automationsStarted} ({summary.automationsCompleted} completed)
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600">
          <UserCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Handoffs</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">{summary.handoffCount}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-green-50 text-green-600">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Payments</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">
            {summary.paymentsCompleted} paid · {summary.paymentLinksCreated} links
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Lead Score</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">{summary.currentLeadScore ?? 0} pts</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D8E6F3] shadow-xs flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526173]">Campaigns</p>
          <p className="text-sm font-bold text-[#081B3A] mt-0.5">{summary.campaignsReceived}</p>
        </div>
      </div>
    </div>
  );
}
