import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring/40 focus:ring-4 focus:ring-ring/10 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
