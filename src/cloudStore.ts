import { seed } from "./model";
import type { State } from "./model";
import { dataMode } from "./dataConfig";
import { supabase } from "./supabase";
import { decodeShared, type SharedState } from "./sharedState";
export type { SharedState } from "./sharedState";
export { decodeShared } from "./sharedState";

async function readSupabase(): Promise<SharedState> {
  const { data, error } = await supabase
    .rpc("coach_calendar_read")
    .abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  return data?.revision === 0 && data.state === null
    ? { revision: 0, state: seed() }
    : decodeShared(data);
}
export function listenShared(
  next: (value: SharedState) => void,
  error: (error: Error) => void,
) {
  let stopped = false;
  if (dataMode === "firebase") {
    let stop: (() => void) | undefined;
    void import("./firebaseStore")
      .then((module) => {
        if (!stopped) stop = module.listenShared(next, error);
      })
      .catch((e) => {
        if (!stopped) error(new Error(cloudError(e)));
      });
    return () => {
      stopped = true;
      stop?.();
    };
  }
  let pending = false,
    again = false;
  async function refresh() {
    if (stopped) return;
    if (pending) {
      again = true;
      return;
    }
    pending = true;
    try {
      const value = await readSupabase();
      if (!stopped) next(value);
    } catch (e) {
      if (!stopped) error(new Error(cloudError(e)));
    } finally {
      pending = false;
      if (again && !stopped) {
        again = false;
        void refresh();
      }
    }
  }
  const channel = supabase
    .channel("coach-calendar-" + crypto.randomUUID())
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "coach_calendar_revision" },
      () => {
        void refresh();
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void refresh();
    });
  void refresh();
  // Polling recovers dropped realtime events and works when WebSockets are blocked.
  const timer = window.setInterval(() => {
    void refresh();
  }, 15000);
  const onFocus = () => {
    void refresh();
  };
  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onFocus);
  return () => {
    stopped = true;
    clearInterval(timer);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onFocus);
    void supabase.removeChannel(channel);
  };
}
export async function saveShared(
  expectedRevision: number,
  state: State,
): Promise<SharedState> {
  if (dataMode === "firebase")
    return (await import("./firebaseStore")).saveShared(
      expectedRevision,
      state,
    );
  const { data, error } = await supabase
    .rpc("coach_calendar_save", {
      expected_revision: expectedRevision,
      next_state: JSON.parse(JSON.stringify(state)),
    })
    .abortSignal(AbortSignal.timeout(15000));
  if (error) throw error;
  return decodeShared(data);
}
export function cloudError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e?.code === "PGRST202" || e?.code === "42P01")
    return "Supabase setup is missing. Run supabase/setup-demo.sql in your project SQL Editor, then reload.";
  if (e?.code === "40001")
    return "Another workstation changed the demo. Refresh, review the latest data and try again.";
  if (e?.code === "42501")
    return "Supabase demo access is denied or expired. Check SUPABASE_SETUP.md.";
  if (e?.code === "permission-denied")
    return "Firebase rollback access is denied. Check the original Firestore rules.";
  return (
    e?.message ||
    "Could not reach the database. Check your connection, then reload to verify the latest data before retrying."
  );
}
