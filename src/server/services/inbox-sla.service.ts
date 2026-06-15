type InboxPriorityValue = "LOW" | "NORMAL" | "HIGH" | "URGENT";

const SLA_MINUTES_BY_PRIORITY: Record<InboxPriorityValue, number> = {
  URGENT: 15,
  HIGH: 60,
  NORMAL: 240,
  LOW: 1440,
};

export function calculateInboxSlaDueAt(
  priority: InboxPriorityValue,
  fromDate = new Date(),
) {
  const minutes = SLA_MINUTES_BY_PRIORITY[priority];

  return new Date(fromDate.getTime() + minutes * 60 * 1000);
}

export function isInboxSlaOverdue(dueAt: Date | null, now = new Date()) {
  if (!dueAt) {
    return false;
  }

  return dueAt.getTime() < now.getTime();
}

export function isInboxSlaDueSoon(dueAt: Date | null, now = new Date()) {
  if (!dueAt) {
    return false;
  }

  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  return dueAt.getTime() >= now.getTime() && dueAt <= thirtyMinutesFromNow;
}
