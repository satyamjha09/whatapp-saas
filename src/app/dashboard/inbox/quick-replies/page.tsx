import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getQuickRepliesByCompany } from "@/server/services/quick-reply.service";
import QuickReplyCard from "./quick-reply-card";
import QuickReplyForm from "./quick-reply-form";

export default async function QuickRepliesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const quickReplies = await getQuickRepliesByCompany(
    context.membership.companyId,
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/dashboard/inbox"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to inbox
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">
            Quick Replies
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <QuickReplyForm />

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Saved Replies
            </h2>

            {quickReplies.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No quick replies created yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {quickReplies.map((quickReply) => (
                  <QuickReplyCard
                    key={quickReply.id}
                    quickReply={quickReply}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
