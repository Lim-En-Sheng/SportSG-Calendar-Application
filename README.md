<div align="center">

# 🏀 Coach Calendar

### Plan sessions. Deploy coaches. Verify every worked hour.

A coaching operations web application that brings programme scheduling, coach assignments, hourly attendance, and monthly reporting into one shared workflow.

**React · TypeScript · Vite · Figma-based design**

[Get started](#-get-started) · [Features](#-what-you-can-do) · [Workflow](#-how-attendance-becomes-a-verified-record) · [Demo](#-try-the-demo) · [Development](#-development)

</div>

---

> **Project status — Functional local prototype**  
> The screens and workflows run locally with browser-saved data. Live authentication, a shared database, and connected spreadsheet accounts are not yet implemented.

## ✨ What you can do

Coach Calendar supports three roles, each with a distinct part in planning and verifying coaching work.

| Role                | Main responsibility                         | Available functionality                                                                                                 |
| :------------------ | :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| **Assistant Coach** | Share availability and confirm worked hours | Monthly availability, assigned sessions, change requests, worked-slot review, and versioned monthly timesheets          |
| **Head Coach**      | Deploy the team and record attendance       | Available-coach selection, hourly assignments, request approval or rejection, attendance marking, and last-minute cover |
| **Admin**           | Manage programmes and verify records        | Programme creation, monthly reports, source comparison, discrepancy resolution, final-sheet verification, and exports   |

### 📅 Calendar & session planning

- A consistent calendar layout across all three roles, with previous/next month navigation.
- Programme details for the selected date, including time and venue.
- Assistant Coach availability selection and submission.
- Assigned, completed, and cancelled session views.
- Change requests that stay pending until the Head Coach approves or rejects them.
- Responsive layouts: desktop calendar cells show programme names; mobile cells show session counts with full details below.

### 👥 Coach assignments

- View coaches who have submitted availability for a programme date.
- Select coaches using checkboxes and choose their assigned time blocks.
- Already assigned coaches have checked, disabled checkboxes.
- Numbered assigned-coach lists and an **assigned / required** counter, such as **3/10**.
- One-hour assignment blocks, with a shorter final block when a session ends partway through an hour.
- Approved change requests retain the cancelled assignment in session history.

### ✅ Hourly attendance

- Head Coaches record **Present**, **Absent**, or **Not marked** for each assigned block.
- Unassigned hours remain **Not assigned** and are not treated as absences.
- Coaches can attend only part of a session.
- Last-minute additions record the coach, actual worked slots, and an optional reason.
- Partial-hour cover is retained exactly—for example, **09:30–10:15** records **0.75 hours**.
- Session notes and saved attendance survive page refreshes.

### 🕒 Assistant Coach timesheets

- Review actual worked slots after a session has ended.
- Add multiple worked slots, including breaks between them.
- Verify zero worked hours when the coach did not attend.
- Explain differences from Head Coach attendance.
- Submit a monthly timesheet once the completed sessions have been verified.
- Send a revised version within the same calendar month; previous submitted versions are retained.
- Draft edits stay separate from the submitted records used by Admin.

### 📊 Admin reports & reconciliation

- Monthly deployment and attendance overviews with compact table previews.
- Full sheets with **S/N**, stable record IDs, and record details.
- Search by coach, programme, or record ID; filter by coach, programme, date, and status.
- **25, 50, or 100 rows per page**, with continuous numbering and sticky table headers.
- Exact worked-slot comparison, rather than comparing only the total number of hours.
- Review missing source records and mismatched attendance.
- Accept Head Coach hours, accept Assistant Coach hours, or enter corrected slots.
- Record the Admin's decision, supporting reason, reviewer, and timestamp while retaining both sources.
- Verify the final attendance sheet and compare it against deployment.
- Require fresh verification when the underlying evidence changes.

### 🏟️ Programme management

Admins can create programmes with a live preview and the following details:

| Programme information                   | Scheduling information   |
| :-------------------------------------- | :----------------------- |
| Name and location                       | Session date             |
| Participant capacity                    | Start and end time       |
| Beginner, Intermediate, or Expert level | Number of coaches needed |

The programme list and coach directory are searchable.

## 🔄 How attendance becomes a verified record

| Step  | Owner           | Result                                                             |
| :---: | :-------------- | :----------------------------------------------------------------- |
| **1** | Assistant Coach | Submits availability for coaching dates                            |
| **2** | Head Coach      | Assigns coaches to programme time blocks                           |
| **3** | Head Coach      | Records attendance and any last-minute worked slots                |
| **4** | Assistant Coach | Verifies actual worked slots and sends a monthly timesheet         |
| **5** | Application     | Compares the two submitted sources by session and worked interval  |
| **6** | Admin           | Resolves differences and records the accepted worked time          |
| **7** | Admin           | Verifies the final attendance sheet for comparison with deployment |

> **Admin owns discrepancy resolution.** Head Coach attendance and Assistant Coach submissions remain separate source records. The accepted result becomes the final attendance record after Admin verification.

### Rules that matter

- **Not marked ≠ Absent.** Incomplete attendance remains unresolved.
- **Equal hours do not guarantee a match.** Working 09:00–10:00 differs from working 10:00–11:00.
- **Only completed sessions can be verified.** Assistant verification opens when the session ends.
- **The submission window is the same calendar month**, ending at 11:59 PM Singapore time on the final day.
- **Revisions require review.** Changed source evidence invalidates an earlier resolution or final-sheet verification.
- **Exports include the selected result set**, not just the currently visible page.

## 📥 Export options

| Option                    | Current behaviour                                                                      |
| :------------------------ | :------------------------------------------------------------------------------------- |
| **Download .csv**         | Downloads all filtered results or all rows in the selected monthly sheet               |
| **Open in Excel**         | Downloads a real `.xlsx` workbook to open in Excel                                     |
| **Open in Google Sheets** | Provides a CSV download and instructions to import it using **File → Import → Upload** |

Direct Google Sheets and Microsoft account connections are not configured. Export buttons do not upload records to those services automatically.

## 🚀 Get started

### Requirements

- **Node.js 24+** and npm.
- A modern browser.
- **Microsoft Edge** installed if you want to run the browser tests with the included configuration.

### Start the application

From the `Code Base` folder, open a terminal and run:

```powershell
cd Coach-Calendar
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite, usually **http://localhost:5173**. Stop the development server with **Ctrl+C**.

If your terminal is already inside `Coach-Calendar`, skip the first command. On macOS or Linux, use `npm` instead of `npm.cmd`.

### Preview a production build

```powershell
npm.cmd run build
npm.cmd run preview
```

## 🎮 Try the demo

The app first opens as **Head Coach**. Use the profile avatar in the top-right corner to switch roles or select an Assistant Coach. The selected role is remembered when you refresh the same browser tab.

1. **Explore assignments.** Select **19 September 2026** to see the assigned coaches. Open **Update assignments** to select available coaches and hourly blocks.
2. **Record attendance.** Open **Take attendance**. Mark individual blocks or use **Add coach** to record partial-hour, last-minute cover.
3. **Verify Ryan's hours.** Switch to **Assistant Coach → Ryan Coo**, then open **My sessions → Verify worked hours**. Review **19 September**, explain the difference, verify the slots, and send the revised timesheet.
4. **Resolve the difference.** Switch to **Admin → Reports**. Review Ryan's record, choose the accepted hours, and enter a reason.
5. **Verify and export.** Verify the final sheet once all completed-session differences are resolved. Open the full report to try the filters and exports.

**Example clock:** `20 September 2026, 14:00 SGT`.

The sample clock keeps the September verification window open so you can try the Figma scenario. Turn it off in the profile dialog to use the real Singapore date and time. The first-run data is fictional; your changes are saved in this browser.

## 🛠️ Development

### Commands

| Command                    | Purpose                                                          |
| :------------------------- | :--------------------------------------------------------------- |
| `npm.cmd run dev`          | Start the local development server                               |
| `npm.cmd run build`        | Type-check and create the production bundle                      |
| `npm.cmd run preview`      | Serve the production build locally                               |
| `npm.cmd test`             | Run attendance, timesheet, reconciliation, and export rule tests |
| `npm.cmd run test:browser` | Run the end-to-end browser workflows                             |
| `npm.cmd run lint`         | Run Oxlint                                                       |
| `npm.cmd run format`       | Format application code and tests with Prettier                  |

### Technology

| Area                         | Implementation                                               |
| :--------------------------- | :----------------------------------------------------------- |
| User interface               | React and TypeScript                                         |
| Development and builds       | Vite                                                         |
| Navigation                   | React Router                                                 |
| Dates and calendar utilities | date-fns; Singapore time for verification rules              |
| Visual styling               | CSS, shared Figma colour tokens, locally bundled Inter font  |
| Excel exports                | write-excel-file                                             |
| Local persistence            | Browser `localStorage`; view preferences in `sessionStorage` |
| Verification                 | Node.js test runner and Playwright with Microsoft Edge       |

### Project structure

```text
Coach-Calendar/
├── public/
│   └── figma/                 # Downloaded Figma SVG assets
├── src/
│   ├── App.tsx                # Application shell, navigation and role routes
│   ├── Calendar.tsx           # Calendar, assignments, sessions and requests
│   ├── Attendance.tsx         # Head Coach attendance and last-minute cover
│   ├── Timesheet.tsx          # Assistant verification and monthly submission
│   ├── Reports.tsx            # Admin review, final verification and exports
│   ├── Programmes.tsx         # Programme management and coach directory
│   ├── components.tsx         # Shared controls, dialogs and slot editor
│   ├── model.ts               # Types, sample data and reconciliation rules
│   ├── store.tsx              # Persistence, role settings and action history
│   ├── App.css                # Screen layouts and responsive styling
│   └── index.css              # Typography, base styles and design tokens
├── tests/
│   ├── model.test.ts          # Business-rule tests
│   └── browser/               # End-to-end workflow tests
├── playwright.config.ts
├── vite.config.ts
├── package.json
└── README.md
```

Generated output such as `dist/`, `node_modules/`, and `test-results/` is excluded from version control.

### Test coverage

The current test suite contains **10 business-rule tests** and **8 browser workflow tests** covering:

- Worked-interval comparison, gaps, partial-hour cover, and invalid or overlapping slots.
- Singapore-time verification windows and month-end boundaries.
- Draft versus submitted timesheets, missing attendance, and stale resolutions.
- Coach assignments, disabled checkboxes, and change-request history.
- Attendance notes and role preferences after refresh.
- Assistant verification through Admin resolution and final-sheet verification.
- Actual CSV and Excel downloads, including CSV escaping.
- **1,000-row reporting**, pagination, and export of all filtered records.
- Mobile layout and downloaded Figma asset rendering.

Browser tests start a development server when needed. Screenshots and failure details are saved to `test-results/`. Reports in the app show the actual local record count; the 1,000-row dataset is a test fixture.

## 💾 Data & production readiness

| Available locally                              | Needed before a shared production launch                    |
| :--------------------------------------------- | :---------------------------------------------------------- |
| Demonstration role switching                   | Authentication and server-enforced permissions              |
| Browser-saved application data                 | Shared database, backups, and multi-user synchronisation    |
| Client-side time-window checks                 | Server-enforced submission windows and trusted timestamps   |
| Versioned submissions and local action history | Immutable audit records and concurrent-edit handling        |
| Downloadable spreadsheets                      | Connected Google/Microsoft accounts for direct integrations |
| Local development and production builds        | Hosting and deployment configuration                        |

Application data uses the browser storage key **`coach-calendar-v1`**. View preferences use **`coach-calendar-view`** in session storage. Records are not synchronised between users, devices, browser profiles, or different site origins. Clearing browser site data removes the locally saved records.

## 🎨 Design reference

The interface is based on the [Coach Calendar Figma design](https://www.figma.com/design/4aHZ5NQiVuIq9EVrk6QvQG), including its shared red-and-white visual language, role-specific calendars, assignment panels, attendance screens, timesheet review, and Admin reports.

<details>
<summary><strong>Figma screen references</strong></summary>

| Screen                         | Figma node                      |
| :----------------------------- | :------------------------------ |
| Assistant Coach calendar       | `191:455`                       |
| Head Coach calendar            | `226:307`                       |
| Select date and assign coaches | `103:26`                        |
| Assigned coaches               | `226:481`                       |
| Hourly attendance              | `274:1823`                      |
| Last-minute cover              | `276:1966`                      |
| Assistant Coach sessions       | `226:149`                       |
| Monthly timesheet              | `280:1966`                      |
| Worked-session review          | `280:2033`                      |
| Admin report overview          | `242:165`                       |
| Attendance reconciliation      | `249:775`                       |
| Admin resolution               | `243:251`                       |
| Programme management           | `146:109`, `146:142`, `146:219` |

The placeholder brand is named **Coach Calendar**. Session times follow the newer hourly-attendance design. Historical sample sessions are linked to their calendar entries, and responsive layouts replace fixed Figma positioning.

</details>
