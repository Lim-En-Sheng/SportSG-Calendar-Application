import type { Session } from "./model";
export type ImportRow = Omit<Session, "id">;
export type ImportResult = {
  validRows: ImportRow[];
  errors: { row?: number; message: string }[];
};
export const headers = [
  "Programme name",
  "Date",
  "Start time",
  "End time",
  "Location",
  "Participant capacity",
  "Coaches needed",
  "Level",
];
const keys = [
  "title",
  "date",
  "start",
  "end",
  "venue",
  "capacity",
  "needed",
  "level",
];
const normalise = (v: unknown) =>
  String(v ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();

export function csvRows(text: string): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else value += c;
  }
  if (quoted)
    throw new Error(
      "CSV contains an unclosed quotation mark. Save the file again as CSV or upload the Excel workbook.",
    );
  row.push(value);
  rows.push(row);
  return rows;
}
function cell(value: unknown, key: string): string {
  if (value instanceof Date)
    return key === "date"
      ? value.toISOString().slice(0, 10)
      : value.toISOString().slice(11, 16);
  if (
    typeof value === "number" &&
    key === "date" &&
    value > 0 &&
    value < 2958466
  )
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
      .toISOString()
      .slice(0, 10);
  if (
    typeof value === "number" &&
    (key === "start" || key === "end") &&
    value >= 0 &&
    value < 1
  ) {
    const minutes = Math.round(value * 1440);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  if (key === "start" || key === "end") {
    const match = /^(\d{1,2}):(\d{2})(?::00)?$/.exec(text);
    if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return text;
}
export function parseProgrammeRows(rows: unknown[][]): ImportResult {
  const result: ImportResult = { validRows: [], errors: [] };
  const first = rows.findIndex((row) =>
    row.some((v) => String(v ?? "").trim()),
  );
  if (first < 0)
    return {
      ...result,
      errors: [
        { message: "The file is empty. Add programmes below the header row." },
      ],
    };
  const names = rows[first].map(normalise);
  const indices = keys.map((key, i) =>
    names.findIndex((h) => h === key || h === normalise(headers[i])),
  );
  const missing = headers.filter((_, i) => indices[i] < 0);
  if (missing.length)
    return {
      ...result,
      errors: [
        {
          row: first + 1,
          message: `Missing columns: ${missing.join(", ")}. Use the downloadable template and keep its headers.`,
        },
      ],
    };
  const seen = new Set<string>();
  for (let i = first + 1; i < rows.length; i++) {
    if (!rows[i].some((v) => String(v ?? "").trim())) continue;
    const data = Object.fromEntries(
      keys.map((key, j) => [key, cell(rows[i][indices[j]], key)]),
    );
    const { title, date, start, end, venue } = data;
    const capacity = Number(data.capacity),
      needed = Number(data.needed);
    const level =
      ["Beginner", "Intermediate", "Expert"].find(
        (v) => v.toLowerCase() === data.level.toLowerCase(),
      ) ?? "";
    let error = "";
    if (!title) error = "Programme name is required.";
    else if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      error = "Date must be a valid YYYY-MM-DD date or an Excel date cell.";
    else if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)
    )
      error =
        "Start and end times must use HH:MM (24-hour), or Excel time cells.";
    else if (start >= end)
      error = "End time must be after start time on the same day.";
    else if (!venue) error = "Location is required.";
    else if (!Number.isSafeInteger(capacity) || capacity < 1)
      error = "Participant capacity must be a positive whole number.";
    else if (!Number.isSafeInteger(needed) || needed < 1)
      error = "Coaches needed must be a positive whole number.";
    else if (!level) error = "Level must be Beginner, Intermediate or Expert.";
    const row = { title, date, start, end, venue, capacity, needed, level };
    const signature = JSON.stringify(row);
    if (!error && seen.has(signature))
      error = "Duplicate programme row in this file.";
    if (error) result.errors.push({ row: i + 1, message: error });
    else {
      result.validRows.push(row);
      seen.add(signature);
    }
  }
  if (!result.validRows.length && !result.errors.length)
    result.errors.push({
      message:
        "No programmes found. Enter your data on the Programmes sheet, starting at row 2.",
    });
  return result;
}
export async function readProgrammeFile(file: File): Promise<ImportResult> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Please use a file smaller than 10 MB.");
  if (/\.csv$/i.test(file.name))
    return parseProgrammeRows(csvRows(await file.text()));
  if (!/\.xlsx$/i.test(file.name))
    throw new Error(
      "Choose an Excel (.xlsx) or CSV (.csv) file. Save older .xls files as .xlsx first.",
    );
  const { default: readExcel } = await import("read-excel-file/browser");
  let sheets;
  try {
    sheets = await readExcel(file);
  } catch {
    throw new Error(
      "This workbook could not be read. Save it as an unprotected .xlsx file and try again.",
    );
  }
  const sheet =
    sheets.find((s) => s.sheet.toLowerCase() === "programmes") ?? sheets[0];
  return parseProgrammeRows(sheet?.data ?? []);
}
export async function templateBlob(): Promise<Blob> {
  const { default: writeExcel } = await import("write-excel-file/universal");
  const header = headers.map((value) => ({
    value,
    fontWeight: "bold" as const,
    backgroundColor: "#163c32",
    textColor: "#ffffff",
  }));
  const columns = [36, 18, 16, 16, 30, 24, 20, 20].map((width) => ({ width }));
  const instructions = [
    ["Programme import template", "How to use"],
    [
      "1. Enter your programmes",
      "Use the Programmes sheet. Keep row 1 headers and start entering data at row 2. All eight columns are required.",
    ],
    [
      "2. One row per date",
      "For a programme on several dates, repeat the details on a separate row for each date.",
    ],
    [
      "3. Date and time",
      "Use YYYY-MM-DD for dates and HH:MM (24-hour) for times. Excel date/time cells are also supported. End must be after start on the same day.",
    ],
    [
      "4. Numbers",
      "Participant capacity is the maximum number of participants. Coaches needed is the number of coaches required. Both must be positive whole numbers.",
    ],
    ["5. Level", "Use Beginner, Intermediate or Expert."],
    [
      "6. Examples",
      "See the Examples sheet for guidance. Examples and Instructions are not imported. The Programmes sheet is intentionally empty.",
    ],
    [
      "7. Upload and review",
      "Save as .xlsx and upload in Admin > Programmes > Import programmes. Review the preview before confirming. Fix reported rows and re-upload, or explicitly import valid rows only.",
    ],
    [
      "CSV alternative",
      "Save only the Programmes sheet as CSV. Keep the same headers. Original title,date,start,end,venue,capacity,needed,level headers also work.",
    ],
    [
      "Important",
      "Import creates new sessions; it does not update existing programmes.",
    ],
  ].map((row, i) =>
    row.map((value) => ({
      value,
      wrap: true,
      ...(i === 0
        ? {
            fontWeight: "bold" as const,
            backgroundColor: "#163c32",
            textColor: "#ffffff",
          }
        : {}),
    })),
  );
  return writeExcel([
    { sheet: "Programmes", data: [header], columns, stickyRowsCount: 1 },
    {
      sheet: "Instructions",
      data: instructions,
      columns: [{ width: 30 }, { width: 100 }],
    },
    {
      sheet: "Examples",
      data: [
        header,
        ...[
          [
            "Academy Coaching - Beginner",
            "2027-01-15",
            "09:00",
            "12:30",
            "Bishan Stadium",
            20,
            2,
            "Beginner",
          ],
          [
            "Academy Coaching - Beginner",
            "2027-01-22",
            "09:00",
            "12:30",
            "Bishan Stadium",
            20,
            2,
            "Beginner",
          ],
        ].map((row) => row.map((value) => ({ value }))),
      ],
      columns,
      stickyRowsCount: 1,
    },
  ]).toBlob();
}
