import { redirect } from "next/navigation";
import { Panel, PanelTitle } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getInboxCsatSettings } from "@/server/services/inbox-csat.service";
import { InboxCsatSettingsForm } from "./csat-settings-form";

export default async function InboxCsatSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const settings = await getInboxCsatSettings(context.membership.companyId);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Panel>
        <PanelTitle
          title="Customer Satisfaction"
          description="Automatically ask customers for a 1-5 support rating after conversations close. Low scores notify supervisors for quick recovery."
        />
        <InboxCsatSettingsForm initialSettings={settings} />
      </Panel>

      <section className="rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#128C7E]">
          How it works
        </p>
        <h2 className="mt-2 text-xl font-black text-[#081B3A]">
          One survey per close cycle
        </h2>
        <div className="mt-5 space-y-4 text-sm leading-6 text-[#526173]">
          <p>
            When an agent closes a conversation, MetaWhat creates a unique survey
            tied to that close event.
          </p>
          <p>
            Replies from 1 to 5 are captured before chatbot or routing logic, so
            rating messages do not reopen or reroute the thread.
          </p>
          <p>
            Agent and queue CSAT analytics are rebuilt by the inbox analytics
            worker.
          </p>
        </div>
      </section>
    </div>
  );
}
