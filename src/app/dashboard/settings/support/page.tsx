import Link from "next/link";
import { CompanyType } from "@/generated/prisma/client";
import { PartnerSupportPanel } from "@/components/partner-support-panel";
import { listPartnerSupportTickets } from "@/server/services/partner-support.service";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";

export default async function DashboardPartnerSupportPage() {
  const context = await requireCompanyAdmin();

  if (context.company.type !== CompanyType.PARTNER) {
    return (
      <main className="space-y-6">
        <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
            Partner support
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
            Support tickets are for partner workspaces
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
            Direct and client workspaces can use the normal support channel.
            Partner support tracks client impact, SLAs, comments, and platform
            handoff for reseller operations.
          </p>
          <Link
            href="/dashboard/settings/company"
            className="mt-6 inline-flex rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-50"
          >
            Back to company settings
          </Link>
        </section>
      </main>
    );
  }

  const tickets = await listPartnerSupportTickets({
    partnerCompanyId: context.companyId,
  });

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
          Partner support
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
          Support desk for {context.company.name}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
          Open tickets for partner issues or client-impacting problems. MetaWhat
          tracks priority, SLA timers, comments, assignment, and resolution
          history in one queue.
        </p>
      </section>

      <PartnerSupportPanel mode="partner" initialTickets={tickets} />
    </main>
  );
}
