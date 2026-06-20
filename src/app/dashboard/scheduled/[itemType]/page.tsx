import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

const scheduledItems: Record<string, string> = {
  "single-messages": "Scheduled Single Messages",
  campaigns: "Scheduled Campaigns",
  chatbots: "Scheduled Chatbots",
};

export default async function ScheduledPlaceholderPage({
  params,
}: {
  params: Promise<{ itemType: string }>;
}) {
  const { itemType } = await params;
  const title = scheduledItems[itemType];

  if (!title) notFound();

  return (
    <ComingSoonPage
      title={title}
      description="Review and manage work scheduled for future execution."
    />
  );
}
