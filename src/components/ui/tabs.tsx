import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-4", className)} {...props} />;
}

export function TabsList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-[#BFE9D0] bg-white p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-[#128C7E] text-white shadow-sm"
          : "text-[#526173] hover:bg-[#E7F8EF] hover:text-[#128C7E]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("outline-none", className)} {...props} />;
}
