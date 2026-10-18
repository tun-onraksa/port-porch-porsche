# PortTable — Long Beach cost-planning demo

## Integrated Priority Lanes workspace

The `dev` branch combines PortTable's 3D simulation, resource workbench, cargo inspections and calculation audits with five Priority Lanes V2 dashboards. Serve this directory and open `index.html#p-gate` for Gate Command, or `index.html#live` for the simulation. Pages are grouped under **Operations**, **Planning**, and **Reference** and use the workspace’s light-only appearance.

- Forecast, Security Review, Learning Log and Data & Methodology keep the selected scenario and playback time. They support the four-container Terminal49 sample, 1,000-container synthetic day and 112-container Priority Lanes scenario. Gate Command offers an explicit switch when its Priority Lanes queue is not selected.
- All 112 start in the simulation yard at 06:00, already discharged. Cargo links open that exact container in 3D. Geometry is illustrative.
- Gate approvals change future simulation intervals: priority cargo moves ahead, slow actions delay pickup, rail routing requires staffed rail capacity, and inspection/hold actions prevent departure until changed. Source holds cannot be overridden by release. Historical frames remain unchanged.
- Gate Forecast aggregates the same ten-minute frames as the animation, from the current clock through the end of the 06:00–06:00 teaching day. It separates truck exits, rail exits, staffed gate slots and pickup-ready inventory. It does not invent truck arrivals, weather disruptions or next-day demand. Partial-hour windows retain exact integer capacity rounding. Gate Command alone retains its separate mocked Oct 29 appointment planner; its action costs are not terminal operating costs.
- Gate delay/handling estimates and terminal operating expenses have different scopes and are displayed separately.
- Security Review lists non-exited held or flagged cargo from the selected run; recorded clearances remain explicitly unverified. Synthetic seal cases appear only after the incident time. Learning Log reports elapsed exits/costs and actions from this run, with no invented weekly savings or accuracy claims.
- Scenario changes start a new run at 06:00 and clear session cargo decisions and learning events. Resource settings and existing order annotations retain their local storage behavior. Dashboard decisions carry a run identifier to reject stale messages. No external notifications are sent.

Build both parts after editing (Node 24+ and Python 3):

```sh
cd priority-lanes-v2
npm ci
npm run build:integrated
cd ..
node tests/simulation.cjs
node tests/dashboard-data.cjs
python3 -m http.server 8765 --bind 127.0.0.1
```

`src/dashboard-data.js` builds read-only reports from simulation frames, cargo actions, source flags and run-scoped events. `priority-lanes-v2/src/screens/SimulationDashboard.tsx` renders the four embedded reports. `src/priority-workspace.js` connects dashboard and terminal state through validated same-origin messages. `src/priority-data.js` is generated from Shannon's scenario and evaluation engine by `priority-lanes-v2/scripts/export-porttable.ts`. The standalone dashboard remains at `priority-lanes-v2/priority-lanes.html`; the workspace uses its embedded presentation. `priority-lanes-demo.html` preserves the earlier V1 demo from the merged branch.

A hypothetical container-terminal planning scenario in the existing PortTable 3D port. Compare operating plans using six decisions: available berths, scheduled cranes, workers per shift, operating hours, yard space, and truck-gate/rail capacity.

Open `index.html` in a desktop browser. The 3D view requires WebGL and the Three.js CDN; the calculations and controls work without the CDN. Drag to orbit and scroll to zoom.

## Workspace

The sidebar groups Live operations, Gate command and Security review under **Operations**; Resource planning and Gate forecast under **Planning**; and Learning log and Data & methodology under **Reference**. Resource planning retains the `#orchestrator` URL. Order board, Order configuration, Service zones, Ledger, Cargo evidence, Pre-arrival radar and Disruption drills have been removed. Cargo evidence, Pre-arrival radar and Disruption drills URLs redirect to Gate Command; the other retired URLs redirect to Live operations. Existing saved annotations are retained in storage but the retired editors are no longer loaded.

