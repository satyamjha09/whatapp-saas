import { redirect } from "next/navigation";

type BroadcastProgressPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function BroadcastProgressPage({
  params,
}: BroadcastProgressPageProps) {
  const { campaignId } = await params;
  redirect(`/dashboard/campaigns/${campaignId}/progress`);
}
