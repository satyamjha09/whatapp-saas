"use client";

export function ContactImportPreview({
  headers,
  sampleRows,
}: {
  headers: string[];
  sampleRows: Array<Record<string, string>>;
}) {
  if (sampleRows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#BFE9D0]">
      <table className="min-w-full divide-y divide-[#E7F8EF] text-left text-sm">
        <thead className="bg-[#E7F8EF]">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#128C7E]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E7F8EF] bg-white">
          {sampleRows.map((row, index) => (
            <tr key={index}>
              {headers.map((header) => (
                <td
                  key={header}
                  className="max-w-[220px] truncate whitespace-nowrap px-4 py-2.5 text-[#102040]"
                >
                  {row[header] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
