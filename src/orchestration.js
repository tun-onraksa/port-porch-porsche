// Guided teaching incident. Suggestions and inspection findings are deterministic mock data.
let guided={enabled:false,status:'idle',holdStart:12,holdIds:[],releaseStep:null,initialPlan:null,planChanges:[],disposition:null};
let decisionDraft={...currentPlan},orchestratorArea='berths',previewRun=null;
// Fictional evidence shared by the exception view and the 3D investigation.
const mockCargoException={reason:'The seal recorded at unloading does not match the original shipping manifest. A replacement-seal record has not yet been verified.',impact:'Truck and rail departure are blocked for the 12 affected containers. Other cleared cargo can continue moving.',check:'Compare the door seal with the updated packing list and replacement-seal record. Inspect for 30 modeled minutes, or accept the mock documents and release on approval.'};
function cargoHoldReasonMarkup(number=guided.holdIds[0]){
 const id=number||'SYN-1-001';
 return `<section class="cargo-hold-reason" aria-label="Cargo hold reason"><h3>Seal mismatch</h3><p>Door seals differ from the manifest. Replacement records are unverified; 12 containers are held.</p><details><summary>Seal evidence · mock</summary><dl><dt>Manifest</dt><dd>OLD-${esc(id)}</dd><dt>Door seal</dt><dd>DEMO-${esc(id)}</dd><dt>Flagged</dt><dd>08:00 · document check</dd></dl><p>Verify the replacement record. Inspect for 30 minutes, or accept the mock documents and release on approval.</p></details></section>`;

}
function simulationOptions(){return guided.enabled?{initialPlan:guided.initialPlan,planChanges:guided.planChanges,holdIds:guided.holdIds,holdStart:guided.holdStart,releaseStep:guided.releaseStep}:{};}
function cargoHeld(c,step=currentStep){return guided.enabled&&$('scenario').value==='stress'&&guided.holdIds.includes(c.number)&&step>=guided.holdStart&&(guided.releaseStep===null||step<guided.releaseStep);}
const orchestrationPage=document.querySelector('[data-page=orchestrator]');
const workbench=document.createElement('section');workbench.id='incidentWorkbench';orchestrationPage.prepend(workbench);
// A quiet live inspector keeps approved capacity separate from proposed decisions.
const decisionLink=document.createElement('aside');decisionLink.className='card padded decision-handoff';
decisionLink.innerHTML='<div class="panel-head"><h2>Operating plan</h2><span class="badge" id="liveShiftState"></span></div><p id="liveDiagnosis"></p><details class="resource-disclosure"><summary>Approved resources</summary><dl id="livePlanSummary" class="resource-summary"></dl></details><button class="button wide" data-go="orchestrator">Edit resources →</button><details class="demo-disclosure"><summary>Try a cargo conflict</summary><p>Seal mismatch · 12 containers · 08:00</p><button class="button" id="startConflictLive">Run conflict demo</button><small>Restarts with default resources and 1,000 containers.</small></details>';
document.querySelector('.live-grid').append(decisionLink);
function renderLiveSummary(){
 const {f}=operationState();$('liveShiftState').textContent=f.open?'Shift open':'Shift closed';
 const paused=typeof guided!=='undefined'&&guided.status==='paused';$('liveDiagnosis').hidden=!paused;$('liveDiagnosis').textContent=paused?'12 containers held. Review the seal evidence.':'';
 $('livePlanSummary').innerHTML=[['Berths',f.plan.berths+' available'],['Cranes',f.activeCranes+' supported / '+f.plan.cranes+' planned'],['Workers',f.plan.workers+' per shift'],['Operating day',f.plan.hours+' hours'],['Yard',f.yard+' / '+f.yardLimit+' slots'],['Truck gates',f.plan.gates+' lanes'],['Rail',f.plan.rail+' containers/h']].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
}
renderLiveSummary();
$('startConflictLive').onclick=startConflictDemo;
function startConflictDemo(){
 beginSimulationRun();
 guided={enabled:true,status:'armed',holdStart:12,holdIds:Array.from({length:12},(_,i)=>'SYN-1-'+String(i+1).padStart(3,'0')),releaseStep:null,initialPlan:{...DEFAULT_PLAN},planChanges:[],disposition:null};
 currentPlan={...DEFAULT_PLAN};currentRates={...DEFAULT_RATES};currentStep=0;decisionDraft={...currentPlan};$('scenario').value='stress';syncInputs();recalc();location.hash='live';playing=true;render();logAction('Started mocked seal-check conflict demo at 06:00');announce('Demo running. A mocked cargo alert will pause playback at 08:00.');renderOrchestrator();
}
function checkSimulationConflict(){if(!guided.enabled||$('scenario').value!=='stress'||guided.status!=='armed'||currentStep<guided.holdStart)return;currentStep=guided.holdStart;playing=false;guided.status='paused';decisionDraft={...currentPlan};orchestratorArea='cargo';logAction('08:00 · Mock seal mismatch: 12 containers held for review');renderOrchestrator();if(typeof showSceneConflict==='function')showSceneConflict();}
function draftOptions(){const opt=simulationOptions();return {...opt,initialPlan:opt.initialPlan||currentPlan,planChanges:[...(opt.planChanges||[]).filter(c=>c.step<currentStep),{step:currentStep,plan:{...decisionDraft}}],releaseStep:guided.status==='paused'?(guided.disposition==='release'?currentStep:guided.disposition==='inspect'?currentStep+3:null):opt.releaseStep};}
// Action cards edit the same draft used by the simulator and approval flow.
let decisionFineTuneOpen=false;
const decisionActionUndo={};
let decisionActionOwner=null;
function decisionActions(){return [
 {key:'gates',target:Math.max(currentPlan.gates,3),icon:'↗',title:currentPlan.gates<3?'Open '+(3-currentPlan.gates)+' more gate '+(3-currentPlan.gates===1?'lane':'lanes'):'Keep gate capacity',why:'Adds departure capacity when workers and cleared cargo are available.'},
 {key:'workers',target:Math.max(currentPlan.workers,32),icon:'+',title:currentPlan.workers<32?'Add '+(32-currentPlan.workers)+' workers per shift':'Keep staffing',why:'Supports gate lanes while keeping workers available for cranes.'},
 {key:'hours',target:Math.max(currentPlan.hours,20),icon:'◷',title:currentPlan.hours<20?'Extend operating hours':'Keep operating hours',why:'Gives cargo more time to move. Additional hours use successive crews.'}
 ];}
