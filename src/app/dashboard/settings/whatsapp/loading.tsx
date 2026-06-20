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

export default function WhatsAppSettingsLoading() {
  return (
    <div className="space-y-5">
      <SkeletonBox className="h-32" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonBox className="h-32" />
        <SkeletonBox className="h-32" />
      </div>
      <SkeletonBox className="h-72 max-w-3xl" />
    </div>
  );
}
