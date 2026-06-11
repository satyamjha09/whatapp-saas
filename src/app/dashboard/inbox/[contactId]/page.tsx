import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getConversationByContact,
  getInboxContactsByCompany,
  resolveInboxFilter,
} from "@/server/services/inbox.service";
import InboxFilterTabs from "../inbox-filter-tabs";
import InboxSearchForm from "../inbox-search-form";
import ConversationStatusButton from "./conversation-status-button";
import MarkConversationRead from "./mark-conversation-read";
import NoteCard from "./note-card";
import NoteForm from "./note-form";

type InboxConversationPageProps = {
  params: Promise<{
    contactId: string;
  }>;
  searchParams: Promise<{
    filter?: string;
    q?: string;
  }>;
};

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
  const activeFilter = resolveInboxFilter(resolvedSearchParams.filter);
  const searchQuery = resolvedSearchParams.q?.trim() ?? "";

  const [contacts, conversation] = await Promise.all([
    getInboxContactsByCompany(companyId, {
      filter: activeFilter,
      currentUserId: context.user.id,
      search: searchQuery,
    }),
    getConversationByContact(companyId, contactId),
  ]);

  if (!conversation) {
    notFound();
  }

  return (
    <main className="p-8">
      <MarkConversationRead contactId={conversation.id} />

      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>

          <Link
            href="/dashboard/inbox/quick-replies"
            className="mt-4 inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Manage quick replies
          </Link>

          <InboxFilterTabs
            activeFilter={activeFilter}
            searchQuery={searchQuery}
          />

          <InboxSearchForm
            activeFilter={activeFilter}
            searchQuery={searchQuery}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Conversations
            </h2>

            {contacts.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                {searchQuery
                  ? "No conversations found for this search."
                  : "No conversations found for this filter."}
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {contacts.map((contact) => {
                  const latestMessage = contact.messages[0];
                  const isActive = contact.id === conversation.id;
                  const unreadCount = contact._count.messages;

                  return (
                    <Link
                      key={contact.id}
                      href={`/dashboard/inbox/${contact.id}?filter=${activeFilter}${
                        searchQuery
                          ? `&q=${encodeURIComponent(searchQuery)}`
                          : ""
                      }`}
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
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              {unreadCount} unread
                            </span>
                          )}

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
                            {latestMessage.body}
                          </p>

                          <p className="mt-2 text-xs text-gray-400">
                            {latestMessage.createdAt.toLocaleString()}
                          </p>
                        </>
                      )}
                    </Link>
                  );
                })}
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

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {conversation.messages.length} message(s)
                  </span>

                  <ConversationStatusButton
                    contactId={conversation.id}
                    currentStatus={conversation.inboxStatus}
                  />
                </div>
              </div>
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

                        <p className="mt-3 whitespace-pre-wrap text-sm">
                          {message.body}
                        </p>

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
          </section>
        </div>
      </div>
    </main>
  );
}
