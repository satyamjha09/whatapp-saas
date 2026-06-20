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
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#D8E6F3] pt-3">
      <p className="text-xs text-[#526173]">
        Page {pagination.page} of {pagination.totalPages} -{" "}
        {pagination.total.toLocaleString("en-IN")} conversation(s)
      </p>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href={buildInboxHref(basePath, {
            ...urlState,
            page: pagination.page - 1,
          })}
          aria-disabled={!pagination.hasPreviousPage}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            pagination.hasPreviousPage
              ? "border-[#D8E6F3] bg-white text-[#526173] hover:bg-[#F0F8FF] hover:text-[#102040]"
              : "pointer-events-none border-[#D8E6F3] text-[#526173]/60"
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
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              page === pagination.page
                ? "border-[#0052CC] bg-[#0052CC] text-white"
                : "border-[#D8E6F3] bg-white text-[#526173] hover:bg-[#F0F8FF] hover:text-[#102040]"
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
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            pagination.hasNextPage
              ? "bg-[#0052CC] text-white hover:bg-[#003F9E]"
              : "pointer-events-none bg-[#F0F8FF] text-[#526173]/60"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
