type TeamPlanLimitCardProps = {
  usage: {
    planName: string;
    maxTeamMembers: number;
    activeMembers: number;
    pendingInvites: number;
    usedSeats: number;
    remainingSeats: number;
    canInvite: boolean;
  };
};

export default function TeamPlanLimitCard({ usage }: TeamPlanLimitCardProps) {
  const percentage = Math.min(
    Math.round(
      (usage.usedSeats / Math.max(usage.maxTeamMembers, 1)) * 100,
    ),
    100,
  );

  return (
    <section className="mb-5 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_36px_rgba(8,27,58,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#081B3A]">Team seat usage</h2>
          <p className="mt-1 text-sm text-[#526173]">
            {usage.planName} includes {usage.maxTeamMembers} team seat(s).
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${usage.canInvite ? "bg-[#22C55E]/10 text-[#15803d]" : "bg-rose-50 text-rose-700"}`}>
          {usage.canInvite ? "Seats available" : "Limit reached"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Active", usage.activeMembers],
          ["Pending", usage.pendingInvites],
          ["Used", usage.usedSeats],
          ["Remaining", usage.remainingSeats],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-3">
            <p className="text-xs text-[#526173]">{label}</p>
            <p className="mt-1 text-xl font-bold text-[#081B3A]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#BFE9D0]/70">
        <div className="h-full rounded-full bg-[#128C7E]" style={{ width: `${percentage}%` }} />
      </div>
      {!usage.canInvite ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Upgrade the workspace plan to invite more team members.
        </p>
      ) : null}
    </section>
  );
}
