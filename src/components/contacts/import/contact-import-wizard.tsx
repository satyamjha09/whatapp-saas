"use client";

import { useState } from "react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import { ContactImportUploader } from "./contact-import-uploader";
import { ContactColumnMapper } from "./contact-column-mapper";
import { ContactImportPreview } from "./contact-import-preview";
import { ContactImportSummary } from "./contact-import-summary";
import { ContactImportErrorsTable } from "./contact-import-errors-table";
import { ContactImportProgress } from "./contact-import-progress";
import {
  DUPLICATE_STRATEGIES,
  type ContactListOption,
  type DuplicateStrategy,
  type ImportColumnMappingState,
  type ImportUploadResult,
  type ImportValidationResult,
} from "./types";

const EMPTY_MAPPING: ImportColumnMappingState = {
  phoneNumber: "",
  name: "",
  countryCode: "",
  email: "",
  companyName: "",
  tags: "",
  city: "",
  source: "",
};

const STEPS = ["Upload", "Map columns", "Review", "Import"] as const;

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json();
    return data.message ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export function ContactImportWizard({
  contactLists,
  defaultCountryCode = "91",
}: {
  contactLists: ContactListOption[];
  defaultCountryCode?: string;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const [upload, setUpload] = useState<ImportUploadResult | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMappingState>(EMPTY_MAPPING);
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateStrategy>("SKIP_EXISTING");
  const [tagsInput, setTagsInput] = useState("");
  const [listChoice, setListChoice] = useState("");
  const [newListName, setNewListName] = useState("");
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);

  async function handleUpload(file: File) {
    setError("");
    setIsWorking(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/contacts/import/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      const data = (await response.json()) as ImportUploadResult;

      setUpload(data);
      setMapping({
        ...EMPTY_MAPPING,
        ...Object.fromEntries(
          Object.entries(data.detectedMapping ?? {}).filter(([, value]) => value),
        ),
      });
      setValidation(null);
      setStep(1);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleValidate() {
    if (!upload) return;

    if (!mapping.phoneNumber) {
      setError("Map the phone number column before continuing.");
      return;
    }

    setError("");
    setIsWorking(true);

    try {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const mappingResponse = await fetch(
        `/api/contacts/import/${upload.importId}/mapping`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnMapping: Object.fromEntries(
              Object.entries(mapping).filter(([, value]) => value),
            ),
            defaultCountryCode: countryCode || undefined,
            duplicateStrategy,
            tags: tags.length > 0 ? tags : undefined,
            contactListId:
              listChoice && listChoice !== "__new__" ? listChoice : undefined,
            createListName:
              listChoice === "__new__" && newListName.trim()
                ? newListName.trim()
                : undefined,
          }),
        },
      );

      if (!mappingResponse.ok) {
        setError(await readErrorMessage(mappingResponse));
        return;
      }

      const validateResponse = await fetch(
        `/api/contacts/import/${upload.importId}/validate`,
        {
          method: "POST",
        },
      );

      if (!validateResponse.ok) {
        setError(await readErrorMessage(validateResponse));
        return;
      }

      setValidation((await validateResponse.json()) as ImportValidationResult);
      setStep(2);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStart() {
    if (!upload) return;

    setError("");
    setIsWorking(true);

    try {
      const response = await fetch(`/api/contacts/import/${upload.importId}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      setStep(3);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={[
                "grid h-6 w-6 place-items-center rounded-full",
                index <= step
                  ? "bg-[#128C7E] text-white"
                  : "bg-[#E7F8EF] text-[#526173]",
              ].join(" ")}
            >
              {index + 1}
            </span>
            <span className={index <= step ? "text-[#081B3A]" : "text-[#526173]"}>
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-[#BFE9D0]" />
            )}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-6">
        {step === 0 && (
          <ContactImportUploader onUpload={handleUpload} isUploading={isWorking} />
        )}

        {step === 1 && upload && (
          <div className="grid gap-6">
            <div>
              <PanelTitle
                title="Map your columns"
                description={`${upload.fileName} · ${upload.totalRows.toLocaleString("en-IN")} rows detected. Match file columns to contact fields.`}
              />
              <div className="mt-4">
                <ContactColumnMapper
                  headers={upload.headers}
                  mapping={mapping}
                  onChange={setMapping}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="import-country-code">
                  Default country code
                </label>
                <input
                  id="import-country-code"
                  className={fieldClass}
                  value={countryCode}
                  onChange={(event) =>
                    setCountryCode(event.target.value.replace(/[^\d]/g, "").slice(0, 4))
                  }
                  placeholder="91"
                />
                <p className={helperTextClass}>
                  Applied when a phone number has no country code.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="import-duplicate-strategy">
                  Duplicate handling
                </label>
                <select
                  id="import-duplicate-strategy"
                  className={fieldClass}
                  value={duplicateStrategy}
                  onChange={(event) =>
                    setDuplicateStrategy(event.target.value as DuplicateStrategy)
                  }
                >
                  {DUPLICATE_STRATEGIES.map((strategy) => (
                    <option key={strategy.value} value={strategy.value}>
                      {strategy.label}
                    </option>
                  ))}
                </select>
                <p className={helperTextClass}>
                  {
                    DUPLICATE_STRATEGIES.find(
                      (strategy) => strategy.value === duplicateStrategy,
                    )?.description
                  }
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="import-tags">
                  Add tags (optional)
                </label>
                <input
                  id="import-tags"
                  className={fieldClass}
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="diwali-leads, retail"
                />
                <p className={helperTextClass}>
                  Comma separated. Applied to every imported contact.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="import-list">
                  Add to list (optional)
                </label>
                <select
                  id="import-list"
                  className={fieldClass}
                  value={listChoice}
                  onChange={(event) => setListChoice(event.target.value)}
                >
                  <option value="">No list</option>
                  {contactLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                  <option value="__new__">+ Create new list</option>
                </select>

                {listChoice === "__new__" && (
                  <input
                    className={`${fieldClass} mt-2`}
                    value={newListName}
                    onChange={(event) => setNewListName(event.target.value)}
                    placeholder="New list name"
                  />
                )}
              </div>
            </div>

            <div>
              <PanelTitle title="File preview" description="First rows from your file." />
              <div className="mt-4">
                <ContactImportPreview
                  headers={upload.headers}
                  sampleRows={upload.sampleRows.slice(0, 5)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={actionButtonClass("primary")}
                onClick={handleValidate}
                disabled={isWorking}
              >
                {isWorking ? "Validating..." : "Validate rows"}
              </button>
              <button
                type="button"
                className={actionButtonClass("secondary")}
                onClick={() => {
                  setStep(0);
                  setUpload(null);
                  setValidation(null);
                }}
                disabled={isWorking}
              >
                Choose a different file
              </button>
            </div>
          </div>
        )}

        {step === 2 && upload && validation && (
          <div className="grid gap-6">
            <PanelTitle
              title="Review before import"
              description="Check the validation results. Invalid rows are never imported."
            />

            <ContactImportSummary summary={validation.summary} />

            {(validation.summary.invalidRows > 0 ||
              validation.summary.duplicateRows > 0) && (
              <ContactImportErrorsTable importId={upload.importId} />
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={actionButtonClass("primary")}
                onClick={handleStart}
                disabled={isWorking}
              >
                {isWorking
                  ? "Starting..."
                  : `Import ${(
                      validation.summary.validRows +
                      (duplicateStrategy === "UPDATE_EXISTING"
                        ? validation.summary.duplicateRows
                        : 0)
                    ).toLocaleString("en-IN")} contacts`}
              </button>
              <button
                type="button"
                className={actionButtonClass("secondary")}
                onClick={() => setStep(1)}
                disabled={isWorking}
              >
                Back to mapping
              </button>
            </div>
          </div>
        )}

        {step === 3 && upload && (
          <div>
            <PanelTitle
              title="Importing contacts"
              description="You can leave this page. The import continues in the background."
            />
            <div className="mt-5">
              <ContactImportProgress importId={upload.importId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
