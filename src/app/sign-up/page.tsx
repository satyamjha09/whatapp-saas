import { SignupForm } from "./signup-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    redirect_url?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm md:p-10">
        <SignupForm
          initialEmail={params.email ?? ""}
          redirectUrl={params.redirect_url ?? ""}
        />
      </div>
    </main>
  );
}
