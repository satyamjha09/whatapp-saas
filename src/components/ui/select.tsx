import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-4 py-2.5 text-sm text-[#102040] outline-none transition focus:border-[#128C7E]/40 focus:ring-4 focus:ring-[#128C7E]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#526173]",
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = "Select";
