import { PartnerCustomDomainsPanel } from "@/components/partner-custom-domains-panel";
import { listPartnerDomainRecords } from "@/server/services/partner-custom-domain.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function statusTone(status?: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING_APPROVAL" || status === "DNS_VERIFIED") {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "REJECTED" || status === "DISABLED") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

export default async function PlatformDomainsPage() {
  await requirePlatformPermission("PLATFORM_DOMAIN_APPROVE");
  const partners = await listPartnerDomainRecords();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-slate-500">Platform Admin</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">
          Partner Custom Domains
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Review partner domain requests, verify DNS ownership, monitor SSL and
          host health, then approve only the domains that are ready for
          white-label production traffic.
        </p>
      </div>

      <section className="mt-6 space-y-6">
        {partners.map((partner) => {
          const domainCount = partner.partnerCustomDomains.length;
          const highestStatus =
            partner.partnerCustomDomains.find(
              (domain) => domain.status === "PENDING_APPROVAL",
            )?.status ??
            partner.partnerCustomDomains.find(
              (domain) => domain.status === "APPROVED",
            )?.status ??
            "NO_DOMAINS";

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
                    {partner.childCompanies.length} client workspaces.{" "}
                    {domainCount} custom domain requests.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(
                    highestStatus,
                  )}`}
                >
                  {highestStatus}
                </span>
              </div>
              <PartnerCustomDomainsPanel
                endpoint="/api/platform/partner-domains"
                initialDomains={serialize(partner.partnerCustomDomains)}
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
              Create a partner before reviewing white-label domain requests.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
