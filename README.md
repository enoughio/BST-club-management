# Club Management Portal

Headquarters, clubs, and members. One Club Admin per club. Membership applications collect the fee with Razorpay on the same page. Meetings, elections, education progress, and Gmail notifications are included.

## Stack

- `apps/web` — Next.js App Router, Tailwind, shadcn-style UI, Recharts, dnd-kit
- `apps/api` — Express, Prisma, Zod, bcrypt, JWT cookies, Razorpay, Nodemailer
- PostgreSQL 16 via `docker-compose.yml`

## Setup

Requirements: Node.js 20+, npm, and Docker (for Postgres).

```powershell
cd c:\Users\anike\Desktop\bbbbst
copy .env.example apps\api\.env
copy .env.example apps\web\.env.local
npm install
docker compose up -d
npm run db:migrate -w @club/api
npm run db:generate -w @club/api
npm run db:seed -w @club/api
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Open application demo: http://localhost:3000/apply/demo-open-application

`npm run db:migrate` applies `apps/api/prisma/migrations`. If the database is not up yet, the migration SQL is already in the repo and will apply when Postgres is reachable.

Prisma reads `apps/api/.env`. The web app reads `apps/web/.env.local`.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `WEB_ORIGIN` | Browser origin allowed on mutations (`http://localhost:3000`) |
| `API_PORT` | API port, default `4000` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | Cookie flags. Localhost ports share a host, so `lax` works in development |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `MAIL_FROM` | Gmail via Nodemailer. Mail is logged and skipped when these are empty |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Live checkout and the `payment.captured` webhook |
| `STORAGE_DRIVER` | `local` or `s3` |
| `STORAGE_LOCAL_DIR` | Local upload directory, default `uploads` |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | S3-compatible storage when `STORAGE_DRIVER=s3` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Optional web push. In-app notifications are always stored |
| `NEXT_PUBLIC_API_URL` | API origin used by the browser |

Club fees are stored in minor units. For INR, `150000` is ₹1,500. Razorpay receives that integer as paise.

Mutations require an `Origin` header equal to `WEB_ORIGIN`. The Razorpay webhook is exempt and is checked with `RAZORPAY_WEBHOOK_SECRET`.

## Demo logins

Every seeded account uses the password `Demo1234!`.

| Email | Role |
| --- | --- |
| `super@clubportal.local` | Super Admin |
| `admin@clubportal.local` | Club Admin and President of Harbour Lights (Mumbai) |
| `president@clubportal.local` | President of Deccan Orators (Pune), not a Club Admin |
| `member@clubportal.local` | Member of Harbour Lights, with an approved Ice Breaker |

The seed also creates 5 clubs, exactly one current Club Admin on each, 20 members, a past executive-committee term, 3 completed meetings, 2 pending removal requests, curriculum guide files, paid and unpaid dues, and one open application (`demo-open-application`).

Other seeded people, such as `meera.joshi@clubportal.local` and `neha.shah@clubportal.local`, use the same password.

## What the product does

- Super Admin creates clubs (fee and election interval required), appoints the single Club Admin, records a member and a manual payment, decides removals, uploads curriculum files, and downloads PDF or Excel reports.
- Club Admin sends a join or reinstatement link. The applicant fills the form and pays on that same page. A verified payment activates the membership immediately. The webhook repeats activation without creating a second membership.
- Meetings move through draft, finalized, completed, and cancelled. Finalizing and cancelling email active members. Speech-evaluator feedback opens only after the Club Admin marks the meeting completed.
- Each club elects its executive committee on its own interval. A daily job opens nominations for 7 days and voting for 7 days. Ties go to the member who joined earlier. The Club Admin seat is not on the ballot.
- A project is complete when the member was the prepared speaker in a completed meeting and the assigned speech evaluator approved it.

Events exist in the database only. There is no events API, no WhatsApp, and no audit-log page. `GET /api/v1/audit-logs` is available to Super Admin.

## Deployment

1. Provision Postgres and set `DATABASE_URL`.
2. Set long random JWT secrets, `WEB_ORIGIN`, and `COOKIE_SECURE=true` behind HTTPS.
3. If the site and API are different sites (not just different subdomains of one registrable domain), set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`. Prefer one site, for example `example.com` proxying `/api` to the API, so cookies stay first-party.
4. Put Gmail, Razorpay, and storage credentials in the API environment. Point the Razorpay webhook at `POST /api/v1/webhooks/razorpay`.
5. Run `npm run build`, `npm run db:migrate -w @club/api`, and `npm run db:seed -w @club/api` only for a demo database.
6. Start the API with `npm run start -w @club/api` and the web app with `npm run start -w @club/web`.

The API runs an election maintenance job every day at 00:05 and once on startup.

## Scripts

```powershell
npm run dev
npm run build
npm run typecheck
npm run db:migrate -w @club/api
npm run db:seed -w @club/api
```

Route details are in [docs/API.md](docs/API.md).
