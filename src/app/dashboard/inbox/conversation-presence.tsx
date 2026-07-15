"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, MessageCircleMore, Radio } from "lucide-react";

type PresenceUser = {
  userId: string;
  name: string | null;
  email: string;
  lastSeenAt: string;
};

type PresenceResponse = {
  data: {
    viewers: PresenceUser[];
    typing: PresenceUser[];
  };
};

function displayName(user: PresenceUser) {
  return user.name ?? user.email;
}

export default function ConversationPresence({
  contactId,
  currentUserId,
}: {
  contactId: string;
  currentUserId: string;
}) {
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    let disposed = false;

    async function heartbeatViewer() {
      await fetch(`/api/inbox/${contactId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewer: true }),
      }).catch(() => undefined);
    }

    async function loadPresence() {
      const response = await fetch(`/api/inbox/${contactId}/presence`, {
        cache: "no-store",
      }).catch(() => null);

      if (!response?.ok || disposed) return;

      const payload = (await response.json()) as PresenceResponse;
      setViewers(payload.data.viewers);
      setTypingUsers(payload.data.typing);
    }

    heartbeatViewer();
    loadPresence();

    const viewerTimer = window.setInterval(heartbeatViewer, 20_000);
    const presenceTimer = window.setInterval(loadPresence, 4_000);

    return () => {
      disposed = true;
      window.clearInterval(viewerTimer);
      window.clearInterval(presenceTimer);
    };
  }, [contactId]);

  const otherViewers = useMemo(
    () => viewers.filter((user) => user.userId !== currentUserId),
    [currentUserId, viewers],
  );
  const otherTypingUsers = useMemo(
    () => typingUsers.filter((user) => user.userId !== currentUserId),
    [currentUserId, typingUsers],
  );

  if (otherViewers.length === 0 && otherTypingUsers.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <Radio className="h-3.5 w-3.5" />
        Live
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {otherViewers.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          <Eye className="h-3.5 w-3.5" />
          {otherViewers.length === 1
            ? `${displayName(otherViewers[0])} viewing`
            : `${otherViewers.length} teammates viewing`}
        </span>
      ) : null}

      {otherTypingUsers.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          <MessageCircleMore className="h-3.5 w-3.5" />
          {otherTypingUsers.length === 1
            ? `${displayName(otherTypingUsers[0])} typing...`
            : `${otherTypingUsers.length} teammates typing...`}
        </span>
      ) : null}
    </div>
  );
}
