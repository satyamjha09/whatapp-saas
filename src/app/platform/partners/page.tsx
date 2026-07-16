import {
  GrantClientAccessForm,
  RevokeClientAccessButton,
} from "@/app/platform/partners/grant-client-access-form";
import {
  PartnerClientSubscriptionForm,
  PartnerPriceBookForm,
  PartnerPriceBookItemForm,
} from "@/app/platform/partners/partner-pricing-forms";
import { ProvisionClientForm } from "@/app/platform/partners/provision-client-form";
import { RetryProvisioningButton } from "@/app/platform/partners/retry-provisioning-button";
import { StartClientAccessButton } from "@/app/platform/partners/start-client-access-button";
import { getPartnerClientAccessDashboard } from "@/server/services/partner-client-access.service";
import { getPartnerClientProvisioningDashboard } from "@/server/services/partner-client-provisioning.service";
import { getPartnerPricingDashboard } from "@/server/services/partner-pricing.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { roleHasPlatformPermission } from "@/server/tenant/platform-permissions";

function statusClass(status: string) {
  if (status === "COMPLETED" || status === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "PROCESSING" || status === "PROVISIONING") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "PENDING" || status === "INVITED") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "FAILED" || status === "SUSPENDED") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function moneyLabel(value: number | null | undefined, currency = "INR") {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export default async function PlatformPartnersPage() {
  const platform = await requirePlatformPermission("PLATFORM_PARTNER_VIEW");
  const canManage = roleHasPlatformPermission(
    platform.platformRole,
    "PLATFORM_PARTNER_MANAGE",
  );
  const canAssignPlans = roleHasPlatformPermission(
    platform.platformRole,
    "PLATFORM_PLAN_MANAGE",
  );
  const [dashboard, accessDashboard, pricingDashboard] = await Promise.all([
    getPartnerClientProvisioningDashboard(),
    getPartnerClientAccessDashboard(),
    getPartnerPricingDashboard(),
  ]);
  const accessPartnersById = new Map(
    accessDashboard.partners.map((partner) => [partner.id, partner]),
  );
  const priceBookOptions = pricingDashboard.flatMap((partner) =>
    partner.partnerPriceBooks.map((book) => ({
      id: book.id,
      partnerCompanyId: book.partnerCompanyId,
      name: `${partner.name} - ${book.name}`,
      currency: book.currency,
      active: book.active,
      items: book.items.map((item) => ({
        id: item.id,
        platformPlanCode: item.platformPlanCode,
        minimumRetailPaise: item.minimumRetailPaise,
        suggestedRetailPaise: item.suggestedRetailPaise,
        active: item.active,
      })),
    })),
  );
  const clientOptions = pricingDashboard.flatMap((partner) =>
    partner.partnerClientRelationshipsAsPartner.map((relationship) => ({
      id: relationship.clientCompany.id,
      name: `${relationship.clientCompany.name} (${partner.name})`,
      partnerCompanyId: partner.id,
    })),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Platform Admin</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Partner Provisioning
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Provision client workspaces under partners with owner invites, default
            RBAC roles, billing owner mapping, and plan assignment.
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Partners</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {dashboard.partners.length}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Provisioning</p>
          <p className="mt-2 text-2xl font-black text-blue-700">
            {(dashboard.counts.PENDING ?? 0) +
              (dashboard.counts.PROCESSING ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {dashboard.counts.COMPLETED ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Failed</p>
          <p className="mt-2 text-2xl font-black text-red-700">
            {dashboard.counts.FAILED ?? 0}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Partner access
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Temporary client sessions
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Grant scoped client access to partner team members, then open an
              audited temporary workspace session without creating client-company
              membership.
            </p>
          </div>
          <div className="rounded-2xl bg-white px-5 py-3 text-right shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Active sessions
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-700">
              {accessDashboard.activeSessions.length}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Phase 4
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Partner pricing and subscriptions
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Maintain wholesale price books, retail floors, client subscription
              snapshots, and plan-change history before invoices are generated.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-5 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Price books
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-700">
              {priceBookOptions.length}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <PartnerPriceBookForm
            canManage={canManage}
            partners={pricingDashboard.map((partner) => ({
              id: partner.id,
              name: partner.name,
              status: partner.status,
            }))}
          />
          <PartnerPriceBookItemForm
            isSuperAdmin={platform.isPlatformSuperAdmin}
            priceBooks={priceBookOptions}
          />
          <PartnerClientSubscriptionForm
            canAssign={canAssignPlans}
            clients={clientOptions}
            priceBooks={priceBookOptions}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {pricingDashboard.map((partner) => (
            <div
              key={partner.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-black text-slate-950">{partner.name}</p>
                  <p className="text-xs text-slate-500">{partner.id}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                    partner.status,
                  )}`}
                >
                  {partner.status}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {partner.partnerPriceBooks.map((book) => (
                  <div key={book.id} className="rounded-xl bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-950">{book.name}</p>
                        <p className="text-xs text-slate-500">
                          {book.currency} · {book.active ? "Active" : "Inactive"}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {book.items.length} plan prices
                      </span>
                    </div>

                    <div className="mt-3 overflow-auto">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="py-2">Plan</th>
                            <th className="py-2">Wholesale</th>
                            <th className="py-2">Floor</th>
                            <th className="py-2">Suggested</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {book.items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2 font-bold">
                                {item.platformPlanCode}
                              </td>
                              <td className="py-2">
                                {moneyLabel(
                                  item.wholesaleMonthlyPaise,
                                  book.currency,
                                )}
                              </td>
                              <td className="py-2">
                                {moneyLabel(
                                  item.minimumRetailPaise,
                                  book.currency,
                                )}
                              </td>
                              <td className="py-2">
                                {moneyLabel(
                                  item.suggestedRetailPaise,
                                  book.currency,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {partner.partnerPriceBooks.length === 0 ? (
                  <p className="rounded-xl bg-white px-3 py-4 text-sm text-slate-500">
                    No price book configured for this partner yet.
                  </p>
                ) : null}

                {partner.partnerClientRelationshipsAsPartner.map(
                  (relationship) => (
                    <div
                      key={relationship.id}
                      className="rounded-xl border border-emerald-100 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-950">
                            {relationship.clientCompany.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Current plan: {relationship.clientCompany.billingPlan}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                            relationship.status,
                          )}`}
                        >
                          {relationship.status}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {relationship.subscriptions.map((subscription) => (
                          <div
                            key={subscription.id}
                            className="rounded-lg bg-slate-50 px-3 py-2 text-xs"
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <p className="font-bold text-slate-900">
                                {subscription.platformPlanCode} ·{" "}
                                {subscription.status}
                              </p>
                              <p className="font-bold text-emerald-700">
                                {moneyLabel(
                                  subscription.retailAmountPaise,
                                  subscription.currency,
                                )}
                              </p>
                            </div>
                            <p className="mt-1 text-slate-500">
                              Wholesale{" "}
                              {moneyLabel(
                                subscription.wholesaleAmountPaise,
                                subscription.currency,
                              )}{" "}
                              · Ends {dateLabel(subscription.currentPeriodEnd)}
                            </p>
                          </div>
                        ))}

                        {relationship.subscriptions.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No partner subscription snapshot yet.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ProvisionClientForm
          canManage={canManage}
          partners={dashboard.partners.map((partner) => ({
            id: partner.id,
            name: partner.name,
            status: partner.status,
          }))}
        />

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Partner clients
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Relationship overview
            </h2>
          </div>

          <div className="mt-5 space-y-3">
            {dashboard.partners.map((partner) => (
              <div
                key={partner.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-950">{partner.name}</p>
                    <p className="text-xs text-slate-500">{partner.id}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                      partner.status,
                    )}`}
                  >
                    {partner.status}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {partner.partnerClientRelationshipsAsPartner.map(
                    (relationship) => {
                      const accessPartner = accessPartnersById.get(partner.id);
                      const accessRelationship =
                        accessPartner?.partnerClientRelationshipsAsPartner.find(
                          (item) => item.id === relationship.id,
                        );
                      const partnerUsers =
                        accessPartner?.users.map((membership) => ({
                          id: membership.user.id,
                          name: membership.user.name,
                          email: membership.user.email,
                          role: membership.role,
                        })) ?? [];

                      return (
                        <div
                          key={relationship.id}
                          className="rounded-xl bg-white p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900">
                                {relationship.clientCompany.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {relationship.clientCompany.id}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                                  relationship.status,
                                )}`}
                              >
                                {relationship.status}
                              </span>
                              <StartClientAccessButton
                                clientCompanyId={relationship.clientCompany.id}
                              />
                            </div>
                          </div>

                          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                Access grants
                              </p>
                              <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">
                                {accessRelationship?.accessGrants.length ?? 0} grants
                              </span>
                            </div>

                            <div className="mt-2 space-y-2">
                              {accessRelationship?.accessGrants.map((grant) => (
                                <div
                                  key={grant.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                                >
                                  <div>
                                    <p className="font-bold text-slate-900">
                                      {grant.user.name || grant.user.email}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {grant.permissions.join(", ")}
                                    </p>
                                    {grant.expiresAt ? (
                                      <p className="text-xs text-amber-700">
                                        Expires {dateLabel(grant.expiresAt)}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                                        grant.active
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      {grant.active ? "Active" : "Revoked"}
                                    </span>
                                    {canManage && grant.active ? (
                                      <RevokeClientAccessButton grantId={grant.id} />
                                    ) : null}
                                  </div>
                                </div>
                              ))}

                              {!accessRelationship?.accessGrants.length ? (
                                <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
                                  No partner users have access to this client yet.
                                </p>
                              ) : null}
                            </div>

                            <GrantClientAccessForm
                              canManage={canManage}
                              clientCompanyId={relationship.clientCompany.id}
                              partnerCompanyId={partner.id}
                              users={partnerUsers}
                            />
                          </div>
                        </div>
                      );
                    },
                  )}

                  {partner.partnerClientRelationshipsAsPartner.length === 0 ? (
                    <p className="rounded-xl bg-white px-3 py-4 text-sm text-slate-500">
                      No client workspaces linked yet.
                    </p>
                  ) : null}
                </div>
              </div>
            ))}

            {dashboard.partners.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="font-bold text-slate-900">No partner companies yet.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create or convert a company to PARTNER before provisioning clients.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">
            Provisioning Jobs
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Idempotent jobs with retry-safe events for client provisioning.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Partner</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Events</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboard.jobs.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">
                      {job.clientCompany?.name ?? job.requestedCompanyName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {job.clientCompanyId ?? job.id}
                    </p>
                    {job.lastError ? (
                      <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                        {job.lastError}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      {job.partnerCompany.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {job.partnerCompany.status}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      {job.requestedOwnerEmail}
                    </p>
                    <p className="text-xs text-slate-500">
                      {job.requestedOwnerName || "-"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold">{job.requestedPlan}</p>
                    <p className="text-xs text-slate-500">
                      {job.requestedPlanDays} days
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                        job.status,
                      )}`}
                    >
                      {job.status}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      Attempts: {job.attemptCount}/{job.maxAttempts}
                    </p>
                    {job.nextRetryAt ? (
                      <p className="text-xs text-amber-700">
                        Retry: {dateLabel(job.nextRetryAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <div className="max-h-44 space-y-2 overflow-auto pr-2">
                      {job.events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-xs font-bold text-slate-900">
                            {event.type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {dateLabel(event.createdAt)}
                          </p>
                          {event.message ? (
                            <p className="mt-1 text-xs text-slate-600">
                              {event.message}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {canManage && job.status === "FAILED" ? (
                      <RetryProvisioningButton jobId={job.id} />
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}

              {dashboard.jobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No provisioning jobs yet.
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
