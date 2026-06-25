import { VerifyEmailForm } from "./verify-email-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect_url?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm md:p-10">
        <VerifyEmailForm redirectUrl={params.redirect_url ?? ""} />
      </div>
    </main>
  );
}
