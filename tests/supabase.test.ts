import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { seed } from "../src/model.ts";

const schema = readFileSync(
  new URL("../supabase/setup-demo.sql", import.meta.url),
  "utf8",
);
test("Supabase schema: round trip, rows, conflicts, rollback, permissions and expiry", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    // Keep this test stable after the demo cutoff; expiry is separately checked below.
    const active = schema.replaceAll("2026-12-10", "2999-12-10");
    await db.exec(active);
    await db.exec(active); // Safe to rerun setup without resetting data.
    const read = async () =>
      (
        await db.query<{
          value: { revision: number; state: ReturnType<typeof seed> };
        }>("select public.coach_calendar_read() as value")
      ).rows[0].value;
    const save = async (revision: number, state: ReturnType<typeof seed>) =>
      await db.query("select public.coach_calendar_save($1,$2::jsonb)", [
        revision,
        JSON.stringify(state),
      ]);
    await db.exec("set role anon");
    assert.equal((await read()).revision, 0);
    const state = seed();
    state.availabilitySlots = {};
    state.sessions.push({
      id: "p1",
      title: "Basketball",
      date: "2026-12-01",
      start: "09:00",
      end: "11:00",
      venue: "Hall",
      capacity: 20,
      needed: 2,
      level: "Beginner",
    });
    state.assignments.push({
      id: "a1",
      sessionId: "p1",
      coachId: "c2",
      slots: [{ start: "09:00", end: "10:00" }],
    });
    state.attendance.a1 = {
      marks: { "09:00-10:00": "Present" },
      savedAt: "2026-12-01T11:01:00Z",
      notes: "Test",
    };
    state.availability.c2 = ["2026-12-01"];
    state.availabilitySlots.c2 = { p1: ["09:00"] };
    state.submissions.push({
      coachId: "c2",
      month: "2026-12",
      version: 1,
      sentAt: "2026-12-01T11:02:00Z",
      records: {
        a1: {
          slots: [{ start: "09:00", end: "10:00" }],
          explanation: "",
          verifiedAt: "2026-12-01T11:01:00Z",
        },
      },
    });
    state.audit.push({
      at: "2026-12-01T11:03:00Z",
      actor: "Admin",
      action: "Test",
      detail: "",
    });
    await save(0, state);
    assert.deepEqual((await read()).state, state);
    await assert.rejects(save(0, state), /Another workstation/);
    assert.equal((await read()).revision, 1);
    await assert.rejects(
      db.query("delete from public.coach_calendar_revision"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from coach_calendar_private.sessions"),
      /permission denied/,
    );
    const invalid = structuredClone(state);
    invalid.assignments[0].sessionId = "missing";
    await assert.rejects(save(1, invalid), /foreign key/);
    assert.deepEqual((await read()).state, state);
    const large = structuredClone(state);
    for (let i = 0; i < 1000; i++)
      large.sessions.push({ ...state.sessions[0], id: "extra-" + i });
    await save(1, large);
    assert.equal((await read()).state.sessions.length, 1001);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer as count from coach_calendar_private.sessions",
        )
      ).rows[0].count,
      1001,
    );
    await db.exec(active);
    assert.equal((await read()).revision, 2);
    await db.exec(schema.replaceAll("2026-12-10", "2000-12-10"));
    await db.exec("set role anon");
    await assert.rejects(read(), /expired/);
    await assert.rejects(save(2, large), /expired/);
  } finally {
    await db.close();
  }
});
