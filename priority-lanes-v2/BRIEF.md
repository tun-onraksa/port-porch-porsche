# Project Brief: "Priority Lanes" — A Pre-emptive Decision Tool for Container Terminal Planners

> Saved from the brief pasted on 2026-10-17; text is verbatim. The two JSON blocks (real snapshot, hero box) live in code
> instead: `src/data/terminal49-snapshot.json` (unchanged) and `sim-hero-0001` in `src/data/scenario.ts`.
> See `HANDOVER.md` for where the build deviates and why.

> **How to use this brief:** You are being asked to design and build an interactive demo / mockup of a software product for a hackathon submission. This document contains the context, the problem, the user, the real data we have, the decision logic, scenario data and the screens to build. Treat the demo as the actual submission: it should look and feel like a working product, with realistic data, visible reasoning and a guided story a judge can follow in about 3 minutes.
>
> **Real vs. simulated:** Section 3 contains a **real Terminal49 data snapshot** (4 live containers). Use those exact records and field names. Everything marked "simulated" should be invented realistically in the **same field format**, and the UI must clearly label simulated data (e.g. a "Simulated" tag or banner).

---

## 1. The hackathon brief (verbatim)

**Overall theme:**
> Help someone prepare for disaster: how can you be pre-emptive rather than reactionary? Pick any person who has to decide, and find the gentlest response that still works: cheap enough to use widely, safe around people, and useful on an ordinary day too. This is decision making with a dual-use twist.

**Our track — 04. Ports, with Terminal49: At the Gate**
> *The seat: the terminal planner.* One box, four stories. The carrier says it's empty, the terminal scale says it's heavy, customs has a hold on it, and the refrigeration plug says it's warming. A hundred more boxes need the same gate, half the lanes are down, and the clock on charges is running. The blunt move is to hold everything or close the terminal. What can you slow, reroute, inspect or release? Which source do you trust? Which box can't wait?

**Sponsor/partner:** Terminal49, a company that provides a container-tracking API.

---

## 2. Background: how a container port works (the demo must respect this)

### 2.1 Ports, terminals and who runs them
- A US port (e.g. Port of Los Angeles) contains **several container terminals**.
- Most US ports use a **"landlord" model**: a public port authority owns the land and infrastructure; **private companies lease and operate each terminal** with their own staff, equipment, software and rules. (Some ports, like Savannah, are run directly by a state authority.)
- Each terminal runs its own **Terminal Operating System (TOS)**, e.g. Navis N4, which tracks yard positions, crane moves, vessel plans, gate events and box status **inside that terminal only**.

### 2.2 Who controls what
| Actor | Controls |
|---|---|
| Shipping line / carrier (e.g. COSCO) | The booking, the container, declared contents/weight, "line release" (freight paid) |
| Terminal operator (private company) | Yard, cranes, gate lanes, appointments, storage, physical sensors (crane/gate scales, reefer plugs, gate cameras) |
| Customs & Border Protection (CBP) | Customs holds and releases on individual containers |
| Other agencies (USDA, FDA) | Agricultural/food holds and inspections |
| Coast Guard | Ships and waterways (not the gate) |
| Importer (cargo owner) & trucker | Picking the box up; they usually pay the charges |

### 2.3 How Terminal49 fits
- Terminal49 is a **container-tracking API used mainly by importers, freight forwarders and truckers**. It connects to ocean carriers, 138 directly integrated terminals, all six major North American railroads and AIS ship tracking, and normalizes their data into one format.
- It **does not run terminals**. It reads from them.
- In our product, Terminal49 provides the **outside view** (carrier data, holds, fees, deadlines, vessel ETA, source of each event), and the terminal's own systems provide the **inside view** (weights measured on site, reefer temperatures, yard positions, gate lanes). Our product combines both on the planner's desk.

### 2.4 The charges ("the clock on charges is running")
- After a container is unloaded, there are a few **free days** (often ~3–5, varies).
- After the **Last Free Day (LFD)**, charges accrue **daily** until the box leaves:
  - **Demurrage** — carrier charges for its full container sitting at the terminal
  - **Storage / extended dwell** — terminal charges for yard space
  - **Exam fees** — cost of a customs/USDA inspection
  - **Detention / per diem** — after pickup, for keeping the carrier's container/chassis too long (secondary here)
- Charges are usually billed to the **importer**. The terminal planner still cares: dwelling boxes clog the yard and gate, and unfair charges (e.g. a box stuck through no fault of the importer) cause disputes.
- Terminal49 reports posted fees and computes/collects deadlines, but **does not project the dollar cost of waiting**. That projection is ours.

