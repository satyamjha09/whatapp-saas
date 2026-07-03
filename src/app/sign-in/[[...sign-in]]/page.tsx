import Image from "next/image";
import SignInClient from "./sign-in-client";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#F1FBF5] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#BFE9D0]">
              <Image
                src="/brand/metawhat-mark.png"
                alt="metawhat logo"
                width={38}
                height={38}
                className="h-9 w-9 object-contain"
                priority
              />
            </span>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#128C7E]">
              metawhat
            </p>
          </div>
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
