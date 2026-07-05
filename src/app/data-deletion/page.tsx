export const metadata = {
  title: "Data Deletion Instructions | metawhat",
  description: "How to request deletion of data stored by metawhat.",
};

const steps = [
  "Send a deletion request from the email address used for your metawhat account or the affected contact record.",
  "Include your workspace name, email address, phone number, and a short note saying that you want your data deleted.",
  "We may verify ownership before processing the request to protect business and contact records from unauthorized deletion.",
  "After verification, we delete or anonymize eligible personal data unless retention is required for legal, tax, security, fraud-prevention, billing, audit, or compliance reasons.",
];

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-[#F4FBF7] px-6 py-12 text-[#081B3A]">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#BFE9D0] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-normal text-[#128C7E]">
          metawhat
        </p>
        <h1 className="mt-2 text-4xl font-bold">Data Deletion Instructions</h1>
        <p className="mt-3 text-sm text-[#526173]">Last updated: July 5, 2026</p>
        <p className="mt-6 leading-7 text-[#35445C]">
          You can request deletion of personal data associated with metawhat by
          emailing info@tallykonnect.com or by using the privacy request form at
          /privacy.
        </p>

        <ol className="mt-8 space-y-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E7F8EF] text-sm font-bold text-[#128C7E]">
                {index + 1}
              </span>
              <p className="leading-7 text-[#35445C]">{step}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-xl bg-[#F8FFFB] p-4 text-sm leading-6 text-[#35445C] ring-1 ring-[#BFE9D0]">
          WhatsApp message records, billing ledgers, webhook security logs, and
          audit logs may be retained where required for accounting, platform
          security, dispute handling, fraud prevention, or legal compliance.
        </div>
      </section>
    </main>
  );
}
