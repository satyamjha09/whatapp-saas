import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ checked, className, ...props }, ref) => (
    <label className={cn("relative inline-flex h-6 w-11 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        className="peer sr-only"
        {...props}
      />
      <span className="absolute inset-0 rounded-full bg-muted ring-1 ring-border transition peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-ring/15 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow transition peer-checked:translate-x-5" />
    </label>
  ),
);

Switch.displayName = "Switch";
