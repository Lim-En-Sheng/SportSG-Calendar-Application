import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Badge, Button, Heading, Modal, SlotsEditor } from "./components";
import { useStore } from "./store";
import {
  hours,
  isFinalised,
  reportRows,
  sameSlots,
  sheetFingerprint,
  slotText,
  toCsv,
  validateSlots,
} from "./model";
import type { ReportRow, Slot } from "./model";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportActions({
  rows,
  allRows,
  title,
  final,
}: {
  rows: ReportRow[];
  allRows: ReportRow[];
  title: string;
  final: boolean;
}) {
  const { notify } = useStore();
  const [scope, setScope] = useState("filtered");
  const [google, setGoogle] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = scope === "all" ? allRows : rows;
  const values = () => [
    [
      "S/N",
      "Record ID",
      "Coach",
      "Programme",
      "Date",
      "Venue",
      "Deployment slots",
      "Head Coach record",
      "Coach-verified record",
      "Accepted worked slots",
      "Hours",
      "Verification",
      "Resolution reason",
      "Reviewed by",
      "Reviewed at",
    ],
    ...selected.map((r, i) => [
      i + 1,
      r.id,
      r.coach,
      r.programme,
      r.date,
      r.venue,
      slotText(r.assigned),
      slotText(r.head),
      slotText(r.assistant),
      slotText(r.final),
      r.final === undefined ? "" : hours(r.final),
      final && r.final !== undefined ? "Verified" : r.status,
      r.resolved?.reason ?? "",
      r.resolved?.by ?? "",
      r.resolved?.at ?? "",
    ]),
  ];
  const csv = () =>
    download(
      new Blob([toCsv(values())], { type: "text/csv;charset=utf-8" }),
      `${title}.csv`,
    );
  async function excel() {
    setBusy(true);
    try {
      const { default: writeExcel } =
        await import("write-excel-file/universal");
      const blob = await writeExcel(values(), {
        sheet: "Coach Calendar",
        stickyRowsCount: 1,
        columns: Array.from({ length: 15 }, (_, i) => ({
          width: i === 3 ? 55 : 24,
        })),
      }).toBlob();
      download(blob, `${title}.xlsx`);
      notify("Excel workbook downloaded. Open the .xlsx file in Excel.");
    } catch (error) {
      console.error("Excel export failed", error);
      notify("Excel export failed. Please try again, or download the CSV.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="export-section">
      <div className="row between wrap">
        <strong>Export this sheet</strong>
        <div className="row">
          <Button
            variant={scope === "filtered" ? "primary" : "secondary"}
            onClick={() => setScope("filtered")}
          >
            Filtered results ({rows.length})
          </Button>
          <Button
            variant={scope === "all" ? "primary" : "secondary"}
            onClick={() => setScope("all")}
          >
            All rows ({allRows.length})
          </Button>
        </div>
      </div>
      <div className="actions wrap">
        <Button variant="secondary" disabled={busy} onClick={csv}>
          <img src="/figma/imgIconDownloadCsv.svg" alt="" />
          Download .csv
        </Button>
        <Button variant="secondary" disabled={busy} onClick={excel}>
          <img src="/figma/imgIconOpenInExcel.svg" alt="" />
          {busy ? "Preparing workbook…" : "Open in Excel"}
        </Button>
        <Button variant="secondary" onClick={() => setGoogle(true)}>
          <img src="/figma/imgIconOpenInGoogleSheets.svg" alt="" />
          Open in Google Sheets
        </Button>
      </div>
      <p className="small muted">
        Export includes the entire selected result set, not only this page.
        Excel opens from the downloaded workbook.
      </p>
      {google && (
        <Modal title="Open in Google Sheets" onClose={() => setGoogle(false)}>
          <p>
            Download this sheet as a CSV, then import it into Google Sheets
            using <strong>File → Import → Upload</strong>.
          </p>
          <p className="muted">
            Direct Google account integration is not connected in this local
            application.
          </p>
          <div className="actions">
            <Button onClick={csv}>Download CSV for import</Button>
            <a
              className="button secondary"
              href="https://sheets.google.com"
              target="_blank"
              rel="noreferrer"
            >
              Open Google Sheets
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReportTable({
  rows,
  kind,
  start = 0,
  final = false,
  onOpen,
}: {
  rows: ReportRow[];
  kind: string;
  start?: number;
  final?: boolean;
  onOpen: (r: ReportRow) => void;
}) {
  const deployment = kind === "deployment",
    finalView = kind === "final";
  return (
    <div className="table-scroll report-scroll">
      <table>
        <thead>
          <tr>
            <th>S/N</th>
            <th>Coach</th>
            <th>Programme</th>
            <th>Session</th>
            <th>
              {deployment
                ? "Venue"
                : finalView
                  ? "Accepted worked slots"
                  : "Head Coach record"}
            </th>
            <th>
              {deployment
                ? "Assigned by"
                : finalView
                  ? "Deployment comparison"
                  : "Coach-verified record"}
            </th>
            <th>{deployment ? "Deployment" : "Admin verification"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>{start + i + 1}</td>
              <td>
                <button className="cell-link" onClick={() => onOpen(r)}>
                  {r.coach}
                </button>
                <small className="muted block">{r.id}</small>
              </td>
              <td>{r.programme}</td>
              <td>
                {format(parseISO(r.date), "d MMM yyyy")}
                <small className="block muted">{slotText(r.assigned)}</small>
              </td>
              <td>
                {deployment ? r.venue : slotText(finalView ? r.final : r.head)}
                {!deployment && (
                  <small className="block muted">
                    {(finalView ? r.final : r.head) === undefined
                      ? "Awaiting record"
                      : `${hours(finalView ? r.final : r.head)} h recorded`}
                  </small>
                )}
              </td>
              <td>
                {deployment
                  ? r.source
                  : finalView
                    ? !final
                      ? "Awaiting final verification"
                      : r.final && sameSlots(r.assigned, r.final)
                        ? "Matches deployment"
                        : "Deployment differs"
                    : slotText(r.assistant)}
                {!deployment && !finalView && r.assistant !== undefined && (
                  <small className="block muted">
                    {hours(r.assistant)} h submitted
                  </small>
                )}
              </td>
              <td>
                {deployment ? (
                  <Badge tone={r.assigned.length ? "success" : "warning"}>
                    {r.assigned.length ? "Assigned" : "Last-minute"}
                  </Badge>
                ) : (
                  <button className="cell-link" onClick={() => onOpen(r)}>
                    <Badge tone={r.final !== undefined ? "success" : "warning"}>
                      {final ? "Verified" : r.status}
                    </Badge>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">No records match these filters.</div>
      )}
    </div>
  );
}

export function Reports() {
  const { state, commit, now, notify } = useStore();
  const [params, setParams] = useSearchParams();
  const sheet = params.get("sheet") ?? "overview";
  const month = params.get("month") ?? "2026-09";
  const query = params.get("q") ?? "",
    coach = params.get("coach") ?? "",
    programme = params.get("programme") ?? "",
    date = params.get("date") ?? "",
    status = params.get("status") ?? "";
  const [size, setSize] = useState(50),
    [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null),
    [resolve, setResolve] = useState(false);
  const [decision, setDecision] = useState(""),
    [slots, setSlots] = useState<Slot[]>([]),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const [verify, setVerify] = useState(false);
  const all = useMemo(
    () => reportRows(state).filter((r) => r.date.startsWith(month)),
    [state, month],
  );
  const completed = all.filter((r) => {
    const a = state.assignments.find((a) => a.id === r.id)!,
      s = state.sessions.find((s) => s.id === a.sessionId)!;
    return `${s.date}T${s.end}` <= now;
  });
  const final = isFinalised(state, month, completed);
  const differences = completed.filter((r) => r.final === undefined);
  const base =
    sheet === "deployment"
      ? all
      : sheet === "differences"
        ? differences
        : completed;
  const filtered = base.filter(
    (r) =>
      (!query ||
        `${r.id} ${r.coach} ${r.programme}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!coach || r.coachId === coach) &&
      (!programme || r.programme === programme) &&
      (!date || r.date === date) &&
      (!status || (final ? "Verified" : r.status) === status),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size)),
    current = Math.min(page, pages);
  const row = all.find((r) => r.id === detail);
  const assignment = state.assignments.find((a) => a.id === detail),
    session = state.sessions.find((s) => s.id === assignment?.sessionId);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
    setPage(1);
  }
  const open = (r: ReportRow) => {
    setDetail(r.id);
    setResolve(false);
    setDecision("");
    setSlots([]);
    setReason("");
    setError("");
  };
  function resolveRecord() {
    if (!row || !session) return;
    const problem = validateSlots(slots, session, true);
    if (problem) {
      setError(problem);
      return;
    }
    if (!reason.trim() || !decision) return;
    commit(
      "Attendance difference resolved",
      `${row.coach} · ${row.date}`,
      (s) => {
        s.resolutions[row.id] = {
          slots,
          reason: reason.trim(),
          by: "Admin",
          at: new Date().toISOString(),
          fingerprint: row.fingerprint,
        };
      },
    );
    setDetail(null);
  }
  const label =
    sheet === "overview"
      ? "Reports"
      : sheet === "deployment"
        ? "Deployment sheet"
        : sheet === "differences"
          ? "Resolve attendance differences"
          : sheet === "final"
            ? "Final attendance sheet"
            : "Attendance reconciliation";
  return (
    <>
      {sheet !== "overview" && (
        <Link className="text-link" to={`/reports?month=${month}`}>
          Back to reports overview
        </Link>
      )}
      <Heading
        title={label}
        subtitle={
          sheet === "overview"
            ? "Monthly overview · Open a sheet to search, filter, review and export records."
            : `${format(parseISO(month + "-01"), "MMMM yyyy")} · Two source records · Differences require Admin resolution`
        }
        action={
          <label className="month-label">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) =>
                e.target.value && change("month", e.target.value)
              }
            />
          </label>
        }
      />
      {sheet === "overview" ? (
        <>
          <div className="notice info">
            <h3>Automatic verification</h3>
            <p>
              Assistant Coaches verify their worked time slots. Admin compares
              submitted timesheets with Head Coach attendance, resolves
              differences while retaining both sources, and verifies one final
              attendance sheet for deployment comparison.
            </p>
          </div>
          <section className="card stack">
            <h2>Admin attendance review</h2>
            <p className="muted">
              {differences.length} source differences · Admin resolution
              required before final-sheet verification
            </p>
            <ReportTable
              rows={differences.slice(0, 3)}
              kind="attendance"
              onOpen={open}
            />
            <Button onClick={() => change("sheet", "differences")}>
              Review {differences.length} differences
            </Button>
          </section>
          {[
            ["deployment", "Deployment sheet", all],
            ["attendance", "Attendance reconciliation", completed],
          ].map(([kind, title, records]) => (
            <section className="card stack" key={String(kind)}>
              <h2>{String(title)}</h2>
              <p className="small muted">
                {(records as ReportRow[]).length} records · Preview of first 3 ·{" "}
                {format(parseISO(month + "-01"), "MMMM yyyy")}
              </p>
              <ReportTable
                rows={(records as ReportRow[]).slice(0, 3)}
                kind={String(kind)}
                final={final}
                onOpen={open}
              />
              <Button onClick={() => change("sheet", String(kind))}>
                View full sheet
              </Button>
              <ExportActions
                rows={records as ReportRow[]}
                allRows={records as ReportRow[]}
                title={`${kind}-${month}`}
                final={final}
              />
            </section>
          ))}
        </>
      ) : (
        <>
          <div className="tabs">
            {[
              ["deployment", `Deployment · ${all.length}`],
              ["attendance", `Attendance · ${completed.length}`],
              ["final", "Final attendance"],
            ].map(([key, title]) => (
              <Button
                key={key}
                variant={sheet === key ? "primary" : "secondary"}
                onClick={() => change("sheet", key)}
              >
                {title}
              </Button>
            ))}
          </div>
          {sheet !== "deployment" && (
            <div className="row wrap">
              <Button
                variant="secondary"
                onClick={() => change("sheet", "differences")}
              >
                Review differences ({differences.length})
              </Button>
              <Button
                disabled={!completed.length || differences.length > 0 || final}
                onClick={() => setVerify(true)}
              >
                {final
                  ? "Final sheet verified"
                  : differences.length
                    ? "Resolve differences first"
                    : "Verify final sheet"}
              </Button>
            </div>
          )}
          <div className="filters">
            <label className="search">
              Search
              <input
                type="search"
                placeholder="Search coach, programme or ID"
                value={query}
                onChange={(e) => change("q", e.target.value)}
              />
            </label>
            <label>
              Coach
              <select
                value={coach}
                onChange={(e) => change("coach", e.target.value)}
              >
                <option value="">All coaches</option>
                {state.coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Programme
              <select
                value={programme}
                onChange={(e) => change("programme", e.target.value)}
              >
                <option value="">All programmes</option>
                {[...new Set(all.map((r) => r.programme))].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => change("date", e.target.value)}
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => change("status", e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  "Missing source",
                  "Admin review",
                  "Matched · to verify",
                  "Resolved · to verify",
                  "Verified",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <section className="card stack">
            <ReportTable
              rows={filtered.slice((current - 1) * size, current * size)}
              kind={sheet}
              start={(current - 1) * size}
              final={final}
              onOpen={open}
            />
            <div className="row between wrap">
              <p className="muted small">
                Showing {filtered.length ? (current - 1) * size + 1 : 0}–
                {Math.min(current * size, filtered.length)} of {filtered.length}
              </p>
              <div className="row wrap">
                <select
                  aria-label="Rows per page"
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} rows per page
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </Button>
                <span>
                  {current} / {pages}
                </span>
                <Button
                  variant="secondary"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
            <ExportActions
              rows={filtered}
              allRows={base}
              title={`${sheet}-${month}`}
              final={final}
            />
          </section>
        </>
      )}
      {row && session && (
        <Modal
          title={
            resolve ? "Resolve attendance difference" : "Attendance record"
          }
          onClose={() => setDetail(null)}
        >
          <h3>
            {row.coach} · {row.programme}
          </h3>
          <p>
            {row.date} · {row.id}
          </p>
          <div className="notice neutral">
            <h3>HEAD COACH ATTENDANCE</h3>
            <p>{slotText(row.head)}</p>
            <h3>COACH-VERIFIED TIMESHEET</h3>
            <p>{slotText(row.assistant)}</p>
            <p className="small muted">{state.drafts[row.id]?.explanation}</p>
          </div>
          {row.resolved && (
            <div className="notice success">
              <strong>Admin resolution: {slotText(row.resolved.slots)}</strong>
              <p>{row.resolved.reason}</p>
              <small>
                {row.resolved.by} · {row.resolved.at}
              </small>
            </div>
          )}
          {resolve ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resolveRecord();
              }}
            >
              <label>
                Admin resolution
                <select
                  value={decision}
                  onChange={(e) => {
                    setDecision(e.target.value);
                    setSlots(
                      e.target.value === "head"
                        ? (row.head ?? [])
                        : e.target.value === "coach"
                          ? (row.assistant ?? [])
                          : [{ start: session.start, end: session.end }],
                    );
                  }}
                  required
                >
                  <option value="">Select a decision</option>
                  <option value="head" disabled={row.head === undefined}>
                    Accept Head Coach hours
                  </option>
                  <option value="coach" disabled={row.assistant === undefined}>
                    Accept coach hours
                  </option>
                  <option value="corrected">Enter corrected hours</option>
                </select>
              </label>
              <h3>Final worked time (Admin resolution)</h3>
              {decision === "corrected" ? (
                <SlotsEditor
                  value={slots}
                  onChange={setSlots}
                  min={session.start}
                  max={session.end}
                />
              ) : (
                <p>
                  {decision
                    ? slotText(slots)
                    : "Select a decision to continue."}
                </p>
              )}
              <label>
                Reason / evidence (required)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="Explain your decision and record the evidence reviewed."
                />
              </label>
              <p className="small muted">
                Both original source records are retained. Saving records the
                accepted slots, reason, Admin and timestamp.
              </p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="actions">
                <Button variant="secondary" onClick={() => setDetail(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!decision || !reason.trim()}>
                  Save resolution
                </Button>
              </div>
            </form>
          ) : (
            <>
              <p>
                <strong>Accepted worked slots:</strong> {slotText(row.final)}
              </p>
              <p>
                <strong>Deployed slots:</strong> {slotText(row.assigned)}
              </p>
              <div className="actions">
                <Button variant="secondary" onClick={() => setDetail(null)}>
                  Close
                </Button>
                {row.final === undefined &&
                  completed.some((r) => r.id === row.id) && (
                    <Button onClick={() => setResolve(true)}>
                      Resolve difference
                    </Button>
                  )}
              </div>
            </>
          )}
        </Modal>
      )}
      {verify && (
        <Modal
          title="Verify final attendance sheet"
          onClose={() => setVerify(false)}
        >
          <p>
            Verify {completed.length} completed attendance records for{" "}
            {format(parseISO(month + "-01"), "MMMM yyyy")}? All source
            differences have been resolved.
          </p>
          <p>
            The verified sheet will be used for deployment comparison. Source
            edits or a revised timesheet require a new verification.
          </p>
          <div className="actions">
            <Button variant="secondary" onClick={() => setVerify(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (differences.length || !completed.length) {
                  notify("Resolve all differences before verifying.");
                  return;
                }
                commit("Final attendance sheet verified", month, (s) => {
                  s.finalised[month] = {
                    fingerprint: sheetFingerprint(completed),
                    at: new Date().toISOString(),
                  };
                });
                setVerify(false);
                change("sheet", "final");
              }}
            >
              Verify final sheet
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
