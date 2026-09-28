import { get } from "svelte/store";
import { activeRow, csvData, csvEnabled, csvFileName, csvInclude, csvTable } from "$/stores";
import { CSV_DEFAULT } from "$/defaults";
import { readDataFile, SpreadsheetNotSupportedError, toCsv, type DataTable } from "$/utils/data_table";
import { FileUtils } from "$/utils/file_utils";
import { Toasts } from "$/utils/toasts";

export const DATA_FILE_ACCEPT = "csv,.tsv,.txt,.xlsx,.xls,.ods";

export const loadTable = (table: DataTable, fileName: string, include?: boolean[]) => {
  csvData.set({ data: toCsv(table) });
  csvInclude.set(include ?? table.rows.map(() => true));
  csvFileName.set(fileName);
  csvEnabled.set(true);
  if (get(activeRow) >= table.rows.length) {
    activeRow.set(0);
  }
};

export const clearData = () => {
  csvEnabled.set(false);
  csvFileName.set("");
  activeRow.set(0);
};

/** Data persisted from a previous session (not the built-in placeholder) */
export const hasSavedData = (): boolean => {
  const data = get(csvData).data.trim();
  return data !== "" && data !== CSV_DEFAULT && get(csvTable).columns.length > 0;
};

/** Current data as table */
export const currentTable = (): DataTable => {
  const t = get(csvTable);
  return { columns: [...t.columns], rows: t.rows.map((r) => t.columns.map((c) => r[c] ?? "")) };
};

export const importDataFile = async (file: File): Promise<boolean> => {
  try {
    const table = await readDataFile(file);
    if (table.columns.length === 0) {
      Toasts.error(new Error(`${file.name}: no data found`));
      return false;
    }
    loadTable(table, file.name);
    return true;
  } catch (e) {
    if (e instanceof SpreadsheetNotSupportedError) {
      Toasts.error(new Error(`${file.name}: spreadsheet files are not supported yet, please save it as CSV`));
    } else {
      Toasts.error(e);
    }
    return false;
  }
};

export const pickDataFile = async (): Promise<boolean> => {
  const files = await FileUtils.pickFileAsync(DATA_FILE_ACCEPT, false);
  return importDataFile(files[0]);
};

export const downloadCsv = (table: DataTable, fileName: string) => {
  const bytes = new TextEncoder().encode(toCsv(table));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const name = (fileName || "data").replace(/\.[^.]+$/, "") + ".csv";
  FileUtils.downloadBase64(name, "text/csv", btoa(bin));
};
