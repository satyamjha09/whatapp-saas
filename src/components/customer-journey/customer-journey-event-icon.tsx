"use client";

import {
  MessageSquare,
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  Workflow,
  Clock,
  CheckCircle2,
  UserCheck,
  User,
  CreditCard,
  Database,
  FileSpreadsheet,
  Sparkles,
  Tag,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import type { CustomerJourneyEventType } from "@/lib/customer-journey/journey-types";

type CustomerJourneyEventIconProps = {
  type: CustomerJourneyEventType;
  className?: string;
};

export default function CustomerJourneyEventIcon({
  type,
  className = "h-4 w-4",
}: CustomerJourneyEventIconProps) {
  switch (type) {
    case "CONTACT_CREATED":
    case "CONTACT_IMPORTED":
      return <User className={`${className} text-[#0052CC]`} />;
    case "TAG_ADDED":
    case "TAG_REMOVED":
      return <Tag className={`${className} text-slate-600`} />;
    case "LEAD_SCORE_CHANGED":
      return <TrendingUp className={`${className} text-amber-600`} />;

    case "CAMPAIGN_SENT":
    case "MESSAGE_SENT":
      return <Send className={`${className} text-[#128C7E]`} />;
    case "CAMPAIGN_DELIVERED":
    case "MESSAGE_DELIVERED":
      return <CheckCheck className={`${className} text-slate-500`} />;
    case "CAMPAIGN_READ":
    case "MESSAGE_READ":
      return <Eye className={`${className} text-sky-600`} />;
    case "CAMPAIGN_FAILED":
    case "MESSAGE_FAILED":
    case "AUTOMATION_FAILED":
    case "PAYMENT_FAILED":
      return <AlertCircle className={`${className} text-rose-600`} />;

    case "INBOUND_MESSAGE":
    case "BUTTON_CLICKED":
    case "LIST_ITEM_SELECTED":
      return <MessageSquare className={`${className} text-[#128C7E]`} />;

    case "AUTOMATION_STARTED":
    case "AUTOMATION_NODE_EXECUTED":
      return <Workflow className={`${className} text-indigo-600`} />;
    case "AUTOMATION_WAITING":
      return <Clock className={`${className} text-amber-600`} />;
    case "AUTOMATION_COMPLETED":
      return <CheckCircle2 className={`${className} text-emerald-600`} />;

    case "HUMAN_HANDOFF":
      return <UserCheck className={`${className} text-purple-600`} />;
    case "AGENT_REPLY":
      return <User className={`${className} text-blue-600`} />;

    case "PAYMENT_LINK_CREATED":
    case "PAYMENT_COMPLETED":
      return <CreditCard className={`${className} text-emerald-600`} />;

    case "TALLY_LOOKUP":
      return <Database className={`${className} text-cyan-600`} />;
    case "GOOGLE_SHEET_UPDATED":
      return <FileSpreadsheet className={`${className} text-emerald-600`} />;
    case "AI_REPLY_CREATED":
      return <Sparkles className={`${className} text-fuchsia-600`} />;

    default:
      return <HelpCircle className={`${className} text-slate-400`} />;
  }
}
