# Supabase setup and migration

Coach Calendar now defaults to Supabase project `dbriqiypbwfsswztdidf`. The existing demo account selector remains; this is not authenticated role-based access.

## Database setup

Run `supabase/setup-demo.sql` in Supabase **SQL Editor > New query > Run**. It is safe to rerun: existing data and revision numbers are retained. The publishable key in `src/supabase.ts` is intended for browser use; never add a service-role key or database password there.

The setup script creates:

- Separate private tables for programmes (`sessions`), coaches, assignments, availability, attendance, timesheets, reviews, requests and audit entries.
- Indexed programme dates and assignment foreign keys. Detailed hourly evidence is retained as JSON in each row.
- Public `coach_calendar_read` and `coach_calendar_save` RPCs. Saves are atomic and reject stale revisions; clients cannot bypass them with direct table writes.
- A read-only revision notification table for Realtime, with 15-second polling fallback in the app.

**Demo access expires on 10 December 2026 UTC. Until then, anyone with the public project details can read or change the demo through the RPCs.** UI-selected roles are not security boundaries. Use fictional data only. Add Supabase Auth and user-specific policies before real use. Private tables are protected from direct anonymous access, but the deliberately public demo RPCs expose their data.

## Local development and backups

Supabase is the default. For browser-local data, set `VITE_DATA_MODE=local` in `.env.local` and restart Vite. Remove that setting to return to Supabase. A hosted deployment must be rebuilt to change mode.

The completed migration backup is retained in the Git-ignored `.backups/` directory. Keep a separate copy for recovery. The application no longer includes the previous database provider or migration utility.

## Verification and limits

```powershell
npm test
npm run test:database
npm run build
npm run test:browser
```

Database tests run PostgreSQL locally with PGlite and cover row storage, complete round trips, conflicts, rollback, permissions, rerunning setup and expiry, including 1,001 programmes. Browser regression tests use local mode and do not modify cloud data.

The UI currently fetches the full demo snapshot through RPC and uses a global revision. SQL stores separate rows, but this transitional client still caps saves at 5 MB and unrelated simultaneous edits can conflict. Larger production deployments should use per-record queries/pagination and smaller transactions with authenticated policies. Do not treat the demo as a production system.

After deploying, check for **Supabase shared demo connected**. Open another browser/workstation to confirm shared records. Missing schema, expired access and network failures are shown in the status banner; failed saves are not reported as successful.
