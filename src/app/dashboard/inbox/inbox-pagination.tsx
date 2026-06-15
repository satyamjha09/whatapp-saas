import Link from "next/link";
import { buildInboxHref, type InboxUrlState } from "@/lib/inbox-url";

type InboxPaginationProps = {
  basePath: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  urlState: Omit<InboxUrlState, "page">;
};

export default function InboxPagination({
  basePath,
  pagination,
  urlState,
}: InboxPaginationProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const pages = Array.from(
    { length: pagination.totalPages },
    (_, index) => index + 1,
  ).filter((page) => {
    return (
      page === 1 ||
      page === pagination.totalPages ||
      Math.abs(page - pagination.page) <= 1
    );
  });

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-zinc-500">
        Page {pagination.page} of {pagination.totalPages} -{" "}
        {pagination.total.toLocaleString("en-IN")} conversation(s)
      </p>

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildInboxHref(basePath, {
            ...urlState,
            page: pagination.page - 1,
          })}
          aria-disabled={!pagination.hasPreviousPage}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
            pagination.hasPreviousPage
              ? "border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
              : "pointer-events-none border-white/[0.06] text-zinc-700"
          }`}
        >
          Previous
        </Link>

        {pages.map((page) => (
          <Link
            key={page}
            href={buildInboxHref(basePath, {
              ...urlState,
              page,
            })}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
              page === pagination.page
                ? "border-indigo-400 bg-indigo-500 text-white"
                : "border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
            }`}
          >
            {page}
          </Link>
        ))}

        <Link
          href={buildInboxHref(basePath, {
            ...urlState,
            page: pagination.page + 1,
          })}
          aria-disabled={!pagination.hasNextPage}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            pagination.hasNextPage
              ? "bg-indigo-500 text-white hover:bg-indigo-400"
              : "pointer-events-none bg-white/[0.04] text-zinc-700"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
