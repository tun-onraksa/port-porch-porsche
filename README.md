# PortTable — Long Beach cost-planning demo

A hypothetical container-terminal planning scenario in the existing PortTable 3D port. Compare operating plans using six decisions: available berths, scheduled cranes, workers per shift, operating hours, yard space, and truck-gate/rail capacity.

Open `index.html` in a desktop browser. The 3D view requires WebGL and the Three.js CDN; the calculations and controls work without the CDN. Drag to orbit and scroll to zoom.

## Workspace

The UI takes information-architecture inspiration from [Fleetbase](https://github.com/fleetbase/fleetbase), specifically its order board, live operations, activity-flow configuration, service-zone and orchestrator screens. No Fleetbase source code or image assets are embedded.

- **Order board**: searchable and filterable tracking and planning boards; rich cards, assignments, custom fields, milestones and history; filtered CSV export.
- **Live operations**: 3D inspection, focused camera views, playback, ten-minute steps and exact cargo-flow details. Resource proposals live in the Orchestrator.
- **Order configuration**: editable planning stages, custom fields, lifecycle rules and entity directory, alongside workflow defaults and simulation rates.
- **Service zones**: schematic quay, yard, gate and rail areas. Capacity edits become Orchestrator drafts for approval.
- **Orchestrator**: conflict alerts, cargo inspection/release choices, granular operational details, a preset suggestion, draft resource sliders, cost/backlog previews and approval from the current simulation time onward.
- **Ledger**: full-day cost breakdown, modeled completion and backlog, source data coverage, and CSV summary with the active plan and assumption rates. This is not an invoicing or payment system.

Plans, rates, notes, configuration and up to 30 activity entries persist in local browser storage. Storage failures show a session-only status. Data is not sent to a backend. Priority/zone annotations do not imply tracking events or change cargo sequencing; the release-lag and resource settings do affect the simulation. Individual container annotations override configuration defaults. Restart conflict demo resets playback, resources and rates; planning metadata is retained.

### Design approach

Apple Human Interface Guidelines were applied as web design principles: persistent shallow sidebar navigation (`sidebars.md`, Best practices), searchable tables with selected-item details (`lists-and-tables.md`, Content), grouped validated forms (`entering-data.md`, Best practices), and feedback next to the affected controls (`feedback.md`, Best practices). System typography, semantic color tokens, system dark appearance, reduced-motion behavior, labeled controls and keyboard-accessible native dialogs support the interface. The primary accent is reserved for selection and action; amber always has explanatory text.

Browser checks cover rich cards and search, planning assignments and persistence, lifecycle validation, drop handlers, mocked conflict pause/navigation, hold details, preset drafts, both release choices, approval gating, historical-frame preservation and mobile layout. Pure simulation checks cover conservation, costs, staffing, holds, release timing and future-only resource changes.

## Demo

1. Inspect the source sample on the Order board; switch between Tracking and Planning views.
2. Open Order configuration to define stages, fields, entities and completion rules.
3. Choose **Run conflict demo** from Live operations or Orchestrator.
4. At 08:00, playback pauses on a mocked seal-check exception. Inspect a container, select inspection or release, and edit or accept the preset resource draft.
5. Review projected costs and backlog, then approve and resume. The simulation retains elapsed activity and applies decisions going forward.

## Actual data versus assumptions

`src/terminal49.js` contains a minimal extraction of the supplied `terminal49_active_containers_transposed.numbers` (Sheet 1, table of the same name). Four unique 40-foot dry high-cube containers, 8 TEU, share EVER LAUREL voyage 1241E. The snapshot's created_at is October 17, 2026. Destination is **Los Angeles / APM Terminals**, not Long Beach. Estimated arrival is October 28, 2026 at 13:00 UTC / 06:00 PDT. All are on_ship. Terminal availability has never been checked; actual arrival, discharge and last free day are missing. Empty fee/hold lists do not establish zero charges or customs release.

The demo retains this provenance and uses the sample as a **hypothetical Long Beach workload**. Its projected exits are not real tracking updates. Source data stays unchanged when the model runs. Only selected operational fields are embedded; shipment IDs and bill-of-lading identifiers are excluded.

All resource settings, rates, productivity, staffing ratios and release lags are illustrative. The synthetic scenario is four invented calls of 250 containers at two-hour intervals, not a forecast extrapolated from the sample. The geometry is the original stylized port, not Long Beach geography; four crane models represent berth work areas rather than one-for-one crane counts. City buildings are contextual scenery; no cargo contents or inland recipients are inferred.

## Cost and flow logic

- Berths × daily berth upkeep.
- Scheduled cranes × scheduled hours × hourly equipment cost.
- Workers per shift × scheduled hours × fully loaded hourly wage.
- Yard acres × daily cost per acre.
- Gate lanes × scheduled hours × hourly equipment cost.
- Rail train-equivalents used × cost per train-equivalent (100 containers, rounded up).
- Fixed daily overhead.

Crane/gate/rail rates exclude labor, counted in the worker line. Scheduled resources cost money even when idle. Hours above eight imply successive crews, not the same person working all day; no overtime premium is modeled. At each ten-minute step, two workers per gate lane and two for rail are allocated first; eight remaining workers support each crane. Each berth supports at most two active cranes. Cargo unloads until yard storage is full. Pickup occurs after an assumed release lag, with truck capacity used before rail. Rail flow is a continuous hourly approximation, not a train timetable. No unused throughput credits accumulate beyond fractional rounding.

24-hour fixed expenses accrue while closed; scheduled costs stop at the selected operating hours. Cost per completed container divides elapsed costs by terminal exits (undefined when none exit). Daily plan totals always show the full 24 hours. Queue ship-hours and yard container-hours are separate indicators, not charges. Capital, depreciation, debt service, cargo value, demurrage and external delay costs are excluded.

Long Beach authority FY2024 operations/administration of $218.866m and depreciation/amortization of $162.014m are displayed only as historical context, never added or used to calibrate private-terminal unit rates. Source: [City FY2024 financial disclosure, printed p.19](https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/treasury/2024-summary-of-financial-information-continuing-disclosure).

## Development and validation

No build dependencies required:

```sh
python3 build.py
node tests/simulation.cjs
```

- `src/sim.js`: pure deterministic flow and cost model.
- `src/terminal49.js`: source records and provenance.
- `src/scene.js`: retained original scene geometry, adapted to model state.
- `src/game.js`: decisions, cost breakdown, comparison and playback.
- `src/workspace.js`: navigation, order board, local planning configuration, service zones, orchestration, ledger and persistence.
- `src/body.html`, `src/style.css`, `src/head.html`: interface.
- `index.html`: generated standalone page; rebuild after editing source.

Tests cover source provenance, cost reconciliation, conservation of containers, zero-resource cases, rail billing and response to added capacity.

### Operational 3D inspection

Live operations includes camera views for berths, yard, truck gates and rail. Click scene equipment or use keyboard-accessible focus buttons. The inspector shows vessel occupancy, supported crane capacity, yard inventory and release assumptions, recent departure records, and ten-minute time steps. Yard objects map to individual simulation container IDs (first 252 drawn); inventory tables show the first 40 and exit tables the latest 20. Exact totals include all cargo.

Motion follows the most recent ten-minute simulation batch and stops when paused or reduced motion is requested. Vehicle positions illustrate a batch, not physical trajectories. Rail remains a continuous-capacity approximation, not a train timetable. Crane positions show scheduled equipment; throughput remains pooled as defined by the model. Source tracking is never replaced with modeled events.

### Granular board and configuration

The board has Tracking and Planning views. Tracking is source evidence or simulation state; Planning supports drag-and-drop and an accessible stage selector in container details. Cards show vessel, terminal, arrival, equipment basis, coordinator, carrier, customer, priority and zone. Details include milestones, local assignments, appointment/destination notes, custom fields and planning history. Synthetic records have explicitly fictional demo organizations; real records remain unassigned until edited.

Order configuration includes Details, Activity flow, Custom fields, Lifecycle, Entities and Cost assumptions. Edit stage labels/instructions, add/reorder intermediate stages, define text/number/date fields, and enforce sequential forward handoffs and completion requirements. These planning settings and annotations save to browser local storage. Removing an assigned entity or occupied stage is blocked. Removing a custom-field definition retains existing values locally. CSV exports include planning metadata.

### Conflict-driven Orchestrator demo

Choose **Run conflict demo** in Live operations or Orchestrator. This starts a synthetic day at 06:00 with default resources and rates. At 08:00 a deterministic seal-reference exception holds the first 12 synthetic containers, pauses playback and shows a red alert over the 3D port. Select Investigate to zoom into the cargo and review the decision controls beside the scene. Inspect individual records, select a 30-minute mocked inspection or immediate mocked release, then review or edit the resource draft. The preset AI suggestion is hardcoded; no model or external service is called.

The projected cost and backlog include the cargo disposition and draft resource plan. **Approve & resume simulation** applies changes from the paused time forward and resumes playback. Held boxes cannot depart before their release step, while other eligible cargo can continue. Historical frames and costs are preserved when resources change. Rates remain global teaching assumptions. Resource decisions live in the Orchestrator; zone edits are routed into its approval draft. Playback is blocked while the conflict awaits approval. The Investigate flow keeps the cargo close-up, disposition choices, resource draft and calculation preview on Live operations.

Guided playback, cargo holds and time-based approvals are session-only and reset on reload; planning configuration, assignments and the last resource values persist locally. No real cargo is released, no customs system is contacted, and no real transport is dispatched. One scripted incident is included; this is not an automatic detection engine for arbitrary operational conflicts.

### 3D interior inspections and calculation audit

Selecting a yard container or an Orchestrator held-cargo card now flies the existing port camera into a detailed container at that yard position. Container doors open, the roof can be cut away, and packages can be selected for a closer view. Three procedural asset families are included: palletized cartons, sealed oil drums and crated pump assemblies. Door-seal and exterior camera views, roof/door toggles and previous/next-container navigation support inspection. Contents, weights and seals are explicitly mocked; no interior manifest is inferred from Terminal49. Off-yard records use a labeled mock inspection bay. Playback remains paused and returning to the port preserves the pending decision. Reduced-motion preferences skip the camera and door animation.

Click **Projected end of day** or activate it with Enter/Space to open the calculation audit. It reconciles elapsed and future operating costs with the projected total, expands the resource quantities/rates/hours for each category, explains rail rounding, and shows the completed/backlog equations from the same simulated run. It does not add an inspection fee or claim to model real invoices.

Asset/UI files: `src/cargo-models.js`, `src/inspection.js`, and `src/projection.js`. No external 3D model downloads or AI services are required for these features; the existing Three.js CDN dependency remains.

### In-scene conflict response

A conflict does not automatically navigate to the Orchestrator. The port pauses with a red accessible alert. **Investigate** flies into the affected cargo and reveals the decision panel beside the 3D view. Choose inspection followed by release, immediate release on approval, or keep the cargo held and stay paused. Resource sliders, the preset suggestion and the calculation pop-up remain available alongside the model. Approval closes inspection and resumes the port; inspection and immediate-release timing use the existing model. While the conflict remains unresolved, the simulation clock stays fixed at the incident time. Closing the alert or returning to the port does not release cargo.
