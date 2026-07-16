import { PartnerBrandingForm } from "@/components/partner-branding-form";
import { listPartnerBrandingRecords } from "@/server/services/partner-branding.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

function statusTone(status?: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING_REVIEW") return "bg-amber-100 text-amber-700";
  if (status === "REJECTED" || status === "DISABLED") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

export default async function PlatformBrandingPage() {
  await requirePlatformPermission("PLATFORM_BRANDING_MANAGE");
  const partners = await listPartnerBrandingRecords();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-slate-500">Platform Admin</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">
          Partner Branding
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Review partner logos, colours, app names, support identity, and
          white-label settings before they inherit into client workspaces.
        </p>
      </div>

      <section className="mt-6 space-y-6">
        {partners.map((partner) => {
          const branding = partner.partnerBranding ?? {
            appName: partner.name,
            companyName: partner.name,
            status: "DRAFT",
          };

          return (
            <article
              key={partner.id}
              className="rounded-3xl border border-emerald-100 bg-white/92 p-5 shadow-sm"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    {partner.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {partner.childCompanies.length} client workspaces inherit
                    this brand after approval.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(
                    branding.status,
                  )}`}
                >
                  {branding.status}
                </span>
              </div>
              <PartnerBrandingForm
                endpoint="/api/platform/partner-branding"
                initialBranding={branding}
                partnerCompanyId={partner.id}
                showReviewActions
              />
            </article>
          );
        })}

        {partners.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-10 text-center">
            <p className="text-lg font-black text-slate-950">
              No partner companies yet.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Create or approve a partner before configuring white-label
              branding.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
