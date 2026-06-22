"use client";

import { CheckCircle2, FileUp, LoaderCircle, Send } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

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

export default function BulkTemplateMessageForm({
  canManage,
  groups,
  initialGroupId,
  templates,
  plan,
}: {
  canManage: boolean;
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
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [recipientsText, setRecipientsText] = useState(
    "countryCode,phoneNumber,name,param1,param2",
  );
  const [fallbackParameters, setFallbackParameters] = useState<string[]>(
    templates[0]?.variables.map(() => "") ?? [],
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [batchId, setBatchId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sendMode, setSendMode] = useState<"CSV" | "GROUP">(
    initialGroupId ? "GROUP" : "CSV",
  );
  const [groupId, setGroupId] = useState(initialGroupId ?? "");
  const [isSending, setIsSending] = useState(false);

  const selectedTemplate = templates.find(
    (template) => template.id === templateId,
  );
  const selectedGroup = groups.find((group) => group.id === groupId);
  const parsedCsv = useMemo(() => {
    try {
      return { recipients: parseRecipients(recipientsText), error: "" };
    } catch (parseError) {
      return {
        recipients: [] as Recipient[],
        error:
          parseError instanceof Error ? parseError.message : "Invalid CSV",
      };
    }
  }, [recipientsText]);
  const recipients = parsedCsv.recipients;
  const uniqueRecipientCount = useMemo(() => {
    return new Set(
      recipients.map((recipient) => {
        return `${recipient.countryCode.replace(/\D/g, "")}${recipient.phoneNumber.replace(/\D/g, "")}`;
      }),
    ).size;
  }, [recipients]);
  const activeRecipientCount =
    sendMode === "GROUP"
      ? selectedGroup?._count.members ?? 0
      : uniqueRecipientCount;
  const isWithinPlanLimit = activeRecipientCount <= plan.maxBulkRecipients;
  const isPlanReady = plan.isSubscriptionActive && isWithinPlanLimit;
  const preview = useMemo(() => {
    if (!selectedTemplate) return "";

    return selectedTemplate.body.replace(/{{(\d+)}}/g, (token, index: string) => {
      return fallbackParameters[Number(index) - 1] || token;
    });
  }, [fallbackParameters, selectedTemplate]);

  function chooseTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    setFallbackParameters(template?.variables.map(() => "") ?? []);
  }

  function updateFallbackParameter(index: number, value: string) {
    setFallbackParameters((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");

    if (file.size > 2 * 1024 * 1024) {
      setError("CSV file must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    try {
      setRecipientsText(await file.text());
    } catch {
      setError("Unable to read the selected CSV file.");
    } finally {
      event.target.value = "";
    }
  }

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

    setIsSending(true);

    try {
      const fallbackPayload = fallbackParameters.every(
        (value) => value.trim().length === 0,
      )
        ? []
        : fallbackParameters;
      const response = await fetch("/api/messages/bulk-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          groupId: sendMode === "GROUP" ? groupId : null,
          recipients: sendMode === "CSV" ? recipients : [],
          bodyParameters: fallbackPayload,
          scheduledAt: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
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
          ? `Scheduled ${data.result.queuedCount} message(s)${data.result.contactGroupName ? ` to ${data.result.contactGroupName}` : ""}. ${data.result.skippedDuplicateCount} duplicate(s) and ${data.result.skippedBlockedCount} blocked contact(s) skipped.`
          : `Queued ${data.result?.queuedCount ?? 0} message(s)${data.result?.contactGroupName ? ` to ${data.result.contactGroupName}` : ""}. ${
              data.result?.failedCount ?? 0
            } failed. ${
              data.result?.skippedDuplicateCount ?? 0
            } duplicate(s) and ${data.result?.skippedBlockedCount ?? 0} blocked contact(s) skipped.`,
      );
      setBatchId(data.result?.batchId ?? "");
      router.refresh();
    } catch {
      setError("Unable to queue bulk messages.");
    } finally {
      setIsSending(false);
    }
  }

  if (templates.length === 0) {
    return (
      <Panel>
        <PanelTitle
          title="No approved templates"
          description="Sync templates from Meta before sending bulk messages."
        />
        <Link
          href="/dashboard/templates"
          className={`${actionButtonClass()} mt-5`}
        >
          Open Templates
        </Link>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelTitle
        title="Bulk Template Message"
        description="Upload CSV or paste rows. Each recipient may have its own template parameters."
      />

      <form onSubmit={sendBulkMessage} className="mt-6 space-y-5">
        <div className={`rounded-xl border p-4 ${isPlanReady ? "border-[#D8E6F3] bg-[#F0F8FF]" : "border-rose-200 bg-rose-50"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#526173]">{plan.name} plan status</p>
              <p className="mt-1 text-xl font-bold text-[#081B3A]">{activeRecipientCount.toLocaleString("en-IN")} / {plan.maxBulkRecipients.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-[#526173]">{plan.subscriptionStatus}</p>
              {plan.cancelAtPeriodEnd ? (
                <p className="mt-1 text-xs font-medium text-[#7A5A00]">Cancels at period end</p>
              ) : null}
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isPlanReady ? "bg-[#22C55E]/10 text-[#15803d]" : "bg-rose-100 text-rose-700"}`}>{!plan.isSubscriptionActive ? "Renew plan" : isWithinPlanLimit ? "Within limit" : "Limit exceeded"}</span>
          </div>
        </div>
        <div>
          <label htmlFor="templateId" className={labelClass}>
            Approved template
          </label>
          <select
            id="templateId"
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

        <div className="rounded-xl bg-[#F0F8FF] p-4 ring-1 ring-[#D8E6F3]">
          <p className="text-sm font-bold text-[#081B3A]">Recipients source</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["CSV", "GROUP"] as const).map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#D8E6F3] bg-white p-4"
              >
                <input
                  type="radio"
                  checked={sendMode === mode}
                  onChange={() => setSendMode(mode)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-[#081B3A]">
                    {mode === "CSV" ? "CSV / Paste" : "Contact Group"}
                  </span>
                  <span className="mt-1 block text-xs text-[#526173]">
                    {mode === "CSV"
                      ? "Upload a CSV or paste recipient rows."
                      : "Send to a saved contact group."}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {sendMode === "GROUP" ? (
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
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#D8E6F3] bg-white p-4">
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedGroup.color ?? "#0052CC" }}
                />
                <div>
                  <p className="text-sm font-bold text-[#081B3A]">
                    {selectedGroup.name}
                  </p>
                  <p className="mt-1 text-xs text-[#526173]">
                    {selectedGroup.description || "No description"}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#081B3A]">
                    {selectedGroup._count.members} contact(s) will be evaluated;
                    blocked contacts will be skipped.
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
        ) : (
          <>
            <div>
              <label htmlFor="csvUpload" className={labelClass}>
                Upload CSV
              </label>
              <label
                htmlFor="csvUpload"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#0052CC]/35 bg-[#F0F8FF] px-4 py-5 text-sm font-semibold text-[#0052CC] transition hover:border-[#0052CC]"
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
                Parsed: {recipients.length}; unique: {uniqueRecipientCount}; plan maximum {plan.maxBulkRecipients.toLocaleString("en-IN")} recipients.
              </p>
              {parsedCsv.error ? (
                <p className="mt-2 text-sm text-rose-700">{parsedCsv.error}</p>
              ) : null}
            </div>
          </>
        )}

        {selectedTemplate?.variables.map((variable, index) => (
          <div key={`${selectedTemplate.id}-${variable}`}>
            <label htmlFor={`fallback-parameter-${index}`} className={labelClass}>
              Fallback parameter {variable}
            </label>
            <input
              id={`fallback-parameter-${index}`}
              value={fallbackParameters[index] ?? ""}
              onChange={(event) =>
                updateFallbackParameter(index, event.target.value)
              }
              className={fieldClass}
            />
            <p className={helperTextClass}>
              Used only for rows without parameter columns.
            </p>
          </div>
        ))}

        {selectedTemplate ? (
          <div className="rounded-xl bg-[#F0F8FF] p-4 ring-1 ring-[#D8E6F3]">
            <p className="text-sm font-bold text-[#081B3A]">
              Fallback template preview
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#526173]">
              {preview || "No body preview available."}
            </p>
          </div>
        ) : null}

        {sendMode === "CSV" && recipients.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[#D8E6F3]">
            <div className="border-b border-[#D8E6F3] bg-[#F0F8FF] px-4 py-3">
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
                <tbody className="divide-y divide-[#D8E6F3]">
                  {recipients.slice(0, 20).map((recipient, index) => (
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
            {recipients.length > 20 ? (
              <p className="border-t border-[#D8E6F3] bg-[#F0F8FF] px-4 py-3 text-xs text-[#526173]">
                Showing the first 20 recipients.
              </p>
            ) : null}
          </div>
        ) : null}

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

        <button
          type="submit"
          disabled={
            !canManage ||
            isSending ||
            !plan.isSubscriptionActive ||
            (sendMode === "CSV" &&
              (recipients.length === 0 ||
                uniqueRecipientCount > plan.maxBulkRecipients ||
                Boolean(parsedCsv.error))) ||
            (sendMode === "GROUP" && (!groupId || !isWithinPlanLimit))
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
      </form>
    </Panel>
  );
}
