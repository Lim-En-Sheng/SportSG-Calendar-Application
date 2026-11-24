import { useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Link } from "react-router-dom";
import { Badge, Button, Heading, Modal, SessionInfo } from "./components";
import { useStore } from "./store";
import { blocks, slotText } from "./model";
import type { Session } from "./model";

export function Calendar() {
  const { state, role, coachId, commit, now } = useStore();
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [selected, setSelected] = useState("2026-09-19");
  const [sessionId, setSessionId] = useState("s19");
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [available, setAvailable] = useState(state.availability[coachId] ?? []);
  const [newAssignments, setNewAssignments] = useState<
    Record<string, string[]>
  >({});
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const sessions = state.sessions.filter((s) => s.date === selected);
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const assigned = state.assignments.filter(
    (a) => !a.cancelled && a.sessionId === session?.id,
  );
  const candidates = state.coaches.filter(
    (c) =>
      state.availability[c.id]?.includes(selected) ||
      assigned.some((a) => a.coachId === c.id),
  );
  const assistant = role === "Assistant Coach";
  const head = role === "Head Coach";
  function choose(date: string) {
    setSelected(date);
    setSessionId("");
    setEditing(false);
    setPicked([]);
    if (assistant && date >= now.slice(0, 10))
      setAvailable((v) =>
        v.includes(date) ? v.filter((d) => d !== date) : [...v, date],
      );
  }
  return (
    <>
      <Heading
        title={
          assistant
            ? "Set your monthly availability"
            : head
              ? "Deploy your coaching team"
              : "Programme calendar"
        }
        subtitle={
          assistant
            ? "Basketball Academy · Mark the days you can coach"
            : head
              ? "Basketball Academy · Assign available coaches and review change requests."
              : "Basketball Academy · View sessions and manage your programmes."
        }
      />
      <div className="calendar-layout">
        <section className="card calendar-card">
          <div className="row between">
            <h2>{format(month, "MMMM yyyy")}</h2>
            <div className="row">
              <Button
                variant="secondary"
                className="month-control"
                aria-label="Previous month"
                onClick={() => {
                  setMonth(addMonths(month, -1));
                  setSelected("");
                }}
              >
                ‹
              </Button>
              <Button
                variant="secondary"
                className="month-control"
                aria-label="Next month"
                onClick={() => {
                  setMonth(addMonths(month, 1));
                  setSelected("");
                }}
              >
                ›
              </Button>
            </div>
          </div>
          <div className="weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-grid">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd"),
                events = state.sessions.filter((s) => s.date === key);
              return (
                <button
                  type="button"
                  key={key}
                  aria-label={format(day, "EEEE, d MMMM yyyy")}
                  aria-description={
                    events.map((s) => s.title).join("; ") || "No programme"
                  }
                  aria-pressed={selected === key}
                  className={`day ${!isSameMonth(day, month) ? "outside" : ""} ${selected === key ? "selected" : ""} ${assistant && available.includes(key) ? "available" : ""} ${!assistant && events.some((s) => state.assignments.some((a) => !a.cancelled && a.sessionId === s.id)) ? "deployed" : ""}`}
                  onClick={() => choose(key)}
                >
                  <strong>{format(day, "d")}</strong>
                  {events.map((s) => (
                    <span className="day-event" key={s.id}>
                      {s.title}
                    </span>
                  ))}
                  {events.length > 0 && (
                    <span className="day-mobile">
                      {events.length} session{events.length > 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="legend">
            {[
              ["PendingDeployment", "Pending deployment"],
              ["PendingChange", "Pending change"],
              ["AssignedSession", "Assigned session"],
            ].map(([file, title]) => (
              <span key={file}>
                <img src={`/figma/imgColour${file}.svg`} alt="" />
                {title}
              </span>
            ))}
          </div>
          <p className="muted small">
            {assistant
              ? "Select a date to toggle your availability before submitting. Past dates are read-only."
              : "Select a date to assign coaches."}
          </p>
        </section>
        <aside className="card daily-panel">
          {assistant ? (
            <>
              <h2>{state.coaches.find((c) => c.id === coachId)?.name}</h2>
              <p className="small muted">
                Assistant coach · Basketball Academy
              </p>
              <div className="tint stack">
                <h3>Select dates available</h3>
                <p className="small">Submit once for the whole month.</p>
                <Button
                  onClick={() =>
                    commit(
                      "Availability submitted",
                      format(month, "MMMM yyyy"),
                      (s) => {
                        s.availability[coachId] = available;
                      },
                    )
                  }
                >
                  Submit availability
                </Button>
              </div>
              <h3>My assigned sessions</h3>
              {state.assignments
                .filter(
                  (a) =>
                    !a.cancelled &&
                    a.coachId === coachId &&
                    state.sessions
                      .find((s) => s.id === a.sessionId)!
                      .date.startsWith(format(month, "yyyy-MM")),
                )
                .map((a) => (
                  <div className="mini-session" key={a.id}>
                    <strong>
                      {state.sessions.find((s) => s.id === a.sessionId)!.title}
                    </strong>
                    <p>
                      {state.sessions.find((s) => s.id === a.sessionId)!.date} ·{" "}
                      {slotText(a.slots)}
                    </p>
                  </div>
                ))}
              <Link className="text-link" to="/sessions">
                View my sessions
              </Link>
              <h3>My change requests</h3>
              {state.requests
                .filter(
                  (r) =>
                    state.assignments.find((a) => a.id === r.assignmentId)
                      ?.coachId === coachId,
                )
                .map((r) => (
                  <p key={r.id}>
                    {r.reason} · <Badge>{r.status}</Badge>
                  </p>
                ))}
            </>
          ) : (
            <>
              <h2>
                {selected
                  ? format(parseISO(selected), "EEEE, d MMMM")
                  : "Select a date"}
              </h2>
              {!session ? (
                <div className="empty">
                  <p>No programmes on this date.</p>
                  {role === "Admin" && (
                    <Link className="button primary" to="/programmes/new">
                      Add programme
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  {sessions.length > 1 && (
                    <label>
                      Programme
                      <select
                        value={session.id}
                        onChange={(e) => {
                          setSessionId(e.target.value);
                          setEditing(false);
                          setPicked([]);
                        }}
                      >
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <SessionInfo session={session} />
                  {editing ? (
                    <>
                      <h3>Submitted availability · {candidates.length}</h3>
                      <p className="small muted">
                        Select coaches and their assigned time blocks.
                      </p>
                      {candidates.map((c) => {
                        const existing = assigned.some(
                          (a) => a.coachId === c.id,
                        );
                        return (
                          <div key={c.id} className="assignment-choice">
                            <label className="coach-check">
                              {existing ? (
                                <span className="checked-disabled">
                                  <input
                                    type="checkbox"
                                    checked
                                    disabled
                                    aria-label={`${c.name} already assigned`}
                                  />
                                  <img src="/figma/imgFrame.svg" alt="" />
                                </span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={picked.includes(c.id)}
                                  onChange={(e) =>
                                    setPicked(
                                      e.target.checked
                                        ? [...picked, c.id]
                                        : picked.filter((id) => id !== c.id),
                                    )
                                  }
                                />
                              )}
                              <span>{c.name}</span>
                              <small
                                className={existing ? "success-text" : "muted"}
                              >
                                {existing
                                  ? "Already assigned"
                                  : picked.includes(c.id)
                                    ? "Selected"
                                    : "Not assigned"}
                              </small>
                            </label>
                            {!existing && picked.includes(c.id) && (
                              <div className="stack">
                                {blocks(session).map((b) => (
                                  <label className="check-line" key={b.start}>
                                    <input
                                      type="checkbox"
                                      checked={(
                                        newAssignments[c.id] ??
                                        blocks(session).map((x) => x.start)
                                      ).includes(b.start)}
                                      onChange={(e) => {
                                        const previous =
                                          newAssignments[c.id] ??
                                          blocks(session).map((x) => x.start);
                                        setNewAssignments({
                                          ...newAssignments,
                                          [c.id]: e.target.checked
                                            ? [...previous, b.start]
                                            : previous.filter(
                                                (x) => x !== b.start,
                                              ),
                                        });
                                      }}
                                    />
                                    {b.start}–{b.end}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <Button
                        disabled={
                          !picked.length ||
                          picked.some((c) => newAssignments[c]?.length === 0) ||
                          assigned.length + picked.length > session.needed
                        }
                        onClick={() => {
                          commit("Assignments updated", session.title, (s) => {
                            for (const id of picked)
                              s.assignments.push({
                                id: `ATT-${crypto.randomUUID().slice(0, 8)}`,
                                coachId: id,
                                sessionId: session.id,
                                slots: blocks(session).filter((b) =>
                                  (
                                    newAssignments[id] ??
                                    blocks(session).map((x) => x.start)
                                  ).includes(b.start),
                                ),
                              });
                          });
                          setEditing(false);
                          setPicked([]);
                        }}
                      >
                        Submit assignments
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEditing(false)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3>
                        Assigned coaches{" "}
                        <span className="count">
                          {assigned.length}/{session.needed}
                        </span>
                      </h3>
                      <ol className="coach-list">
                        {assigned.map((a) => (
                          <li key={a.id}>
                            {
                              state.coaches.find((c) => c.id === a.coachId)
                                ?.name
                            }
                          </li>
                        ))}
                      </ol>
                      {!assigned.length && (
                        <p className="muted">No coaches assigned yet.</p>
                      )}
                      {head && (
                        <>
                          <Button onClick={() => setEditing(true)}>
                            Update assignments
                          </Button>
                          <Link
                            className="button primary"
                            to={`/attendance/${session.id}`}
                          >
                            Take attendance
                          </Link>
                        </>
                      )}
                      {role === "Admin" && (
                        <Link className="button primary" to="/reports">
                          View reports
                        </Link>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </aside>
      </div>
      {head && <ChangeQueue />}
    </>
  );
}

function ChangeQueue() {
  const { state, commit } = useStore();
  const pending = state.requests.filter((r) => r.status === "Pending");
  return (
    <section className="card requests">
      <h2>Change requests · {pending.length} pending</h2>
      {pending.length === 0 && (
        <p className="small muted">No change requests.</p>
      )}
      {pending.map((r) => {
        const a = state.assignments.find((a) => a.id === r.assignmentId);
        const s = state.sessions.find((s) => s.id === a?.sessionId);
        if (!a || !s) return null;
        return (
          <div className="request-row" key={r.id}>
            <div>
              <strong>
                {state.coaches.find((c) => c.id === a.coachId)?.name} ·{" "}
                {format(parseISO(s.date), "EEE, d MMMM")} · {s.title}
              </strong>
              <p className="small muted">{r.reason}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                commit("Change request rejected", r.reason, (state) => {
                  state.requests.find((x) => x.id === r.id)!.status =
                    "Rejected";
                })
              }
            >
              Reject
            </Button>
            <Button
              onClick={() =>
                commit("Change request approved", r.reason, (state) => {
                  state.requests.find((x) => x.id === r.id)!.status =
                    "Approved";
                  state.assignments.find((x) => x.id === a.id)!.cancelled =
                    true;
                })
              }
            >
              Approve
            </Button>
          </div>
        );
      })}
    </section>
  );
}

export function Sessions() {
  const { state, role, coachId, now, commit } = useStore();
  const [tab, setTab] = useState("Assigned/Pending");
  const [request, setRequest] = useState<string | null>(null);
  const [detail, setDetail] = useState<Session | null>(null);
  const [reason, setReason] = useState("");
  const mine =
    role === "Head Coach"
      ? state.sessions
      : state.sessions.filter((s) =>
          state.assignments.some(
            (a) => a.sessionId === s.id && a.coachId === coachId,
          ),
        );
  const visible = mine.filter((s) =>
    tab === "Cancelled"
      ? state.assignments.some(
          (a) => a.sessionId === s.id && a.coachId === coachId && a.cancelled,
        )
      : state.assignments.some(
          (a) =>
            a.sessionId === s.id &&
            !a.cancelled &&
            (role === "Head Coach" || a.coachId === coachId),
        ) &&
        (tab === "Completed"
          ? `${s.date}T${s.end}` <= now
          : tab === "Assigned/Pending"
            ? `${s.date}T${s.end}` > now
            : false),
  );
  return (
    <>
      <Heading
        title="My sessions"
        subtitle="Manage upcoming sessions and revisit your coaching history."
      />
      {role === "Assistant Coach" && (
        <Link className="button primary" to="/timesheet">
          Verify worked hours
        </Link>
      )}
      <div className="tabs">
        {["Assigned/Pending", "Completed", "Cancelled"].map((t) => (
          <Button
            variant={tab === t ? "primary" : "secondary"}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <section className="stack">
        <h2>
          {tab === "Completed" ? "Completed sessions" : "My assigned sessions"}
        </h2>
        {!visible.length && (
          <div className="card empty">No {tab.toLowerCase()} sessions.</div>
        )}
        {visible.map((s) => (
          <div className="card session-row" key={s.id}>
            <div className="date-block">
              <small>{format(parseISO(s.date), "MMM")}</small>
              <strong>{format(parseISO(s.date), "d")}</strong>
            </div>
            <div className="grow">
              <h3>{s.title}</h3>
              <p>
                {s.start}–{s.end} · {s.venue}
              </p>
              <small>Coach Maya Chen</small>
            </div>
            <Button onClick={() => setDetail(s)}>View details</Button>
            {role === "Head Coach" ? (
              <Link className="button secondary" to={`/attendance/${s.id}`}>
                Take attendance
              </Link>
            ) : (
              <>
                {tab === "Assigned/Pending" && (
                  <Button
                    variant="secondary"
                    disabled={state.requests.some(
                      (r) =>
                        r.status === "Pending" &&
                        r.assignmentId ===
                          state.assignments.find(
                            (a) =>
                              !a.cancelled &&
                              a.sessionId === s.id &&
                              a.coachId === coachId,
                          )?.id,
                    )}
                    onClick={() => {
                      setRequest(
                        state.assignments.find(
                          (a) =>
                            !a.cancelled &&
                            a.sessionId === s.id &&
                            a.coachId === coachId,
                        )!.id,
                      );
                      setReason("");
                    }}
                  >
                    Request change
                  </Button>
                )}
                {tab === "Completed" && (
                  <Link className="button secondary" to="/timesheet">
                    Verify worked hours
                  </Link>
                )}
              </>
            )}
          </div>
        ))}
      </section>
      {request && (
        <Modal
          title="Request a session change"
          onClose={() => setRequest(null)}
        >
          <p>
            Your Head Coach will review your request. Your assignment stays
            active until it is approved.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason.trim()) return;
              commit("Change request submitted", reason, (s) => {
                s.requests.push({
                  id: crypto.randomUUID(),
                  assignmentId: request,
                  reason: reason.trim(),
                  status: "Pending",
                });
              });
              setRequest(null);
            }}
          >
            <label>
              Reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            <div className="actions">
              <Button variant="secondary" onClick={() => setRequest(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!reason.trim()}>
                Submit request
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title="Session details" onClose={() => setDetail(null)}>
          <SessionInfo session={detail} />
          <p>
            Assigned coaches:{" "}
            {state.assignments
              .filter((a) => a.sessionId === detail.id)
              .map((a) => state.coaches.find((c) => c.id === a.coachId)?.name)
              .join(", ") || "None"}
          </p>
        </Modal>
      )}
    </>
  );
}
