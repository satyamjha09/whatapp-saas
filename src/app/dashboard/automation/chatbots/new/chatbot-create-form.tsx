"use client";

import { useActionState } from "react";
import { Bot, Sparkles } from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
} from "@/app/dashboard/dashboard-ui";
import {
  createChatbotAction,
  type ChatbotActionState,
} from "../actions";

const initialState: ChatbotActionState = {};

function fieldError(
  state: ChatbotActionState,
  field: "description" | "keywords" | "name",
) {
  return state.errors?.[field]?.[0] ?? null;
}

export default function ChatbotCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createChatbotAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="chatbotName" className={labelClass}>
          Chatbot name
        </label>
        <input
          className={fieldClass}
          id="chatbotName"
          maxLength={120}
          name="name"
          placeholder="Sales qualification bot"
          required
        />
        {fieldError(state, "name") ? (
          <p className="mt-2 text-xs text-rose-700">
            {fieldError(state, "name")}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="chatbotDescription" className={labelClass}>
          Description
        </label>
        <textarea
          className={`${fieldClass} min-h-28`}
          id="chatbotDescription"
          maxLength={1024}
          name="description"
          placeholder="Qualifies new WhatsApp leads and routes agent handoff."
        />
        {fieldError(state, "description") ? (
          <p className="mt-2 text-xs text-rose-700">
            {fieldError(state, "description")}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="chatbotKeywords" className={labelClass}>
          Starter keywords
        </label>
        <input
          className={fieldClass}
          id="chatbotKeywords"
          maxLength={500}
          name="keywords"
          placeholder="hi, hello, help, price"
        />
        <p className={helperTextClass}>
          Optional comma-separated keywords. They create active foundation
          triggers for the runtime phase.
        </p>
        {fieldError(state, "keywords") ? (
          <p className="mt-2 text-xs text-rose-700">
            {fieldError(state, "keywords")}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          className={actionButtonClass()}
          disabled={isPending}
          type="submit"
        >
          <Bot className="mr-2 h-4 w-4" />
          {isPending ? "Creating..." : "Create chatbot"}
        </button>
        <span className="inline-flex items-center rounded-xl bg-[#E7F8EF] px-4 py-2.5 text-sm font-semibold text-[#128C7E]">
          <Sparkles className="mr-2 h-4 w-4" />
          Phase 1 foundation
        </span>
      </div>
    </form>
  );
}
