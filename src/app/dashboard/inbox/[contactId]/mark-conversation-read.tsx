"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type MarkConversationReadProps = {
  contactId: string;
};

type MarkConversationReadResponse = {
  updatedCount?: number;
};

export default function MarkConversationRead({
  contactId,
}: MarkConversationReadProps) {
  const router = useRouter();

  useEffect(() => {
    async function markRead() {
      const response = await fetch(`/api/inbox/${contactId}/read`, {
        method: "POST",
      });

      if (!response.ok) {
        return;
      }

      const data: MarkConversationReadResponse = await response.json();

      if (data.updatedCount && data.updatedCount > 0) {
        router.refresh();
      }
    }

    markRead();
  }, [contactId, router]);

  return null;
}
