import { redirect } from "next/navigation";

type BroadcastDetailPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function BroadcastDetailPage({
  params,
}: BroadcastDetailPageProps) {
  const { campaignId } = await params;
  redirect(`/dashboard/campaigns/${campaignId}`);
}
