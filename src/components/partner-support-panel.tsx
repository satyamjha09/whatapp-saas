"use client";

import { useMemo, useState } from "react";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  firstResponseDueAt?: string | Date | null;
  resolutionDueAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  partnerCompany?: { name: string } | null;
  clientCompany?: { name: string } | null;
  comments?: Array<{
    id: string;
    body: string;
    visibility: string;
    createdAt: string | Date;
    author?: { name?: string | null; email: string } | null;
  }>;
};

type PartnerSupportPanelProps = {
  mode: "partner" | "platform";
  initialTickets: Ticket[];
};

const categories = [
  "GENERAL",
  "BILLING",
  "TECHNICAL",
  "WHATSAPP",
  "API",
  "CLIENT_ACCESS",
  "FEATURE_REQUEST",
];
const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
const statuses = [
  "OPEN",
  "PENDING_PARTNER",
  "PENDING_METAWHAT",
  "RESOLVED",
  "CLOSED",
];

function badgeClass(value: string) {
  if (["RESOLVED", "CLOSED", "LOW"].includes(value)) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (["HIGH", "URGENT"].includes(value)) return "bg-red-50 text-red-700";
  if (value.includes("PENDING")) return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

function dateLabel(value?: string | Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PartnerSupportPanel({
  initialTickets,
  mode,
}: PartnerSupportPanelProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState(
    initialTickets[0]?.id ?? "",
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "GENERAL",
    priority: "NORMAL",
  });
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0],
    [selectedTicketId, tickets],
  );

  async function refreshTickets() {
    const response = await fetch(
      mode === "partner" ? "/api/partner/support" : "/api/platform/partner-support",
    );
    const data = await response.json();
    if (data.ok) {
      setTickets(data.tickets);
      if (!selectedTicketId && data.tickets[0]) {
        setSelectedTicketId(data.tickets[0].id);
      }
    }
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/partner/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Unable to create support ticket");
      }
      setForm({
        subject: "",
        description: "",
        category: "GENERAL",
        priority: "NORMAL",
      });
      setSelectedTicketId(data.ticket.id);
      await refreshTickets();
      setMessage("Support ticket created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  async function updateTicket(ticketId: string, body: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/platform/partner-support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Unable to update support ticket");
      }
      await refreshTickets();
      setMessage("Ticket updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update");
    } finally {
      setSaving(false);
    }
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket) return;
    const formData = new FormData(event.currentTarget);
    const body = String(formData.get("body") ?? "");
    const visibility = String(formData.get("visibility") ?? "PARTNER");
    setSaving(true);
    setMessage("");
    try {
      const endpoint =
        mode === "partner"
          ? `/api/partner/support/${selectedTicket.id}/comments`
          : `/api/platform/partner-support/${selectedTicket.id}/comments`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, visibility }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Unable to add comment");
      }
      event.currentTarget.reset();
      await refreshTickets();
      setMessage("Comment added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add comment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#081B3A]">Tickets</h2>
            <p className="text-sm text-[#526173]">
              {tickets.length} support conversation(s)
            </p>
          </div>
          {message ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              {message}
            </span>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-sm text-[#526173]">
              No support tickets yet.
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicketId(ticket.id)}
                className={[
                  "w-full rounded-2xl border p-4 text-left transition",
                  selectedTicket?.id === ticket.id
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-emerald-100 bg-white hover:border-emerald-300",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black text-[#081B3A]">{ticket.subject}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-black ${badgeClass(
                      ticket.status,
                    )}`}
                  >
                    {ticket.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-[#526173]">
                  {ticket.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span
                    className={`rounded-full px-2 py-1 ${badgeClass(ticket.priority)}`}
                  >
                    {ticket.priority}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                    {ticket.category.replaceAll("_", " ")}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-sm">
        {mode === "partner" ? (
          <form onSubmit={createTicket} className="rounded-2xl bg-emerald-50 p-4">
            <h2 className="text-lg font-black text-[#081B3A]">
              Open a support ticket
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subject: event.target.value }))
                }
                placeholder="Subject"
                className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                required
              />
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
                className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({ ...current, priority: event.target.value }))
                }
                className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                Create ticket
              </button>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Describe the issue, client impact, and any IDs that help us investigate."
                className="min-h-28 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 md:col-span-2"
                required
              />
            </div>
          </form>
        ) : null}

        {selectedTicket ? (
          <div className="mt-5">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  {selectedTicket.partnerCompany?.name ?? "Partner"}{" "}
                  {selectedTicket.clientCompany
                    ? `- ${selectedTicket.clientCompany.name}`
                    : ""}
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#081B3A]">
                  {selectedTicket.subject}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526173]">
                  {selectedTicket.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(
                    selectedTicket.status,
                  )}`}
                >
                  {selectedTicket.status.replaceAll("_", " ")}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(
                    selectedTicket.priority,
                  )}`}
                >
                  {selectedTicket.priority}
                </span>
              </div>
            </div>

            {mode === "platform" ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <select
                  defaultValue={selectedTicket.status}
                  onChange={(event) =>
                    updateTicket(selectedTicket.id, { status: event.target.value })
                  }
                  className="rounded-xl border border-emerald-200 px-4 py-3 text-sm"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <select
                  defaultValue={selectedTicket.priority}
                  onChange={(event) =>
                    updateTicket(selectedTicket.id, { priority: event.target.value })
                  }
                  className="rounded-xl border border-emerald-200 px-4 py-3 text-sm"
                >
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  SLA: first response {dateLabel(selectedTicket.firstResponseDueAt)}
                  <br />
                  Resolve by {dateLabel(selectedTicket.resolutionDueAt)}
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {(selectedTicket.comments ?? []).map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-emerald-100 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-black text-[#081B3A]">
                      {comment.author?.name ?? comment.author?.email ?? "MetaWhat"}
                    </span>
                    <span className="text-[#526173]">
                      {comment.visibility} - {dateLabel(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#526173]">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={addComment} className="mt-5 rounded-2xl bg-slate-50 p-4">
              <textarea
                name="body"
                className="min-h-24 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Add a reply or internal note..."
                required
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {mode === "platform" ? (
                  <select
                    name="visibility"
                    className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm"
                    defaultValue="INTERNAL"
                  >
                    <option value="PARTNER">Partner visible</option>
                    <option value="INTERNAL">Internal note</option>
                  </select>
                ) : (
                  <input type="hidden" name="visibility" value="PARTNER" />
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                >
                  Add comment
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}
