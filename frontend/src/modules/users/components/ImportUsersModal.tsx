import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button, Input, Modal, ErrorAlert } from "@/shared/components";
import { downloadCsv, excelText, parseCsv } from "@/shared/lib/csv";
import { useImportUsers } from "../hooks";
import type { ImportRowResult, ImportUserRow, ImportUsersResult } from "../types";
import { TEMPLATE_HEADERS, TEMPLATE_ROWS, toImportRows, type ParsedTeacherCsv } from "../utils/teacherCsv";

interface ImportUsersModalProps {
  open: boolean;
  onClose: () => void;
}

const MAX_BYTES = 2 * 1024 * 1024;

const STATUS_CHIP: Record<ImportRowResult["status"], { label: string; className: string }> = {
  create: { label: "Ready", className: "bg-green-50 text-green-700" },
  created: { label: "Added", className: "bg-green-50 text-green-700" },
  exists: { label: "Already exists", className: "bg-amber-50 text-amber-700" },
  error: { label: "Needs fixing", className: "bg-red-50 text-red-700" },
};

/**
 * CS bulk-adds teachers from a CSV: pick a file → check every row on the
 * server (nothing is created) → import the valid ones. Rows that fail can be
 * downloaded with the reason, fixed and uploaded again — existing emails are
 * skipped, so re-uploading the whole file is safe.
 */
