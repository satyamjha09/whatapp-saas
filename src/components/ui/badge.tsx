import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
}) {
  const tones = {
    brand: "bg-secondary text-primary ring-border",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
    info: "bg-info/10 text-info ring-info/20",
    neutral: "bg-muted text-muted-foreground ring-border",
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/15 text-warning-foreground ring-warning/25",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
