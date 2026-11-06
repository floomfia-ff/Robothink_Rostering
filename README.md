<div align="center">

<img src="public/robothink-logo.png" alt="RoboThink" height="80" />

# RoboThink Roster Admin

**Plan each week's coaches for every RoboThink preschool and weekend programme, in one place.**

React 19 · Vite · Tailwind 4 · Supabase · OneMap

</div>

---

## What it is

RoboThink sends coaches (interns and part-timers) to preschools on weekdays and to its WCP and DV centres at
weekends. This site is where the admin builds that weekly roster:

- **Class sizes come in automatically** from the lesson plan Google Sheet, so each school shows its time slots,
  number of kids and the build they are on that week.
- **Coaches come from the shared Supabase database** (the same one the RoboThink feedback site uses), with their
  nearest MRT, intern or part-timer, and whether they can lead.
- **Auto-Generate drafts the week** using real public-transport travel times (OneMap) and the rules you set.
- **You adjust by hand**, then share it as a picture or an Excel file. Every change saves itself.

## The four sections

| Tab | What you do there |
|---|---|
| 📅 **Weekly Roster** | Pick a week, Auto-Generate a draft, drag coaches between schools, set days off, check warnings, export. |
| 👥 **Coach Profiles** | Each coach's nearest MRT, Intern / Part-timer, and the **Lead Coach** toggle. *Work out travel times* fetches trip times from OneMap. |
| 📍 **Venues** | Address of each preschool and the WCP / DV bases (the postcode is used for travel times). |
| 🎚️ **Rules** | What Auto-Generate always follows: students per coach, max coaches per school, and coaches fixed to a school. |

**Admin** links to the RoboThink feedback site, where coaches and schools are added or renamed.

## How to use it each week

1. **Open the week.** Use the ← → arrows or the week picker. **New Week** lets you pick any date and adds that
   week (Monday to Sunday).
2. **Check days off.** In the availability table under the roster, click a coach's day to cycle
   available → OFF → X. An intern's change carries into every later week.
3. **Click ✨ Auto-Generate Draft.** It fills the weekday schools and weekend programmes. New placements get a
   green ring so you can see what changed.
4. **Fix anything by hand.** Drag a coach chip to another school, click a chip to swap, or use **+** to add someone
   (the list is sorted by travel time). **Find coaches** highlights one coach's whole week.
5. **Check the warnings pill.** It lists things like an intern without the right days off, a Lead who isn't a
   Lead Coach, a fixed coach who couldn't be placed, or a school over the max. Warnings never block you.
6. **Share it.** **Export → Copy Picture** puts an image on the clipboard (paste it straight into WhatsApp);
   **Export → Export to Excel** downloads the sheet.

Made a mistake? **Clear coaches** empties the week (days off stay). **Delete Week** hides a week and
**Restore a deleted week…** brings it back.

## How Auto-Generate decides

On each weekday it fills every preschool in this order:

1. **Fixed coaches** go to their school (e.g. Kathleen → MBR East Coast).
2. Each school gets a **target**: kids ÷ *students per coach* (3), rounded up, never more than the **max** (4).
   8 kids → 3 coaches, 15 kids → 4.
3. Every school gets a **Lead Coach** first, then schools fill up to their target. The school with the most kids
   per coach always picks next and takes its **nearest free coach**.
4. **Anyone not needed stays at WCP.** Coaches you placed by hand are never moved.

Interns get one weekday off (Tuesday or Wednesday) and one weekend day off; weekend coaches are split evenly between
Saturday and Sunday. All the numbers are set on the **Rules** tab.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then ask Matin for the roster code and put it in VITE_ROSTER_CODE
npm run dev                  # opens on http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the site locally |
| `npm test` | Run the roster, lesson plan and backend checks |
| `npm run build` | Build the site for deploying |

> **Heads up:** your local site talks to the **live** database, so anything you change (rules, weeks, coach
> details) is real. Try Auto-Generate on a throwaway future week and delete it afterwards.

## How it fits together

```
Browser (this site)  ──▶  Supabase Edge Function "roster"  ──▶  Supabase Postgres   (coaches, schools, weeks, rules, travel times)
                                       │
                                       ├──▶  Google Sheets   (lesson plan: kids and builds per slot)
                                       └──▶  OneMap          (public-transport travel times)
```

| Folder | What's in it |
|---|---|
| `src/components/` | The screens: roster grid, header, coach profiles, venues, rules, top bar |
| `src/lib/roster.js` | The roster rules and Auto-Generate (plain functions, tested with `npm test`) |
| `src/lib/api.js` | Every call the page makes to the backend |
| `supabase/functions/roster/` | The Edge Function. Deploy steps and secrets are in its [README](supabase/functions/roster/README.md) |
| `sql/` | Database changes, numbered in order. Already applied to the shared Supabase project |
| `docs/API_CONTRACT.md` | Data shapes, rules and endpoints the page expects ([open](docs/API_CONTRACT.md)) |
| `docs/superpowers/` | Design specs and implementation plans for each feature |

## Branches

- `main`: stable code, what the live site runs.
- `backend`: backend and feature work; fast-forwarded into `main` when ready.
- `front-end-ui`: the original admin dashboard and roster UI.
