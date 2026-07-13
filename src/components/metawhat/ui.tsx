import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetaButton({
  className,
  ...props
}: ButtonProps) {
  return <Button className={className} {...props} />;
}

export function MetaCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      {children}
    </Card>
  );
}

export function MetaPageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: React.ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <MetaCard className="mb-5 overflow-hidden">
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
    </MetaCard>
  );
}

export function MetaPanelTitle({
  description,
  title,
}: {
  description?: string;
  title: string;
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

export function MetaMetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <MetaCard className="transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(8,27,58,0.10)]">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-sm text-[#526173]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#081B3A]">{value}</p>
      {detail ? <p className="mt-2 text-xs text-[#526173]">{detail}</p> : null}
    </MetaCard>
  );
}

export function MetaEmptyState({
  action,
  children,
  icon: Icon,
  title,
}: {
  action?: { href: string; label: string };
  children: React.ReactNode;
  icon?: LucideIcon;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F8FCFA] p-8 text-center">
      {Icon ? (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E7F8EF] text-[#128C7E]">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      {title ? (
        <p className="mt-4 text-base font-bold text-[#081B3A]">{title}</p>
      ) : null}
      <div className="mt-2 max-w-md text-sm leading-6 text-[#526173]">
        {children}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54]"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function MetaStatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
}) {
  return <Badge tone={tone}>{children}</Badge>;
}

export function MetaDataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white shadow-[0_16px_40px_rgba(8,27,58,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function metaActionButtonClass(
  variant: "primary" | "secondary" = "primary",
) {
  if (variant === "secondary") {
    return "inline-flex items-center justify-center gap-2 rounded-xl border border-[#BFE9D0] bg-white px-4 py-2.5 text-sm font-semibold text-[#128C7E] transition hover:border-[#128C7E]/35 hover:bg-[#E7F8EF]";
  }

  return "inline-flex items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-60";
}
