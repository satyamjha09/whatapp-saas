import Link from "next/link";
import { MessageCircle, Tag } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { statusTone } from "@/app/dashboard/dashboard-ui";
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

type InboxUrlState = ReturnType<typeof getInboxUrlState>;

function CompactStatusPill({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "green" | "blue" | "amber" | "red" | "violet";
}) {
  const tones = {
    amber: "border-[#F8C830]/40 bg-[#F8C830]/20 text-[#081B3A]",
    blue: "border-[#D8E6F3] bg-[#F0F8FF] text-[#0052CC]",
    green: "border-[#22C55E]/25 bg-[#22C55E]/10 text-[#15803d]",
    red: "border-rose-200 bg-rose-50 text-rose-700",
    violet: "border-[#384080]/20 bg-[#384080]/10 text-[#384080]",
    zinc: "border-[#D8E6F3] bg-[#F0F8FF] text-[#526173]",
  };

  return (
    <span
      className={[
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
      ].join(" ")}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-2xl border border-[#D8E6F3] bg-white",
        className,
      ].join(" ")}
    />
  );
}

function InboxHeader({ companyName }: { companyName: string }) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-[#D8E6F3] pb-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-normal text-[#2070B0]">
          {companyName}
        </p>
        <h1 className="mt-1 truncate text-2xl font-bold text-[#081B3A]">
          Inbox
        </h1>
        <p className="mt-1 line-clamp-1 text-sm text-[#526173]">
          Review real conversations, unread inbound messages, tags, priorities,
          and conversation status.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href="/dashboard/inbox/analytics"
          className="rounded-xl border border-[#D8E6F3] bg-white px-3 py-2 text-sm font-medium text-[#0052CC] transition hover:border-[#0052CC]/30 hover:bg-[#F0F8FF] hover:text-[#003F9E]"
        >
          Analytics
        </Link>
        <Link
          href="/dashboard/inbox/quick-replies"
          className="rounded-xl border border-[#D8E6F3] bg-white px-3 py-2 text-sm font-medium text-[#0052CC] transition hover:border-[#0052CC]/30 hover:bg-[#F0F8FF] hover:text-[#003F9E]"
        >
          Quick replies
        </Link>
        <Link
          href="/dashboard/inbox/tags"
          className="rounded-xl border border-[#D8E6F3] bg-white px-3 py-2 text-sm font-medium text-[#0052CC] transition hover:border-[#0052CC]/30 hover:bg-[#F0F8FF] hover:text-[#003F9E]"
        >
          Tags
        </Link>
      </div>
    </header>
  );
}

function InboxStatsSkeleton() {
  return (
    <div className="mt-3 grid shrink-0 gap-2 sm:grid-cols-5 xl:grid-cols-10">
      {Array.from({ length: 10 }).map((_, index) => (
        <SkeletonBox key={index} className="h-[74px]" />
      ))}
    </div>
  );
}

function InboxWorkspaceSkeleton() {
  return (
    <>
      <SkeletonBox className="mt-3 h-[92px] shrink-0" />
      <div className="mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[390px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#D8E6F3] bg-white p-3">
          <SkeletonBox className="h-12 shrink-0" />
          <SkeletonBox className="mt-3 h-28 shrink-0" />
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBox key={index} className="h-28" />
            ))}
          </div>
        </div>
        <SkeletonBox className="min-h-0" />
      </div>
    </>
  );
}

async function InboxStatsSection({
  companyId,
  currentUserId,
}: {
  companyId: string;
  currentUserId: string;
}) {
  const inboxStats = await getInboxStatsByCompany(companyId, currentUserId);

  return <InboxStatsCards stats={inboxStats} />;
}

