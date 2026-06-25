import Link from "next/link";
import { PlatformCompanyActions } from "@/app/platform/companies/company-actions";
import { getPlatformCompaniesDashboard } from "@/server/services/platform-company-control.service";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-green-50 text-green-700";
  if (status === "PENDING_ONBOARDING") return "bg-yellow-50 text-yellow-700";
  if (status === "SUSPENDED") return "bg-red-50 text-red-700";
  if (status === "DISABLED") return "bg-gray-200 text-gray-700";

  return "bg-gray-100 text-gray-700";
}

export default async function PlatformCompaniesPage() {
  await requirePlatformAdmin();

  const dashboard = await getPlatformCompaniesDashboard();
  const { companies } = dashboard;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Platform Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Company Control Center
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage companies, signup details, platform notes, and workspace status.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Companies</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {companies.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {dashboard.counts.ACTIVE ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="mt-2 text-2xl font-bold text-yellow-700">
            {dashboard.counts.PENDING_ONBOARDING ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Suspended / Disabled</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {(dashboard.counts.SUSPENDED ?? 0) + (dashboard.counts.DISABLED ?? 0)}
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold">All Companies</h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Signup Details</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">WhatsApp</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {companies.map((company) => {
                const owner = company.users.find((item) => item.role === "OWNER");
                const phoneNumber = company.whatsAppPhoneNumbers[0];

                return (
                  <tr key={company.id}>
                    <td className="px-5 py-4">
                      <Link
                        href={`/platform/companies/${company.id}`}
                        className="font-semibold text-blue-700 underline"
                      >
                        {company.name}
                      </Link>
                      <p className="mt-1 font-mono text-xs text-gray-500">
                        {company.id}
                      </p>
                      {company.parentCompany ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Parent: {company.parentCompany.name}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-5 py-4 text-xs text-gray-600">
                      <p>Category: {company.businessCategory ?? "-"}</p>
                      <p>City: {company.city ?? "-"}</p>
                      <p>PIN: {company.pinCode ?? "-"}</p>
                      <p>Employee Code: {company.employeeCode ?? "-"}</p>
                    </td>

                    <td className="px-5 py-4">{company.type}</td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          company.status,
                        )}`}
                      >
                        {company.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">
                        {owner?.user.name ?? "-"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {owner?.user.email ?? "-"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {owner?.user.mobile ?? "-"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-xs text-gray-600">
                      {phoneNumber ? (
                        <>
                          <p>{phoneNumber.displayPhoneNumber ?? "-"}</p>
                          <p>{phoneNumber.phoneNumberId ?? "-"}</p>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <PlatformCompanyActions
                        companyId={company.id}
                        status={company.status}
                      />
                    </td>
                  </tr>
                );
              })}

              {companies.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No companies yet.
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
