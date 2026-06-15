import Link from "next/link";
import { actionButtonClass, fieldClass } from "@/app/dashboard/dashboard-ui";
import type {
  InboxFilter,
  InboxPriorityFilter,
  InboxSort,
} from "@/lib/inbox-options";
import { buildInboxHref } from "@/lib/inbox-url";

type InboxSearchFormProps = {
  activeFilter: InboxFilter;
  searchQuery: string;
  activeTagId?: string;
  activePriority?: InboxPriorityFilter;
  activeSort?: InboxSort;
  sla?: string | null;
};

export default function InboxSearchForm({
  activeFilter,
  searchQuery,
  activeTagId = "",
  activePriority = "all",
  activeSort = "latest",
  sla,
}: InboxSearchFormProps) {
  return (
    <form
      action="/dashboard/inbox"
      method="GET"
      className="mt-4 flex flex-wrap gap-3"
    >
      <input type="hidden" name="filter" value={activeFilter} />
      {activeTagId ? <input type="hidden" name="tagId" value={activeTagId} /> : null}
      {activePriority !== "all" ? (
        <input type="hidden" name="priority" value={activePriority} />
      ) : null}
      {activeSort !== "latest" ? (
        <input type="hidden" name="sort" value={activeSort} />
      ) : null}
      {sla ? <input type="hidden" name="sla" value={sla} /> : null}

      <input
        type="search"
        name="q"
        defaultValue={searchQuery}
        placeholder="Search name, phone, or message..."
        className={`${fieldClass} min-w-[280px] flex-1 py-2.5`}
      />

      <button
        type="submit"
        className={actionButtonClass()}
      >
        Search
      </button>

      {searchQuery && (
        <Link
          href={buildInboxHref("/dashboard/inbox", {
            filter: activeFilter,
            tagId: activeTagId,
            priority: activePriority,
            sort: activeSort,
            sla,
          })}
          className={actionButtonClass("secondary")}
        >
          Clear
        </Link>
      )}
    </form>
  );
}
