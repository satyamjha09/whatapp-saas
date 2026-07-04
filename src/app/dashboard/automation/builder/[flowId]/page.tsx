import { redirect } from "next/navigation";

type AutomationFlowBuilderRedirectPageProps = {
  params: Promise<{
    flowId: string;
  }>;
};

export default async function AutomationFlowBuilderRedirectPage({
  params,
}: AutomationFlowBuilderRedirectPageProps) {
  const { flowId } = await params;

  redirect(`/automation/builder/${flowId}`);
}
