import { getSlaBadgeClass, getSlaBadgeLabel } from "./sla";

type SlaBadgeProps = {
  inboxStatus: string;
  inboxSlaDueAt: Date | null;
  inboxSlaBreachedAt?: Date | null;
};

export default function SlaBadge({
  inboxStatus,
  inboxSlaDueAt,
  inboxSlaBreachedAt,
}: SlaBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1",
        getSlaBadgeClass(inboxStatus, inboxSlaDueAt, inboxSlaBreachedAt),
      ].join(" ")}
    >
      {getSlaBadgeLabel(inboxStatus, inboxSlaDueAt, inboxSlaBreachedAt)}
    </span>
  );
}
