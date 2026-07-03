import Papa from "papaparse";
import ExcelJS from "exceljs";

export class ImportFileParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileParseError";
  }
}

export type ParsedImportFile = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type ImportColumnMapping = {
  name?: string;
  phoneNumber?: string;
  countryCode?: string;
  email?: string;
  companyName?: string;
  tags?: string;
  city?: string;
  source?: string;
};

export const SUPPORTED_IMPORT_FILE_TYPES = ["csv", "xlsx"] as const;
export type ImportFileType = (typeof SUPPORTED_IMPORT_FILE_TYPES)[number];

const BOM_CHAR_CODE = 0xfeff;
const FILE_NAME_UNSAFE = new Set(["\\", "/", ":", "*", "?", '"', "<", ">", "|"]);

function isControlCharCode(code: number) {
  return (code >= 0 && code <= 31) || code === 127;
}

function stripControlCharacters(value: string) {
  let out = "";

  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (isControlCharCode(code) || code === BOM_CHAR_CODE) continue;
    out += ch;
  }

  return out;
}

export function resolveImportFileType(fileName: string): ImportFileType | null {
  const lowered = String(fileName ?? "").toLowerCase();

  if (lowered.endsWith(".csv")) return "csv";
  if (lowered.endsWith(".xlsx")) return "xlsx";

  return null;
}

export function sanitizeImportFileName(fileName: string) {
  let out = "";

  for (const ch of String(fileName ?? "import")) {
    const code = ch.charCodeAt(0);
    out += isControlCharCode(code) || FILE_NAME_UNSAFE.has(ch) ? "_" : ch;
  }

  return out.slice(0, 180);
}

function sanitizeCellValue(value: string) {
  // Strip control characters; values are stored as plain text so spreadsheet
  // formulas are never evaluated or re-exported as formulas.
  return stripControlCharacters(value).trim();
}

function normalizeHeaders(rawHeaders: string[]) {
  const seen = new Map<string, number>();

  return rawHeaders.map((header, index) => {
    let name = sanitizeCellValue(String(header ?? ""));

    if (!name) name = `column_${index + 1}`;

    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);

    return count === 0 ? name : `${name}_${count + 1}`;
  });
}

function parseCsvBuffer(buffer: Buffer, maxRows: number): ParsedImportFile {
  let text = buffer.toString("utf-8");

  if (text.charCodeAt(0) === BOM_CHAR_CODE) {
    text = text.slice(1);
  }

  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  const fatalErrors = parsed.errors.filter(
    (error) => error.code !== "TooFewFields" && error.code !== "TooManyFields",
  );

  if (fatalErrors.length > 0) {
    throw new ImportFileParseError(fatalErrors[0]?.message || "CSV parse failed.");
  }

  const [headerRow, ...dataRows] = parsed.data;

  if (!headerRow || headerRow.length === 0) {
    throw new ImportFileParseError("CSV file has no header row.");
  }

  if (dataRows.length === 0) {
    throw new ImportFileParseError("CSV file has no data rows.");
  }

  if (dataRows.length > maxRows) {
    throw new ImportFileParseError(`File cannot have more than ${maxRows} rows.`);
  }

  const headers = normalizeHeaders(headerRow.map((value) => String(value ?? "")));

  const rows = dataRows.map((cells) => {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = sanitizeCellValue(String(cells[index] ?? ""));
    });

    return row;
  });

  return { headers, rows };
}

async function parseXlsxBuffer(
  buffer: Buffer,
  maxRows: number,
): Promise<ParsedImportFile> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ImportFileParseError(
      "Unable to read XLSX file. The file may be corrupted.",
    );
  }

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new ImportFileParseError("XLSX file has no worksheets.");
  }

  if (worksheet.rowCount - 1 > maxRows) {
    throw new ImportFileParseError(`File cannot have more than ${maxRows} rows.`);
  }

  const rawHeaders: string[] = [];
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    rawHeaders[colNumber - 1] = cell.text ?? "";
  });

  if (rawHeaders.every((header) => !String(header ?? "").trim())) {
    throw new ImportFileParseError("XLSX file has no header row.");
  }

  const headers = normalizeHeaders(rawHeaders);
  const rows: Array<Record<string, string>> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: Record<string, string> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      // cell.text returns display text (cached results for formula cells);
      // formulas are never evaluated.
      const cell = row.getCell(index + 1);
      const value = sanitizeCellValue(cell.text ?? "");

      record[header] = value;
      if (value) hasValue = true;
    });

    if (hasValue) rows.push(record);
  });

  if (rows.length === 0) {
    throw new ImportFileParseError("XLSX file has no data rows.");
  }

  if (rows.length > maxRows) {
    throw new ImportFileParseError(`File cannot have more than ${maxRows} rows.`);
  }

  return { headers, rows };
}

export async function parseImportFile({
  fileType,
  buffer,
  maxRows,
}: {
  fileType: ImportFileType;
  buffer: Buffer;
  maxRows: number;
}): Promise<ParsedImportFile> {
  if (fileType === "csv") {
    return parseCsvBuffer(buffer, maxRows);
  }

  return parseXlsxBuffer(buffer, maxRows);
}

const COLUMN_SYNONYMS: Record<keyof ImportColumnMapping, string[]> = {
  name: [
    "name",
    "full name",
    "fullname",
    "customer name",
    "contact name",
    "first name",
  ],
  phoneNumber: [
    "phone",
    "phonenumber",
    "phone number",
    "mobile",
    "mobile number",
    "whatsapp",
    "whatsapp number",
    "number",
    "contact",
    "contact number",
    "msisdn",
  ],
  countryCode: [
    "country code",
    "countrycode",
    "dial code",
    "dialcode",
    "isd",
    "isd code",
  ],
  email: ["email", "e-mail", "email address", "mail"],
  companyName: [
    "company",
    "company name",
    "companyname",
    "organisation",
    "organization",
    "business",
  ],
  tags: ["tags", "tag", "labels", "label"],
  city: ["city", "town", "location"],
  source: ["source", "lead source", "origin", "channel"],
};

export function detectColumnMapping(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  const used = new Set<string>();

  const normalized = headers.map((header) => ({
    header,
    key: header
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  }));

  (Object.keys(COLUMN_SYNONYMS) as Array<keyof ImportColumnMapping>).forEach(
    (field) => {
      for (const synonym of COLUMN_SYNONYMS[field]) {
        const match = normalized.find(
          (candidate) => !used.has(candidate.header) && candidate.key === synonym,
        );

        if (match) {
          mapping[field] = match.header;
          used.add(match.header);
          return;
        }
      }

      // Fall back to a contains match (e.g. "customer phone (whatsapp)").
      for (const synonym of COLUMN_SYNONYMS[field]) {
        const match = normalized.find(
          (candidate) =>
            !used.has(candidate.header) && candidate.key.includes(synonym),
        );

        if (match) {
          mapping[field] = match.header;
          used.add(match.header);
          return;
        }
      }
    },
  );

  return mapping;
}
