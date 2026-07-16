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
    amber: "bg-warning/15 text-warning-foreground ring-warning/25",
    blue: "bg-info/10 text-info ring-info/20",
    green: "bg-success/10 text-success ring-success/20",
    red: "bg-destructive/10 text-destructive ring-destructive/20",
    violet: "bg-secondary text-secondary-foreground ring-border",
    zinc: "bg-muted text-muted-foreground ring-border",
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
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring/40 focus:ring-4 focus:ring-ring/10 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export const labelClass = "mb-2 block text-sm font-semibold text-foreground";

export const helperTextClass = "mt-2 text-xs leading-5 text-muted-foreground";

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
