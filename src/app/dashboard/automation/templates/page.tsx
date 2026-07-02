"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Database, FileSpreadsheet, CreditCard, Sparkles, ShoppingBag, MessageSquare, Play, HelpCircle } from "lucide-react";
import { PageHeader } from "@/app/dashboard/dashboard-ui";
import { AUTOMATION_FLOW_TEMPLATES } from "@/lib/automation-templates/template-registry";
import type { AutomationFlowTemplateDifficulty } from "@/lib/automation-templates/template-types";

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Templates" },
  { value: "PAYMENTS", label: "Payments" },
  { value: "LEAD_GENERATION", label: "Lead Generation" },
  { value: "DEMO_BOOKING", label: "Demo/Bookings" },
  { value: "ORDER_STATUS", label: "Order Status" },
  { value: "CUSTOMER_SUPPORT", label: "Support" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "TALLY", label: "Tally" },
];

const DIFFICULTY_COLORS: Record<AutomationFlowTemplateDifficulty, string> = {
  BEGINNER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INTERMEDIATE: "bg-sky-50 text-sky-700 border-sky-200",
  ADVANCED: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function AutomationTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const filteredTemplates = useMemo(() => {
    return AUTOMATION_FLOW_TEMPLATES.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === "ALL" || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Templates"
        description="Start faster with ready-made WhatsApp automation flows."
        eyebrow="Automation"
      />

      {/* Filters & Search Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-[#D8E6F3]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#526173]" />
          <input
            type="text"
            placeholder="Search templates (e.g. payment, lead)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#D8E6F3] focus:outline-none focus:border-[#0052CC] bg-[#F8FAFC]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition border ${
                selectedCategory === cat.value
                  ? "bg-[#0052CC] text-white border-[#0052CC]"
                  : "bg-white text-[#526173] border-[#D8E6F3] hover:bg-[#F0F8FF]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of cards */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[#D8E6F3] text-center p-6">
          <HelpCircle className="h-12 w-12 text-[#526173] mb-3" />
          <h3 className="text-lg font-bold text-[#081B3A]">No templates found</h3>
          <p className="mt-1 text-sm text-[#526173] max-w-sm">
            We couldn&apos;t find any automation templates matching your search criteria. Try a different search query.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const diffColor = DIFFICULTY_COLORS[template.difficulty];

            return (
              <div
                key={template.slug}
                className="flex flex-col h-full bg-white rounded-xl border border-[#D8E6F3] shadow-sm hover:shadow-md transition duration-200 overflow-hidden"
              >
                {/* Header info */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#0052CC] bg-[#F0F8FF] px-2 py-1 rounded">
                      {template.category.replace("_", " ")}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${diffColor}`}>
                      {template.difficulty}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-[#081B3A] line-clamp-1">
                      {template.name}
                    </h3>
                    <p className="text-xs text-[#526173] line-clamp-3 leading-relaxed">
                      {template.description}
                    </p>
                  </div>

                  {/* Badges / Stats */}
                  <div className="flex items-center gap-4 text-[11px] text-[#526173] pt-1">
                    <span>⏱ {template.estimatedSetupMinutes} mins setup</span>
                    <span>🧩 {template.graph.nodes.length} nodes</span>
                  </div>

                  {/* Required connections */}
                  {template.requiredIntegrations.length > 0 || template.requiredWhatsAppTemplates.length > 0 ? (
                    <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                      <p className="text-[10px] font-bold text-[#081B3A] uppercase tracking-wider">
                        Requires Setup
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {template.requiredWhatsAppTemplates.map((wt) => (
                          <div
                            key={wt.key}
                            className="flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>{wt.label}</span>
                          </div>
                        ))}
                        {template.requiredIntegrations.map((integration) => {
                          const Icon =
                            integration.type === "GOOGLE_CONNECTION"
                              ? FileSpreadsheet
                              : integration.type === "TALLY_CONNECTION"
                                ? Database
                                : integration.type === "CASHFREE"
                                  ? CreditCard
                                  : integration.type === "AI_AGENT"
                                    ? Sparkles
                                    : integration.type === "CATALOG"
                                      ? ShoppingBag
                                      : Play;
                          return (
                            <div
                              key={integration.type}
                              className="flex items-center gap-1 text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full"
                            >
                              <Icon className="h-3 w-3" />
                              <span>{integration.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Footer Buttons */}
                <div className="bg-[#F8FAFC] border-t border-[#D8E6F3] p-4 flex gap-3">
                  <Link
                    href={`/dashboard/automation/templates/${template.slug}`}
                    className="flex-1 text-center py-2 text-xs font-semibold bg-white border border-[#D8E6F3] text-[#081B3A] rounded-lg hover:bg-[#F0F8FF] transition"
                  >
                    Preview Flow
                  </Link>
                  <Link
                    href={`/dashboard/automation/templates/${template.slug}`}
                    className="flex-1 text-center py-2 text-xs font-semibold bg-[#0052CC] text-white rounded-lg hover:bg-[#0040A3] transition shadow-sm"
                  >
                    Use Template
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
