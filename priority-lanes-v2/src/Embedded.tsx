import { useEffect, useState } from 'react'
import { useApp } from './state.tsx'
import { PreArrival } from './screens/PreArrival.tsx'
import { GateCommand } from './screens/GateCommand.tsx'
import { BoxDetail } from './screens/BoxDetail.tsx'
import { GateForecast } from './screens/GateForecast.tsx'
import { Drill } from './screens/Drill.tsx'
import { Security } from './screens/Security.tsx'
import { Learning } from './screens/Learning.tsx'
import { HowBuilt } from './screens/HowBuilt.tsx'
import { Btn, Segmented } from './ui/primitives.tsx'
export const EMBEDDED = new URLSearchParams(location.search).get('porttable') === '1' && window.parent !== window
export function hostCommand(type:string, data:Record<string,unknown> = {}) { if(EMBEDDED)parent.postMessage({source:'priority-lanes',type,...data},location.origin) }
type Snapshot = {time:string; total:number; departed:number; yard:number; backlog:number; cost:number; gates:number; workers:number; hours:number; scenario:string}
export function Embedded(){
 const app=useApp();const [snapshot,setSnapshot]=useState<Snapshot|null>(null)
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='porttable')return;if(e.data.type==='snapshot')setSnapshot(e.data.snapshot)};addEventListener('message',receive);hostCommand('ready');return()=>removeEventListener('message',receive)},[])
 const selected=app.evalById(app.boxId)?.box
 return <div className="embedded-workspace">
  <div className="embedded-toolbar"><span><b>Priority Lanes</b><small>Decision forecasts · mocked Oct 29 gate operations</small></span><Segmented label="Planning mode" value={app.mode} onChange={app.setMode} size="sm" options={[{value:'ordinary',label:'Ordinary'},{value:'disruption',label:'Disruption'},{value:'drill',label:'Drill'}]}/><Segmented label="Evidence view" value={app.view} onChange={app.setView} size="sm" options={[{value:'ops',label:'Operations'},{value:'security',label:'Security'}]}/><Btn size="sm" onClick={()=>hostCommand('live')}>Open 3D simulation →</Btn></div>
  <div className="embedded-context"><span><b>Shared cargo · {snapshot?.total??112} containers</b> · 4 recorded identities + 108 synthetic records. All post-arrival evidence is mocked.</span><span>Gate forecasts use the 07:30 cargo snapshot with your approved gates, staffing and hours. Simulation status is shown above. Delay charges and terminal operating costs are separate estimates.</span><details><summary>How approvals affect the simulation</summary><p>Approvals apply from the current simulation time. Priority cargo moves ahead; Slow delays pickup; Reroute needs rail capacity. Inspect and Hold block departure until you change the action. Source holds remain blocked. Decisions last for this session; drill decisions stay in rehearsal.</p></details></div>
  {snapshot&&<div className="embedded-stats"><div><small>Simulation clock</small><b>{snapshot.time}</b></div><div><small>In yard / exited</small><b>{snapshot.yard} / {snapshot.departed}</b></div><div><small>Projected remaining</small><b>{snapshot.backlog}</b></div><div><small>Terminal operating cost</small><b>{snapshot.cost.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}</b></div><button onClick={()=>hostCommand('resources')}><small>Approved resource plan ↗</small><b>{snapshot.gates} gates · {snapshot.workers} workers · {snapshot.hours} h</b></button></div>}
  {app.mode==='drill'&&<p className="embedded-notice">Rehearsal only: drill actions do not change the terminal simulation.</p>}
  {app.screen==='box'&&selected&&<div className="embedded-inspect"><span><b>{selected.number}</b> · same container in the order board and 3D yard</span><Btn onClick={()=>hostCommand('inspect',{number:selected.number})}>Inspect this cargo in 3D →</Btn></div>}
  <main id="main" className="embedded-content">
   {app.screen==='radar'&&<PreArrival/>}{app.screen==='gate'&&<GateCommand/>}{app.screen==='box'&&<BoxDetail/>}{app.screen==='forecast'&&<GateForecast/>}{app.screen==='drill'&&<Drill/>}{app.screen==='security'&&<Security/>}{app.screen==='learning'&&<Learning/>}{app.screen==='built'&&<HowBuilt/>}
  </main>
 </div>
}
