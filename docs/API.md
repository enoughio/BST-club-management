# API

Base path: `/api/v1`.

Authenticated requests send the `access_token` httpOnly cookie. `POST /auth/refresh` rotates the `refresh_token` cookie. Mutations other than the Razorpay webhook must send `Origin: <WEB_ORIGIN>`.

Errors are `{ "error": "message", "details": ... }` with a 4xx or 500 status.

Amounts are minor currency units (paise when the currency is INR).

## Health

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | Public | `{ ok: true }` |

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` | Sets cookies. Returns `{ user }` |
| POST | `/auth/logout` | — | Clears cookies and revokes the refresh token |
| POST | `/auth/refresh` | — | Rotates both cookies. Returns `{ user }` |
| GET | `/auth/me` | User | Current session |
| POST | `/auth/forgot-password` | `{ email }` | Always `{ ok: true }`. Sends a reset email when the account exists |
| POST | `/auth/reset-password` | `{ token, password }` | Consumes a reset token |
| POST | `/auth/accept-invite` | `{ token, password }` | Sets the password, activates the user, and signs them in |

`user` includes profile fields, `memberships`, `adminClubs`, and `offices`.

## Files

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/files/*` | Avatar keys are public. Other keys require a user | Streams a stored object |

## Applications and Razorpay

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/clubs/:clubId/applications` | Club Admin | `{ email, kind: NEW \| REINSTATE }`. Emails one link. Does not create a user |
| GET | `/applications/:token` | Public | Form payload, club fee, and whether Razorpay is configured |
| POST | `/applications/:token/order` | Public | Saves the form and creates a Razorpay order. Returns `{ orderId, amount, currency, keyId }` |
| POST | `/applications/:token/verify` | Public | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`. Verifies the signature and activates the membership |
| POST | `/webhooks/razorpay` | Razorpay signature | `payment.captured` runs the same activation and does not create a second membership |

Form fields: `name`, `email`, `phone`, `dateOfBirth` (`YYYY-MM-DD`), `gender`, `address`, `city`, `occupation`, `goals`. The email must match the invitation.

A new account receives a set-password email. Reinstatement updates the known profile and sets that club membership back to `ACTIVE`.

## Users and profile

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/users?q=&page=` | Super Admin | Paginated people |
| POST | `/users` | Super Admin | Creates or updates a profile, activates one club membership, and records a manual payment. Body includes profile fields plus `clubId`, `paymentAmount`, `paymentDate`, `paymentReference` |
| PATCH | `/users/:id` | Super Admin | Profile fields and optional `status` |
| DELETE | `/users/:id` | Super Admin | Writes an audit snapshot, then deletes the account |
| GET | `/me/profile` | User | Session profile |
| PATCH | `/me/profile` | User | Updates the signed-in profile |
| POST | `/me/avatar` | User | Multipart field `file` |
| GET | `/me/history` | User | Membership history |
| GET | `/me/dues` | User | Own invoices |
| GET | `/me/meetings` | User | `{ upcoming, attended }` for the member, not the club archive |
| GET | `/me/progress` | User | Levels, projects, progress, certificates |
| POST | `/me/projects/:projectId/select` | User | Marks a project as selected |

## Clubs

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/clubs?q=` | User | Super Admin sees every club and its current Club Admin. Others see their clubs |
| POST | `/clubs` | Super Admin | `name`, `city`, `charterDate`, `membershipFeeAmount`, `electionIntervalMonths` required. Optional `currency`, `status`, `address`, `meetingSchedule`, `description` |
| GET | `/clubs/:id` | User | Club, current admin, and members for Super Admin or club staff |
| PATCH | `/clubs/:id` | Super Admin or Club Admin | Profile fields. Status is Super Admin only |
| PATCH | `/clubs/:id/billing` | Super Admin | Fee, currency, and election interval. Interval changes reschedule `nextElectionAt` |
| DELETE | `/clubs/:id` | Super Admin | Deletes the club |
| POST | `/clubs/:id/admin` | Super Admin | `{ userId }` of an active member. Ends the previous appointment |
| GET | `/clubs/:id/officers?scope=current\|past` | Super Admin or that Club Admin | Current holders, or past terms grouped by election or dates |
| PUT | `/clubs/:id/officers` | Super Admin or Club Admin | `{ officers: [{ title, userId }] }`. `userId: null` vacates a title. Rejected while an election is open |
| GET | `/clubs/:id/members` | Club staff | Member cards for the club |
| GET | `/clubs/:id/members/export` | Club Admin | CSV download |
| POST | `/clubs/:id/members/import` | Club Admin | Multipart CSV with `email` and `name` columns |
| POST | `/clubs/:id/members/:userId/reinstate` | Club Admin | Starts a reinstatement application and emails the link |
| GET | `/clubs/:id/dues` | Club Admin | Invoices for the club |

Officer titles: `PRESIDENT`, `VP_EDUCATION`, `VP_MEMBERSHIP`, `VP_PUBLIC_RELATIONS`, `SECRETARY`, `TREASURER`, `SERGEANT_AT_ARMS`.

