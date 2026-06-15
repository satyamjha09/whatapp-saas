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
    <div className="flex flex-wrap gap-2">
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
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-white text-zinc-950"
                : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
