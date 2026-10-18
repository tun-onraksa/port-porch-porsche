import { ScreenHeader } from '../ui/layout.tsx'
import { Panel } from '../ui/primitives.tsx'

export function HowBuilt(){
 return <div className="methodology-page">
  <ScreenHeader title="Data & methodology"/>
  <div className="methodology-sources">
   <Panel title="Recorded data"><strong className="reference-number">4 containers</strong><p>Terminal49 snapshot · 17 Oct 2026</p><dl className="reference-facts"><dt>Vessel</dt><dd>EVER LAUREL · 1241E</dd><dt>Destination</dt><dd>Los Angeles · APM Terminals</dd><dt>ETA</dt><dd>28 Oct · 06:00 PDT</dd><dt>Pickup / fees</dt><dd>Unverified</dd></dl></Panel>
   <Panel title="Simulated data"><strong className="reference-number">108 added containers</strong><p>112 total in the Priority Lanes scenario</p><p>All post-arrival events, holds, sensor readings, appointments, costs and recommendations are mocked. The Long Beach terminal is hypothetical.</p></Panel>
  </div>
  <Panel collapsible title="How decisions are calculated">
   <ol className="method-steps"><li><b>Compare sources</b><span>Declarations, terminal measurements, tracking and customs records.</span></li><li><b>Evaluate confidence</b><span>Authority × freshness × historical reliability.</span></li><li><b>Rank urgency</b><span>Six factors combine into a priority score.</span></li><li><b>Recommend an action</b><span>Choose a sufficient action, estimate its effect, then request approval.</span></li><li><b>Record the outcome</b><span>Confirmed results update source reliability.</span></li></ol>
  </Panel>
  <Panel collapsible title="Costs & simulation clocks">
   <p>Terminal simulation: 06:00–06:00 in ten-minute steps. Costs include berths, cranes, workers, yard, gates, rail and overhead. View quantities and rates in the Orchestrator projection.</p>
   <p>Gate forecasts: simulated 29 Oct, 07:30 cargo snapshot and appointments. Delay and handling estimates are separate from terminal operating costs. The 36-hour forecast repeats the daily operating schedule.</p>
   <p>Capital costs, depreciation and external shipping costs are excluded. Terminal inspection has no separate fee; gate action estimates use sample rates.</p>
  </Panel>
  <Panel collapsible title="Approvals & source holds">
   <p>Approved changes affect future intervals. Release does not override a source hold. Rail routing needs staffed rail capacity. Inspection and hold actions block departure until changed.</p>
   <p>Drills are isolated. Notifications and CBP referrals are simulated; nothing is sent externally. Security view is a demo role switch, not access control.</p>
  </Panel>
  <Panel collapsible title="Storage & limitations">
   <p>Resource settings and activity are stored on this device. Dashboard approvals, cargo holds and simulation history last for the session.</p>
   <p>The app uses a recorded snapshot, not a live tracking feed. Container interiors are illustrative. Recommendations are deterministic demo rules, not an AI service. No real cargo is released.</p>
  </Panel>
 </div>
}
