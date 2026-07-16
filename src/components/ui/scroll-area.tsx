import * as React from "react";
import { cn } from "@/lib/utils";

export function ScrollArea({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-auto [scrollbar-color:color-mix(in_oklab,var(--primary)_35%,transparent)_transparent] [scrollbar-width:thin]",
        className,
      )}
      {...props}
    />
  );
}
