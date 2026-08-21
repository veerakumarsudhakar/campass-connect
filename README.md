# CampusPass

CampusPass is a Firebase-backed digital hostel outpass system. A single `outpasses` record progresses through Student → Advisor → HOD → Principal → Year Warden → Resident Councillor → Security exit/return. Server-side callable functions own every state change, add approval/gate/audit records, and reject bypass attempts.

## Structure

```
src/                 React responsive dashboards and workflow UI
functions/index.js   Firebase Functions: create, approval state machine, gate logs
firestore.rules      Client read-only rules for outpasses; Functions write changes
storage.rules        Validated permission-letter uploads
```

## Firebase data model

- `users/{uid}`: `role`, `displayName`, `registerNumber`, `department`, `year`, `parentPhone`
- `students/{id}`: directory profile managed by the Year Warden
- `outpasses/{id}`: student/travel details, controlled `status`, optional `passNumber`
- `outpasses/{id}/approvals/{id}`: immutable approval decisions
- `outpasses/{id}/gateLogs/{id}`: independent exit and return events
- `outpasses/{id}/auditLogs/{id}`: immutable lifecycle audit records

## Start locally

1. Enable Email/Password authentication, Firestore, Realtime Database, Storage, and Functions in Firebase.
2. Copy `.env.example` to `.env.local` and set the web-app Firebase values. This workspace is already configured locally for the supplied `campass-connect-d4f45` project; `.env.local` is ignored by Git.
3. Run `npm install` and then `npm run dev`.
4. Run `cd functions; npm install; cd ..`.
5. Deploy with Firebase CLI: `firebase deploy --only firestore:rules,database,storage,functions`.

## Realtime Database security

The provided `".read": true, ".write": true` policy must not be deployed. It permits anonymous users to change requests, approvals, gate entries, and student details. [database.rules.json](database.rules.json) locks writes to trusted backend code and limits reads to signed-in users. The primary approval state machine remains in Firestore and Firebase Functions; Realtime Database is initialized for real-time operational channels without weakening that workflow's authorization.

Create Firestore user profiles after creating Auth users. Role strings must exactly match: `Student`, `Class Advisor`, `HOD`, `Principal`, `Year Warden`, `Resident Councillor`, `Security`.

## User registration

Students can use **Create your CampusPass account** from the sign-in screen. It uses Firebase Authentication plus an atomic Firestore batch to create linked `users`, `students`, and protected `registerNumbers` records—no Cloud Functions deployment or paid Firebase plan is required. It only ever grants the `Student` role. Staff roles must be provisioned by an administrator.

Without Firebase values, the app opens an interactive visual preview. In connected mode, request creation, decisions, gate logs, audit events, and dashboard data are stored in Firebase.

## Deploy to Vercel

1. Push this project to GitHub, then import it in Vercel (Vite is detected automatically).
2. In **Settings → Environment Variables**, add the values from `.env.local` for Production, Preview, and Development. Never commit `.env.local`.
3. Deploy. Vercel runs `npm run build`, publishes `dist`, and [vercel.json](vercel.json) rewrites app routes to `index.html`.

Firebase remains the authentication and database backend; Vercel hosts only the React frontend.
