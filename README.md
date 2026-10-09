# CampusPass

## Portal updates

Firebase deployment targets `campass-connect-d4f45` through `.firebaserc`. Run `npm run deploy:rules` when updating Firestore rules, or `npm run deploy:backend` for both rules and callable functions. Local development and the live Vercel app use this same backend. Deploy backend changes before publishing a frontend that depends on them; missing `portalSessions` rules prevent approved users from completing sign-in.

Outpasses now include **Outing**, **Emergency**, and **On duty** categories and a verified **Hosteller** / **Day scholar** student type. Registration and approved-account creation capture the type; administrators can update it from User approvals using `setStudentType`, which keeps linked student profiles in sync. Existing passes retain the type recorded when submitted. Old profiles/passes default to Hosteller and Outing. The CSV importer accepts an optional studentType column with HOSTELLER or DAY_SCHOLAR.

The request form shows category and the numbered permission flow. Emergency requests sort first in staff queues. Category/type filters are available on request tables. All categories and types currently retain the five existing approvals; category-specific or Day-scholar shortcuts await a campus policy decision. Students cannot use the new fields to skip permission levels.

The pass uses a cream ticket layout based on the supplied reference, with student photo, institution, contacts, category/type, travel times, permission level, approval stamps and a security-gate record. It shows actual exit/return times only when recorded; missing historical approvals are identified as unavailable. Approved passes retain their gate QR and QR download action. **Print / save PDF** opens a print view containing only the selected pass. Returned passes are also available under My passes. Deploy the new callable functions and updated rules with the frontend.

The October 2026 document changes add role-specific required registration fields and an official mobile number for staff. HODs cover all years and sections in their department; Principals cover their institution; Deputy Wardens cover a hostel and selected institution groups and years; Resident Councillors cover a hostel. Admin accounts require a position. Student and parent Indian mobile numbers must be valid and different, including when entered with country codes.

The student welcome uses “Your campus. Your journey.” The extra profile strip and active-pass card below that welcome are removed; QR passes are available under **My passes**, with previous requests under **Request history**. Institution and department are read-only when requesting an outpass. Dates display as DD/MM/YYYY in Indian time, and departure-date filters are available for request history and gate lookup. Password fields have show/hide controls. Every displayed registration field is required, including the profile photo.

**Admin overview** shows campus metrics separately from **User approvals**. The app starts on sign-in rather than automatically opening the preview or an old persistent local login. Approved portal sessions use a 90-second Firestore lease, renewed every 25 seconds; a second device is blocked while that lease is live. Browsers supporting Web Locks also block duplicate tabs. Sign-out releases the lease. A closed or disconnected session may take up to 90 seconds to expire. Registration IDs remain unique.

Gate movement requires a gate name and uses the `logGateMovement` callable, which checks the departure and expiry times on the server and writes gate/audit logs. Early and expired exits are blocked; overdue students can still return. Existing passes with ISO date strings remain supported by the callable. Direct client gate writes are denied. Staff CSV uploads show a validated review table before the `importStudentDirectory` callable imports data; include studentPhone and parentPhone in addition to the existing columns. Admin account creation uses the `createApprovedAccount` callable so authentication, profile creation, and ID reservation are handled together.

Deploy the updated functions and Firestore rules together **before serving the updated frontend**. The existing backend deployment requirements below still apply. Populate existing Principals' institution and other staff coverage/contact fields as needed; existing empty coverage fields retain their previous broad coverage. Run `npm test`, `npm run test:rules`, and `npm run build` to verify these changes. Browser notifications report new status changes after the initial snapshot; administrator notifications show pending access requests.

Items awaiting clarification from the supplied document: the meaning and coverage of **S&H**, whether the instruction to remove content below the student welcome includes anything beyond the removed profile/pass block, and the campus's gate choices. The gate is currently a required text field. “Upload review” is implemented as CSV review; supporting permission letters can also be opened from request review.

Dashboard counts open matching request or account views. Administrators can filter users by access status, requested role, and department, and see approved counts for each role. All administrators subscribe to the same Firestore users collection; account changes also update the affected user's open session.

