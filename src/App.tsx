import { cloudEnabled } from "./firebase";
import { useState } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import type { ReactNode } from "react";
import { Calendar, Sessions } from "./Calendar";
import { Attendance } from "./Attendance";
import { Timesheet } from "./Timesheet";
import { Reports } from "./Reports";
import { Coaches, Programmes } from "./Programmes";
import { Button, Modal } from "./components";
import { StoreProvider, useStore } from "./store";
import type { Role } from "./model";
import { Login } from "./Login";
import "./App.css";

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useStore();
  return roles.includes(role) ? children : <Navigate to="/calendar" replace />;
}
function Shell() {
  const {
    state,
    role,
    signedIn,
    signOut,
    coachId,

    now,
    notice,
    notify,
  } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate(),
    [profile, setProfile] = useState(false);
  const name =
    role === "Admin"
      ? "Admin"
      : role === "Head Coach"
        ? "Maya Chen"
        : state.coaches.find((c) => c.id === coachId)!.name;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("");
  if (pathname === "/" || pathname === "/login") return <Login />;
  if (!signedIn) return <Navigate to="/login" replace />;
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
          {role !== "Assistant Coach" && (
            <NavLink to="/coaches">Coaches</NavLink>
          )}
          {role === "Admin" && (
            <>
              <NavLink to="/reports">Reports</NavLink>
            </>
          )}
        </nav>
        <button
          className="avatar"
          aria-label="Open profile"
          title={`${name} - Profile`}
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
                <Navigate to="/programmes?add=1" replace />
              </Guard>
            }
          />
          <Route
            path="/coaches"
            element={
              <Guard roles={["Admin", "Head Coach"]}>
                <Coaches />
              </Guard>
            }
          />
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
          {cloudEnabled ? "Shared demo" : "Local prototype"} · {role} · Live
          Singapore time: {now.replace("T", " ")} (SGT) ·{" "}
          {cloudEnabled
            ? "Shared Firestore data"
            : "Data saved in this browser"}
        </span>
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
        <Modal title="Your profile" onClose={() => setProfile(false)}>
          <div className="profile-summary">
            <span className="avatar">{initials}</span>
            <div>
              <h3>{name}</h3>
              <p className="muted">{role}</p>
              <p className="small muted">Basketball Academy</p>
            </div>
          </div>
          <p className="small muted">
            Local demo account - Data saved in this browser.
          </p>
          <Button
            onClick={() => {
              setProfile(false);
              signOut();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </Button>
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
