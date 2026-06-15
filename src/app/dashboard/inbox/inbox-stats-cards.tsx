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

  const isLight = variant === "light";

  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={
            isLight
              ? "rounded-2xl border bg-white p-4 shadow-sm"
              : "rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
          }
        >
          <p
            className={
              isLight
                ? "text-sm font-medium text-gray-500"
                : "text-sm font-medium text-zinc-500"
            }
          >
            {card.label}
          </p>
          <p
            className={
              isLight
                ? "mt-2 text-2xl font-semibold text-gray-900"
                : "mt-2 text-2xl font-semibold text-white"
            }
          >
            {card.value.toLocaleString("en-IN")}
          </p>
          <p className={isLight ? "mt-1 text-xs text-gray-500" : "mt-1 text-xs text-zinc-600"}>
            {card.description}
          </p>
        </div>
      ))}
    </section>
  );
}
