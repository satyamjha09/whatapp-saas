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
  orderStatusTemplates,
}: {
  allowedStatuses: string[];
  currentStatus: string;
  orderId: string;
  orderStatusTemplates: Array<{
    id: string;
    label: string;
    purpose: string;
    purposeLabel: string;
    variableCount: number;
  }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(
    allowedStatuses[0] ?? "",
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    orderStatusTemplates[0]?.id ?? "",
  );

  async function postStatus(status: string, reason?: string) {
    setError(null);
    setSuccess(null);
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

  async function sendWhatsAppUpdate() {
    setError(null);
    setSuccess(null);
    setIsSending(true);

    try {
      const response = await fetch(
        `/api/orders/${orderId}/send-whatsapp-update`,
        {
          body: JSON.stringify({
            templateId: selectedTemplateId,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to send WhatsApp update");
      }

      setSuccess("WhatsApp order update queued.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to send WhatsApp update",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
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

      <div className="rounded-2xl border border-[#BFE9D0] bg-[#F7FFFA] p-4">
        <label className="text-xs font-semibold uppercase text-[#128C7E]">
          WhatsApp order update
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <select
            className="h-11 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            disabled={orderStatusTemplates.length === 0 || isSending}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            value={selectedTemplateId}
          >
            {orderStatusTemplates.length === 0 ? (
              <option value="">No approved order templates</option>
            ) : (
              orderStatusTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label} - {template.purposeLabel}
                </option>
              ))
            )}
          </select>
          <button
            className={actionButtonClass("secondary")}
            disabled={!selectedTemplateId || isSending}
            onClick={sendWhatsAppUpdate}
            type="button"
          >
            {isSending ? "Queueing..." : "Send WhatsApp Update"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#526173]">
          Uses the selected approved template, resolves variables from this
          order and customer, debits wallet once, then queues the existing
          message worker.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
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
