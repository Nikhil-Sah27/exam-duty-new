/**
 * Private-use marker prefix. `excelText()` stamps it onto a value so
 * `downloadCsv` emits that cell as an Excel text formula instead of a plain
 * quoted string. The character is in the Unicode Private Use Area, so it never
 * collides with real data.
 */
const TEXT_MARK = "";

/**
 * Force a value to be treated as literal text by Excel/Sheets, disabling their
 * automatic date/number conversion. Without this, a value like "27 Aug 2026"
 * is parsed into a date serial and shown as `########` when the column is too
 * narrow. Rendered as `="27 Aug 2026"`, which spreadsheets display verbatim
 * (left-aligned, never `####`); plain-text viewers show the `="…"` wrapper.
 */
export function excelText(value: string | number | null | undefined): string {
  return TEXT_MARK + (value === null || value === undefined ? "" : String(value));
}

/**
 * Build a CSV string and trigger a browser download. Values are quoted and
 * quote-escaped; a UTF-8 BOM is prepended so Excel opens it correctly. Values
 * wrapped with `excelText()` are emitted as text formulas so spreadsheets don't
 * auto-convert them to dates/numbers.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const escape = (v: string | number | null | undefined) => {
    if (typeof v === "string" && v.startsWith(TEXT_MARK)) {
      const text = v.slice(TEXT_MARK.length).replace(/"/g, '""');
      return `="${text}"`;
    }
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface CsvRecord {
  /** Spreadsheet row number (the header is row 1); blank rows still count. */
  line: number;
  cells: string[];
}

/**
 * Parse CSV text into records (RFC 4180: quoted fields, "" escapes, commas and
 * newlines inside quotes, CRLF or LF). Strips a UTF-8 BOM, auto-detects `;`
 * as the delimiter (Excel in some locales), unwraps Excel text formulas
 * (`="0123"`, as `excelText()`/Excel emit them) and drops blank rows while
 * keeping every record's spreadsheet row number for error messages.
 */
export function parseCsv(text: string): CsvRecord[] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    records.push(row);
  }

  const unwrap = (v: string) => {
    const t = v.trim();
    const m = /^="(.*)"$/.exec(t);
    return m ? m[1] : t;
  };
  return records
    .map((cells, i) => ({ line: i + 1, cells: cells.map(unwrap) }))
    .filter((r) => r.cells.some((v) => v !== ""));
}
