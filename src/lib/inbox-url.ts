import {
  parseInboxFilter,
  parseInboxPriorityFilter,
  parseInboxSort,
  type InboxFilter,
  type InboxPriorityFilter,
  type InboxSort,
} from "@/lib/inbox-options";

export type InboxUrlState = {
  filter?: InboxFilter;
  q?: string;
  tagId?: string;
  priority?: InboxPriorityFilter;
  sort?: InboxSort;
  page?: number;
  sla?: string | null;
  queueId?: string;
  assignedUserId?: string;
};

export function parseInboxPage(value: string | undefined) {
  const page = Number(value ?? "1");

  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export function getInboxUrlState(searchParams: {
  filter?: string;
  q?: string;
  tagId?: string;
  priority?: string;
  sort?: string;
  page?: string;
  sla?: string;
  queueId?: string;
  assignedUserId?: string;
}): Required<InboxUrlState> {
  return {
    filter: parseInboxFilter(searchParams.filter),
    q: searchParams.q?.trim() ?? "",
    tagId: searchParams.tagId?.trim() ?? "",
    priority: parseInboxPriorityFilter(searchParams.priority),
    sort: parseInboxSort(searchParams.sort),
    page: parseInboxPage(searchParams.page),
    sla: searchParams.sla?.trim() ?? "",
    queueId: searchParams.queueId?.trim() ?? "",
    assignedUserId: searchParams.assignedUserId?.trim() ?? "",
  };
}

export function buildInboxQuery(state: InboxUrlState) {
  const params = new URLSearchParams();

  if (state.filter && state.filter !== "all") {
    params.set("filter", state.filter);
  }

  if (state.q?.trim()) {
    params.set("q", state.q.trim());
  }

  if (state.tagId?.trim()) {
    params.set("tagId", state.tagId.trim());
  }

  if (state.priority && state.priority !== "all") {
    params.set("priority", state.priority);
  }

  if (state.sort && state.sort !== "latest") {
    params.set("sort", state.sort);
  }

  if (state.sla?.trim()) {
    params.set("sla", state.sla.trim());
  }

  if (state.queueId?.trim()) {
    params.set("queueId", state.queueId.trim());
  }

  if (state.assignedUserId?.trim()) {
    params.set("assignedUserId", state.assignedUserId.trim());
  }

  if (state.page && state.page > 1) {
    params.set("page", String(state.page));
  }

  return params.toString();
}

export function buildInboxHref(basePath: string, state: InboxUrlState) {
  const query = buildInboxQuery(state);

  return query ? `${basePath}?${query}` : basePath;
}
