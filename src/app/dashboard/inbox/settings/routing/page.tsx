import { redirect } from "next/navigation";
import { listInboxQueues } from "@/server/services/inbox-queue.service";
import { listInboxRoutingRules } from "@/server/services/inbox-routing-rule.service";
import { listInboxSkills } from "@/server/services/inbox-skill.service";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import RoutingRuleBuilder from "./routing-rule-builder";
import RoutingRuleCard from "./routing-rule-card";

export default async function InboxRoutingSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const [rules, queues, skills] = await Promise.all([
    listInboxRoutingRules(companyId),
    listInboxQueues(companyId),
    listInboxSkills(companyId),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
      <RoutingRuleBuilder queues={queues} skills={skills} />
      <section className="space-y-4">
        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#BFE9D0] bg-white/80 p-8 text-center">
            <h2 className="text-xl font-black text-[#081B3A]">
              No routing rules yet
            </h2>
            <p className="mt-2 text-sm text-[#526173]">
              Route new customer replies to Sales, Support, Billing, or a handoff
              queue based on message text, tags, city, source, or lead stage.
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <RoutingRuleCard key={rule.id} rule={rule} />
          ))
        )}
      </section>
    </div>
  );
}
