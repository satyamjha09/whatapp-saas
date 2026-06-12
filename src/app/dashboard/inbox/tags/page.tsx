import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxTagsByCompany } from "@/server/services/inbox-tag.service";
import DeleteTagButton from "./delete-tag-button";
import TagForm from "./tag-form";

export default async function InboxTagsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const tags = await getInboxTagsByCompany(context.membership.companyId);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inbox Tags</h1>

            <p className="mt-2 text-sm text-gray-600">
              Workspace: {context.membership.company.name}
            </p>
          </div>

          <Link
            href="/dashboard/inbox"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Back to Inbox
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Create Tag</h2>

            <p className="mt-1 text-sm text-gray-600">
              Create tags like Pricing, Refund, Support, Hot Lead.
            </p>

            <div className="mt-6">
              <TagForm />
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Saved Tags</h2>

            {tags.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No tags yet.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{tag.name}</p>

                      <p className="mt-1 text-xs text-gray-500">
                        Color: {tag.color}
                      </p>
                    </div>

                    <DeleteTagButton tagId={tag.id} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
