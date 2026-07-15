import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listInboxReplyApprovals } from "@/server/services/inbox-reply-approval.service";
import InboxApprovalQueue from "./inbox-approval-queue";

export default async function InboxReplyApprovalsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const approvals = await listInboxReplyApprovals({
    companyId: context.membership.companyId,
    status: "PENDING",
  });

  return (
    <main className="space-y-6 p-6">
      <section className="rounded-[20px] border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.10)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#128C7E]">
              Inbox approvals
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#102040]">
              Reply approval queue
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#526173]">
              Review WhatsApp replies from queues that require approval. Wallet
              debit and message sending happen only after approval.
            </p>
          </div>
          <Link
            href="/dashboard/inbox"
            className="inline-flex items-center gap-2 rounded-xl border border-[#BFE9D0] px-4 py-2 text-sm font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inbox
          </Link>
        </div>
      </section>

      <InboxApprovalQueue initialApprovals={approvals} />
    </main>
  );
}
