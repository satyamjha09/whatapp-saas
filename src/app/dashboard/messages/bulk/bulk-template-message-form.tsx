"use client";

import { CheckCircle2, FileUp, LoaderCircle, Send, FileSpreadsheet, Grid3X3, Filter, Target, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import WhatsAppMessagePreview from "../whatsapp-message-preview";

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  body: string;
  variables: string[];
};

type Recipient = {
  countryCode: string;
  phoneNumber: string;
  name?: string;
  bodyParameters: string[];
};

type ContactGroup = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  _count: { members: number };
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  template: {
    name: string;
  };
};

type MessageRecord = {
  id: string;
  toPhoneNumber: string;
  body: string;
  createdAt: string;
  status: string;
  direction: string;
  errorCode: string | null;
  errorMessage: string | null;
  metaMessageId: string | null;
  contact?: {
    name: string | null;
    phoneNumber: string;
    countryCode: string;
  } | null;
  template?: {
    name: string;
  } | null;
  campaign?: {
    name: string;
  } | null;
};

type SendResponse = {
  message?: string;
  result?: {
    batchId: string;
    requestedCount: number;
    queuedCount: number;
    failedCount: number;
    skippedDuplicateCount: number;
    skippedBlockedCount: number;
    scheduledAt: string | null;
    status: string;
    contactGroupId: string | null;
    contactGroupName: string | null;
  };
  errors?: {
    templateId?: string[];
    recipients?: string[];
    segmentId?: string[];
    bodyParameters?: string[];
  };
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let insideQuotes = false;
  const normalizedText = text.replace(/^\uFEFF/, "");

  function finishRow() {
    row.push(field.trim());

    if (row.some((value) => value.length > 0)) rows.push(row);

    row = [];
    field = "";
  }

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];
    const nextCharacter = normalizedText[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  if (insideQuotes) throw new Error("CSV contains an unclosed quoted value");
  if (field.length || row.length) finishRow();

  return rows;
}

function parseRecipients(text: string): Recipient[] {
  const rows = parseCsv(text);
  const firstRow = rows[0]?.map((value) =>
    value.toLowerCase().replace(/[\s_]/g, ""),
  );
  const hasHeader =
    firstRow?.[0] === "countrycode" && firstRow?.[1] === "phonenumber";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => {
    const [countryCode = "", phoneNumber = "", name = "", ...parameters] =
      row;

    return {
      countryCode,
      phoneNumber,
      name: name || undefined,
      bodyParameters: parameters,
    };
  });
}

function HelpAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-l-[3px] border-purple-800 bg-[#FAF9FB] rounded-r-xl border border-y border-r border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-100/50"
      >
        <span className="flex items-center gap-2">
          <span className="text-purple-850 text-xs font-semibold">{isOpen ? "▼" : "▶"}</span>
          {title}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 bg-white p-4 text-xs leading-relaxed text-gray-600 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

export default function BulkTemplateMessageForm({
  canManage,
  campaigns,
  groups,
  initialGroupId,
  templates,
  plan,
}: {
  canManage: boolean;
  campaigns: Campaign[];
  groups: ContactGroup[];
  initialGroupId?: string;
  templates: Template[];
  plan: {
    name: string;
    maxBulkRecipients: number;
    subscriptionStatus: string;
    currentPeriodEnd: string | null;
    isSubscriptionActive: boolean;
    cancelAtPeriodEnd: boolean;
  };
}) {
  const [sendMode, setSendMode] = useState<"CSV" | "GRID" | "GROUP" | "RETARGET">(
    initialGroupId ? "GROUP" : "CSV",
  );

  // Core Inputs
  const [campaignName, setCampaignName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [recipientsText, setRecipientsText] = useState(
    "countryCode,phoneNumber,name,param1,param2",
  );
  const [fallbackParameters, setFallbackParameters] = useState<string[]>(
    templates[0]?.variables.map(() => "") ?? [],
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [groupId, setGroupId] = useState(initialGroupId ?? "");

  // Interactive Manual Grid State
  const [gridContacts, setGridContacts] = useState<Recipient[]>([
    { countryCode: "91", phoneNumber: "", name: "", bodyParameters: [] }
  ]);

  // Stepper & Advanced Filtering for Re-Targeting
  const [retargetStep, setRetargetStep] = useState<1 | 2>(1);
  const [filterCampaignId, setFilterCampaignId] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterTemplateId, setFilterTemplateId] = useState("");
  const [filterMessageType, setFilterMessageType] = useState("");
  const [filterMessageStatus, setFilterMessageStatus] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterHasError, setFilterHasError] = useState("");
  const [filterErrorCode, setFilterErrorCode] = useState("");
  const [filterWhatsAppId, setFilterWhatsAppId] = useState("");
  const [filterSystemId, setFilterSystemId] = useState("");

  const [filteredMessages, setFilteredMessages] = useState<MessageRecord[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [filteredPage, setFilteredPage] = useState(1);
  const [isFiltering, setIsFiltering] = useState(false);

  // Common UI states
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [batchId, setBatchId] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Template change triggers variable updates
  const selectedTemplate = useMemo(() => {
    return templates.find((template) => template.id === templateId);
  }, [templateId, templates]);

  function chooseTemplate(newTemplateId: string) {
    setTemplateId(newTemplateId);
    const template = templates.find((t) => t.id === newTemplateId);
    const vars = template?.variables.map(() => "") ?? [];
    setFallbackParameters(vars);

    // Adjust parameters in manual grid contacts
    const varCount = template?.variables.length ?? 0;
    setGridContacts((prev) =>
      prev.map((c) => {
        const params = [...c.bodyParameters];
        if (params.length < varCount) {
          while (params.length < varCount) params.push("");
        } else if (params.length > varCount) {
          params.splice(varCount);
        }
        return { ...c, bodyParameters: params };
      })
    );
  }

  function updateFallbackParameter(index: number, value: string) {
    setFallbackParameters((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }

  // Handle CSV parser
  const parsedCsv = useMemo(() => {
    try {
      return { recipients: parseRecipients(recipientsText), error: "" };
    } catch (parseError) {
      return {
        recipients: [] as Recipient[],
        error: parseError instanceof Error ? parseError.message : "Invalid CSV",
      };
    }
  }, [recipientsText]);

  const csvRecipients = parsedCsv.recipients;

  const uniqueCsvRecipientCount = useMemo(() => {
    return new Set(
      csvRecipients.map((recipient) => {
        return `${recipient.countryCode.replace(/\D/g, "")}${recipient.phoneNumber.replace(/\D/g, "")}`;
      }),
    ).size;
  }, [csvRecipients]);

  const selectedGroup = useMemo(() => {
    return groups.find((group) => group.id === groupId);
  }, [groupId, groups]);

  // Recipient Count resolver for Plan Verification
  const activeRecipientCount = useMemo(() => {
    if (sendMode === "RETARGET") return filteredTotal;
    if (sendMode === "GROUP") return selectedGroup?._count.members ?? 0;
    if (sendMode === "GRID") return gridContacts.length;
    return uniqueCsvRecipientCount;
  }, [sendMode, filteredTotal, selectedGroup, gridContacts, uniqueCsvRecipientCount]);

  const isWithinPlanLimit = activeRecipientCount <= plan.maxBulkRecipients;
  const isPlanReady = plan.isSubscriptionActive && isWithinPlanLimit;

  // Add & Delete rows inside Manual Grid
  function addGridRow() {
    const varCount = selectedTemplate?.variables.length ?? 0;
    const bodyParams = Array(varCount).fill("");
    setGridContacts((prev) => [
      ...prev,
      { countryCode: "91", phoneNumber: "", name: "", bodyParameters: bodyParams }
    ]);
  }

  function deleteGridRow(index: number) {
    if (gridContacts.length <= 1) return;
    setGridContacts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateGridContact(index: number, field: keyof Recipient, val: string) {
    setGridContacts((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: val
      };
      return updated;
    });
  }

  // Handle messages API fetching for retarget filters
  async function handleApplyFilters(page = 1) {
    setIsFiltering(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (filterCampaignId) query.set("campaignId", filterCampaignId);
      if (filterStartDate) query.set("startDate", filterStartDate);
      if (filterEndDate) query.set("endDate", filterEndDate);
      if (filterTemplateId) query.set("templateId", filterTemplateId);
      if (filterMessageType) query.set("direction", filterMessageType);
      if (filterMessageStatus) query.set("status", filterMessageStatus);
      if (filterTo) query.set("to", filterTo);
      if (filterHasError) query.set("hasError", filterHasError === "YES" ? "true" : "false");
      if (filterErrorCode) query.set("errorCode", filterErrorCode);
      if (filterWhatsAppId) query.set("metaMessageId", filterWhatsAppId);
      if (filterSystemId) query.set("id", filterSystemId);

      query.set("limit", "15");
      query.set("page", String(page));

      const response = await fetch(`/api/messages?${query.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch filtered messages");

      setFilteredMessages(data.messages || []);
      setFilteredTotal(data.totalCount || 0);
      setFilteredPage(page);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to filter messages";
      setError(msg);
    } finally {
      setIsFiltering(false);
    }
  }

  function handleResetFilters() {
    setFilterCampaignId("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterTemplateId("");
    setFilterMessageType("");
    setFilterMessageStatus("");
    setFilterTo("");
    setFilterHasError("");
    setFilterErrorCode("");
    setFilterWhatsAppId("");
    setFilterSystemId("");
    setFilteredMessages([]);
    setFilteredTotal(0);
    setFilteredPage(1);
  }

  // File upload handler
  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setRecipientsText(await file.text());
    } catch {
      setError("Unable to read the selected CSV file.");
    } finally {
      event.target.value = "";
    }
  }

  // Queue bulk template messages handler
  async function sendBulkMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBatchId("");

    if (sendMode === "CSV" && parsedCsv.error) {
      setError(parsedCsv.error);
      return;
    }
    if (sendMode === "GROUP" && !groupId) {
      setError("Select a contact group.");
      return;
    }
    if (sendMode === "RETARGET" && filteredTotal === 0) {
      setError("No recipients selected from filters.");
      return;
    }

    setIsSending(true);

    try {
      let finalRecipients: Recipient[] = [];

      if (sendMode === "CSV") {
        finalRecipients = csvRecipients;
      } else if (sendMode === "GRID") {
        // Validation check for empty numbers
        const invalid = gridContacts.some(c => !c.phoneNumber.trim());
        if (invalid) {
          throw new Error("Phone number cannot be empty in manual grid rows.");
        }
        finalRecipients = gridContacts;
      } else if (sendMode === "RETARGET") {
        // Fetch all matching message phone numbers to compile the recipient list
        const query = new URLSearchParams();
        if (filterCampaignId) query.set("campaignId", filterCampaignId);
        if (filterStartDate) query.set("startDate", filterStartDate);
        if (filterEndDate) query.set("endDate", filterEndDate);
        if (filterTemplateId) query.set("templateId", filterTemplateId);
        if (filterMessageType) query.set("direction", filterMessageType);
        if (filterMessageStatus) query.set("status", filterMessageStatus);
        if (filterTo) query.set("to", filterTo);
        if (filterHasError) query.set("hasError", filterHasError === "YES" ? "true" : "false");
        if (filterErrorCode) query.set("errorCode", filterErrorCode);
        if (filterWhatsAppId) query.set("metaMessageId", filterWhatsAppId);
        if (filterSystemId) query.set("id", filterSystemId);
        query.set("limit", "10000"); // safe limit for query compilation

        const response = await fetch(`/api/messages?${query.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to compile retargeting audience list");

        const records = (data.messages || []) as MessageRecord[];
        finalRecipients = records.map((m) => ({
          countryCode: m.contact?.countryCode || "91",
          phoneNumber: m.contact?.phoneNumber || m.toPhoneNumber,
          name: m.contact?.name || undefined,
          bodyParameters: [], // uses fallback parameters selected in form step
        }));

        if (finalRecipients.length === 0) {
          throw new Error("Selected retarget filters match zero contacts.");
        }
      }

      const fallbackPayload = fallbackParameters.every(
        (value) => value.trim().length === 0,
      )
        ? []
        : fallbackParameters;

      const response = await fetch("/api/messages/bulk-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campaignName.trim() || undefined,
          templateId,
          groupId: sendMode === "GROUP" ? groupId : null,
          recipients: sendMode !== "GROUP" ? finalRecipients : [],
          bodyParameters: fallbackPayload,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });

      const data = (await response.json()) as SendResponse;

      if (!response.ok) {
        const firstError =
          data.errors?.templateId?.[0] ??
          data.errors?.recipients?.[0] ??
          data.errors?.bodyParameters?.[0] ??
          data.message ??
          "Unable to queue bulk messages.";
        setError(firstError);
        return;
      }

      setSuccess(
        data.result?.status === "SCHEDULED"
          ? `Scheduled ${data.result.queuedCount} message(s). ${data.result.skippedDuplicateCount} duplicate(s) and ${data.result.skippedBlockedCount} blocked contact(s) skipped.`
          : `Queued ${data.result?.queuedCount ?? 0} message(s). ${data.result?.failedCount ?? 0} failed, ${data.result?.skippedDuplicateCount ?? 0} duplicate(s) and ${data.result?.skippedBlockedCount ?? 0} blocked contact(s) skipped.`
      );
      setBatchId(data.result?.batchId ?? "");

      // Reset Form fields
      setCampaignName("");
      setGridContacts([{ countryCode: "91", phoneNumber: "", name: "", bodyParameters: Array(selectedTemplate?.variables.length ?? 0).fill("") }]);
      if (sendMode === "RETARGET") {
        setRetargetStep(1);
        handleResetFilters();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }

  const TABS = [
    { id: "CSV", label: "CSV Upload", icon: FileSpreadsheet },
    { id: "GRID", label: "Manual Grid", icon: Grid3X3 },
    { id: "GROUP", label: "Contact Filters", icon: Filter },
    { id: "RETARGET", label: "Re-Targeting", icon: Target },
  ] as const;

  if (templates.length === 0) {
    return (
      <Panel>
        <PanelTitle
          title="Send Bulk Messages"
          description="Create campaign batches with approved templates."
        />
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          No approved WhatsApp templates found in this workspace. Sync or create templates first.
        </p>
        <Link href="/dashboard/templates" className={`${actionButtonClass()} mt-5`}>
          Open Templates
        </Link>
      </Panel>
    );
  }

  return (
    <Panel>
      {/* High Fidelity Tab Bar on Top */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = sendMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSendMode(tab.id);
                  setError("");
                  setSuccess("");
                }}
                className={`group flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-semibold transition ${
                  isActive
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <TabIcon className={`h-4.5 w-4.5 ${isActive ? "text-emerald-600" : "text-gray-400 group-hover:text-gray-500"}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <form onSubmit={sendBulkMessage} className="mt-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {/* Plan Usage Limit Badge */}
            <div className={`rounded-xl border p-4 ${isPlanReady ? "border-[#BFE9D0] bg-[#E7F8EF]" : "border-rose-200 bg-rose-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#526173]">{plan.name} plan status</p>
                  <p className="mt-1 text-xl font-bold text-[#081B3A]">{activeRecipientCount.toLocaleString("en-IN")} / {plan.maxBulkRecipients.toLocaleString("en-IN")}</p>
                  <p className="mt-1 text-xs text-[#526173]">{plan.subscriptionStatus}</p>
                  {plan.cancelAtPeriodEnd ? (
                    <p className="mt-1 text-xs font-medium text-[#7A5A00]">Cancels at period end</p>
                  ) : null}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isPlanReady ? "bg-[#22C55E]/10 text-[#15803d]" : "bg-rose-100 text-rose-700"}`}>
                  {!plan.isSubscriptionActive ? "Renew plan" : isWithinPlanLimit ? "Within limit" : "Limit exceeded"}
                </span>
              </div>
            </div>

            {/* TAB CONTENT PANELS */}

            {/* 1. CSV UPLOAD TAB */}
            {sendMode === "CSV" && (
              <>
                <HelpAccordion title="How to use CSV Upload?">
                  <p>1. Download the sample CSV to understand the required headers format.</p>
                  <p>2. Column headers must include <strong>countryCode</strong> and <strong>phoneNumber</strong>.</p>
                  <p>3. Dynamic parameter columns must start from column 4 (e.g. <strong>param1</strong>, <strong>param2</strong>).</p>
                  <p>4. Upload your file, verify details in the preview table below, and send.</p>
                </HelpAccordion>

                <div>
                  <label htmlFor="csvCampaignName" className={labelClass}>
                    Campaign Name
                  </label>
                  <input
                    id="csvCampaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="E.g. July Newsletter Batch 1"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="csvTemplateId" className={labelClass}>
                    Approved template
                  </label>
                  <select
                    id="csvTemplateId"
                    value={templateId}
                    onChange={(event) => chooseTemplate(event.target.value)}
                    required
                    className={fieldClass}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {template.language} · {template.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="csvUpload" className={labelClass}>
                    Upload CSV
                  </label>
                  <label
                    htmlFor="csvUpload"
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#128C7E]/35 bg-[#E7F8EF] px-4 py-5 text-sm font-semibold text-[#128C7E] transition hover:border-[#128C7E]"
                  >
                    <FileUp className="h-5 w-5" />
                    Choose CSV file
                  </label>
                  <input
                    id="csvUpload"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvUpload}
                    className="sr-only"
                  />
                  <p className={helperTextClass}>
                    Columns: countryCode, phoneNumber, name, param1, param2. Maximum 2 MB.
                  </p>
                </div>

                <div>
                  <label htmlFor="recipients" className={labelClass}>
                    CSV recipients
                  </label>
                  <textarea
                    id="recipients"
                    value={recipientsText}
                    onChange={(event) => setRecipientsText(event.target.value)}
                    rows={10}
                    required
                    placeholder={`countryCode,phoneNumber,name,param1,param2\n91,8178444398,Satyam,Satyam,Order #1001`}
                    className={fieldClass}
                  />
                  <p className={helperTextClass}>
                    Parsed: {csvRecipients.length}; unique: {uniqueCsvRecipientCount}; plan maximum {plan.maxBulkRecipients.toLocaleString("en-IN")} recipients.
                  </p>
                  {parsedCsv.error ? (
                    <p className="mt-2 text-sm text-rose-700">{parsedCsv.error}</p>
                  ) : null}
                </div>
              </>
            )}

            {/* 2. MANUAL GRID TAB */}
            {sendMode === "GRID" && (
              <>
                <HelpAccordion title="How to use Manual Grid?">
                  <p>1. Type recipient numbers manually inside the interactive grid rows.</p>
                  <p>2. Grid columns adjust dynamically to include fields for every template variable.</p>
                  <p>3. Press the <strong>+ Add Row</strong> button to append new rows.</p>
                </HelpAccordion>

                <div>
                  <label htmlFor="gridCampaignName" className={labelClass}>
                    Campaign Name
                  </label>
                  <input
                    id="gridCampaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="E.g. VIP Personal Outbounds"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="gridTemplateId" className={labelClass}>
                    Approved template
                  </label>
                  <select
                    id="gridTemplateId"
                    value={templateId}
                    onChange={(event) => chooseTemplate(event.target.value)}
                    required
                    className={fieldClass}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {template.language} · {template.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#BFE9D0] bg-white">
                  <div className="border-b border-[#BFE9D0] bg-[#E7F8EF] px-4 py-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-[#081B3A]">Manual Contact Grid</p>
                    <button
                      type="button"
                      onClick={addGridRow}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Row
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-[#FAF9FB] text-xs font-semibold uppercase text-[#526173] border-b border-[#BFE9D0]">
                        <tr>
                          <th className="px-4 py-3 w-20">Code</th>
                          <th className="px-4 py-3 w-44">Phone Number</th>
                          <th className="px-4 py-3 w-40">Recipient Name</th>
                          {selectedTemplate?.variables.map((v) => (
                            <th key={v} className="px-4 py-3">{v} (Variable)</th>
                          ))}
                          <th className="px-4 py-3 w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#BFE9D0]">
                        {gridContacts.map((contact, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={contact.countryCode}
                                onChange={(e) => updateGridContact(idx, "countryCode", e.target.value)}
                                placeholder="91"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="tel"
                                value={contact.phoneNumber}
                                onChange={(e) => updateGridContact(idx, "phoneNumber", e.target.value)}
                                placeholder="8178444398"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={contact.name || ""}
                                onChange={(e) => updateGridContact(idx, "name", e.target.value)}
                                placeholder="John Doe"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                              />
                            </td>
                            {selectedTemplate?.variables.map((variable, varIdx) => (
                              <td key={variable} className="px-3 py-2">
                                <input
                                  type="text"
                                  value={contact.bodyParameters[varIdx] ?? ""}
                                  onChange={(e) => {
                                    const updated = [...gridContacts];
                                    const params = [...updated[idx].bodyParameters];
                                    params[varIdx] = e.target.value;
                                    updated[idx].bodyParameters = params;
                                    setGridContacts(updated);
                                  }}
                                  placeholder={`Value for ${variable}`}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                                />
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                disabled={gridContacts.length <= 1}
                                onClick={() => deleteGridRow(idx)}
                                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 3. CONTACT FILTERS TAB */}
            {sendMode === "GROUP" && (
              <>
                <HelpAccordion title="How to use Contact Filters?">
                  <p>1. Choose a pre-defined static or dynamic group from the dropdown below.</p>
                  <p>2. The campaign will target all active group members automatically.</p>
                  <p>3. Opt-out limits and message templates apply normally.</p>
                </HelpAccordion>

                <div>
                  <label htmlFor="groupCampaignName" className={labelClass}>
                    Campaign Name
                  </label>
                  <input
                    id="groupCampaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="E.g. Group Promo Launch"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="groupTemplateId" className={labelClass}>
                    Approved template
                  </label>
                  <select
                    id="groupTemplateId"
                    value={templateId}
                    onChange={(event) => chooseTemplate(event.target.value)}
                    required
                    className={fieldClass}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {template.language} · {template.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="groupId" className={labelClass}>
                    Contact group
                  </label>
                  <select
                    id="groupId"
                    value={groupId}
                    onChange={(event) => setGroupId(event.target.value)}
                    required
                    className={fieldClass}
                  >
                    <option value="">Select a group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} · {group._count.members} contact(s)
                      </option>
                    ))}
                  </select>
                  {selectedGroup ? (
                    <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#BFE9D0] bg-white p-4">
                      <span
                        className="mt-1 h-4 w-4 shrink-0 rounded-full"
                        style={{ backgroundColor: selectedGroup.color ?? "#128C7E" }}
                      />
                      <div>
                        <p className="text-sm font-bold text-[#081B3A]">{selectedGroup.name}</p>
                        <p className="mt-1 text-xs text-[#526173]">{selectedGroup.description || "No description"}</p>
                        <p className="mt-2 text-xs font-semibold text-[#081B3A]">
                          {selectedGroup._count.members} contact(s) will be evaluated; blocked contacts will be skipped.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {groups.length === 0 ? (
                    <p className="mt-2 text-sm text-amber-700">
                      No groups found. Create one from Contacts → Contact Groups.
                    </p>
                  ) : null}
                </div>
              </>
            )}

            {/* 4. RE-TARGETING TAB */}
            {sendMode === "RETARGET" && (
              <>
                {/* Wizard Stepper */}
                <div className="flex items-center gap-6 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${retargetStep === 1 ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"}`}>1</span>
                    <div>
                      <span className={`block text-xs font-semibold ${retargetStep === 1 ? "text-gray-900" : "text-gray-500"}`}>Filter Messages</span>
                      <span className="block text-[10px] text-gray-400">filter-step</span>
                    </div>
                  </div>
                  <div className="h-px bg-gray-200 flex-1" />
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${retargetStep === 2 ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"}`}>2</span>
                    <div>
                      <span className={`block text-xs font-semibold ${retargetStep === 2 ? "text-gray-900" : "text-gray-500"}`}>Campaign Setup</span>
                      <span className="block text-[10px] text-gray-400">campaign-step</span>
                    </div>
                  </div>
                </div>

                <HelpAccordion title="How to Retarget to existing numbers? Click to expand">
                  <p>1. Apply filters to narrow down messages (e.g. status FAILED or READ without replies).</p>
                  <p>2. The stepper will guide you to Campaign Setup once target numbers are compiled.</p>
                  <p>3. Double-check counts to verify audience size matches your plan limits.</p>
                </HelpAccordion>

                {retargetStep === 1 ? (
                  <>
                    {/* Filters Form Card */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <span className="text-sm font-bold text-gray-800">Filters</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplyFilters(1)}
                            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Campaign</label>
                          <select
                            value={filterCampaignId}
                            onChange={(e) => setFilterCampaignId(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          >
                            <option value="">Select campaign</option>
                            {campaigns.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Date Range Start</label>
                          <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Date Range End</label>
                          <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Template</label>
                          <select
                            value={filterTemplateId}
                            onChange={(e) => setFilterTemplateId(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          >
                            <option value="">Select template</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Message Type</label>
                          <select
                            value={filterMessageType}
                            onChange={(e) => setFilterMessageType(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          >
                            <option value="">Select type</option>
                            <option value="OUTBOUND">Outbound</option>
                            <option value="INBOUND">Inbound</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Message Status</label>
                          <select
                            value={filterMessageStatus}
                            onChange={(e) => setFilterMessageStatus(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          >
                            <option value="">Select status</option>
                            <option value="QUEUED">Queued</option>
                            <option value="SENT">Sent</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="READ">Read</option>
                            <option value="FAILED">Failed</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
                          <input
                            type="text"
                            value={filterTo}
                            onChange={(e) => setFilterTo(e.target.value)}
                            placeholder="Search by recipient"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Has Error</label>
                          <select
                            value={filterHasError}
                            onChange={(e) => setFilterHasError(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          >
                            <option value="">Error status</option>
                            <option value="YES">Yes</option>
                            <option value="NO">No</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Error Code</label>
                          <input
                            type="text"
                            value={filterErrorCode}
                            onChange={(e) => setFilterErrorCode(e.target.value)}
                            placeholder="Search error code"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp ID</label>
                          <input
                            type="text"
                            value={filterWhatsAppId}
                            onChange={(e) => setFilterWhatsAppId(e.target.value)}
                            placeholder="Search WhatsApp ID"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">System ID</label>
                          <input
                            type="text"
                            value={filterSystemId}
                            onChange={(e) => setFilterSystemId(e.target.value)}
                            placeholder="Search System ID"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-black"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Results Stepper Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 w-40 text-left">
                        <span className="block text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Total</span>
                        <span className="block text-xl font-black text-emerald-950 mt-1">{filteredTotal}</span>
                      </div>
                      <button
                        type="button"
                        disabled={filteredTotal === 0}
                        onClick={() => setRetargetStep(2)}
                        className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next: Setup Campaign
                      </button>
                    </div>

                    {/* Filtered Messages Results List */}
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">Messages Found</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={filteredPage <= 1 || isFiltering}
                            onClick={() => handleApplyFilters(filteredPage - 1)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <span className="text-xs py-1 text-gray-500">Page {filteredPage}</span>
                          <button
                            type="button"
                            disabled={filteredMessages.length < 15 || isFiltering}
                            onClick={() => handleApplyFilters(filteredPage + 1)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        {isFiltering ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <LoaderCircle className="h-6 w-6 animate-spin text-emerald-600" />
                            <span className="text-xs text-gray-500">Loading messages...</span>
                          </div>
                        ) : filteredMessages.length === 0 ? (
                          <div className="text-center py-10 text-xs text-gray-400">
                            Apply filters above to find matching messages.
                          </div>
                        ) : (
                          <table className="w-full min-w-[700px] text-left text-sm">
                            <thead className="bg-[#FAF9FB] text-xs font-semibold uppercase text-[#526173] border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-3">To</th>
                                <th className="px-4 py-3">Creation Time</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Message</th>
                                <th className="px-4 py-3">Last Status</th>
                                <th className="px-4 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                              {filteredMessages.map((m) => (
                                <tr key={m.id}>
                                  <td className="px-4 py-3 font-medium">
                                    {m.contact?.name ? `${m.contact.name} (${m.toPhoneNumber})` : m.toPhoneNumber}
                                  </td>
                                  <td className="px-4 py-3 text-gray-500">
                                    {new Date(m.createdAt).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block rounded px-1.5 py-0.5 font-bold ${m.direction === "OUTBOUND" ? "bg-emerald-50 text-emerald-700" : "bg-teal-50 text-teal-700"}`}>
                                      {m.direction}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 max-w-[200px] truncate text-gray-600" title={m.body}>
                                    {m.body}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block rounded px-1.5 py-0.5 font-bold ${
                                      m.status === "READ" ? "bg-green-50 text-green-700" :
                                      m.status === "DELIVERED" ? "bg-indigo-50 text-indigo-700" :
                                      m.status === "FAILED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                                    }`}>
                                      {m.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-400">—</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Step 2 Form Setup */}
                    <div>
                      <label htmlFor="retargetCampaignName" className={labelClass}>
                        Campaign Name
                      </label>
                      <input
                        id="retargetCampaignName"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="E.g. Re-engagement promo campaign"
                        required
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="retargetTemplateId" className={labelClass}>
                        Approved template
                      </label>
                      <select
                        id="retargetTemplateId"
                        value={templateId}
                        onChange={(event) => chooseTemplate(event.target.value)}
                        required
                        className={fieldClass}
                      >
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} · {template.language} · {template.category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-3 justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => setRetargetStep(1)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                      >
                        Back to Filters
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Template Fallback variables */}
            {sendMode !== "RETARGET" && selectedTemplate?.variables.map((variable, index) => (
              <div key={`${selectedTemplate.id}-${variable}`}>
                <label htmlFor={`fallback-parameter-${index}`} className={labelClass}>
                  Fallback parameter {variable}
                </label>
                <input
                  id={`fallback-parameter-${index}`}
                  value={fallbackParameters[index] ?? ""}
                  onChange={(event) => updateFallbackParameter(index, event.target.value)}
                  className={fieldClass}
                />
                <p className={helperTextClass}>
                  Used only for rows without parameter columns.
                </p>
              </div>
            ))}

            {/* Recipient preview for CSV mode */}
            {sendMode === "CSV" && csvRecipients.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-[#BFE9D0]">
                <div className="border-b border-[#BFE9D0] bg-[#E7F8EF] px-4 py-3">
                  <p className="text-sm font-bold text-[#081B3A]">
                    Recipient preview
                  </p>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="sticky top-0 bg-white text-xs uppercase text-[#526173]">
                      <tr>
                        <th className="px-4 py-3">Country</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Parameters</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#BFE9D0]">
                      {csvRecipients.slice(0, 20).map((recipient, index) => (
                        <tr
                          key={`${recipient.countryCode}-${recipient.phoneNumber}-${index}`}
                        >
                          <td className="px-4 py-3">{recipient.countryCode}</td>
                          <td className="px-4 py-3">{recipient.phoneNumber}</td>
                          <td className="px-4 py-3">{recipient.name || "—"}</td>
                          <td className="px-4 py-3 text-[#526173]">
                            {recipient.bodyParameters.length
                              ? recipient.bodyParameters
                                  .map((value) => value || "(empty)")
                                  .join(" · ")
                              : "Fallback parameters"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvRecipients.length > 20 ? (
                  <p className="border-t border-[#BFE9D0] bg-[#E7F8EF] px-4 py-3 text-xs text-[#526173]">
                    Showing the first 20 recipients.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Common scheduler section */}
            {(sendMode !== "RETARGET" || retargetStep === 2) && (
              <div>
                <label htmlFor="scheduledAt" className={labelClass}>
                  Schedule date &amp; time
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className={fieldClass}
                />
                <p className={helperTextClass}>Leave empty to send immediately.</p>
              </div>
            )}

            {/* Error notifications */}
            {!canManage ? (
              <p className="rounded-xl border border-[#F8C830]/40 bg-[#F8C830]/15 p-3 text-sm text-[#102040]">
                Only workspace owners and admins can send bulk messages.
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 p-3 text-sm text-[#15803d]">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </p>
                {batchId ? (
                  <Link
                    href={`/dashboard/campaigns/${batchId}`}
                    className="mt-2 inline-block font-semibold underline underline-offset-2"
                  >
                    View campaign batch
                  </Link>
                ) : null}
              </div>
            ) : null}

            {/* Common Submit Queue button */}
            {(sendMode !== "RETARGET" || retargetStep === 2) && (
              <button
                type="submit"
                disabled={
                  !canManage ||
                  isSending ||
                  !plan.isSubscriptionActive ||
                  (sendMode === "CSV" &&
                    (csvRecipients.length === 0 ||
                      uniqueCsvRecipientCount > plan.maxBulkRecipients ||
                      Boolean(parsedCsv.error))) ||
                  (sendMode === "GRID" &&
                    (gridContacts.length === 0 || !isWithinPlanLimit)) ||
                  (sendMode === "GROUP" && (!groupId || !isWithinPlanLimit)) ||
                  (sendMode === "RETARGET" && (filteredTotal === 0 || !isWithinPlanLimit))
                }
                className={actionButtonClass()}
              >
                {isSending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isSending ? "Queueing..." : "Queue Bulk Messages"}
              </button>
            )}
          </div>

          <WhatsAppMessagePreview
            recipientLabel={
              sendMode === "GROUP"
                ? selectedGroup
                  ? `Group - ${selectedGroup.name}`
                  : "Group audience"
                : sendMode === "RETARGET"
                  ? `${filteredTotal.toLocaleString("en-IN")} retargeted contact(s)`
                  : sendMode === "GRID"
                    ? `${gridContacts.length} Manual recipient(s)`
                    : `${uniqueCsvRecipientCount.toLocaleString("en-IN")} CSV recipient(s)`
            }
            template={selectedTemplate ?? null}
            variables={fallbackParameters}
          />
        </div>
      </form>
    </Panel>
  );
}
