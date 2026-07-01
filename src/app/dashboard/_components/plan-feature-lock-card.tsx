import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

export default function PlanFeatureLockCard({
  description,
  requiredPlan,
  title,
}: {
  description: string;
  requiredPlan: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[#BFE9D0] bg-white p-6 text-center shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-8">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
        <LockKeyhole className="h-5 w-5" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-[#081B3A]">{title}</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#526173]">
        {description}
      </p>
      <p className="mt-3 text-xs font-semibold text-[#128C7E]">
        Available on {requiredPlan} and above
      </p>
      <Link href="/dashboard/billing" className={`${actionButtonClass()} mt-5`}>
        Upgrade Plan
      </Link>
    </section>
  );
}
