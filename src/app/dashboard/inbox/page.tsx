import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  actionButtonClass,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import {
  getInboxSlaDueAt,
  isInboxConversationOverdue,
} from "@/lib/inbox-sla";
import { buildInboxHref, getInboxUrlState } from "@/lib/inbox-url";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxTagsByCompany } from "@/server/services/inbox-tag.service";
import {
  getInboxContactsByCompany,
  getInboxSlaSettingsByCompany,
  getInboxStatsByCompany,
} from "@/server/services/inbox.service";
import { getCompanyMembers } from "@/server/services/team.service";
import InboxFilterTabs from "./inbox-filter-tabs";
import InboxBulkActions from "./inbox-bulk-actions";
import InboxPagination from "./inbox-pagination";
import InboxPriorityFilter from "./inbox-priority-filter";
import InboxSearchForm from "./inbox-search-form";
import InboxStatsCards from "./inbox-stats-cards";
import SlaBadge from "./sla-badge";
import SlaFilter from "./sla-filter";

type InboxPageProps = {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    tagId?: string;
    priority?: string;
    sort?: string;
    page?: string;
    sla?: string;
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = await searchParams;
  const inboxUrlState = getInboxUrlState(resolvedSearchParams);
  const activeFilter = inboxUrlState.filter;
  const searchQuery = inboxUrlState.q;
  const activeTagId = inboxUrlState.tagId;
  const activePriority = inboxUrlState.priority;
  const activeSort = inboxUrlState.sort;
  const activePage = inboxUrlState.page;
  const sla = inboxUrlState.sla;

  const [inboxResult, inboxTags, members, inboxStats, inboxSlaSettings] =
    await Promise.all([
      getInboxContactsByCompany(context.membership.companyId, {
        filter: activeFilter,
        currentUserId: context.user.id,
        search: searchQuery,
        tagId: activeTagId,
        priority: activePriority,
        sort: activeSort,
        page: activePage,
        pageSize: 20,
        sla,
      }),
      getInboxTagsByCompany(context.membership.companyId),
      getCompanyMembers(context.membership.companyId),
      getInboxStatsByCompany(context.membership.companyId, context.user.id),
      getInboxSlaSettingsByCompany(context.membership.companyId),
    ]);
  const contacts = inboxResult.contacts;
  const pagination = inboxResult.pagination;
  const now = new Date();

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Inbox"
        description="Review real conversations, unread inbound messages, tags, priorities, and conversation status."
        actions={
          <>
            <Link
              href="/dashboard/inbox/analytics"
              className={actionButtonClass("secondary")}
            >
              Analytics
            </Link>
            <Link
              href="/dashboard/inbox/quick-replies"
              className={actionButtonClass("secondary")}
            >
              Manage quick replies
            </Link>
            <Link
              href="/dashboard/inbox/tags"
              className={actionButtonClass("secondary")}
            >
              Manage tags
            </Link>
          </>
        }
      />

      <InboxStatsCards stats={inboxStats} />

      <Panel className="mb-6">
        <InboxFilterTabs
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          activeTagId={activeTagId}
          activePriority={activePriority}
          activeSort={activeSort}
          sla={sla}
        />
        <InboxSearchForm
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          activeTagId={activeTagId}
          activePriority={activePriority}
          activeSort={activeSort}
          sla={sla}
        />
        <div className="mt-4">
          <InboxPriorityFilter
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            activeTagId={activeTagId}
            activePriority={activePriority}
            activeSort={activeSort}
            sla={sla}
          />
        </div>
        <div className="mt-4">
          <SlaFilter />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Panel>
          <PanelTitle
            title="Conversations"
            description="Latest message preview for each matching contact."
          />

          <InboxBulkActions
            contacts={contacts.map((contact) => ({
              id: contact.id,
              name: contact.name,
              countryCode: contact.countryCode,
              phoneNumber: contact.phoneNumber,
              inboxStatus: contact.inboxStatus,
              inboxPriority: contact.inboxPriority,
            }))}
            members={members}
            tags={inboxTags}
          />

          {contacts.length === 0 ? (
            <div className="mt-6">
              <EmptyState>
                {searchQuery
                  ? "No conversations found for this search."
                  : activeTagId
                    ? "No conversations found for this tag."
                    : activePriority !== "all"
                      ? "No conversations found for this priority."
                      : activeFilter === "overdue"
                        ? "No overdue conversations."
                        : "No conversations found for this filter."}
              </EmptyState>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {contacts.map((contact) => {
                const latestMessage = contact.messages[0];
                const unreadCount = contact._count.messages;
                const needsReply =
                  latestMessage?.direction === "INBOUND" &&
                  contact.inboxStatus === "OPEN" &&
                  (!contact.snoozedUntil || contact.snoozedUntil <= now);
                const isOverdue = latestMessage
                  ? isInboxConversationOverdue({
                      latestMessageCreatedAt: latestMessage.createdAt,
                      latestMessageDirection: latestMessage.direction,
                      inboxStatus: contact.inboxStatus,
                      inboxPriority: contact.inboxPriority,
                      snoozedUntil: contact.snoozedUntil,
                      slaSettings: inboxSlaSettings,
                    })
                  : false;
                const slaDueAt =
                  latestMessage && needsReply
                      ? getInboxSlaDueAt(
                          latestMessage.createdAt,
                          contact.inboxPriority,
                          inboxSlaSettings,
                        )
                    : null;

                return (
                  <Link
                    key={contact.id}
                    href={buildInboxHref(
                      `/dashboard/inbox/${contact.id}`,
                      inboxUrlState,
                    )}
                    className="block rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-indigo-300/25 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {contact.name ?? "Unnamed Contact"}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                          +{contact.countryCode}
                          {contact.phoneNumber}
                        </p>

                        {contact.snoozedUntil && contact.snoozedUntil > now ? (
                          <p className="mt-1 text-xs text-purple-300">
                            Snoozed until {contact.snoozedUntil.toLocaleString()}
                          </p>
                        ) : null}

                        {slaDueAt ? (
                          <p
                            className={`mt-1 text-xs ${
                              isOverdue ? "text-red-300" : "text-zinc-500"
                            }`}
                          >
                            SLA due: {slaDueAt.toLocaleString()}
                          </p>
                        ) : null}

                        {contact.inboxTags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {contact.inboxTags.map((item) => (
                              <StatusPill key={item.id} tone="violet">
                                {item.tag.name}
                              </StatusPill>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {isOverdue ? (
                          <StatusPill tone="red">Overdue</StatusPill>
                        ) : null}

                        {needsReply ? (
                          <StatusPill tone="amber">Needs reply</StatusPill>
                        ) : null}

                        {unreadCount > 0 && (
                          <StatusPill tone="green">{unreadCount} unread</StatusPill>
                        )}

                        <StatusPill tone={statusTone(contact.inboxPriority)}>
                          {contact.inboxPriority}
                        </StatusPill>

                        {contact.snoozedUntil && contact.snoozedUntil > now ? (
                          <StatusPill tone="violet">Snoozed</StatusPill>
                        ) : null}

                        <SlaBadge
                          inboxStatus={contact.inboxStatus}
                          inboxSlaDueAt={contact.inboxSlaDueAt}
                          inboxSlaBreachedAt={contact.inboxSlaBreachedAt}
                        />

                        <StatusPill tone={statusTone(contact.inboxStatus)}>
                          {contact.inboxStatus}
                        </StatusPill>
                      </div>
                    </div>

                    {latestMessage && (
                      <>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">
                          {latestMessage.body}
                        </p>

                        <p className="mt-2 text-xs text-zinc-600">
                          {latestMessage.direction} -{" "}
                          {latestMessage.createdAt.toLocaleString()}
                        </p>
                      </>
                    )}
                  </Link>
                );
              })}
              <InboxPagination
                basePath="/dashboard/inbox"
                pagination={pagination}
                urlState={{
                  filter: activeFilter,
                  q: searchQuery,
                  tagId: activeTagId,
                  priority: activePriority,
                  sort: activeSort,
                  sla,
                }}
              />
            </div>
          )}
        </Panel>

        <Panel className="flex min-h-[520px] items-center justify-center">
          <div className="max-w-sm text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-400/10 text-indigo-300">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">
              Select a conversation
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Choose a contact from the conversation list to view the thread.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
