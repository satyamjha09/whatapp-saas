import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring/40 focus:ring-4 focus:ring-ring/10 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
