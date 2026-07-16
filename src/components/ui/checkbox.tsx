import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, className, ...props }, ref) => (
    <label className={cn("relative inline-flex h-5 w-5 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        className="peer sr-only"
        {...props}
      />
      <span className="grid h-5 w-5 place-items-center rounded-md border border-input bg-card text-primary-foreground transition peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-ring/10 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-checked:[&>svg]:opacity-100">
        <Check className="h-3.5 w-3.5 opacity-0 transition" />
      </span>
    </label>
  ),
);

Checkbox.displayName = "Checkbox";
