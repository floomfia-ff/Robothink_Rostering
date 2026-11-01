# Robothink Rostering

Weekly coach rostering for Robothink: schools, coach availability, drafts and Excel export.

## Branches

- `main`: stable code.
- `front-end-ui`: admin dashboard and weekly roster UI (Vite + React + Tailwind).
- `backend`: the live backend (Supabase function and database changes). Merges into `front-end-ui` by PR.

## Run locally

```bash
npm install
cp .env.example .env.local   # then ask Matin for the roster code and put it in VITE_ROSTER_CODE
npm run dev
```

Tests: `npm test`

## Backend

- `supabase/functions/roster/`: the Edge Function the UI calls. Deploy steps and secrets are in its [README](supabase/functions/roster/README.md).
- `sql/`: the database changes. Already applied to the shared Supabase project; kept here so everyone can see them.

## For the backend and engine devs

Data shapes, rules and endpoints the UI expects: [docs/API_CONTRACT.md](docs/API_CONTRACT.md)
