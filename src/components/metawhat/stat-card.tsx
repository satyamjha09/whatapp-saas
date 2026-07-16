import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetaMetricCard({
  className,
  detail,
  icon: Icon,
  label,
  value,
}: {
  className?: string;
  detail?: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Card
      className={cn(
        "p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(8,27,58,0.10)] sm:p-6",
        className,
      )}
    >
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {detail ? (
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </Card>
  );
}

export const StatCard = MetaMetricCard;