### 2.5 Physical safety reality
- A container declared at one weight but actually far heavier can overload cranes, chassis and trucks and cause tip-overs. International rules (SOLAS "verified gross mass," since 2016) require a verified weight before a box is loaded onto a ship.
- A warming reefer (refrigerated container) means cargo may spoil; for some cargo it can create hazardous conditions.

---

## 3. The data: what's real, and when each piece becomes known

### 3.1 REAL Terminal49 snapshot (use these exact records)
Pulled on **2026-10-17** (UTC 20:03). Four containers on one shipment, all still on the ship. The full JSON is saved unchanged at `src/data/terminal49-snapshot.json`.

**What this real data teaches us (build the product around these facts):**
1. **Before arrival, almost nothing is checkable.** Weight, seal, holds, fees, deadlines and availability are all empty. There is **no cargo description, commodity or temperature field** at all.
2. **Every event carries `data_source`** (`shipping_line`, `ais`, later `terminal`, etc.). This is built-in source attribution: the basis for "which source do you trust?"
3. **Events can be retracted** (`invalidated_at`). Sources make mistakes and get corrected; we can track each source's reliability over time.
4. **Terminal49 already has a basic `urgency` field**, suppressed until terminal data exists ("terminal availability has never been checked"). Our urgency score must be presented as **richer and built on top of theirs**, not a replacement: show Terminal49's `urgency` next to ours.
5. **Terminal49 already calculates deadlines**: `import_deadlines_*` has `original`, `current`, `calculated` and `manual` versions for the line and the terminal ("facility"), plus a `unified` pick and `days_until_lfd`. Multiple deadline versions = another real "which source do you trust?" case. Terminal49's coalesced `pickup_lfd` follows a fixed priority (line → terminal → rail), not the earliest date; their docs advise using the earliest yourself.
6. **Not a conflict:** a COSCO bill of lading on an Evergreen vessel, with container prefixes from different owners (OOCU, TRHU, TGBU, CSNU), is normal (vessel sharing and leased containers). The demo must **not** flag this.

### 3.2 Other Terminal49 fields (appear after arrival; use these names in simulated data)
- `holds_at_pod_terminal`: array of `{ name, status, description }`. `name`: `customs` (CBP), `USDA`, `VACIS` (X-ray/gamma scan), `freight` (unpaid freight), `line` (carrier release pending), `TMF` (terminal fee), `other`. `status`: `hold` or `pending`; cleared holds disappear.
- `fees_at_pod_terminal`: array of `{ type, amount, currency_code }`. `type`: `demurrage`, `extended_dwell_time`, `exam`, `total`, `other`. `amount: 0` = not yet posted (not "free"). `total` may overlap line items; never sum them together.
- `available_for_pickup` + `holds_at_pod_terminal` can **disagree** (Terminal49 docs say so). A box is ready only when `available_for_pickup` is true **and** no hold has `status: "hold"`.
- Statuses: `new`, `on_ship`, `grounded`, `available`, `not_available`, `awaiting_inland_transfer`, `on_rail`, `off_dock`, `picked_up`, `delivered`, `empty_returned`.
- Webhooks: `container.transport.vessel_arrived`, `vessel_discharged`, `available`, `not_available`, `full_out`, `container.updated` (with `changeset` of `[old, new]`), `container.pickup_lfd_line.changed`, `container.pickup_lfd_terminal.changed`, `container.pickup_appointment.changed`, `shipment.estimated.arrival`, rail events.
- `urgency` values beyond `unknown` are not confirmed in our data; if needed, simulate plausible values and label them "simulated."

### 3.3 Terminal's own systems (simulated; in reality from the TOS and equipment)
- **Crane weight at discharge** (`crane_weight_kg`, `crane_weight_at`) — many terminals weigh boxes as the crane lifts them off the ship
- **Gate scale weight** (`gate_scale_weight_kg`) — for terminals that weigh only at the gate
- **Reefer telemetry** — `reefer_setpoint_c`, `reefer_current_c`, `reefer_trend_c_per_hr`, `reefer_alarm`, `reefer_power_on` (starts reporting once plugged in at the yard)
- **Yard position** — block/row/tier and `dig_moves` (boxes stacked on top)
- **Gate lane status** — lane id, open/closed, reason, throughput
- **Truck queue** — trucks waiting, appointment or walk-up
- **Hazmat flag/class** (carrier EDI)
- **On-dock rail cutoff** times

