"use client";

import { ClerkLoaded, ClerkLoading, SignIn } from "@clerk/nextjs";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function SignInClient() {
  const [isTakingLong, setIsTakingLong] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appOrigin = appUrl ? new URL(appUrl).origin : "";

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsTakingLong(true), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <>
      <ClerkLoaded>
        <SignIn routing="path" path="/sign-in" />
      </ClerkLoaded>

      <ClerkLoading>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-[#D8E6F3]">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#0052CC]" />
          <h2 className="mt-4 text-lg font-bold text-[#081B3A]">
            Loading secure sign in
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#526173]">
            We are loading Clerk authentication for this tunnel URL.
          </p>

          {isTakingLong ? (
            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-left text-sm leading-6 text-amber-800 ring-1 ring-amber-200">
              <p className="font-bold">Clerk is still loading.</p>
              <p className="mt-2">
                Add this origin in Clerk Dashboard under allowed origins:
              </p>
              <code className="mt-2 block rounded-lg bg-white px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                {appOrigin || "Your current HTTPS tunnel origin"}
              </code>
              <p className="mt-2">
                Then refresh this page. Also disable ad blockers or browser
                tracking protection for this site while testing.
              </p>
            </div>
          ) : null}
        </div>
      </ClerkLoading>
    </>
  );
}
