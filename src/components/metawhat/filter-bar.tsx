import type * as React from "react";
import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card md:flex-row md:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
