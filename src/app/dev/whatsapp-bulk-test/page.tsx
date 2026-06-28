import { notFound } from "next/navigation";
import DevWhatsAppBulkTestClient from "./whatsapp-bulk-test-client";

export default function DevWhatsAppBulkTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#F4FAFF] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0052CC]">
          TallyKonnect Developer Test
        </p>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-[#081B3A]">
          Send WhatsApp Bulk Test
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#526173]">
          This development-only page sends the approved Meta hello_world
          template through the application bulk-message service and worker.
        </p>

        <DevWhatsAppBulkTestClient />
      </div>
    </main>
  );
}
