import fs from "fs";
import path from "path";
import Papa from "papaparse";

async function loadCsv<T = Record<string, unknown>>(
  filename: string
): Promise<T[]> {
  const filePath = path.join(process.cwd(), "data", filename);
  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<T>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    console.error(parsed.errors);
    throw new Error(`Error parsing CSV file: ${filename}`);
  }

  return parsed.data as T[];
}

export { loadCsv };
