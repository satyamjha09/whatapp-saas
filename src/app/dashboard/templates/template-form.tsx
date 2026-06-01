"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Template = {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAUSED";
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
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Create Template</h2>

      <p className="mt-2 text-sm text-gray-600">
        Create a reusable WhatsApp template. Use variables like {"{{1}}"} and{" "}
        {"{{2}}"} inside the message body.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Template name
          </label>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="order_update"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />

          <p className="mt-1 text-xs text-gray-500">
            Use lowercase letters, numbers, and underscores only.
          </p>
        </div>

        <div>
          <label
            htmlFor="language"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Language
          </label>

          <input
            id="language"
            type="text"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="en_US"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="category"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
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
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          >
            <option value="UTILITY">UTILITY</option>
            <option value="MARKETING">MARKETING</option>
            <option value="AUTHENTICATION">AUTHENTICATION</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="body"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Message body
          </label>

          <textarea
            id="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Hello {{1}}, your order {{2}} has been shipped."
            required
            rows={5}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-black"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Template"}
        </button>
      </form>
    </div>
  );
}
