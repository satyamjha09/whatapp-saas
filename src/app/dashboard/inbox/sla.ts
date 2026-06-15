const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function formatDuration(ms: number) {
  const absoluteMs = Math.abs(ms);

  if (absoluteMs < HOUR) {
    return `${Math.max(1, Math.ceil(absoluteMs / MINUTE))}m`;
  }

  if (absoluteMs < DAY) {
    return `${Math.ceil(absoluteMs / HOUR)}h`;
  }

  return `${Math.ceil(absoluteMs / DAY)}d`;
}

export function getSlaBadgeLabel(
  inboxStatus: string,
  inboxSlaDueAt: Date | null,
  inboxSlaBreachedAt?: Date | null,
) {
  if (inboxStatus === "CLOSED") {
    return "SLA closed";
  }

  if (inboxSlaBreachedAt) {
    return "SLA breached";
  }

  if (!inboxSlaDueAt) {
    return "No SLA";
  }

  const now = new Date();
  const diff = inboxSlaDueAt.getTime() - now.getTime();

  if (diff < 0) {
    return `Overdue ${formatDuration(diff)}`;
  }

  return `Due in ${formatDuration(diff)}`;
}

export function getSlaBadgeClass(
  inboxStatus: string,
  inboxSlaDueAt: Date | null,
  inboxSlaBreachedAt?: Date | null,
) {
  if (inboxStatus === "CLOSED") {
    return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }

  if (inboxSlaBreachedAt) {
    return "bg-red-100 text-red-700 ring-red-200";
  }

  if (!inboxSlaDueAt) {
    return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }

  const now = new Date();
  const diff = inboxSlaDueAt.getTime() - now.getTime();

  if (diff < 0) {
    return "bg-red-100 text-red-700 ring-red-200";
  }

  if (diff <= 30 * MINUTE) {
    return "bg-orange-100 text-orange-700 ring-orange-200";
  }

  return "bg-green-100 text-green-700 ring-green-200";
}
