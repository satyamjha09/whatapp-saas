export default function DeveloperApiUsageCard({
  usage,
}: {
  usage: {
    planName: string;
    dailyLimit: number;
    usedToday: number;
    remainingToday: number;
  };
}) {
  const percentage = Math.min(
    Math.round((usage.usedToday / Math.max(usage.dailyLimit, 1)) * 100),
    100,
  );

  return (
    <section className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_36px_rgba(8,27,58,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#081B3A]">Developer API usage</h2>
          <p className="mt-1 text-sm text-[#526173]">
            Daily request usage for the {usage.planName} plan.
          </p>
        </div>
        <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-semibold text-[#128C7E]">
          UTC day
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Limit", usage.dailyLimit],
          ["Used", usage.usedToday],
          ["Remaining", usage.remainingToday],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-3">
            <p className="text-xs text-[#526173]">{label}</p>
            <p className="mt-1 text-xl font-bold text-[#081B3A]">
              {value.toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#BFE9D0]/70">
        <div className="h-full rounded-full bg-[#128C7E]" style={{ width: `${percentage}%` }} />
      </div>
    </section>
  );
}
