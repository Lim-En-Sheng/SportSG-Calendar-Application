import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { getDoc, doc, terminate } from "firebase/firestore";
import { db } from "../src/firebase.ts";
import { supabase } from "../src/supabase.ts";
import { decodeShared } from "../src/sharedState.ts";
import { seed } from "../src/model.ts";

const [command, filename] = process.argv.slice(2);
const normalise = (state) => ({
  ...state,
  legacyDemoRemoved: true,
  availabilitySlots: state.availabilitySlots ?? {},
  availabilitySubmissions: state.availabilitySubmissions ?? {},
});
try {
  if (command === "export") {
    await mkdir(".backups", { recursive: true });
    const snapshot = await getDoc(doc(db, "demos", "coach-calendar"));
    const exported = snapshot.exists()
      ? decodeShared(snapshot.data())
      : { revision: 0, state: seed() };
    const file = resolve(
      filename ??
        `.backups/firebase-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(
      file,
      JSON.stringify(
        { ...exported, exportedAt: new Date().toISOString() },
        null,
        2,
      ),
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        backup: file,
        revision: exported.revision,
        programmes: exported.state.sessions.length,
        assignments: exported.state.assignments.length,
      }),
    );
  } else if (command === "import" && filename) {
    const source = decodeShared(JSON.parse(await readFile(filename, "utf8")));
    const { data: current, error: readError } = await supabase
      .rpc("coach_calendar_read")
      .abortSignal(AbortSignal.timeout(15000));
    if (readError) throw readError;
    if (current.revision !== 0)
      throw new Error(
        "Supabase already contains saved data. Import stopped; nothing was overwritten.",
      );
    const state = normalise(source.state);
    const { data: saved, error: saveError } = await supabase
      .rpc("coach_calendar_save", { expected_revision: 0, next_state: state })
      .abortSignal(AbortSignal.timeout(20000));
    if (saveError) throw saveError;
    if (!isDeepStrictEqual(normalise(decodeShared(saved).state), state))
      throw new Error(
        "Saved state differs from backup. Keep Firebase and the backup; review before proceeding.",
      );
    const { data: verified, error: verifyError } = await supabase
      .rpc("coach_calendar_read")
      .abortSignal(AbortSignal.timeout(15000));
    if (verifyError) throw verifyError;
    if (!isDeepStrictEqual(normalise(decodeShared(verified).state), state))
      throw new Error(
        "Verification differs (another user may have edited data). Keep backup and review.",
      );
    console.log(
      JSON.stringify({
        verified: true,
        revision: verified.revision,
        programmes: state.sessions.length,
        assignments: state.assignments.length,
      }),
    );
  } else
    throw new Error(
      "Usage: node scripts/migrate-firebase.mjs export [backup-path] | import backup-path",
    );
} catch (error) {
  console.error(error.message ?? error);
  process.exitCode = 1;
} finally {
  await terminate(db);
  await supabase.removeAllChannels();
}
