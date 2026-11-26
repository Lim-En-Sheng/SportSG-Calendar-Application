// Shared Supabase data by default; local mode is for offline development and tests.
export const cloudEnabled = import.meta.env.VITE_DATA_MODE !== "local";
export const cloudLabel = "Supabase";
