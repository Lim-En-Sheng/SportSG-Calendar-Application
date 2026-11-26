export type Role = "Assistant Coach" | "Head Coach" | "Admin";
export type Slot = { start: string; end: string };
export type Mark = "Present" | "Absent" | "Not marked";
export type Coach = { id: string; name: string };
export type Session = {
  headCoachName?: string;
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
  originalSlots?: Slot[];
  requestedSlots?: Slot[];
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
  legacyDemoRemoved?: boolean;
  schema: 1;
  sessions: Session[];
  coaches: Coach[];
  assignments: Assignment[];
  availability: Record<string, string[]>;
  availabilitySlots?: Record<string, Record<string, string[]>>;
  availabilitySubmissions?: Record<
    string,
    Record<string, { submittedAt: string }>
  >;
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
  const sessionStart = minutes(session.start);
  const sessionEnd = minutes(session.end);
  let blockStart = sessionStart;
  let blockIndex = 0;

  while (blockStart < sessionEnd) {
    const blockEnd = Math.min(blockStart + 60, sessionEnd);
    result.push({
      start: time(blockStart),
      end: time(blockEnd),
    });
    blockIndex++;
    // Next block starts after 1 hour + 15 min break
    blockStart = sessionStart + blockIndex * 75;
  }
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
  return {
    schema: 1,
    legacyDemoRemoved: true,
    coaches,
    sessions: [],
    assignments: [],
    attendance: {},
    drafts: {},
    submissions: [],
    availability: {},
    availabilitySubmissions: {},
    requests: [],
    resolutions: {},
    finalised: {},
    audit: [],
  };
}
