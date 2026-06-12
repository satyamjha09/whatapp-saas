import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getInboxContactsByCompany,
  resolveInboxFilter,
} from "@/server/services/inbox.service";
import InboxFilterTabs from "./inbox-filter-tabs";
import InboxSearchForm from "./inbox-search-form";
import { getPriorityColorClass } from "./priority-color";

type InboxPageProps = {
  searchParams: Promise<{
    filter?: string;
    q?: string;
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
  const activeFilter = resolveInboxFilter(resolvedSearchParams.filter);
  const searchQuery = resolvedSearchParams.q?.trim() ?? "";

  const contacts = await getInboxContactsByCompany(
    context.membership.companyId,
    {
      filter: activeFilter,
      currentUserId: context.user.id,
      search: searchQuery,
    },
  );

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
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
                  const unreadCount = contact._count.messages;

                  return (
                    <Link
                      key={contact.id}
                      href={`/dashboard/inbox/${contact.id}?filter=${activeFilter}${
                        searchQuery
                          ? `&q=${encodeURIComponent(searchQuery)}`
                          : ""
                      }`}
                      className="block rounded-xl border p-4 transition hover:bg-gray-50"
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

          <section className="flex min-h-[520px] items-center justify-center rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Select a conversation
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Choose a contact from the left to view the conversation.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
