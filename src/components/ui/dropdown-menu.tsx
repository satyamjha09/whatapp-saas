import * as React from "react";
import { cn } from "@/lib/utils";

export function DropdownMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <details className={cn("relative", className)}>{children}</details>;
}

export function DropdownMenuTrigger({
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

export function DropdownMenuContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute right-0 z-40 mt-2 min-w-48 rounded-xl border border-[#BFE9D0] bg-white p-1 shadow-[0_18px_44px_rgba(8,27,58,0.14)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-[#102040] transition hover:bg-[#E7F8EF] hover:text-[#128C7E]",
        className,
      )}
      {...props}
    />
  );
}
