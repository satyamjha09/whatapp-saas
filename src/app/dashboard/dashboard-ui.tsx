import type { LucideIcon } from "lucide-react";

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
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-[#081B3A] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
            {description}
          </p>
        </div>

        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

export function PanelTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[#081B3A]">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-[#526173]">{description}</p>
      ) : null}
    </div>
  );
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
  return (
    <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-sm text-[#526173]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#081B3A]">{value}</p>
      {detail ? <p className="mt-2 text-xs text-[#526173]">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#BFE9D0] bg-[#E7F8EF] p-5 text-sm leading-6 text-[#526173]">
      {children}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "green" | "blue" | "amber" | "red" | "violet";
}) {
  const tones = {
    amber: "bg-[#F8C830]/20 text-[#081B3A] ring-[#F8C830]/35",
    blue: "bg-[#E7F8EF] text-[#128C7E] ring-[#BFE9D0]",
    green: "bg-[#22C55E]/12 text-[#15803d] ring-[#22C55E]/25",
    red: "bg-rose-100 text-rose-700 ring-rose-200",
    violet: "bg-[#075E54]/10 text-[#075E54] ring-[#075E54]/20",
    zinc: "bg-[#E7F8EF] text-[#526173] ring-[#BFE9D0]",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1",
        tones[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function actionButtonClass(variant: "primary" | "secondary" = "primary") {
  if (variant === "secondary") {
    return "inline-flex items-center justify-center rounded-xl border border-[#BFE9D0] bg-white px-4 py-2.5 text-sm font-semibold text-[#128C7E] transition hover:border-[#128C7E]/30 hover:bg-[#E7F8EF]";
  }

  return "inline-flex items-center justify-center rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-60";
}

export const fieldClass =
  "w-full rounded-xl border border-[#BFE9D0] bg-white px-4 py-3 text-sm text-[#102040] outline-none transition placeholder:text-[#526173]/60 focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10";

export const labelClass = "mb-2 block text-sm font-medium text-[#102040]";

export const helperTextClass = "mt-2 text-xs leading-5 text-[#526173]";

export function statusTone(status: string): "zinc" | "green" | "blue" | "amber" | "red" | "violet" {
  if (["CONNECTED", "APPROVED", "SENT", "DELIVERED", "READ", "SUCCESS", "COMPLETED", "ACTIVE", "PUBLISHED"].includes(status)) {
    return "green";
  }

  if (["QUEUED", "SENDING", "RETRY_PENDING", "PENDING", "PENDING_APPROVAL", "RUNNING", "SCHEDULED", "TRIALING", "WAITING", "WAITING_FOR_REPLY", "PAUSED"].includes(status)) {
    return "amber";
  }

  if (["FAILED", "PARTIAL_FAILED", "REJECTED", "ERROR", "DISCONNECTED", "CANCELLED", "CANCELED", "PAST_DUE", "INCOMPLETE", "DELETED", "DISABLED", "LIMIT_EXCEEDED", "ABANDONED", "ARCHIVED"].includes(status)) {
    return "red";
  }

  if (["RECEIVED", "OPEN", "DRAFT"].includes(status)) {
    return "blue";
  }

  return "zinc";
}
