import { Layers3, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  PanelTitle,
  actionButtonClass,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getContactGroupsByCompany } from "@/server/services/contact-group.service";
import ContactGroupCreateForm from "./contact-group-create-form";
import { hasCompanyFeature } from "@/server/services/feature-gate.service";
import PlanFeatureLockCard from "@/app/dashboard/_components/plan-feature-lock-card";

export default async function ContactGroupsPage() {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  if (
    !(await hasCompanyFeature(
      context.membership.companyId,
      "CONTACT_GROUPS",
    ))
  ) {
    return (
      <PlanFeatureLockCard
        title="Contact groups are locked"
        description="Upgrade this workspace to organize contacts into reusable groups for campaigns."
        requiredPlan="Starter"
      />
    );
  }

  const groups = await getContactGroupsByCompany(context.membership.companyId);
  const canManage =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";
  const memberCount = groups.reduce(
    (total, group) => total + group._count.members,
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Contact Groups"
        description="Create reusable lists for leads, customers, campaigns, and segments."
        actions={
          <Link
            href="/dashboard/contacts"
            className={actionButtonClass("secondary")}
          >
            Contacts List
          </Link>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <MetricCard
          icon={Layers3}
          label="Groups"
          value={groups.length.toLocaleString("en-IN")}
        />
        <MetricCard
          icon={Users}
          label="Memberships"
          value={memberCount.toLocaleString("en-IN")}
          detail="A contact may belong to multiple groups"
        />
      </section>

      <ContactGroupCreateForm canManage={canManage} />

      <Panel className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-[#BFE9D0] px-5 py-4 sm:px-6">
          <PanelTitle title="Groups" description="Open a group to manage its contacts." />
        </div>
        {groups.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState>No contact groups yet.</EmptyState>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3 sm:p-6">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/dashboard/contacts/groups/${group.id}`}
                className="rounded-2xl border border-[#BFE9D0] bg-white p-5 transition hover:border-[#128C7E]/30 hover:bg-[#E7F8EF]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-4 w-4 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: group.color ?? "#128C7E" }}
                  />
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-[#081B3A]">
                      {group.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[#526173]">
                      {group.description || "No description"}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[#128C7E]">
                      {group._count.members} contact(s)
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
