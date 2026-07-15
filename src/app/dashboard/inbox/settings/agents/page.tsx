import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listInboxAgentProfiles } from "@/server/services/inbox-agent.service";
import { listInboxSkills } from "@/server/services/inbox-skill.service";
import AgentProfileTable from "./agent-profile-table";

export default async function InboxAgentsSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const [agents, skills] = await Promise.all([
    listInboxAgentProfiles(companyId),
    listInboxSkills(companyId),
  ]);

  return <AgentProfileTable agents={agents} skills={skills} />;
}
