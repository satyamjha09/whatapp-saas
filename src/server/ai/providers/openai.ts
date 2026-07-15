import type {
  AiGenerateInput,
  AiGenerateResult,
  AiProvider,
  AiTranslateInput,
  AiTranslateResult,
} from "@/server/ai/provider";

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export class OpenAiProvider implements AiProvider {
  private readonly apiKey?: string;
  private readonly defaultModel: string;

  constructor({
    apiKey,
    defaultModel,
  }: {
    apiKey?: string;
    defaultModel: string;
  }) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async generateText(input: AiGenerateInput): Promise<AiGenerateResult> {
    if (!this.apiKey) {
      throw new Error("AI_API_KEY is required when AI_PROVIDER=openai");
    }

    const model = input.model || this.defaultModel;
    const startedAt = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 700,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${body.slice(0, 240)}`);
    }

    const data = (await response.json()) as OpenAiChatResponse;
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      text,
      provider: "openai",
      model,
      latencyMs: Date.now() - startedAt,
      tokenUsage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  }

  async translate(input: AiTranslateInput): Promise<AiTranslateResult> {
    const result = await this.generateText({
      model: input.model || process.env.AI_TRANSLATION_MODEL || this.defaultModel,
      systemPrompt:
        "Translate the message accurately for a WhatsApp support agent. Preserve names, numbers, order IDs, URLs, and placeholders. Return only the translated text.",
      userPrompt: `Target language: ${input.targetLanguage}\nSource language: ${
        input.sourceLanguage || "auto-detect"
      }\n\nMessage:\n${input.text}`,
      temperature: 0,
      maxTokens: 700,
    });

    return {
      ...result,
      targetLanguage: input.targetLanguage,
      sourceLanguage: input.sourceLanguage,
    };
  }
}
