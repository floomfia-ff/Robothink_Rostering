# roster Edge Function

Weekly rosters plus coach MRT/employment, school and base addresses.

**Every request needs a signed-in admin.** Send the user's Supabase access token
as `Authorization: Bearer <token>`; the function verifies it with Supabase and
requires `app_metadata.role === 'admin'`. The site does this for you — see
`src/lib/api.js`.

This replaced a shared `x-roster-code` header, which was read from
`VITE_ROSTER_CODE` and therefore compiled into the public JavaScript: every
visitor had it. The function uses the service-role key, which bypasses row
level security, so that header was the only thing in the way.

## Secrets (Edge Functions -> Secrets)

- `GOOGLE_SERVICE_ACCOUNT`: reused from the feedback project.
- `GOOGLE_PLAN_SHEET_ID`: the lesson plan spreadsheet id.
- `ONEMAP_EMAIL`, `ONEMAP_PASSWORD`: the OneMap account used for travel times (search and public transport routing).

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

`ROSTER_CODE` is no longer read by anything and can be deleted.

## Deploy

```bash
npx supabase login                      # once
npx supabase functions deploy roster    # project ref comes from supabase/config.toml
```

Files: `index.ts`, `plan.js`, `logic.js`, `recent.js`.

**Verify JWT stays off**, and `supabase/config.toml` pins it that way. It is not
the gate — `refuse()` in `index.ts` is, and it does the stronger check
(`auth.getUser()` verifies the signature rather than decoding it). Turning the
gateway check on would reject the credential-free `OPTIONS` ping that
`.github/workflows/keep-awake.yml` sends, and the browser's CORS preflight.

`plan.js` is a copy of the parser in the feedback project's `read-lesson-plan`;
keep the two in step.

## Check

`$TOKEN` is a signed-in admin's access token — in the browser on the roster,
`(await supabase.auth.getSession()).data.session.access_token`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS "$URL/"                         # 200, needs no credentials (keep-awake)
curl -s "$URL/"                                                                     # 401 {"error":"Sign in to use the roster."}
curl -s -H "authorization: Bearer $TOKEN" "$URL/"                                   # coaches, schools, bases, weeks, planError, unmatchedSchools
curl -s -X PATCH -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"address":"no postcode"}' "$URL/schools/1"                                   # 400 message
curl -s -H "authorization: Bearer $TOKEN" "$URL/weeks/2026-11-03"                   # 400 Monday message
curl -s -X POST -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"limit":5}' "$URL/travel-times/refresh"                                      # { done, remaining, total }
```

A non-admin signed-in account gets `403 {"error":"Admins only."}`.
