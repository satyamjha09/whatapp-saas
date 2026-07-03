export type ImportColumnMappingState = {
  phoneNumber: string;
  name: string;
  countryCode: string;
  email: string;
  companyName: string;
  tags: string;
  city: string;
  source: string;
};

export type ImportUploadResult = {
  importId: string;
  fileName: string;
  fileType: string;
  totalRows: number;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  detectedMapping: Partial<ImportColumnMappingState>;
};

export type ImportValidationSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
};

export type ImportValidationResult = {
  summary: ImportValidationSummary;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
  warnings: Array<{ rowNumber: number; message: string }>;
};

export type ImportWizardJob = {
  id: string;
  status: string;
  fileName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  errorMessage: string | null;
  createdAt?: string;
  completedAt?: string | null;
};

export type ImportRow = {
  id: string;
  rowNumber: number;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  errorMessage: string | null;
  warnings: string[] | null;
};

export type ContactListOption = {
  id: string;
  name: string;
};

export const DUPLICATE_STRATEGIES = [
  {
    value: "SKIP_EXISTING",
    label: "Skip existing contacts",
    description: "Existing contacts are left untouched. Only new numbers are added.",
  },
  {
    value: "UPDATE_EXISTING",
    label: "Update existing contacts",
    description:
      "Existing contacts get updated with non-empty values from the file. Nothing is wiped.",
  },
  {
    value: "CREATE_NEW_ONLY",
    label: "Create new only",
    description: "Only brand-new numbers are created. Existing contacts are skipped.",
  },
] as const;

export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number]["value"];
