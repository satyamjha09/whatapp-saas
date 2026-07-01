export type ProductionChecklistStatus = "complete" | "warning" | "pending";

export type ProductionChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: ProductionChecklistStatus;
  required: boolean;
  actionLabel: string;
  actionHref: string;
};

export type ProductionChecklistGroup = {
  title: string;
  description: string;
  items: ProductionChecklistItem[];
};

export function getChecklistStatusLabel(status: ProductionChecklistStatus) {
  if (status === "complete") return "Complete";
  if (status === "warning") return "Needs review";
  return "Pending";
}

export function getChecklistStatusClasses(status: ProductionChecklistStatus) {
  if (status === "complete") {
    return "bg-[#22C55E]/10 text-[#15803d] ring-[#22C55E]/25";
  }

  if (status === "warning") {
    return "bg-[#F8C830]/18 text-[#755b00] ring-[#F8C830]/35";
  }

  return "bg-[#E7F8EF] text-[#526173] ring-[#BFE9D0]";
}
