import { prisma } from "@/lib/prisma";
import { getConfiguredAiProvider, hashAiInput } from "@/server/ai/provider";
import { assertInboxAiRateLimit } from "@/server/services/inbox-ai-context.service";

const TRANSLATION_PROMPT_VERSION = "inbox-message-translation-v1";

function normalizeLanguage(value: unknown) {
  const language = String(value || "").trim();

  if (!/^[a-zA-Z][a-zA-Z0-9 -]{1,40}$/.test(language)) {
    throw new Error("Enter a valid target language");
  }

  return language;
}

export async function translateInboxMessage({
  companyId,
  messageId,
  targetLanguage,
  sourceLanguage,
  userId,
}: {
  companyId: string;
  messageId: string;
  targetLanguage: string;
  sourceLanguage?: string;
  userId?: string;
}) {
  const normalizedTargetLanguage = normalizeLanguage(targetLanguage);
  await assertInboxAiRateLimit({ companyId, userId });

  const existing = await prisma.inboxMessageTranslation.findUnique({
    where: {
      companyId_messageId_targetLanguage: {
        companyId,
        messageId,
        targetLanguage: normalizedTargetLanguage,
      },
    },
  });

  if (existing?.status === "COMPLETED") {
    return existing;
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, companyId },
    select: {
      id: true,
      body: true,
      contactId: true,
    },
  });

  if (!message) {
    throw new Error("Message not found");
  }

  const provider = getConfiguredAiProvider();
  const model =
    process.env.AI_TRANSLATION_MODEL ||
    process.env.AI_MODEL ||
    "mock-translation";
  const inputHash = hashAiInput({
    messageId,
    body: message.body,
    sourceLanguage,
    targetLanguage: normalizedTargetLanguage,
    promptVersion: TRANSLATION_PROMPT_VERSION,
  });

  try {
    const result = await provider.translate({
      text: message.body,
      sourceLanguage,
      targetLanguage: normalizedTargetLanguage,
      model,
    });

    return prisma.inboxMessageTranslation.upsert({
      where: {
        companyId_messageId_targetLanguage: {
          companyId,
          messageId,
          targetLanguage: normalizedTargetLanguage,
        },
      },
      create: {
        companyId,
        messageId,
        requestedByUserId: userId,
        sourceLanguage,
        targetLanguage: normalizedTargetLanguage,
        provider: result.provider,
        model: result.model,
        promptVersion: TRANSLATION_PROMPT_VERSION,
        inputHash,
        originalText: message.body,
        translatedText: result.text,
        latencyMs: result.latencyMs,
        promptTokens: result.tokenUsage?.promptTokens,
        completionTokens: result.tokenUsage?.completionTokens,
        totalTokens: result.tokenUsage?.totalTokens,
        status: "COMPLETED",
      },
      update: {
        requestedByUserId: userId,
        sourceLanguage,
        provider: result.provider,
        model: result.model,
        promptVersion: TRANSLATION_PROMPT_VERSION,
        inputHash,
        originalText: message.body,
        translatedText: result.text,
        latencyMs: result.latencyMs,
        promptTokens: result.tokenUsage?.promptTokens,
        completionTokens: result.tokenUsage?.completionTokens,
        totalTokens: result.tokenUsage?.totalTokens,
        status: "COMPLETED",
        errorMessage: null,
      },
    });
  } catch (error) {
    return prisma.inboxMessageTranslation.upsert({
      where: {
        companyId_messageId_targetLanguage: {
          companyId,
          messageId,
          targetLanguage: normalizedTargetLanguage,
        },
      },
      create: {
        companyId,
        messageId,
        requestedByUserId: userId,
        sourceLanguage,
        targetLanguage: normalizedTargetLanguage,
        provider: process.env.AI_PROVIDER || "mock",
        model,
        promptVersion: TRANSLATION_PROMPT_VERSION,
        inputHash,
        originalText: message.body,
        translatedText: "",
        status: "FAILED",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Message translation failed",
      },
      update: {
        requestedByUserId: userId,
        sourceLanguage,
        provider: process.env.AI_PROVIDER || "mock",
        model,
        promptVersion: TRANSLATION_PROMPT_VERSION,
        inputHash,
        originalText: message.body,
        translatedText: "",
        status: "FAILED",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Message translation failed",
      },
    });
  }
}
