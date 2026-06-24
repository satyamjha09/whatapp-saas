import Link from "next/link";
import { confirmPublicPrivacyVerification } from "@/server/services/public-privacy-portal.service";

type PageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function PublicPrivacyConfirmPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = params?.token;

  let ok = false;
  let message = "Missing confirmation token.";

  if (token) {
    try {
      const result = await confirmPublicPrivacyVerification({ token });

      ok = result.ok;
      message = result.message;
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : "Unable to confirm privacy request.";
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-20">
      <section className="mx-auto max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          {ok ? "Request confirmed" : "Unable to confirm"}
        </h1>

        <p className="mt-3 text-sm text-gray-600">{message}</p>

        <Link
          href="/privacy"
          className="mt-6 inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back to privacy page
        </Link>
      </section>
    </main>
  );
}
