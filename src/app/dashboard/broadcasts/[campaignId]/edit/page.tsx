import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
} from "@/app/dashboard/dashboard-ui";
import { BroadcastCollaborationPanel } from "@/app/dashboard/broadcasts/_components/broadcast-collaboration-panel";
import { BroadcastWizard } from "@/app/dashboard/broadcasts/_components/broadcast-wizard";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

type EditBroadcastDraftPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

function formatMoneyPaise(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value / 100);
}

function toDraftData(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getCollaboration(draftData: Record<string, unknown>) {
  const collaboration = draftData.collaboration;

  return collaboration &&
    typeof collaboration === "object" &&
    !Array.isArray(collaboration)
    ? (collaboration as Record<string, unknown>)
    : null;
}

export default async function EditBroadcastDraftPage({
  params,
}: EditBroadcastDraftPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { campaignId } = await params;
  const companyId = context.membership.companyId;

  const [
    draft,
    connectedWhatsAppAccounts,
    approvedTemplates,
    contacts,
    wallet,
  ] = await Promise.all([
    prisma.broadcastCampaignDraft.findFirst({
      where: {
        companyId,
        id: campaignId,
      },
    }),
    prisma.whatsAppAccount.count({
      where: {
        companyId,
        status: "CONNECTED",
      },
    }),
    prisma.template.count({
      where: {
        companyId,
        status: "APPROVED",
      },
    }),
    prisma.contact.count({
      where: {
        companyId,
      },
    }),
    prisma.wallet.findUnique({
      where: { companyId },
      select: { balancePaise: true },
    }),
  ]);

  if (!draft) notFound();

  const draftData = toDraftData(draft.draftData);
  const canReview =
    context.membership.role === "OWNER" ||
    context.membership.role === "ADMIN";

  const readiness = [
    {
      complete: connectedWhatsAppAccounts > 0,
      label: "WhatsApp",
      value:
        connectedWhatsAppAccounts > 0
          ? `${connectedWhatsAppAccounts} connected`
          : "Needed",
    },
    {
      complete: approvedTemplates > 0,
      label: "Templates",
      value:
        approvedTemplates > 0 ? `${approvedTemplates} approved` : "Needed",
    },
    {
      complete: contacts > 0,
      label: "Contacts",
      value: contacts > 0 ? `${contacts} contacts` : "Needed",
    },
    {
      complete: (wallet?.balancePaise ?? 0) > 0,
      label: "Wallet",
      value: formatMoneyPaise(wallet?.balancePaise ?? 0),
    },
  ];

  return (
    <div>
      <PageHeader
        actions={
          <Link href="/dashboard/broadcasts" className={actionButtonClass("secondary")}>
            Back to broadcasts
          </Link>
        }
        description="Continue the saved six-step campaign draft, collaborate with reviewers, and launch only after dry-run checks pass."
        eyebrow={context.membership.company.name}
        title={draft.name}
      />

      <BroadcastCollaborationPanel
        canReview={canReview}
        collaboration={getCollaboration(draftData)}
        draftId={draft.id}
        status={draft.status}
      />

      <BroadcastWizard
        initialDraft={{
          currentStep: draft.currentStep,
          draftData,
          id: draft.id,
          name: draft.name,
          objective: draft.objective,
          updatedAt: draft.updatedAt.toISOString(),
        }}
        readiness={readiness}
      />
    </div>
  );
}