### 3.4 Carrier / customs declarations (simulated; exist before arrival)
- Carrier's declared status and contents (e.g. "empty," commodity text)
- **Verified gross mass (VGM)** submitted at the origin port before loading (`vgm_weight_kg`) — a declared weight that exists days before arrival
- Reefer **setpoint** from the booking
- Early customs holds (CBP screens cargo data before the ship leaves the foreign port, so some holds exist before arrival)

### 3.5 Importer input (the only new input we ask for)
- Cargo criticality category: `medical`, `relief_supplies`, `perishable_food`, `critical_industrial`, `general` (verified shippers get full weight)

### 3.6 WHEN each piece becomes known (critical — the demo timeline must follow this)
| Stage | What exists | What we can catch |
|---|---|---|
| **Days before arrival** (ship at sea) | Terminal49 shipment/vessel/ETA data, events with `data_source`; carrier declarations; VGM; reefer setpoint; some early customs holds | **Paperwork contradictions only**: e.g. declared "empty" but VGM says 27 t; declared "empty" but reefer set to -18°C; dry box declared as frozen cargo; hold already placed on a box arriving in 2 days |
| **At discharge / yard arrival** (hours to days before the truck) | Crane weight; reefer plugged in and reporting; Terminal49 `vessel_discharged`, holds, fees, deadlines start filling in | **Physical conflicts**: measured weight vs declared; reefer temperature vs setpoint; `available_for_pickup` vs holds; line vs terminal deadlines |
| **At the gate** | Gate scale (if no crane weighing), truck arrival, lane outages, last-minute reefer failures | Whatever slipped through, handled with the gentlest action |

**Honesty rule for the demo:** the Pre-Arrival screen must show only paperwork-based warnings. Never show a measured weight or live reefer temperature before discharge.

---

## 4. The user: the terminal planner

**Persona (fictional):** *Maria Delgado, Gate & Yard Planner, morning shift.* Responsible for gate flow, which boxes are released to trucks, coordinating inspections with CBP, reefer issues, and keeping the yard from jamming.

**Her reality today:**
- Data spread across many screens: TOS, reefer monitoring, gate cameras, customs updates (sometimes email), carrier portals.
- Sources disagree, and she often finds out **when the truck is already at the gate**.
- Under pressure, the safe-feeling choice is the **blunt move**: hold everything or close lanes, which strands drivers, piles up charges and clogs the yard.
- She is not the authority on customs (CBP is), but she decides what the terminal does with every box.

**What she needs:** one screen that tells her, for each box, what's true, how sure we are, how urgent it is, and the gentlest action that solves it, **as early as the data allows**.

---

## 5. The problem

1. **Conflicting sources:** one box can have four stories (carrier vs scale vs customs vs reefer sensor). Nobody reconciles them.
2. **Late discovery:** conflicts often surface at the gate under time pressure, even when the paperwork contradiction or the crane reading existed earlier.
3. **Blunt responses:** without per-box clarity, the default is to hold everything or close the terminal.
4. **Hidden costs:** the cost of holding boxes (charges, spoilage, congestion, stranded drivers) isn't visible at decision time.
5. **Security blind spot:** "declared empty but weighs 27 tons" is both an operations problem and a possible smuggling/safety risk, but it gets treated as a data glitch.

**What we are NOT claiming:** that terminals lack data, that we invented urgency scoring, or that we can measure boxes before they arrive. Terminals have plenty of data; Terminal49 already normalizes and computes some of it. Our value is **reconciling sources, deciding, costing the options and acting as early as each piece of data allows**, as a decision layer on top of the terminal's software and Terminal49.

---

## 6. The solution: "Priority Lanes" (working name)

**One-liner:** *Find the problem box as early as the data allows, not when the truck is already at the gate, and always pick the gentlest action that works, so one suspicious box gets inspected while the other hundred keep moving.*

**Longer version:** *We catch paperwork conflicts before the ship arrives, physical conflicts the moment a box is unloaded, and whatever's left at the gate.*

### 6.1 Core functions
1. **Reconcile:** combine Terminal49 data with terminal sensors and declarations into one record per box; show every source side by side with its `data_source` and timestamp.
2. **Judge the sources:** pick the value to trust per attribute, with confidence and a plain-English reason.
3. **Score urgency:** richer than Terminal49's `urgency` (shown alongside).
4. **Recommend the gentlest action** from the action ladder.
5. **Plan the gate:** assign working lanes and time slots.
6. **Act early:** surface issues at each stage in 3.6.
7. **Rehearse:** drills on today's real boxes.
8. **Learn:** record which source turned out right (including `invalidated_at` events) to update reliability.

