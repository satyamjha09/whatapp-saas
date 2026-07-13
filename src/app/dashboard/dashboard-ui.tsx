import type { LucideIcon } from "lucide-react";
import {
  MetaCard,
  MetaEmptyState,
  MetaMetricCard,
  MetaPageHeader,
  MetaPanelTitle,
  metaActionButtonClass,
} from "@/components/metawhat/ui";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <MetaPageHeader
      actions={actions}
      description={description}
      eyebrow={eyebrow}
      title={title}
    />
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <MetaCard className={className}>{children}</MetaCard>;
}

export function PanelTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return <MetaPanelTitle description={description} title={title} />;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return <MetaMetricCard detail={detail} icon={Icon} label={label} value={value} />;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <MetaEmptyState>{children}</MetaEmptyState>;
}

export function StatusPill({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "green" | "blue" | "amber" | "red" | "violet";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-100 text-rose-700 ring-rose-200",
    violet: "bg-[#075E54]/10 text-[#075E54] ring-[#075E54]/20",
    zinc: "bg-slate-100 text-[#526173] ring-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function actionButtonClass(variant: "primary" | "secondary" = "primary") {
  return metaActionButtonClass(variant);
}

export const fieldClass =
  "w-full rounded-xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm text-[#102040] outline-none transition placeholder:text-[#526173]/60 focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#526173]";

export const labelClass = "mb-2 block text-sm font-semibold text-[#102040]";

export const helperTextClass = "mt-2 text-xs leading-5 text-[#526173]";

export function statusTone(
  status: string,
): "zinc" | "green" | "blue" | "amber" | "red" | "violet" {
  if (
    [
      "CONNECTED",
      "APPROVED",
      "SENT",
      "DELIVERED",
      "READ",
      "SUCCESS",
      "COMPLETED",
      "ACTIVE",
      "PUBLISHED",
    ].includes(status)
  ) {
    return "green";
  }

  if (
    [
      "QUEUED",
      "SENDING",
      "RETRY_PENDING",
      "PENDING",
      "PENDING_APPROVAL",
      "RUNNING",
      "SCHEDULED",
      "TRIALING",
      "WAITING",
      "WAITING_FOR_REPLY",
      "PAUSED",
    ].includes(status)
  ) {
    return "amber";
  }

  if (
    [
      "FAILED",
      "PARTIAL_FAILED",
      "REJECTED",
      "ERROR",
      "DISCONNECTED",
      "CANCELLED",
      "CANCELED",
      "PAST_DUE",
      "INCOMPLETE",
      "DELETED",
      "DISABLED",
      "LIMIT_EXCEEDED",
      "ABANDONED",
      "ARCHIVED",
    ].includes(status)
  ) {
    return "red";
  }

  if (["RECEIVED", "OPEN", "DRAFT"].includes(status)) {
    return "blue";
  }

  return "zinc";
}