async function InboxWorkspace({
  companyId,
  currentUserId,
  inboxUrlState,
}: {
  companyId: string;
  currentUserId: string;
  inboxUrlState: InboxUrlState;
}) {
  const activeFilter = inboxUrlState.filter;
  const searchQuery = inboxUrlState.q;
  const activeTagId = inboxUrlState.tagId;
  const activePriority = inboxUrlState.priority;
  const activeSort = inboxUrlState.sort;
  const activePage = inboxUrlState.page;
  const sla = inboxUrlState.sla;

  const [inboxResult, inboxTags, members, inboxSlaSettings] =
    await Promise.all([
      getInboxContactsByCompany(companyId, {
        filter: activeFilter,
        currentUserId,
        search: searchQuery,
        tagId: activeTagId,
        priority: activePriority,
        sort: activeSort,
        page: activePage,
        pageSize: 20,
        sla,
      }),
      getInboxTagsByCompany(companyId),
      getCompanyMembers(companyId),
      getInboxSlaSettingsByCompany(companyId),
    ]);
  const contacts = inboxResult.contacts;
  const pagination = inboxResult.pagination;
  const now = new Date();

  return (
    <>
      <section className="mt-3 shrink-0 rounded-2xl border border-[#D8E6F3] bg-white p-3 shadow-[0_14px_34px_rgba(8,27,58,0.08)] backdrop-blur">
        <InboxFilterTabs
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          activeTagId={activeTagId}
          activePriority={activePriority}
          activeSort={activeSort}
          sla={sla}
        />

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(320px,1fr)_auto_auto] xl:items-start">
          <InboxSearchForm
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            activeTagId={activeTagId}
            activePriority={activePriority}
            activeSort={activeSort}
            sla={sla}
          />
          <InboxPriorityFilter
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            activeTagId={activeTagId}
            activePriority={activePriority}
            activeSort={activeSort}
            sla={sla}
          />
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-[#526173]">SLA</p>
            <SlaFilter />
          </div>
        </div>
      </section>

      <div className="mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#D8E6F3] bg-white shadow-[0_16px_40px_rgba(8,27,58,0.08)] backdrop-blur">
          <div className="shrink-0 border-b border-[#D8E6F3] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[#081B3A]">
                  Conversations
                </h2>
                <p className="mt-0.5 line-clamp-1 text-xs text-[#526173]">
                  Latest message preview for each matching contact.
                </p>
              </div>
              <span className="rounded-full border border-[#D8E6F3] bg-[#F0F8FF] px-2.5 py-1 text-xs font-medium text-[#0052CC]">
                {pagination.total.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="shrink-0 px-3 pt-3">
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
          </div>

          {contacts.length === 0 ? (
            <div className="min-h-0 flex-1 p-3">
              <div className="rounded-2xl border border-dashed border-[#D8E6F3] bg-white p-4 text-sm leading-6 text-[#526173]">
                {searchQuery
                  ? "No conversations found for this search."
                  : activeTagId
                    ? "No conversations found for this tag."
                    : activePriority !== "all"
                      ? "No conversations found for this priority."
                      : activeFilter === "overdue"
                        ? "No overdue conversations."
                        : "No conversations found for this filter."}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="space-y-2">
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
                      className="block rounded-2xl border border-[#D8E6F3] bg-white p-3 transition hover:border-[#0052CC]/30 hover:bg-[#F0F8FF]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-bold text-[#081B3A]">
                              {contact.name ?? "Unnamed Contact"}
                            </p>
                            {unreadCount > 0 && (
                              <span className="shrink-0 rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[11px] font-medium text-[#15803d] ring-1 ring-[#22C55E]/25">
                                {unreadCount}
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 truncate text-xs text-[#526173]">
                            +{contact.countryCode}
                            {contact.phoneNumber}
                          </p>

                          {latestMessage && (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#526173]">
                              {latestMessage.body}
                            </p>
                          )}

                          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-[#526173]/80">
                            {latestMessage ? (
                              <>
                                <span className="truncate">
                                  {latestMessage.direction}
                                </span>
                                <span>-</span>
                                <span className="truncate">
                                  {latestMessage.createdAt.toLocaleString()}
                                </span>
                              </>
                            ) : null}
                            {contact.snoozedUntil &&
                            contact.snoozedUntil > now ? (
                              <span className="truncate text-[#384080]">
                                Snoozed until{" "}
                                {contact.snoozedUntil.toLocaleString()}
                              </span>
                            ) : null}
                            {slaDueAt ? (
                              <span
                                className={
                                  isOverdue ? "text-rose-700" : "text-[#526173]"
                                }
                              >
                                SLA due: {slaDueAt.toLocaleString()}
                              </span>
                            ) : null}
                          </div>

                          {contact.inboxTags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {contact.inboxTags.map((item) => (
                                <span
                                  key={item.id}
                                  className="inline-flex max-w-[130px] items-center gap-1 rounded-full border border-[#384080]/20 bg-[#384080]/10 px-2 py-0.5 text-[11px] font-medium text-[#384080]"
                                >
                                  <Tag className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {item.tag.name}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex max-w-[120px] shrink-0 flex-col items-end gap-1.5">
                          {isOverdue ? (
                            <CompactStatusPill tone="red">
                              Overdue
                            </CompactStatusPill>
                          ) : null}

                          {needsReply ? (
                            <CompactStatusPill tone="amber">
                              Needs reply
                            </CompactStatusPill>
                          ) : null}

                          <CompactStatusPill
                            tone={statusTone(contact.inboxPriority)}
                          >
                            {contact.inboxPriority}
                          </CompactStatusPill>

                          {contact.snoozedUntil && contact.snoozedUntil > now ? (
                            <CompactStatusPill tone="violet">
                              Snoozed
                            </CompactStatusPill>
                          ) : null}

                          <SlaBadge
                            inboxStatus={contact.inboxStatus}
                            inboxSlaDueAt={contact.inboxSlaDueAt}
                            inboxSlaBreachedAt={contact.inboxSlaBreachedAt}
                          />

                          <CompactStatusPill
                            tone={statusTone(contact.inboxStatus)}
                          >
                            {contact.inboxStatus}
                          </CompactStatusPill>
                        </div>
                      </div>
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
            </div>
          )}
        </section>

        <section className="flex min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-[#D8E6F3] bg-white p-4 shadow-[0_16px_40px_rgba(8,27,58,0.08)] backdrop-blur">
          <div className="max-w-sm text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#D8E6F3] bg-[#F0F8FF] text-[#0052CC]">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#081B3A]">
              Select a conversation
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#526173]">
              Choose a contact from the conversation list to view the thread.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

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
  const companyId = context.membership.companyId;

  return (
    <div className="flex h-[calc(100vh-6rem)] max-h-screen min-h-0 flex-col overflow-hidden rounded-2xl border border-[#D8E6F3] bg-[linear-gradient(135deg,#FFFFFF,#F0F8FF_54%,rgba(216,230,243,0.72))] p-4 text-[#102040] shadow-[0_18px_48px_rgba(8,27,58,0.10)]">
      <InboxHeader companyName={context.membership.company.name} />

      <Suspense fallback={<InboxStatsSkeleton />}>
        <InboxStatsSection companyId={companyId} currentUserId={context.user.id} />
      </Suspense>

      <Suspense fallback={<InboxWorkspaceSkeleton />}>
        <InboxWorkspace
          companyId={companyId}
          currentUserId={context.user.id}
          inboxUrlState={inboxUrlState}
        />
      </Suspense>
    </div>
  );
}
