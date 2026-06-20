import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

const reports: Record<string, { title: string; description: string }> = {
  messages: {
    title: "Message Reports",
    description: "Analyze outbound, inbound, delivery, and read activity.",
  },
  campaigns: {
    title: "Campaign Reports",
    description: "Review campaign delivery and audience performance.",
  },
  calling: {
    title: "Calling Reports",
    description: "Track calling activity and outcomes when calling is enabled.",
  },
  chatbots: {
    title: "Chatbot Executions",
    description: "Inspect automation runs and chatbot outcomes.",
  },
  "catalog-orders": {
    title: "Catalog Orders",
    description: "Review orders received through WhatsApp catalogs.",
  },
  "payment-transactions": {
    title: "Payment Transactions",
    description: "Monitor WhatsApp payment activity and reconciliation.",
  },
};

export default async function ReportPlaceholderPage({
  params,
}: {
  params: Promise<{ reportType: string }>;
}) {
  const { reportType } = await params;
  const report = reports[reportType];

  if (!report) notFound();

  return <ComingSoonPage {...report} />;
}
