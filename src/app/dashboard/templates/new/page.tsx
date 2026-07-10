import Link from "next/link";
import { KeyRound, Layers3, MessageSquareText } from "lucide-react";
import { redirect } from "next/navigation";
import { Panel, actionButtonClass } from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";

const builders = [
  {
    description:
      "Marketing and Utility templates with header, body, footer, variables, media, and buttons.",
    href: "/dashboard/templates/create",
    icon: MessageSquareText,
    label: "Default template",
    tag: "Most common",
  },
  {
    description:
      "OTP-focused templates for copy code, one-tap autofill, and zero-tap Android flows.",
    href: "/dashboard/templates/new/authentication",
    icon: KeyRound,
    label: "Authentication template",
    tag: "OTP",
  },
  {
    description:
      "Nested card builder for image/video carousel templates with shared button pattern.",
    href: "/dashboard/templates/new/carousel",
    icon: Layers3,
    label: "Carousel template",
    tag: "Rich marketing",
  },
];

export default async function NewTemplatePage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#128C7E]">
            Template Builder
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#081B3A]">
            Choose template type
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#526173]">
            Authentication and Carousel templates have special Meta rules, so
            they use dedicated builders instead of the default editor.
          </p>
        </div>
        <Link href="/dashboard/templates" className={actionButtonClass("secondary")}>
          Back to Templates
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {builders.map((builder) => {
          const Icon = builder.icon;

          return (
            <Link key={builder.href} href={builder.href} className="block">
              <Panel className="h-full transition hover:-translate-y-0.5 hover:border-[#128C7E]/40">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="mt-5 inline-flex rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#128C7E]">
                  {builder.tag}
                </span>
                <h2 className="mt-4 text-xl font-bold text-[#081B3A]">
                  {builder.label}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#526173]">
                  {builder.description}
                </p>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
