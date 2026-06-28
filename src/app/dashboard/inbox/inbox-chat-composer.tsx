"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type InboxChatComposerProps = {
  contactId: string;
  customerServiceWindowEndsAt: string | null;
};

type InboxReplyResponse = {
  message: string;
  errors?: {
    body?: string[];
  };
};

export default function InboxChatComposer({
  contactId,
  customerServiceWindowEndsAt,
}: InboxChatComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const windowIsOpen = customerServiceWindowEndsAt
    ? new Date(customerServiceWindowEndsAt) > new Date()
    : false;

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/inbox/${contactId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as InboxReplyResponse;

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
      <>
        <div className="shrink-0 border-t border-[#E8DDB7] bg-[#FFF9E6] px-4 py-3 text-sm text-black">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F7A800] text-xs font-bold text-white">
            !
          </span>
          The 24-hour customer service window has expired. You can only send template messages now.
        </div>

        <div className="flex h-18 shrink-0 items-center gap-4 border-t border-[#E6E6E6] bg-white px-4 py-3">
          <button
            type="button"
            disabled
            className="grid h-10 w-10 place-items-center rounded-full text-[#A0A0A0]"
            aria-label="Add attachment"
          >
            <Plus className="h-5 w-5" />
          </button>
          <input
            disabled
            placeholder="Type a message... (Ctrl + Enter to send)"
            className="h-12 min-w-0 flex-1 rounded-md border-0 px-2 text-sm outline-none placeholder:text-[#B6B6B6]"
          />
          <button
            type="button"
            disabled
            className="grid h-11 w-11 place-items-center rounded-full bg-[#1677FF]/60 text-white"
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={sendReply} className="shrink-0 border-t border-[#E6E6E6] bg-white">
      <div className="flex h-18 items-center gap-4 px-4 py-3">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full text-black hover:bg-[#F4F4F4]"
          aria-label="Add attachment"
        >
          <Plus className="h-5 w-5" />
        </button>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Type a message... (Ctrl + Enter to send)"
          maxLength={4096}
          className="h-12 min-w-0 flex-1 rounded-md border-0 px-2 text-sm outline-none placeholder:text-[#B6B6B6]"
        />
        <button
          type="submit"
          disabled={isSending || body.trim().length === 0}
          className="grid h-11 w-11 place-items-center rounded-full bg-[#1677FF] text-white disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Send"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <p className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <p className="px-4 pb-2 text-right text-xs text-[#777]">
        Reply window ends {new Date(customerServiceWindowEndsAt!).toLocaleString()}
      </p>
    </form>
  );
}
