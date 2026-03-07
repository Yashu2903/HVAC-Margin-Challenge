import fs from "fs";
import path from "path";
import Papa from "papaparse";

async function loadCsv<T = Record<string, unknown>>(
  filename: string
): Promise<T[]> {
  const filePath = path.join(process.cwd(), "data", filename);
  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<T>(fileContent.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    quoteChar: '"',
    escapeChar: '"',
    dynamicTyping: false,
  });

  if (parsed.errors.length) {
    console.warn(`[loadCsv ${filename}] Parse warnings (${parsed.errors.length}):`, parsed.errors.slice(0, 5));
  }

  // Filter out rows that failed parsing (e.g. TooManyFields) - they may have wrong structure
  const errorRows = new Set(parsed.errors.map((e) => (e as { row?: number }).row).filter((r): r is number => typeof r === "number"));
  const data = parsed.data as T[];
  const filtered = errorRows.size > 0
    ? data.filter((_, i) => !errorRows.has(i))
    : data;

  return filtered;
}

export { loadCsv };
