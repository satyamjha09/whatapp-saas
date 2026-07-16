import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function MetaEmptyState({
  action,
  children,
  className,
  icon: Icon,
  title,
}: {
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/45 p-8 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      {title ? (
        <p className="mt-4 text-base font-bold text-foreground">{title}</p>
      ) : null}
      <div className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {children}
      </div>
      {action ? (
        <Link
          className="mt-5 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
          href={action.href}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export const EmptyState = MetaEmptyState;
