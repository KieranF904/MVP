# Driver HUB Prototype

Prototype workspace for a compliance-focused transport workflow app.

## Stack
- Frontend: Next.js (TypeScript, App Router)
- Backend: NestJS (TypeScript)
- Storage: In-memory prototype data (to be replaced with Postgres + object storage)

## Included MVP flows
- Role-based login for `admin`, `dispatcher`, `driver`
- Admin/dispatcher task assignment to drivers
- Driver training hub with confirmation tracking
- Driver document and photo upload metadata
- Admin document review (approve/reject)
- Digital driver form creation and dispatcher signature flow
- Admin review list for submitted forms

## Demo accounts
- `admin` / `admin123`
- `dispatcher` / `dispatcher123`
- `driver1` / `driver123`

## Run locally
1. API
   - `npm run dev:api`
2. Web
   - `npm run dev:web`
3. Open `http://localhost:3000`

## Environment
- Web uses `NEXT_PUBLIC_API_URL` (default: `http://localhost:4001`)
- API uses `PORT` (default: `4001`) and `CORS_ORIGIN` (default: `http://localhost:3000`)

## Fly.io deployment outline
- Deploy web and API as separate Fly apps
- Add Fly Postgres for persistent data in the next iteration
- Add object storage (S3-compatible) for real document/file uploads
- Add worker process for reminders, expiry alerts, and async processing

## Next refinement targets
- Replace in-memory store with Prisma + Postgres
- Add secure password hashing + JWT
- Add file upload to object storage with signed URLs
- Add reminders and compliance dashboards
