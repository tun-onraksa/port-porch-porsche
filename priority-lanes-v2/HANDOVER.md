# HANDOVER — Priority Lanes (build 2)

_Last updated: 2026-10-17. Not a git repo: this file is the record._

## What this is

An independent second build of the Priority Lanes brief (`BRIEF.md`). The sibling folder
`../hackathon2026/` holds a separate build of the same brief from another session. Nothing is shared between
the two, and that folder wasn't read or touched while building this one.

**In the team repo** ([tun-onraksa/port-porch-porsche](https://github.com/tun-onraksa/port-porch-porsche)):
- This build is **version 2**: folder `priority-lanes-v2/` on branch `priority-lanes-v2`, cut from
  `priority-lanes`.
- Version 1 is `priority-lanes-demo.html` at the repo root, on branch `priority-lanes`.
- `main` is Tun's PortTable (3D digital twin), untouched.
- This local folder is the working copy. After changes, run `npm run build`, rsync into the repo folder
  (excluding `node_modules` and `dist`), then commit.

## Status

All 7 screens from the brief plus a "How it's built" screen, a guided 3-minute demo, mode and view
toggles, and approve / modify / reject with a decision log. Everything is computed by the rules engine; no
recommendation is hard-coded.

**Verified on 2026-10-17:**
- `npm run build` passes (tsc strict + vite). Output is one ~690 KB HTML file (`priority-lanes.html`).
- Screens checked in headless Chrome at 1440px. Gate Command and Box Detail also checked at 375px, through a
  375px iframe, because headless Chrome won't render a window narrower than ~500px.
- Clicked through in real Chrome via the local preview, with no console errors:
  - Approve plan updates Blunt vs Gentle ($6,743 → $3,446).
  - Modify requires a reason and logs it.
  - Ordinary / Disruption / Drill and Operations / Security all work.
  - Recording an outcome on the Learning Log moves COSCO reliability from 86.5% to 84.2%.
  - All 8 guide steps land on the right screen.
- Not tested: Safari or Firefox, touch devices, screen readers (beyond semantic markup and aria labels).

## Files

```
src/data/terminal49-snapshot.json   REAL snapshot, unchanged
src/data/scenario.ts                4 real boxes (post-arrival simulated), hero box, 13 named boxes,
                                    94 generated (seeded, deterministic), pre-arrival records, history
src/engine/
  types.ts        Terminal49-shaped Box + engine output types
  context.ts      clock (Thu Oct 29 07:30 PDT), lanes, outages, weather, drills, capacity
  trust.ts        source trust per attribute, confidence = authority × freshness × track record
  urgency.ts      0–100 score, six factors exactly per brief §7.2
  actions.ts      8-step action ladder, reasons, costs, tasks
  evaluate.ts     ties it together per box; security findings
  simulate.ts     gate queue sim (5-min ticks): blunt vs plan, costs, outcomes, lane/slot assignment
  forecast.ts     36h demand vs capacity with queue carry-over, jam windows, recommendations
  paperwork.ts    pre-arrival checks (paperwork only, never physical readings)
  rates.ts        sample rates
src/state.tsx     app state: mode, view, approvals per mode, log, reliability, guide
src/screens/      PreArrival, GateCommand, BoxDetail, GateForecast, Drill, Security, Learning, HowBuilt
src/ui/           primitives (chips, badges, tags), layout (header, stage strip, modal), Guide
scripts/scenario-report.ts   `npm run report`: prints every headline number
```

## Engine numbers (disruption mode, `npm run report`)

| | Blunt (hold everything until 14:00) | Plan, all approved | Brief target |
|---|---|---|---|
| Trucks stranded > 3h | 47 | 0 | ~40 |
| Projected charges + truck waiting | $24,840 | $3,446 (−86%) | ~$18k, ~70% lower |
| Insulin deadline | missed (driver leaves after 4h) | out 07:30, Lane 1 | missed / met |
| Shrimp reefer | at risk | fine | at risk / fine |
| Medical/reefer/relief/rail out by 11:00 | 0 of 11 | 11 of 11 | all |
| Inspected for a conflict | 0 | 1 (hero) + 13 exams expedited | 1 |
| Moved to later slots | 0 | 19 | ~25 |

Pre-arrival: 12 paperwork conflicts, 9 resolved before arrival (matches the brief).
Hero box: crane 27,400 kg at 94%, contents loaded, release blocked at 100%, deadline Oct 30 (facility)
against Terminal49's unified Oct 31 (line), severity Critical, Step 6 Inspect. All as the brief expects.

## Decisions and deviations from the brief (and why)

1. **Urgency scores are lower than the brief's examples.** The brief's own table can't produce them:
   - Insulin can't reach ~85 with condition 0 and cost 0. It scores 63 (High) and is still #1.
   - The hero scores 45 (Normal), not ~68: its category isn't declared (5 points), and condition risk is
     capped at 20.

   I kept the table exactly as written, since the brief says to implement it. The UI makes the point that
   urgency and risk are separate. To hit the targets instead, change the weights in `urgency.ts`.
2. **Freshness doesn't apply to weight and contents.** A sealed box's measured weight doesn't go stale.
   Without this the hero's crane weight would be 71%, not the brief's 94%. Freshness still applies to
   release, temperature, deadline and location.
3. **Hazmat weight mismatch is critical only above 10%.** Otherwise sim-0007 at +6% would be Inspect, but the
   brief expects Flag + hazmat lane.
4. **A reefer 2–8°C warm is Release + Watch, not Flag.** This matches the brief's shrimp expectation.
   Getting it out is the fix.
5. **Slow applies only when the gate is saturated** when the truck would come, or to a box with no booking
   on a jam day. Otherwise OOCU8185051 (urgency 18) would be slowed, but the brief expects Release. Medical
   and relief are never slowed.
6. **A last-free-day date ends at 17:00 local**, when the day-shift gate closes. This makes insulin's
   "deadline today 17:00" consistent.
7. **Other gate traffic** (exports, empty returns): 33–38 transactions/hr (sample) share the lanes. Without
   it, 4 lanes at 15/hr would clear 34 trucks easily and there'd be no jam.
8. **Blunt move = hold every import release until lanes return at 14:00, then first-come-first-served.**
   Before approval, the plan column shows first-come-first-served with problems found at the gate.
   Approving rows moves the numbers.
9. **Sample assumptions** (labelled in the UI):
   - Drivers leave after 4h.
   - Waiting counts beyond a 1h normal turn, plus $90 per wasted trip and $60 per rebooked appointment.
   - Exam fees are left out of the comparison: CBP charges them in every scenario.
10. **Drills run on an ordinary-day baseline.** The wind drill pulls relief supplies forward from Fri 14:00
    to Thu 09:00. In Disruption mode the wind is only an advisory, so time-critical boxes are pulled forward
    pre-emptively.
11. **Terminal49 `urgency` values** after arrival (`overdue/high/medium/low`) are simulated and marked "sim".
    The hero keeps `unknown`, as given.
12. **Security view adds two watchlist cases**, which are Major, not Critical: paper napkins weighing 28 t,
    and a seal mismatch. So only the hero is sent to inspection for a conflict.
13. **Desktop-first per the brief (1440px)**, responsive down to 375px. Wide tables scroll inside their
    panel.

## Ideas not done

- Light theme (the control-room dark theme is the only one).
- Hosting: `netlify.toml` is ready (`npm run build`, publish `dist`), but nothing is deployed.
- Real Terminal49 API fetch. The demo uses the saved snapshot; a free key covers 100 containers.
