import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getInboxSlaDueAt,
  isInboxConversationOverdue,
} from "@/lib/inbox-sla";
import { buildInboxHref, getInboxUrlState } from "@/lib/inbox-url";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxTagsByCompany } from "@/server/services/inbox-tag.service";
import {
  getConversationByContact,
  getInboxContactsByCompany,
  getInboxSlaSettingsByCompany,
  getInboxStatsByCompany,
} from "@/server/services/inbox.service";
import { getCompanyMembers } from "@/server/services/team.service";
import InboxFilterTabs from "../inbox-filter-tabs";
import InboxAutoRefresh from "../inbox-auto-refresh";
import InboxBulkActions from "../inbox-bulk-actions";
import InboxPagination from "../inbox-pagination";
import InboxPriorityFilter from "../inbox-priority-filter";
import InboxSearchForm from "../inbox-search-form";
import InboxStatsCards from "../inbox-stats-cards";
import { getPriorityColorClass } from "../priority-color";
import SlaBadge from "../sla-badge";
import SlaFilter from "../sla-filter";
import ConversationAssigneeSelect from "./conversation-assignee-select";
import ConversationSnoozeControls from "./conversation-snooze-controls";
import ConversationPrioritySelect from "./conversation-priority-select";
import ConversationTagManager from "./conversation-tag-manager";
import ConversationStatusButton from "./conversation-status-button";
import InboxReplyForm from "./inbox-reply-form";
import MarkConversationRead from "./mark-conversation-read";
import NoteCard from "./note-card";
import NoteForm from "./note-form";

const BREAKDOWN_LABELS: Record<string, string> = {
  inbound_messages: "Inbound messages",
  read_messages: "Read messages",
  positive_reply: "Positive reply",
  negative_reply: "Negative reply",
  question_reply: "Question reply",
  opt_out: "Opt-out",
  demo_booked: "Demo booked",
  payment_received: "Payment received",
  lead_won: "Lead won",
  lead_lost: "Lead lost",
  decay: "Silence decay",
  blocked_or_opted_out: "Blocked / opted out",
  manual_high_priority: "Manual high priority bonus",
  manual_urgent_priority: "Manual urgent priority bonus",
};

function getLeadScoreLabel(score: number) {
  if (score >= 100) return "Urgent";
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  if (score >= 25) return "Low";
  return "Cold";
}