function decisionActionMarkup(){return `<div class="decision-action-heading"><b>Suggestions</b><span class="badge">Mock AI</span></div><div class="decision-actions">${decisionActions().map(a=>`<button type="button" class="decision-action" data-decision-action="${a.key}" aria-pressed="false"><span class="action-symbol" aria-hidden="true">${a.icon}</span><span><b>${a.title}</b><em data-action-change="${a.key}"></em></span><span class="action-check" aria-hidden="true">+</span></button>`).join('')}</div><details class="decision-fine-tune" ${decisionFineTuneOpen?'open':''}><summary>All resources</summary>${defs.map(([key,label,min,max,step,unit])=>`<div class="decision-edit-row"><label for="draft-${key}">${label.replace(/^(\d+ · |↳ )/,'')}</label><div class="decision-edit-values"><span>${currentPlan[key]} ${unit} →</span><div class="decision-stepper"><button type="button" data-draft-key="${key}" data-draft-delta="-${step}" aria-label="Decrease ${label.replace(/^(\d+ · |↳ )/,'')}">−</button><input id="draft-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${decisionDraft[key]}" aria-label="Proposed ${label.replace(/^(\d+ · |↳ )/,'')}"><button type="button" data-draft-key="${key}" data-draft-delta="${step}" aria-label="Increase ${label.replace(/^(\d+ · |↳ )/,'')}">+</button></div></div></div>`).join('')}</details><p class="decision-change-summary" id="decisionChanges" role="status" aria-live="polite"></p>`;}
function syncDecisionActions(){
 const actions=decisionActions();
 for(const a of actions){const b=document.querySelector(`[data-decision-action="${a.key}"]`);if(!b)continue;const selected=decisionDraft[a.key]===a.target&&a.target!==currentPlan[a.key],unit=defs.find(d=>d[0]===a.key)[5];b.setAttribute('aria-pressed',String(selected));b.disabled=a.target===currentPlan[a.key];b.querySelector('.action-check').textContent=selected?'✓':b.disabled?'—':'+';b.querySelector('em').textContent=`${currentPlan[a.key]} → ${a.target} ${unit}${selected?' · Added to draft':b.disabled?' · Already in current plan':''}`;}
 for(const[key,,min,max]of defs){document.querySelectorAll(`[data-draft-key="${key}"]`).forEach(b=>b.disabled=+b.dataset.draftDelta<0?decisionDraft[key]<=min:decisionDraft[key]>=max);}
 const changes=defs.filter(([key])=>decisionDraft[key]!==currentPlan[key]);$('decisionChanges').textContent=changes.length?changes.map(([key,label])=>`${label.replace(/^(\d+ · |↳ )/,'')}: ${currentPlan[key]} → ${decisionDraft[key]}`).join(' · '):'Resource quantities unchanged.';
}
function bindDecisionActions(){
 if(decisionActionOwner!==decisionDraft){for(const key in decisionActionUndo)delete decisionActionUndo[key];decisionActionOwner=decisionDraft;}
 document.querySelector('.decision-fine-tune').ontoggle=e=>{decisionFineTuneOpen=e.target.open;};
 function setValue(key,value){const def=defs.find(d=>d[0]===key);if(!Number.isFinite(value))return;decisionDraft[key]=Math.max(def[2],Math.min(def[3],Math.round(value/def[4])*def[4]));$('draft-'+key).value=decisionDraft[key];syncDecisionActions();renderDecisionPreview();}
 document.querySelectorAll('[data-decision-action]').forEach(b=>b.onclick=()=>{const a=decisionActions().find(a=>a.key===b.dataset.decisionAction);if(decisionDraft[a.key]===a.target)setValue(a.key,decisionActionUndo[a.key]??currentPlan[a.key]);else{decisionActionUndo[a.key]=decisionDraft[a.key];setValue(a.key,a.target);}});
 document.querySelectorAll('[data-draft-key]').forEach(b=>b.onclick=()=>setValue(b.dataset.draftKey,decisionDraft[b.dataset.draftKey]+Number(b.dataset.draftDelta)));
 for(const[key]of defs){const input=$('draft-'+key);input.oninput=()=>{if(input.value!=='')setValue(key,Number(input.value));};input.onchange=()=>{if(input.value==='')input.value=decisionDraft[key];};}
 syncDecisionActions();
}
function renderOrchestrator(){
 if(!workbench)return;const focusedArea=document.activeElement?.dataset.orchestratorArea;const f=currentRun.frames[currentStep],held=currentRun.containers.filter(c=>cargoHeld(c)&&c.dischargeStep!==null&&c.dischargeStep<=currentStep&&(c.exitStep===null||c.exitStep>currentStep));
 const incident=guided.status==='paused'&&$('scenario').value==='stress';
 const groups=[['cargo','Cargo exception',incident?'12 flagged containers':guided.enabled?'Demo '+guided.status:'No active incident'],['berths','Berths & cranes',`${f.waiting} ships queued · ${f.activeCranes} supported cranes`],['yard','Yard & release',`${f.yard} / ${f.yardLimit} slots used`],['gate','Truck gate',`${f.truckOut} containers exited`],['rail','Rail',`${f.railOut} containers exited`],['workforce','People & hours',`${f.plan.workers} workers · ${f.plan.hours} hours`]];
 workbench.innerHTML=`<div class="workbench-context"><span class="badge blue">${incident?'Paused':'Effective'} ${clockOf(currentStep)}</span><button class="text-button" id="startConflict">Run conflict demo</button></div>${incident?`<div class="incident-alert" role="alert"><span class="badge amber">Playback paused · mock conflict</span><h2 id="incidentTitle" tabindex="-1">12 containers held</h2><p>Manifest and door seals differ. Inspect or release before resuming.</p></div>`:guided.enabled?`<div class="source-banner"><div><b>Demo status: ${esc(guided.status)}</b> · ${guided.releaseStep!==null?'Mock release scheduled at '+clockOf(guided.releaseStep):'Mock alert scheduled at 08:00'} · ${held.length} held containers currently in the yard</div></div>`:''}<nav class="operation-list" aria-label="Inspect an operation">${groups.map(([id,title,sub])=>`<button class="operation-item ${orchestratorArea===id?'selected':''}" data-orchestrator-area="${id}" aria-pressed="${orchestratorArea===id}"><b>${title}</b><small>${sub}</small></button>`).join('')}</nav><div class="orchestration-layout"><section class="card padded" id="orchestratorDetail" aria-label="Selected operation"></section><section class="card padded draft-panel"><div class="panel-head"><h2>Resources</h2><span class="badge blue">Draft</span></div><form id="decisionForm">${decisionActionMarkup()}<div class="approval-area"><div id="decisionPreview"></div><button class="button primary wide" type="submit">${incident?'Approve & resume simulation':'Approve resource plan'}</button><button class="button wide" type="button" id="discardDraft">Discard draft</button><p class="muted" id="decisionError" role="status"></p></div></form></section></div>`;
 $('startConflict').onclick=startConflictDemo;
 workbench.querySelectorAll('[data-orchestrator-area]').forEach(b=>b.onclick=()=>{orchestratorArea=b.dataset.orchestratorArea;renderOrchestrator();});
 bindDecisionActions();
 $('discardDraft').onclick=()=>{decisionDraft={...currentPlan};for(const key in decisionActionUndo)delete decisionActionUndo[key];renderOrchestrator();};
 $('decisionForm').onsubmit=e=>{e.preventDefault();if(incident&&!guided.disposition){$('decisionError').textContent='Choose Inspect cargo or Release cargo before approving.';return;}
 const proposed=draftOptions();if(!guided.enabled){guided={...guided,enabled:true,status:'plan only',initialPlan:{...currentPlan},holdIds:[],holdStart:144,planChanges:[]};}
 guided.planChanges=proposed.planChanges;guided.initialPlan=proposed.initialPlan;if(incident){guided.releaseStep=proposed.releaseStep;guided.status='approved';}
 currentPlan={...decisionDraft};syncInputs();recalc();logAction((incident?'Approved '+guided.disposition+' disposition and resource plan':'Approved resource plan')+' effective '+clockOf(currentStep));renderOrchestrator();if(incident){location.hash='live';playing=true;render();}announce('Plan approved from '+clockOf(currentStep)+'.'+(incident?' Simulation resumed.':''));};
 renderOrchestratorDetail(incident);renderDecisionPreview();if(focusedArea)workbench.querySelector(`[data-orchestrator-area="${focusedArea}"]`)?.focus({preventScroll:true});
}
function renderDecisionPreview(){previewRun=simulate(decisionDraft,currentRates,$('scenario').value==='stress',draftOptions());const delta=previewRun.cost-currentRun.cost;$('decisionPreview').innerHTML=`<div class="draft-preview"><small>Day estimate</small><strong>${money(previewRun.cost)}</strong><span>${delta>=0?'+':'−'}${money(Math.abs(delta))} vs approved</span><b>${previewRun.backlog} remaining · ${previewRun.departed} exited</b></div>`;}
function renderOrchestratorDetail(incident){
 const f=currentRun.frames[currentStep],p=f.plan,cargos=currentRun.containers.filter(c=>guided.holdIds.includes(c.number));
 const rows=entries=>'<dl>'+entries.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('')+'</dl>';
 let detail='';
 if(orchestratorArea==='cargo')detail=incident||guided.holdIds.length?`<span class="badge amber">Mock document exception</span><h2>Seal reference mismatch</h2><p>Synthetic call 1 · ${cargos.length} containers.</p>${cargoHoldReasonMarkup()}${rows([['Current simulation time',clockOf(currentStep)],['Inspection duration','30 modeled minutes'],['Affected route','Import yard → truck / rail']])}<div class="disposition-options"><button class="button ${guided.disposition==='inspect'?'primary':''}" id="inspectHeld" ${!incident?'disabled':''}>Inspect cargo · 30 min</button><button class="button ${guided.disposition==='release'?'primary':''}" id="releaseHeld" ${!incident?'disabled':''}>Release cargo · now</button></div><p class="muted">${guided.disposition==='inspect'?'Selected: inspect, then release after 30 modeled minutes.':guided.disposition==='release'?'Selected: accept the mocked documents and release on approval.':'Select an action, then approve.'}</p><div class="held-cargo-list">${cargos.map(c=>`<button class="held-cargo" data-inspect-order="${c.number}"><b>${c.number}</b><small>${cargoHeld(c)?'Held for decision':'Released / pending arrival'} · inspect record →</small></button>`).join('')}</div>`:`<h2>No active hold</h2><p>Run a demo to investigate held cargo.</p><button class="button primary" id="detailStartDemo">Run conflict demo</button>`;
 if(orchestratorArea==='berths')detail=`<h2>Berths & crane capacity</h2>${rows([['Available berths',p.berths],['Scheduled cranes',p.cranes],['Staff-supported cranes',f.activeCranes],['Ships waiting',f.waiting],['Containers still on ships',f.remaining.reduce((a,b)=>a+b,0)]])}<p>2 cranes per berth · 8 workers per crane.</p>`;
 if(orchestratorArea==='yard')detail=`<h2>Yard storage & release</h2>${rows([['Storage area',p.yardAcres+' acres'],['Inventory / capacity',f.yard+' / '+f.yardLimit],['Release assumption',currentRates.releaseHours+' hours'],['Exception cargo held',cargos.filter(c=>cargoHeld(c)).length]])}<p>A full yard stops unloading.</p>`;
 if(orchestratorArea==='gate')detail=`<h2>Truck-gate capacity</h2>${rows([['Configured lanes',p.gates],['Staffed lanes',Math.min(p.gates,Math.floor(p.workers/2))],['Rate per lane',currentRates.gateProductivity+' containers / h'],['Truck exits so far',f.truckOut]])}<p>2 workers per lane · truck departures before rail.</p>`;
 if(orchestratorArea==='rail')detail=`<h2>Rail transfer</h2>${rows([['Configured capacity',p.rail+' containers / h'],['Staffing requirement','2 workers after gate staffing'],['Rail exits so far',f.railOut],['Train-equivalent cost',money(currentRates.trainCost)+' / 100 containers used']])}<p>Hourly capacity model; no train timetable.</p>`;
 if(orchestratorArea==='workforce')detail=`<h2>Workers & operating hours</h2>${rows([['Workers per shift',p.workers],['Operating hours',p.hours],['Shift status',f.open?'Open':'Closed'],['Loaded wage assumption',money(currentRates.workerHour)+' / worker-hour']])}<p>Staffing order: gates → rail → cranes. Longer hours use successive crews.</p>`;
 $('orchestratorDetail').innerHTML=detail;
 if(orchestratorArea!=='cargo'){
  $('orchestratorDetail').insertAdjacentHTML('beforeend','<div class="ops-actions"><button class="button" id="viewOperation3D">View in 3D</button><button class="text-button" id="editOperationResources">Adjust related resources →</button></div>');
  $('viewOperation3D').onclick=()=>{location.hash='live';inspectOperation(orchestratorArea==='workforce'?'overview':orchestratorArea);};
  $('editOperationResources').onclick=()=>{const keys={berths:'berths',yard:'yardAcres',gate:'gates',rail:'rail',workforce:'workers'};decisionFineTuneOpen=true;document.querySelector('.decision-fine-tune').open=true;$('draft-'+keys[orchestratorArea]).focus();};
 }
 if($('inspectHeld'))$('inspectHeld').onclick=()=>{guided.disposition='inspect';renderOrchestrator();};if($('releaseHeld'))$('releaseHeld').onclick=()=>{guided.disposition='release';renderOrchestrator();};if($('detailStartDemo'))$('detailStartDemo').onclick=startConflictDemo;
 workbench.querySelectorAll('[data-inspect-order]').forEach(b=>b.onclick=()=>openContainer(b.dataset.inspectOrder));
}
const previousWorkspaceRender=renderWorkspace;
renderWorkspace=function(){previousWorkspaceRender();if(activePage==='orchestrator')renderOrchestrator();};
$('scenario').addEventListener('change',()=>{orchestratorArea='berths';guided={...guided,enabled:false,status:'idle',holdIds:[],planChanges:[],disposition:null};decisionDraft={...currentPlan};recalc();renderOrchestrator();});

renderOrchestrator();
// Surface the same hold in every cargo view.
modelStatus.held='Held for review';
const originalBoardOrders=boardOrders;
boardOrders=function(){return originalBoardOrders().map(c=>cargoHeld(c)&&c.dischargeStep!==null&&c.dischargeStep<=currentStep&&(c.exitStep===null||c.exitStep>currentStep)?{...c,current_status:'held',available_for_pickup:false}:c);};
window.addEventListener('hashchange',()=>window.scrollTo(0,0));
const normalPlay=$('playBtn').onclick;
$('playBtn').onclick=()=>{if(guided.enabled&&guided.status==='paused'){playing=false;if(typeof showSceneConflict==='function')showSceneConflict();return;}normalPlay();};
