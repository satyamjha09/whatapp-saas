"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type QuickReplyResponse = {
  message: string;
  errors?: {
    title?: string[];
    body?: string[];
  };
};

export default function QuickReplyForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createQuickReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inbox/quick-replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
        }),
      });

      const data: QuickReplyResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.title?.[0] ?? data.errors?.body?.[0] ?? data.message;

        setError(firstError);
        return;
      }

      setTitle("");
      setBody("");
      router.refresh();
    } catch {
      setError("Unable to create quick reply. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Create Reply</h2>

      <form onSubmit={createQuickReply} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="quick-reply-title"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Title
          </label>

          <input
            id="quick-reply-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={80}
            placeholder="Pricing follow-up"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="quick-reply-body"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Reply Body
          </label>

          <textarea
            id="quick-reply-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={7}
            maxLength={4096}
            placeholder="Thanks for reaching out. Here are the pricing details..."
            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
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
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Quick Reply"}
        </button>
      </form>
    </section>
  );
}
