import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import OnboardingForm from "./onboarding-form";

export default async function OnboardingPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (context.membership) {
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
