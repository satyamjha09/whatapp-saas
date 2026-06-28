import Link from "next/link";
import {
  Archive,
  CheckCheck,
  CircleX,
  EyeOff,
  MessageCircle,
  Plus,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getConversationByContact,
  getInboxContactsByCompany,
} from "@/server/services/inbox.service";
import InboxAutoRefresh from "./inbox-auto-refresh";
import InboxChatComposer from "./inbox-chat-composer";

type InboxPageProps = {
  searchParams: Promise<{
    contactId?: string;
    q?: string;
    filter?: string;
    page?: string;
  }>;
};

function initials(name: string | null, phoneNumber: string) {
  if (!name) return phoneNumber.slice(-1) || "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function compactDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).format(date);
}

function compactTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type InboxMediaMetadata = {
  messageType: "MEDIA";
  mediaType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
  mediaName?: string | null;
  caption?: string | null;
};

function getInboxMediaMetadata(metadata: unknown): InboxMediaMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const mediaType = String(record.mediaType);

  if (
    record.messageType !== "MEDIA" ||
    !["IMAGE", "DOCUMENT", "VIDEO", "AUDIO"].includes(mediaType)
  ) {
    return null;
  }

  return {
    messageType: "MEDIA",
    mediaType: mediaType as InboxMediaMetadata["mediaType"],
    mediaName: typeof record.mediaName === "string" ? record.mediaName : null,
    caption: typeof record.caption === "string" ? record.caption : null,
  };
}

function messagePreview(message: { body: string; metadata: unknown }) {
  const media = getInboxMediaMetadata(message.metadata);

  if (!media) return message.body;

  return `${media.mediaType[0]}${media.mediaType.slice(1).toLowerCase()}${
    media.mediaName ? `: ${media.mediaName}` : ""
  }`;
}