- **Live operations**: 3D terminal, area focus controls, playback, cost/throughput metrics and an approved-capacity inspector. Cargo records open directly from inventory or the 3D view. The conflict response stays beside the scene.
- **Resource planning**: select an operation, inspect its current state, choose mocked recommendations or edit all seven resource quantities, review the calculated impact, and approve. Changes affect future intervals only. Decision history is available in a disclosure.
- **Model assumptions**: a read-only reference dialog available from either page. The cost projection opens a separate arithmetic audit.

The initial playback time is 06:00. Resource plans, existing rates, and up to 30 activity entries persist locally. Cargo decisions and historical simulation schedules last for the session. Restarting the conflict demo starts a synthetic day with default resources and rates.

### Design approach

All seven screens prioritize the current task. Source tables, calculation rules, histories and alternative actions use labeled disclosures. Gate Command shows twelve queue entries, with cargo links opening the existing 3D inspector. Scenario and resource controls share one compact dashboard menu. Hold reasons, deadlines, approval actions and the distinction between recorded and mocked data remain visible.

Apple Human Interface Guidelines inform this web interface: persistent selection and adjacent detail (`split-views.md`, Best practices), shallow navigation (`sidebars.md`, Best practices), restrained toolbars (`toolbars.md`, Best practices), and a clear primary approval action (`buttons.md`, Style). The port model is the visual focus; native buttons, disclosures and dialogs handle supporting tasks. Compact screens stack the scene and inspector and retain all decisions.

System typography uses a 32px page title, 20–24px section titles and 13–14px controls/body text. Light surfaces use #ffffff with #1d2939 content (14.70:1), #526174 secondary text (6.32:1) and #245bc4 accent (6.23:1). The 3D investigation is the purposeful motion; reduced motion skips its camera transition. Keyboard focus and 44px compact-screen controls are supported. Light appearance is fixed regardless of the system theme.

Browser verification covers removed routes, operation selection, related resource focus, draft/discard, keyboard-opened calculation audits, model reference, conflict pause/investigate/inspect/release, historical preservation, dashboard approvals, all three scenarios and mobile layouts under both system theme preferences. Pure model checks cover conservation, costs, capacity, holds and release timing. Dashboard tests additionally reconcile every future exit and forecast interval, partial-hour capacity, rail separation, zero staffing, source provenance and future-only plan changes across all three scenarios.

## Demo

1. Open Live operations and choose a scenario. Play the shift or select an area to inspect its activity.
2. Select **Adjust plan** to inspect capacity and draft changes in Orchestrator.
3. For the guided incident, expand **Try a cargo conflict** and choose **Run conflict demo**.
4. At 08:00, the port pauses and shows the seal-mismatch alert. Select **Investigate** to zoom into the cargo.
5. Choose inspection or release, adjust resources, and open **Day estimate** to review the arithmetic.
6. Approve to resume. The simulation preserves completed activity and applies decisions going forward.

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

Long Beach authority FY2024 operations/administration of $218.866m and depreciation/amortization of $162.014m are historical context, never added or used to calibrate private-terminal unit rates. Source: [City FY2024 financial disclosure, printed p.19](https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/treasury/2024-summary-of-financial-information-continuing-disclosure).

## Development and validation

No build dependencies required:

```sh
python3 build.py
node tests/simulation.cjs
node tests/dashboard-data.cjs
```

- `src/sim.js`: pure deterministic flow and cost model.
- `src/terminal49.js`: source records and provenance.
- `src/scene.js`: retained original scene geometry, adapted to model state.
- `src/game.js`: playback, live cost and throughput metrics.
- `src/workspace.js`: navigation, shared cargo records and local persistence.
- `src/cargo-records.js`: contextual container record dialogs.
- `src/orchestration.js`: resource drafts, suggested actions, incident decisions and approval.
- `src/body.html`, `src/style.css`, `src/head.html`: interface.
- `index.html`: generated standalone page; rebuild after editing source.

