"use client";

type CustomerJourneyFiltersProps = {
  selectedType: string;
  selectedSource: string;
  selectedDateRange: string;
  sortOrder: "asc" | "desc";
  onTypeChange: (type: string) => void;
  onSourceChange: (source: string) => void;
  onDateRangeChange: (range: string) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
};

const FILTER_SOURCES: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Events" },
  { value: "MESSAGE", label: "Messages" },
  { value: "CAMPAIGN", label: "Campaigns" },
  { value: "AUTOMATION", label: "Automations" },
  { value: "PAYMENT", label: "Payments" },
  { value: "TALLY", label: "Tally" },
  { value: "GOOGLE_SHEET", label: "Google Sheets" },
  { value: "AI", label: "AI" },
  { value: "INBOX", label: "Agent & Inbox" },
  { value: "WHATSAPP_WEBHOOK", label: "WhatsApp Statuses" },
];

export default function CustomerJourneyFilters({
  selectedType,
  selectedSource,
  selectedDateRange,
  sortOrder,
  onTypeChange,
  onSourceChange,
  onDateRangeChange,
  onSortOrderChange,
}: CustomerJourneyFiltersProps) {
  return (
    <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-[#D8E6F3]">
      {/* Source Category Chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_SOURCES.map((s) => (
          <button
            key={s.value}
            onClick={() => onSourceChange(s.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition border ${
              selectedSource === s.value
                ? "bg-[#0052CC] text-white border-[#0052CC]"
                : "bg-white text-[#526173] border-[#D8E6F3] hover:bg-[#F0F8FF]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Date & Sorting Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D8E6F3] bg-white text-[#081B3A] focus:outline-none"
        >
          <option value="ALL">All event types</option>
          <option value="ERRORS">Errors only</option>
          <option value="HUMAN_HANDOFF">Handoffs</option>
          <option value="BUTTON_CLICKED">Button clicks</option>
          <option value="PAYMENT_LINK_CREATED">Payment links</option>
          <option value="PAYMENT_COMPLETED">Payments completed</option>
          <option value="AUTOMATION_WAITING">Waiting automations</option>
        </select>

        <select
          value={selectedDateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D8E6F3] bg-white text-[#081B3A] focus:outline-none"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>

        <button
          onClick={() => onSortOrderChange(sortOrder === "desc" ? "asc" : "desc")}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D8E6F3] bg-white text-[#526173] hover:bg-[#F0F8FF] transition"
        >
          {sortOrder === "desc" ? "Newest First ↓" : "Oldest First ↑"}
        </button>
      </div>
    </div>
  );
}
