export type Role = "Assistant Coach" | "Head Coach" | "Admin";
export type Slot = { start: string; end: string };
export type Mark = "Present" | "Absent" | "Not marked";
export type Coach = { id: string; name: string };
export type Session = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  venue: string;
  capacity: number;
  needed: number;
  level: string;
};
export type Assignment = {
  id: string;
  sessionId: string;
  coachId: string;
  slots: Slot[];
  lastMinute?: boolean;
  reason?: string;
  cancelled?: boolean;
};
export type Attendance = {
  marks: Record<string, Mark>;
  savedAt: string;
  notes: string;
};
export type Verified = {
  slots: Slot[];
  explanation: string;
  verifiedAt: string;
};
export type Submission = {
  coachId: string;
  month: string;
  version: number;
  sentAt: string;
  records: Record<string, Verified>;
};
export type Resolution = {
  slots: Slot[];
  reason: string;
  by: string;
  at: string;
  fingerprint: string;
};
export type ChangeRequest = {
  id: string;
  assignmentId: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
};
export type Audit = {
  at: string;
  actor: string;
  action: string;
  detail: string;
};
export type State = {
  schema: 1;
  sessions: Session[];
  coaches: Coach[];
  assignments: Assignment[];
  availability: Record<string, string[]>;
  attendance: Record<string, Attendance>;
  drafts: Record<string, Verified>;
  submissions: Submission[];
  resolutions: Record<string, Resolution>;
  finalised: Record<string, { fingerprint: string; at: string }>;
  requests: ChangeRequest[];
  audit: Audit[];
};
export type ReportRow = {
  id: string;
  coach: string;
  coachId: string;
  programme: string;
  date: string;
  venue: string;
  assigned: Slot[];
  head?: Slot[];
  assistant?: Slot[];
  source: string;
  fingerprint: string;
  resolved?: Resolution;
  final?: Slot[];
  status: string;
};

export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const time = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
export const slotKey = (slot: Slot) => `${slot.start}-${slot.end}`;
export const hours = (slots: Slot[] = []) =>
  slots.reduce(
    (sum, slot) => sum + (minutes(slot.end) - minutes(slot.start)) / 60,
    0,
  );
export const slotText = (slots?: Slot[]) =>
  slots === undefined
    ? "Not submitted"
    : slots.length
      ? slots.map((s) => `${s.start}–${s.end}`).join(", ")
      : "0 h · no worked slots";
export function normalize(slots: Slot[]): Slot[] {
  const result: Slot[] = [];
  for (const s of [...slots].sort((a, b) => a.start.localeCompare(b.start))) {
    const last = result.at(-1);
    if (last && s.start <= last.end)
      last.end = last.end > s.end ? last.end : s.end;
    else result.push({ ...s });
  }
  return result;
}
export const sameSlots = (a: Slot[], b: Slot[]) =>
  JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
export function validateSlots(
  slots: Slot[],
  session: Pick<Session, "start" | "end">,
  allowEmpty = false,
): string {
  if (!slots.length && !allowEmpty) return "Add at least one worked time slot.";
  for (const slot of slots) {
    if (
      ![slot.start, slot.end].every((v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v))
    )
      return "Enter valid start and end times.";
    if (slot.start >= slot.end)
      return "End time must be later than start time.";
    if (slot.start < session.start || slot.end > session.end)
      return "Time slots must stay within the session.";
  }
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  if (sorted.some((s, i) => i > 0 && s.start < sorted[i - 1].end))
    return "Time slots cannot overlap.";
  return "";
}
export function blocks(session: Pick<Session, "start" | "end">): Slot[] {
  const result = [];
  for (let m = minutes(session.start); m < minutes(session.end); m += 60)
    result.push({
      start: time(m),
      end: time(Math.min(m + 60, minutes(session.end))),
    });
  return result;
}
export function assignmentBlocks(a: Assignment, s: Session): Slot[] {
  return blocks(s).flatMap((b) =>
    a.slots.flatMap((slot) => {
      const start = slot.start > b.start ? slot.start : b.start;
      const end = slot.end < b.end ? slot.end : b.end;
      return start < end ? [{ start, end }] : [];
    }),
  );
}
export function canVerify(s: Session, now: string) {
  // Both strings are SGT wall-clock ISO values, independent of the browser timezone.
  return now.slice(0, 7) === s.date.slice(0, 7) && `${s.date}T${s.end}` <= now;
}
export const sgtNow = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Singapore",
    dateStyle: "short",
    timeStyle: "short",
  })
    .format(new Date())
    .replace(" ", "T");