### 6.2 Fit to the theme (show explicitly in the demo)
| Theme requirement | How Priority Lanes answers it |
|---|---|
| A person who decides | The terminal planner |
| Pre-emptive, not reactionary | Paperwork conflicts flagged days ahead; physical conflicts flagged at discharge, before any truck arrives; gate rush forecast; ready-made playbook; drills |
| Gentlest response that works | Action ladder; always picks the lowest step that solves the problem |
| Cheap enough to use widely | No new hardware; runs on Terminal49 + data the terminal already has; browser-based; small terminals can use it |
| Safe around people | Flags weight hazards that endanger crane operators and drivers; never auto-releases or auto-blocks; a human approves every action; fewer shutdowns = fewer stranded drivers |
| Useful on an ordinary day | Daily conflict clean-up, deadline warnings, appointment smoothing, reefer watch |
| Dual-use twist | The same mismatch detection that keeps cargo moving (commercial) flags possible contraband/danger for CBP (security) |

---

## 7. Decision logic (implement this; show the reasoning on screen)

### 7.1 Source trust ("Which source do you trust?")
Principle: **each source is the authority on what it physically measures or legally controls; physical measurements beat declarations; fresher beats older; track record adjusts trust.**

| Attribute | Authority order (highest first) | Notes |
|---|---|---|
| Release permission | Customs/USDA hold → terminal availability → carrier line release | `status: "hold"` always blocks release, even if `available_for_pickup` is true |
| Actual weight | Crane weight / gate scale → VGM → carrier declared `equipment_weight_lbs` | Physical measurement wins |
| Contents (empty vs full) | Measured weight + reefer running state → VGM → carrier declaration | A reefer running at -18°C is unlikely to be empty |
| Temperature | Live reefer telemetry → booking setpoint | Use trend, not only current value |
| Deadline (LFD) | Earliest of `import_deadlines_pod_line_current`, `import_deadlines_pod_facility_current`, `pickup_lfd_rail` | Show Terminal49's `unified` / `pickup_lfd` value too, and explain if we chose differently |
| Location / milestones | Terminal TOS → Terminal49 event with `data_source: terminal` → `shipping_line` → `ais` | Ignore events with `invalidated_at` set |

**Confidence per attribute (0–100%):**
`confidence = authority_weight × freshness_factor × track_record_factor`
- `authority_weight`: crane/gate scale 0.95, reefer telemetry 0.95, customs 1.0 (release), terminal availability 0.85, VGM 0.80, carrier declaration 0.70, AIS (for vessel movement) 0.90
- `freshness_factor`: 1.0 if < 1h old, 0.9 if < 6h, 0.75 if < 24h, 0.5 if older
- `track_record_factor`: 0.8–1.0 from past conflicts and invalidated events (simulate, e.g. "COSCO declared weights correct in 86% of past conflicts" → 0.86)

Display example:
> *Trusting crane weight (27,400 kg, 94%): measured at discharge 2h ago. Carrier declared "empty"; VGM said 26,900 kg. Declarations from this shipper were wrong in 14% of past conflicts.*

**Conflict severity:**
- *Minor:* within tolerance (weight ±5%, temp ±2°C of setpoint, deadlines ≤ 1 day apart) → note only
- *Major:* outside tolerance → flag, request confirmation
- *Critical:* outside tolerance **and** a safety/security implication (declared empty but > 10,000 kg; temp > 8°C above setpoint and rising; hazmat with mismatched weight) → inspect

### 7.2 Urgency score ("Which box can't wait?") — 0 to 100
Show Terminal49's `urgency` value next to this score.

| Factor | Points | Rule |
|---|---|---|
| Cargo criticality | 0–30 | Medical 30, relief supplies 28, perishable food 22, critical industrial 15, general 5 (importer-declared; verified shippers only get full points) |
| Time pressure | 0–25 | Hours until earliest deadline: past 25, < 12h 22, < 24h 18, < 48h 12, < 72h 6, else 2 |
| Condition risk | 0–20 | Reefer deviation: > 8°C 20, 4–8°C 14, 2–4°C 8, else 0; +4 if trend > +1°C/hr (cap 20) |
| Cost accruing | 0–10 | Daily charges accruing: > $300/day 10, $150–300 7, > $0 4, none 0 |
| Downstream commitment | 0–10 | On-dock rail cutoff within 4h 10, confirmed appointment within 2h 7, truck already in queue 5 |
| Fairness (time waiting) | 0–5 | +1 per 12h waiting since `pod_discharged_at`, cap 5 |