export default function ImportUsersModal({ open, onClose }: ImportUsersModalProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedTeacherCsv | null>(null);
  const [fileError, setFileError] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [result, setResult] = useState<ImportUsersResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const importMutation = useImportUsers();

  const reset = () => {
    setFileName("");
    setParsed(null);
    setFileError("");
    setDefaultPassword("");
    setResult(null);
    importMutation.reset();
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    importMutation.reset();
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setFileError("Please choose a .csv file. In Excel or Google Sheets: File → Download / Save as → CSV.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("That file is over 2 MB — split it into smaller files.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const sheet = toImportRows(parseCsv(String(reader.result ?? "")));
      setFileName(file.name);
      setParsed(sheet);
      setFileError(
        sheet.missing.length
          ? `Missing column${sheet.missing.length > 1 ? "s" : ""}: ${sheet.missing.join(", ")}. Download the template to see the expected headers.`
          : sheet.rows.length === 0
            ? "The file has a header row but no teachers under it."
            : ""
      );
    };
    reader.onerror = () => setFileError("Couldn't read that file.");
    reader.readAsText(file);
  };

  const rowsWithoutPassword = parsed?.rows.filter((r) => !r.password).length ?? 0;
  const needsDefault = rowsWithoutPassword > 0;
  const passwordOk = !needsDefault || defaultPassword.length >= 6;
  const canCheck = !!parsed && !fileError && parsed.rows.length > 0 && passwordOk;

  const run = (dryRun: boolean) => {
    if (!parsed) return;
    importMutation.mutate(
      { rows: parsed.rows, defaultPassword: defaultPassword || undefined, dryRun },
      { onSuccess: setResult }
    );
  };

  const downloadProblems = () => {
    if (!parsed || !result) return;
    const problems = new Map(result.results.filter((r) => r.status === "error").map((r) => [r.line, r.message ?? ""]));
    const rows = parsed.rows
      .filter((r) => problems.has(r.line))
      .map((r: ImportUserRow) => [
        r.name,
        r.email,
        excelText(r.phone),
        r.department,
        r.designation,
        r.role,
        r.password,
        `Row ${r.line}: ${problems.get(r.line)}`,
      ]);
    downloadCsv("teachers-to-fix.csv", [...TEMPLATE_HEADERS, "Problem"], rows);
  };

  const done = result && !result.dryRun;
  const s = result?.summary;

  return (
    <Modal open={open} onClose={close} title="Import teachers from CSV" size="xl">
      {importMutation.isError && <ErrorAlert message={importMutation.error.message} />}

      {!done && (
        <div className="space-y-5">
          {/* Step 1 — the file */}
          <div
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragging(false);
              readFile(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50"
            }`}
          >
            <p className="text-sm text-gray-700">
              {fileName ? (
                <>
                  <span className="font-semibold">{fileName}</span>
                  {parsed && !fileError ? ` — ${parsed.rows.length} teacher${parsed.rows.length === 1 ? "" : "s"} found` : ""}
                </>
              ) : (
                "Drop a .csv file here, or"
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
                {fileName ? "Choose another file" : "Choose file"}
              </Button>
              <button
                type="button"
                onClick={() => downloadCsv("teachers-template.csv", TEMPLATE_HEADERS, TEMPLATE_ROWS)}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Download template
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => readFile(e.target.files?.[0])}
            />
          </div>

          {fileError && <ErrorAlert message={fileError} />}

          {!parsed && (
            <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-800">Columns</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <b>Required:</b> Name, Email, Phone, Designation (HOD/Dean, Professor, Associate Professor, Assistant
                  Professor or Other)
                </li>
                <li>
                  <b>Optional:</b> Department (name or code, must already exist), Role (only for “Other”: CS, DCS, RS or
                  Invigilator), Password
                </li>
                <li>Roles come from the designation, exactly as when you add a teacher by hand.</li>
              </ul>
            </div>
          )}

          {/* Step 2 — password + check */}
          {parsed && !fileError && (
            <>
              <p className="text-xs text-gray-500">
                Columns detected: {parsed.found.join(", ")}
                {parsed.ignored.length ? ` · ignored: ${parsed.ignored.join(", ")}` : ""}
              </p>

              {needsDefault && (
                <div className="max-w-sm">
                  <Input
                    label={`Starting password for ${
                      rowsWithoutPassword === parsed.rows.length ? "everyone" : `the ${rowsWithoutPassword} without one`
                    }`}
                    type="text"
                    value={defaultPassword}
                    onChange={(e) => {
                      setDefaultPassword(e.target.value);
                      setResult(null);
                    }}
                    placeholder="Min. 6 characters"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Share it with these teachers so they can sign in.
                  </p>
                </div>
              )}

              {result?.dryRun && s && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-700">{s.ready} ready</span>
                    {s.skipped > 0 && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                        {s.skipped} already exist (skipped)
                      </span>
                    )}
                    {s.errors > 0 && (
                      <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">{s.errors} need fixing</span>
                    )}
                  </div>
                  <ResultTable results={result.results} />
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={close}>
                  Cancel
                </Button>
                {result?.dryRun ? (
                  <Button
                    type="button"
                    onClick={() => run(false)}
                    isLoading={importMutation.isPending}
                    disabled={!s || s.ready === 0}
                  >
                    {s && s.ready > 0 ? `Import ${s.ready} teacher${s.ready === 1 ? "" : "s"}` : "Nothing to import"}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => run(true)} isLoading={importMutation.isPending} disabled={!canCheck}>
                    Check {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 — done */}
      {done && s && (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
            <p className="font-semibold">
              Added {s.created} teacher{s.created === 1 ? "" : "s"}.
            </p>
            <p className="mt-1">
              {s.skipped > 0 ? `${s.skipped} already had an account and ${s.skipped === 1 ? "was" : "were"} skipped. ` : ""}
              {s.errors > 0
                ? `${s.errors} row${s.errors === 1 ? "" : "s"} still need fixing — download them, fix, and import that file.`
                : "Every row went through."}
            </p>
          </div>
          <ResultTable results={result.results} />
          <div className="flex flex-wrap justify-end gap-3">
            {s.errors > 0 && (
              <Button type="button" variant="secondary" onClick={downloadProblems}>
                Download rows to fix
              </Button>
            )}
            <Button type="button" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ResultTable({ results }: { results: ImportRowResult[] }) {
  // Problems first, so the CS sees what to fix without scrolling.
  const order = { error: 0, exists: 1, create: 2, created: 2 } as const;
  const sorted = [...results].sort((a, b) => order[a.status] - order[b.status] || a.line - b.line);
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((r) => (
            <tr key={`${r.line}-${r.email}`} className="align-top">
              <td className="px-3 py-2 tabular-nums text-gray-500">{r.line}</td>
              <td className="px-3 py-2 text-gray-800">{r.name || "—"}</td>
              <td className="px-3 py-2 text-gray-600">{r.email || "—"}</td>
              <td className="px-3 py-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[r.status].className}`}>
                  {STATUS_CHIP[r.status].label}
                </span>
                {r.message ? <p className="mt-1 text-xs text-gray-500">{r.message}</p> : null}
                {r.status !== "error" && r.status !== "exists" && r.designation ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {r.designation}
                    {r.department ? ` · ${r.department}` : ""}
                    {r.roles?.length ? ` · ${r.roles.map((x) => x.toUpperCase()).join(", ")}` : ""}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
