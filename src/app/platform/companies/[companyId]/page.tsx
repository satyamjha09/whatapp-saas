import Link from "next/link";
import { PlatformCompanyPlanActions } from "@/app/platform/companies/company-plan-actions";
import {
  PlatformCompanyActions,
  PlatformCompanyNoteForm,
} from "@/app/platform/companies/company-actions";
import { getCompanyPlanAccessSummary } from "@/server/services/company-plan-assignment.service";
import { getPlatformCompanyDetail } from "@/server/services/platform-company-control.service";
import { requirePlatformAdmin } from "@/server/tenant/tenant-context";

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-green-50 text-green-700";
  if (status === "PENDING_ONBOARDING") return "bg-yellow-50 text-yellow-700";
  if (status === "SUSPENDED") return "bg-red-50 text-red-700";
  if (status === "DISABLED") return "bg-gray-200 text-gray-700";

  return "bg-gray-100 text-gray-700";
}

export default async function PlatformCompanyDetailPage({
  params,
}: {
  params: Promise<{
    companyId: string;
  }>;
}) {
  const platform = await requirePlatformAdmin();
  const { companyId } = await params;
  const company = await getPlatformCompanyDetail({
    companyId,
    actorUserId: platform.user.id,
  });
  const planSummary = await getCompanyPlanAccessSummary(company.id);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/platform/companies"
            className="text-sm font-semibold text-blue-700 underline"
          >
            Back to companies
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            {company.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                company.status,
              )}`}
            >
              {company.status}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              {company.type}
            </span>
          </div>
        </div>

        <PlatformCompanyActions companyId={company.id} status={company.status} />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Team Members</p>
          <p className="mt-2 text-2xl font-bold">{company.users.length}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Child Companies</p>
          <p className="mt-2 text-2xl font-bold">
            {company.childCompanies.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">WhatsApp Accounts</p>
          <p className="mt-2 text-2xl font-bold">
            {company.whatsAppAccounts.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Wallet</p>
          <p className="mt-2 text-2xl font-bold">
            {company.wallet
              ? `Rs ${(company.wallet.balancePaise / 100).toFixed(2)}`
              : "Rs 0.00"}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>

          {planSummary.currentPlan ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Plan:</span>{" "}
                <b>{planSummary.currentPlan.planName}</b>
              </p>
              <p>
                <span className="text-gray-500">Code:</span>{" "}
                <b>{planSummary.currentPlan.planCode}</b>
              </p>
              <p>
                <span className="text-gray-500">Status:</span>{" "}
                <b>{planSummary.currentPlan.status}</b>
              </p>
              <p>
                <span className="text-gray-500">Source:</span>{" "}
                <b>{planSummary.currentPlan.source}</b>
              </p>
              <p>
                <span className="text-gray-500">Trial Ends:</span>{" "}
                <b>{planSummary.currentPlan.trialEndsAt?.toLocaleString() ?? "-"}</b>
              </p>
              <p>
                <span className="text-gray-500">Period Ends:</span>{" "}
                <b>
                  {planSummary.currentPlan.currentPeriodEndsAt?.toLocaleString() ??
                    "-"}
                </b>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No plan assigned.</p>
          )}
        </section>

        <PlatformCompanyPlanActions companyId={company.id} />
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Signup / Account Details
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["Business Name", company.name],
            ["Business Category", company.businessCategory ?? "-"],
            ["City", company.city ?? "-"],
            ["PIN Code", company.pinCode ?? "-"],
            ["Channel Partner", company.channelPartner ?? "-"],
            ["Employee Code", company.employeeCode ?? "-"],
            ["WhatsApp Consent", company.whatsappUpdatesConsent ? "Yes" : "No"],
            ["Billing Plan", company.billingPlan],
            ["Subscription Status", company.subscriptionStatus],
            ["Billing Owner", company.billingOwnerType],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Team</h2>

        <div className="mt-4 divide-y">
          {company.users.map((member) => (
            <div key={member.id} className="py-3">
              <p className="font-semibold text-gray-900">
                {member.user.name ?? "Unnamed"} - {member.role}
              </p>
              <p className="text-sm text-gray-500">
                {member.user.email} - {member.user.mobile ?? "-"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {company.childCompanies.length > 0 ? (
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Partner Client Companies
          </h2>

          <div className="mt-4 divide-y">
            {company.childCompanies.map((child) => (
              <Link
                key={child.id}
                href={`/platform/companies/${child.id}`}
                className="block py-3"
              >
                <p className="font-semibold text-blue-700 underline">
                  {child.name}
                </p>
                <p className="text-sm text-gray-500">
                  {child.type} - {child.status}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          WhatsApp Accounts
        </h2>

        <div className="mt-4 divide-y">
          {company.whatsAppAccounts.map((account) => (
            <div key={account.id} className="py-3">
              <p className="font-semibold text-gray-900">
                {account.businessName ?? account.wabaId ?? account.id}
              </p>
              <p className="text-sm text-gray-500">
                {account.status} - {account.phoneNumbers.length} phone numbers
              </p>
            </div>
          ))}
          {company.whatsAppAccounts.length === 0 ? (
            <p className="text-sm text-gray-500">No WhatsApp accounts yet.</p>
          ) : null}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PlatformCompanyNoteForm companyId={company.id} />

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Platform Notes
          </h2>

          <div className="mt-4 space-y-3">
            {company.platformCompanyNotes.map((note) => (
              <article key={note.id} className="rounded-xl bg-gray-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    {note.visibility}
                  </span>
                  <span className="text-xs text-gray-500">
                    {note.createdAt.toLocaleString()}
                  </span>
                </div>

                <h3 className="mt-3 font-semibold text-gray-900">{note.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                  {note.body}
                </p>

                <p className="mt-3 text-xs text-gray-500">
                  By {note.createdByUser.email}
                </p>
              </article>
            ))}

            {company.platformCompanyNotes.length === 0 ? (
              <p className="text-sm text-gray-500">No notes yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Platform Action Logs
        </h2>

        <div className="mt-4 divide-y">
          {company.platformCompanyActionLogs.map((log) => (
            <div key={log.id} className="py-3">
              <p className="font-semibold text-gray-900">
                {log.type} - {log.title}
              </p>
              <p className="text-sm text-gray-500">
                By {log.actorUser.email} - {log.createdAt.toLocaleString()}
              </p>
              {log.description ? (
                <p className="mt-1 text-sm text-gray-600">{log.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
