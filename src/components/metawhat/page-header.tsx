import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetaPageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: {
  actions?: React.ReactNode;
  className?: string;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <Card className={cn("mb-5 overflow-hidden p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </Card>
  );
}

export function MetaPanelTitle({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
