import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactsByCompany } from "@/server/services/contact.service";
import { getMessagesByCompany } from "@/server/services/message.service";
import { getTemplatesByCompany } from "@/server/services/template.service";
import SendMessageForm from "./send-message-form";

export default async function MessagesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const companyId = context.membership.companyId;

  const [contacts, templates, messages] = await Promise.all([
    getContactsByCompany(companyId),
    getTemplatesByCompany(companyId),
    getMessagesByCompany(companyId),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to dashboard
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">Messages</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        {contacts.length === 0 || templates.length === 0 ? (
          <div className="mb-6 rounded-2xl border bg-yellow-50 p-5 text-sm text-yellow-800">
            Before sending a message, create at least one contact and one
            template.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <SendMessageForm contacts={contacts} templates={templates} />

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Message History
            </h2>

            {messages.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No messages queued yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {message.contact.name ?? "Unnamed Contact"}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          To: +{message.toPhoneNumber}
                        </p>
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {message.status}
                      </span>
                    </div>

                    <p className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      {message.body}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>
                        Template: {message.template?.name ?? "Deleted template"}
                      </span>

                      <span>-</span>

                      <span>
                        Created: {message.createdAt.toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/dashboard/messages/${message.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        View details &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
