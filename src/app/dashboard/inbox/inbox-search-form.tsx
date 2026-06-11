import Link from "next/link";
import { InboxFilter } from "@/server/services/inbox.service";

type InboxSearchFormProps = {
  activeFilter: InboxFilter;
  searchQuery: string;
};

export default function InboxSearchForm({
  activeFilter,
  searchQuery,
}: InboxSearchFormProps) {
  return (
    <form
      action="/dashboard/inbox"
      method="GET"
      className="mt-4 flex flex-wrap gap-3"
    >
      <input type="hidden" name="filter" value={activeFilter} />

      <input
        type="search"
        name="q"
        defaultValue={searchQuery}
        placeholder="Search name, phone, or message..."
        className="min-w-[280px] flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 outline-none focus:border-black"
      />

      <button
        type="submit"
        className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white"
      >
        Search
      </button>

      {searchQuery && (
        <Link
          href={`/dashboard/inbox?filter=${activeFilter}`}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
