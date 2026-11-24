import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Badge, Button, Heading, SessionInfo } from "./components";
import { useStore } from "./store";
import type { Session } from "./model";

export function Programmes() {
  const { state, role } = useStore();
  const [query, setQuery] = useState("");
  const programmes = state.sessions.filter((s) =>
    `${s.title} ${s.venue}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Heading
        title={role === "Admin" ? "Manage programmes" : "Programmes"}
        subtitle="Create and organise coaching programmes for your academy."
        action={
          role === "Admin" && (
            <Link className="button primary" to="/programmes/new">
              Add programme
            </Link>
          )
        }
      />
      <div className="notice tint">
        {state.sessions.length} programme entries ·{" "}
        {new Set(state.sessions.map((s) => s.title)).size} programme titles
      </div>
      <label className="search">
        Find programme
        <input
          type="search"
          placeholder="Search programmes or venue"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <section className="card stack">
        <h2>Programmes · {programmes.length} entries</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Programme</th>
                <th>Capacity</th>
                <th>Level</th>
                <th>Location</th>
                <th>Date & time</th>
              </tr>
            </thead>
            <tbody>
              {programmes.map((s) => (
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
                </tr>
              ))}
            </tbody>
          </table>
          {!programmes.length && (
            <p className="empty">No matching programmes.</p>
          )}
        </div>
      </section>
    </>
  );
}

export function CreateProgramme() {
  const { commit } = useStore(),
    navigate = useNavigate();
  const [value, setValue] = useState<Omit<Session, "id">>({
    title: "",
    capacity: 20,
    level: "Intermediate",
    venue: "",
    date: "2026-10-03",
    start: "09:00",
    end: "10:30",
    needed: 10,
  });
  const [error, setError] = useState("");
  function update<K extends keyof typeof value>(
    key: K,
    next: (typeof value)[K],
  ) {
    setValue({ ...value, [key]: next });
  }
  return (
    <>
      <Heading
        title="Add programme"
        subtitle="Customise the programme details below. All fields are required."
        action={
          <Link className="button secondary" to="/programmes">
            Back to programmes
          </Link>
        }
      />
      <div className="form-layout">
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
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
            commit("Programme created", value.title, (s) => {
              s.sessions.push({
                ...value,
                title: value.title.trim(),
                venue: value.venue.trim(),
                id: crypto.randomUUID(),
              });
            });
            navigate("/programmes");
          }}
        >
          <h2>Programme details</h2>
          <label>
            Programme name *
            <input
              required
              value={value.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Academy Coaching - Intermediate Programme"
            />
          </label>
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
          <label>
            Location *
            <input
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
                type="time"
                required
                value={value.start}
                onChange={(e) => update("start", e.target.value)}
              />
            </label>
            <label>
              End time *
              <input
                type="time"
                required
                value={value.end}
                onChange={(e) => update("end", e.target.value)}
              />
            </label>
          </div>
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
            <Link className="button secondary" to="/programmes">
              Cancel
            </Link>
            <Button type="submit">Create programme</Button>
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
            Review the details before creating your programme.
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
