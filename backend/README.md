# OGOUE Backend (Node.js + Express + PostgreSQL)

## Setup (DEV)

1. Copy `.env.example` to `.env` and adjust values.
2. Install deps:
   ```bash
   npm install
   ```
3. Run:
   ```bash
   npm run dev
   ```
4. Test:
   - `GET /health`
   - `GET /api/summary/month?orgId=...&month=12&year=2025`

## Notes
- In production, set `NODE_ENV=production` and use a managed Postgres `DATABASE_URL`.
- SSL is enabled automatically in prod via pg config.
