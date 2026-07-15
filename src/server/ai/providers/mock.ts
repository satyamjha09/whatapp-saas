import type {
  AiGenerateInput,
  AiGenerateResult,
  AiProvider,
  AiTranslateInput,
  AiTranslateResult,
} from "@/server/ai/provider";

function truncate(text: string, length = 900) {
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

export class MockAiProvider implements AiProvider {
  async generateText(input: AiGenerateInput): Promise<AiGenerateResult> {
    const startedAt = Date.now();
    const prompt = input.userPrompt.toLowerCase();
    const text = prompt.includes("reply suggestion")
      ? "Thanks for sharing the details. I am checking this for you and will update you shortly."
      : `Summary: ${truncate(input.userPrompt.replace(/\s+/g, " "), 650)}`;

    return {
      text,
      provider: "mock",
      model: input.model || "mock-inbox-assistant",
      latencyMs: Date.now() - startedAt,
      tokenUsage: {
        totalTokens: Math.ceil((input.systemPrompt.length + input.userPrompt.length) / 4),
      },
    };
  }

  async translate(input: AiTranslateInput): Promise<AiTranslateResult> {
    const startedAt = Date.now();

    return {
      text: `[${input.targetLanguage}] ${input.text}`,
      provider: "mock",
      model: input.model || "mock-translation",
      latencyMs: Date.now() - startedAt,
      targetLanguage: input.targetLanguage,
      sourceLanguage: input.sourceLanguage,
      tokenUsage: {
        totalTokens: Math.ceil(input.text.length / 4),
      },
    };
  }
}
