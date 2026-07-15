export const inboxFilters = [
  "all",
  "needs-reply",
  "overdue",
  "open",
  "closed",
  "assigned-to-me",
  "my-queues",
  "unassigned-in-queue",
  "approval-pending",
  "sla-due-soon",
  "sla-breached",
  "unassigned",
  "snoozed",
  "hot_leads",
] as const;

export type InboxFilter = (typeof inboxFilters)[number];

export const inboxFilterLabels: Record<InboxFilter, string> = {
  all: "All",
  "needs-reply": "Needs reply",
  overdue: "Overdue",
  open: "Open",
  closed: "Closed",
  "assigned-to-me": "Assigned to me",
  "my-queues": "My queues",
  "unassigned-in-queue": "Queue unassigned",
  "approval-pending": "Approval pending",
  "sla-due-soon": "SLA due soon",
  "sla-breached": "SLA breached",
  unassigned: "Unassigned",
  snoozed: "Snoozed",
  hot_leads: "Hot Leads",
};

export function parseInboxFilter(value: string | undefined): InboxFilter {
  if (value && inboxFilters.includes(value as InboxFilter)) {
    return value as InboxFilter;
  }

  return "all";
}

export const inboxPriorityValues = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type InboxPriorityValue = (typeof inboxPriorityValues)[number];

export const inboxPriorityFilters = ["all", ...inboxPriorityValues] as const;

export type InboxPriorityFilter = (typeof inboxPriorityFilters)[number];

export function parseInboxPriorityFilter(
  value: string | undefined,
): InboxPriorityFilter {
  if (value && inboxPriorityFilters.includes(value as InboxPriorityFilter)) {
    return value as InboxPriorityFilter;
  }

  return "all";
}

export const inboxSorts = ["latest", "oldest", "priority", "unread", "lead_score"] as const;

export type InboxSort = (typeof inboxSorts)[number];

export const inboxSortLabels: Record<InboxSort, string> = {
  latest: "Latest",
  oldest: "Oldest",
  priority: "Priority",
  unread: "Unread",
  lead_score: "Lead Score",
};

export function parseInboxSort(value: string | undefined): InboxSort {
  if (value && inboxSorts.includes(value as InboxSort)) {
    return value as InboxSort;
  }

  return "latest";
}
