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
    <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.045] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.30)] backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
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
        "rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-6",
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
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
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
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-400/10 text-indigo-300">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-2 text-xs text-zinc-500">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.025] p-5 text-sm leading-6 text-zinc-500">
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
    amber: "bg-amber-400/10 text-amber-300 ring-amber-300/20",
    blue: "bg-cyan-400/10 text-cyan-300 ring-cyan-300/20",
    green: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
    red: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
    violet: "bg-indigo-400/10 text-indigo-300 ring-indigo-300/20",
    zinc: "bg-white/[0.06] text-zinc-300 ring-white/10",
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
    return "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-indigo-300/30 hover:bg-white/[0.08]";
  }

  return "inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_35px_rgba(99,102,241,0.30)] transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60";
}

export const fieldClass =
  "w-full rounded-xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/70 focus:bg-zinc-950";

export const labelClass = "mb-2 block text-sm font-medium text-zinc-300";

export const helperTextClass = "mt-2 text-xs leading-5 text-zinc-500";

export function statusTone(status: string): "zinc" | "green" | "blue" | "amber" | "red" | "violet" {
  if (["CONNECTED", "APPROVED", "SENT", "DELIVERED", "READ", "SUCCESS", "COMPLETED"].includes(status)) {
    return "green";
  }

  if (["QUEUED", "SENDING", "PENDING", "PENDING_APPROVAL", "RUNNING", "SCHEDULED"].includes(status)) {
    return "amber";
  }

  if (["FAILED", "REJECTED", "ERROR", "DISCONNECTED", "CANCELLED"].includes(status)) {
    return "red";
  }

  if (["RECEIVED", "OPEN", "DRAFT"].includes(status)) {
    return "blue";
  }

  return "zinc";
}
