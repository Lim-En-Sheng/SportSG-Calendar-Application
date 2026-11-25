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
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, Heading, Modal, SessionInfo } from "./components";
import { useStore } from "./store";
import { blocks, slotText, assignmentBlocks } from "./model";
import type { Session, Slot } from "./model";

export function Calendar() {
  const { state, role, coachId, commit, now } = useStore();
  const navigate = useNavigate();
  const [viewRequest, setViewRequest] = useState<string | null>(null);
  const requestForDate = (date: string, status: string) =>
    state.requests.some(
      (r) =>
        r.status === status &&
        state.assignments.some(
          (a) =>
            a.id === r.assignmentId &&
            a.coachId === coachId &&
            state.sessions.some((s) => s.id === a.sessionId && s.date === date),
        ),
    );
  const [month, setMonth] = useState(() =>
    startOfMonth(parseISO(now.slice(0, 10))),
  );
  const [selected, setSelected] = useState(() => now.slice(0, 10));
  const [sessionId, setSessionId] = useState("");
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [available, setAvailable] = useState(state.availability[coachId] ?? []);
  const [editingAvailability, setEditingAvailability] = useState<string | null>(
    null,
  );
  const [slotDate, setSlotDate] = useState<string | null>(null);
  const [slotChoices, setSlotChoices] = useState<Record<string, string[]>>(
    state.availabilitySlots?.[coachId] ?? {},
  );
  const monthKey = format(month, "yyyy-MM");
  const submitted =
    !!state.availabilitySubmissions?.[coachId]?.[monthKey] &&
    (state.availability[coachId] ?? []).some((date) =>
      date.startsWith(monthKey),
    );
  const updatingAvailability = editingAvailability === monthKey;
  const savedDates = state.availability[coachId] ?? [];
  const hasAssignment = (date: string) =>
    state.assignments.some(
      (a) =>
        !a.cancelled &&
        a.coachId === coachId &&
        state.sessions.some((s) => s.id === a.sessionId && s.date === date),
    );
  const monthAssigned = state.assignments.some(
    (a) =>
      !a.cancelled &&
      a.coachId === coachId &&
      state.sessions.some(
        (s) => s.id === a.sessionId && s.date.startsWith(monthKey),
      ),
  );
  const pendingDates = savedDates.filter(
    (date) => date.startsWith(monthKey) && !hasAssignment(date),
  );
  const pendingSessions = submitted
    ? state.sessions.filter(
        (s) =>
          s.date.startsWith(monthKey) &&
          savedDates.includes(s.date) &&
          (state.availabilitySlots?.[coachId]?.[s.id]?.length ?? 1) > 0 &&
          !state.assignments.some(
            (a) =>
              !a.cancelled && a.sessionId === s.id && a.coachId === coachId,
          ),
      )
    : [];
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
      (state.availability[c.id]?.includes(selected) &&
        (state.availabilitySlots?.[c.id]?.[session?.id]?.length ?? 1) > 0) ||
      assigned.some((a) => a.coachId === c.id),
  );
  const assistant = role === "Assistant Coach";
  const head = role === "Head Coach";
  function choose(date: string) {
    if (assistant && date < now.slice(0, 10)) return;
    setSelected(date);
    setSessionId("");
    setEditing(false);
    setPicked([]);
    if (
      assistant &&
      !monthAssigned &&
      date.startsWith(monthKey) &&
      date >= now.slice(0, 10) &&
      (!submitted || updatingAvailability) &&
      state.sessions.some((s) => s.date === date)
    )
      setSlotDate(date);
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
                <div className="calendar-cell" key={key}>
                  <button
                    type="button"
                    key={key}
                    aria-label={format(day, "EEEE, d MMMM yyyy")}
                    aria-description={[
                      key < now.slice(0, 10) ? "Past date" : "",
                      events.map((s) => s.title).join("; ") || "No programme",
                    ]
                      .filter(Boolean)
                      .join(". ")}
                    disabled={
                      assistant && (key < now.slice(0, 10) || !events.length)
                    }
                    aria-pressed={
                      assistant
                        ? available.includes(key) || hasAssignment(key)
                        : selected === key
                    }
                    className={`day ${key < now.slice(0, 10) ? "past" : ""} ${!isSameMonth(day, month) ? "outside" : ""} ${!assistant && selected === key ? "selected" : ""} ${assistant && requestForDate(key, "Pending") ? "change-pending-date" : assistant && hasAssignment(key) ? "assigned-date" : assistant && available.includes(key) && !requestForDate(key, "Approved") ? "pending-date" : ""} ${!assistant && events.some((s) => state.assignments.some((a) => !a.cancelled && a.sessionId === s.id)) ? "deployed" : ""}`}
                    onDoubleClick={() => {
                      if (events.length)
                        navigate(
                          `${assistant ? "/sessions" : "/programmes"}?date=${key}`,
                        );
                    }}
                    onClick={() => choose(key)}
                  >
                    <strong>{format(day, "d")}</strong>
                    {events.length > 0 && (
                      <span className="day-mobile">
                        {events.length} session{events.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                  <div className="calendar-event-links">
                    {events.map((s) => (
                      <Link
                        className="day-event"
                        key={s.id}
                        to={`${assistant ? "/sessions" : "/programmes"}?date=${key}&session=${encodeURIComponent(s.id)}`}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        {s.title}
                      </Link>
                    ))}
                  </div>
                </div>
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
              ? monthAssigned
                ? "Programmes assigned. Double-click a programme date or click its name to view details."
                : submitted && !updatingAvailability
                  ? "Selected dates are pending deployment. Use Update availability to change this month."
                  : "Select a date to toggle your availability before submitting. Past dates are read-only."
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
              <div
                className={`tint stack availability-summary ${monthAssigned ? "availability-assigned" : submitted ? "availability-pending" : ""}`}
                aria-label={`Availability for ${format(month, "MMMM yyyy")}`}
              >
                <p className="small">{format(month, "MMMM yyyy")}</p>
                {monthAssigned ? (
                  <>
                    <h3>Programmes assigned</h3>
                    <Button variant="secondary" disabled>
                      Update availability
                    </Button>
                  </>
                ) : submitted && !updatingAvailability ? (
                  <>
                    <h3>Pending</h3>
                    <p className="small">
                      Submitted · {pendingDates.length}{" "}
                      {pendingDates.length === 1 ? "day" : "days"} pending
                      deployment
                    </p>
                    <Button
                      variant="secondary"
                      disabled={monthKey < now.slice(0, 7)}
                      onClick={() => setEditingAvailability(monthKey)}
                    >
                      Update availability
                    </Button>
                  </>
                ) : (
                  <>
                    <h3>
                      {updatingAvailability
                        ? "Update availability"
                        : "Select dates available"}
                    </h3>
                    <p className="small">Submit once for the whole month.</p>
                    <Button
                      disabled={monthKey < now.slice(0, 7)}
                      onClick={() => {
                        commit(
                          "Availability submitted",
                          format(month, "MMMM yyyy"),
                          (s) => {
                            s.availability[coachId] = [
                              ...(s.availability[coachId] ?? []).filter(
                                (date) => !date.startsWith(monthKey),
                              ),
                              ...available.filter((date) =>
                                date.startsWith(monthKey),
                              ),
                            ];
                            s.availabilitySlots ??= {};
                            s.availabilitySlots[coachId] ??= {};
                            for (const programme of s.sessions.filter((entry) =>
                              entry.date.startsWith(monthKey),
                            )) {
                              s.availabilitySlots[coachId][programme.id] =
                                available.includes(programme.date)
                                  ? (slotChoices[programme.id] ??
                                    blocks(programme).map((b) => b.start))
                                  : [];
                            }
                            s.availabilitySubmissions ??= {};
                            s.availabilitySubmissions[coachId] ??= {};
                            if (
                              s.availability[coachId].some((date) =>
                                date.startsWith(monthKey),
                              )
                            ) {
                              s.availabilitySubmissions[coachId][monthKey] = {
                                submittedAt: new Date().toISOString(),
                              };
                            } else {
                              delete s.availabilitySubmissions[coachId][
                                monthKey
                              ];
                            }
                          },
                        );
                        setEditingAvailability(null);
                      }}
                    >
                      Submit availability
                    </Button>
                    {updatingAvailability && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setAvailable((dates) => [
                            ...dates.filter(
                              (date) => !date.startsWith(monthKey),
                            ),
                            ...savedDates.filter((date) =>
                              date.startsWith(monthKey),
                            ),
                          ]);
                          setSlotChoices((choices) => {
                            const restored = { ...choices };
                            for (const s of state.sessions.filter((s) =>
                              s.date.startsWith(monthKey),
                            )) {
                              delete restored[s.id];
                              if (state.availabilitySlots?.[coachId]?.[s.id])
                                restored[s.id] =
                                  state.availabilitySlots[coachId][s.id];
                            }
                            return restored;
                          });
                          setEditingAvailability(null);
                        }}
                      >
                        Cancel update
                      </Button>
                    )}
                  </>
                )}
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
                    <Link
                      className="text-link"
                      to={`/sessions?session=${encodeURIComponent(a.sessionId)}`}
                    >
                      {state.sessions.find((s) => s.id === a.sessionId)!.title}
                    </Link>
                    <p>
                      {state.sessions.find((s) => s.id === a.sessionId)!.date} ·{" "}
                      {slotText(a.slots)}
                    </p>
                  </div>
                ))}
              <Link className="text-link" to="/sessions">
                View my sessions
              </Link>
              {submitted && (
                <>
                  <h3>My pending sessions</h3>
                  {pendingSessions.length ? (
                    pendingSessions.map((s) => (
                      <div className="mini-session" key={s.id}>
                        <Link
                          className="text-link"
                          to={`/sessions?session=${encodeURIComponent(s.id)}`}
                        >
                          {s.title}
                        </Link>
                        <p>
                          {format(parseISO(s.date), "EEE, d MMM")} · {s.start}–
                          {s.end}
                        </p>
                        <p>{s.venue}</p>
                      </div>
                    ))
                  ) : (
                    <p className="small muted">
                      No pending sessions for this month.
                    </p>
                  )}
                </>
              )}
              <h3>My change requests</h3>
              {state.requests
                .filter(
                  (r) =>
                    r.status === "Pending" &&
                    state.assignments.find((a) => a.id === r.assignmentId)
                      ?.coachId === coachId,
                )
                .map((r) => {
                  const a = state.assignments.find(
                    (a) => a.id === r.assignmentId,
                  );
                  const programme = state.sessions.find(
                    (s) => s.id === a?.sessionId,
                  );
                  return programme ? (
                    <div className="mini-session" key={r.id}>
                      <Button
                        variant="link"
                        className="request-title"
                        onClick={() => setViewRequest(r.id)}
                      >
                        {programme.title}
                      </Button>
                      <p>
                        {programme.date} ?{" "}
                        {slotText(r.requestedSlots ?? a?.slots)}
                      </p>
                      <Badge>Pending</Badge>
                    </div>
                  ) : null;
                })}
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
                        Select coaches and their assigned time blocks. Uncheck
                        assigned coaches to unassign them when you submit.
                      </p>
                      {candidates.map((c) => {
                        const existing = assigned.some(
                          (a) => a.coachId === c.id,
                        );
                        return (
                          <div key={c.id} className="assignment-choice">
                            <label className="coach-check">
                              <input
                                type="checkbox"
                                aria-label={c.name}
                                checked={
                                  existing
                                    ? !removed.includes(c.id)
                                    : picked.includes(c.id)
                                }
                                onChange={(e) => {
                                  if (existing)
                                    setRemoved(
                                      e.target.checked
                                        ? removed.filter((id) => id !== c.id)
                                        : [...removed, c.id],
                                    );
                                  else
                                    setPicked(
                                      e.target.checked
                                        ? [...picked, c.id]
                                        : picked.filter((id) => id !== c.id),
                                    );
                                }}
                              />
                              <span>{c.name}</span>
                              <small
                                className={existing ? "success-text" : "muted"}
                              >
                                {existing
                                  ? removed.includes(c.id)
                                    ? "Will be unassigned"
                                    : "Assigned"
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
                                      disabled={
                                        state.availabilitySlots?.[c.id]?.[
                                          session.id
                                        ] !== undefined &&
                                        !state.availabilitySlots[c.id][
                                          session.id
                                        ].includes(b.start)
                                      }
                                      checked={(
                                        newAssignments[c.id] ??
                                        state.availabilitySlots?.[c.id]?.[
                                          session.id
                                        ] ??
                                        blocks(session).map((x) => x.start)
                                      ).includes(b.start)}
                                      onChange={(e) => {
                                        const previous =
                                          newAssignments[c.id] ??
                                          state.availabilitySlots?.[c.id]?.[
                                            session.id
                                          ] ??
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
                          (!picked.length && !removed.length) ||
                          picked.some((c) => newAssignments[c]?.length === 0) ||
                          assigned.length - removed.length + picked.length >
                            session.needed
                        }
                        onClick={() => {
                          commit("Assignments updated", session.title, (s) => {
                            for (const assignment of s.assignments) {
                              if (
                                !assignment.cancelled &&
                                assignment.sessionId === session.id &&
                                removed.includes(assignment.coachId)
                              ) {
                                assignment.cancelled = true;
                                for (const request of s.requests) {
                                  if (
                                    request.assignmentId === assignment.id &&
                                    request.status === "Pending"
                                  )
                                    request.status = "Approved";
                                }
                              }
                            }
                            for (const id of picked)
                              s.assignments.push({
                                id: `ATT-${crypto.randomUUID().slice(0, 8)}`,
                                coachId: id,
                                sessionId: session.id,
                                slots: blocks(session).filter((b) =>
                                  (
                                    newAssignments[id] ??
                                    state.availabilitySlots?.[id]?.[
                                      session.id
                                    ] ??
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
                            <div className="assigned-coach-row">
                              <span>
                                {
                                  state.coaches.find((c) => c.id === a.coachId)
                                    ?.name
                                }
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {!assigned.length && (
                        <p className="muted">No coaches assigned yet.</p>
                      )}
                      {head && (
                        <>
                          <Button
                            onClick={() => {
                              setRemoved([]);
                              setPicked([]);
                              setNewAssignments({});
                              setEditing(true);
                            }}
                          >
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
      {viewRequest && (
        <RequestReview
          requestId={viewRequest}
          onClose={() => setViewRequest(null)}
        />
      )}
      {slotDate && (
        <AvailabilitySlots
          date={slotDate}
          sessions={state.sessions.filter((s) => s.date === slotDate)}
          value={slotChoices}
          available={available.includes(slotDate)}
          onClose={() => setSlotDate(null)}
          onSave={(choices) => {
            setSlotChoices({ ...slotChoices, ...choices });
            const any = Object.values(choices).some((slots) => slots.length);
            setAvailable((dates) =>
              any
                ? [...new Set([...dates, slotDate])]
                : dates.filter((d) => d !== slotDate),
            );
            setSlotDate(null);
          }}
        />
      )}
    </>
  );
}

function ChangeQueue() {
  const { state } = useStore();
  const [review, setReview] = useState<string | null>(null);
  const pending = state.requests.filter((r) => r.status === "Pending");
  return (
    <section className="card requests">
      <h2>Change requests · {pending.length} pending</h2>
      {!pending.length && <p className="small muted">No change requests.</p>}
      {pending.map((r) => {
        const a = state.assignments.find((a) => a.id === r.assignmentId);
        const session = state.sessions.find((s) => s.id === a?.sessionId);
        return a && session ? (
          <div className="request-row" key={r.id}>
            <strong>
              {state.coaches.find((c) => c.id === a.coachId)?.name} ·{" "}
              {session.title} · {session.date}
            </strong>
            <Button onClick={() => setReview(r.id)}>
              Review change request
            </Button>
          </div>
        ) : null;
      })}
      {review && (
        <RequestReview requestId={review} onClose={() => setReview(null)} />
      )}
    </section>
  );
}

function RequestReview({
  requestId,
  onClose,
}: {
  requestId: string;
  onClose: () => void;
}) {
  const { state, role, commit } = useStore();
  const request = state.requests.find((r) => r.id === requestId)!;
  const assignment = state.assignments.find(
    (a) => a.id === request.assignmentId,
  )!;
  const session = state.sessions.find((s) => s.id === assignment.sessionId)!;
  return (
    <Modal title="Change request details" onClose={onClose}>
      <SessionInfo session={session} />
      <div className="two-col">
        <section className="card stack">
          <h3>Original time slots</h3>
          <p>{slotText(request.originalSlots ?? assignment.slots)}</p>
        </section>
        <section className="card stack">
          <h3>Requested time slots</h3>
          <p>{slotText(request.requestedSlots ?? [])}</p>
        </section>
      </div>
      <h3>Reason for change</h3>
      <p>{request.reason}</p>
      <Badge>{request.status}</Badge>
      {role === "Head Coach" && request.status === "Pending" && (
        <div className="actions">
          <Button
            variant="secondary"
            onClick={() => {
              commit("Change request rejected", request.reason, (s) => {
                s.requests.find((r) => r.id === requestId)!.status = "Rejected";
              });
              onClose();
            }}
          >
            Reject
          </Button>
          <Button
            onClick={() => {
              commit("Change request approved", request.reason, (s) => {
                s.requests.find((r) => r.id === requestId)!.status = "Approved";
                const updated = s.assignments.find(
                  (a) => a.id === assignment.id,
                )!;
                const slots = structuredClone(request.requestedSlots ?? []);
                updated.slots = slots;
                updated.cancelled = slots.length === 0;
                s.availabilitySlots ??= {};
                s.availabilitySlots[assignment.coachId] ??= {};
                s.availabilitySlots[assignment.coachId][session.id] = (
                  request.requestedSlots ?? assignment.slots
                ).map((b) => b.start);
              });
              onClose();
            }}
          >
            Approve
          </Button>
        </div>
      )}
    </Modal>
  );
}

export function Sessions() {
  const { state, role, coachId, now, commit } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("Assigned/Pending");
  const linkedDate = params.get("date"),
    linkedSession = params.get("session");
  const isPending = (s: Session) =>
    !!state.availabilitySubmissions?.[coachId]?.[s.date.slice(0, 7)] &&
    !!state.availability[coachId]?.includes(s.date) &&
    (state.availabilitySlots?.[coachId]?.[s.id]?.length ?? 1) > 0;
  const [request, setRequest] = useState<string | null>(null);
  const [detail, setDetail] = useState<Session | null>(null);
  const [reason, setReason] = useState("");
  const [requestedSlots, setRequestedSlots] = useState<Slot[]>([]);
  const requestAssignment = state.assignments.find((a) => a.id === request);
  const requestSession = state.sessions.find(
    (s) => s.id === requestAssignment?.sessionId,
  );
  const mine =
    role === "Head Coach"
      ? state.sessions
      : state.sessions.filter(
          (s) =>
            state.assignments.some(
              (a) => a.sessionId === s.id && a.coachId === coachId,
            ) || isPending(s),
        );
  const visible = mine.filter((s) =>
    linkedDate || linkedSession
      ? (!linkedDate || s.date === linkedDate) &&
        (!linkedSession || s.id === linkedSession)
      : tab === "Cancelled"
        ? state.assignments.some(
            (a) =>
              a.sessionId === s.id &&
              (role === "Head Coach" || a.coachId === coachId) &&
              a.cancelled,
          )
        : (state.assignments.some(
            (a) =>
              a.sessionId === s.id &&
              !a.cancelled &&
              (role === "Head Coach" || a.coachId === coachId),
          ) ||
            (role === "Assistant Coach" && isPending(s))) &&
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
      {(linkedDate || linkedSession) && (
        <Button variant="secondary" onClick={() => setParams({})}>
          Show all my sessions
        </Button>
      )}
      <div className="tabs">
        {["Assigned/Pending", "Completed", "Cancelled"].map((t) => (
          <Button
            variant={tab === t ? "primary" : "secondary"}
            key={t}
            onClick={() => {
              setParams({});
              setTab(t);
            }}
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
                {tab === "Assigned/Pending" &&
                  state.assignments.some(
                    (a) =>
                      !a.cancelled &&
                      a.sessionId === s.id &&
                      a.coachId === coachId,
                  ) && (
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
                        setRequestedSlots(
                          assignmentBlocks(
                            state.assignments.find(
                              (a) =>
                                !a.cancelled &&
                                a.sessionId === s.id &&
                                a.coachId === coachId,
                            )!,
                            s,
                          ),
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
                  originalSlots: structuredClone(requestAssignment!.slots),
                  requestedSlots: structuredClone(requestedSlots),
                  reason: reason.trim(),
                  status: "Pending",
                });
              });
              setRequest(null);
            }}
          >
            {requestSession && (
              <section className="stack">
                <h3>Requested time slots</h3>
                {blocks(requestSession).map((b) => (
                  <label className="check-line" key={b.start}>
                    <input
                      type="checkbox"
                      checked={requestedSlots.some(
                        (slot) => slot.start === b.start && slot.end === b.end,
                      )}
                      onChange={(e) =>
                        setRequestedSlots(
                          e.target.checked
                            ? [...requestedSlots, b].sort((a, b) =>
                                a.start.localeCompare(b.start),
                              )
                            : requestedSlots.filter(
                                (slot) => slot.start !== b.start,
                              ),
                        )
                      }
                    />
                    {b.start}–{b.end}
                  </label>
                ))}
                <p className="small muted">
                  Untick all slots if you cannot attend.
                </p>
              </section>
            )}
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
              .filter((a) => a.sessionId === detail.id && !a.cancelled)
              .map((a) => state.coaches.find((c) => c.id === a.coachId)?.name)
              .join(", ") || "None"}
          </p>
          {state.assignments.some(
            (a) => a.sessionId === detail.id && a.cancelled,
          ) && (
            <p>
              Cancelled assignments:{" "}
              {state.assignments
                .filter((a) => a.sessionId === detail.id && a.cancelled)
                .map(
                  (a) =>
                    `${state.coaches.find((c) => c.id === a.coachId)?.name} (${slotText(a.slots)})`,
                )
                .join(", ")}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function AvailabilitySlots({
  date,
  sessions,
  value,
  available,
  onClose,
  onSave,
}: {
  date: string;
  sessions: Session[];
  value: Record<string, string[]>;
  available: boolean;
  onClose: () => void;
  onSave: (value: Record<string, string[]>) => void;
}) {
  const [choices, setChoices] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      sessions.map((s) => [
        s.id,
        value[s.id] ?? (available ? blocks(s).map((b) => b.start) : []),
      ]),
    ),
  );
  const all = sessions.every((s) =>
    blocks(s).every((b) => choices[s.id].includes(b.start)),
  );
  return (
    <Modal title="Select available time slots" onClose={onClose}>
      <p>{format(parseISO(date), "EEEE, d MMMM yyyy")} (SGT)</p>
      <label className="check-line">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) =>
            setChoices(
              Object.fromEntries(
                sessions.map((s) => [
                  s.id,
                  e.target.checked ? blocks(s).map((b) => b.start) : [],
                ]),
              ),
            )
          }
        />
        Tick all
      </label>
      {sessions.map((s) => (
        <section className="card stack" key={s.id}>
          <h3>{s.title}</h3>
          <p className="small muted">{s.venue}</p>
          {blocks(s).map((b) => (
            <label className="check-line" key={b.start}>
              <input
                type="checkbox"
                checked={choices[s.id].includes(b.start)}
                onChange={(e) =>
                  setChoices({
                    ...choices,
                    [s.id]: e.target.checked
                      ? [...choices[s.id], b.start]
                      : choices[s.id].filter((start) => start !== b.start),
                  })
                }
              />
              {b.start}–{b.end}
            </label>
          ))}
        </section>
      ))}
      <p className="small muted">
        Save your selection, then submit availability for the month. Clear all
        slots to remove this date.
      </p>
      <div className="actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onSave(choices)}>Save time slots</Button>
      </div>
    </Modal>
  );
}
