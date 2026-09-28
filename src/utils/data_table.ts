import { csvFormatRows, dsvFormat } from "d3-dsv";

export interface DataTable {
  columns: string[];
  rows: string[][];
}

/** Guess delimiter by counting candidates in the first line (outside quotes) */
export const detectDelimiter = (text: string): string => {
  const candidates = [",", "\t", ";"];
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  let best = ",";
  let bestCount = 0;

  for (const d of candidates) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }

  return best;
};

/** Parse delimited text. First row is header, blank rows are dropped, empty headers become colN. */
export const parseDelimited = (text: string, delimiter?: string): DataTable => {
  const d = delimiter ?? detectDelimiter(text);
  const all = dsvFormat(d)
    .parseRows(text.replace(/^\uFEFF/, ""))
    .filter((r) => r.some((c) => c.trim() !== ""));

  if (all.length === 0) {
    return { columns: [], rows: [] };
  }

  const used = new Set<string>();
  const columns = all[0].map((c, i) => {
    let name = c.trim() || `col${i + 1}`;
    while (used.has(name)) name += "_";
    used.add(name);
    return name;
  });

  const rows = all.slice(1).map((r) => columns.map((_, i) => r[i] ?? ""));

  return { columns, rows };
};

/** Serialize to comma-separated CSV (format stored in csvData) */
export const toCsv = (table: DataTable): string => csvFormatRows([table.columns, ...table.rows]);

const SPREADSHEET_EXT = /\.(xlsx|xls|ods)$/i;
const DELIMITED_EXT = /\.(csv|tsv|txt)$/i;

export const isDataFile = (file: File): boolean => SPREADSHEET_EXT.test(file.name) || DELIMITED_EXT.test(file.name);

export class SpreadsheetNotSupportedError extends Error {}

/** Read CSV/TSV file into a table */
export const readDataFile = async (file: File): Promise<DataTable> => {
  if (SPREADSHEET_EXT.test(file.name)) {
    // todo: XLS/XLSX/ODS support via SheetJS
    throw new SpreadsheetNotSupportedError(file.name);
  }

  return parseDelimited(await file.text());
};

export const SAMPLE_DATA: DataTable = {
  columns: ["product", "lot", "weight", "best_before"],
  rows: [
    ["Espresso beans", "KL-2608-01", "250 g", "2027-03-01"],
    ["Filter blend", "KL-2608-02", "500 g", "2027-03-08"],
    ["Decaf", "KL-2608-03", "250 g", "2027-03-15"],
    ["Cold brew", "KL-2608-04", "1 kg", "2027-03-22"],
  ],
};

/** Rename {old} tokens (keeping modifiers) to {new}. All renames are applied in one pass, so swaps and chains work. */
export const renameTokens = (text: string, renames: [string, string][]): string => {
  if (renames.length === 0) {
    return text;
  }
  const map = new Map(renames);
  const names = renames.map(([o]) => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text.replace(new RegExp(`{(\\s*)(${names})(?=[\\s|}+-])`, "g"), (_m, ws: string, name: string) => {
    return `{${ws}${map.get(name) ?? name}`;
  });
};
