import Link from "next/link";
import {
  inboxPriorityFilters,
  type InboxFilter,
  type InboxPriorityFilter,
  type InboxSort,
} from "@/lib/inbox-options";
import { buildInboxHref } from "@/lib/inbox-url";
import { getPriorityColorClass } from "./priority-color";

type InboxPriorityFilterProps = {
  activeFilter: InboxFilter;
  searchQuery: string;
  activeTagId?: string;
  activePriority: InboxPriorityFilter;
  activeSort?: InboxSort;
  sla?: string | null;
};

const priorities = inboxPriorityFilters;

export default function InboxPriorityFilter({
  activeFilter,
  searchQuery,
  activeTagId = "",
  activePriority,
  activeSort = "latest",
  sla,
}: InboxPriorityFilterProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-400">
        Filter by priority
      </p>

      <div className="flex flex-wrap gap-2">
        {priorities.map((priority) => {
          const isActive = activePriority === priority;

          return (
            <Link
              key={priority}
              href={buildInboxHref("/dashboard/inbox", {
                filter: activeFilter,
                q: searchQuery,
                tagId: activeTagId,
                priority,
                sort: activeSort,
                sla,
              })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-white text-zinc-950"
                  : priority === "all"
                    ? "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                    : getPriorityColorClass(priority)
              }`}
            >
              {priority === "all" ? "All priorities" : priority}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
