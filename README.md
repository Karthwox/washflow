# WashFlow - Campus Laundry System

WashFlow is a full-stack campus laundry tracking system for college students and laundry staff. Students see their free-wash quota, bills and where their laundry is in the queue. Operators log walk-in drop-offs, move jobs from pending to ready to collected, and read student feedback.

> **Status: working prototype.** Built for a planned pilot at IIIT Bangalore and not yet in use. See [SECURITY.md](SECURITY.md) for what must change before real students use it.

## Prerequisites
**Node.js** 18 or newer, and **npm**.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure
Copy the example settings and set an operator access key (at least 12 characters):
```bash
cp .env.example .env
```
Generate a key with:
```bash
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
```
and paste it after `OPERATOR_ACCESS_KEY=` in `.env`. The server refuses to start without one.

### 3. Start the API server
```bash
npm run server
```
It runs on http://localhost:3000. On the first run it creates demo data (five fictional students) and prints a **demo password** in the console. Log in as any demo student with their roll number (for example `2024CSB001`) and that password.

### 4. Start the portals
In two more terminals:

- **Student portal:** `npm run dev:student`, then open http://localhost:5173
- **Operator portal:** `npm run dev:operator`, then open http://localhost:5174 and log in with your `OPERATOR_ACCESS_KEY`

To start over with fresh demo data, stop the server, delete `database.json` and start it again. The operator's reset button works only when `ALLOW_DEMO_RESET=true` is set in `.env`, and asks for the access key again.

## Features
- **Two portals, one API.** The portal port (5173 or 5174) picks the dashboard; the server checks the role on every request.
- **Server-side billing.** Free washes, extra-wash charges, drying and ironing costs are all computed on the server.
- **Queue tracking.** Students see their position in the pending queue.
- **Feedback.** Students rate the service by category; operators see all feedback.
- **Light and dark themes.**

## Security
This version was hardened with [agent-security-skill](https://github.com/Karthwox/agent-security-skill), an AI coding-agent skill for building web apps securely. Decisions, limits and open items are recorded in [SECURITY.md](SECURITY.md).

- **Real logins:** student passwords hashed with scrypt; the operator key comes from `.env`. Previously, a roll number alone logged a student in, and the operator passkey was `admin`.
- **Sessions** expire, and logout ends them on the server.
- **Brute-force protection:** rate limits on login, registration and feedback.
- **Strict input validation:** type and length checks on every field, so malformed requests get a clear error instead of reaching the logic.
- **Safe concurrent writes:** a write queue with atomic file writes. Previously, simultaneous requests could lose updates and hand out free washes twice.
- **Valid status changes only:** jobs move Pending → Ready → Collected, never backwards or to an invented status.
- **Destructive reset** is off by default and needs the access key re-entered.
- **Locked-down API:** an exact CORS origin list, security headers, generic error messages, and no password hashes in any response.
- **No real data in the repo:** `database.json` is git-ignored.
