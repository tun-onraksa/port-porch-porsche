# Priority Lanes (build 2)

Hackathon demo for **Track 04 — Ports, with Terminal49: At the Gate**. A pre-emptive decision tool for a
container terminal planner: find the problem box as early as the data allows, and always pick the gentlest
action that works.

The spec is in [`BRIEF.md`](BRIEF.md). Status, decisions and deviations are in [`HANDOVER.md`](HANDOVER.md).

## Open it

Double-click **`priority-lanes.html`**. It's one self-contained file (JS, CSS and fonts inlined): no server,
no internet. It opens on the Pre-Arrival Radar with the guided demo (8 steps, about 3 minutes) in the corner.

Deep links: `priority-lanes.html#gate`, `#box`, `#forecast`, `#drill&drill`, `#security`, `#learning`, `#built`.
Add `&guide` to keep the guided demo open, `&ordinary` for Ordinary-day mode.

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + build → dist/index.html, copied to priority-lanes.html
npm run report    # prints the engine's numbers for the scenario (no browser needed)
```

Stack: Vite 8, React 19, TypeScript 6, Tailwind 4, lucide-react, vite-plugin-singlefile. No backend.

## What's real and what isn't

- **Real:** the Terminal49 snapshot from 2026-10-17 (`src/data/terminal49-snapshot.json`): EVER LAUREL, B/L
  9509953390, 4 containers. Field names follow Terminal49's API throughout.
- **Simulated:** everything after Oct 17. That covers arrival, holds, sensors, outages, the other 108 boxes,
  the planner persona, the rates and the reliability history. The UI labels it everywhere. None of it is real
  APM Terminals operations.
