import Link from "next/link";
import { redirect } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import CatalogTemplateForm from "./catalog-template-form";

type SearchParams = Record<string, string | string[] | undefined>;

type NewCatalogTemplatePageProps = {
  searchParams: Promise<SearchParams>;
};

const supportedLanguages = new Set(["en_US", "en", "hi"]);

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

export default async function NewCatalogTemplatePage({
  searchParams,
}: NewCatalogTemplatePageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const params = await searchParams;
  const initialName = cleanTemplateName(firstQueryValue(params.name));
  const language = firstQueryValue(params.language);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#128C7E]">
            Catalog Builder
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            Create catalog template
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#526173]">
            Build a Marketing template with a synced WhatsApp Catalog and a
            View catalog button. Meta submission and runtime sending stay in
            their existing flows.
          </p>
        </div>

        <Link
          href="/dashboard/templates"
          className={actionButtonClass("secondary")}
        >
          Back to Templates
        </Link>
      </div>

      <CatalogTemplateForm
        initialLanguage={supportedLanguages.has(language) ? language : "en_US"}
        initialName={initialName}
      />
    </div>
  );
}