export function reportRows(state: State): ReportRow[] {
  return state.assignments
    .filter((a) => !a.cancelled)
    .map((a) => {
      const s = state.sessions.find((s) => s.id === a.sessionId)!;
      const record = state.attendance[a.id];
      const ab = assignmentBlocks(a, s);
      const head =
        record &&
        ab.every(
          (b) =>
            record.marks[slotKey(b)] &&
            record.marks[slotKey(b)] !== "Not marked",
        )
          ? ab.filter((b) => record.marks[slotKey(b)] === "Present")
          : undefined;
      const submission = state.submissions
        .filter(
          (v) => v.coachId === a.coachId && v.month === s.date.slice(0, 7),
        )
        .at(-1);
      const assistant = submission?.records[a.id]?.slots;
      const fingerprint = JSON.stringify([
        head,
        assistant,
        record?.savedAt,
        submission?.version,
      ]);
      const resolution = state.resolutions[a.id];
      const resolved =
        resolution?.fingerprint === fingerprint ? resolution : undefined;
      const final =
        resolved?.slots ??
        (head && assistant && sameSlots(head, assistant)
          ? normalize(head)
          : undefined);
      const status = resolved
        ? "Resolved · to verify"
        : head === undefined || assistant === undefined
          ? "Missing source"
          : final
            ? "Matched · to verify"
            : "Admin review";
      return {
        id: a.id,
        coach: state.coaches.find((c) => c.id === a.coachId)!.name,
        coachId: a.coachId,
        programme: s.title,
        date: s.date,
        venue: s.venue,
        assigned: a.lastMinute ? [] : a.slots,
        head,
        assistant,
        source: a.lastMinute ? "Last-minute cover" : "Head Coach",
        fingerprint,
        resolved,
        final,
        status,
      };
    });
}
export const sheetFingerprint = (rows: ReportRow[]) =>
  JSON.stringify(rows.map((r) => [r.id, r.fingerprint, r.resolved?.at]));
export function isFinalised(state: State, month: string, rows: ReportRow[]) {
  return (
    !!rows.length &&
    rows.every((r) => r.final !== undefined) &&
    state.finalised[month]?.fingerprint === sheetFingerprint(rows)
  );
}
export const csvCell = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`;
export const toCsv = (rows: unknown[][]) =>
  "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

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
            ? [{ start: "09:00", end: "11:00" }]
            : c.id === "c2"
              ? [{ start: "10:00", end: s.id === "s12" ? "11:00" : "12:00" }]
              : [{ start: "09:00", end: "10:00" }];
      const a = {
        id: `ATT-${String(assignments.length + 1).padStart(4, "0")}`,
        sessionId: s.id,
        coachId: c.id,
        slots,
      };
      assignments.push(a);
      if (s.id !== "s26") {
        attendance[a.id] = {
          marks: Object.fromEntries(
            assignmentBlocks(a, s).map((b) => [
              slotKey(b),
              s.id === "s19" && c.id === "c2" && b.start === "11:00"
                ? "Absent"
                : "Present",
            ]),
          ),
          savedAt: "2026-09-19T12:05:00+08:00",
          notes: "",
        };
        drafts[a.id] = {
          slots,
          explanation: "",
          verifiedAt:
            s.id === "s19" && c.id === "c2" ? "" : "2026-09-20T10:15:00+08:00",
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
