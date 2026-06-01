import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getTemplatesByCompany } from "@/server/services/template.service";
import TemplateForm from "./template-form";

export default async function TemplatesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const templates = await getTemplatesByCompany(context.membership.companyId);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            &larr; Back to dashboard
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-gray-900">
            Message Templates
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <TemplateForm />

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Saved Templates
            </h2>

            {templates.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                No templates created yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {template.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {template.language} - {template.category}
                        </p>
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {template.status}
                      </span>
                    </div>

                    <p className="mt-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      {template.body}
                    </p>

                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500">
                        Variables
                      </p>

                      {template.variables.length === 0 ? (
                        <p className="mt-1 text-sm text-gray-500">
                          No variables
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {template.variables.map((variable) => (
                            <span
                              key={variable}
                              className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                            >
                              {variable}
                            </span>
                          ))}
                        </div>
                      )}
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
