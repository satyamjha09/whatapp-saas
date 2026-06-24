import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import {
  getPrivacyCenterHealth,
  listPrivacyRequests,
} from "@/server/services/privacy-center.service";
import { ProcessPrivacyRequestButton } from "./privacy-request-actions";

export default async function PrivacyCenterPage() {
  const context = await requireAdmin();
  const [health, requests] = await Promise.all([
    getPrivacyCenterHealth(),
    listPrivacyRequests({ companyId: context.membership.companyId }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">System</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Privacy Center
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage contact data export and privacy deletion requests.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Pending", health.pending],
          ["Completed / 24h", health.completed24h],
          ["Failed / 24h", health.failed24h],
          ["Expired Files", health.expiredFiles],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Privacy Requests
          </h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Requester</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {request.type}
                  </td>
                  <td className="px-5 py-4">{request.status}</td>
                  <td className="px-5 py-4">
                    {request.contact ? (
                      <Link
                        href={`/dashboard/contacts/${request.contact.id}/crm`}
                        className="font-medium text-gray-900 underline"
                      >
                        {request.contact.name ?? request.contact.phoneNumber}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {request.requestedBy?.email ?? request.requesterEmail ?? "-"}
                  </td>
                  <td className="px-5 py-4">
                    {request.createdAt.toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {["PENDING", "FAILED"].includes(request.status) ? (
                        <ProcessPrivacyRequestButton requestId={request.id} />
                      ) : null}

                      {request.status === "COMPLETED" &&
                      request.exportFileName ? (
                        <a
                          href={`/api/privacy/requests/${request.id}/download`}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>

                    {request.failureReason ? (
                      <p className="mt-2 max-w-xs text-xs text-red-600">
                        {request.failureReason}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}

              {requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No privacy requests yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
