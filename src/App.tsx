import { useState } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import type { ReactNode } from "react";
import { Calendar, Sessions } from "./Calendar";
import { Attendance } from "./Attendance";
import { Timesheet } from "./Timesheet";
import { Reports } from "./Reports";
import { Coaches, CreateProgramme, Programmes } from "./Programmes";
import { Button, Modal } from "./components";
import { StoreProvider, useStore } from "./store";
import type { Role } from "./model";
import "./App.css";

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useStore();
  return roles.includes(role) ? children : <Navigate to="/calendar" replace />;
}
function Shell() {
  const {
    state,
    role,
    setRole,
    coachId,
    setCoachId,
    demo,
    setDemo,
    notice,
    notify,
  } = useStore();
  const navigate = useNavigate(),
    [profile, setProfile] = useState(false);
  const initials =
    role === "Admin"
      ? "AD"
      : role === "Head Coach"
        ? "HC"
        : state.coaches
            .find((c) => c.id === coachId)!
            .name.split(" ")
            .map((n) => n[0])
            .join("");
  return (
    <>
      <header className={`top-nav ${role === "Admin" ? "admin-nav" : ""}`}>
        <NavLink to="/calendar" className="brand">
          <span className="brand-mark" />
          Coach Calendar
        </NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/calendar">Calendar</NavLink>
          {role !== "Admin" && <NavLink to="/sessions">My sessions</NavLink>}
          <NavLink to="/programmes">Programmes</NavLink>
          <NavLink to="/coaches">Coaches</NavLink>
          {role === "Admin" && (
            <>
              <NavLink to="/programmes/new">Manage programmes</NavLink>
              <NavLink to="/reports">Reports</NavLink>
            </>
          )}
        </nav>
        <button
          className="avatar"
          aria-label="Switch role and demo settings"
          title={`${role} · Switch role`}
          onClick={() => setProfile(true)}
        >
          {initials}
        </button>
      </header>
      <main className="page">
        <Routes>
          <Route
            path="/calendar"
            element={<Calendar key={`${role}-${coachId}`} />}
          />
          <Route
            path="/sessions"
            element={
              <Guard roles={["Assistant Coach", "Head Coach"]}>
                <Sessions />
              </Guard>
            }
          />
          <Route
            path="/attendance/:sessionId"
            element={
              <Guard roles={["Head Coach"]}>
                <Attendance />
              </Guard>
            }
          />
          <Route
            path="/timesheet"
            element={
              <Guard roles={["Assistant Coach"]}>
                <Timesheet key={coachId} />
              </Guard>
            }
          />
          <Route path="/programmes" element={<Programmes />} />
          <Route
            path="/programmes/new"
            element={
              <Guard roles={["Admin"]}>
                <CreateProgramme />
              </Guard>
            }
          />
          <Route path="/coaches" element={<Coaches />} />
          <Route
            path="/reports"
            element={
              <Guard roles={["Admin"]}>
                <Reports />
              </Guard>
            }
          />
          <Route path="*" element={<Navigate to="/calendar" replace />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <span>
          Local prototype · {role} ·{" "}
          {demo
            ? "Sample clock: 20 September 2026 (SGT)"
            : "Live Singapore clock"}{" "}
          · Data saved in this browser
        </span>
        <Button variant="link" onClick={() => setProfile(true)}>
          Switch role
        </Button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => notify("")}>
            ×
          </button>
        </div>
      )}
      {profile && (
        <Modal title="Explore Coach Calendar" onClose={() => setProfile(false)}>
          <p>
            Switch between the three roles to try the complete coaching
            workflow. This is a local demo, not a sign-in system.
          </p>
          <label>
            Role
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as Role);
                navigate("/calendar");
              }}
            >
              {(["Head Coach", "Assistant Coach", "Admin"] as Role[]).map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </label>
          {role === "Assistant Coach" && (
            <label>
              Coach
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
              >
                {state.coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
            />
            Use the Figma example clock (20 September 2026)
          </label>
          <p className="small muted">
            The example clock lets you verify September sessions during their
            monthly window. Turn it off to enforce the real Singapore date.
          </p>
          <Button onClick={() => setProfile(false)}>Continue as {role}</Button>
        </Modal>
      )}
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </BrowserRouter>
  );
}
