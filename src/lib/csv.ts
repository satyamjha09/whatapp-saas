export function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";

  let stringValue = value instanceof Date ? value.toISOString() : String(value);

  // Prevent spreadsheet applications from evaluating exported user text.
  if (/^[=+\-@\t\r]/.test(stringValue)) stringValue = `'${stringValue}`;

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

export function rowsToCsv(rows: unknown[][]) {
  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");
}
