"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { ORDER_SOURCES, ORDER_STATUSES } from "@/server/validators/order.validator";

type ContactOption = {
  id: string;
  label: string;
  phone: string;
};

type OrderItemDraft = {
  productName: string;
  quantity: string;
  unitPrice: string;
  tax: string;
  discount: string;
};

function labelize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createItem(): OrderItemDraft {
  return {
    discount: "0",
    productName: "",
    quantity: "1",
    tax: "0",
    unitPrice: "0",
  };
}

export default function NewOrderForm({
  contacts,
}: {
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<OrderItemDraft[]>([createItem()]);

  const estimatedTotal = useMemo(() => {
    return items.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const tax = Number(item.tax) || 0;
      const discount = Number(item.discount) || 0;
      return total + quantity * unitPrice + tax - discount;
    }, 0);
  }, [items]);

  function updateItem(
    index: number,
    field: keyof OrderItemDraft,
    value: string,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      contactId: String(formData.get("contactId") ?? ""),
      currency: String(formData.get("currency") ?? "INR"),
      externalOrderId: String(formData.get("externalOrderId") ?? ""),
      items: items.map((item) => ({
        discount: item.discount || "0",
        productName: item.productName,
        quantity: item.quantity,
        tax: item.tax || "0",
        unitPrice: item.unitPrice || "0",
      })),
      orderDate: String(formData.get("orderDate") ?? "") || undefined,
      orderNumber: String(formData.get("orderNumber") ?? ""),
      shipping: String(formData.get("shipping") ?? "0"),
      source: String(formData.get("source") ?? "MANUAL"),
      status: String(formData.get("status") ?? "DRAFT"),
    };

    try {
      const response = await fetch("/api/orders", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to create order");
      }

      router.push(`/dashboard/orders/${data.order.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create order",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            Customer
          </span>
          <select
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            name="contactId"
            required
          >
            <option value="">Select customer</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.label} · {contact.phone}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            Order number
          </span>
          <input
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            name="orderNumber"
            placeholder="ORD-2026-00124"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            External order ID
          </span>
          <input
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            name="externalOrderId"
            placeholder="TALLY-SO-4821"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            Order date
          </span>
          <input
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            name="orderDate"
            type="datetime-local"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            Source
          </span>
          <select
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue="MANUAL"
            name="source"
          >
            {ORDER_SOURCES.map((source) => (
              <option key={source} value={source}>
                {labelize(source)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            Starting status
          </span>
          <select
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue="DRAFT"
            name="status"
          >
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelize(status)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#081B3A]">Order items</h2>
            <p className="text-sm text-[#526173]">
              Product names and prices are saved as order snapshots.
            </p>
          </div>
          <button
            className={actionButtonClass("secondary")}
            onClick={() => setItems((current) => [...current, createItem()])}
            type="button"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div
              className="grid gap-3 rounded-xl border border-[#BFE9D0] bg-white p-3 lg:grid-cols-[1.5fr_0.5fr_0.7fr_0.7fr_0.7fr_auto]"
              key={index}
            >
              <input
                className="h-10 rounded-lg border border-[#BFE9D0] px-3 text-sm"
                onChange={(event) =>
                  updateItem(index, "productName", event.target.value)
                }
                placeholder="Product name"
                required
                value={item.productName}
              />
              <input
                className="h-10 rounded-lg border border-[#BFE9D0] px-3 text-sm"
                min="1"
                onChange={(event) =>
                  updateItem(index, "quantity", event.target.value)
                }
                placeholder="Qty"
                required
                type="number"
                value={item.quantity}
              />
              <input
                className="h-10 rounded-lg border border-[#BFE9D0] px-3 text-sm"
                min="0"
                onChange={(event) =>
                  updateItem(index, "unitPrice", event.target.value)
                }
                placeholder="Unit price"
                required
                step="0.01"
                type="number"
                value={item.unitPrice}
              />
              <input
                className="h-10 rounded-lg border border-[#BFE9D0] px-3 text-sm"
                min="0"
                onChange={(event) => updateItem(index, "tax", event.target.value)}
                placeholder="Tax"
                step="0.01"
                type="number"
                value={item.tax}
              />
              <input
                className="h-10 rounded-lg border border-[#BFE9D0] px-3 text-sm"
                min="0"
                onChange={(event) =>
                  updateItem(index, "discount", event.target.value)
                }
                placeholder="Discount"
                step="0.01"
                type="number"
                value={item.discount}
              />
              <button
                aria-label="Remove item"
                className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600 disabled:opacity-40"
                disabled={items.length === 1}
                onClick={() =>
                  setItems((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.4fr_0.6fr_auto] lg:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            Currency
          </span>
          <input
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue="INR"
            maxLength={3}
            name="currency"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#081B3A]">
            Shipping amount
          </span>
          <input
            className="h-11 w-full rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm text-[#081B3A]"
            defaultValue="0"
            min="0"
            name="shipping"
            step="0.01"
            type="number"
          />
        </label>
        <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] px-4 py-3 text-sm font-semibold text-[#075E54]">
          Estimated total: ₹{estimatedTotal.toLocaleString("en-IN")}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          className={actionButtonClass("primary")}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating..." : "Create Order"}
        </button>
        <button
          className={actionButtonClass("secondary")}
          onClick={() => router.push("/dashboard/orders")}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
