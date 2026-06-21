"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateStatus } from "@/generated/prisma/enums";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

type Template = {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: TemplateStatus;
  body: string;
  variables: string[];
};

type CreateTemplateResponse = {
  message: string;
  template?: Template;
  errors?: {
    name?: string[];
    language?: string[];
    category?: string[];
    body?: string[];
  };
};

export default function TemplateForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [category, setCategory] = useState<
    "MARKETING" | "UTILITY" | "AUTHENTICATION"
  >("UTILITY");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          language,
          category,
          body,
        }),
      });

      const data: CreateTemplateResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.name?.[0] ??
          data.errors?.language?.[0] ??
          data.errors?.category?.[0] ??
          data.errors?.body?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setName("");
      setLanguage("en_US");
      setCategory("UTILITY");
      setBody("");

      router.refresh();
    } catch {
      setError("Unable to create template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel>
      <PanelTitle
        title="Create template"
        description={`Create a reusable WhatsApp template. Use variables like {{1}} and {{2}} inside the message body.`}
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="name" className={labelClass}>
            Template name
          </label>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="order_update"
            required
            className={fieldClass}
          />

          <p className={helperTextClass}>
            Use lowercase letters, numbers, and underscores only.
          </p>
        </div>

        <div>
          <label htmlFor="language" className={labelClass}>
            Language
          </label>

          <input
            id="language"
            type="text"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="en_US"
            required
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>

          <select
            id="category"
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value as
                  | "MARKETING"
                  | "UTILITY"
                  | "AUTHENTICATION",
              )
            }
            className={fieldClass}
          >
            <option value="UTILITY">UTILITY</option>
            <option value="MARKETING">MARKETING</option>
            <option value="AUTHENTICATION">AUTHENTICATION</option>
          </select>
        </div>

        <div>
          <label htmlFor="body" className={labelClass}>
            Message body
          </label>

          <textarea
            id="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Hello {{1}}, your order {{2}} has been shipped."
            required
            rows={5}
            className={fieldClass}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={actionButtonClass()}
        >
          {isSubmitting ? "Creating..." : "Create Template"}
        </button>
      </form>
    </Panel>
  );
}
