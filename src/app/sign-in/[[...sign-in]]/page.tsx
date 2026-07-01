import SignInClient from "./sign-in-client";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#F1FBF5] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#128C7E]">
            TallyKonnect
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-[#081B3A]">
            Sign in to continue
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#526173]">
            Use your workspace account to manage WhatsApp setup, campaigns,
            contacts, billing, and platform operations.
          </p>
        </section>

        <section className="flex justify-center lg:justify-end">
          <SignInClient />
        </section>
      </div>
    </main>
  );
}
