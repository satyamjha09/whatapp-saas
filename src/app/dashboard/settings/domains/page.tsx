import Link from "next/link";
import { CompanyType } from "@/generated/prisma/client";
import { PartnerCustomDomainsPanel } from "@/components/partner-custom-domains-panel";
import { listPartnerCustomDomains } from "@/server/services/partner-custom-domain.service";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function DashboardPartnerDomainsPage() {
  const context = await requireCompanyAdmin();

  if (context.company.type !== CompanyType.PARTNER) {
    return (
      <main className="space-y-6">
        <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
            Custom domains
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
            White-label domains are for partner workspaces
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
            This workspace is a direct client workspace. Custom domains are
            requested from the partner parent workspace, verified through DNS,
            then approved by the platform team.
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

  const domains = await listPartnerCustomDomains(context.companyId);

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
          Partner domains
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
          Connect custom domains for {context.company.name}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
          Request white-label domains, prove ownership with a TXT record, point
          DNS to MetaWhat, and submit for platform approval before production
          traffic is enabled.
        </p>
      </section>

      <PartnerCustomDomainsPanel
        endpoint="/api/partner/domains"
        initialDomains={serialize(domains)}
        partnerCompanyId={context.companyId}
      />
    </main>
  );
}
