export const metadata = {
  title: "Terms of Service | metawhat",
  description: "Terms for using the metawhat WhatsApp Business SaaS platform.",
};

const sections = [
  {
    title: "Use of the platform",
    body: "metawhat provides tools for businesses to manage WhatsApp Business communication, templates, contacts, campaigns, automation, inbox workflows, billing, and related reporting. You are responsible for using the platform lawfully and only for business communication that your contacts have agreed to receive.",
  },
  {
    title: "WhatsApp and Meta requirements",
    body: "You must comply with Meta Platform Terms, WhatsApp Business Messaging Policy, WhatsApp Business Terms, template rules, opt-in requirements, commerce rules, and all applicable local laws. Meta may reject templates, limit quality, pause numbers, or restrict accounts independently of metawhat.",
  },
  {
    title: "Customer data",
    body: "You are responsible for the accuracy, consent status, and lawful use of contacts, uploaded lists, message content, templates, automation flows, and campaign targeting. Do not upload or send sensitive personal data unless you have a lawful basis and appropriate safeguards.",
  },
  {
    title: "Billing and wallet usage",
    body: "Paid usage, wallet credits, plan fees, refunds, taxes, and message charges are governed by the billing terms shown inside the product and by the payment provider used at checkout. Message provider fees may vary by country, category, and Meta pricing changes.",
  },
  {
    title: "Availability and changes",
    body: "We work to keep the service reliable, but we do not guarantee uninterrupted availability. Features may change as Meta, payment providers, infrastructure providers, and regulatory requirements evolve.",
  },
  {
    title: "Contact",
    body: "For account, billing, privacy, or support questions, contact us at info@tallykonnect.com.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F4FBF7] px-6 py-12 text-[#081B3A]">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#BFE9D0] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-normal text-[#128C7E]">
          metawhat
        </p>
        <h1 className="mt-2 text-4xl font-bold">Terms of Service</h1>
        <p className="mt-3 text-sm text-[#526173]">Last updated: July 5, 2026</p>
        <p className="mt-6 leading-7 text-[#35445C]">
          These terms explain the basic rules for using metawhat. By creating an
          account or using the service, you agree to use the platform responsibly
          and in compliance with WhatsApp, Meta, payment provider, and applicable
          legal requirements.
        </p>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold">{section.title}</h2>
              <p className="mt-2 leading-7 text-[#35445C]">{section.body}</p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
