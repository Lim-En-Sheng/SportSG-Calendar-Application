import type { State } from "./model";
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
