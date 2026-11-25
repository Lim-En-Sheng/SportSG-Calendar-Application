import { seed } from "./fixture.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentBlocks,
  canVerify,
  hours,
  isFinalised,
  normalize,
  reportRows,
  sameSlots,
  sheetFingerprint,
  slotKey,
  toCsv,
  validateSlots,
} from "../src/model.ts";

test("reconciliation compares worked intervals, not only total hours", () => {
  assert.equal(
    sameSlots(
      [{ start: "09:00", end: "10:00" }],
      [{ start: "10:00", end: "11:00" }],
    ),
    false,
  );
  assert.equal(
    sameSlots(
      [
        { start: "09:00", end: "10:00" },
        { start: "10:00", end: "11:00" },
      ],
      [{ start: "09:00", end: "11:00" }],
    ),
    true,
  );
});
test("normalisation preserves gaps and does not mutate source evidence", () => {
  const original = [
    { start: "11:00", end: "12:00" },
    { start: "09:00", end: "10:00" },
  ];
  const copy = structuredClone(original);
  assert.equal(normalize(original).length, 2);
  assert.deepEqual(original, copy);
});
test("partial cover is split exactly at session hour boundaries", () => {
  const s = seed(),
    session = s.sessions[2];
  const parts = assignmentBlocks(
    {
      id: "cover",
      coachId: "c4",
      sessionId: session.id,
      slots: [{ start: "09:30", end: "10:30" }],
    },
    session,
  );
  assert.deepEqual(parts, [
    { start: "09:30", end: "10:00" },
    { start: "10:15", end: "10:30" },
  ]);
  assert.equal(hours(parts), 0.75);
});
test("invalid, overlapping and out-of-session slots are rejected", () => {
  const session = { start: "09:00", end: "12:00" };
  for (const slots of [
    [{ start: "25:00", end: "26:00" }],
    [{ start: "11:00", end: "10:00" }],
    [{ start: "08:59", end: "10:00" }],
    [
      { start: "09:00", end: "11:00" },
      { start: "10:30", end: "12:00" },
    ],
  ])
    assert.notEqual(validateSlots(slots, session), "");
  assert.equal(validateSlots([], session, true), "");
});
test("verification opens at end time and closes at month boundary in SGT", () => {
  const session = seed().sessions[2];
  assert.equal(canVerify(session, "2026-09-19T11:59"), false);
  assert.equal(canVerify(session, "2026-09-19T12:00"), true);
  assert.equal(canVerify(session, "2026-09-30T23:59"), true);
  assert.equal(canVerify(session, "2026-10-01T00:00"), false);
});
test("unsubmitted drafts are not used as assistant source evidence", () => {
  const s = seed(),
    a = s.assignments.find((a) => a.sessionId === "s19" && a.coachId === "c2")!;
  s.drafts[a.id].verifiedAt = "2026-09-20";
  assert.equal(reportRows(s).find((r) => r.id === a.id)!.assistant, undefined);
  s.submissions.push({
    coachId: "c2",
    month: "2026-09",
    version: 2,
    sentAt: "2026-09-20",
    records: { [a.id]: structuredClone(s.drafts[a.id]) },
  });
  assert.equal(
    reportRows(s).find((r) => r.id === a.id)!.status,
    "Admin review",
  );
});
test("not marked and missing attendance do not become absent", () => {
  const s = seed(),
    a = s.assignments[0];
  delete s.attendance[a.id].marks[slotKey(a.slots[0])];
  s.attendance[a.id].marks["09:00-10:00"] = "Not marked";
  assert.equal(reportRows(s)[0].head, undefined);
});
test("source revisions invalidate previous admin resolution and verification", () => {
  const s = seed(),
    a = s.assignments.find((a) => a.sessionId === "s19" && a.coachId === "c2")!;
  let rows = reportRows(s).filter((r) => r.date < "2026-09-20"),
    r = rows.find((r) => r.id === a.id)!;
  s.resolutions[a.id] = {
    slots: [{ start: "10:15", end: "11:15" }],
    reason: "Confirmed with coach",
    at: "2026-09-20",
    by: "Admin",
    fingerprint: r.fingerprint,
  };
  rows = reportRows(s).filter((r) => r.date < "2026-09-20");
  s.finalised["2026-09"] = {
    fingerprint: sheetFingerprint(rows),
    at: "2026-09-20",
  };
  assert.equal(isFinalised(s, "2026-09", rows), true);
  s.attendance[a.id].marks["11:30-12:00"] = "Present";
  rows = reportRows(s).filter((r) => r.date < "2026-09-20");
  assert.equal(rows.find((r) => r.id === a.id)!.resolved, undefined);
  assert.equal(isFinalised(s, "2026-09", rows), false);
});
test("CSV quotes commas, newlines and formula-like strings", () => {
  const csv = toCsv([
    ["Name", "Reason"],
    ["=1+1", 'comma, quote"\nline'],
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"comma, quote""\nline"'));
});
test("report reconciliation and export cover 1000 distinct rows", () => {
  const s = seed(),
    template = s.assignments[0],
    att = s.attendance[template.id],
    draft = s.drafts[template.id];
  s.assignments = Array.from({ length: 1000 }, (_, i) => ({
    ...structuredClone(template),
    id: `TEST-${i}`,
  }));
  s.attendance = Object.fromEntries(
    s.assignments.map((a) => [a.id, structuredClone(att)]),
  );
  s.submissions = [
    {
      coachId: template.coachId,
      month: "2026-09",
      version: 1,
      sentAt: "2026-09-20",
      records: Object.fromEntries(
        s.assignments.map((a) => [a.id, structuredClone(draft)]),
      ),
    },
  ];
  const rows = reportRows(s);
  assert.equal(rows.length, 1000);
  assert.equal(new Set(rows.map((r) => r.id)).size, 1000);
  assert.ok(rows.every((r) => r.status === "Matched · to verify"));
  assert.equal(rows.slice(950, 1000).length, 50);
  assert.equal(
    toCsv(rows.map((r) => [r.id, r.coach, hours(r.head)])).split("\r\n").length,
    1000,
  );
});
import { seed as initialState } from "../src/model.ts";
test("new installs have no sample sessions or availability but retain demo accounts", () => {
  const state = initialState();
  assert.equal(state.coaches.length, 6);
  for (const key of ["sessions", "assignments", "submissions", "requests", "audit"] as const) assert.equal(state[key].length, 0);
  for (const key of ["availability", "attendance", "drafts", "resolutions", "finalised"] as const) assert.deepEqual(state[key], {});
});
import { removeLegacyDemo } from "../src/migrations.ts";
test("legacy cleanup removes samples and preserves user programmes and records", () => {
  const legacy = seed();
  delete legacy.legacyDemoRemoved;
  legacy.sessions.push({ ...legacy.sessions[0], id: "custom-programme", title: "My programme" });
  legacy.assignments.push({ ...legacy.assignments[0], id: "custom-assignment", sessionId: "custom-programme" });
  legacy.attendance["custom-assignment"] = structuredClone(legacy.attendance[legacy.assignments[0].id]);
  const cleaned = removeLegacyDemo(legacy);
  assert.deepEqual(cleaned.sessions.map((s) => s.id), ["custom-programme"]);
  assert.deepEqual(cleaned.assignments.map((a) => a.id), ["custom-assignment"]);
  assert.deepEqual(Object.keys(cleaned.attendance), ["custom-assignment"]);
  assert.deepEqual(cleaned.availability.c2, ["2026-09-05"]);
  assert.equal(cleaned.requests.length, 0);
  assert.equal(cleaned.submissions.length, 0);
  assert.equal(legacy.sessions.length, 5);
  assert.equal(removeLegacyDemo(cleaned), cleaned);
});
