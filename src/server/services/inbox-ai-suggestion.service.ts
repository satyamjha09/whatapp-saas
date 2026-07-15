import { prisma } from "@/lib/prisma";
import { getConfiguredAiProvider, hashAiInput } from "@/server/ai/provider";
import {
  assertInboxAiRateLimit,
  buildInboxAiConversationContext,
} from "@/server/services/inbox-ai-context.service";

export const INBOX_AI_REPLY_TONES = [
  "Professional",
  "Friendly",
  "Concise",
  "Apologetic",
  "Sales-focused",
  "Support-focused",
] as const;

export type InboxAiReplyTone = (typeof INBOX_AI_REPLY_TONES)[number];

const SUGGESTION_PROMPT_VERSION = "inbox-reply-suggestion-v1";

export function normalizeInboxAiTone(value: unknown): InboxAiReplyTone {
  const tone = String(value || "Professional");
  return INBOX_AI_REPLY_TONES.includes(tone as InboxAiReplyTone)
    ? (tone as InboxAiReplyTone)
    : "Professional";
}

export async function getRecentInboxAiSuggestions({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  return prisma.inboxAiSuggestion.findMany({
    where: { companyId, contactId },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
}

export async function generateInboxAiSuggestion({
  companyId,
  contactId,
  userId,
  tone,
}: {
  companyId: string;
  contactId: string;
  userId?: string;
  tone: InboxAiReplyTone;
}) {
  await assertInboxAiRateLimit({ companyId, userId });

  const context = await buildInboxAiConversationContext({ companyId, contactId });
  const provider = getConfiguredAiProvider();
  const model = process.env.AI_MODEL || "mock-inbox-assistant";
  const promptInput = {
    context,
    tone,
  };
  const inputHash = hashAiInput(promptInput);

  const systemPrompt =
    "You write WhatsApp reply suggestions for a human agent. Never send messages. Return only one ready-to-edit reply. Keep it factual, respectful, and under 900 characters. Do not promise refunds, discounts, legal outcomes, or delivery dates unless the context explicitly says so.";
  const userPrompt = `Create a ${tone} reply suggestion from this sanitized tenant-scoped context:\n${JSON.stringify(
    context,
    null,
    2,
  )}`;

  try {
    const result = await provider.generateText({
      model,
      systemPrompt,
      userPrompt,
      temperature: tone === "Concise" ? 0.1 : 0.3,
      maxTokens: 350,
    });

    return prisma.inboxAiSuggestion.create({
      data: {
        companyId,
        contactId,
        requestedByUserId: userId,
        tone,
        provider: result.provider,
        model: result.model,
        promptVersion: SUGGESTION_PROMPT_VERSION,
        inputHash,
        result: result.text,
        latencyMs: result.latencyMs,
        promptTokens: result.tokenUsage?.promptTokens,
        completionTokens: result.tokenUsage?.completionTokens,
        totalTokens: result.tokenUsage?.totalTokens,
        status: "COMPLETED",
      },
    });
  } catch (error) {
    return prisma.inboxAiSuggestion.create({
      data: {
        companyId,
        contactId,
        requestedByUserId: userId,
        tone,
        provider: process.env.AI_PROVIDER || "mock",
        model,
        promptVersion: SUGGESTION_PROMPT_VERSION,
        inputHash,
        result: "",
        status: "FAILED",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "AI suggestion failed",
      },
    });
  }
}
