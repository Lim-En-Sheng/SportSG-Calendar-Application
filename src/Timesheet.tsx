import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Badge,
  Button,
  Heading,
  Modal,
  SessionInfo,
  SlotsEditor,
} from "./components";
import { useStore } from "./store";
import {
  canVerify,
  hours,
  reportRows,
  sameSlots,
  slotText,
  validateSlots,
} from "./model";
import type { Slot } from "./model";

export function Timesheet() {
  const { state, coachId, now, commit } = useStore();
  const [month, setMonth] = useState(() => now.slice(0, 7));
  const [review, setReview] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [explanation, setExplanation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const mine = state.assignments.filter(
    (a) =>
      !a.cancelled &&
      a.coachId === coachId &&
      state.sessions.find((s) => s.id === a.sessionId)!.date.startsWith(month),
  );
  const completed = mine.filter((a) => {
    const s = state.sessions.find((s) => s.id === a.sessionId)!;
    return `${s.date}T${s.end}` <= now;
  });
  const verified = completed.filter(
    (a) => state.drafts[a.id]?.verifiedAt,
  ).length;
  const latest = state.submissions
    .filter((s) => s.coachId === coachId && s.month === month)
    .at(-1);
  const changed =
    JSON.stringify(latest?.records) !==
    JSON.stringify(
      Object.fromEntries(completed.map((a) => [a.id, state.drafts[a.id]])),
    );
  const rows = reportRows(state);
  const a = state.assignments.find((a) => a.id === review),
    session = state.sessions.find((s) => s.id === a?.sessionId),
    row = rows.find((r) => r.id === review);
  const discrepancy = row?.head !== undefined && !sameSlots(row.head, slots);
  const open = (id: string) => {
    const assignment = state.assignments.find((a) => a.id === id)!;
    setReview(id);
    setSlots(structuredClone(state.drafts[id]?.slots ?? assignment.slots));
    setExplanation(state.drafts[id]?.explanation ?? "");
    setConfirmed(false);
    setError("");
  };
  return (
    <>
      <Link className="text-link" to="/sessions">
        Back to my sessions
      </Link>
      <Heading
        title="Verify my worked hours"
        subtitle={`${state.coaches.find((c) => c.id === coachId)?.name} · Review completed sessions, then send your verified monthly timesheet.`}
        action={
          <label className="month-label">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
        }
      />
      <div className="notice info">
        <h3>Review any time during the same month</h3>
        <p>
          Submit or revise completed sessions before the last day of the month,
          11:59 PM (SGT).
        </p>
        <small>Current Singapore time · {now.replace("T", " ")}</small>
      </div>
      {latest && (
        <div className="notice success">
          <strong>Timesheet v{latest.version} sent</strong>
          <p>
            Your submitted hours are available to Admin. Changes must be
            verified and sent as a new version.
          </p>
        </div>
      )}
      <div className="card">
        <h3>
          {completed.length} completed sessions ·{" "}
          {hours(
            completed.flatMap((a) => state.drafts[a.id]?.slots ?? a.slots),
          )}{" "}
          hours worked · {verified} of {completed.length} verified
        </h3>
        <p className="muted">
          Verify each session before sending. New completed sessions can be
          included in a revised timesheet this month.
        </p>
      </div>
      <section className="card stack">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Hours worked</th>
                <th>Total</th>
                <th>Your verification</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((a) => {
                const s = state.sessions.find((s) => s.id === a.sessionId)!,
                  draft = state.drafts[a.id];
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{format(parseISO(s.date), "d MMM yyyy")}</strong>
                      <p>{s.title}</p>
                      <small>{s.venue}</small>
                    </td>
                    <td>{slotText(draft?.slots ?? a.slots)}</td>
                    <td>
                      <strong>{hours(draft?.slots ?? a.slots)} h</strong>
                    </td>
                    <td>
                      <Badge tone={draft?.verifiedAt ? "success" : "warning"}>
                        {draft?.verifiedAt
                          ? "Verified by you"
                          : "Needs your verification"}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        disabled={!canVerify(s, now)}
                        onClick={() => open(a.id)}
                      >
                        Review hours
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!completed.length && (
            <p className="empty">No completed sessions in this month.</p>
          )}
        </div>
        <p className="small muted">
          {mine.length - completed.length} upcoming sessions · Verification
          opens after each session ends.
        </p>
        {now.slice(0, 7) !== month && (
          <p className="warning-text">
            This month's submission window is closed.
          </p>
        )}
        <div className="actions">
          <p className="small muted grow">
            Confirm your submitted hours reflect the time you actually worked.
          </p>
          <Button
            disabled={
              !completed.length ||
              verified !== completed.length ||
              now.slice(0, 7) !== month ||
              !changed
            }
            onClick={async () =>
              await commit(
                "Verified timesheet sent",
                `${month} · v${(latest?.version ?? 0) + 1}`,
                (s) => {
                  s.submissions.push({
                    coachId,
                    month,
                    version: (latest?.version ?? 0) + 1,
                    sentAt: new Date().toISOString(),
                    records: Object.fromEntries(
                      completed.map((a) => [
                        a.id,
                        structuredClone(s.drafts[a.id]),
                      ]),
                    ),
                  });
                },
              )
            }
          >
            {latest ? "Send revised timesheet" : "Send verified timesheet"}
          </Button>
        </div>
      </section>
      <p className="muted small">
        Head Coach attendance and your verified timesheet are reconciled by
        worked time. Admin resolves differences and verifies the final
        attendance sheet.
      </p>
      {review && session && row && (
        <Modal title="Review worked hours" onClose={() => setReview(null)}>
          <SessionInfo session={session} />
          <div className="notice neutral">
            <h3>Head Coach attendance</h3>
            <p>
              {slotText(row.head)} ·{" "}
              {row.head === undefined
                ? "Awaiting saved attendance"
                : `${hours(row.head)} hours present`}
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const problem = validateSlots(slots, session, true);
              if (problem) {
                setError(problem);
                return;
              }
              if (
                !confirmed ||
                (discrepancy && !explanation.trim()) ||
                !canVerify(session, now)
              )
                return;
              if (
                !(await commit(
                  "Worked hours verified",
                  `${session.date} · ${hours(slots)} hours`,
                  (s) => {
                    s.drafts[review] = {
                      slots,
                      explanation,
                      verifiedAt: new Date().toISOString(),
                    };
                  },
                ))
              )
                return;
              setReview(null);
            }}
          >
            <h3>My actual worked time</h3>
            <SlotsEditor
              value={slots}
              onChange={setSlots}
              min={session.start}
              max={session.end}
            />
            <p>
              <strong>Total: {hours(slots)} hours</strong>
            </p>
            {discrepancy && (
              <div className="notice warning">
                <h3>Worked time differs from Head Coach attendance</h3>
                <p>
                  You can verify your actual hours. Admin will review both
                  records after you send your timesheet.
                </p>
              </div>
            )}
            <label>
              Explanation for different hours
              {discrepancy ? " (required)" : " (optional)"}
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                required={discrepancy}
              />
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I confirm these are the hours I actually worked.
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="actions">
              <Button variant="secondary" onClick={() => setReview(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!confirmed || (discrepancy && !explanation.trim())}
              >
                Verify these hours
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
