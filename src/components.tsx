import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { format, parseISO } from "date-fns";
import type { Session, Slot } from "./model";
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "link";
}) {
  return (
    <button
      type="button"
      className={`button ${variant} ${className}`}
      {...props}
    />
  );
}
export function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function SessionInfo({ session }: { session: Session }) {
  return (
    <div className="session-info">
      <h3>{session.title}</h3>
      <p>
        {format(parseISO(session.date), "EEEE, d MMMM yyyy")} · {session.start}–
        {session.end} · SGT
      </p>
      <p>{session.venue}</p>
      <p>Head coach: {session.headCoachName || "Not assigned"}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    const previous = document.activeElement as HTMLElement;
    d.showModal();
    return () => {
      d.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
    >
      <div className="row between">
        <h2 id="modal-title">{title}</h2>
        <Button variant="link" aria-label="Close dialog" onClick={onClose}>
          ×
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function SlotsEditor({
  value,
  onChange,
  min,
  max,
}: {
  value: Slot[];
  onChange: (v: Slot[]) => void;
  min: string;
  max: string;
}) {
  return (
    <div className="stack">
      {value.map((slot, i) => (
        <div className="row slot-editor" key={i}>
          <label>
            Start time
            <input
              type="time"
              min={min}
              max={max}
              value={slot.start}
              onChange={(e) =>
                onChange(
                  value.map((v, n) =>
                    n === i ? { ...v, start: e.target.value } : v,
                  ),
                )
              }
              required
            />
          </label>
          <label>
            End time
            <input
              type="time"
              min={min}
              max={max}
              value={slot.end}
              onChange={(e) =>
                onChange(
                  value.map((v, n) =>
                    n === i ? { ...v, end: e.target.value } : v,
                  ),
                )
              }
              required
            />
          </label>
          <Button
            variant="secondary"
            aria-label={`Remove time slot ${i + 1}`}
            onClick={() => onChange(value.filter((_, n) => i !== n))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => onChange([...value, { start: min, end: max }])}
      >
        Add time slot
      </Button>
      {!value.length && (
        <p className="muted">
          No hours worked. Verify this only if you did not attend.
        </p>
      )}
    </div>
  );
}
