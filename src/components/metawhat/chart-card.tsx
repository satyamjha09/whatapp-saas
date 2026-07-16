import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MetaPanelTitle } from "./page-header";

export function ChartCard({
  actions,
  children,
  className,
  description,
  title,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <MetaPanelTitle description={description} title={title} />
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}
