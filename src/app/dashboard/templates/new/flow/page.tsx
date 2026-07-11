import Link from "next/link";
import { redirect } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import FlowTemplateForm from "./flow-template-form";

type SearchParams = Record<string, string | string[] | undefined>;

type NewFlowTemplatePageProps = {
  searchParams: Promise<SearchParams>;
};

const supportedLanguages = new Set(["en_US", "en", "hi"]);
const supportedCategories = new Set(["MARKETING", "UTILITY"]);

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function cleanTemplateName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export default async function NewFlowTemplatePage({
  searchParams,
}: NewFlowTemplatePageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const params = await searchParams;
  const initialName = cleanTemplateName(firstQueryValue(params.name));
  const language = firstQueryValue(params.language);
  const category = firstQueryValue(params.category).toUpperCase();
  const initialFlowId = firstQueryValue(params.flowId);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#128C7E]">
            Flow Builder
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            Create WhatsApp Flow template
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#526173]">
            Connect a template CTA to a published WhatsApp Flow without changing
            the runtime or campaign logic.
          </p>
        </div>

        <Link
          href="/dashboard/templates"
          className={actionButtonClass("secondary")}
        >
          Back to Templates
        </Link>
      </div>

      <FlowTemplateForm
        initialCategory={
          supportedCategories.has(category) ? category : "MARKETING"
        }
        initialLanguage={supportedLanguages.has(language) ? language : "en_US"}
        initialFlowId={initialFlowId}
        initialName={initialName}
      />
    </div>
  );
}
