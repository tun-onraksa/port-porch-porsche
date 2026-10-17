// Read-only operational inspection, derived from the same simulation as the board.
let operationsReady=true,operationFocus='overview',selectedBerth=0,selectedCargo=null;
const focusNames={overview:'Terminal overview',berths:'Berth operations',yard:'Yard inventory',gate:'Truck departures',rail:'Rail departures'};
function inspectOperation(type,id){
 operationFocus=type==='ship'||type==='berth'?'berths':type==='container'?'yard':type;
 if(!focusNames[operationFocus])operationFocus='overview';
 if(type==='berth')selectedBerth=id;
 if(type==='ship'){const b=currentRun.frames[currentStep].berth.indexOf(id);selectedBerth=b>=0?b:0;}
 selectedCargo=type==='container'?id:null;
 document.querySelectorAll('[data-focus]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.focus===operationFocus)));
 if(window.focusPort)window.focusPort(operationFocus,type,id);
 renderOperations();
}
document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>inspectOperation(b.dataset.focus));
function operationState(){
 const f=currentRun.frames[currentStep],p=f.plan,prev=currentRun.frames[Math.max(0,currentStep-1)];
 const inventory=currentRun.containers.filter(c=>c.dischargeStep!==null&&c.dischargeStep<=currentStep&&(c.exitStep===null||c.exitStep>currentStep));
 const ready=inventory.filter(c=>(c.preDischarged||currentStep-c.dischargeStep>=currentRates.releaseHours*6)&&!(typeof cargoHeld==='function'&&cargoHeld(c)));
 const moves=currentRun.containers.filter(c=>c.dischargeStep===currentStep);
 const exits=currentRun.containers.filter(c=>c.exitStep===currentStep);
 const remaining=f.remaining.reduce((a,b)=>a+b,0);
 const gateLanes=Math.min(p.gates,Math.floor(p.workers/2));
 const railStaffed=p.rail>0&&p.workers>=p.gates*2+2;
 let reason='Cargo is moving through the terminal.';
 if(remaining+f.yard===0)reason='All scenario cargo has exited the terminal.';
 else if(!f.open)reason='The operating shift is closed. Extend operating hours to continue handling cargo.';
 else if(remaining&&p.berths===0)reason='No berth is available. Enable a berth to unload ships.';
 else if(remaining&&f.activeCranes===0)reason='No crane is supported by the current equipment and staffing plan.';
 else if(remaining&&f.yard>=f.yardLimit)reason='Yard storage is full. More storage or faster departures can unblock unloading.';
 else if(f.yard&&gateLanes===0&&!railStaffed)reason='There is no staffed departure capacity. Cargo cannot leave the yard.';
 else if(f.yard&&!ready.length)reason='Yard cargo is waiting for the assumed release lag to elapse.';
 else if(f.waiting)reason='Ships are waiting for an available berth. Inspect berth occupancy below.';
 return {f,prev,inventory,ready,moves,exits,remaining,gateLanes,railStaffed,reason};
}
function renderOperations(){
 const host=$('operationsInspector');if(!host)return;
 const s=operationState(),{f,inventory,ready,moves,exits}=s,p=f.plan;
 const stat=(label,value)=>`<div><small>${label}</small><strong>${value}</strong></div>`;
 const cargoRows=items=>items.slice(0,40).map(c=>`<tr><td><button class="text-button" data-inspect-cargo="${esc(c.number)}">${esc(c.number)}</button></td><td>${esc(currentRun.ships[c.shipIndex].name)}</td><td>${clockOf(c.dischargeStep)}</td><td>${c.exitStep!==null&&c.exitStep<=currentStep?c.exitMode+' · '+clockOf(c.exitStep):typeof cargoHeld==='function'&&cargoHeld(c)?'Held for review':ready.includes(c)?'Ready (assumed)':'Release lag'}</td></tr>`).join('');
 let content='';
 if(operationFocus==='overview')content=`<div class="ops-stats">${stat('On ships',s.remaining)}${stat('In yard',f.yard)}${stat('Exited',f.departed)}${stat('Ships queued',f.waiting)}</div><p class="ops-diagnosis">${esc(s.reason)}</p><div class="ops-stats">${stat('Unloaded / last 10 min',moves.length)}${stat('Truck exits / last 10 min',f.truckOut-s.prev.truckOut)}${stat('Rail exits / last 10 min',f.railOut-s.prev.railOut)}</div><p class="muted">Select an area above or click equipment in the scene. The 3D layout is schematic; the counts come from the simulation.</p>`;
 if(operationFocus==='berths'){
 content=`<div class="ops-stats">${stat('Scheduled cranes',p.cranes)}${stat('Supported by staff & berths',f.activeCranes)}${stat('Unloaded / last 10 min',moves.length)}</div><p class="ops-diagnosis">${esc(s.reason)}</p><div class="berth-inspections">${[0,1,2,3].map(b=>{const ship=f.berth[b],enabled=b<p.berths;return `<button class="berth-inspection ${selectedBerth===b?'selected':''}" data-inspect-berth="${b}" aria-pressed="${selectedBerth===b}"><b>Berth ${b+1}</b><span>${!enabled?'Inactive':ship<0?'Available':currentRun.ships[ship].name}</span><small>${ship>=0?f.remaining[ship]+' containers on ship':enabled?'No vessel alongside':'Enable more berths to use'}</small></button>`;}).join('')}</div><h3>Vessel calls</h3><div class="ops-table"><table><thead><tr><th>Vessel</th><th>Arrival</th><th>Remaining</th><th>State</th></tr></thead><tbody>${currentRun.ships.map((sh,i)=>`<tr><td>${esc(sh.name)}</td><td>${clockOf(sh.arrival)}</td><td>${f.remaining[i]} / ${sh.boxes}</td><td>${currentStep<sh.arrival?'Scheduled':!f.remaining[i]?'Discharge complete':f.berth.includes(i)?'Alongside':'Waiting'}</td></tr>`).join('')}</tbody></table></div><p class="muted">Crane capacity is pooled across occupied berths, capped at two per occupied berth. Positions show scheduled equipment; recent discharge controls working motion.</p>`;
 }
 if(operationFocus==='yard'){
 const c=selectedCargo&&inventory.find(c=>c.number===selectedCargo);
 content=`<div class="ops-stats">${stat('Stored / capacity',f.yard+' / '+f.yardLimit)}${stat('Ready under release assumption',ready.length)}${stat('Waiting for release lag',inventory.length-ready.length)}</div><progress max="${Math.max(1,f.yardLimit)}" value="${f.yard}" aria-label="Yard occupancy"></progress><p class="ops-diagnosis">${esc(s.reason)}</p>${c?`<div class="notice-box"><b>Selected: ${esc(c.number)}</b> · ${esc(currentRun.ships[c.shipIndex].name)} · discharged ${clockOf(c.dischargeStep)} · ${ready.includes(c)?'Ready under release assumption':'Waiting for release lag'}</div>`:''}<p class="muted">Blue stacks: waiting for release. Green stacks: ready under the model assumption. Amber stacks: held for review. Up to 252 individual containers are drawn; counts include all cargo. Geometry is not an acreage map.</p><div class="ops-table"><table><thead><tr><th>Container</th><th>Vessel</th><th>Discharged</th><th>Modeled state</th></tr></thead><tbody>${cargoRows(inventory)||'<tr><td colspan="4">No containers in the yard at this time.</td></tr>'}</tbody></table></div><p class="muted">${inventory.length>40?'First 40 of '+inventory.length+' containers. ':''}Full scenario inventory is available on the order board.</p>`;
 }
 if(operationFocus==='gate'||operationFocus==='rail'){
 const rail=operationFocus==='rail',mode=rail?'Rail':'Truck',items=currentRun.containers.filter(c=>c.exitMode===mode&&c.exitStep<=currentStep&&c.exitStep!==null).sort((a,b)=>b.exitStep-a.exitStep);
 const capacity=rail?(s.railStaffed?p.rail:0):s.gateLanes*currentRates.gateProductivity;
 content=`<div class="ops-stats">${stat(rail?'Configured capacity / hour':'Configured lanes',rail?p.rail:p.gates)}${stat('Staff-supported capacity / hour',capacity)}${stat('Exited by '+mode.toLowerCase(),items.length)}</div><p class="ops-diagnosis">${!f.open?'Shift closed: no departures.':!capacity?'No staffed capacity on this departure route.':!ready.length?'No cargo is currently ready and waiting for pickup.':rail&&s.gateLanes?'Truck gates take ready cargo first; rail uses remaining ready cargo.':'Ready cargo can exit through this route.'}</p><h3>Recent ${mode.toLowerCase()} exits</h3><div class="ops-table"><table><thead><tr><th>Container</th><th>Vessel</th><th>Exit time</th></tr></thead><tbody>${items.slice(0,20).map(c=>`<tr><td>${esc(c.number)}</td><td>${esc(currentRun.ships[c.shipIndex].name)}</td><td>${clockOf(c.exitStep)}</td></tr>`).join('')||'<tr><td colspan="3">No departures through this route yet.</td></tr>'}</tbody></table></div><p class="muted">${rail?'Rail capacity is modeled continuously, not as a real train timetable.':'Truck movement represents the latest ten-minute batch, up to 12 vehicles drawn.'} No inland delivery is simulated.</p>`;
 }
 host.innerHTML=`<div class="panel-head"><h2>${focusNames[operationFocus]}</h2><span class="badge">${clockOf(currentStep)} · ${f.open?'Shift open':'Shift closed'}</span></div>${content}<div class="ops-actions"><button class="button" id="stepBack" ${currentStep===0?'disabled':''}>← 10 minutes</button><button class="button" id="stepForward" ${currentStep===144?'disabled':''}>10 minutes →</button><button class="text-button" data-go="orders">Open order board →</button></div>`;
 host.querySelectorAll('[data-inspect-berth]').forEach(b=>b.onclick=()=>inspectOperation('berth',+b.dataset.inspectBerth));
 host.querySelectorAll('[data-inspect-cargo]').forEach(b=>b.onclick=()=>inspectOperation('container',b.dataset.inspectCargo));
 for(const [id,delta]of [['stepBack',-1],['stepForward',1]])$(id).onclick=()=>{playing=false;currentStep=Math.max(0,Math.min(144,currentStep+delta));render();if(typeof renderLiveFlow==='function')renderLiveFlow();$(id).focus();};
}
renderOperations();
