import Link from "next/link";
import { redirect } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import CarouselTemplateForm from "./carousel-template-form";

export default async function NewCarouselTemplatePage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#128C7E]">
            Carousel Builder
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            Create carousel template
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#526173]">
            Build a Meta-style carousel with 2 to 10 cards, shared button
            pattern, card media, variables, and swipe preview.
          </p>
        </div>
        <Link href="/dashboard/templates/new" className={actionButtonClass("secondary")}>
          Change Type
        </Link>
      </div>

      <CarouselTemplateForm />
    </div>
  );
}
