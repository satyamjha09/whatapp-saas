"use client";

import { FileUp, LoaderCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  actionButtonClass,
  fieldClass,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";

type ContactRow = {
  countryCode: string;
  phoneNumber: string;
  name?: string;
  source?: string;
  marketingConsent?: string;
  marketingConsentEvidence?: string;
  utilityConsent?: string;
  utilityConsentEvidence?: string;
};

type ImportResponse = {
  message?: string;
  result?: {
    addedCount: number;
    alreadyInGroupCount: number;
    skippedDuplicateCount: number;
  };
  errors?: { contacts?: string[] };
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, "");

  function finishRow() {
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    row = [];
    field = "";
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted value");
  if (field.length > 0 || row.length > 0) finishRow();
  return rows;
}

function parseContacts(text: string): ContactRow[] {
  const rows = parseCsv(text);
  const header = rows[0]?.map((item) =>
    item.toLowerCase().replace(/[\s_]/g, ""),
  );
  const hasHeader =
    header?.[0] === "countrycode" && header?.[1] === "phonenumber";

  return (hasHeader ? rows.slice(1) : rows).map((row) => ({
    countryCode: row[0] ?? "",
    phoneNumber: row[1] ?? "",
    name: row[2] || undefined,
    source: row[3] || "GROUP_IMPORT",
    marketingConsent: row[4] || undefined,
    marketingConsentEvidence: row[5] || undefined,
    utilityConsent: row[6] || undefined,
    utilityConsentEvidence: row[7] || undefined,
  }));
}

export default function GroupMembersImportCard({
  groupId,
}: {
  groupId: string;
}) {
  const router = useRouter();
  const [contactsText, setContactsText] = useState(
    "countryCode,phoneNumber,name,source,marketingConsent,marketingConsentEvidence,utilityConsent,utilityConsentEvidence",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const parsed = useMemo(() => {
    try {
      return { contacts: parseContacts(contactsText), error: "" };
    } catch (parseError) {
      return {
        contacts: [] as ContactRow[],
        error:
          parseError instanceof Error ? parseError.message : "Invalid CSV",
      };
    }
  }, [contactsText]);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");

    if (file.size > 2 * 1024 * 1024) {
      setError("CSV file must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    try {
      setContactsText(await file.text());
    } catch {
      setError("Unable to read the selected CSV file.");
    } finally {
      event.target.value = "";
    }
  }

  async function importMembers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch(`/api/contacts/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: parsed.contacts }),
      });
      const data = (await response.json()) as ImportResponse;

      if (!response.ok) {
        setError(
          data.errors?.contacts?.[0] ??
            data.message ??
            "Unable to import contacts.",
        );
        return;
      }

      setSuccess(
        `Added ${data.result?.addedCount ?? 0} contact(s). ${data.result?.alreadyInGroupCount ?? 0} already existed; ${data.result?.skippedDuplicateCount ?? 0} duplicate row(s) skipped.`,
      );
      router.refresh();
    } catch {
      setError("Unable to import contacts to group.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Panel className="mb-6">
      <PanelTitle
        title="Add contacts to group"
        description="Upload CSV or paste contact rows with optional consent evidence."
      />
      <form onSubmit={importMembers} className="mt-5 space-y-4">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#0052CC]/35 bg-[#F0F8FF] px-4 py-5 text-sm font-semibold text-[#0052CC]">
          <FileUp className="h-5 w-5" />
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="sr-only"
          />
        </label>
        <textarea
          value={contactsText}
          onChange={(event) => setContactsText(event.target.value)}
          rows={7}
          className={fieldClass}
        />
        <p className="text-xs text-[#526173]">
          Parsed contacts: {parsed.contacts.length}; maximum 2,000.
        </p>
        {parsed.error || error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {error || parsed.error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={
            isImporting ||
            parsed.contacts.length === 0 ||
            parsed.contacts.length > 2000 ||
            Boolean(parsed.error)
          }
          className={actionButtonClass()}
        >
          {isImporting ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          {isImporting ? "Adding..." : "Add Contacts"}
        </button>
      </form>
    </Panel>
  );
}
