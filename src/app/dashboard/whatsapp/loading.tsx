export default function WhatsAppSettingsLoading() {
  return (
    <div className="space-y-5">
      <div className="h-32 animate-pulse rounded-2xl border border-[#D8E6F3] bg-white" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-[#D8E6F3] bg-white"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-[#D8E6F3] bg-white" />
    </div>
  );
}
