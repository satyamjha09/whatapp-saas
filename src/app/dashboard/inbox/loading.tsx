function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-2xl border border-[#BFE9D0] bg-white",
        className,
      ].join(" ")}
    />
  );
}

export default function InboxLoading() {
  return (
    <div className="flex h-[calc(100vh-6rem)] max-h-screen min-h-0 flex-col overflow-hidden rounded-2xl border border-[#BFE9D0] bg-[linear-gradient(135deg,#FFFFFF,#E7F8EF_54%,rgba(191,233,208,0.78))] p-4 shadow-[0_18px_48px_rgba(8,27,58,0.10)]">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#BFE9D0] pb-3">
        <div className="space-y-2">
          <SkeletonBox className="h-3 w-32 rounded-full" />
          <SkeletonBox className="h-7 w-24 rounded-lg" />
          <SkeletonBox className="h-4 w-96 max-w-[60vw] rounded-lg" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <SkeletonBox className="h-9 w-24 rounded-xl" />
          <SkeletonBox className="h-9 w-28 rounded-xl" />
          <SkeletonBox className="h-9 w-20 rounded-xl" />
        </div>
      </div>

      <div className="mt-3 grid shrink-0 gap-2 sm:grid-cols-5 xl:grid-cols-10">
        {Array.from({ length: 10 }).map((_, index) => (
          <SkeletonBox key={index} className="h-[74px]" />
        ))}
      </div>

      <SkeletonBox className="mt-3 h-[92px] shrink-0" />

      <div className="mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[390px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#BFE9D0] bg-white p-3">
          <SkeletonBox className="h-12 shrink-0" />
          <SkeletonBox className="mt-3 h-28 shrink-0" />
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBox key={index} className="h-28" />
            ))}
          </div>
        </div>
        <SkeletonBox className="min-h-0" />
      </div>
    </div>
  );
}
