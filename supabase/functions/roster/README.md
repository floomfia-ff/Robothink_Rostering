# roster Edge Function

Weekly rosters plus coach MRT/employment, school and base addresses. Every request needs the header `x-roster-code`.

## Secrets (Edge Functions -> Secrets)

- `ROSTER_CODE`: the shared code the roster page sends.
- `GOOGLE_SERVICE_ACCOUNT`: reused from the feedback project.
- `GOOGLE_PLAN_SHEET_ID`: the lesson plan spreadsheet id.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## Deploy

Files: `index.ts`, `plan.js`, `logic.js`. Deploy with **Verify JWT off** (the roster code is the gate).

`plan.js` is a copy of the parser in the feedback project's `read-lesson-plan`; keep the two in step.

## Check

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$URL/"                                   # 401
curl -s -H "x-roster-code: $CODE" "$URL/"                                          # coaches, schools, bases, weeks, planError, unmatchedSchools
curl -s -X PATCH -H "x-roster-code: $CODE" -H "content-type: application/json" \
  -d '{"address":"no postcode"}' "$URL/schools/1"                                  # 400 message
curl -s -H "x-roster-code: $CODE" "$URL/weeks/2026-11-03"                          # 400 Monday message
```
