import type { CsvRecord } from "@/shared/lib/csv";
import { excelText } from "@/shared/lib/csv";
import type { ImportUserRow } from "../types";

/**
 * Teacher CSV ↔ import rows. Column headers are matched loosely (case, spaces
 * and punctuation ignored, common synonyms accepted) so a sheet exported from
 * HR or typed by hand usually works as-is. The server re-validates every row.
 */

type Field = keyof Omit<ImportUserRow, "line">;

const ALIASES: Record<Field, string[]> = {
  name: ["name", "fullname", "teachername", "facultyname", "staffname"],
  email: ["email", "emailid", "emailaddress", "mail", "mailid"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "mobileno", "phoneno", "contact", "contactnumber"],
  department: ["department", "dept", "branch"],
  designation: ["designation", "title", "post", "position"],
  role: ["role"],
  password: ["password", "initialpassword"],
};

export const REQUIRED_COLUMNS: Field[] = ["name", "email", "phone", "designation"];
const LABEL: Record<Field, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  department: "Department",
  designation: "Designation",
  role: "Role",
  password: "Password",
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export interface ParsedTeacherCsv {
  rows: ImportUserRow[];
  /** Fields found, in sheet order — for the "columns detected" line. */
  found: string[];
  missing: string[];
  ignored: string[];
}

export function toImportRows(records: CsvRecord[]): ParsedTeacherCsv {
  const [header, ...data] = records;
  if (!header) return { rows: [], found: [], missing: REQUIRED_COLUMNS.map((f) => LABEL[f]), ignored: [] };

  const columnOf: Partial<Record<Field, number>> = {};
  const ignored: string[] = [];
  header.cells.forEach((title, idx) => {
    const key = squash(title);
    const field = (Object.keys(ALIASES) as Field[]).find((f) => ALIASES[f].includes(key));
    if (field && columnOf[field] === undefined) columnOf[field] = idx;
    else if (title.trim()) ignored.push(title.trim());
  });

  const rows = data.map((r) => {
    const get = (f: Field) => {
      const idx = columnOf[f];
      return idx === undefined ? "" : (r.cells[idx] ?? "").trim();
    };
    return {
      line: r.line,
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      department: get("department"),
      designation: get("designation"),
      role: get("role"),
      password: get("password"),
    };
  });

  return {
    rows,
    found: (Object.keys(columnOf) as Field[]).sort((a, b) => columnOf[a]! - columnOf[b]!).map((f) => LABEL[f]),
    missing: REQUIRED_COLUMNS.filter((f) => columnOf[f] === undefined).map((f) => LABEL[f]),
    ignored,
  };
}

export const TEMPLATE_HEADERS = ["Name", "Email", "Phone", "Department", "Designation", "Role", "Password"];

export const TEMPLATE_ROWS = [
  ["Dr. Ramesh Kumar", "ramesh.kumar@college.edu", excelText("9876543210"), "Computer Science", "Associate Professor", "", ""],
  ["Priya Sharma", "priya.sharma@college.edu", excelText("9876501234"), "CSE", "Assistant Professor", "", ""],
  ["Exam Cell Office", "examcell@college.edu", excelText("9876500000"), "", "Other", "Invigilator", ""],
];
