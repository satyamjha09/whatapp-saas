import Link from "next/link";
import { getPlatformCompaniesDashboard } from "@/server/services/platform-company-control.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "text-slate-950 bg-white",
    emerald: "text-emerald-800 bg-emerald-50",
    amber: "text-amber-800 bg-amber-50",
    rose: "text-rose-800 bg-rose-50",
  }[tone];

  return (
    <article className={`rounded-2xl border border-emerald-100 p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </article>
  );
}

export default async function PlatformOverviewPage() {
  await requirePlatformPermission("PLATFORM_OVERVIEW_VIEW");
  const dashboard = await getPlatformCompaniesDashboard();
  const total = dashboard.companies.length;
  const active = dashboard.counts.ACTIVE ?? 0;
  const pending = dashboard.counts.PENDING_ONBOARDING ?? 0;
  const suspended = dashboard.counts.SUSPENDED ?? 0;
  const disabled = dashboard.counts.DISABLED ?? 0;
  const partnerCompanies = dashboard.companies.filter(
    (company) => company.type === "PARTNER",
  ).length;
  const partnerClients = dashboard.companies.filter(
    (company) => company.type === "PARTNER_CLIENT",
  ).length;
  const connectedWhatsApp = dashboard.companies.filter(
    (company) => company.whatsAppAccounts.length > 0,
  ).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Platform overview
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            MetaWhat control plane
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Internal snapshot for businesses, partners, workspace health, and
            high-risk operations.
          </p>
        </div>

        <Link
          href="/platform/companies"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          Open companies
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total businesses" value={total} />
        <StatCard label="Active businesses" value={active} tone="emerald" />
        <StatCard label="Trial / onboarding" value={pending} tone="amber" />
        <StatCard
          label="Suspended / disabled"
          value={suspended + disabled}
          tone="rose"
        />
        <StatCard label="Partner companies" value={partnerCompanies} />
        <StatCard label="Partner clients" value={partnerClients} />
        <StatCard label="WhatsApp connected" value={connectedWhatsApp} />
        <StatCard label="Open support cases" value="Phase 1+" />
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Phase 0 hardening
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Permissions are role-aware. Partner provisioning, pricing,
              commissions, branding, and custom domains remain intentionally
              out of scope.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Foundation only
          </span>
        </div>
      </section>
    </main>
  );
}
