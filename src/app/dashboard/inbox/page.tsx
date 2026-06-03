import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxContactsByCompany } from "@/server/services/inbox.service";

export default async function InboxPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const contacts = await getInboxContactsByCompany(
    context.membership.companyId,
  );

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Conversations
            </h2>

            {contacts.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No conversations yet. Inbound replies will appear here.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {contacts.map((contact) => {
                  const latestMessage = contact.messages[0];
                  const unreadCount = contact._count.messages;

                  return (
                    <Link
                      key={contact.id}
                      href={`/dashboard/inbox/${contact.id}`}
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
