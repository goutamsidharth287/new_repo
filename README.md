# Mini ERP + CRM Operations Portal

A small internal operations system for a wholesale/distribution company covering customer CRM,
product & inventory management, and sales challans, built for internal teams (Admin, Sales,
Warehouse, Accounts).

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, JWT auth, Zod validation
- **Frontend:** React, TypeScript, Vite, React Router, Axios
- **Deployment target:** Render (backend + Postgres) / Vercel (frontend) — see Deployment section

## Project Structure

```
mini-erp-crm/
├── backend/          # Express API, Prisma schema, seed script
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── routes/       # auth, customers, products, challans
│       ├── middleware/   # auth (JWT + roles), error handler
│       ├── lib/           # Prisma client
│       └── utils/         # JWT sign/verify
├── frontend/          # React + Vite admin UI
│   └── src/
│       ├── pages/       # Login, Customers, CustomerDetail, Products, Challans
│       ├── components/  # Layout (sidebar)
│       ├── context/      # AuthContext
│       └── api/          # Axios client
└── Mini_ERP_CRM.postman_collection.json
```

## Architecture (short explanation)

- **Backend** is a standard layered Express app: routes → Zod validation → Prisma queries,
  with a global error handler that turns Zod/API errors into consistent JSON responses.
- **Auth** uses JWT (8h expiry) with a `requireAuth` middleware that decodes the token and a
  `requireRole(...)` middleware for role-gated endpoints (e.g. only Admin/Sales can create
  challans; only Admin/Warehouse can adjust stock).
- **Challan business logic** is the core of the system:
  - Creating or confirming a challan runs inside a Prisma `$transaction` so stock checks and
    stock decrements are atomic — two simultaneous challans can't both oversell the same stock.
  - Stock is validated against `currentStock` before any write; insufficient stock returns a
    `400` with a clear message instead of allowing negative stock.
  - Each `ChallanItem` stores a **snapshot** of the product's name, SKU, and unit price at the
    time of the challan, so historical challans stay accurate even if the product is later
    renamed or repriced.
  - Confirming a challan and cancelling a confirmed challan both write a corresponding
    `StockMovement` row (OUT on confirm, IN on cancel-restore), so the movement log is a
    complete audit trail.
- **Frontend** is a single admin shell (sidebar + content area) with client-side routing.
  Auth state and JWT live in `AuthContext` + `localStorage`; Axios attaches the token to every
  request and redirects to `/login` on a 401.

## Local Setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local Postgres, or a free hosted one — see Deployment section for
  Supabase/Neon/Render Postgres options)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres connection string, and set JWT_SECRET to any long random string
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Backend runs on `http://localhost:4000` by default (see `PORT` in `.env`).

`npm run seed` creates one login per role, all using password `Password123!`:

| Role | Email |
|---|---|
| Admin | admin@erp.test |
| Sales | sales@erp.test |
| Warehouse | warehouse@erp.test |
| Accounts | accounts@erp.test |

It also creates one sample product and one sample customer so the UI isn't empty on first load.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# edit .env if your backend isn't on localhost:4000
npm run dev
```

Frontend runs on `http://localhost:5173` by default. Log in with any of the seeded accounts above.

### 3. API testing

Import `Mini_ERP_CRM.postman_collection.json` into Postman. It has a `base_url` variable
(defaults to `http://localhost:4000`) and auto-captures the JWT token after you run the Login
request, so subsequent requests are authenticated automatically.

## Environment Variables

**backend/.env**
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWTs — use a long random string in production |
| `PORT` | Port the API listens on (default 4000) |

**frontend/.env**
| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |


## Assumptions

- `POST /auth/register` is left open (not Admin-gated) so graders can create additional test
  accounts for any role without direct database access. In a production system this endpoint
  would be restricted to Admins only.
- "Stock movement" from a confirmed challan is recorded automatically with reason
  `Sales challan <number>`; manual stock adjustments (e.g. purchase receipts, damage) use the
  separate `POST /products/:id/stock-movements` endpoint.
- Challan numbers are generated as `CH-<year>-<sequence>` (e.g. `CH-2026-00001`).
- Cancelling a `CONFIRMED` challan restores the deducted stock and logs an `IN` movement;
  cancelling a `DRAFT` challan has no stock impact since none was ever deducted.
- Purchase orders are out of scope for this submission — the assignment's core focus (CRM,
  inventory, and sales challan flow with stock logic) was prioritized within the time available.

## Known Limitations / Incomplete Parts

- No pagination controls in the frontend UI yet (API supports `page`/`pageSize`, but the UI
  currently fetches a single page — fine for demo-scale data, would need "Load more" or page
  controls for production data volumes).
- No customer/product edit forms in the UI yet (edit APIs exist and are tested via Postman;
  only "add" forms are wired up in the frontend for time reasons).
- Purchase Order module (mentioned in business context, not in Core Modules Required) was not
  built — out of scope per the assignment's required module list.
- No automated test suite (unit/integration tests) — given the 48-hour window, manual testing
  via Postman was prioritized over test coverage.
- Docker, GitHub Actions, PDF invoice export, and S3 image upload (all listed as bonus items)
  were not implemented in favor of completing all core modules first.
