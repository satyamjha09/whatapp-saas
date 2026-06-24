import PrivacyRequestForm from "./privacy-request-form";

export default function PublicPrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <section className="mx-auto max-w-2xl">
        <p className="text-sm font-medium text-gray-500">Privacy</p>
        <h1 className="mt-2 text-4xl font-bold text-gray-900">
          Privacy Request
        </h1>
        <p className="mt-3 text-gray-600">
          Request a copy of your WhatsApp contact data or ask us to
          delete/anonymize your contact record.
        </p>

        <div className="mt-8">
          <PrivacyRequestForm />
        </div>

        <p className="mt-6 text-xs text-gray-500">
          For security, we verify your email before creating a privacy request.
          Deletion requests are reviewed before processing.
        </p>
      </section>
    </main>
  );
}
