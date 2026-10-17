# PortTable

**Don't decide which ships wait. Decide which cargo waits.**

PortTable is a hackathon prototype for the *Two Lives, One Tool* challenge (shipping logistics track). It is an interactive 3D digital twin of a stylized container port that loses half its berths to a storm.

- **Life 1, a normal day:** PortTable is a shared scheduling layer that books berth windows and truck pickup slots across terminals, so trucks wait less and the gate moves more boxes.
- **Life 2, the storm:** the same tool switches from first come, first served to moving lifeline cargo first (medical, then energy, then food and water, then industry). A person stays in charge: PortTable suggests each move and shows what happens either way, and the harbor master approves or rejects it.

## Try it

Open `index.html` in a recent desktop browser (it needs WebGL and a network connection for the Three.js CDN), or enable GitHub Pages for this repository.

Suggested 3-minute demo:

1. It opens on **Today** at 1:30 PM. Scrub to 4 PM: the insulin ship is stranded at a berth the wind has closed.
2. Press **T** to see **PortTable** at the same moment: the insulin was swapped into a sheltered berth and delivered at 2 PM.
3. Pick **Storm drill · you decide** from the scenario menu. At 11:00 PortTable asks whether to declare lifeline mode; at 1 PM whether to swap the insulin ship into a sheltered berth (insulin and dialysis on time, but baby formula late). Press **S** to jump to each decision, or **B** to jump straight (press B again to reopen the box) to the four-stories box at 5:20 PM (PortTable makes the earlier calls). Each card shows PortTable's suggestion and the forecast for every option.
4. Play to the end for the shift report.

Controls: drag to orbit, scroll to zoom, click ships, cranes, the yard, the gate, trucks or buildings. Keys: `Space` play, `T` Today ↔ PortTable, `S` jump to the storm (in the drill: next decision), `B` jump to the four-stories box, `←`/`→` step 10 minutes, `Esc` clear selection.

## One box, four stories

The challenge's terminal-planner scenario is built in. Container PTLU 448812 3 comes off Golden Tern during the storm, and every source tells a different story:

| Source | What it says |
| --- | --- |
| Carrier manifest | Empty, repositioning |
| Terminal scale | 26.4 t gross |
| Customs | Hold: agriculture exam |
| Reefer plug | −9 °C against −18 °C set, warming |

PortTable compares the sources for every box as it comes off the ship. When two or more disagree or raise an issue, it flags the box and moves it to an **exception bay** before it can stop a gate lane; a box with a single routine flag stays in the normal flow. Today the conflict only surfaces at the gate: the three flagged boxes stop a lane for about an hour each (3 lane-hours) while half the lanes are already flooded, the reefer sits unplugged and spoils, and detention charges climb. PortTable loses no lane time.

In the storm drill, a box with three or more conflicting stories goes to the terminal planner with PortTable's read on which source to trust (the scale and the reefer plug are physical readings from today; the carrier's "empty" is contradicted; the customs hold is binding) and a forecast for each option: separate it (suggested), hold just that box, or hold the whole gate. Releasing it on the carrier's word is shown but blocked. The **Exceptions** tab ranks flagged boxes by which one can't wait.

## Results in the simulation

| Scenario | Lifeline orders on time (of 10) |
| --- | --- |
| Today: walk-up trucks, first come, first served | 2 |
| PortTable, Life 1 only (booked slots) | 3 |
| PortTable autopilot (takes every suggestion) | 8 |
| Storm drill (you decide) | depends on your calls; rejecting lifeline mode gives 3 |

These numbers come from a small deterministic model with illustrative values. They compare plans; they don't forecast a real port.

## How it is built

- `src/sim.js`: the simulation. 24 hours in 10-minute steps: ships, berths and cranes, the container yard, the truck gate and deliveries to five city destinations. In storm-drill mode it records each decision point; the interface re-runs the rest of the shift with *approve* and with *reject* to make a suggestion.
- `src/game.js`: the Three.js r128 scene, labels, picking, the dashboard panels (KPIs, inspector, order timeline, operations list, decision cards and log) and playback.
- `src/style.css`, `src/body.html`, `src/head.html`: layout and markup. The visual language follows a WareTrack-style 3D operations dashboard: soft miniature 3D, white and icy blue surfaces, royal-blue accents.
- `build.py`: assembles everything into `index.html`.

Edit files in `src/`, then run:

```
python3 build.py
```
