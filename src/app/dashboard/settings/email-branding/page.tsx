import Link from "next/link";
import { CompanyType } from "@/generated/prisma/client";
import { PartnerEmailBrandingPanel } from "@/components/partner-email-branding-panel";
import {
  getPartnerEmailBrandingDraft,
  getPartnerEmailDeliveryAnalytics,
} from "@/server/services/partner-email-branding.service";
import { requireCompanyAdmin } from "@/server/tenant/tenant-context";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function DashboardPartnerEmailBrandingPage() {
  const context = await requireCompanyAdmin();

  if (context.company.type !== CompanyType.PARTNER) {
    return (
      <main className="space-y-6">
        <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
            White-label email
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
            Email branding is for partner workspaces
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
            This workspace receives branded emails from the owning partner once
            the partner sender domain is verified. Direct workspaces continue to
            use MetaWhat sender settings.
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

  const [{ partner, emailBranding }, analytics] = await Promise.all([
    getPartnerEmailBrandingDraft(context.companyId),
    getPartnerEmailDeliveryAnalytics(context.companyId),
  ]);

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
          White-label email
        </p>
        <h1 className="mt-2 text-3xl font-black text-[#081B3A]">
          Configure sender email for {partner.name}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526173]">
          Verify SPF, DKIM, and DMARC before MetaWhat sends notification and
          billing emails using your partner sender. Until verification passes,
          emails safely fall back to the MetaWhat sender.
        </p>
      </section>

      <PartnerEmailBrandingPanel
        endpoint="/api/partner/email-branding"
        initialEmailBranding={serialize(emailBranding)}
        partnerCompanyId={context.companyId}
        analytics={serialize(analytics)}
      />
    </main>
  );
}
