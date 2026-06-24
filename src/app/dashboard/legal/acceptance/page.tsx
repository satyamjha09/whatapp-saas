import Link from "next/link";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { getCompanyTrustAcceptanceStatus } from "@/server/services/trust-center.service";
import { AcceptRequiredDocumentsButton } from "./accept-required-documents-button";

export default async function LegalAcceptancePage() {
  const context = await requireAuthenticatedWorkspace();
  const status = await getCompanyTrustAcceptanceStatus({
    companyId: context.membership.companyId,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <section className="rounded-2xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-gray-500">Required Legal Review</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          Accept latest legal documents
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          To continue using TallyKonnect, your company must accept the latest
          published legal documents.
        </p>

        {status.missingDocumentTypes.length ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Required documents have not been published: {status.missingDocumentTypes.join(", ")}.
            Ask a platform operator to run the Trust Center seed.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {status.documents.map((document) => {
            const isMissing = status.missingDocuments.some(
              (item) => item.id === document.id,
            );

            return (
              <div key={document.id} className="rounded-xl border bg-gray-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{document.title}</p>
                    <p className="mt-1 text-sm text-gray-500">Version {document.version}</p>
                    <p className="mt-1 break-all font-mono text-xs text-gray-400">
                      SHA-256: {document.contentHash}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      isMissing
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {isMissing ? "Required" : "Accepted"}
                  </span>
                </div>
                <Link
                  href={`/trust/${document.slug}`}
                  target="_blank"
                  className="mt-3 inline-flex text-sm font-medium text-gray-900 underline"
                >
                  Read document
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          {status.isComplete ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue to dashboard
            </Link>
          ) : status.missingDocumentTypes.length === 0 ? (
            <AcceptRequiredDocumentsButton />
          ) : null}
        </div>
      </section>
    </main>
  );
}
