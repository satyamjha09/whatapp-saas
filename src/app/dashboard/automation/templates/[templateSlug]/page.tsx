"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Database,
  FileSpreadsheet,
  CreditCard,
  Sparkles,
  ShoppingBag,
  Play,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";
import AutomationGraphPreview from "@/components/automation-builder/automation-graph-preview";
import type { AutomationFlowTemplate } from "@/lib/automation-templates/template-types";

type TemplateDetailPageProps = {
  params: Promise<{
    templateSlug: string;
  }>;
};

type DbTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
};

export default function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const router = useRouter();
  const { templateSlug } = use(params);

  const [template, setTemplate] = useState<AutomationFlowTemplate | null>(null);
  const [dbTemplates, setDbTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal / Wizard state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flowName, setFlowName] = useState("");
  const [flowDesc, setFlowDesc] = useState("");
  const [keywordOverride, setKeywordOverride] = useState("");
  const [templateMappings, setTemplateMappings] = useState<Record<string, string>>({});
  const [integrationMappings, setIntegrationMappings] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch template detail
        const tRes = await fetch(`/api/automation/flow-templates/${templateSlug}`);
        if (!tRes.ok) {
          throw new Error("Failed to load template details.");
        }
        const tData = await tRes.json();
        setTemplate(tData.template);
        setFlowName(tData.template.name);
        setFlowDesc(tData.template.description);

        const startNode = tData.template.graph.nodes.find((n: { type: string }) => n.type === "START") as { data?: { keywords?: string[] } } | undefined;
        setKeywordOverride(startNode?.data?.keywords?.join(", ") || "");

        // 2. Fetch company templates for mapping selection
        const templatesRes = await fetch("/api/templates");
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setDbTemplates(templatesData.templates || []);
        }
      } catch (err: unknown) {
        const errorVal = err as Error;
        setError(errorVal.message || "An error occurred.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [templateSlug]);

  const handleUseTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setCreateError("");

      const res = await fetch(`/api/automation/flow-templates/${templateSlug}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: flowName,
          description: flowDesc,
          triggerKeyword: keywordOverride,
          templateMappings,
          integrationMappings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create flow draft.");
      }

      router.push(data.redirectUrl);
    } catch (err: unknown) {
      const errorVal = err as Error;
      setCreateError(errorVal.message || "An error occurred during instantiation.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-8 w-8 text-[#0052CC] animate-spin" />
        <p className="text-sm text-[#526173]">Loading template details...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold">Error loading template</h3>
          <p className="text-sm mt-1">{error || "Template not found."}</p>
          <Link href="/dashboard/automation/templates" className="mt-2 inline-block text-xs font-semibold underline">
            Back to Templates Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/automation/templates"
          className="flex items-center gap-2 text-sm font-semibold text-[#526173] hover:text-[#081B3A] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Library</span>
        </Link>

        <button
          onClick={() => setIsModalOpen(true)}
          className={actionButtonClass("primary")}
        >
          Use This Template
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Left Side: Detail & Documentation */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-[#D8E6F3] space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#0052CC] bg-[#F0F8FF] px-2.5 py-1 rounded">
                {template.category.replace("_", " ")}
              </span>
              <h1 className="text-2xl font-bold text-[#081B3A] mt-2">{template.name}</h1>
              <p className="text-sm text-[#526173] mt-2 leading-relaxed">{template.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div className="bg-[#F8FAFC] border border-[#D8E6F3] p-3 rounded-lg text-center">
                <span className="text-[11px] text-[#526173] uppercase font-bold tracking-wider block">Difficulty</span>
                <span className="text-sm font-bold text-[#081B3A] mt-1 block">{template.difficulty}</span>
              </div>
              <div className="bg-[#F8FAFC] border border-[#D8E6F3] p-3 rounded-lg text-center">
                <span className="text-[11px] text-[#526173] uppercase font-bold tracking-wider block">Setup Time</span>
                <span className="text-sm font-bold text-[#081B3A] mt-1 block">~{template.estimatedSetupMinutes} mins</span>
              </div>
              <div className="bg-[#F8FAFC] border border-[#D8E6F3] p-3 rounded-lg text-center">
                <span className="text-[11px] text-[#526173] uppercase font-bold tracking-wider block">Nodes count</span>
                <span className="text-sm font-bold text-[#081B3A] mt-1 block">{template.graph.nodes.length} nodes</span>
              </div>
            </div>
          </div>

          {/* Setup requirements */}
          <div className="bg-white p-6 rounded-xl border border-[#D8E6F3] space-y-5">
            <h2 className="text-base font-bold text-[#081B3A]">Required Configurations</h2>

            {template.requiredWhatsAppTemplates.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#526173]">Approved WhatsApp Message Templates</h3>
                {template.requiredWhatsAppTemplates.map((wt) => (
                  <div key={wt.key} className="bg-[#F8FAFC] border border-[#D8E6F3] p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#081B3A]">{wt.label}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-700">{wt.category}</span>
                    </div>
                    <p className="text-xs text-[#526173]">{wt.purpose}</p>
                    <div className="bg-slate-900/5 p-2 rounded text-[11px] font-mono text-slate-800 border border-slate-900/10">
                      {wt.exampleBody}
                    </div>
                    {wt.requiredVariables.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#081B3A]">Expected Variables:</p>
                        <div className="grid gap-1.5 grid-cols-2">
                          {wt.requiredVariables.map((v) => (
                            <span key={v.name} className="text-[11px] text-[#526173]">
                              • <strong className="text-slate-800">{v.name}</strong> ({v.description})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {template.requiredIntegrations.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#526173]">Third-Party Integrations</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {template.requiredIntegrations.map((req) => {
                    const Icon =
                      req.type === "GOOGLE_CONNECTION"
                        ? FileSpreadsheet
                        : req.type === "TALLY_CONNECTION"
                          ? Database
                          : req.type === "CASHFREE"
                            ? CreditCard
                            : req.type === "AI_AGENT"
                              ? Sparkles
                              : req.type === "CATALOG"
                                ? ShoppingBag
                                : Play;
                    return (
                      <div key={req.type} className="flex gap-3 bg-[#F8FAFC] border border-[#D8E6F3] p-4 rounded-xl">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F0F8FF] text-[#0052CC]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#081B3A]">{req.label}</p>
                          <p className="text-[11px] text-[#526173] mt-1 leading-relaxed">{req.description}</p>
                          {req.required ? (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-2 inline-block">
                              Required
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded mt-2 inline-block">
                              Optional
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Best For & How it works */}
          <div className="bg-white p-6 rounded-xl border border-[#D8E6F3] space-y-4">
            <h2 className="text-base font-bold text-[#081B3A]">Template Documentation</h2>
            <div>
              <h3 className="text-xs font-bold text-[#526173] uppercase tracking-wider">Best For</h3>
              <ul className="list-disc list-inside text-xs text-[#526173] mt-2 space-y-1">
                {template.bestFor.map((bf, idx) => (
                  <li key={idx}>{bf}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Side: Graph Canvas Preview & Chat Demo */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#D8E6F3] overflow-hidden flex flex-col h-[400px]">
            <div className="border-b border-[#D8E6F3] px-4 py-3 bg-[#F8FAFC]">
              <h3 className="text-sm font-bold text-[#081B3A]">Flow Graph Preview</h3>
            </div>
            <div className="flex-1 relative">
              <AutomationGraphPreview graph={template.graph} />
            </div>
          </div>

          {/* Example Chat Simulator */}
          <div className="bg-[#eee7dd] rounded-xl border border-[#D8E6F3] overflow-hidden flex flex-col h-[350px]">
            <div className="border-b border-[#D8E6F3] px-4 py-3 bg-[#128C7E] text-white">
              <h3 className="text-sm font-bold">Example Conversation Preview</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {template.exampleConversation.map((msg, index) => {
                if (msg.from === "system") {
                  return (
                    <div key={index} className="text-center text-[10px] text-slate-600 bg-white/70 rounded px-2 py-1 mx-auto w-fit shadow-xs">
                      {msg.text}
                    </div>
                  );
                }

                const isBiz = msg.from === "business";
                return (
                  <div
                    key={index}
                    className={`flex ${isBiz ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-2.5 text-xs shadow-xs whitespace-pre-wrap ${
                        isBiz ? "bg-white text-slate-800" : "bg-[#DCF8C6] text-slate-800"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Setup Wizard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[#D8E6F3]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h3 className="text-lg font-bold text-[#081B3A]">Setup Flow Wizard</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#526173] hover:text-[#081B3A] text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUseTemplate} className="mt-4 space-y-4">
              {createError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Flow Name */}
              <div>
                <label className="block text-xs font-bold text-[#081B3A] uppercase tracking-wider mb-1">
                  Flow Name *
                </label>
                <input
                  type="text"
                  required
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#D8E6F3] focus:outline-none focus:border-[#0052CC]"
                  placeholder="Enter flow draft name..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#081B3A] uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={flowDesc}
                  onChange={(e) => setFlowDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#D8E6F3] focus:outline-none focus:border-[#0052CC]"
                  placeholder="Describe this automation..."
                />
              </div>

              {/* Trigger keywords */}
              {keywordOverride !== "" && (
                <div>
                  <label className="block text-xs font-bold text-[#081B3A] uppercase tracking-wider mb-1">
                    Trigger Keyword *
                  </label>
                  <input
                    type="text"
                    required
                    value={keywordOverride}
                    onChange={(e) => setKeywordOverride(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D8E6F3] focus:outline-none focus:border-[#0052CC]"
                    placeholder="Enter keywords..."
                  />
                  <p className="text-[10px] text-[#526173] mt-1">
                    Matches incoming messages starting with these keywords (comma separated).
                  </p>
                </div>
              )}

              {/* Template mappings */}
              {template.requiredWhatsAppTemplates.length > 0 && (
                <div className="space-y-3 pt-1 border-t border-[#F1F5F9]">
                  <p className="text-xs font-bold text-[#081B3A] uppercase tracking-wider">
                    Map Approved WhatsApp Templates
                  </p>
                  {template.requiredWhatsAppTemplates.map((wt) => (
                    <div key={wt.key}>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Select template for {wt.label}
                      </label>
                      <select
                        value={templateMappings[wt.key] || ""}
                        onChange={(e) =>
                          setTemplateMappings((prev) => ({ ...prev, [wt.key]: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#D8E6F3] bg-white focus:outline-none"
                      >
                        <option value="">-- Choose Approved Template (Optional) --</option>
                        {dbTemplates.map((dbT) => (
                          <option key={dbT.id} value={dbT.id}>
                            {dbT.name} ({dbT.language}) - {dbT.status}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* Integrations mappings */}
              {template.requiredIntegrations.length > 0 && (
                <div className="space-y-3 pt-1 border-t border-[#F1F5F9]">
                  <p className="text-xs font-bold text-[#081B3A] uppercase tracking-wider">
                    Map Integrations Connections
                  </p>
                  {template.requiredIntegrations.map((ri) => (
                    <div key={ri.type}>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Connection ID for {ri.label}
                      </label>
                      <input
                        type="text"
                        value={integrationMappings[ri.type] || ""}
                        onChange={(e) =>
                          setIntegrationMappings((prev) => ({ ...prev, [ri.type]: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#D8E6F3] focus:outline-none"
                        placeholder="e.g. conn_10293848 (Optional)"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 text-sm font-semibold border border-[#D8E6F3] rounded-lg hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 text-sm font-semibold bg-[#0052CC] text-white rounded-lg hover:bg-[#0040A3] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{creating ? "Creating..." : "Create Flow Draft"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
