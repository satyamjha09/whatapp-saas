type InboxStatsCardsProps = {
  stats: {
    totalConversations: number;
    openConversations: number;
    closedConversations: number;
    snoozedConversations: number;
    unreadConversations: number;
    unreadMessages: number;
    urgentConversations: number;
    assignedToMeConversations: number;
    unassignedConversations: number;
    needsReplyConversations: number;
    overdueConversations: number;
  };
  variant?: "dark" | "light";
};

export default function InboxStatsCards({
  stats,
  variant = "dark",
}: InboxStatsCardsProps) {
  const cards = [
    {
      label: "Total",
      value: stats.totalConversations,
      description: "All conversations",
    },
    {
      label: "Open",
      value: stats.openConversations,
      description: "Active open conversations",
    },
    {
      label: "Unread",
      value: stats.unreadConversations,
      description: `${stats.unreadMessages} unread message(s)`,
    },
    {
      label: "Needs reply",
      value: stats.needsReplyConversations,
      description: "Latest message from customer",
    },
    {
      label: "Overdue",
      value: stats.overdueConversations,
      description: "Past SLA response time",
    },
    {
      label: "Urgent",
      value: stats.urgentConversations,
      description: "Needs fastest response",
    },
    {
      label: "Snoozed",
      value: stats.snoozedConversations,
      description: "Hidden until later",
    },
    {
      label: "Assigned to me",
      value: stats.assignedToMeConversations,
      description: "Your conversations",
    },
    {
      label: "Unassigned",
      value: stats.unassignedConversations,
      description: "Needs owner",
    },
    {
      label: "Closed",
      value: stats.closedConversations,
      description: "Resolved conversations",
    },
  ];

  return (
    <section className="mt-3 grid shrink-0 gap-2 sm:grid-cols-5 xl:grid-cols-10">
      {cards.map((card) => (
        <div
          key={card.label}
          className={
            variant === "light"
              ? "rounded-2xl border border-[#D8E6F3] bg-white p-3 shadow-[0_10px_26px_rgba(8,27,58,0.07)]"
              : "rounded-2xl border border-[#D8E6F3] bg-white p-3 shadow-[0_10px_26px_rgba(8,27,58,0.07)]"
          }
        >
          <p
            className={
              variant === "light"
                ? "text-sm font-medium text-[#526173]"
                : "truncate text-xs font-medium text-[#526173]"
            }
          >
            {card.label}
          </p>
          <p
            className={
              variant === "light"
                ? "mt-2 text-2xl font-bold text-[#081B3A]"
                : "mt-1 text-lg font-bold text-[#081B3A]"
            }
          >
            {card.value.toLocaleString("en-IN")}
          </p>
          <p
            className={
              variant === "light"
                ? "mt-1 text-xs text-[#526173]"
                : "mt-0.5 truncate text-[11px] text-[#526173]/80"
            }
          >
            {card.description}
          </p>
        </div>
      ))}
    </section>
  );
}
