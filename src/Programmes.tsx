import {
  readProgrammeFile,
  templateBlob,
  type ImportResult,
} from "./programmeImport";
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
              <Button onClick={() => setParams({ add: "1" })}>
                Add programme
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCsvImport({ stage: "upload" })}
              >
                Import programmes
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
        <Modal title="Import programmes" onClose={closeCsvImport}>
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

type CsvImportState = { stage: "upload" };
function CsvImportModal({
  onClose,
  commit,
}: {
  state: CsvImportState;
  onStateChange: (s: CsvImportState) => void;
  onClose: () => void;
  commit: ReturnType<typeof useStore>["commit"];
}) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [done, setDone] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    setFilename(file.name);
    try {
      setResult(await readProgrammeFile(file));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read this file. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function downloadTemplate() {
    setBusy(true);
    setError("");
    try {
      const url = URL.createObjectURL(await templateBlob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "programme-import-template.xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError("Could not download the template. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (done && result)
    return (
      <div className="stack">
        <h2>Import complete</h2>
        <p>
          Created {result.validRows.length} programmes. Skipped{" "}
          {result.errors.length} invalid rows.
        </p>
        <Button onClick={onClose}>Done</Button>
      </div>
    );
  return (
    <div className="stack">
      <p>
        Upload Excel (.xlsx) or CSV. Each row creates one programme session. For
        multiple dates, use one row per date.
      </p>
      <p className="small muted">
        The Excel template includes a blank Programmes sheet, instructions and
        examples. Only the Programmes sheet is imported (or the first sheet in
        older workbooks). Dates: YYYY-MM-DD. Times: HH:MM, 24-hour. Excel date
        and time cells also work.
      </p>
      <div>
        <Button variant="secondary" disabled={busy} onClick={downloadTemplate}>
          Download Excel template
        </Button>
      </div>
      <label>
        Excel or CSV file
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p role="status">Preparing file...</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <>
          <p>
            <strong>{filename}</strong>: {result.validRows.length} valid
            programmes
            {result.errors.length > 0 ? `, ${result.errors.length} issues` : ""}
            . Nothing has been imported yet.
          </p>
          {result.errors.length > 0 && (
            <div role="alert" className="card">
              <h3>Fix these issues and upload again</h3>
              <p className="small">
                You can also choose to import only the valid rows below. Invalid
                rows will be skipped.
              </p>
              <ul style={{ maxHeight: 180, overflow: "auto" }}>
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.row ? `Row ${e.row}: ` : "File: "}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.validRows.length > 0 && (
            <div className="table-scroll" style={{ maxHeight: 350 }}>
              <table>
                <thead>
                  <tr>
                    <th>Programme</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Capacity</th>
                    <th>Coaches needed</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  {result.validRows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.title}</td>
                      <td>{row.date}</td>
                      <td>
                        {row.start} - {row.end}
                      </td>
                      <td>{row.venue}</td>
                      <td>{row.capacity}</td>
                      <td>{row.needed}</td>
                      <td>{row.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted">
            Import adds new sessions; it does not update existing programmes.
          </p>
        </>
      )}
      <div className="actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {result && (
          <Button
            disabled={busy || !result.validRows.length}
            onClick={async () => {
              if (
                await commit(
                  "Programmes imported",
                  `${result.validRows.length} programmes from ${filename}`,
                  (s) => {
                    s.sessions.push(
                      ...result.validRows.map((row) => ({
                        ...row,
                        id: crypto.randomUUID(),
                      })),
                    );
                  },
                )
              )
                setDone(true);
            }}
          >
            Import {result?.validRows.length}{" "}
            {result?.errors.length ? "valid programmes only" : "programmes"}
          </Button>
        )}
      </div>
    </div>
  );
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
          onSubmit={async (e) => {
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
            if (
              !(await commit(
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
              ))
            )
              return;
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
