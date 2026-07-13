"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { actionButtonClass, fieldClass } from "@/app/dashboard/dashboard-ui";

type ContactOption = {
  id: string;
  label: string;
};

type ProductOption = {
  id: string;
  label: string;
};

type CustomerMapping = {
  id: string;
  tallyLedgerName: string;
  tallyLedgerId: string;
  tallyCompanyId: string;
  contactId: string | null;
  matchSource: string;
  confidence: number;
};

type ProductMapping = {
  id: string;
  tallyStockItemName: string;
  tallyStockItemId: string;
  tallyCompanyId: string;
  localProductId: string | null;
  matchSource: string;
};

type TallySyncClientProps = {
  contacts: ContactOption[];
  customerMappings: CustomerMapping[];
  productMappings: ProductMapping[];
  products: ProductOption[];
};

const examplePayload = {
  tallyCompanyId: "tally-main-company",
  orders: [
    {
      externalOrderId: "TALLY-SO-4821",
      orderNumber: "ORD-2026-00124",
      ledgerId: "ledger-satyam-jha",
      ledgerName: "Satyam Jha",
      customerPhone: "918810386013",
      status: "Sales Order",
      currency: "INR",
      orderDate: "2026-07-12T10:00:00.000Z",
      narration: "Imported from Tally sales order",
      items: [
        {
          tallyStockItemId: "stock-blue-shirt",
          tallyStockItemName: "Blue Shirt",
          retailerId: "BLUE-SHIRT",
          quantity: 2,
          unitPrice: "999",
          tax: "0",
          discount: "0",
        },
      ],
    },
  ],
};

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function TallySyncClient({
  contacts,
  customerMappings,
  productMappings,
  products,
}: TallySyncClientProps) {
  const [payload, setPayload] = useState(compactJson(examplePayload));
  const [status, setStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});

  const unresolvedCustomers = useMemo(
    () => customerMappings.filter((mapping) => !mapping.contactId),
    [customerMappings],
  );
  const unresolvedProducts = useMemo(
    () => productMappings.filter((mapping) => !mapping.localProductId),
    [productMappings],
  );

  async function runSync() {
    setIsSyncing(true);
    setStatus(null);

    try {
      const parsed = JSON.parse(payload) as unknown;
      const response = await fetch("/api/orders/tally/sync", {
        body: JSON.stringify(parsed),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { message?: string; issues?: unknown[] };

      if (!response.ok) {
        throw new Error(data.message ?? "Tally sync failed");
      }

      setStatus(`${data.message ?? "Sync completed"}. Issues: ${data.issues?.length ?? 0}`);
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tally sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  async function updateCustomerMapping(mappingId: string) {
    const contactId = selectedContacts[mappingId];
    if (!contactId) return;

    const response = await fetch(`/api/orders/tally/mappings/customers/${mappingId}`, {
      body: JSON.stringify({ contactId }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    if (response.ok) window.location.reload();
    else setStatus("Unable to update customer mapping");
  }

  async function updateProductMapping(mappingId: string) {
    const localProductId = selectedProducts[mappingId];
    if (!localProductId) return;

    const response = await fetch(`/api/orders/tally/mappings/products/${mappingId}`, {
      body: JSON.stringify({ localProductId }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    if (response.ok) window.location.reload();
    else setStatus("Unable to update product mapping");
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#081B3A]">Manual Tally sync</h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              Paste Sales Order JSON from the connector. This imports valid orders and reports failed rows without stopping the whole sync.
            </p>
          </div>
          <button
            className={actionButtonClass("primary")}
            disabled={isSyncing}
            onClick={runSync}
            type="button"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
        <textarea
          className={`${fieldClass} mt-4 min-h-[340px] font-mono text-xs leading-5`}
          onChange={(event) => setPayload(event.target.value)}
          value={payload}
        />
        {status ? <p className="mt-3 text-sm text-[#526173]">{status}</p> : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#BFE9D0] p-4">
          <h3 className="text-base font-bold text-[#081B3A]">Unresolved customer mappings</h3>
          <div className="mt-4 space-y-3">
            {unresolvedCustomers.length === 0 ? (
              <p className="text-sm text-[#526173]">No unresolved Tally ledgers.</p>
            ) : (
              unresolvedCustomers.map((mapping) => (
                <div key={mapping.id} className="rounded-xl border border-[#E7F8EF] p-3">
                  <div className="text-sm font-semibold text-[#081B3A]">{mapping.tallyLedgerName}</div>
                  <div className="mt-1 text-xs text-[#526173]">{mapping.tallyLedgerId}</div>
                  <div className="mt-3 flex gap-2">
                    <select
                      className="h-10 min-w-0 flex-1 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setSelectedContacts((current) => ({ ...current, [mapping.id]: event.target.value }))
                      }
                      value={selectedContacts[mapping.id] ?? ""}
                    >
                      <option value="">Select contact</option>
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>{contact.label}</option>
                      ))}
                    </select>
                    <button
                      className={actionButtonClass("secondary")}
                      onClick={() => updateCustomerMapping(mapping.id)}
                      type="button"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#BFE9D0] p-4">
          <h3 className="text-base font-bold text-[#081B3A]">Unresolved product mappings</h3>
          <div className="mt-4 space-y-3">
            {unresolvedProducts.length === 0 ? (
              <p className="text-sm text-[#526173]">No unresolved Tally stock items.</p>
            ) : (
              unresolvedProducts.map((mapping) => (
                <div key={mapping.id} className="rounded-xl border border-[#E7F8EF] p-3">
                  <div className="text-sm font-semibold text-[#081B3A]">{mapping.tallyStockItemName}</div>
                  <div className="mt-1 text-xs text-[#526173]">{mapping.tallyStockItemId}</div>
                  <div className="mt-3 flex gap-2">
                    <select
                      className="h-10 min-w-0 flex-1 rounded-xl border border-[#BFE9D0] bg-white px-3 text-sm"
                      onChange={(event) =>
                        setSelectedProducts((current) => ({ ...current, [mapping.id]: event.target.value }))
                      }
                      value={selectedProducts[mapping.id] ?? ""}
                    >
                      <option value="">Select catalog product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.label}</option>
                      ))}
                    </select>
                    <button
                      className={actionButtonClass("secondary")}
                      onClick={() => updateProductMapping(mapping.id)}
                      type="button"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
