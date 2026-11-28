# Sukhsa Export – Central Admin & ERP (admin.sukhsa.in)

Next.js (App Router) + MongoDB Atlas, owned by the company account.

## Phase 1: copy Firestore into the company MongoDB (current step)

The live app at attendance.sukhsa.in is **not changed**. The migration only *reads* from Firestore.

### Two databases inside the same Atlas cluster

| Database | Purpose |
|---|---|
| `firestore_mirror` | Raw, 1:1 copy of Firestore. Re-runnable. Never edited by hand. |
| `sukhsa_central` | The real central database the admin/ERP APIs use. Built from the mirror with a clean schema (`employees`, `attendance`, `users` with roles, …), linked by `employeeId` / `empCode`. |

Keeping the raw copy separate means we can redesign the central schema freely and always
re-check it against the original data.

### One-time setup

1. **Atlas (company account)**
   - Database Access → add user (for example `sukhsa_app`) with role *Read and write to any database*.
   - Network Access → add your current IP address.
   - Connect → Drivers → Node.js → copy the connection string.
2. **Firebase read-only key (recommended)**
   - Open Google Cloud Console for project `gen-lang-client-0550725378` → IAM & Admin → Service Accounts → *Create service account* named `mongo-migration-readonly`.
   - Give it only the role **Cloud Datastore Viewer** (read-only Firestore access).
   - Keys → Add key → JSON. Save it as `secrets/firebase-service-account.json` in this project.
   - (The default "Generate new private key" in Firebase settings also works, but it has full write access.)
3. Copy `.env.example` to `.env.local` and fill in `MONGODB_URI`.
4. `npm install`

### Run the migration

```powershell
npm run migrate:dry      # reads + counts only, writes nothing
npm run migrate          # copies everything into firestore_mirror
npm run migrate:verify   # compares counts and sampled documents against live Firestore
npm run migrate:inspect  # prints field names/types per collection (no values)
```

- **Re-runnable:** documents are upserted by Firestore id. Run it again any time to pull in new attendance data. It never creates duplicates.
- **Deletions are not mirrored:** a document deleted in Firestore stays in the mirror. `verify` shows this as a count difference.
- **Skipped by default:** `guard_sessions` (short-lived login tokens). Change `MIGRATE_EXCLUDE` in `.env.local` to include or skip others.
- **Type conversion:** Timestamp → Date, DocumentReference → `{ _ref: "path" }`, GeoPoint → GeoJSON Point.
- **Subcollections:** `employees/{id}/history` becomes collection `employees__history`, `_id` = full Firestore path, and `_fs.parent` = parent doc path.
- Each mirrored doc carries `_fs: { id, path, parent, createTime, updateTime, mirroredAt }`.
- Reports are written to `migration-reports/` (git-ignored).

## Phase 2: central database (`sukhsa_central`)

```powershell
npm run sync                       # BOTH steps below: Firestore -> mirror -> central
npm run migrate                    # refresh the mirror from live Firestore
npm run central:build              # rebuild sukhsa_central from the mirror
npm run payroll:month -- 2026-10   # monthly payroll summary to compare with the Sheet
npm test                           # payroll rule tests
```

| Collection | Contents | Key |
|---|---|---|
| `employees` | empCode, name, department, category (permanent/temporary), hourlyRate, breakMinutes, active | `_id` = employeeId, `empCode` unique |
| `attendance` | one record per employee per day: in/out, pause, `calc` (gross, break, net, Present, H) recomputed by `src/lib/payroll.ts`, `legacy` = old app's values | `employeeId + date` unique |
| `monthly_theka` | Theka minutes per employee per month | `employeeId + month` unique |
| `users` | admins (Google email) and guards (username + PBKDF2 hash), with role `super_admin` / `admin` / `supervisor` / `guard` | email / username unique |
| `auth_salts`, `settings` | copied unchanged (guard salt, Google Sheets config) | |

Validators and indexes are defined in `src/lib/schema.ts`. `central:build` is safe to re-run until cutover.
After cutover, insert `{ _id: "cutover" }` into `settings` and the script will refuse to overwrite the central data.

## Run the app

```powershell
npm run dev
```

Open http://localhost:3000/api/health. It should return `{ "ok": true }`.

## Next phases

1. Design `sukhsa_central` from the `migrate:inspect` output, with validation and indexes.
2. Port the payroll rules exactly (30-min break at ≥ 4.5 h gross; Mon–Sat ≥ 8 h net = 1 Present + extra minutes as H; < 8 h = 0 Present, all minutes H; Sunday all H; Net Payable = max(0, Total − Theka) × rate), with tests against real past months.
3. Admin APIs + Super Admin / Admin / Supervisor dashboards.
4. Later: point attendance.sukhsa.in at these APIs, move admin authorization into MongoDB, move Google Sheets to company credentials, and disconnect the personal Firebase project.