Tests cover source provenance, cost reconciliation, conservation of containers, zero-resource cases, rail billing and response to added capacity.

### Operational 3D inspection

Live operations includes camera views for berths, yard, truck gates and rail. Click scene equipment or use keyboard-accessible focus buttons. The inspector shows vessel occupancy, supported crane capacity, yard inventory and release assumptions, recent departure records, and ten-minute time steps. Yard objects map to individual simulation container IDs (first 252 drawn); inventory tables show the first 40 and exit tables the latest 20. Exact totals include all cargo.

Motion follows the most recent ten-minute simulation batch and stops when paused or reduced motion is requested. Vehicle positions illustrate a batch, not physical trajectories. Rail remains a continuous-capacity approximation, not a train timetable. Crane positions show scheduled equipment; throughput remains pooled as defined by the model. Source tracking is never replaced with modeled events.

### Conflict-driven Orchestrator demo

Choose **Run conflict demo** in Live operations or Orchestrator. This starts a synthetic day at 06:00 with default resources and rates. At 08:00 a deterministic seal-reference exception holds the first 12 synthetic containers, pauses playback and shows a red alert over the 3D port. Select Investigate to zoom into the cargo and review the decision controls beside the scene. Inspect individual records, select a 30-minute mocked inspection or immediate mocked release, then review or edit the resource draft. The preset AI suggestion is hardcoded; no model or external service is called.

The projected cost and backlog include the cargo disposition and draft resource plan. **Approve & resume simulation** applies changes from the paused time forward and resumes playback. Held boxes cannot depart before their release step, while other eligible cargo can continue. Historical frames and costs are preserved when resources change. Rates remain global teaching assumptions. Resource decisions live in the Orchestrator and the in-scene conflict inspector. Playback is blocked while the conflict awaits approval. The Investigate flow keeps the cargo close-up, disposition choices, resource draft and calculation preview on Live operations.

Guided playback, cargo holds and time-based approvals are session-only and reset on reload; the last resource values persist locally; legacy planning metadata is retained. No real cargo is released, no customs system is contacted, and no real transport is dispatched. One scripted incident is included; this is not an automatic detection engine for arbitrary operational conflicts.

### 3D interior inspections and calculation audit

Selecting a yard container or an Orchestrator held-cargo card now flies the existing port camera into a detailed container at that yard position. Container doors open, the roof can be cut away, and packages can be selected for a closer view. Three procedural asset families are included: palletized cartons, sealed oil drums and crated pump assemblies. Door-seal and exterior camera views, roof/door toggles and previous/next-container navigation support inspection. Contents, weights and seals are explicitly mocked; no interior manifest is inferred from Terminal49. Off-yard records use a labeled mock inspection bay. Playback remains paused and returning to the port preserves the pending decision. Reduced-motion preferences skip the camera and door animation.

Click **Day estimate** or activate it with Enter/Space to open the calculation audit. It reconciles elapsed and future operating costs with the projected total, expands the resource quantities/rates/hours for each category, explains rail rounding, and shows the completed/backlog equations from the same simulated run. It does not add an inspection fee or claim to model real invoices.

Asset/UI files: `src/cargo-models.js`, `src/inspection.js`, and `src/projection.js`. No external 3D model downloads or AI services are required for these features; the existing Three.js CDN dependency remains.

### In-scene conflict response

A conflict does not automatically navigate to the Orchestrator. The port pauses with a red accessible alert. **Investigate** flies into the affected cargo and reveals the decision panel beside the 3D view. Choose inspection followed by release, immediate release on approval, or keep the cargo held and stay paused. Resource action cards, quantity steppers, the preset suggestion and the calculation pop-up remain available alongside the model. Approval closes inspection and resumes the port; inspection and immediate-release timing use the existing model. While the conflict remains unresolved, the simulation clock stays fixed at the incident time. Closing the alert or returning to the port does not release cargo.