## Meetings

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/clubs/:id/meetings?scope=upcoming\|past\|all` | Super Admin, Club Admin, or President. Other officers receive upcoming finalized meetings only | Past includes completed, cancelled, and finalized meetings whose date has passed |
| POST | `/clubs/:id/meetings` | Club Admin or President | Creates a draft. A second non-cancelled meeting on the same date is rejected |
| GET | `/meetings/:id` | Super Admin, club staff, or a member of the club | Agenda, RSVPs, attendance |
| PATCH | `/meetings/:id` | Club Admin or President | Draft only. Optional `agenda` array replaces the slots |
| DELETE | `/meetings/:id` | Club Admin or President | Discards a draft. No email |
| POST | `/meetings/:id/finalize` | Club Admin or President | Locks the agenda and emails active members |
| POST | `/meetings/:id/cancel` | Club Admin | Finalized meetings only. Emails members |
| POST | `/meetings/:id/complete` | Club Admin | After the scheduled end. Optional `{ summary }` |
| PATCH | `/meetings/:id/summary` | Club Admin | `{ summary }` |
| POST | `/meetings/:id/rsvp` | Active member | `{ status: YES \| NO \| MAYBE }` after finalize |
| PUT | `/meetings/:id/attendance` | Club staff | `{ records: [{ userId, present }] }` |
| POST | `/meetings/:id/feedback` | Assigned speech evaluator | After completion. `{ agendaItemId, comments, score, approved }`. Approval issues the certificate. The chief evaluator cannot approve projects |

Agenda roles: `PREPARED_SPEAKER`, `SPEECH_EVALUATOR`, `CHIEF_EVALUATOR`, `TIMEKEEPER`, `FILLER_COUNTER`, `LISTENER`, `LANGUAGE_EVALUATOR`, `OPEN_MIC_COORDINATOR`, `MOC`.

Each member has one assignment. Singleton roles appear once. Each prepared speaker has one speech evaluator, linked with `targetUserId`. Prepared speakers may include `projectId`.

## Elections and removals

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/clubs/:id/elections` | Active member | Elections plus `nextElectionAt` |
| POST | `/clubs/:id/elections/:electionId/nominations` | Active member | `{ title }` during the nomination window |
| POST | `/clubs/:id/elections/:electionId/votes` | Active member | `{ title, candidateId }` during voting. One vote per title, replaceable |
| GET | `/clubs/:id/elections/:electionId/results` | Active member | Tallies and officers produced by that election |
| POST | `/clubs/:id/removals` | Club Admin | `{ userId, reason: RESIGNATION \| DUES_UNPAID \| OTHER, details }`. Emails every Super Admin |
| GET | `/clubs/:id/removals` | Club Admin | That club’s requests |
| GET | `/removals?status=PENDING\|ALL` | Super Admin | Inbox |
| POST | `/removals/:id/approve` | Super Admin | Sets that membership to `REMOVED` and emails the requesting Club Admin |
| POST | `/removals/:id/reject` | Super Admin | Rejects and emails the requesting Club Admin |

A daily job opens an election when `nextElectionAt` is due, moves it to voting after 7 days, and completes it after another 7 days. The highest vote wins. A tie goes to the earlier join date. The Club Admin seat is never a ballot title.

## Curriculum

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/curriculum` | User | Levels, projects, and material metadata |
| POST | `/curriculum/levels` | Super Admin | `{ number, name }` |
| PATCH | `/curriculum/levels/:id` | Super Admin | `{ number?, name? }` |
| DELETE | `/curriculum/levels/:id` | Super Admin | Deletes the level and its projects |
| POST | `/curriculum/projects` | Super Admin | `{ levelId, number, title, description? }` |
| PATCH | `/curriculum/projects/:id` | Super Admin | Number, title, description |
| DELETE | `/curriculum/projects/:id` | Super Admin | Deletes the project and its files |
| POST | `/curriculum/projects/:id/materials` | Super Admin | Multipart `file`, plus `title` and `kind: GUIDE \| HANDBOOK \| OTHER` |
| DELETE | `/curriculum/materials/:id` | Super Admin | Deletes the file |
| GET | `/curriculum/materials/:id/download` | User | Downloads the file |

## Announcements, messages, notifications

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/announcements` | User | Global notes plus notes for the user’s clubs |
| POST | `/announcements` | Super Admin | `{ title, body }`. Emails active users |
| GET | `/clubs/:id/announcements` | User | Notes for one club |
| POST | `/clubs/:id/announcements` | Club Admin | Emails active members of that club |
| GET | `/conversations` | User | Threads the user is in |
| POST | `/conversations` | Super Admin | `{ clubId, subject, body }` to that club’s Club Admin |
| GET | `/conversations/:id` | Participant | Thread |
| POST | `/conversations/:id/messages` | Participant | `{ body }` |
| GET | `/notifications` | User | Latest in-app notifications |
| POST | `/notifications/:id/read` | User | Marks one read |
| POST | `/notifications/read-all` | User | Marks all read |
| POST | `/push/subscribe` | User | `{ endpoint, keys: { p256dh, auth } }`. Push is sent only when VAPID keys exist |

## Reports, settings, audit, directory

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/reports/overview` | Super Admin | Club, membership, meeting, and dues totals |
| GET | `/reports/growth` | Super Admin | Joins per month for 12 months |
| GET | `/reports/clubs/:id/health` | Super Admin | Members, attendance rate, dues |
| GET | `/reports/overview.pdf` | Super Admin | PDF download |
| GET | `/reports/overview.xlsx` | Super Admin | Excel download |
| GET | `/reports/clubs/:id/health.pdf` | Super Admin | PDF download |
| GET | `/reports/clubs/:id/health.xlsx` | Super Admin | Excel download |
| GET | `/settings` | Public | Organization name, color, default fee |
| PATCH | `/settings` | Super Admin | `{ name?, primaryColor?, defaultFeeAmount?, defaultCurrency?, supportEmail? }` |
| GET | `/audit-logs?page=&pageSize=&action=&entityType=` | Super Admin | Audit rows. There is no audit page in the web app |
| GET | `/directory/clubs?q=` | Public | Active and provisional clubs |
| GET | `/directory/clubs/:slug` | Public | Public club profile, including the fee |
| GET | `/directory/members/:id` | Optional | Name, city, and clubs. Email and phone are included for Super Admin and people who share an active club |

There is no events API. `Event` and `EventRegistration` are schema only.
