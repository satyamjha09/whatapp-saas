import type * as React from "react";
import { Badge } from "@/components/ui/badge";

export type MetaStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

export function MetaStatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: MetaStatusTone;
}) {
  return <Badge tone={tone}>{children}</Badge>;
}

export const StatusBadge = MetaStatusPill;
