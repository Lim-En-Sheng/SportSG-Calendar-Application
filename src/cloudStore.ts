import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { seed } from "./model";
import type { State } from "./model";
const reference = doc(db, "demos", "coach-calendar");
export type SharedState = { revision: number; state: State };
export function decodeShared(data: unknown): SharedState {
  const record = data as Partial<SharedState> | undefined;
  if (
    !record ||
    !Number.isSafeInteger(record.revision) ||
    !record.state ||
    record.state.schema !== 1 ||
    !Array.isArray(record.state.sessions) ||
    !Array.isArray(record.state.coaches) ||
    !record.state.coaches.length ||
    !Array.isArray(record.state.assignments) ||
    !Array.isArray(record.state.requests) ||
    !Array.isArray(record.state.audit) ||
    !Array.isArray(record.state.submissions) ||
    !record.state.availability ||
    !record.state.attendance ||
    !record.state.drafts ||
    !record.state.resolutions ||
    !record.state.finalised
  )
    throw new Error(
      "The shared demo data has an unsupported format. No data was overwritten.",
    );
  return record as SharedState;
}
export function listenShared(
  next: (value: SharedState) => void,
  error: (error: Error) => void,
) {
  return onSnapshot(
    reference,
    { includeMetadataChanges: true },
    (snapshot) => {
      // Do not mistake an offline cache for a confirmed connection.
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
        return;
      try {
        next(
          snapshot.exists()
            ? decodeShared(snapshot.data())
            : { revision: 0, state: seed() },
        );
      } catch (e) {
        error(e as Error);
      }
    },
    error,
  );
}
export async function saveShared(
  expectedRevision: number,
  state: State,
): Promise<SharedState> {
  const clean = JSON.parse(JSON.stringify(state)) as State;
  if (new TextEncoder().encode(JSON.stringify(clean)).length > 800000)
    throw new Error(
      "This shared demo has reached its storage limit. Export your reports before adding more data.",
    );
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists()
      ? decodeShared(snapshot.data())
      : { revision: 0, state: seed() };
    if (current.revision !== expectedRevision)
      throw new Error(
        "Another workstation changed the demo. Review the latest data and try your change again.",
      );
    const next = { revision: current.revision + 1, state: clean };
    transaction.set(reference, next);
    return next;
  });
}
export function cloudError(error: unknown) {
  if ((error as { code?: string })?.code === "permission-denied")
    return "Firestore access denied. Create the database and configure the demo rules described in FIREBASE_SETUP.md.";
  return error instanceof Error
    ? error.message
    : "Could not save to Firestore. Check your connection and try again.";
}
