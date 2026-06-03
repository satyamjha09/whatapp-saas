import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getMessagesByCompany } from "@/server/services/message.service";

export default async function ReportsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const messages = await getMessagesByCompany(context.membership.companyId);

  const stats = [
    { label: "Total", value: messages.length },
    {
      label: "Queued",
      value: messages.filter((message) => message.status === "QUEUED").length,
    },
    {
      label: "Sending",
      value: messages.filter((message) => message.status === "SENDING").length,
    },
    {
      label: "Sent",
      value: messages.filter((message) => message.status === "SENT").length,
    },
    {
      label: "Delivered",
      value: messages.filter((message) => message.status === "DELIVERED")
        .length,
    },
    {
      label: "Read",
      value: messages.filter((message) => message.status === "READ").length,
    },
    {
      label: "Failed",
      value: messages.filter((message) => message.status === "FAILED").length,
    },
  ];

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

          <h1 className="mt-5 text-3xl font-bold text-gray-900">Reports</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Latest Messages
          </h2>

          {messages.length === 0 ? (
            <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              No messages found.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-4">Contact</th>
                    <th className="py-3 pr-4">Phone</th>
                    <th className="py-3 pr-4">Template</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3 pr-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {messages.map((message) => (
                    <tr key={message.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        {message.contact.name ?? "Unnamed Contact"}
                      </td>

                      <td className="py-3 pr-4">+{message.toPhoneNumber}</td>

                      <td className="py-3 pr-4">
                        {message.template?.name ?? "Deleted template"}
                      </td>

                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {message.status}
                        </span>
                      </td>

                      <td className="py-3 pr-4">
                        {message.createdAt.toLocaleDateString()}
                      </td>

                      <td className="py-3 pr-4">
                        <Link
                          href={`/dashboard/messages/${message.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
