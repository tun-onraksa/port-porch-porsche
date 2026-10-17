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
3. Pick **Storm drill · you decide** from the scenario menu. At 11:00 PortTable asks whether to declare lifeline mode, later whether to swap the insulin ship into a safe berth or dig buried boxes out. Each card shows PortTable's suggestion and the forecast for both choices.
4. Play to the end for the shift report.

Controls: drag to orbit, scroll to zoom, click ships, cranes, the yard, the gate, trucks or buildings. Keys: `Space` play, `T` Today ↔ PortTable, `S` jump to the storm, `←`/`→` step 10 minutes, `Esc` clear selection.

## Results in the simulation

| Scenario | Lifeline orders on time (of 10) |
| --- | --- |
| Today: walk-up trucks, first come, first served | 3 |
| PortTable, Life 1 only (booked slots) | 4 |
| PortTable autopilot (takes every suggestion) | 9 |
| Storm drill (you decide) | depends on your calls; rejecting lifeline mode gives 4 |

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
