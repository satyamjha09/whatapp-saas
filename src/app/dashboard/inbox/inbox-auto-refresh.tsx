"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type InboxRealtimeEvent = {
  type?: string;
  body?: string;
  contactId?: string;
  messageId?: string;
};

export default function InboxAutoRefresh({
  activeContactId,
  enableFallbackPolling = true,
  intervalMs = 30_000,
}: {
  activeContactId?: string;
  enableFallbackPolling?: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const isLiveConnectedRef = useRef(false);
  const hasShownFallbackToastRef = useRef(false);

  useEffect(() => {
    let toastTimer: number | undefined;
    const eventSource = new EventSource("/api/inbox/events");

    const showToast = (message: string) => {
      setToast(message);
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => setToast(""), 5000);
    };

    const shouldRefreshForEvent = (data: InboxRealtimeEvent) => {
      if (document.visibilityState !== "visible") {
        return false;
      }

      if (!activeContactId) {
        return true;
      }

      return data.contactId === activeContactId;
    };

    eventSource.addEventListener("ready", () => {
      isLiveConnectedRef.current = true;
      hasShownFallbackToastRef.current = false;
    });

    eventSource.addEventListener("inbox", (event) => {
      const data = JSON.parse(event.data) as InboxRealtimeEvent;

      if (data.type === "INBOUND_MESSAGE_CREATED") {
        if (shouldRefreshForEvent(data)) {
          router.refresh();
        }

        showToast(data.body ? `New message: ${data.body}` : "New inbox message");
      }
    });

    eventSource.onerror = () => {
      isLiveConnectedRef.current = false;

      if (!hasShownFallbackToastRef.current) {
        hasShownFallbackToastRef.current = true;
        showToast("Live inbox connection interrupted. Using fallback refresh.");
      }
    };

    const timer = window.setInterval(() => {
      if (
        enableFallbackPolling &&
        !isLiveConnectedRef.current &&
        document.visibilityState === "visible"
      ) {
        router.refresh();
      }
    }, intervalMs);

    return () => {
      eventSource.close();
      window.clearInterval(timer);
      if (toastTimer) window.clearTimeout(toastTimer);
    };
  }, [activeContactId, enableFallbackPolling, intervalMs, router]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-[#B9DFFF] bg-white px-4 py-3 text-sm font-semibold text-[#081B3A] shadow-lg">
      {toast}
    </div>
  );
}
