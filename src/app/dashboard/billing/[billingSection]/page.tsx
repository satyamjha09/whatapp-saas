import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

const billingSections: Record<string, string> = {
  subscription: "Subscription Plan",
  "whatsapp-credits": "WhatsApp Credits",
  "ai-credits": "AI Credits",
  "calling-credits": "Calling Credits",
};

export default async function BillingPlaceholderPage({
  params,
}: {
  params: Promise<{ billingSection: string }>;
}) {
  const { billingSection } = await params;
  const title = billingSections[billingSection];

  if (!title) notFound();

  return <ComingSoonPage title={title} />;
}
