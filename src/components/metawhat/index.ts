import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export { Button as MetaButton, type ButtonProps };
export { Card as BaseCard };
export * from "./chart-card";
export * from "./data-table";
export * from "./empty-state";
export * from "./filter-bar";
export * from "./page-header";
export * from "./stat-card";
export * from "./status-badge";

export function MetaCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return React.createElement(
    Card,
    { className: cn("p-5 sm:p-6", className) },
    children,
  );
}

export function metaActionButtonClass(
  variant: "primary" | "secondary" = "primary",
) {
  if (variant === "secondary") {
    return "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/35 hover:bg-secondary";
  }

  return "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";
}
