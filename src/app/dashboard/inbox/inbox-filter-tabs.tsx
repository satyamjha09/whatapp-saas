import Link from "next/link";
import {
  inboxFilterLabels,
  inboxFilters,
  type InboxFilter,
  type InboxPriorityFilter,
  type InboxSort,
} from "@/lib/inbox-options";
import { buildInboxHref } from "@/lib/inbox-url";

type InboxFilterTabsProps = {
  activeFilter: InboxFilter;
  searchQuery?: string;
  activeTagId?: string;
  activePriority?: InboxPriorityFilter;
  activeSort?: InboxSort;
  sla?: string | null;
};

const filters = inboxFilters.map((filter) => ({
  label: inboxFilterLabels[filter],
  value: filter,
}));

export default function InboxFilterTabs({
  activeFilter,
  searchQuery = "",
  activeTagId = "",
  activePriority = "all",
  activeSort = "latest",
  sla,
}: InboxFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;

        return (
          <Link
            key={filter.value}
            href={buildInboxHref("/dashboard/inbox", {
              filter: filter.value,
              q: searchQuery,
              tagId: activeTagId,
              priority: activePriority,
              sort: activeSort,
              sla,
            })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "border border-[#0052CC]/25 bg-[#F0F8FF] text-[#0052CC]"
                : "border border-[#D8E6F3] bg-white text-[#526173] hover:border-[#0052CC]/30 hover:bg-[#F0F8FF] hover:text-[#102040]"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
