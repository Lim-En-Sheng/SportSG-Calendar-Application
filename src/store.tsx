import { cloudEnabled, cloudLabel } from "./dataConfig";
import { listenShared, saveShared, cloudError } from "./cloudStore";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { removeLegacyDemo } from "./migrations";
import { seed, sgtNow } from "./model";
import type { Role, State } from "./model";
const KEY = "coach-calendar-v1";
function preferences(): { role: Role; coachId: string } {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("coach-calendar-view") ?? "{}",
    );
    return {
      role: ["Head Coach", "Assistant Coach", "Admin"].includes(saved.role)
        ? saved.role
        : "Head Coach",
      coachId: typeof saved.coachId === "string" ? saved.coachId : "c2",
    };
  } catch {
    return { role: "Head Coach", coachId: "c2" };
  }
}
function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed.schema === 1 &&
        Array.isArray(parsed.sessions) &&
        Array.isArray(parsed.assignments)
      ) {
        const migrated = removeLegacyDemo(parsed);
        if (migrated !== parsed) {
          try {
            localStorage.setItem(KEY, JSON.stringify(migrated));
          } catch {
            /* Use cleaned data in memory if storage is unavailable. */
          }
        }
        return migrated;
      }
    }
  } catch {
    /* Preserve unrecognised storage; the next successful save replaces it. */
  }
  return seed();
}
type Store = {
  state: State;
  role: Role;
  signedIn: boolean;
  signIn: (r: Role, id?: string) => void;
  signOut: () => void;
  coachId: string;

  now: string;
  notice: string;
  notify: (s: string) => void;
  commit: (
    action: string,
    detail: string,
    fn: (s: State) => void,
  ) => Promise<boolean>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => (cloudEnabled ? seed() : read()));
  const [connection, setConnection] = useState(
    cloudEnabled ? "Connecting to shared demo..." : "Local demo",
  );
  const [ready, setReady] = useState(!cloudEnabled);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    if (!cloudEnabled) return;
    return listenShared(
      (value) => {
        if (value.revision < revision.current) return;
        revision.current = value.revision;
        setState(value.state);
        setReady(true);
        setConnection(`${cloudLabel} shared demo connected`);
      },
      (error) => {
        setReady(false);
        setConnection(cloudError(error));
      },
    );
  }, []);
  const [role, setRole] = useState<Role>(() => preferences().role);
  const [coachId, setCoachId] = useState(() =>
    state.coaches.some((c) => c.id === preferences().coachId)
      ? preferences().coachId
      : state.coaches[0].id,
  );
  const [signedIn, setSignedIn] = useState(() => {
    try {
      return sessionStorage.getItem("coach-calendar-signed-in") === "true";
    } catch {
      return false;
    }
  });
  function signIn(nextRole: Role, id = "c2") {
    if (!state.coaches.some((coach) => coach.id === id)) return;
    setRole(nextRole);
    setCoachId(id);
    setSignedIn(true);
    try {
      sessionStorage.setItem("coach-calendar-signed-in", "true");
    } catch {
      /* In-memory session remains available. */
    }
  }
  function signOut() {
    setSignedIn(false);
    notify("");
    try {
      sessionStorage.removeItem("coach-calendar-signed-in");
    } catch {
      /* In-memory session is cleared. */
    }
  }
  const [liveNow, setLiveNow] = useState(sgtNow);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "coach-calendar-view",
        JSON.stringify({ role, coachId }),
      );
    } catch {
      /* Session preferences are optional. */
    }
  }, [role, coachId]);
  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(sgtNow()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [notice, notify] = useState("");
  const now = liveNow;
  async function commit(
    action: string,
    detail: string,
    fn: (s: State) => void,
  ) {
    if (!ready || savingRef.current) {
      notify("Wait for the shared demo to connect or finish saving.");
      return false;
    }
    const next = structuredClone(state);
    fn(next);
    next.audit.unshift({
      at: new Date().toISOString(),
      actor:
        role === "Assistant Coach"
          ? state.coaches.find((c) => c.id === coachId)!.name
          : role,
      action,
      detail,
    });
    if (cloudEnabled) {
      savingRef.current = true;
      setSaving(true);
      try {
        const result = await saveShared(revision.current, next);
        if (result.revision >= revision.current) {
          revision.current = result.revision;
          setState(result.state);
        }
        notify(action);
        return true;
      } catch (error) {
        notify(cloudError(error));
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setState(next);
      notify(action);
      return true;
    } catch {
      notify(
        "Could not save: browser storage is unavailable or full. Your previous saved data is unchanged.",
      );
    }
    return false;
  }
  return (
    <Context.Provider
      value={{
        state,
        role,
        signedIn,
        signIn,
        signOut,
        coachId,

        now,
        notice,
        notify,
        commit,
      }}
    >
      {cloudEnabled && (
        <div className="cloud-status" role="status">
          {saving ? "Saving to shared demo..." : connection}{" "}
          <small>Demo accounts only; roles are not authenticated.</small>
        </div>
      )}
      <fieldset className="store-content" disabled={!ready || saving}>
        {children}
      </fieldset>
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("StoreProvider missing");
  return store;
}
