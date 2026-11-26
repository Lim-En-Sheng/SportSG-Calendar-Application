// Firebase is retained temporarily for migration/rollback; no automatic fallback.
export const dataMode = import.meta.env.VITE_DATA_MODE ?? "supabase";
export const cloudEnabled = dataMode !== "local";
export const cloudLabel = dataMode === "firebase" ? "Firebase" : "Supabase";
