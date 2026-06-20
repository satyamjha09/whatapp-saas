import { notFound } from "next/navigation";
import ComingSoonPage from "@/app/dashboard/_components/coming-soon-page";

const contactSections: Record<string, string> = {
  settings: "Contact Settings",
  blocked: "Blocked Contacts",
  addresses: "Contact Addresses",
};

export default async function ContactPlaceholderPage({
  params,
}: {
  params: Promise<{ contactSection: string }>;
}) {
  const { contactSection } = await params;
  const title = contactSections[contactSection];

  if (!title) notFound();

  return <ComingSoonPage title={title} />;
}
