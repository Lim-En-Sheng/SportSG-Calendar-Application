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

## Switching modes

Default: Supabase. For a temporary rollback, put `VITE_DATA_MODE=firebase` in `.env.local` and restart Vite. For browser-local data use `VITE_DATA_MODE=local`. Delete that setting to return to Supabase. These are build-time settings; a hosted deployment must be rebuilt to change mode.

The sources do not synchronise with each other. Avoid editing the Firebase-hosted version while moving to Supabase. Keep Firebase until the new hosted deployment is verified.

## Preserve and transfer Firebase data

The migration utility never deletes Firebase records and refuses to overwrite any nonempty Supabase database:

```powershell
node scripts/migrate-firebase.mjs export
node scripts/migrate-firebase.mjs import .backups/<exported-file>.json
```

Export prints the exact backup path and counts. Import checks that Supabase revision is zero, writes atomically, and compares every saved record with the backup. `.backups/` is Git-ignored; keep a copy outside the repository too. Do not rerun import after normal Supabase editing; it will stop instead of replacing data.

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
