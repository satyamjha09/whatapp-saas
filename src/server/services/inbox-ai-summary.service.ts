import { prisma } from "@/lib/prisma";
import { getConfiguredAiProvider } from "@/server/ai/provider";
import {
  assertInboxAiRateLimit,
  buildInboxAiConversationContext,
} from "@/server/services/inbox-ai-context.service";

const SUMMARY_PROMPT_VERSION = "inbox-summary-v1";

export async function getLatestInboxConversationSummary({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  return prisma.inboxConversationSummary.findFirst({
    where: { companyId, contactId },
    orderBy: { createdAt: "desc" },
  });
}

export async function generateInboxConversationSummary({
  companyId,
  contactId,
  userId,
}: {
  companyId: string;
  contactId: string;
  userId?: string;
}) {
  await assertInboxAiRateLimit({ companyId, userId });

  const context = await buildInboxAiConversationContext({ companyId, contactId });
  const provider = getConfiguredAiProvider();
  const model = process.env.AI_SUMMARY_MODEL || process.env.AI_MODEL || "mock-inbox-assistant";

  const systemPrompt =
    "You are an inbox copilot for a WhatsApp SaaS. Summarize the customer conversation for a human support/sales agent. Never invent facts. Mention unresolved questions, sentiment, risk, next best action, and relevant order/Tally context when present. Do not include secrets or internal notes.";
  const userPrompt = `Create a concise conversation summary from this sanitized tenant-scoped context:\n${JSON.stringify(
    context,
    null,
    2,
  )}`;

  try {
    const result = await provider.generateText({
      model,
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 700,
    });

    return prisma.inboxConversationSummary.create({
      data: {
        companyId,
        contactId,
        provider: result.provider,
        model: result.model,
        promptVersion: SUMMARY_PROMPT_VERSION,
        inputHash: context.inputHash,
        result: result.text,
        latencyMs: result.latencyMs,
        promptTokens: result.tokenUsage?.promptTokens,
        completionTokens: result.tokenUsage?.completionTokens,
        totalTokens: result.tokenUsage?.totalTokens,
        status: "COMPLETED",
      },
    });
  } catch (error) {
    return prisma.inboxConversationSummary.create({
      data: {
        companyId,
        contactId,
        provider: process.env.AI_PROVIDER || "mock",
        model,
        promptVersion: SUMMARY_PROMPT_VERSION,
        inputHash: context.inputHash,
        result: "",
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message.slice(0, 500) : "AI summary failed",
      },
    });
  }
}
