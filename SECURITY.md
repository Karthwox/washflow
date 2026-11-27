# SECURITY.md

Project security decisions for WashFlow, kept with [agent-security-skill](https://github.com/Karthwox/agent-security-skill). Anything not listed means no access.

Exposed: no   <!-- Local prototype. Run the exposure gate before any real deployment. -->

## Roles
- **anonymous:** can register and log in, nothing else.
- **student:** a registered student, identified by the session.
- **serviceman:** laundry operator (staff), identified by the operator access key.

## Access matrix
| Resource | Anonymous | Student (own) | Student (other's) | Serviceman | Notes |
|----------|-----------|---------------|-------------------|------------|-------|
| Student profile | none | R | none | R, reset quota | Password hashes never leave the server |
| Laundry jobs | none | R | none | C, R, update status | Status moves only Pending → Ready → Collected |
| Feedback | none | C, R | none | R | Stored as plain text; React escapes on render |
| Pricing | none | R | R | R | Server-side constants; bills are computed on the server |
| Whole database | none | none | none | reset (demo only) | Needs `ALLOW_DEMO_RESET=true` and the access key re-entered |

## Identity rules
- Student id and role come from the server-side session, never from the request.
- Sessions are random 256-bit tokens with an absolute lifetime (students 12 h, operators 8 h) and are removed on logout.
- The portal a user opens (port 5173 or 5174) only changes the UI. Every API route checks the role on the server.

## Server-only operations
- Wash-quota changes and bill calculation (create task, status changes, quota reset).
- All writes go through one queue and are written atomically, so concurrent requests can't lose updates or double-spend a free wash.

## Secrets inventory
| Name | Can do | Lives in | Read by | Rotate |
|------|--------|----------|---------|--------|
| `OPERATOR_ACCESS_KEY` | Full operator access, and confirms database resets | `.env` (git-ignored) | `server.js` only | Change it in `.env` and restart; all sessions end |
| Demo student password | Log in as the fictional demo students | Printed once to the server console when demo data is created | Developer | Delete `database.json` and restart |

The server refuses to start without `OPERATOR_ACCESS_KEY`. There are no fallback secrets.

## Abuse surface
| Endpoint | Caller | Cost / risk | Limit | Keyed by | On exceed |
|----------|--------|-------------|-------|----------|-----------|
| `POST /api/login` | anonymous | Password guessing | 20 / 15 min, and 5 / 15 min per account | IP, roll number | 429 + `Retry-After` |
| `POST /api/register` | anonymous | Fake accounts, storage | 5 / hour | IP | 429 |
| `POST /api/student/feedback` | student | Spam | 5 / hour | student id | 429 |
| Operator write routes | serviceman | Mistakes, scripted misuse | 300 / hour | session | 429 |
| All routes | anyone | Memory / CPU | 16 KB request body; strict JSON object; length caps on every field | n/a | 413 / 400 |

## Budgets
- No paid APIs, email or SMS. Nothing to cap.

## Authentication decisions
- Approach: custom (small prototype, no external provider). Passwords are hashed with scrypt (Node's built-in `crypto`), with a random salt per password and constant-time comparison.
- Session mechanism: bearer token in the `Authorization` header (no cookies, so no CSRF surface).
- Lifetimes: students 12 h, operators 8 h, absolute. In memory, so a restart signs everyone out.
- Password policy: 8 to 128 characters.
- MFA: not yet.
- Redirect allowlist: n/a (no redirects).

## Assumptions
- Operator re-authentication is required only for the destructive database reset. Routine operator actions (creating tasks, marking jobs ready, resetting one student's quota) are logged to the server console instead, because staff do them all day.
- The JSON data file and in-memory sessions and rate limits are fine for a single local process.
- The demo students and their phone numbers are fictional.

## Deferrals
Each item must be done before WashFlow is used with real students.
- **Prove who a student is.** Anyone can register any unused roll number. Tie registration to college SSO or a verified `@iiitb.ac.in` email before real use.
- **Individual operator accounts** instead of one shared access key, so actions are traceable to a person.
- **Real database** (for example Postgres) with backups, replacing `database.json`.
- **Shared session and rate-limit store** (for example Redis) if more than one server process runs.
- **HTTPS and HSTS** at the host or reverse proxy.
- **Token storage:** the session token is kept in `localStorage`. Move to an `HttpOnly` cookie (with CSRF protection) when deploying.
- **Password reset** flow.

## Accepted risks
None yet.
