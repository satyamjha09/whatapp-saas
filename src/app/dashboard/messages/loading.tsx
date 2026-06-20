function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-2xl border border-sky-100 bg-white/80",
        className,
      ].join(" ")}
    />
  );
}

export default function MessagesLoading() {
  return (
    <div className="space-y-5">
      <SkeletonBox className="h-32" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SkeletonBox className="h-32" />
        <SkeletonBox className="h-32" />
        <SkeletonBox className="h-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <SkeletonBox className="h-[520px]" />
        <div className="space-y-3 rounded-2xl border border-sky-100 bg-white/80 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBox key={index} className="h-28" />
          ))}
        </div>
      </div>
    </div>
  );
}
