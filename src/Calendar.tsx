import { AssignmentEditor } from "./AssignmentEditor";
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
  const available = state.availability[coachId] ?? [];
  const [slotDate, setSlotDate] = useState<string | null>(null);
  const slotChoices = state.availabilitySlots?.[coachId] ?? {};
  const isAssigned = (id: string) =>
    state.assignments.some(
      (a) => !a.cancelled && a.coachId === coachId && a.sessionId === id,
    );
  const monthKey = format(month, "yyyy-MM");
  const submitted =
    !!state.availabilitySubmissions?.[coachId]?.[monthKey] &&
    (state.availability[coachId] ?? []).some((date) =>
      date.startsWith(monthKey),
    );
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
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const sessions = state.sessions.filter((s) => s.date === selected);
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const assigned = state.assignments.filter(
    (a) => !a.cancelled && a.sessionId === session?.id,
  );
  const assistant = role === "Assistant Coach";
  const head = role === "Head Coach";
  function choose(date: string) {
    if (
      !state.sessions.some((s) => s.date === date) ||
      (assistant && date < now.slice(0, 10))
    )
      return;
    setSelected(date);
    setSessionId("");
    setEditing(false);
    if (
      assistant &&
      state.sessions.some((s) => s.date === date && !isAssigned(s.id))
    )
      setSlotDate(date);
    else if (assistant && hasAssignment(date))
      navigate("/sessions?date=" + date);
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
                      !events.length || (assistant && key < now.slice(0, 10))
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
                          `${assistant && hasAssignment(key) ? "/sessions" : "/programmes"}?date=${key}`,
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
                        title={s.title}
                        key={s.id}
                        to={`${assistant && isAssigned(s.id) ? "/sessions" : "/programmes"}?date=${key}&session=${encodeURIComponent(s.id)}`}
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
              ? "Click a programme date to submit or update its available time slots. Assigned sessions can be changed through My sessions."
              : "Select a programme date to assign coaches."}
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
                <h3>
                  {monthAssigned
                    ? "Programmes assigned"
                    : submitted
                      ? "Pending deployment"
                      : "Click on a date to submit availability"}
                </h3>
                <p className="small">
                  {pendingDates.length} dates pending deployment. Submit or
                  update availability directly from each date.
                </p>
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
                          to={`/programmes?session=${encodeURIComponent(s.id)}`}
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
                    <AssignmentEditor
                      key={session.id}
                      session={session}
                      onClose={() => setEditing(false)}
                    />
                  ) : (
                    <>
                      <h3>
                        Assigned coaches{" "}
                        <span className="count">
                          {assigned.length} coaches · {session.needed} needed
                          per timeslot
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
                              <small>{slotText(a.slots)}</small>
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
          sessions={state.sessions.filter(
            (s) => s.date === slotDate && !isAssigned(s.id),
          )}
          value={slotChoices}
          available={available.includes(slotDate)}
          onClose={() => setSlotDate(null)}
          onSave={async (choices) => {
            const saved = await commit(
              available.includes(slotDate)
                ? "Availability updated"
                : "Availability submitted",
              slotDate,
              (s) => {
                s.availabilitySlots ??= {};
                s.availabilitySlots[coachId] ??= {};
                Object.assign(s.availabilitySlots[coachId], choices);
                const any = s.sessions.some(
                  (p) =>
                    p.date === slotDate &&
                    (s.availabilitySlots?.[coachId]?.[p.id]?.length ?? 0) > 0,
                );
                s.availability[coachId] = [
                  ...new Set([
                    ...(s.availability[coachId] ?? []).filter(
                      (d) => d !== slotDate,
                    ),
                    ...(any ? [slotDate] : []),
                  ]),
                ];
                const key = slotDate.slice(0, 7);
                s.availabilitySubmissions ??= {};
                s.availabilitySubmissions[coachId] ??= {};
                if (s.availability[coachId].some((d) => d.startsWith(key)))
                  s.availabilitySubmissions[coachId][key] = {
                    submittedAt: new Date().toISOString(),
                  };
                else delete s.availabilitySubmissions[coachId][key];
              },
            );
            if (saved) setSlotDate(null);
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
            onClick={async () => {
              if (
                !(await commit(
                  "Change request rejected",
                  request.reason,
                  (s) => {
                    s.requests.find((r) => r.id === requestId)!.status =
                      "Rejected";
                  },
                ))
              )
                return;
              onClose();
            }}
          >
            Reject
          </Button>
          <Button
            onClick={async () => {
              if (
                !(await commit(
                  "Change request approved",
                  request.reason,
                  (s) => {
                    s.requests.find((r) => r.id === requestId)!.status =
                      "Approved";
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
                  },
                ))
              )
                return;
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
  const [tab, setTab] = useState("Assigned");
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
  const hasActiveAssignment = (session: Session) =>
    state.assignments.some(
      (a) =>
        a.sessionId === session.id &&
        !a.cancelled &&
        (role === "Head Coach" || a.coachId === coachId),
    );
  const hasCancelledAssignment = (session: Session) =>
    state.assignments.some(
      (a) =>
        a.sessionId === session.id &&
        a.cancelled &&
        (role === "Head Coach" || a.coachId === coachId),
    );
  const visible = mine.filter((s) => {
    if (linkedDate || linkedSession)
      return (
        (!linkedDate || s.date === linkedDate) &&
        (!linkedSession || s.id === linkedSession)
      );
    if (tab === "Cancelled")
      return hasCancelledAssignment(s) && !hasActiveAssignment(s);
    if (tab === "Pending")
      return (
        !hasActiveAssignment(s) &&
        !hasCancelledAssignment(s) &&
        (role === "Assistant Coach"
          ? isPending(s)
          : state.coaches.some(
              (c) =>
                state.availability[c.id]?.includes(s.date) &&
                (state.availabilitySlots?.[c.id]?.[s.id]?.length ?? 1) > 0,
            ))
      );
    return (
      hasActiveAssignment(s) &&
      (tab === "Completed"
        ? s.date + "T" + s.end <= now
        : s.date + "T" + s.end > now)
    );
  });
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
        {["Assigned", "Pending", "Completed", "Cancelled"].map((t) => (
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
          {linkedDate || linkedSession
            ? "Selected sessions"
            : tab === "Cancelled"
              ? "Cancelled sessions"
              : tab === "Pending"
                ? "Pending sessions"
                : tab === "Completed"
                  ? "Completed sessions"
                  : "My assigned sessions"}
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
              <small>Head coach: {s.headCoachName || "Not assigned"}</small>
            </div>
            <Button onClick={() => setDetail(s)}>View details</Button>
            {role === "Head Coach" ? (
              <Link className="button secondary" to={`/attendance/${s.id}`}>
                Take attendance
              </Link>
            ) : (
              <>
                {tab === "Assigned" &&
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
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reason.trim()) return;
              if (
                !(await commit("Change request submitted", reason, (s) => {
                  s.requests.push({
                    id: crypto.randomUUID(),
                    assignmentId: request,
                    originalSlots: structuredClone(requestAssignment!.slots),
                    requestedSlots: structuredClone(requestedSlots),
                    reason: reason.trim(),
                    status: "Pending",
                  });
                }))
              )
                return;
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
        Submit these time slots directly to the head coach. Reopen this date to
        update them. Clear all slots to withdraw unassigned availability.
      </p>
      <div className="actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onSave(choices)}>
          {available ? "Update availability" : "Submit availability"}
        </Button>
      </div>
    </Modal>
  );
}
