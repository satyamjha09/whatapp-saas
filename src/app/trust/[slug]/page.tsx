import { notFound } from "next/navigation";
import { getPublishedTrustDocumentBySlug } from "@/server/services/trust-center.service";

export default async function TrustDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const document = await getPublishedTrustDocumentBySlug(slug);
  if (!document) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <article className="rounded-2xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-gray-500">
          Version {document.version}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{document.title}</h1>
        <p className="mt-2 break-all font-mono text-xs text-gray-400">
          SHA-256: {document.contentHash}
        </p>
        <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {document.content}
        </div>
      </article>
    </main>
  );
}
