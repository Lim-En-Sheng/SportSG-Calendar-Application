import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Heading, Modal, SessionInfo, SlotsEditor } from "./components";
import { useStore } from "./store";
import {
  assignmentBlocks,
  blocks,
  hours,
  slotKey,
  validateSlots,
} from "./model";
import type { Mark, Slot } from "./model";

export function Attendance() {
  const { sessionId } = useParams();
  const { state, commit, now } = useStore();
  const session = state.sessions.find((s) => s.id === sessionId);
  const [marks, setMarks] = useState<Record<string, Record<string, Mark>>>({});
  const [notes, setNotes] = useState(() => {
    const first = state.assignments.find(
      (a) => a.sessionId === sessionId && !a.cancelled,
    );
    return first ? (state.attendance[first.id]?.notes ?? "") : "";
  });
  const [notesChanged, setNotesChanged] = useState(false);
  const [add, setAdd] = useState(false);
  const [coach, setCoach] = useState("c4");
  const [slots, setSlots] = useState<Slot[]>([
    { start: "10:00", end: "11:00" },
  ]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!session)
    return (
      <div className="card empty">
        Session not found. <Link to="/calendar">Back to calendar</Link>
      </div>
    );
  const assigned = state.assignments.filter(
    (a) => !a.cancelled && a.sessionId === session.id,
  );
  const started = `${session.date}T${session.start}` <= now;
  const dirty = Object.keys(marks).length > 0 || notesChanged;
  const openAdd = () => {
    setSlots([{ start: session.start, end: blocks(session)[0].end }]);
    setError("");
    setAdd(true);
  };
  function save() {
    commit("Attendance saved", session!.title, (s) => {
      for (const a of assigned)
        s.attendance[a.id] = {
          marks: marks[a.id] ?? s.attendance[a.id]?.marks ?? {},
          notes: notesChanged ? notes : (s.attendance[a.id]?.notes ?? ""),
          savedAt: new Date().toISOString(),
        };
    });
    setMarks({});
    setNotesChanged(false);
  }
  return (
    <>
      <Link className="text-link" to="/calendar">
        Back to assigned coaches
      </Link>
      <Heading
        title="Take coach attendance"
        subtitle="Record attendance for each assigned hour, and add any last-minute cover."
      />
      <SessionInfo session={session} />
      {!started && (
        <div className="notice info">
          Attendance opens when this session starts.
        </div>
      )}
      <section className="card stack">
        <div className="row between">
          <h2>Attendance by hour</h2>
          <Button disabled={!started} onClick={openAdd}>
            Add coach
          </Button>
        </div>
        <p className="muted">
          Mark only the time blocks assigned to each coach. Not assigned and Not
          marked do not mean absent.
        </p>
        <div className="table-scroll">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Coach</th>
                {blocks(session).map((b) => (
                  <th key={b.start}>
                    {b.start}–{b.end}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assigned.map((a, i) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td>
                    <strong>
                      {state.coaches.find((c) => c.id === a.coachId)?.name}
                    </strong>
                    <p className="small muted">
                      {a.lastMinute ? "Last-minute cover" : "Assigned coach"}
                    </p>
                    {a.reason && <small>{a.reason}</small>}
                  </td>
                  {blocks(session).map((b) => {
                    const covered = assignmentBlocks(a, session).filter(
                      (x) => x.start >= b.start && x.end <= b.end,
                    );
                    return (
                      <td key={b.start}>
                        {!covered.length ? (
                          <div className="hour-cell muted">Not assigned</div>
                        ) : (
                          covered.map((part) => {
                            const key = slotKey(part),
                              mark =
                                marks[a.id]?.[key] ??
                                state.attendance[a.id]?.marks[key] ??
                                "Not marked";
                            return (
                              <div
                                key={key}
                                className={`hour-cell ${mark === "Present" ? "present" : mark === "Absent" ? "absent" : ""}`}
                              >
                                <small>
                                  {part.start}–{part.end} · {mark}
                                </small>
                                <div className="row">
                                  {(["Present", "Absent"] as Mark[]).map(
                                    (value) => (
                                      <Button
                                        key={value}
                                        variant="secondary"
                                        disabled={!started}
                                        aria-label={`${state.coaches.find((c) => c.id === a.coachId)!.name} ${key} ${value}`}
                                        aria-pressed={mark === value}
                                        onClick={() =>
                                          setMarks({
                                            ...marks,
                                            [a.id]: {
                                              ...(state.attendance[a.id]
                                                ?.marks ?? {}),
                                              ...marks[a.id],
                                              [key]: value,
                                            },
                                          })
                                        }
                                      >
                                        {value}
                                      </Button>
                                    ),
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!assigned.length && (
            <p className="empty">
              No assigned coaches. Add a coach to record last-minute cover.
            </p>
          )}
        </div>
        <label>
          Session notes (optional)
          <textarea
            placeholder="Add attendance notes or reasons for absence…"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesChanged(true);
            }}
          />
        </label>
        <div className="actions">
          <span className="muted small grow">
            {dirty
              ? "You have unsaved attendance changes."
              : "Review attendance before saving."}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              setMarks({});
              setNotes(state.attendance[assigned[0]?.id]?.notes ?? "");
              setNotesChanged(false);
            }}
          >
            Cancel
          </Button>
          <Button disabled={!started || !assigned.length} onClick={save}>
            Save attendance
          </Button>
        </div>
      </section>
      <p className="muted small">
        Attendance is recorded per coach and time block. Last-minute additions
        retain the exact worked time and Head Coach attribution for review.
      </p>
      {add && (
        <Modal title="Add a last-minute coach" onClose={() => setAdd(false)}>
          <SessionInfo session={session} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let problem = validateSlots(slots, session);
              const existing = assigned.find((a) => a.coachId === coach);
              if (!problem && existing)
                problem = validateSlots([...existing.slots, ...slots], session);
              const overlapsOther = state.assignments.some(
                (a) =>
                  !a.cancelled &&
                  a.coachId === coach &&
                  a.sessionId !== session.id &&
                  state.sessions.find((s) => s.id === a.sessionId)?.date ===
                    session.date &&
                  a.slots.some((aSlot) =>
                    slots.some(
                      (slot) =>
                        slot.start < aSlot.end && slot.end > aSlot.start,
                    ),
                  ),
              );
              if (overlapsOther)
                problem =
                  "This coach is assigned to another session during these times.";
              if (problem) {
                setError(problem);
                return;
              }
              commit(
                "Last-minute coach added",
                `${state.coaches.find((c) => c.id === coach)!.name}: ${slots.map(slotKey).join(", ")}`,
                (s) => {
                  const id =
                    existing?.id ?? `ATT-${crypto.randomUUID().slice(0, 8)}`;
                  const a = existing
                    ? s.assignments.find((a) => a.id === id)!
                    : {
                        id,
                        sessionId: session.id,
                        coachId: coach,
                        slots: [] as Slot[],
                        lastMinute: true,
                        reason,
                      };
                  a.slots.push(...slots);
                  if (!existing) s.assignments.push(a);
                  const added = assignmentBlocks({ ...a, slots }, session);
                  s.attendance[id] = {
                    marks: {
                      ...s.attendance[id]?.marks,
                      ...Object.fromEntries(
                        added.map((b) => [slotKey(b), "Present" as Mark]),
                      ),
                    },
                    notes: reason,
                    savedAt: new Date().toISOString(),
                  };
                },
              );
              setAdd(false);
            }}
          >
            <label>
              Coach
              <select value={coach} onChange={(e) => setCoach(e.target.value)}>
                {state.coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <h3>Time worked</h3>
            <SlotsEditor
              value={slots}
              onChange={setSlots}
              min={session.start}
              max={session.end}
            />
            <p className="success-text">{hours(slots)} hours worked</p>
            <p className="small muted">
              Enter actual times for partial-hour cover. Only these worked slots
              are marked Present.
            </p>
            <label>
              Reason (optional)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Last-minute cover"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="actions">
              <Button variant="secondary" onClick={() => setAdd(false)}>
                Cancel
              </Button>
              <Button type="submit">Add coach & worked slot</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
