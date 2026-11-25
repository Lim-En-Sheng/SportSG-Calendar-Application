import type { State } from "./model.ts";

/** Removes only the identified legacy demo records from existing browser saves. */
export function removeLegacyDemo(state: State): State {
  if (state.legacyDemoRemoved) return state;
  const next = structuredClone(state);
  const dates = new Set([
    "2026-09-05",
    "2026-09-12",
    "2026-09-19",
    "2026-09-26",
  ]);
  const ids = new Set(
    next.sessions
      .filter(
        (s) =>
          dates.has(s.date) &&
          s.id === `s${Number(s.date.slice(-2))}` &&
          s.title ===
            `Academy Coaching - ${s.date.endsWith("26") ? "Girls Only " : ""}Seasonal Programme`,
      )
      .map((s) => s.id),
  );
  const assignments = new Set(
    next.assignments.filter((a) => ids.has(a.sessionId)).map((a) => a.id),
  );
  next.sessions = next.sessions.filter((s) => !ids.has(s.id));
  next.assignments = next.assignments.filter((a) => !assignments.has(a.id));
  for (const key of ["attendance", "drafts", "resolutions"] as const) {
    for (const id of assignments) delete next[key][id];
  }
  next.requests = next.requests.filter((r) => !assignments.has(r.assignmentId));
  next.submissions = next.submissions.filter((submission) => {
    const touched = Object.keys(submission.records).some((id) =>
      assignments.has(id),
    );
    for (const id of assignments) delete submission.records[id];
    return !touched || Object.keys(submission.records).length > 0;
  });
  for (const [coachId, available] of Object.entries(next.availability)) {
    if (!/^c[1-6]$/.test(coachId)) continue;
    next.availability[coachId] = available.filter(
      (date) => !dates.has(date) || next.sessions.some((s) => s.date === date),
    );
    if (
      !next.availability[coachId].some((date) => date.startsWith("2026-09"))
    ) {
      delete next.availabilitySubmissions?.[coachId]?.["2026-09"];
    }
  }
  if (ids.size) delete next.finalised["2026-09"];
  next.legacyDemoRemoved = true;
  return next;
}
