import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listInboxSkills } from "@/server/services/inbox-skill.service";
import SkillManagement from "./skill-management";

export default async function InboxSkillsSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const skills = await listInboxSkills(context.membership.companyId);

  return <SkillManagement skills={skills} />;
}
