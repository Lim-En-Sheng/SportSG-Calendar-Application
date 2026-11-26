import { useState } from "react";
import { blocks, assignmentBlocks, slotText } from "./model";
import type { Session, Slot } from "./model";
import { useStore } from "./store";
import { Button } from "./components";
const same = (a: Slot, b: Slot) => a.start === b.start && a.end === b.end;
const overlaps = (a: Slot, b: Slot) => a.start < b.end && b.start < a.end;
export function AssignmentEditor({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const { state, commit } = useStore();
  const assigned = state.assignments.filter(
    (a) => !a.cancelled && a.sessionId === session.id,
  );
  const [choices, setChoices] = useState<Record<string, Slot[]>>(() =>
    Object.fromEntries(
      assigned.map((a) => [a.coachId, assignmentBlocks(a, session)]),
    ),
  );
  const currentEvidence = JSON.stringify({
    assigned,
    availability: state.availability,
    slots: state.availabilitySlots,
  });
  const [originalEvidence] = useState(currentEvidence);
  const changedRemotely = originalEvidence !== currentEvidence;
  const [error, setError] = useState("");
  const slots = [...blocks(session)];
  for (const a of assigned)
    for (const slot of assignmentBlocks(a, session))
      if (!slots.some((b) => same(b, slot))) slots.push(slot);
  slots.sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  );
  const count = (slot: Slot) =>
    Object.values(choices).filter((selected) =>
      selected.some((b) => overlaps(b, slot)),
    ).length;
  const tooMany = slots.some((slot) => count(slot) > session.needed);
  return (
    <div className="stack">
      <h3>Assign coaches by timeslot</h3>
      <p className="small muted">
        Choose available coaches for each timeslot. Untick a coach to remove
        that slot. Changes are saved when you submit.
      </p>
      {slots.map((slot) => {
        const candidates = state.coaches.filter(
          (c) =>
            assigned.some(
              (a) =>
                a.coachId === c.id &&
                assignmentBlocks(a, session).some((b) => same(b, slot)),
            ) ||
            (state.availability[c.id]?.includes(session.date) &&
              (
                state.availabilitySlots?.[c.id]?.[session.id] ??
                blocks(session).map((b) => b.start)
              ).includes(slot.start)),
        );
        return (
          <fieldset className="card stack" key={slot.start + "-" + slot.end}>
            <legend>
              {slot.start}–{slot.end} · {count(slot)}/{session.needed} coaches
            </legend>
            {!candidates.length && (
              <p className="small muted">
                No coaches have submitted availability for this timeslot.
              </p>
            )}
            {candidates.map((c) => {
              const checked = (choices[c.id] ?? []).some((b) => same(b, slot));
              const existing = assigned.some(
                (a) =>
                  a.coachId === c.id &&
                  assignmentBlocks(a, session).some((b) => same(b, slot)),
              );
              return (
                <label className="coach-check" key={c.id}>
                  <input
                    type="checkbox"
                    aria-label={`${c.name}, ${slot.start}–${slot.end}`}
                    checked={checked}
                    disabled={!checked && count(slot) >= session.needed}
                    onChange={(e) =>
                      setChoices((prev) => ({
                        ...prev,
                        [c.id]: e.target.checked
                          ? [...(prev[c.id] ?? []), slot]
                          : (prev[c.id] ?? []).filter((b) => !same(b, slot)),
                      }))
                    }
                  />
                  <span>{c.name}</span>
                  <small>
                    {checked
                      ? existing
                        ? "Assigned"
                        : "Selected"
                      : existing
                        ? "Will be unassigned"
                        : "Available"}
                  </small>
                </label>
              );
            })}
          </fieldset>
        );
      })}
      {changedRemotely && (
        <p role="alert" className="error">
          Availability or assignments changed while this editor was open. Cancel
          and reopen to review the latest data.
        </p>
      )}
      {tooMany && (
        <p role="alert" className="error">
          Too many coaches selected for a timeslot.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <Button
          disabled={tooMany || changedRemotely}
          onClick={async () => {
            for (const selected of Object.values(choices))
              if (
                selected.some((slot, i) =>
                  selected.some((other, j) => j > i && overlaps(slot, other)),
                )
              ) {
                setError(
                  "A coach has overlapping selected slots. Untick one before submitting.",
                );
                return;
              }
            if (
              await commit("Assignments updated", session.title, (s) => {
                for (const coach of s.coaches) {
                  const selected = (choices[coach.id] ?? [])
                    .slice()
                    .sort((a, b) => a.start.localeCompare(b.start));
                  const existing = s.assignments.find(
                    (a) =>
                      !a.cancelled &&
                      a.sessionId === session.id &&
                      a.coachId === coach.id,
                  );
                  if (existing) {
                    if (slotText(existing.slots) === slotText(selected))
                      continue;
                    if (selected.length) existing.slots = selected;
                    else existing.cancelled = true; // Keep original evidence for cancelled assignment history.
                    // Do not silently approve a pending request with different requested slots.
                    for (const request of s.requests.filter(
                      (r) =>
                        r.assignmentId === existing.id &&
                        r.status === "Pending",
                    ))
                      request.status =
                        slotText(request.requestedSlots ?? []) ===
                        slotText(selected)
                          ? "Approved"
                          : "Rejected";
                  } else if (selected.length)
                    s.assignments.push({
                      id: crypto.randomUUID(),
                      sessionId: session.id,
                      coachId: coach.id,
                      slots: selected,
                    });
                }
              })
            )
              onClose();
          }}
        >
          Submit assignments
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
