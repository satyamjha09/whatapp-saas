import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getMessageByCompany } from "@/server/services/message.service";

type MessageDetailPageProps = {
  params: Promise<{
    messageId: string;
  }>;
};

export default async function MessageDetailPage({
  params,
}: MessageDetailPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const { messageId } = await params;

  const message = await getMessageByCompany(
    messageId,
    context.membership.companyId,
  );

  if (!message) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/dashboard/messages"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to messages
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">
            Message Detail
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {message.contact.name ?? "Unnamed Contact"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                To: +{message.toPhoneNumber}
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {message.status}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Template</p>
              <p className="mt-1 font-semibold text-gray-900">
                {message.template?.name ?? "Deleted template"}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Meta Message ID</p>
              <p className="mt-1 break-all font-semibold text-gray-900">
                {message.metaMessageId ?? "Not available yet"}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Scheduled Send</p>
              <p className="mt-1 font-semibold text-gray-900">
                {message.scheduledAt
                  ? message.scheduledAt.toLocaleString()
                  : "Not scheduled"}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Message Body</p>

            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
              {message.body}
            </p>
          </div>

          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm text-gray-500">Variables</p>

            {message.variables.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No variables</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.variables.map((variable, index) => (
                  <span
                    key={`${variable}-${index}`}
                    className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                  >
                    {variable}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Message Timeline
          </h2>

          {message.events.length === 0 ? (
            <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              No events found.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {message.events.map((event) => (
                <div key={event.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {event.status}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {event.createdAt.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {event.raw ? (
                    <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                      {JSON.stringify(event.raw, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
