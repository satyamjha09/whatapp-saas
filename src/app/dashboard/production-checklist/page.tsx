import { CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getProductionChecklistByCompany,
  getProductionChecklistSettingsByCompany,
} from "@/server/services/production-checklist.service";
import ProductionConfirmationsForm from "./production-confirmations-form";
import ProductionChecklistCard from "./production-checklist-card";

export default async function ProductionChecklistPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const [checklist, settings] = await Promise.all([
    getProductionChecklistByCompany(context.membership.companyId),
    getProductionChecklistSettingsByCompany(context.membership.companyId),
  ]);
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const requiredPercent = checklist.summary.requiredItems
    ? Math.round(
        (checklist.summary.completedRequiredItems /
          checklist.summary.requiredItems) *
          100,
      )
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Production Checklist"
        description="Track the workspace requirements that must be completed before serving real customers."
        actions={
          <>
            <Link
              href="/dashboard/whatsapp"
              className={actionButtonClass("secondary")}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              WhatsApp Settings
            </Link>
            <Link href="/dashboard/inbox" className={actionButtonClass()}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Open Inbox
            </Link>
          </>
        }
      />

      <section className="mb-5 overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#081B3A]">
                Required readiness
              </h2>
              <p className="mt-1 text-sm text-[#526173]">
                {checklist.summary.completedRequiredItems} of{" "}
                {checklist.summary.requiredItems} required items complete
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[#081B3A]">
              {requiredPercent}%
            </p>
            <p className="text-xs text-[#526173]">
              {checklist.summary.completedItems} of {checklist.summary.totalItems}{" "}
              overall
            </p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#BFE9D0]/65">
          <div
            className="h-full rounded-full bg-[#128C7E] transition-[width] duration-500"
            style={{ width: `${requiredPercent}%` }}
          />
        </div>

        <p
          className={`mt-4 rounded-xl border p-3 text-sm ${
            checklist.summary.isProductionReady
              ? "border-[#22C55E]/25 bg-[#22C55E]/10 text-[#15803d]"
              : "border-[#F8C830]/35 bg-[#F8C830]/12 text-[#755b00]"
          }`}
        >
          {checklist.summary.isProductionReady
            ? "All required checks are complete. This workspace can move to final production preparation."
            : "Complete every required item before launching with real customers."}
        </p>
      </section>

      <section
        id="manual-confirmations"
        className="mb-5 scroll-mt-24 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6"
      >
        <h2 className="text-lg font-bold text-[#081B3A]">
          Manual Production Confirmations
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#526173]">
          Record requirements confirmed in Meta Business Manager that cannot be
          detected automatically.
        </p>
        <div className="mt-5">
          <ProductionConfirmationsForm
            settings={settings}
            canManage={canManage}
          />
        </div>
      </section>

      <div className="space-y-5">
        {checklist.groups.map((group) => (
          <section key={group.title}>
            <div className="mb-3">
              <h2 className="text-base font-bold text-[#081B3A]">
                {group.title}
              </h2>
              <p className="mt-1 text-xs text-[#526173]">
                {group.description}
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <ProductionChecklistCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
