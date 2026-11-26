import { cloudEnabled } from "./dataConfig";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "./store";
import { Button } from "./components";

export function Login() {
  const { state, signIn } = useStore();
  const [account, setAccount] = useState("");
  const navigate = useNavigate();
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Welcome Log in</h1>
        <p className="login-subtitle">Sign in to Coach Calendar</p>
        <div className="login-divider" />
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!account) return;
            if (account === "head") signIn("Head Coach");
            else if (account === "admin") signIn("Admin");
            else if (state.coaches.some((coach) => coach.id === account))
              signIn("Assistant Coach", account);
            else return;
            navigate("/calendar", { replace: true });
          }}
        >
          <label htmlFor="login-account">Full name / Coach ID</label>
          <select
            id="login-account"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            required
            aria-describedby="account-help"
          >
            <option value="" disabled>
              Select a demo account
            </option>
            <option value="head">Maya Chen (HC)</option>
            {state.coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name} (AC)
              </option>
            ))}
            <option value="admin">Admin</option>
          </select>
          <p id="account-help" className="login-field-help">
            HC: Head Coach · AC: Assistant Coach
          </p>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            disabled
            placeholder="Not required for demo"
            aria-describedby="password-help"
          />
          <p id="password-help" className="login-field-help">
            Password sign-in is disabled for this demo.
          </p>
          <Button type="submit" disabled={!account}>
            Log in
          </Button>
        </form>
        <p className="login-note">
          Demo accounts only.{" "}
          {cloudEnabled
            ? "Data is shared with everyone using this demo."
            : "Your data is saved in this browser."}
        </p>
      </section>
    </main>
  );
}