type InboxConversationPageProps = {
  params: Promise<{
    contactId: string;
  }>;
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

type InboxMediaMetadata = {
  messageType: "MEDIA";
  mediaType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO" | "STICKER";
  mediaName?: string | null;
  caption?: string | null;
};

type InboxLocationMetadata = {
  messageType: "LOCATION";
  name?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
};

type InboxReactionMetadata = {
  messageType: "REACTION";
  emoji?: string | null;
  reactedToMetaMessageId?: string | null;
};

function getInboxMediaMetadata(metadata: unknown): InboxMediaMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const mediaType = String(record.mediaType);

  if (
    record.messageType !== "MEDIA" ||
    !["IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "STICKER"].includes(mediaType)
  ) {
    return null;
  }

  return {
    messageType: "MEDIA",
    mediaType: mediaType as InboxMediaMetadata["mediaType"],
    mediaName: typeof record.mediaName === "string" ? record.mediaName : null,
    caption: typeof record.caption === "string" ? record.caption : null,
  };
}

function getInboxLocationMetadata(
  metadata: unknown,
): InboxLocationMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  if (
    record.messageType !== "LOCATION" ||
    typeof record.latitude !== "number" ||
    typeof record.longitude !== "number"
  ) {
    return null;
  }

  return {
    messageType: "LOCATION",
    name: typeof record.name === "string" ? record.name : null,
    address: typeof record.address === "string" ? record.address : null,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

function getInboxReactionMetadata(
  metadata: unknown,
): InboxReactionMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  if (record.messageType !== "REACTION") {
    return null;
  }

  return {
    messageType: "REACTION",
    emoji: typeof record.emoji === "string" ? record.emoji : null,
    reactedToMetaMessageId:
      typeof record.reactedToMetaMessageId === "string"
        ? record.reactedToMetaMessageId
        : null,
  };
}

function messagePreview(message: { body: string; metadata: unknown }) {
  const media = getInboxMediaMetadata(message.metadata);
  const location = getInboxLocationMetadata(message.metadata);
  const reaction = getInboxReactionMetadata(message.metadata);

  if (location) return `Location: ${location.name ?? location.address ?? "Shared location"}`;
  if (reaction) return reaction.emoji ? `Reacted ${reaction.emoji}` : "Reaction";
  if (!media) return message.body;

  return `${media.mediaType[0]}${media.mediaType.slice(1).toLowerCase()}${
    media.mediaName ? `: ${media.mediaName}` : ""
  }`;
}

function MessageBubbleBody({
  message,
  isOutbound,
}: {
  message: { id: string; body: string; metadata: unknown };
  isOutbound: boolean;
}) {
  const media = getInboxMediaMetadata(message.metadata);
  const location = getInboxLocationMetadata(message.metadata);
  const reaction = getInboxReactionMetadata(message.metadata);

  if (location) {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;

    return (
      <div className="mt-3 space-y-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
            isOutbound
              ? "border-white/20 bg-white/10 text-white"
              : "border-gray-200 bg-gray-50 text-gray-900"
          }`}
        >
          Location: {location.name ?? location.address ?? "Open in Google Maps"}
        </a>
        {location.address ? (
          <p className="whitespace-pre-wrap text-sm">{location.address}</p>
        ) : null}
      </div>
    );
  }

  if (reaction) {
    return (
      <p className="mt-3 whitespace-pre-wrap text-sm">
        {reaction.emoji ? `Reacted ${reaction.emoji}` : message.body}
      </p>
    );
  }

  if (!media) {
    return (
      <p className="mt-3 whitespace-pre-wrap text-sm">
        {message.body}
      </p>
    );
  }

  const caption = media.caption?.trim();

  if (media.mediaType === "IMAGE" || media.mediaType === "STICKER") {
    return (
      <div className="mt-3 space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/messages/${message.id}/media`}
          alt={media.mediaName ?? `${media.mediaType.toLowerCase()} message`}
          className="max-h-80 w-full rounded-xl object-cover"
        />
        {caption ? (
          <p className="whitespace-pre-wrap text-sm">{caption}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <a
        href={`/api/messages/${message.id}/media`}
        target="_blank"
        rel="noreferrer"
        className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${
          isOutbound
            ? "border-white/20 bg-white/10 text-white"
            : "border-gray-200 bg-gray-50 text-gray-900"
        }`}
      >
        {media.mediaType[0]}
        {media.mediaType.slice(1).toLowerCase()} sent
        {media.mediaName ? `: ${media.mediaName}` : ""}
      </a>
      {caption ? <p className="whitespace-pre-wrap text-sm">{caption}</p> : null}
    </div>
  );
}

export default async function InboxConversationPage({
  params,
  searchParams,
}: InboxConversationPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { contactId } = await params;
  const companyId = context.membership.companyId;
  const resolvedSearchParams = await searchParams;
  const inboxUrlState = getInboxUrlState(resolvedSearchParams);
  const activeFilter = inboxUrlState.filter;
  const searchQuery = inboxUrlState.q;
  const activeTagId = inboxUrlState.tagId;
  const activePriority = inboxUrlState.priority;
  const activeSort = inboxUrlState.sort;
  const activePage = inboxUrlState.page;
  const sla = inboxUrlState.sla;

  const [
    inboxResult,
    conversation,
    inboxTags,
    members,
    inboxStats,
    inboxSlaSettings,
  ] = await Promise.all([
    getInboxContactsByCompany(companyId, {
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
    getConversationByContact(companyId, contactId),
    getInboxTagsByCompany(companyId),
    getCompanyMembers(companyId),
    getInboxStatsByCompany(companyId, context.user.id),
    getInboxSlaSettingsByCompany(companyId),
  ]);
  const contacts = inboxResult.contacts;
  const pagination = inboxResult.pagination;
  const now = new Date();

  if (!conversation) {
    notFound();
  }

  const latestConversationMessage =
    conversation.messages[conversation.messages.length - 1];
  const conversationNeedsReply =
    latestConversationMessage?.direction === "INBOUND" &&
    conversation.inboxStatus === "OPEN" &&
    (!conversation.snoozedUntil || conversation.snoozedUntil <= now);
  const conversationIsOverdue = latestConversationMessage
    ? isInboxConversationOverdue({
        latestMessageCreatedAt: latestConversationMessage.createdAt,
        latestMessageDirection: latestConversationMessage.direction,
        inboxStatus: conversation.inboxStatus,
        inboxPriority: conversation.inboxPriority,
        snoozedUntil: conversation.snoozedUntil,
        slaSettings: inboxSlaSettings,
      })
    : false;
  const conversationSlaDueAt =
    latestConversationMessage && conversationNeedsReply
      ? getInboxSlaDueAt(
          latestConversationMessage.createdAt,
          conversation.inboxPriority,
          inboxSlaSettings,
        )
      : null;
  const customerServiceWindowEndsAt = conversation.inboxLastCustomerMessageAt
    ? new Date(
        conversation.inboxLastCustomerMessageAt.getTime() +
          24 * 60 * 60 * 1000,
      )
    : null;

  return (
    <main className="p-8">
      <InboxAutoRefresh activeContactId={conversation.id} />
      <MarkConversationRead contactId={conversation.id} />

      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>

          <div className="mt-6">
            <InboxStatsCards stats={inboxStats} variant="light" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/inbox/analytics"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Analytics
            </Link>

            <Link
              href="/dashboard/inbox/saved-views"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Saved views
            </Link>

            <Link
              href="/dashboard/inbox/quick-replies"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage quick replies
            </Link>

            <Link
              href="/dashboard/inbox/tags"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage tags
            </Link>
          </div>

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
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Conversations
            </h2>

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
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                {searchQuery
                  ? "No conversations found for this search."
                  : activeTagId
                    ? "No conversations found for this tag."
                    : activePriority !== "all"
                      ? "No conversations found for this priority."
                      : activeFilter === "overdue"
                        ? "No overdue conversations."
                        : activeFilter === "hot_leads"
                          ? "No hot leads yet. When contacts reply, book demos, or engage with campaigns, they will appear here."
                          : "No conversations found for this filter."}
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {contacts.map((contact) => {
                  const latestMessage = contact.messages[0];
                  const isActive = contact.id === conversation.id;
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
                      className={`block rounded-xl border p-4 transition ${
                        isActive
                          ? "border-black bg-gray-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {contact.name ?? "Unnamed Contact"}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            +{contact.countryCode}
                            {contact.phoneNumber}
                          </p>

                          {contact.snoozedUntil &&
                          contact.snoozedUntil > now ? (
                            <p className="mt-1 text-xs text-purple-600">
                              Snoozed until{" "}
                              {contact.snoozedUntil.toLocaleString()}
                            </p>
                          ) : null}

                          {slaDueAt ? (
                            <p
                              className={`mt-1 text-xs ${
                                isOverdue ? "text-red-600" : "text-gray-500"
                              }`}
                            >
                              SLA due: {slaDueAt.toLocaleString()}
                            </p>
                          ) : null}

                          {contact.inboxTags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {contact.inboxTags.map((item) => (
                                <span
                                  key={item.id}
                                  className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                                >
                                  {item.tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {isOverdue ? (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                              Overdue
                            </span>
                          ) : null}

                          {needsReply ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                              Needs reply
                            </span>
                          ) : null}

                          {unreadCount > 0 && (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              {unreadCount} unread
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${getPriorityColorClass(
                              contact.inboxPriority,
                            )}`}
                          >
                            {contact.inboxPriority}
                          </span>

                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Score {contact.leadScore ?? 0}
                          </span>

                          {contact.snoozedUntil &&
                          contact.snoozedUntil > now ? (
                            <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                              Snoozed
                            </span>
                          ) : null}

                          <SlaBadge
                            inboxStatus={contact.inboxStatus}
                            inboxSlaDueAt={contact.inboxSlaDueAt}
                            inboxSlaBreachedAt={contact.inboxSlaBreachedAt}
                          />

                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                            {contact.inboxStatus}
                          </span>

                          {latestMessage && (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                              {latestMessage.direction}
                            </span>
                          )}
                        </div>
                      </div>

                      {latestMessage && (
                        <>
                          <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                            {messagePreview(latestMessage)}
                          </p>

                          <p className="mt-2 text-xs text-gray-400">
                            {latestMessage.createdAt.toLocaleString()}
                          </p>
                        </>
                      )}
                    </Link>
                  );
                })}
                <InboxPagination
                  basePath={`/dashboard/inbox/${contactId}`}
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
          </section>

          <section className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {conversation.name ?? "Unnamed Contact"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    +{conversation.countryCode}
                    {conversation.phoneNumber}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {conversation.inboxStatus}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityColorClass(
                      conversation.inboxPriority,
                    )}`}
                  >
                    {conversation.inboxPriority}
                  </span>

                  <SlaBadge
                    inboxStatus={conversation.inboxStatus}
                    inboxSlaDueAt={conversation.inboxSlaDueAt}
                    inboxSlaBreachedAt={conversation.inboxSlaBreachedAt}
                  />

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Score: {conversation.leadScore ?? 0} ({getLeadScoreLabel(conversation.leadScore ?? 0)})
                  </span>

                  {conversationNeedsReply ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      Needs reply
                    </span>
                  ) : null}

                  {conversationIsOverdue ? (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                      Overdue
                    </span>
                  ) : null}

                  {conversationSlaDueAt ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        conversationIsOverdue
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      SLA due {conversationSlaDueAt.toLocaleString()}
                    </span>
                  ) : null}

                  {conversation.snoozedUntil &&
                  conversation.snoozedUntil > now ? (
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                      Snoozed until {conversation.snoozedUntil.toLocaleString()}
                    </span>
                  ) : null}

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {conversation._count.messages > conversation.messages.length
                      ? `Latest ${conversation.messages.length} of ${conversation._count.messages} message(s)`
                      : `${conversation.messages.length} message(s)`}
                  </span>

                  <ConversationPrioritySelect
                    contactId={conversation.id}
                    currentPriority={conversation.inboxPriority}
                  />

                  <ConversationAssigneeSelect
                    contactId={conversation.id}
                    currentAssignedToUserId={conversation.assignedToUserId}
                    currentUserId={context.user.id}
                    members={members}
                  />

                  <ConversationStatusButton
                    contactId={conversation.id}
                    currentStatus={conversation.inboxStatus}
                  />

                  <Link
                    href={`/dashboard/contacts/${conversation.id}/crm`}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Customer CRM
                  </Link>
                </div>
              </div>

              <div className="mt-4">
                <ConversationTagManager
                  contactId={conversation.id}
                  allTags={inboxTags}
                  activeTags={conversation.inboxTags.map((item) => item.tag)}
                />
              </div>

              <div className="mt-4">
                <ConversationSnoozeControls
                  contactId={conversation.id}
                  snoozedUntil={conversation.snoozedUntil}
                />
              </div>

              {conversation.leadScoreBreakdown && typeof conversation.leadScoreBreakdown === "object" && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-900">Lead Score Breakdown</span>
                    {conversation.leadScoreUpdatedAt && (
                      <span className="text-xs text-slate-500">
                        Updated: {new Date(conversation.leadScoreUpdatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(conversation.leadScoreBreakdown as Record<string, number>).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {BREAKDOWN_LABELS[key] ?? key}
                        </span>
                        <span
                          className={
                            Number(value) >= 0
                              ? "font-semibold text-green-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {Number(value) >= 0 ? "+" : ""}
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-b bg-yellow-50 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Internal Notes
                  </h3>

                  <p className="mt-1 text-xs text-gray-600">
                    Private notes visible only to your team.
                  </p>
                </div>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                  {conversation.inboxNotes.length} note(s)
                </span>
              </div>

              <NoteForm contactId={conversation.id} />

              {conversation.inboxNotes.length > 0 && (
                <div className="mt-4 space-y-3">
                  {conversation.inboxNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      contactId={conversation.id}
                      note={note}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-[520px] space-y-4 bg-gray-50 p-6">
              {conversation.messages.length === 0 ? (
                <p className="rounded-lg bg-white p-4 text-sm text-gray-600">
                  No messages found for this contact.
                </p>
              ) : (
                conversation.messages.map((message) => {
                  const isOutbound = message.direction === "OUTBOUND";

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isOutbound ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
                          isOutbound
                            ? "bg-black text-white"
                            : "border bg-white text-gray-900"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              isOutbound
                                ? "bg-white/10 text-white"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {message.direction}
                          </span>

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              isOutbound
                                ? "bg-white/10 text-white"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {message.status}
                          </span>
                        </div>

                        <MessageBubbleBody
                          message={message}
                          isOutbound={isOutbound}
                        />

                        {message.template && (
                          <p
                            className={`mt-3 text-xs ${
                              isOutbound ? "text-white/70" : "text-gray-500"
                            }`}
                          >
                            Template: {message.template.name}
                          </p>
                        )}

                        <p
                          className={`mt-3 text-xs ${
                            isOutbound ? "text-white/60" : "text-gray-400"
                          }`}
                        >
                          {message.createdAt.toLocaleString()}
                        </p>

                        {!isOutbound && (
                          <p className="mt-2 text-xs text-gray-400">
                            {message.inboxReadAt
                              ? `Seen internally: ${message.inboxReadAt.toLocaleString()}`
                              : "Unread internally"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <InboxReplyForm
              contactId={conversation.id}
              customerServiceWindowEndsAt={
                customerServiceWindowEndsAt?.toISOString() ?? null
              }
            />
          </section>
        </div>
      </div>
    </main>
  );
}
