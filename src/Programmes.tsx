import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Badge, Button, Heading, SessionInfo, Modal } from "./components";
import { useStore } from "./store";
import type { Session } from "./model";

export function Programmes() {
  const { state, role, commit } = useStore();
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Session | null>(null);
  const [csvImport, setCsvImport] = useState<CsvImportState | null>(null);
  const adding = params.get("add") === "1";
  function closeEditor() {
    setEditing(null);
    setParams({});
  }
  function closeCsvImport() {
    setCsvImport(null);
  }
  const dateFilter = params.get("date");
  const sessionFilter = params.get("session");
  const programmes = state.sessions
    .filter(
      (s) =>
        (!dateFilter || s.date === dateFilter) &&
        (!sessionFilter || s.id === sessionFilter) &&
        `${s.title} ${s.venue}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    );
  const dates = [...new Set(programmes.map((s) => s.date))];
  return (
    <>
      <Heading
        title="Programmes"
        subtitle={
          role === "Admin"
            ? "Create and organise coaching programmes for your academy."
            : "Browse coaching programmes for your academy."
        }
        action={
          role === "Admin" && (
            <div className="row wrap" style={{ gap: "8px" }}>
              <Button onClick={() => setParams({ add: "1" })}>Add programme</Button>
              <Button variant="secondary" onClick={() => setCsvImport({ stage: "upload" })}>
                Import CSV
              </Button>
            </div>
          )
        }
      />
      <label className="search">
        Find programme
        <input
          type="search"
          placeholder="Search programmes or venue"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {(dateFilter || sessionFilter) && (
        <Button variant="secondary" onClick={() => setParams({})}>
          Show all programmes
        </Button>
      )}
      {!programmes.length && (
        <div className="card empty">No matching programmes.</div>
      )}
      {dates.map((date) => (
        <section className="card stack" key={date}>
          <h2>{format(parseISO(date), "EEEE, d MMMM yyyy")}</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Capacity</th>
                  <th>Level</th>
                  <th>Location</th>
                  <th>Date & time</th>
                  {role === "Admin" && (
                    <th className="programme-actions">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {programmes
                  .filter((s) => s.date === date)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.title}</td>
                      <td>{s.capacity} pax</td>
                      <td>{s.level}</td>
                      <td>{s.venue}</td>
                      <td>
                        {format(parseISO(s.date), "d MMM yyyy")}
                        <small className="block">
                          {s.start}–{s.end}
                        </small>
                      </td>
                      {role === "Admin" && (
                        <td className="programme-actions">
                          <Button
                            variant="secondary"
                            onClick={() => setEditing(s)}
                          >
                            Edit
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
            {!programmes.length && (
              <p className="empty">No matching programmes.</p>
            )}
          </div>
        </section>
      ))}
      {role === "Admin" && (adding || editing) && (
        <Modal
          title={editing ? "Edit programme" : "Add programme"}
          onClose={closeEditor}
        >
          <ProgrammeEditor
            key={editing?.id ?? "new"}
            session={editing ?? undefined}
            onClose={closeEditor}
          />
        </Modal>
      )}
      {role === "Admin" && csvImport && (
        <Modal title="Import programmes from CSV" onClose={closeCsvImport}>
          <CsvImportModal
            state={csvImport}
            onStateChange={setCsvImport}
            onClose={closeCsvImport}
            commit={commit}
          />
        </Modal>
      )}
    </>
  );
}

type CsvImportState =
  | { stage: "upload" }
  | {
      stage: "preview";
      rows: CsvRow[];
      validRows: CsvRow[];
      errors: CsvError[];
    }
  | {
      stage: "complete";
      created: number;
      skipped: number;
    };

interface CsvRow {
  title: string;
  date: string;
  start: string;
  end: string;
  venue: string;
  capacity: number;
  needed: number;
  level: string;
  raw: Record<string, string>;
}

interface CsvError {
  row: number;
  message: string;
  data?: CsvRow;
}

function CsvImportModal({
  state,
  onStateChange,
  onClose,
  commit,
}: {
  state: CsvImportState;
  onStateChange: (s: CsvImportState) => void;
  onClose: () => void;
  commit: (action: string, detail: string, fn: (s: any) => void) => void;
}) {
  const fileInputRef = useState<HTMLInputElement | null>(null)[1];

  if (state.stage === "upload") {
    return (
      <div className="card stack">
        <p className="small muted">
          Upload a CSV file with programme data. Each row creates one session.
          Required columns: <strong>title, date, start, end, venue, capacity, needed, level</strong>
        </p>
        <p className="small muted">
          Level must be one of: Beginner, Intermediate, Expert. Date format: YYYY-MM-DD. Time format: HH:MM (24-hour).
        </p>
        <div className="row wrap" style={{ gap: "8px", marginBottom: "8px" }}>
          <Button variant="secondary" onClick={downloadTemplate}>
            Download template
          </Button>
        </div>
        <label>
          CSV file *
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            required
          />
        </label>
        <div className="actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  function downloadTemplate() {
    const template = `title,date,start,end,venue,capacity,needed,level
"Academy Coaching - Beginner",2025-01-15,09:00,10:30,"Bishan Stadium",20,2,Beginner
"Academy Coaching - Intermediate",2025-01-15,11:00,12:30,"Bishan Stadium",25,3,Intermediate
"Academy Coaching - Expert",2025-01-22,14:00,16:00,"OCBC Arena",15,2,Expert`;
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "programme-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (state.stage === "preview") {
    return (
      <div className="card stack">
        <p className="small muted">
          Review the programmes to be imported. Valid rows: <strong>{state.validRows.length}</strong>{" "}
          {state.errors.length > 0 && (
            <span className="error"> · Errors: {state.errors.length}</span>
          )}
        </p>
        {state.errors.length > 0 && (
          <div className="card" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
            <h3 className="error" style={{ marginBottom: "8px" }}>
              Rows with errors (will be skipped):
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              {state.errors.map((e, i) => (
                <li key={i} className="small error">
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="table-scroll" style={{ maxHeight: "400px" }}>
          <table>
            <thead>
              <tr>
                <th>Programme</th>
                <th>Date</th>
                <th>Time</th>
                <th>Venue</th>
                <th>Capacity</th>
                <th>Level</th>
                <th>Coaches</th>
              </tr>
            </thead>
            <tbody>
              {state.validRows.map((row, i) => (
                <tr key={i}>
                  <td>{row.title}</td>
                  <td>{row.date}</td>
                  <td>
                    {row.start}–{row.end}
                  </td>
                  <td>{row.venue}</td>
                  <td>{row.capacity} pax</td>
                  <td>{row.level}</td>
                  <td>{row.needed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => handleImport(state.validRows, onStateChange, onClose, commit)}
            disabled={state.validRows.length === 0}
          >
            Import {state.validRows.length} programme{state.validRows.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    );
  }

  if (state.stage === "complete") {
    return (
      <div className="card stack" style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
        <h2>Import complete</h2>
        <p className="muted">
          Created <strong>{state.created}</strong> programme{state.created !== 1 ? "s" : ""}
          {state.skipped > 0 && (
            <span>, skipped <strong>{state.skipped}</strong> row{state.skipped !== 1 ? "s" : ""}</span>
          )}
        </p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return null;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCsv(text, onStateChange);
    };
    reader.readAsText(file);
  }
}

function parseCsv(text: string, onStateChange: (s: CsvImportState) => void) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    onStateChange({
      stage: "preview",
      rows: [],
      validRows: [],
      errors: [{ row: 0, message: "CSV file is empty or has no data rows" }],
    });
    return;
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const requiredHeaders = ["title", "date", "start", "end", "venue", "capacity", "needed", "level"];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

  if (missingHeaders.length > 0) {
    onStateChange({
      stage: "preview",
      rows: [],
      validRows: [],
      errors: [
        {
          row: 0,
          message: `Missing required columns: ${missingHeaders.join(", ")}`,
        },
      ],
    });
    return;
  }

  const rows: CsvRow[] = [];
  const errors: CsvError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      errors.push({
        row: i + 1,
        message: `Column count mismatch (expected ${headers.length}, got ${values.length})`,
      });
      continue;
    }

    const rowData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowData[h] = values[idx]?.trim() ?? "";
    });

    const validation = validateRow(rowData, i + 1);
    if (validation.error) {
      errors.push({ row: i + 1, message: validation.error, data: validation.row });
    } else if (validation.row) {
      rows.push(validation.row);
    }
  }

  onStateChange({
    stage: "preview",
    rows,
    validRows: rows,
    errors,
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function validateRow(
  data: Record<string, string>,
  _rowNum: number,
): { row?: CsvRow; error?: string } {
  const title = data.title?.trim();
  const date = data.date?.trim();
  const start = data.start?.trim();
  const end = data.end?.trim();
  const venue = data.venue?.trim();
  const capacity = Number(data.capacity);
  const needed = Number(data.needed);
  const level = data.level?.trim();

  if (!title) return { error: "Missing programme name" };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date format (use YYYY-MM-DD)" };
  if (!start || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return { error: "Invalid start time (use HH:MM 24-hour)" };
  if (!end || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return { error: "Invalid end time (use HH:MM 24-hour)" };
  if (start >= end) return { error: "End time must be after start time" };
  if (!venue) return { error: "Missing venue" };
  if (!Number.isInteger(capacity) || capacity < 1) return { error: "Capacity must be a positive integer" };
  if (!Number.isInteger(needed) || needed < 1) return { error: "Coaches needed must be a positive integer" };
  if (!["Beginner", "Intermediate", "Expert"].includes(level)) return { error: "Level must be Beginner, Intermediate, or Expert" };

  return {
    row: {
      title,
      date,
      start,
      end,
      venue,
      capacity,
      needed,
      level,
      raw: data,
    },
  };
}

function handleImport(
  validRows: CsvRow[],
  onStateChange: (s: CsvImportState) => void,
  onClose: () => void,
  commit: (action: string, detail: string, fn: (s: any) => void) => void,
) {
  commit(
    "Programmes imported from CSV",
    `${validRows.length} programmes`,
    (s) => {
      for (const row of validRows) {
        s.sessions.push({
          ...row,
          id: crypto.randomUUID(),
        });
      }
    },
  );
  onStateChange({
    stage: "complete",
    created: validRows.length,
    skipped: 0,
  });
  setTimeout(onClose, 1500);
}

function ProgrammeEditor({
  session,
  onClose,
}: {
  session?: Session;
  onClose: () => void;
}) {
  const { state, commit, now } = useStore();
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const linked =
    !!session && state.assignments.some((a) => a.sessionId === session.id);
  const [value, setValue] = useState<Omit<Session, "id">>(
    session ?? {
      title: "",
      capacity: 20,
      level: "Intermediate",
      venue: "",
      date: now.slice(0, 10),
      start: "09:00",
      end: "10:30",
      needed: 10,
    },
  );
  const [error, setError] = useState("");
  function update<K extends keyof typeof value>(
    key: K,
    next: (typeof value)[K],
  ) {
    setValue({ ...value, [key]: next });
  }
  return (
    <>
      <div className="programme-editor">
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            const dates = [value.date, ...extraDates];
            if (
              new Set(dates).size !== dates.length ||
              dates.some((date) => !date)
            ) {
              setError("Choose a different date for each session.");
              return;
            }
            if (
              linked &&
              session &&
              (value.date !== session.date ||
                value.start !== session.start ||
                value.end !== session.end)
            ) {
              setError(
                "This session has assignment records. Keep its date and time to preserve attendance history.",
              );
              return;
            }
            if (
              session &&
              value.needed <
                state.assignments.filter(
                  (a) => !a.cancelled && a.sessionId === session.id,
                ).length
            ) {
              setError(
                "Coaches needed cannot be less than the number already assigned.",
              );
              return;
            }
            if (
              !value.title.trim() ||
              !value.venue.trim() ||
              !value.date ||
              value.start >= value.end ||
              value.capacity < 1 ||
              value.needed < 1
            ) {
              setError(
                "Complete all fields. End time must be after start time and capacity must be at least 1.",
              );
              return;
            }
            commit(
              session ? "Programme updated" : "Programme created",
              value.title,
              (s) => {
                const details = {
                  ...value,
                  title: value.title.trim(),
                  venue: value.venue.trim(),
                };
                if (session) {
                  const index = s.sessions.findIndex(
                    (entry) => entry.id === session.id,
                  );
                  if (index >= 0)
                    s.sessions[index] = { ...details, id: session.id };
                } else {
                  for (const date of dates)
                    s.sessions.push({
                      ...details,
                      date,
                      id: crypto.randomUUID(),
                    });
                }
              },
            );
            onClose();
          }}
        >
          <h2>Programme details</h2>
          <label>
            Programme name *
            <input
              required
              list="programme-names"
              value={value.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Academy Coaching - Intermediate Programme"
            />
          </label>
          <datalist id="programme-names">
            {[...new Set(state.sessions.map((s) => s.title))]
              .sort()
              .map((name) => (
                <option key={name} value={name} />
              ))}
          </datalist>
          <div className="two-col">
            <label>
              Pax size *
              <input
                type="number"
                min="1"
                max="10000"
                required
                value={value.capacity}
                onChange={(e) => update("capacity", Number(e.target.value))}
              />
            </label>
            <label>
              Level *
              <select
                value={value.level}
                onChange={(e) => update("level", e.target.value)}
              >
                {["Beginner", "Intermediate", "Expert"].map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
          </div>
          <datalist id="programme-locations">
            {[...new Set(state.sessions.map((s) => s.venue))]
              .sort()
              .map((venue) => (
                <option key={venue} value={venue} />
              ))}
          </datalist>
          <label>
            Location *
            <input
              list="programme-locations"
              value={value.venue}
              required
              onChange={(e) => update("venue", e.target.value)}
              placeholder="Bishan Stadium"
            />
          </label>
          <div className="two-col">
            <label>
              Date *
              <input
                disabled={linked}
                type="date"
                required
                value={value.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </label>
            <label>
              Coaches needed *
              <input
                type="number"
                min="1"
                max="1000"
                value={value.needed}
                required
                onChange={(e) => update("needed", Number(e.target.value))}
              />
            </label>
          </div>
          <div className="two-col">
            <label>
              Start time *
              <input
                disabled={linked}
                type="time"
                required
                value={value.start}
                onChange={(e) => update("start", e.target.value)}
              />
            </label>
            <label>
              End time *
              <input
                disabled={linked}
                type="time"
                required
                value={value.end}
                onChange={(e) => update("end", e.target.value)}
              />
            </label>
          </div>
          {!session && (
            <div className="stack">
              {extraDates.map((date, index) => (
                <div className="row" key={index}>
                  <label className="grow">
                    Date {index + 2} *
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) =>
                        setExtraDates(
                          extraDates.map((d, i) =>
                            i === index ? e.target.value : d,
                          ),
                        )
                      }
                    />
                  </label>
                  <Button
                    variant="secondary"
                    aria-label={`Remove date ${index + 2}`}
                    onClick={() =>
                      setExtraDates(extraDates.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => setExtraDates([...extraDates, ""])}
              >
                Add another date
              </Button>
              <p className="small muted">
                Each date creates a session with the same programme details and
                times.
              </p>
            </div>
          )}
          {linked && (
            <p className="small muted">
              Date and time are locked because this session has assignment
              records. Other programme details can be updated.
            </p>
          )}
          <p className="small muted">
            Singapore time (SGT). Assignments can be made in one-hour blocks,
            including the final partial hour.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="actions">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {session ? "Update programme" : "Create programme"}
            </Button>
          </div>
        </form>
        <aside className="card tint stack">
          <small>PROGRAMME PREVIEW</small>
          {value.date ? (
            <SessionInfo
              session={{
                ...value,
                title: value.title || "Your programme name",
                venue: value.venue || "Your venue",
                id: "preview",
              }}
            />
          ) : (
            <p>Select a date to preview the programme.</p>
          )}
          <Badge>
            {value.level} · {value.capacity} pax
          </Badge>
          <p>{value.needed} coaches needed</p>
          <p className="small muted">
            {session
              ? "Changes apply to this session only."
              : `Creating ${1 + extraDates.length} session${extraDates.length ? "s" : ""} with these programme details.`}
          </p>
        </aside>
      </div>
    </>
  );
}

export function Coaches() {
  const { state } = useStore(),
    [query, setQuery] = useState("");
  return (
    <>
      <Heading
        title="Coaches"
        subtitle="Basketball Academy · Your coaching team"
      />
      <label className="search">
        Find coach
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
        />
      </label>
      <section className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>S/N</th>
              <th>Coach</th>
              <th>Assigned sessions</th>
              <th>Availability submitted</th>
            </tr>
          </thead>
          <tbody>
            {state.coaches
              .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
              .map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{c.name}</td>
                  <td>
                    {
                      state.assignments.filter(
                        (a) => !a.cancelled && a.coachId === c.id,
                      ).length
                    }
                  </td>
                  <td>{state.availability[c.id]?.length ?? 0} days</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
