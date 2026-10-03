# CampusPass

## Portal updates

Dashboard counts open matching request or account views. Administrators can filter users by access status, requested role, and department, and see approved counts for each role. All administrators subscribe to the same Firestore users collection; account changes also update the affected user's open session.

Students have separate in-progress, approved, and rejected views and supply their own mobile number. Staff can filter requests by department and year, with section filters for Advisors and HODs. Registration and admin account creation show section fields only for Students and Class Advisors. Approval trails display the signed-in approver's name and UID. Principal approval assigns male students to Boys hostel and female students to Girls hostel; other values require hostel assignment. Wardens and Resident Councillors can request hostel coverage when registering. Existing staff profiles need their coverage fields populated by the campus administrator.

**Delete account** permanently deletes the Firebase Authentication account, user profile, linked student profile, and register-number reservation after confirmation. Outpass history remains. **Disable account** blocks Firebase sign-in, revokes refresh tokens, and removes portal access. **Enable account** restores sign-in; pending or rejected accounts still require approval. These controls apply to all roles, including other administrators. Another administrator must manage your own account. Incomplete deletion stays blocked and offers a retry.

Account management uses the admin-only `manageUserAccount` callable function. Install backend dependencies with `npm --prefix functions install`, then deploy with `firebase deploy --only functions,firestore:rules --project YOUR_PROJECT_ID`. Deploying all functions also updates existing callable workflows to reject disabled accounts. Deploying Cloud Functions requires the [Firebase Blaze plan](https://firebase.google.com/docs/functions/get-started). The frontend alone cannot delete or disable another user's Auth account. Live accounts are not modified during local tests.

**Archive duplicate** hides duplicate pending requests while retaining their history.

**Forgot password?** sends a Firebase password-reset email using the email entered on the login screen.

Run `npm test` for request filtering and hostel scope checks. Run `npm run test:rules` with Firebase CLI and Java 21 installed for isolated Firestore emulator checks. The test project is `demo-campuspass`, which does not use the live Firebase database. Deploy updated `firestore.rules` before using the new archive and hostel-routing actions against your connected Firebase project.

CampusPass is a Firebase Spark-plan-compatible digital hostel outpass system. A single `outpasses` record progresses through Student → Advisor → HOD → Principal → Year Warden → Resident Councillor → Security exit/return. Firestore Security Rules enforce the permitted role and state transitions; Cloudinary handles direct file uploads.

## Structure

```
src/                 React responsive dashboards and workflow UI
firestore.rules      Role and workflow rules for direct Firestore operations
```

## Firebase data model

- `users/{uid}`: `role`, `displayName`, `registerNumber`, `department`, `year`, `parentPhone`
- `students/{id}`: directory profile managed by the Year Warden
- `outpasses/{id}`: student/travel details, controlled `status`, optional `passNumber`
- `outpasses/{id}/approvals/{id}`: immutable approval decisions
- `outpasses/{id}/gateLogs/{id}`: independent exit and return events
- `outpasses/{id}/auditLogs/{id}`: immutable lifecycle audit records

## Start locally

1. Enable Email/Password authentication and Firestore in Firebase.
2. Copy `.env.example` to `.env.local` and set the web-app Firebase values. This workspace is already configured locally for the supplied `campass-connect-d4f45` project; `.env.local` is ignored by Git.
3. Run `npm install` and then `npm run dev`.
4. Deploy with Firebase CLI: `firebase deploy --only firestore:rules`.

## Realtime Database security

The provided `".read": true, ".write": true` policy must not be deployed. It permits anonymous users to change requests, approvals, gate entries, and student details. [database.rules.json](database.rules.json) locks writes to trusted backend code and limits reads to signed-in users. The primary approval state machine remains in Firestore and Firebase Functions; Realtime Database is initialized for real-time operational channels without weakening that workflow's authorization.

Create Firestore user profiles after creating Auth users. Role strings must exactly match: `Student`, `Class Advisor`, `HOD`, `Principal`, `Year Warden`, `Resident Councillor`, `Security`.

## User registration

Students can use **Create your CampusPass account** from the sign-in screen. It uses Firebase Authentication plus an atomic Firestore batch to create linked `users`, `students`, and protected `registerNumbers` records—no Cloud Functions deployment or paid Firebase plan is required. It only ever grants the `Student` role. Staff roles must be provisioned by an administrator.

## Admin approvals

New student accounts are created with `approvalStatus: 'PENDING'` and cannot access the portal until approved. Create the first administrator in Firebase Authentication and create the matching `users/{uid}` document in the Firebase Console with at least `displayName`, `email`, `role: 'Admin'`, `active: true`, and `approvalStatus: 'APPROVED'`. The **Admin overview** then provides live user approval, role assignment, and campus outpass analysis. Deploy `firestore.rules` after this change:

```powershell
firebase deploy --only firestore:rules
```

Without Firebase values, the app opens an interactive visual preview. In connected mode, request creation, decisions, gate logs, audit events, and dashboard data are stored in Firebase.

## Cloudinary student photos

Student photos upload directly to Cloudinary using an **unsigned upload preset**, so Firebase Storage, Cloud Functions, and Cloudinary API secrets are not involved. Set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` in `.env`.

In Cloudinary: **Settings → Upload → Upload presets → Add upload preset**, set **Signing Mode** to **Unsigned**, and restrict the preset to image formats and the `campuspass/profilePhotos` folder. The upload preset name is safe to use in the frontend. Never place a Cloudinary API secret in `.env`, `.env.example`, source files, or Git.

## Deploy to Vercel

1. Push this project to GitHub, then import it in Vercel (Vite is detected automatically).
2. In **Settings → Environment Variables**, add the values from `.env.local` for Production, Preview, and Development. Never commit `.env.local`.
3. Deploy. Vercel runs `npm run build`, publishes `dist`, and [vercel.json](vercel.json) rewrites app routes to `index.html`.

Firebase remains the authentication and database backend; Vercel hosts only the React frontend.
