"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { actionButtonClass, helperTextClass } from "@/app/dashboard/dashboard-ui";

export function ContactImportUploader({
  onUpload,
  isUploading,
}: {
  onUpload: (file: File) => void;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onUpload(file);
  }

  return (
    <div>
      <div
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
          isDragging
            ? "border-[#128C7E] bg-[#E7F8EF]"
            : "border-[#BFE9D0] bg-[#F7FCF9]",
        ].join(" ")}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
          <UploadCloud className="h-6 w-6" />
        </div>

        <p className="text-sm font-semibold text-[#081B3A]">
          Drag &amp; drop your contact file here
        </p>
        <p className="text-xs text-[#526173]">
          Supports .csv and .xlsx files up to 10MB / 10,000 rows.
        </p>

        <button
          type="button"
          className={actionButtonClass("primary")}
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? "Uploading..." : "Choose file"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <p className={helperTextClass}>
        <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />
        Need a starting point?{" "}
        <a
          href="/samples/contact-import-sample.csv"
          download
          className="font-semibold text-[#128C7E] underline-offset-2 hover:underline"
        >
          Download the sample CSV
        </a>{" "}
        with the recommended columns.
      </p>
    </div>
  );
}
