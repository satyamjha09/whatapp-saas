import Link from "next/link";
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
      className="flex min-w-0 gap-2"
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
        className="min-w-0 flex-1 rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm text-[#102040] outline-none transition placeholder:text-[#526173]/80 focus:border-[#128C7E]/40 focus:bg-white focus:ring-4 focus:ring-[#128C7E]/10"
      />

      <button
        type="submit"
        className="rounded-xl bg-[#128C7E] px-3 py-2 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,140,126,0.22)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-60"
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
          className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
