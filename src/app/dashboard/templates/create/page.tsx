import Link from "next/link";
import { redirect } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import TemplateForm from "../template-form";

export default async function CreateTemplatePage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#081B3A]">
          Create WhatsApp Template
        </h1>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={actionButtonClass("secondary")}
          >
            Generate with AI
          </button>
          <Link href="/dashboard/templates" className={actionButtonClass("secondary")}>
            Back to Templates
          </Link>
        </div>
      </div>

      <TemplateForm />
    </div>
  );
}
