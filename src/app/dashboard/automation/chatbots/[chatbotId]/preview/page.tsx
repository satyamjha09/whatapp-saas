import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getChatbotBuilder } from "@/server/services/chatbot.service";
import ChatbotPreviewClient from "./chatbot-preview-client";

type ChatbotPreviewPageProps = {
  params: Promise<{
    chatbotId: string;
  }>;
};

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fallbackMessage(metadata: unknown) {
  const record = jsonRecord(metadata);
  return typeof record.fallbackMessage === "string" && record.fallbackMessage
    ? record.fallbackMessage
    : "Please choose one of the available options.";
}

export default async function ChatbotPreviewPage({
  params,
}: ChatbotPreviewPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const { chatbotId } = await params;
  const chatbot = await getChatbotBuilder({
    chatbotId,
    companyId: context.membership.companyId,
  });

  if (!chatbot) notFound();

  const version = chatbot.draftVersion;

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Chatbot Preview"
        description={chatbot.name}
        actions={
          <Link
            className={actionButtonClass("secondary")}
            href={`/dashboard/automation/chatbots/${chatbot.id}/builder`}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Builder
          </Link>
        }
      />

      {!version ? (
        <Panel>No chatbot version found.</Panel>
      ) : (
        <ChatbotPreviewClient
          chatbotName={chatbot.name}
          edges={version.edges.map((edge) => ({
            id: edge.id,
            label: edge.label,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
          }))}
          fallbackMessage={fallbackMessage(chatbot.metadata)}
          nodes={version.nodes.map((node) => ({
            config: node.config,
            id: node.id,
            name: node.name,
            nodeKey: node.nodeKey,
            type: node.type,
          }))}
        />
      )}
    </div>
  );
}