## Phase 3: live system (central DB is the source of truth)

`sukhsa_central` was locked on 2026-11-28 (`npm run central:lock`). Firestore is now a read-only backup;
`npm run central:build` refuses to overwrite the central DB. Apply schema/index changes with `npm run central:schema`.

### Code layout
| Folder | Role |
|---|---|
| `src/lib/services/` | Business rules (employees, attendance, payroll, locks, users, audit, overview). Used by both pages and APIs. |
| `src/lib/api/` | `errors.ts` (ApiError, validation), `http.ts` (`withAuth` wrapper for API routes) |
| `src/app/api/v1/` | REST API (JSON). All routes need a signed-in user with the right role. |
| `src/app/admin/` | Admin dashboard pages (sidebar layout in `layout.tsx`) |

### API (v1)
| Method & path | Who | What |
|---|---|---|
| `GET /api/v1/overview?month=` | Admin | Dashboard numbers |
| `GET /api/v1/employees?q=&category=&department=&active=` | Admin, Supervisor | List / search |
| `POST /api/v1/employees` | Admin | Create |
| `GET / PATCH /api/v1/employees/:id` | Read: Admin, Supervisor · Edit: Admin | Profile + Theka / edit, `active:false` to deactivate (never deleted) |
| `PUT /api/v1/employees/:id/theka` | Admin | `{ month, hours }` |
| `GET /api/v1/attendance?month=&date=&employeeId=&status=` | Admin, Supervisor | List |
| `POST /api/v1/attendance` | Admin | Manual record |
| `PATCH / DELETE /api/v1/attendance/:id` | Admin | Correct / delete, `reason` required, payroll recalculated |
| `GET /api/v1/payroll/:month?category=&format=csv` | Admin | Monthly payroll (JSON or Excel CSV) |
| `POST / DELETE /api/v1/payroll/:month/lock` | Lock: Admin · Unlock: Super Admin | Freeze a paid month |
| `GET / POST /api/v1/users`, `PATCH /api/v1/users/:id` | Super Admin | Panel access & roles |
| `GET /api/v1/audit?entity=&entityId=` | Admin | Change history |

Every write is recorded in `audit_log` (who, when, before → after, reason).

### Gate Desk & guards (replaces attendance.sukhsa.in's Guard Gate Desk)
| Method & path | Who | What |
|---|---|---|
| `GET /api/v1/gate` | Guard, Admin, Supervisor | Active employees with today's state (not in / inside / on break / done) |
| `POST /api/v1/gate/:employeeId` `{ action: in \| pause \| resume \| out }` | Guard, Admin, Supervisor | Spec §4.5 live timer; Out calculates payroll |
| `GET / POST /api/v1/guards`, `PATCH / DELETE /api/v1/guards/:id` | Admin | Guard logins (create, rename, activate/deactivate, reset password, delete) |
| `GET /api/v1/employees/:id/sheet?month=&format=csv` | Admin | Individual sheet: monthly summaries + day sheet (TOTAL → Less Theka → NET PAYABLE) |
| `DELETE /api/v1/employees/:id` `{ confirmCode }` | Admin | Hard delete employee + all attendance (spec §4.3) |

- Guards sign in at `/login/guard` (username + password) and only ever see `/gate`.
- Guard passwords use the old app's scheme (PBKDF2-SHA256, 100k, salt `gatelog:<hex>`), so existing guards keep their passwords.
  8 wrong tries pause the account for 15 minutes.
- `npm run central:recalc` recalculates every closed attendance record with the current payroll rules (skips locked months).

## Roles, dashboards and payroll approval
| Role | Who | Home | Can do |
|---|---|---|---|
| `super_admin` | CEO | `/ceo` | Everything; **approves** payroll, sends back, reopens; Users & roles |
| `admin` | Accounts | `/admin` | Employees, attendance, Theka, guards, teams; **prepares & submits** payroll; marks paid |
| `supervisor` | Floor lead | `/supervisor` | Only their team (no pay data): team dashboard, team attendance, Gate Desk for their team |
| `guard` | Gate | `/gate` | Gate Desk only |

Payroll month flow (`payroll_runs`, API `POST /api/v1/payroll/:month/status`):
Draft → **submit** (Admin; blocked if any shift has no Out time) → Waiting for approval (month frozen) →
**approve** (CEO; totals must match the submitted totals) or **reject** (CEO, note required → Sent back, editable) →
Approved → **mark_paid** (Admin/CEO) → Paid. **reopen** (CEO, note required) returns any of these to Draft.

Teams: `employees.supervisorId`; manage on `/admin/teams` (`GET /api/v1/teams`, `PUT /api/v1/teams/:supervisorId { employeeIds }`).
All employee / attendance / Gate APIs automatically limit supervisors to their own team.
