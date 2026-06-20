import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

export default async function TemplatePlaceholderPage({
  params,
}: {
  params: Promise<{ templateSection: string }>;
}) {
  const { templateSection } = await params;

  if (templateSection !== "match-logs") notFound();

  return <ComingSoonPage title="Template Match Logs" />;
}
