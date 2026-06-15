"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionButtonClass, fieldClass } from "@/app/dashboard/dashboard-ui";

type BulkContact = {
  id: string;
  name: string | null;
  countryCode: string;
  phoneNumber: string;
  inboxStatus: "OPEN" | "CLOSED";
  inboxPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
};

type TeamMember = {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

type InboxTag = {
  id: string;
  name: string;
  color: string;
};

type InboxBulkActionsProps = {
  contacts: BulkContact[];
  members: TeamMember[];
  tags: InboxTag[];
};

type BulkAction =
  | "SET_STATUS"
  | "SET_PRIORITY"
  | "SET_ASSIGNEE"
  | "ADD_TAG"
  | "REMOVE_TAG"
  | "MARK_READ"
  | "MARK_UNREAD"
  | "SNOOZE"
  | "UNSNOOZE";

type BulkActionResponse = {
  message: string;
  errors?: {
    contactIds?: string[];
    action?: string[];
    status?: string[];
    priority?: string[];
    assignedToUserId?: string[];
    tagId?: string[];
    snoozedUntil?: string[];
  };
};

export default function InboxBulkActions({
  contacts,
  members,
  tags,
}: InboxBulkActionsProps) {
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [action, setAction] = useState<BulkAction>("SET_STATUS");
  const [status, setStatus] = useState<"OPEN" | "CLOSED">("CLOSED");
  const [priority, setPriority] = useState<
    "LOW" | "NORMAL" | "HIGH" | "URGENT"
  >("NORMAL");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [tagId, setTagId] = useState("");
  const [snoozePreset, setSnoozePreset] = useState("tomorrow");
  const [error, setError] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const allVisibleSelected =
    contacts.length > 0 && selectedIds.length === contacts.length;
  const isTagAction = action === "ADD_TAG" || action === "REMOVE_TAG";
  const isApplyDisabled =
    isApplying || selectedIds.length === 0 || (isTagAction && !tagId);

  function toggleContact(contactId: string) {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(contactId)) {
        return currentIds.filter((id) => id !== contactId);
      }

      return [...currentIds, contactId];
    });
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(contacts.map((contact) => contact.id));
  }

  function getSnoozedUntilFromPreset() {
    const now = Date.now();

    if (snoozePreset === "1_hour") {
      return new Date(now + 60 * 60 * 1000).toISOString();
    }

    if (snoozePreset === "7_days") {
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }

  async function applyBulkAction() {
    setError("");
    setIsApplying(true);

    try {
      const response = await fetch("/api/inbox/bulk-actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactIds: selectedIds,
          action,
          status: action === "SET_STATUS" ? status : undefined,
          priority: action === "SET_PRIORITY" ? priority : undefined,
          assignedToUserId:
            action === "SET_ASSIGNEE" ? assignedToUserId || null : undefined,
          tagId: isTagAction ? tagId : undefined,
          snoozedUntil:
            action === "SNOOZE" ? getSnoozedUntilFromPreset() : undefined,
        }),
      });

      const data: BulkActionResponse = await response.json();

      if (!response.ok) {
        const firstError =
          data.errors?.contactIds?.[0] ??
          data.errors?.status?.[0] ??
          data.errors?.priority?.[0] ??
          data.errors?.assignedToUserId?.[0] ??
          data.errors?.tagId?.[0] ??
          data.errors?.snoozedUntil?.[0] ??
          data.errors?.action?.[0] ??
          data.message;

        setError(firstError);
        return;
      }

      setSelectedIds([]);
      router.refresh();
    } catch {
      setError("Unable to apply bulk action. Please try again.");
    } finally {
      setIsApplying(false);
    }
  }

  if (contacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">Bulk actions</p>
          <p className="mt-1 text-sm text-zinc-500">
            Selected {selectedIds.length} of {contacts.length} visible
            conversations.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleAllVisible}
          className={actionButtonClass("secondary")}
        >
          {allVisibleSelected ? "Clear selection" : "Select visible"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_180px_180px_auto]">
        <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/35 p-2">
          <div className="space-y-1">
            {contacts.map((contact) => (
              <label
                key={contact.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition hover:bg-white/[0.05]"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="mt-1"
                />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {contact.name ?? "Unnamed Contact"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    +{contact.countryCode}
                    {contact.phoneNumber} - {contact.inboxStatus} -{" "}
                    {contact.inboxPriority}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="bulkAction"
            className="mb-2 block text-xs font-medium text-zinc-500"
          >
            Action
          </label>
          <select
            id="bulkAction"
            value={action}
            onChange={(event) => setAction(event.target.value as BulkAction)}
            className={`${fieldClass} py-2.5`}
          >
            <option value="SET_STATUS">Set status</option>
            <option value="SET_PRIORITY">Set priority</option>
            <option value="SET_ASSIGNEE">Set assignee</option>
            <option value="ADD_TAG">Add tag</option>
            <option value="REMOVE_TAG">Remove tag</option>
            <option value="MARK_READ">Mark read</option>
            <option value="MARK_UNREAD">Mark unread</option>
            <option value="SNOOZE">Snooze</option>
            <option value="UNSNOOZE">Unsnooze</option>
          </select>
        </div>

        <div>
          {action === "SET_STATUS" ? (
            <>
              <label
                htmlFor="bulkStatus"
                className="mb-2 block text-xs font-medium text-zinc-500"
              >
                Status
              </label>
              <select
                id="bulkStatus"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "OPEN" | "CLOSED")
                }
                className={`${fieldClass} py-2.5`}
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </>
          ) : action === "SET_PRIORITY" ? (
            <>
              <label
                htmlFor="bulkPriority"
                className="mb-2 block text-xs font-medium text-zinc-500"
              >
                Priority
              </label>
              <select
                id="bulkPriority"
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT",
                  )
                }
                className={`${fieldClass} py-2.5`}
              >
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </>
          ) : action === "SET_ASSIGNEE" ? (
            <>
              <label
                htmlFor="bulkAssignee"
                className="mb-2 block text-xs font-medium text-zinc-500"
              >
                Assignee
              </label>
              <select
                id="bulkAssignee"
                value={assignedToUserId}
                onChange={(event) => setAssignedToUserId(event.target.value)}
                className={`${fieldClass} py-2.5`}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.userId}>
                    {member.user.name ?? member.user.email} - {member.role}
                  </option>
                ))}
              </select>
            </>
          ) : action === "ADD_TAG" || action === "REMOVE_TAG" ? (
            <>
              <label
                htmlFor="bulkTag"
                className="mb-2 block text-xs font-medium text-zinc-500"
              >
                Tag
              </label>
              <select
                id="bulkTag"
                value={tagId}
                onChange={(event) => setTagId(event.target.value)}
                className={`${fieldClass} py-2.5`}
              >
                <option value="">Select tag</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </>
          ) : action === "SNOOZE" ? (
            <>
              <label
                htmlFor="bulkSnooze"
                className="mb-2 block text-xs font-medium text-zinc-500"
              >
                Snooze until
              </label>
              <select
                id="bulkSnooze"
                value={snoozePreset}
                onChange={(event) => setSnoozePreset(event.target.value)}
                className={`${fieldClass} py-2.5`}
              >
                <option value="1_hour">1 hour</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="7_days">7 days</option>
              </select>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-zinc-950/35 p-3 text-sm leading-6 text-zinc-500">
              No extra value needed for this action.
            </div>
          )}
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={applyBulkAction}
            disabled={isApplyDisabled}
            className={actionButtonClass()}
          >
            {isApplying ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
