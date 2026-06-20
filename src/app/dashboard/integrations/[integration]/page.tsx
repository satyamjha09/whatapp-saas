import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

const integrations: Record<string, string> = {
  openai: "ChatGPT / OpenAI",
  "google-sheets": "Google Sheets",
};

export default async function IntegrationPlaceholderPage({
  params,
}: {
  params: Promise<{ integration: string }>;
}) {
  const { integration } = await params;
  const title = integrations[integration];

  if (!title) notFound();

  return <ComingSoonPage title={title} />;
}
