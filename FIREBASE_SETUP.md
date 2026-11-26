> Supabase is now the default. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md). This document is retained for Firebase rollback.

﻿# Firebase shared demo setup

The app now uses Firestore for all demo data. The demo account selector remains unchanged; Firebase Authentication is not used.

## Enable the shared demo

1. In Firebase project `coach-calendar-72249`, create the default Cloud Firestore database (Standard edition).
2. Open Firestore > Rules. For a temporary demo with fictional data only, copy the contents of `firestore.demo.rules` and publish them. The rules expire on **10 December 2026 (UTC)**.
3. Run `npm run dev` and reload the app. The banner should say **Shared demo connected**.
4. Create a programme. Open the same app on another workstation: it should appear there without reloading. Availability, assignments, attendance, timesheets, reconciliation and requests use the same shared state.
5. Republish the application to Sites when ready. Local edits do not update the hosted version automatically.

**No authentication means anyone who accesses this database can read and edit the shared demo, regardless of the role selected in the UI.** These rules are scoped to one document and time-limited, but they are not private group access. Do not enter real personal or attendance information. Add Firebase Authentication and enforce roles in rules before real use.

## Existing local data

Existing localStorage data is retained and is not automatically uploaded. The cloud starts empty to avoid one workstation overwriting another's data. To revisit the previous local version, set `VITE_DATA_MODE=local` in `.env.local` and restart Vite. Remove that setting to return to Firestore. Programmes can be recreated using the existing spreadsheet import.

## Saving and conflicts

The shared document is `demos/coach-calendar`. Live listeners receive confirmed server updates. Saves use transactions with revision checks: if another workstation saved first, your stale save is rejected and you must review current data before retrying. Forms only report success after Firestore confirms the write. Offline changes are not queued as successful cloud saves.

This first demo uses a single document and limits the JSON payload to 800 KB (Firestore also enforces its own document size limit). It is not intended for the eventual 1000-row reports workflow. Before larger datasets, split records into collections and add authenticated, record-level rules. Exporting reports does not remove stored records or free space.

## Verification

Run `npm run build` and `npm test`. Browser regression tests start an isolated local-mode dev server; they do not write to the live Firebase project. Live multi-workstation reads/writes require the console setup above and must be checked after enabling it.

The Firebase web config is public client configuration, not a service-account credential. Do not put service-account private keys in this app.
