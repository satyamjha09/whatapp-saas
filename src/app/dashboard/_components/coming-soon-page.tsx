import { Construction } from "lucide-react";
import { PageHeader, Panel } from "@/app/dashboard/dashboard-ui";

type ComingSoonPageProps = {
  title: string;
  description?: string;
};

export default function ComingSoonPage({
  title,
  description = "This module is planned and will be connected step by step.",
}: ComingSoonPageProps) {
  return (
    <div>
      <PageHeader
        eyebrow="Planned module"
        title={title}
        description={description}
      />
      <Panel className="flex min-h-64 items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F0F8FF] text-[#0052CC]">
            <Construction className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-bold text-[#081B3A]">Coming soon</p>
          <p className="mt-2 text-xs leading-5 text-[#526173]">
            The navigation is ready. Product workflows and data connections will
            be added in a later implementation phase.
          </p>
        </div>
      </Panel>
    </div>
  );
}
