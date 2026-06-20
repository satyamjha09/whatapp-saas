import Link from "next/link";
import {
  inboxPriorityFilters,
  type InboxFilter,
  type InboxPriorityFilter,
  type InboxSort,
} from "@/lib/inbox-options";
import { buildInboxHref } from "@/lib/inbox-url";
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
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-[#526173]">
        Filter by priority
      </p>

      <div className="flex flex-wrap gap-1.5">
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
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "border-[#0052CC]/25 bg-[#F0F8FF] text-[#0052CC]"
                  : priority === "URGENT"
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : priority === "HIGH"
                      ? "border-[#384080]/20 bg-[#384080]/10 text-[#384080] hover:bg-[#384080]/15"
                      : priority === "NORMAL"
                        ? "border-[#22C55E]/25 bg-[#22C55E]/10 text-[#15803d] hover:bg-[#22C55E]/15"
                        : priority === "LOW"
                          ? "border-[#D8E6F3] bg-[#F0F8FF] text-[#0052CC] hover:bg-[#D8E6F3]/35"
                          : "border-[#D8E6F3] bg-white text-[#526173] hover:border-[#0052CC]/30 hover:bg-[#F0F8FF] hover:text-[#102040]"
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
