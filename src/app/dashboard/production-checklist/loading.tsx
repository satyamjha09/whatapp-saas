export default function ProductionChecklistLoading() {
  return (
    <div className="space-y-5">
      <div className="h-36 animate-pulse rounded-2xl border border-[#D8E6F3] bg-white" />
      <div className="h-40 animate-pulse rounded-2xl border border-[#D8E6F3] bg-white" />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-2xl border border-[#D8E6F3] bg-white"
          />
        ))}
      </div>
    </div>
  );
}
