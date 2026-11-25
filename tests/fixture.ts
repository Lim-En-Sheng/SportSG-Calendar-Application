import { assignmentBlocks, slotKey } from "../src/model.ts";
import type { State, Session, Assignment } from "../src/model.ts";

// Historical scenarios for automated tests only; never loaded by the app.
export function seed(): State {
  const coaches = [
    "Marcus Tan",
    "Ryan Coo",
    "Priya Nair",
    "Aisyah Rahman",
    "Sarah Koh",
    "Danish Hakim",
  ].map((name, i) => ({ id: `c${i + 1}`, name }));
  const sessions: Session[] = [5, 12, 19, 26].map((day) => ({
    id: `s${day}`,
    title: `Academy Coaching - ${day === 26 ? "Girls Only " : ""}Seasonal Programme`,
    date: `2026-09-${String(day).padStart(2, "0")}`,
    start: day === 26 ? "11:00" : "09:00",
    end: day === 26 ? "12:30" : "12:00",
    venue: day === 26 ? "Yishun Stadium" : "Somerset Sports Hall",
    capacity: 20,
    needed: 10,
    level: "Beginner",
  }));
  const assignments: Assignment[] = [];
  const attendance: State["attendance"] = {},
    drafts: State["drafts"] = {};
  for (const s of sessions)
    for (const c of coaches.slice(0, s.id === "s26" ? 2 : 3)) {
      if (s.id === "s26" && c.id !== "c2") continue;
      const slots =
        s.id === "s26"
          ? [{ start: "11:00", end: "12:30" }]
          : c.id === "c1"
            ? [{ start: "09:00", end: "11:15" }] // covers 09:00-10:00 and 10:15-11:15
            : c.id === "c2"
              ? [{ start: "10:15", end: s.id === "s12" ? "11:15" : "12:00" }] // covers 10:15-11:15 and 11:30-12:00
              : [{ start: "09:00", end: "10:00" }];
      const a = {
        id: `ATT-${String(assignments.length + 1).padStart(4, "0")}`,
        sessionId: s.id,
        coachId: c.id,
        slots,
      };
      assignments.push(a);
      if (s.id !== "s26") {
        const ab = assignmentBlocks(a, s);
        attendance[a.id] = {
          marks: Object.fromEntries(
            ab.map((b) => [
              slotKey(b),
              s.id === "s19" && c.id === "c2" && b.start === "11:30"
                ? "Absent"
                : "Present",
            ]),
          ),
          savedAt: "2026-09-19T12:05:00+08:00",
          notes: "",
        };
        // Draft slots match assignment blocks (split at 15-min breaks) for verified coaches
        const verified = !(s.id === "s19" && c.id === "c2");
        drafts[a.id] = {
          slots: verified ? ab : slots,
          explanation: "",
          verifiedAt: verified ? "2026-09-20T10:15:00+08:00" : "",
        };
      }
    }
  const submissions = coaches.slice(0, 3).map((c) => ({
    coachId: c.id,
    month: "2026-09",
    version: 1,
    sentAt: "2026-09-20T10:15:00+08:00",
    records: Object.fromEntries(
      assignments
        .filter((a) => a.coachId === c.id && drafts[a.id]?.verifiedAt)
        .map((a) => [a.id, structuredClone(drafts[a.id])]),
    ),
  }));
  return {
    schema: 1,
    legacyDemoRemoved: true,
    coaches,
    sessions,
    assignments,
    attendance,
    drafts,
    submissions,
    availability: Object.fromEntries(
      coaches.map((c) => [c.id, sessions.map((s) => s.date)]),
    ),
    requests: [
      {
        id: "change-1",
        assignmentId: assignments.at(-1)!.id,
        reason: "Family commitment",
        status: "Pending",
      },
    ],
    resolutions: {},
    finalised: {},
    audit: [],
  };
}