Bands: **80–100 Critical (can't wait)**, 60–79 High, 40–59 Normal, < 40 Can slow.

Urgency and risk are separate: a box can be urgent **and** blocked (e.g. medical cargo on customs hold). Then the recommendation is to **expedite the blocker** (request an expedited CBP exam), not to release.

### 7.3 Action ladder ("What can you slow, reroute, inspect or release?")
Always recommend the **gentlest step that resolves the issue**. Show the ladder with the chosen step highlighted, gentler steps marked "insufficient because…", blunter steps marked "not needed because…", each with its cost.

| Step | Action | When chosen |
|---|---|---|
| 1 | **Release** | No active hold, no major conflict, available → assign lane/slot by urgency |
| 2 | **Watch** | Minor conflict or early warning (e.g. reefer drifting +1°C) → monitor, re-check in X min |
| 3 | **Flag / confirm** | Major conflict without safety implication → auto-draft a confirmation request to carrier/importer |
| 4 | **Slow** | Urgency < 40 and deadline > 48h away → offer a later appointment |
| 5 | **Reroute** | Lanes saturated → open lane, off-dock yard or on-dock rail; or pre-stage an urgent box near the gate |
| 6 | **Inspect** | Critical conflict or exam-required hold → this one box to inspection; request expedited CBP slot |
| 7 | **Hold** | Confirmed danger to people, or an active hold with no path to clear today → hold this one box only |
| 8 | **Close lane/terminal** | Only if a hazard threatens the whole terminal; needs explicit confirmation and shows its cost |

Every recommendation shows: chosen action, why, its cost, the cost of the next-blunter option, and **Approve / Modify / Reject**. Nothing happens without approval; modifications require a short logged reason.

### 7.4 Gate capacity
- **8 gate lanes**; assume **~15 truck transactions per lane per hour** (sample figure, label as such).
- Show demand vs capacity per hour. Assign working lanes to releasable boxes by urgency; offer later slots to low-urgency boxes; send rail-bound boxes to on-dock rail to bypass the truck gate.

### 7.5 Cost model (sample rates — label "sample rates" in the UI)
- Demurrage: $150/day for days 1–4 past deadline, $300/day after
- Storage / extended dwell: $75/day
- Reefer spoilage exposure: cargo value at risk (e.g. "$84,000 frozen seafood")
- Truck waiting: $90/hour per stranded truck
- Always show **"Blunt move" cost** (hold everything / run reduced lanes first-come-first-served) vs **Priority Lanes plan** cost.

### 7.6 Pre-emptive timeline (aligned with 3.6)
| Time | System behavior |
|---|---|
| **Days before** | Pull Terminal49 shipment data; check declarations, VGM and setpoints for paperwork contradictions; note early holds; notify carrier/importer/CBP |
| **T-24h** | Forecast gate demand vs capacity from ETA, discharge plan, appointments, known lane maintenance, weather; plan pre-staging and inspection slots |
| **At discharge** | Compare crane weight and reefer readings against declarations; confirm or clear earlier flags; resolve deadline disagreements; recommend actions before trucks arrive |
| **At the gate / disruption** | Load the pre-computed playbook instantly |
| **After** | Log which source was right (incl. invalidated events); update reliability |

### 7.7 Dual-use: Security view
- The same engine lists **critical mismatches** for CBP/terminal security: declared empty but heavy; weight implausible for declared commodity; seal number mismatch; reefer running while declared empty.
- Operations view shows these boxes only as "Inspection requested"; Security view shows full reasoning.
- Message: one system, one dataset, keeps commerce moving **and** targets inspections where they matter.

---

## 8. Demo scenario and data

### 8.1 Story setup
- **Today (real):** 2026-10-17. The 4 real COSCO containers (Section 3.1) are on the EVER LAUREL, ETA **2026-10-28 13:00 UTC (06:00 Los Angeles time)**, assigned to APM Terminals, LA.
- **Simulated future:** the EVER LAUREL arrives Oct 28 and discharges. On **Thursday Oct 29, 07:30**, a power fault takes **4 of 8 gate lanes** down (Lanes 5–8) until ~14:00. A wind advisory forecasts cranes may stop Friday afternoon. 34 trucks are queued. ~112 import boxes are relevant to today's gate, including the 4 real boxes (now in simulated post-arrival state) and boxes from other shipments.
- **Label clearly:** the real snapshot is real; everything after Oct 17 (arrival, holds, sensor readings, outages) is **simulated** and must carry a "Simulated scenario" banner. Because the real terminal name appears in real data, all fictional events and the planner persona must be visibly marked as simulated, not presented as real APM Terminals operations.

### 8.2 The 4 real boxes, simulated after arrival
| Container | Simulated post-arrival state | Expected action |
|---|---|---|
| OOCU8185051 | `available`, no holds, VGM 18,200 kg vs crane 18,450 kg (within tolerance), importer category `critical_industrial`, line deadline Nov 2, facility deadline Nov 1 | **Release**, note deadline disagreement (use Nov 1) |
| TRHU5485372 | `not_available`, `freight` hold (unpaid freight) | **Flag** — notify importer to pay; can't release |
| TGBU4865142 | `available`, general cargo, deadline Nov 3, no appointment | **Slow** — offer tomorrow slot |
| CSNU6554910 | `available_for_pickup: true` **but** `customs` hold `status: "hold"` (the documented Terminal49 disagreement) | Trust the hold → **Inspect** (expedite CBP); not releasable |

### 8.3 The hero box: "four stories" (simulated, from another shipment on the same vessel)
- **Oct 26 (2 days before arrival) — paperwork flag:** carrier declared status "empty," yet the booking shows a **reefer with setpoint -18°C**, and VGM says **26,900 kg**. Flagged on the Pre-Arrival screen: "Declared empty, but a running freezer and a 27-ton verified weight." Carrier asked to confirm (no reply yet). An early customs hold appears Oct 27.
- **Oct 28 (discharge) — physical confirmation:** crane weight **27,400 kg**; reefer plugged in at 09:10 reading **-9.5°C** (setpoint -18°C), rising **1.4°C/hr**, alarm HIGH_TEMP.
- **Oct 29 07:30 (gate day):** truck appointment at 09:30. Terminal49 shows `available_for_pickup: true` alongside the active customs hold. Line deadline Oct 31, facility deadline Oct 30.

(The full hero JSON from the brief is implemented as `sim-hero-0001` in `src/data/scenario.ts`.)

**Expected system output for the hero box:**
- Trusted weight: crane 27,400 kg (94%); VGM agrees within 2%; carrier "empty"/8,600 lbs rejected.
- Trusted contents: **loaded**, not empty (weight + running freezer).
- Trusted release status: **blocked** (customs hold overrides `available_for_pickup: true`).
- Trusted deadline: **Oct 30** (facility, earliest) — Terminal49's unified value picked the line date (Oct 31); explain the difference.
- Severity: **Critical**. Urgency: ~68 (High). Terminal49 `urgency` shown alongside.
- Action: **Step 6 — Inspect.** Cancel the 09:30 appointment and notify the trucker; move to the inspection bay (1 dig move); request an expedited CBP exam; dispatch a reefer technician now; assign heavy-rated handling equipment (actual weight ~7× declared); add to Security view.
- Timeline note: "First flagged Oct 26, 2 days before arrival, from paperwork; confirmed at discharge Oct 28; resolved before the truck arrived."
- Not chosen: *Hold everything* (strands 34 trucks); *Close terminal* (hazard limited to one box).

### 8.4 Other simulated boxes (include these; generate ~95 more general boxes)
| ID | Box | Situation | Expected action |
|---|---|---|---|
| sim-0002 | 40' reefer, insulin (medical, verified) | No holds, available, earliest deadline today 17:00, temp on setpoint | **Release** — first lane, urgency ~85 |
| sim-0003 | 20' dry, IV fluids (medical) | Customs hold pending exam, deadline tomorrow | **Inspect** — expedite CBP; urgent but blocked |
| sim-0004 | 40' reefer, frozen shrimp | Available, +3°C over setpoint, trend +0.6°C/hr | **Release** priority + **Watch** |
| sim-0005 | 40' dry, furniture | Available, deadline in 5 days, no appointment | **Slow** |
| sim-0006 | 40' dry, auto parts (critical industrial) | Rail-bound to Chicago, on-dock rail cutoff 11:00 | **Reroute** to on-dock rail |
| sim-0007 | 40' tank, hazmat class 3 | Crane weight 6% over VGM | **Flag/confirm**; hazmat lane |
| sim-0008 | 40' dry, electronics | `available_for_pickup: false`, no holds listed | **Watch** — likely data lag; re-check in 30 min |
| sim-0009 | 40' dry, relief supplies (generators, water) | Available, deadline in 2 days, wind advisory Friday | **Release** high priority |
| sim-0010 | 20' dry, toys | 2 days past deadline, demurrage $300 posted | **Release** — stop charges; fairness boost |
| sim-0011 | 40' dry, general | `VACIS` scan pending | **Inspect** — schedule scan |
| sim-0012 | 40' reefer, fresh produce | `USDA` hold, temp OK | **Inspect** — USDA slot; keep plugged in |
| sim-0013 | 40' dry, general | Event `vessel_discharged` from `shipping_line` later `invalidated_at` set; terminal event differs | **Watch** — trust terminal event; lower carrier reliability |
| sim-0014 | 40' dry, general | Walk-up truck, no appointment, low urgency | **Slow** — slot after 14:00 |

Fill the rest with mostly general cargo, varied deadlines, ~15% with holds, ~10% reefers and a few minor conflicts.

**Headline numbers (compute from data; these are targets, label as simulated):**
- Blunt move: ~40 trucks stranded > 3h, ~$18k projected charges + truck waiting, insulin box misses its deadline, shrimp reefer at risk.
- Priority Lanes plan: medical/reefer/relief/rail-cutoff boxes cleared by 11:00, 1 box inspected, ~25 low-urgency boxes moved to later slots, ~70% lower projected cost.

---

## 9. Screens to build

Desktop operations screen (1440px+), calm "control room" style, high contrast. Status always shown with **text + icon**, never color alone. Stack if coding: **React + Vite + Tailwind**, mock data in local JSON (seeded with Section 3.1 real data), no backend needed.

### Screen 1 — Gate Command (main dashboard)
- **Top bar:** terminal, date/time, shift; mode toggle (**Ordinary Day / Disruption / Drill**); view toggle (**Operations / Security**); "Simulated scenario" banner.
- **Lane strip:** 8 lanes with status, reason, trucks/hr; Lanes 5–8 "Down — power fault, ETA 14:00."
- **KPI tiles:** boxes waiting, trucks queued, capacity vs demand, charges accruing/day, critical conflicts, reefers in alarm.
- **Ranked box queue:** container number, cargo icon, our urgency score + band, Terminal49 `urgency`, conflict badge, holds, earliest-deadline countdown, reefer temp, **recommended action chip**, assigned lane/slot, Approve.
- **Blunt vs Gentle panel:** trucks stranded, projected charges, cargo at risk, boxes inspected — side by side.
- **Approve plan** (with per-row override).

### Screen 2 — Box Detail: "Four Stories"
- Header: container, type, yard position, urgency with factor breakdown (stacked bar), Terminal49 `urgency` beside it.
- **Source comparison table:** rows = weight, contents, release status, temperature, deadline, location; columns = Carrier declaration / VGM / Terminal49 (with `data_source`) / Crane-gate scale / Reefer sensor / Customs; each cell value + timestamp; conflicts highlighted; invalidated events struck through.
- **Trusted value column** with confidence % and one-line reason.
- **Severity badge.**
- **Action ladder visual** with costs.
- **Task checklist** (reschedule appointment, move to inspection bay, request CBP exam, dispatch reefer tech, assign heavy-rated equipment).
- **Approve / Modify / Reject.**
- **"When we knew" timeline:** paperwork flag (Oct 26) → early hold (Oct 27) → crane + reefer confirmation (Oct 28) → action before truck (Oct 29).

### Screen 3 — Pre-Arrival Radar (days before)
- Inbound shipments from Terminal49: **show the real EVER LAUREL shipment and its 4 real containers** as they are today (on ship, ETA Oct 28, nothing to check yet, Terminal49 urgency "unknown — terminal availability has never been checked"), clearly labelled "Live Terminal49 data."
- Simulated paperwork warnings for other inbound boxes: "declared empty but reefer setpoint -18°C," "declared empty but VGM 26,900 kg," "customs hold already placed," "hazmat VGM missing."
- **Only paperwork-based warnings here** — no measured weights or live temperatures.
- One-click notify (draft to carrier/importer/CBP). Summary: "Resolved before arrival: 9 of 12 paperwork conflicts" (simulated).

### Screen 4 — Gate Forecast
- Next 36h: demand (boxes becoming available + appointments) vs capacity (open lanes × throughput), with events overlaid (vessel discharge, lane maintenance, wind advisory).
- Predicted jam window + recommendations: pre-stage X boxes, shift Y appointments, reserve Z inspection slots.

### Screen 5 — Drill Mode
- Scenarios: "4 lanes down 6h," "Wind: cranes stop 12h," "Customs system outage 4h," "Reefer power failure in Block R2."
- Applies to current boxes and shows plan + costs without live changes. Banner: "DRILL — no live actions."

### Screen 6 — Security View (dual-use)
- Critical-mismatch boxes with full reasoning (declared vs measured weight, reefer running while declared empty, commodity plausibility, seal mismatch). Role-separated; Operations shows only "Inspection requested."

### Screen 7 — After-Action / Learning Log
- Resolved conflicts: which source was right, time to resolve, action, cost avoided; invalidated events counted against the source.
- Source reliability (e.g. "COSCO declared weights: correct 86%" — simulated).
- Weekly summary (simulated): "41 conflicts caught before the gate, 3 lane closures avoided, ~$46k charges avoided."

---

## 10. Demo walkthrough (about 3 minutes)

1. **(0:00) Hook:** "This is Maria, a terminal planner. Today 4 of her 8 gate lanes are down, 34 trucks are waiting, and one box is telling four different stories. The usual move is to hold everything."
2. **(0:20) Start with real data:** Pre-Arrival Radar — the real EVER LAUREL shipment from Terminal49, 4 real containers, arriving Oct 28. "Before arrival, there's little to check — Terminal49 even suppresses its urgency. So we check the paperwork." Show the hero box's paperwork flag from Oct 26.
3. **(0:50) Gate Command (simulated Oct 29):** lanes down, queue, Blunt vs Gentle panel.
4. **(1:10) Hero box — Four Stories:** sources side by side, trusted values with reasons, the "when we knew" timeline, action ladder landing on **Inspect** — one box, not the gate.
5. **(1:50) Which box can't wait:** insulin released to Lane 1; auto parts rerouted to rail before 11:00; furniture slowed; the real CSNU6554910 box shows the availability-vs-hold disagreement and is correctly not released. **Approve plan**; Blunt vs Gentle updates.
6. **(2:20) Drill:** "Wind stops cranes Friday" → relief supplies pulled forward.
7. **(2:40) Dual-use:** Security View shows the hero box with full reasoning.
8. **(2:55) Close:** "Find the problem box as early as the data allows, and always choose the gentlest action that works. Built on Terminal49."

---

## 11. Principles the demo must visibly respect
- **Human in charge:** every action needs approval; reasons always shown.
- **Gentlest first:** blunt options visible but clearly costlier.
- **Explainability:** every score expands into its parts.
- **Honesty about data and timing:** label live Terminal49 data vs simulated; never show physical readings before discharge; label sample rates; credit Terminal49's existing `urgency` and deadline calculations.
- **Accessibility:** text + icon for status; readable sizes.
- **Ordinary-day usefulness:** Ordinary Day mode shows a calm tool with a few early warnings and deadline alerts, not an empty screen.

---

## 12. Feasibility notes (can appear on a "How it's built" screen)
- **Real:** Terminal49 API — tracking requests, container and shipment data, events with `data_source`, holds, fees, `import_deadlines_*`, `urgency`, webhooks. The snapshot in 3.1 came from a live account. Free developer key covers up to 100 containers.
- **Simulated for the demo:** post-arrival states, carrier declarations/VGM, crane and gate scale, reefer telemetry, yard positions, lanes, importer categories, charge rates, reliability history.
- **Production path:** connect to the terminal's TOS (e.g. Navis) and reefer monitoring via existing feeds; runs alongside existing software; no hardware.
- **Business model (brief):** per-terminal subscription; security module for CBP/port security; Terminal49 as data partner and potential channel.

---

## 13. Deliverable requested from you (the AI building the mockup)
Build an interactive, clickable demo implementing Screens 1–7 (prioritize Screens 1, 2 and 3), using the real snapshot (3.1), the scenario (8) and the logic (7). It should:
- Open on the Pre-Arrival Radar showing the real Terminal49 shipment, then move to the simulated Oct 29, 07:30 disruption.
- Compute trusted values, confidence, severity, urgency and recommended actions from the rules where feasible, not hard-coded labels.
- Let the user approve the plan and see Blunt vs Gentle update.
- Switch modes (Ordinary Day / Disruption / Drill) and views (Operations / Security).
- Clearly label real vs simulated data throughout.
- Look like a real product a terminal operations team would use.
