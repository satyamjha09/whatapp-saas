"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { ORDER_STATUSES } from "@/server/validators/order.validator";

function labelize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function OrderStatusActions({
  allowedStatuses,
  currentStatus,
  orderId,
}: {
  allowedStatuses: string[];
  currentStatus: string;
  orderId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(
    allowedStatuses[0] ?? "",
  );

  async function postStatus(status: string, reason?: string) {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        body: JSON.stringify({
          note: status === "CANCELLED" ? "Cancelled from dashboard" : undefined,
          reason,
          source: "DASHBOARD",
          status,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to update order");
      }

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update order",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <select
          className="h-11 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
          disabled={allowedStatuses.length === 0 || isSubmitting}
          onChange={(event) => setSelectedStatus(event.target.value)}
          value={selectedStatus}
        >
          {allowedStatuses.length === 0 ? (
            <option value="">No next status available</option>
          ) : (
            allowedStatuses.map((status) => (
              <option key={status} value={status}>
                Move to {labelize(status)}
              </option>
            ))
          )}
        </select>
        <button
          className={actionButtonClass("primary")}
          disabled={!selectedStatus || isSubmitting}
          onClick={() => postStatus(selectedStatus)}
          type="button"
        >
          {isSubmitting ? "Updating..." : "Update Status"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className={actionButtonClass("secondary")}
          disabled
          title="WhatsApp order update sending is planned for the next phases"
          type="button"
        >
          Send WhatsApp Update
        </button>
        {currentStatus !== "CANCELLED" &&
        currentStatus !== "REFUNDED" &&
        ORDER_STATUSES.includes("CANCELLED") ? (
          <button
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !allowedStatuses.includes("CANCELLED")}
            onClick={() => postStatus("CANCELLED", "Cancelled from dashboard")}
            type="button"
          >
            Cancel Order
          </button>
        ) : null}
      </div>
    </div>
  );
}
