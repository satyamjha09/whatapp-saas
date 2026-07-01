import { Inbox, LayoutTemplate, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import WhatsAppConnectionRequiredCard from "../whatsapp-connection-required-card";
import SingleTemplateMessageForm from "./single-template-message-form";

export default async function SendSingleMessagePage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const connectedWhatsAppAccount = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
      status: "CONNECTED",
      accessToken: { not: null },
      phoneNumbers: {
        some: { phoneNumberId: { not: null } },
      },
    },
    select: { id: true },
  });

  if (!connectedWhatsAppAccount) {
    return (
      <div>
        <PageHeader
          eyebrow={context.membership.company.name}
          title="Send Single Message"
          description="Connect a WhatsApp Business Account before sending one-to-one messages."
          actions={
            <Link
              href="/dashboard/whatsapp/connect"
              className={actionButtonClass()}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Connect WhatsApp
            </Link>
          }
        />

        <WhatsAppConnectionRequiredCard />
      </div>
    );
  }

  const [templates, contacts, flows] = await Promise.all([
    prisma.template.findMany({
      where: { companyId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        language: true,
        category: true,
        body: true,
        variables: true,
      },
    }),
    prisma.contact.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true,
        name: true,
        countryCode: true,
        phoneNumber: true,
      },
    }),
    prisma.whatsAppFlow.findMany({
      where: { companyId, status: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      select: {
        defaultCta: true,
        defaultScreen: true,
        description: true,
        id: true,
        name: true,
        useCase: true,
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Send Single Message"
        description="Queue an approved WhatsApp template for one customer. Delivery continues through the existing message worker."
        actions={
          <>
            <Link
              href="/dashboard/templates"
              className={actionButtonClass("secondary")}
            >
              <LayoutTemplate className="mr-2 h-4 w-4" />
              Templates
            </Link>
            <Link href="/dashboard/inbox" className={actionButtonClass()}>
              <Inbox className="mr-2 h-4 w-4" />
              Open Inbox
            </Link>
          </>
        }
      />

      <SingleTemplateMessageForm
        contacts={contacts}
        flows={flows}
        templates={templates}
      />
    </div>
  );
}
