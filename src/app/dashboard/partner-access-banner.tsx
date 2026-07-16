"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PartnerAccessBannerProps = {
  clientCompanyName: string;
  expiresAt: string;
  partnerCompanyName: string;
};

export function PartnerAccessBanner({
  clientCompanyName,
  expiresAt,
  partnerCompanyName,
}: PartnerAccessBannerProps) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  async function endSession() {
    setEnding(true);

    try {
      await fetch("/api/partner/client-access/sessions/current", {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm lg:mx-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black">Partner client access is active</p>
            <p className="mt-1 text-sm text-amber-800">
              You are viewing {clientCompanyName} through {partnerCompanyName}.
              This temporary session expires at{" "}
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(expiresAt))}
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={endSession}
          disabled={ending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {ending ? "Ending..." : "Exit client access"}
        </button>
      </div>
    </div>
  );
}
