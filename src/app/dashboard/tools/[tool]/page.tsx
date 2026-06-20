import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

const tools: Record<string, string> = {
  "clone-items": "Clone Items",
  "whatsapp-chat-link": "WhatsApp Chat Link",
  "whatsapp-widget": "WhatsApp Widget",
};

export default async function ToolPlaceholderPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const title = tools[tool];

  if (!title) notFound();

  return <ComingSoonPage title={title} />;
}
