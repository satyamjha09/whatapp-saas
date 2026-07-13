import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Sheet({
  children,
  className,
  onOpenChange,
  open,
  side = "right",
}: {
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  side?: "left" | "right";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#081B3A]/45 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0"
        onClick={() => onOpenChange?.(false)}
      />
      <aside
        className={cn(
          "absolute top-0 h-full w-[min(92vw,420px)] border-[#BFE9D0] bg-white p-5 shadow-2xl",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className,
        )}
      >
        {onOpenChange ? (
          <Button
            aria-label="Close panel"
            className="absolute right-3 top-3"
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
        {children}
      </aside>
    </div>
  );
}
