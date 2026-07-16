import Link from "next/link";
import { CompanyType } from "@/generated/prisma/client";
import { PartnerBrandingForm } from "@/components/partner-branding-form";
import { getPartnerBrandingDraft } from "@/server/services/partner-branding.service";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";

export default async function DashboardPartnerBrandingPage() {
  const context = await requireCompanyAdmin();

  if (context.company.type !== CompanyType.PARTNER) {
    return (
      <main className="space-y-6">
        <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
            Partner branding
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
            White-label branding is for partner workspaces
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
            This workspace is a client or direct company workspace. Branding is
            configured on the partner parent workspace, then inherited by client
            workspaces after platform approval.
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

  const { partner, branding } = await getPartnerBrandingDraft(context.companyId);

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
          Partner branding
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
          Brand {partner.name} for client workspaces
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
          Save logos, colours, app name, support identity, and login copy. Once
          approved by MetaWhat, active child client workspaces inherit this
          brand automatically.
        </p>
      </section>

      <PartnerBrandingForm
        endpoint="/api/partner/branding"
        initialBranding={branding}
        partnerCompanyId={context.companyId}
      />
    </main>
  );
}
