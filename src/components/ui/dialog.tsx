import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Dialog({
  children,
  className,
  onOpenChange,
  open,
}: {
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0"
        onClick={() => onOpenChange?.(false)}
      />
      <section
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-2xl",
          className,
        )}
      >
        {onOpenChange ? (
          <Button
            aria-label="Close dialog"
            className="absolute right-3 top-3"
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
        {children}
      </section>
    </div>
  );
}
