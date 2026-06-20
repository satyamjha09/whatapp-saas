"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";

type InboxReplyFormProps = {
  contactId: string;
  customerServiceWindowEndsAt: string | null;
};

type InboxReplyResponse = {
  message: string;
  errors?: {
    body?: string[];
  };
};

export default function InboxReplyForm({
  contactId,
  customerServiceWindowEndsAt,
}: InboxReplyFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const windowIsOpen = customerServiceWindowEndsAt
    ? new Date(customerServiceWindowEndsAt) > new Date()
    : false;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });
      const data: InboxReplyResponse = await response.json();

      if (!response.ok) {
        setError(data.errors?.body?.[0] ?? data.message);
        return;
      }

      setBody("");
      router.refresh();
    } catch {
      setError("Unable to send reply. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  if (!windowIsOpen) {
    return (
      <div className="border-t border-[#D8E6F3] bg-white p-4">
        <p className="rounded-xl border border-[#F8C830]/40 bg-[#F8C830]/15 p-3 text-sm text-[#102040]">
          The 24-hour reply window is closed. Send an approved template from
          Messages to restart the conversation.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-[#D8E6F3] bg-white p-4"
    >
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="inboxReply" className="sr-only">
            Reply to conversation
          </label>
          <textarea
            id="inboxReply"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Reply to this WhatsApp conversation..."
            rows={2}
            maxLength={4096}
            required
            className="w-full resize-none rounded-xl border border-[#D8E6F3] bg-[#F0F8FF] px-4 py-3 text-sm text-[#102040] outline-none transition placeholder:text-[#526173]/70 focus:border-[#0052CC]/40 focus:bg-white focus:ring-4 focus:ring-[#0052CC]/10"
          />
        </div>

        <button
          type="submit"
          disabled={isSending || body.trim().length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0052CC] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,82,204,0.20)] transition hover:bg-[#003F9E] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {isSending ? "Queuing..." : "Send"}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#526173]">
        <span>
          Reply window ends {new Date(customerServiceWindowEndsAt!).toLocaleString()}
        </span>
        <span>{body.length}/4096</span>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
