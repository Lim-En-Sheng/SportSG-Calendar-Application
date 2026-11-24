import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { seed, sgtNow } from "./model";
import type { Role, State } from "./model";
const KEY = "coach-calendar-v1";
function preferences(): { role: Role; coachId: string; demo: boolean } {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("coach-calendar-view") ?? "{}",
    );
    return {
      role: ["Head Coach", "Assistant Coach", "Admin"].includes(saved.role)
        ? saved.role
        : "Head Coach",
      coachId: typeof saved.coachId === "string" ? saved.coachId : "c2",
      demo: saved.demo !== false,
    };
  } catch {
    return { role: "Head Coach", coachId: "c2", demo: true };
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
      )
        return parsed;
    }
  } catch {
    /* Preserve unrecognised storage; the next successful save replaces it. */
  }
  return seed();
}
type Store = {
  state: State;
  role: Role;
  setRole: (r: Role) => void;
  coachId: string;
  setCoachId: (id: string) => void;
  demo: boolean;
  setDemo: (b: boolean) => void;
  now: string;
  notice: string;
  notify: (s: string) => void;
  commit: (action: string, detail: string, fn: (s: State) => void) => void;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(read);
  const [role, setRole] = useState<Role>(() => preferences().role);
  const [coachId, setCoachId] = useState(() =>
    state.coaches.some((c) => c.id === preferences().coachId)
      ? preferences().coachId
      : state.coaches[0].id,
  );
  const [demo, setDemo] = useState(() => preferences().demo);
  const [liveNow, setLiveNow] = useState(sgtNow);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "coach-calendar-view",
        JSON.stringify({ role, coachId, demo }),
      );
    } catch {
      /* Session preferences are optional. */
    }
  }, [role, coachId, demo]);
  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(sgtNow()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [notice, notify] = useState("");
  const now = demo ? "2026-09-20T14:00" : liveNow;
  function commit(action: string, detail: string, fn: (s: State) => void) {
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
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setState(next);
      notify(action);
    } catch {
      notify(
        "Could not save: browser storage is unavailable or full. Your previous saved data is unchanged.",
      );
    }
  }
  return (
    <Context.Provider
      value={{
        state,
        role,
        setRole,
        coachId,
        setCoachId,
        demo,
        setDemo,
        now,
        notice,
        notify,
        commit,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("StoreProvider missing");
  return store;
}
