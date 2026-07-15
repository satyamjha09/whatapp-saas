"use client";

import { useEffect } from "react";

export default function InboxPresenceHeartbeat({
  activeContactId,
}: {
  activeContactId?: string | null;
}) {
  useEffect(() => {
    let disposed = false;

    async function sendHeartbeat() {
      if (disposed) return;

      await fetch("/api/inbox/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: document.visibilityState === "visible" ? "AVAILABLE" : "AWAY",
          activeContactId: activeContactId ?? null,
        }),
      }).catch(() => undefined);
    }

    sendHeartbeat();

    const heartbeat = window.setInterval(sendHeartbeat, 25_000);
    const onVisibilityChange = () => void sendHeartbeat();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeContactId]);

  return null;
}
