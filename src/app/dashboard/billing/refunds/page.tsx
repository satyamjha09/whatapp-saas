import { requireAdmin } from "@/server/auth/authorization";
import { listCompanyBillingInvoices } from "@/server/services/billing-invoice.service";
import { listCompanyBillingRefunds } from "@/server/services/billing-refund.service";
import { RefundCreateForm } from "./refund-create-form";
import { ReconcileRefundsButton } from "./refund-reconcile-button";
import {
  CreditNotePdfButton,
  SendCreditNoteEmailButton,
} from "@/app/dashboard/billing/document-email-actions";

function money(paise: number, currency: string) {
 return new Intl.NumberFormat("en-IN", {
   style: "currency",
   currency,
 }).format(paise / 100);
}

export default async function BillingRefundsPage() {
 const context = await requireAdmin();

 const [invoices, refunds] = await Promise.all([
   listCompanyBillingInvoices({
     companyId: context.membership.companyId,
   }),
   listCompanyBillingRefunds({
     companyId: context.membership.companyId,
   }),
 ]);

 const paidInvoices = invoices.filter(
   (invoice) => invoice.status === "PAID" && invoice.razorpayPaymentId,
 );

 return (
   <main className="mx-auto max-w-7xl px-6 py-8">
     <div className="flex flex-wrap items-start justify-between gap-4">
       <div>
         <p className="text-sm font-medium text-gray-500">Billing</p>
         <h1 className="mt-1 text-3xl font-bold text-gray-900">
           Refunds & Credit Notes
         </h1>
         <p className="mt-2 text-sm text-gray-600">
           Create refunds, issue credit notes, and track payment reversal history.
         </p>
       </div>
       <div className="pt-4">
         <ReconcileRefundsButton />
       </div>
     </div>

     <div className="mt-6">
       <RefundCreateForm
         invoices={paidInvoices.map((invoice) => ({
           id: invoice.id,
           invoiceNumber: invoice.invoiceNumber,
           totalPaise: invoice.totalPaise,
           currency: invoice.currency,
         }))}
       />
     </div>

     <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
       <div className="border-b bg-gray-50 px-6 py-4">
         <h2 className="text-lg font-semibold text-gray-900">
           Refund History
         </h2>
       </div>

       <div className="overflow-auto">
         <table className="w-full text-left text-sm">
           <thead className="bg-gray-50 text-xs uppercase text-gray-500">
             <tr>
               <th className="px-5 py-3">Refund</th>
               <th className="px-5 py-3">Invoice</th>
               <th className="px-5 py-3">Type</th>
               <th className="px-5 py-3">Status</th>
               <th className="px-5 py-3">Razorpay Status</th>
               <th className="px-5 py-3">Attempts</th>
               <th className="px-5 py-3">Amount</th>
               <th className="px-5 py-3">Razorpay Refund</th>
               <th className="px-5 py-3">Credit Note</th>
               <th className="px-5 py-3">Requested By</th>
             </tr>
           </thead>

           <tbody className="divide-y">
             {refunds.map((refund) => (
               <tr key={refund.id}>
                 <td className="px-5 py-4 font-mono text-xs">{refund.id}</td>
                 <td className="px-5 py-4">
                   {refund.invoice?.invoiceNumber ?? "-"}
                 </td>
                 <td className="px-5 py-4">{refund.type}</td>
                 <td className="px-5 py-4 font-semibold">{refund.status}</td>
                 <td className="px-5 py-4">{refund.razorpayStatus ?? "-"}</td>
                 <td className="px-5 py-4">{refund.reconciliationAttempts}</td>
                 <td className="px-5 py-4">
                   {money(refund.amountPaise, refund.currency)}
                 </td>
                 <td className="px-5 py-4 text-xs">
                   {refund.razorpayRefundId ?? "-"}
                 </td>
                 <td className="px-5 py-4">
                   {refund.creditNote ? (
                     <div className="space-y-2">
                       <p>{refund.creditNote.creditNoteNumber}</p>

                       <div className="flex flex-wrap gap-2">
                         <CreditNotePdfButton creditNoteId={refund.creditNote.id} />
                         <SendCreditNoteEmailButton creditNoteId={refund.creditNote.id} />
                       </div>
                     </div>
                   ) : (
                     "-"
                   )}
                 </td>
                 <td className="px-5 py-4">
                   {refund.requestedBy?.email ?? "-"}
                 </td>
               </tr>
             ))}

             {refunds.length === 0 && (
               <tr>
                 <td
                   colSpan={10}
                   className="px-5 py-8 text-center text-sm text-gray-500"
                 >
                   No refunds yet.
                 </td>
               </tr>
             )}
           </tbody>
         </table>
       </div>
     </section>
   </main>
 );
}
