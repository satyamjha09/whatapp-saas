type InboxPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type InboxSlaSettings = {
  urgentMinutes: number;
  highMinutes: number;
  normalMinutes: number;
  lowMinutes: number;
};

export const DEFAULT_INBOX_SLA_SETTINGS: InboxSlaSettings = {
  urgentMinutes: 15,
  highMinutes: 60,
  normalMinutes: 4 * 60,
  lowMinutes: 24 * 60,
};

export function getInboxSlaMinutes(
  priority: string,
  slaSettings: InboxSlaSettings = DEFAULT_INBOX_SLA_SETTINGS,
) {
  switch (priority as InboxPriority) {
    case "URGENT":
      return slaSettings.urgentMinutes;
    case "HIGH":
      return slaSettings.highMinutes;
    case "LOW":
      return slaSettings.lowMinutes;
    default:
      return slaSettings.normalMinutes;
  }
}

export function getInboxSlaDueAt(
  latestMessageCreatedAt: Date,
  priority: string,
  slaSettings: InboxSlaSettings = DEFAULT_INBOX_SLA_SETTINGS,
) {
  const slaMinutes = getInboxSlaMinutes(priority, slaSettings);

  return new Date(latestMessageCreatedAt.getTime() + slaMinutes * 60 * 1000);
}

export function isInboxConversationOverdue(input: {
  latestMessageCreatedAt: Date;
  latestMessageDirection: string;
  inboxStatus: string;
  inboxPriority: string;
  snoozedUntil: Date | null;
  slaSettings?: InboxSlaSettings;
}) {
  const isSnoozed =
    input.snoozedUntil !== null && input.snoozedUntil > new Date();

  if (input.latestMessageDirection !== "INBOUND") {
    return false;
  }

  if (input.inboxStatus !== "OPEN") {
    return false;
  }

  if (isSnoozed) {
    return false;
  }

  const dueAt = getInboxSlaDueAt(
    input.latestMessageCreatedAt,
    input.inboxPriority,
    input.slaSettings,
  );

  return dueAt < new Date();
}
