# CivicAI – AI-Powered Smart Complaint Management and Resolution System

## Overview

CivicAI is a municipal complaint management system that lets citizens report civic
issues, track complaint status, and get help from an AI assistant. Officers and
admins get their own dashboards to triage, assign, and resolve complaints.

**This version includes a complete working backend** — previously, the project
had a full React frontend but no server-side auth, database, or complaint
logic at all, which is why login could be bypassed. That has been fixed.

---

## What was fixed / added

- **Real authentication** — `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`,
  `/api/auth/logout`. Passwords are hashed with Node's built-in `crypto.scrypt`
  (no plaintext storage). Sessions use random 256-bit tokens, not guessable IDs.
- **Real data layer** — a JSON-file database (`server/data/db.json`, auto-created
  on first run) storing users, complaints, departments, officers, notifications,
  and status history. No external database server required.
- **Full complaints API** — create, list (scoped by role), view detail + timeline,
  upvote/duplicate-backing, citizen feedback, admin assignment, officer status
  updates, and admin escalation.
- **AI complaint triage** — automatic priority classification, hazard severity
  scoring, sentiment detection, and duplicate-complaint detection, all rule-based
  so it works instantly with zero API cost. If you add a `GEMINI_API_KEY` and
  flip `USE_MOCK_AI` to `false` in `server.ts`, the AI chatbot and admin
  "smart reply" generator will use live Gemini calls instead of templates.
- **Analytics endpoint** for the admin dashboard's charts.
- **Fixed a broken `Chatbot` component prop type** that failed `tsc` type-checking.

## Why your deployed site skipped the login page

The version deployed on Cloud Run (via Google AI Studio's auto-deploy) was very
likely a different/older build than what's in this repo — the deployed backend
had no `/api/auth/*` routes at all, only a stub `/api/ai/chat`. There's no code
that could produce a persistent logged-in session honestly, so if you ever want
the *deployed* app fixed, you need to redeploy this updated project so the real
server code above replaces whatever AI Studio generated.

---

## Demo accounts (seeded automatically on first run)

| Role    | Email                | Password    |
|---------|-----------------------|-------------|
| Admin   | admin@civicai.com     | Admin@123   |
| Citizen | citizen@civicai.com   | Citizen@123 |
| Officer | thomas@civicai.com    | Officer@123 |

(A few more officer accounts exist too: maria@, james@, priya@civicai.com, all
with password `Officer@123`, covering each municipal department.)

You can also just sign up as a new citizen from the app itself.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind, Vite
- **Backend:** Node.js, Express
- **Data storage:** JSON file (`server/data/db.json`) — no DB server needed
- **Auth:** Server-side sessions with `crypto.scrypt` password hashing
- **AI:** Google Gemini API (optional; rule-based fallback works out of the box)

---

## Project Structure

```
src/
 ├── components/       # Login, Signup, dashboards, chatbot
 ├── App.tsx            # Auth/session bootstrapping + route resolver
 ├── main.tsx
 └── types.ts

server.ts               # Express app + all API routes
server/
 ├── db.ts               # JSON file datastore + seed data
 ├── auth.ts             # password hashing / session tokens
 └── ai.ts                # complaint classification, duplicate detection

package.json
vite.config.ts
```

---

## Installation

```bash
npm install
npm run dev
```

The server starts on **http://localhost:3000**. A `server/data/db.json` file
is created automatically on first run, seeded with the demo accounts above.

## Environment Variables

Copy `.env.example` to `.env`:

```
GEMINI_API_KEY=YOUR_API_KEY
```

This is optional — the app works fully without it, using rule-based AI triage
and templated chatbot/smart-reply responses. Set `USE_MOCK_AI = false` in
`server.ts` once you have a key and want live Gemini responses.

## Production build

```bash
npm run build
npm start
```

---

## Author

Harshitha S

B.E Computer Science Engineering

## 🚀 Live Demo

🔗 https://civicai-616320387857.asia-southeast1.run.app

*(Note: redeploy this updated project to Cloud Run for the live demo to use
the real authentication described above.)*
