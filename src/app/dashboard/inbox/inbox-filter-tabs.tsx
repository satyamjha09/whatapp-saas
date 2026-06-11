import Link from "next/link";
import { InboxFilter } from "@/server/services/inbox.service";

type InboxFilterTabsProps = {
  activeFilter: InboxFilter;
  searchQuery?: string;
};

const filters: Array<{
  label: string;
  value: InboxFilter;
}> = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Open",
    value: "open",
  },
  {
    label: "Closed",
    value: "closed",
  },
  {
    label: "Assigned to me",
    value: "assigned-to-me",
  },
  {
    label: "Unassigned",
    value: "unassigned",
  },
];

export default function InboxFilterTabs({
  activeFilter,
  searchQuery = "",
}: InboxFilterTabsProps) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;
        const params = new URLSearchParams();

        params.set("filter", filter.value);

        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }

        return (
          <Link
            key={filter.value}
            href={`/dashboard/inbox?${params.toString()}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
