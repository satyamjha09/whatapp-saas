import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  PageHeader,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import ChatbotCreateForm from "./chatbot-create-form";

export default async function NewChatbotPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Create Chatbot"
        description="Create the draft foundation for a WhatsApp automation flow."
        actions={
          <Link
            className={actionButtonClass("secondary")}
            href="/dashboard/automation/chatbots"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel>
          <PanelTitle
            title="Chatbot details"
            description="This creates version 1 with Start and End nodes."
          />
          <div className="mt-6">
            <ChatbotCreateForm />
          </div>
        </Panel>

        <Panel>
          <PanelTitle
            title="Phase 1 includes"
            description="Foundation records for the builder and future runtime."
          />
          <ul className="mt-5 space-y-3 text-sm text-[#526173]">
            {[
              "Draft chatbot record",
              "Version history",
              "Start and End nodes",
              "Keyword trigger records",
              "Session and event tables",
            ].map((item) => (
              <li className="flex gap-2" key={item}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#128C7E]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}
