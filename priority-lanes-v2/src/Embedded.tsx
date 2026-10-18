import { RulebookScreen } from './live/RulebookScreen.tsx'
import { useEffect, useState } from 'react'
import { useApp } from './state.tsx'
import { Dashboard } from './screens/Dashboard.tsx'
import { SimulationForecast, SimulationLearning, SimulationMethodology, SimulationSecurity } from './screens/SimulationDashboard.tsx'
import type { SimulationSnapshot } from './screens/SimulationDashboard.tsx'
import { Btn, Panel, Segmented } from './ui/primitives.tsx'
export const EMBEDDED = new URLSearchParams(location.search).get('porttable') === '1' && window.parent !== window
export function hostCommand(type:string, data:Record<string,unknown> = {}) { if(EMBEDDED)parent.postMessage({source:'priority-lanes',type,...data},location.origin) }
export function Embedded(){
 const app=useApp();const [snapshot,setSnapshot]=useState<SimulationSnapshot|null>(null)
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='porttable')return;if(e.data.type==='snapshot')setSnapshot(e.data.snapshot)};addEventListener('message',receive);hostCommand('ready');return()=>removeEventListener('message',receive)},[])
 const props=snapshot?{snapshot,command:hostCommand}:null
 return <div className="embedded-workspace">
  <div className="embedded-toolbar">
   <button className="context-link" onClick={()=>app.go('built')}>{snapshot?`${snapshot.name} · ${snapshot.total.toLocaleString()} containers · ${snapshot.time}`:'Loading simulation…'}</button>
   <details className="scenario-settings"><summary>Resources</summary><div className="scenario-settings-body">
    {app.screen==='gate'&&snapshot?.scenario==='priority'&&<><Segmented label="Planning mode" value={app.mode} onChange={app.setMode} options={[{value:'ordinary',label:'Ordinary'},{value:'disruption',label:'Disruption'}]}/><p>The Dashboard uses a separate mocked appointment schedule at 29 Oct, 07:30. Approved cargo actions feed the terminal; the forecast uses terminal time.</p></>}
    {snapshot&&<><p>{snapshot.yard} in yard · {snapshot.departed} exited</p><Btn onClick={()=>hostCommand('resources')}>{snapshot.gates} gates · {snapshot.workers} workers · {snapshot.hours} h — Edit</Btn></>}
    <p>Approved decisions affect future simulation activity. Source holds remain blocked.</p>
   </div></details>
   <Btn size="sm" onClick={()=>hostCommand('live')}>3D terminal →</Btn>
  </div>
  <main id="main" className="embedded-content">
   {!props?<p role="status">Loading simulation…</p>:<>
    {app.screen==='gate'&&(snapshot?.scenario==='priority'?<Dashboard/>:<Panel title="Dashboard"><p>The detailed appointment queue belongs to the 112-container Priority Lanes scenario. Your selected simulation is unchanged.</p><div className="simulation-actions"><Btn variant="primary" onClick={()=>app.go('forecast')}>View this simulation’s forecast</Btn><Btn onClick={()=>hostCommand('select-priority')}>Switch to Priority Lanes</Btn></div></Panel>)}
    {app.screen==='rulebook'&&(snapshot?.scenario==='priority'?<RulebookScreen terminalIntegration/>:<Panel title="Rulebook"><p>These rules apply to the Priority Lanes appointment queue.</p><Btn onClick={()=>hostCommand('select-priority')}>Switch to Priority Lanes</Btn></Panel>)}
    {app.screen==='forecast'&&<SimulationForecast {...props}/>}{app.screen==='security'&&<SimulationSecurity key={`${snapshot?.runId}`} {...props}/>}{app.screen==='learning'&&<SimulationLearning key={`${snapshot?.runId}`} {...props}/>}{app.screen==='built'&&<SimulationMethodology {...props}/>}
   </>}
  </main>
 </div>
}
