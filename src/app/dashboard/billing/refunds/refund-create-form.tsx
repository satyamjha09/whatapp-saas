"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefundCreateForm({
 invoices,
}: {
 invoices: Array<{
   id: string;
   invoiceNumber: string;
   totalPaise: number;
   currency: string;
 }>;
}) {
 const router = useRouter();
 const [invoiceId, setInvoiceId] = useState("");
 const [amountRupees, setAmountRupees] = useState("");
 const [confirmation, setConfirmation] = useState("");
 const [reason, setReason] = useState("");
 const [downgradeAfterFullRefund, setDowngradeAfterFullRefund] = useState(true);
 const [isSaving, setIsSaving] = useState(false);
 const [error, setError] = useState("");

 async function submit() {
   setIsSaving(true);
   setError("");

   try {
     const amountPaise = Math.round(Number(amountRupees) * 100);

     const response = await fetch("/api/billing/refunds", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         invoiceId,
         amountPaise,
         confirmation,
         reason,
         downgradeAfterFullRefund,
       }),
     });

     const data = await response.json();

     if (!response.ok) {
       setError(data.message ?? "Unable to create refund.");
       return;
     }

     setInvoiceId("");
     setAmountRupees("");
     setConfirmation("");
     setReason("");
     router.refresh();
   } catch {
     setError("Unable to create refund.");
   } finally {
     setIsSaving(false);
   }
 }

 return (
   <section className="rounded-2xl border bg-white p-5 shadow-sm">
     <h2 className="text-lg font-semibold text-gray-900">Create Refund</h2>

     <div className="mt-4 grid gap-4 md:grid-cols-2">
       <label className="block">
         <span className="text-sm font-medium text-gray-700">Invoice</span>
         <select
           value={invoiceId}
           onChange={(event) => setInvoiceId(event.target.value)}
           className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
         >
           <option value="">Select invoice</option>
           {invoices.map((invoice) => (
             <option key={invoice.id} value={invoice.id}>
               {invoice.invoiceNumber} · ₹{invoice.totalPaise / 100}
             </option>
           ))}
         </select>
       </label>

       <label className="block">
         <span className="text-sm font-medium text-gray-700">
           Refund amount ₹
         </span>
         <input
           value={amountRupees}
           onChange={(event) => setAmountRupees(event.target.value)}
           className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
           placeholder="999"
         />
       </label>

       <label className="block md:col-span-2">
         <span className="text-sm font-medium text-gray-700">Reason</span>
         <textarea
           value={reason}
           onChange={(event) => setReason(event.target.value)}
           rows={3}
           className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
           placeholder="Customer requested refund..."
         />
       </label>

       <label className="block">
         <span className="text-sm font-medium text-gray-700">
           Confirmation
         </span>
         <input
           value={confirmation}
           onChange={(event) => setConfirmation(event.target.value)}
           className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
           placeholder="CONFIRM_REFUND"
         />
       </label>

       <label className="flex items-center gap-2 pt-7 text-sm text-gray-700">
         <input
           type="checkbox"
           checked={downgradeAfterFullRefund}
           onChange={(event) => setDowngradeAfterFullRefund(event.target.checked)}
         />
         Downgrade company after full refund
       </label>
     </div>

     <button
       type="button"
       onClick={submit}
       disabled={isSaving || !invoiceId || !amountRupees}
       className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
     >
       {isSaving ? "Processing..." : "Create Refund"}
     </button>

     {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
   </section>
 );
}