Students have separate in-progress, approved, and rejected views and supply their own mobile number. Staff request filters follow each role's profile fields, with section filters for Class Advisors. Approval trails display the signed-in approver's name and UID. Principal approval assigns male students to Boys hostel and female students to Girls hostel; other values require hostel assignment. Wardens and Resident Councillors choose hostel coverage when registering. Existing staff profiles need their coverage fields populated by the campus administrator.

**Delete account** permanently deletes the Firebase Authentication account, user profile, linked student profile, and register-number reservation after confirmation. Outpass history remains. **Disable account** blocks Firebase sign-in, revokes refresh tokens, and removes portal access. **Enable account** restores sign-in; pending or rejected accounts still require approval. These controls apply to all roles, including other administrators. Another administrator must manage your own account. Incomplete deletion stays blocked and offers a retry.

Account management uses the admin-only `manageUserAccount` callable function. Install backend dependencies with `npm --prefix functions install`, then deploy with `firebase deploy --only functions,firestore:rules --project YOUR_PROJECT_ID`. Deploying all functions also updates existing callable workflows to reject disabled accounts. Deploying Cloud Functions requires the [Firebase Blaze plan](https://firebase.google.com/docs/functions/get-started). The frontend alone cannot delete or disable another user's Auth account. Live accounts are not modified during local tests.

**Archive duplicate** hides duplicate pending requests while retaining their history.

**Forgot password?** sends a Firebase password-reset email using the email entered on the login screen.

Run `npm test` for request filtering and hostel scope checks. Run `npm run test:rules` with Firebase CLI and Java 21 installed for isolated Firestore emulator checks. The test project is `demo-campuspass`, which does not use the live Firebase database. Deploy updated `firestore.rules` before using the new archive and hostel-routing actions against your connected Firebase project.

CampusPass is a Firebase Spark-plan-compatible digital hostel outpass system. A single `outpasses` record progresses through Student → Advisor → HOD → Principal → Deputy Warden → Resident Councillor → Security exit/return. Firestore Security Rules enforce the permitted role and state transitions; Cloudinary handles direct file uploads.

## Structure

```
src/                 React responsive dashboards and workflow UI
firestore.rules      Role and workflow rules for direct Firestore operations
```

## Firebase data model

- `users/{uid}`: `role`, `displayName`, `registerNumber`, `department`, `year`, `parentPhone`
- `students/{id}`: directory profile managed by the Deputy Warden
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

Create Firestore user profiles after creating Auth users. Role strings must exactly match: `Student`, `Class Advisor`, `HOD`, `Principal`, `Deputy Warden`, `Resident Councillor`, `Security`.

## User registration

Users can use **Create your CampusPass account** from the sign-in screen. Registration uses Firebase Authentication plus an atomic Firestore batch to create a pending profile and reserve the ID; student requests also create a linked `students` record. Registration requires administrator approval and never grants staff permissions directly. Admin-created approved accounts use a callable function.

## Admin approvals

New accounts are created with `approvalStatus: 'PENDING'` and cannot access the portal until approved. Create the first administrator in Firebase Authentication and create the matching `users/{uid}` document in the Firebase Console with at least `displayName`, `email`, `role: 'Admin'`, `position`, `phone`, `active: true`, and `approvalStatus: 'APPROVED'`. **User approvals** provides account verification and role assignment; **Admin overview** provides campus activity metrics. Deploy the updated functions and `firestore.rules` together:

```powershell
firebase deploy --only functions,firestore:rules
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

Deputy Warden assignments are stored as `wardenCoverage` keys such as `ENGINEERING:1`, `ARTS_SCIENCE:2`, and `ALLIED_HEALTH:3`. Engineering offers years 1–4; Arts and Science and Allied Health Science offer years 1–3. An administrator should edit existing Year Warden accounts, choose Deputy Warden, and select their coverage before those accounts review more passes. Student profiles can also store an optional, distinct `alternateParentPhone`. Deploy both Firestore rules and Functions with the frontend for these changes.
