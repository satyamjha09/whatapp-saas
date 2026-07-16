import * as React from "react";
import { cn } from "@/lib/utils";

export function Popover({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <details className={cn("relative", className)}>{children}</details>;
}

export function PopoverTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <summary className={cn("list-none [&::-webkit-details-marker]:hidden", className)}>
      {children}
    </summary>
  );
}

export function PopoverContent({
  align = "end",
  children,
  className,
}: {
  align?: "start" | "end";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute z-40 mt-2 min-w-64 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-popup",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
