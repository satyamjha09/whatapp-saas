import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

const whatsappItems: Record<string, string> = {
  flows: "WhatsApp Flows",
  "payment-configurations": "Payment Configurations",
  groups: "WhatsApp Groups",
};

export default async function WhatsAppItemPlaceholderPage({
  params,
}: {
  params: Promise<{ whatsappItem: string }>;
}) {
  const { whatsappItem } = await params;
  const title = whatsappItems[whatsappItem];

  if (!title) notFound();

  return <ComingSoonPage title={title} />;
}
