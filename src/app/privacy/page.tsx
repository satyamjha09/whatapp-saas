import PrivacyRequestForm from "./privacy-request-form";

export const metadata = {
  title: "Privacy Policy | metawhat",
  description: "Privacy policy and request portal for metawhat.",
};

const policySections = [
  {
    title: "Information we process",
    body: "metawhat processes account details, workspace details, contacts, consent records, WhatsApp templates, messages, delivery events, campaign data, automation logs, billing records, support records, security logs, and integration credentials needed to provide the service.",
  },
  {
    title: "How we use information",
    body: "We use this information to operate the WhatsApp Business SaaS platform, send and receive messages through connected providers, manage templates and webhooks, provide support, secure accounts, process billing, detect abuse, maintain audit records, and meet legal obligations.",
  },
  {
    title: "Sharing and subprocessors",
    body: "We share data only where needed to operate the product, including with Meta/WhatsApp, payment providers, hosting providers, email providers, analytics or monitoring systems, and other services configured by the workspace administrator.",
  },
  {
    title: "Your choices",
    body: "You can request access, correction, export, deletion, or anonymization of eligible personal data. Some records may be retained where required for tax, billing, legal, security, fraud-prevention, audit, or compliance reasons.",
  },
];

export default function PublicPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F4FBF7] px-6 py-12 text-[#081B3A]">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#BFE9D0] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-normal text-[#128C7E]">
          metawhat
        </p>
        <h1 className="mt-2 text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#526173]">Last updated: July 5, 2026</p>
        <p className="mt-6 leading-7 text-[#35445C]">
          This policy explains how metawhat handles information when businesses
          use our WhatsApp Business workflow platform.
        </p>

        <div className="mt-8 space-y-6">
          {policySections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold">{section.title}</h2>
              <p className="mt-2 leading-7 text-[#35445C]">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-[#F8FFFB] p-5 ring-1 ring-[#BFE9D0]">
          <h2 className="text-xl font-bold">Privacy Request</h2>
          <p className="mt-2 leading-7 text-[#35445C]">
            Request a copy of your WhatsApp contact data or ask us to
            delete/anonymize your contact record.
          </p>

          <div className="mt-6">
            <PrivacyRequestForm />
          </div>

          <p className="mt-6 text-xs text-[#526173]">
            For security, we verify your email before creating a privacy
            request. Deletion requests are reviewed before processing.
          </p>
        </div>
      </section>
    </main>
  );
}