function MessageBubbleBody({
  message,
}: {
  message: { id: string; body: string; metadata: unknown };
}) {
  const media = getInboxMediaMetadata(message.metadata);

  if (!media) {
    return <p className="whitespace-pre-wrap">{message.body}</p>;
  }

  const caption = media.caption?.trim();

  if (media.mediaType === "IMAGE") {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/messages/${message.id}/media`}
          alt={media.mediaName ?? "Sent image"}
          className="max-h-72 w-full rounded-md object-cover"
        />
        {caption ? <p className="whitespace-pre-wrap">{caption}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <a
        href={`/api/messages/${message.id}/media`}
        target="_blank"
        rel="noreferrer"
        className="block rounded-md border border-black/10 bg-white/55 px-3 py-2 font-semibold text-[#102040]"
      >
        {media.mediaType[0]}
        {media.mediaType.slice(1).toLowerCase()} sent
        {media.mediaName ? `: ${media.mediaName}` : ""}
      </a>
      {caption ? <p className="whitespace-pre-wrap">{caption}</p> : null}
    </div>
  );
}

function contactHref(contactId: string, q: string) {
  const params = new URLSearchParams({ contactId });
  if (q.trim()) params.set("q", q.trim());
  return `/dashboard/inbox?${params.toString()}`;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const membership = context.membership;
  const params = await searchParams;
  const companyId = membership.companyId;
  const inboxResult = await getInboxContactsByCompany(companyId, {
    search: params.q,
    filter: "all",
    page: Number(params.page ?? "1"),
    pageSize: 25,
  });
  const contacts = inboxResult.contacts;
  const selectedContactId = params.contactId ?? contacts[0]?.id ?? "";
  const conversation = selectedContactId
    ? await getConversationByContact(companyId, selectedContactId)
    : null;
  const selectedContact =
    conversation ?? contacts.find((contact) => contact.id === selectedContactId);
  const customerServiceWindowEndsAt = conversation?.inboxLastCustomerMessageAt
    ? new Date(
        conversation.inboxLastCustomerMessageAt.getTime() + 24 * 60 * 60 * 1000,
      )
    : null;

  return (
    <div className="h-[calc(100vh-5.5rem)] overflow-hidden rounded-xl bg-white text-black">
      <InboxAutoRefresh />
      <div className="grid h-full grid-cols-[460px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[#E6E6E6] bg-white">
          <div className="shrink-0 p-3">
            <form action="/dashboard/inbox" className="flex">
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search with phone number"
                className="h-9 min-w-0 flex-1 rounded-l-md border border-[#D6D6D6] px-3 text-sm outline-none placeholder:text-[#B7B7B7] focus:border-[#1677FF]"
              />
              <button
                type="submit"
                className="grid h-9 w-10 place-items-center border-y border-r border-[#D6D6D6] bg-white text-black"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="ml-2 grid h-9 w-9 place-items-center rounded-md bg-[#1677FF] text-white"
                aria-label="New contact"
              >
                <UserRound className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-2 flex gap-2">
              <button className="inline-flex h-8 items-center gap-2 rounded-md border border-[#1677FF] px-3 text-sm text-[#1677FF]">
                <Archive className="h-4 w-4" />
                All
              </button>
              <button className="inline-flex h-8 items-center rounded-md border border-[#1677FF] px-3 text-sm text-[#1677FF]">
                Any status
              </button>
              <button className="inline-flex h-8 items-center gap-2 rounded-md border border-[#D6D6D6] px-3 text-sm text-black">
                <Plus className="h-4 w-4" />
                Filter
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {contacts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#D6D6D6] p-4 text-sm text-[#777]">
                No conversations found.
              </div>
            ) : (
              <div>
                {contacts.map((contact) => {
                  const latestMessage = contact.messages[0];
                  const isActive = contact.id === selectedContactId;
                  const unreadCount = contact._count.messages;

                  return (
                    <Link
                      key={contact.id}
                      href={contactHref(contact.id, params.q ?? "")}
                      className={[
                        "grid grid-cols-[52px_minmax(0,1fr)_76px] gap-3 rounded-md px-4 py-3",
                        isActive ? "bg-[#EFEFEF]" : "hover:bg-[#F7F7F7]",
                      ].join(" ")}
                    >
                      <div className="grid h-10 w-10 place-items-center self-center rounded-full bg-[#BEBEBE] text-sm font-semibold text-white">
                        {unreadCount > 0 ? unreadCount : initials(contact.name, contact.phoneNumber)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs text-[#777]">
                          <UserRound className="mr-1 inline h-3.5 w-3.5" />
                          {membership.company.name}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-black">
                          {contact.name ?? `${contact.countryCode}${contact.phoneNumber}`}
                        </p>
                        <p className="mt-1 truncate text-sm text-[#777]">
                          {latestMessage?.direction === "OUTBOUND" ? (
                            <CheckCheck className="mr-1 inline h-4 w-4 text-[#18AEEB]" />
                          ) : (
                            <MessageCircle className="mr-1 inline h-4 w-4 text-black" />
                          )}
                          {latestMessage
                            ? messagePreview(latestMessage)
                            : "No messages yet"}
                        </p>
                      </div>
                      <p className="self-center text-right text-sm text-[#777]">
                        {latestMessage ? compactDate(latestMessage.createdAt) : ""}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-white">
          {selectedContact ? (
            <>
              <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#E6E6E6] bg-white px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#E8F4FF] text-base font-semibold text-[#081B3A] ring-1 ring-[#B9DFFF]">
                    {initials(selectedContact.name, selectedContact.phoneNumber)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold">
                      {selectedContact.name ?? `${selectedContact.countryCode}${selectedContact.phoneNumber}`}
                    </h2>
                    <p className="text-sm text-[#777]">More Details</p>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-black">
                  <Star className="h-5 w-5" />
                  <EyeOff className="h-5 w-5" />
                  <span className="inline-flex items-center gap-2 text-sm">
                    <CircleX className="h-5 w-5" />
                    Close Chat
                  </span>
                </div>
              </header>

              <section className="min-h-0 flex-1 overflow-y-auto bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-3">
                <div className="flex min-h-full flex-col justify-end gap-3">
                  {conversation?.messages.length ? (
                    conversation.messages.map((message) => {
                      const outbound = message.direction === "OUTBOUND";
                      return (
                        <div
                          key={message.id}
                          className={[
                            "max-w-[48%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                            outbound
                              ? "ml-auto bg-[#DCF8C6]"
                              : "mr-auto bg-white",
                          ].join(" ")}
                        >
                          <MessageBubbleBody message={message} />
                          <p className="mt-1 text-right text-xs text-[#777]">
                            {compactTime(message.createdAt)}
                            {outbound ? (
                              <CheckCheck className="ml-1 inline h-4 w-4 text-[#18AEEB]" />
                            ) : null}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="mx-auto rounded-lg bg-white px-4 py-3 text-sm text-[#777] shadow-sm">
                      No messages in this conversation yet.
                    </div>
                  )}
                </div>
              </section>

              <InboxChatComposer
                contactId={selectedContact.id}
                customerServiceWindowEndsAt={
                  customerServiceWindowEndsAt?.toISOString() ?? null
                }
              />
            </>
          ) : (
            <div className="grid h-full place-items-center text-center text-[#777]">
              <div>
                <MessageCircle className="mx-auto h-10 w-10" />
                <p className="mt-3 text-sm">Select a conversation</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
