import { createHash } from "crypto";
import { MockAiProvider } from "@/server/ai/providers/mock";
import { OpenAiProvider } from "@/server/ai/providers/openai";

export type AiTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AiGenerateInput = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type AiGenerateResult = {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  tokenUsage?: AiTokenUsage;
};

export type AiTranslateInput = {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  model?: string;
};

export type AiTranslateResult = AiGenerateResult & {
  sourceLanguage?: string;
  targetLanguage: string;
};

export interface AiProvider {
  generateText(input: AiGenerateInput): Promise<AiGenerateResult>;
  translate(input: AiTranslateInput): Promise<AiTranslateResult>;
}

export function hashAiInput(input: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export function getConfiguredAiProvider(): AiProvider {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();

  if (provider === "openai") {
    return new OpenAiProvider({
      apiKey: process.env.AI_API_KEY,
      defaultModel: process.env.AI_MODEL || "gpt-4o-mini",
    });
  }

  return new MockAiProvider();
}
