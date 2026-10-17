// Shared workspace adapter for Priority Lanes V2 and the terminal simulation.
// Only exact-origin messages from our dashboard frame may edit this mock scenario.
const priorityPages={radar:['Pre-arrival radar','Paperwork & source data'],gate:['Gate command','Queue & decision statistics'],box:['Cargo evidence','Four stories, one box'],forecast:['Gate forecast','Demand & capacity'],drill:['Disruption drills','Rehearse a response'],security:['Security review','Conflicting source evidence'],learning:['Learning log','Outcomes & reliability'],built:['Data & methodology','Sources & model assumptions'],rulebook:['Rulebook','Your priority rules']}; // PortAble kit: + rulebook
let priorityActions=[],priorityDecisionSignature='',priorityForecast=null,priorityLog=[],prioritySelectedNumber=PRIORITY_CARGO.find(c=>c.id==='sim-0001')?.number||PRIORITY_CARGO[4].number;
let priorityReady=false;
const priorityPane=document.createElement('section');priorityPane.id='priorityDashboard';priorityPane.hidden=true;priorityPane.innerHTML='<iframe id="priorityFrame" title="Priority Lanes operational dashboards" src="priority-lanes-v2/priority-lanes.html?porttable=1#gate"></iframe>';$('main').append(priorityPane);
const priorityFrame=$('priorityFrame');
for(const[key,[label,sub]]of Object.entries(priorityPages))pageInfo['p-'+key]=[label,'PRIORITY LANES',sub];
const group=document.createElement('div');group.className='nav-group-label';group.textContent='Decision intelligence';$('navigation').append(group);
for(const[key,[label]]of Object.entries(priorityPages))$('navigation').insertAdjacentHTML('beforeend',`<a href="#p-${key}" data-page-link="p-${key}">${icon(key==='gate'?'orders':key==='forecast'?'live':key==='box'?'zones':'ledger')}<span>${label}</span></a>`);
function sendPriority(type,data={}){priorityFrame.contentWindow?.postMessage({source:'porttable',type,...data},location.origin);}
function prioritySnapshot(){const f=currentRun.frames[currentStep];return {time:clockOf(currentStep),total:currentRun.total,departed:f.departed,yard:f.yard,backlog:currentRun.backlog,cost:currentRun.cost,gates:currentPlan.gates,workers:currentPlan.workers,hours:currentPlan.hours,gateProductivity:currentRates.gateProductivity,scenario:$('scenario').value};}
const priorSimulationOptions=simulationOptions;
simulationOptions=function(){return {...priorSimulationOptions(),...($('scenario').value==='priority'?{priorityCargo:PRIORITY_CARGO,cargoActions:priorityActions}:{})};};
const priorCargoHeld=cargoHeld;
cargoHeld=function(c,step=currentStep){if($('scenario').value!=='priority')return priorCargoHeld(c,step);const data=PRIORITY_CARGO.find(b=>b.number===c.number),action=priorityActions.filter(a=>a.number===c.number&&a.step<=step).at(-1);return !!data?.blocked||!!action&&(['hold','inspect','close'].includes(action.key)||action.readyStep>step);};
const priorBoardOrders=boardOrders;
boardOrders=function(){const records=priorBoardOrders();if($('scenario').value!=='priority')return records;return records.map(c=>{const data=PRIORITY_CARGO.find(b=>b.number===c.number);return {...c,priorityCargo:true,sourceIdentity:data.real,cargo:data.cargo,equipment_type:data.equipment_type,pod_terminal_name:'Modeled terminal · Priority Lanes',pod_eta_at:'Before shift',current_status:c.current_status!=='exited'&&cargoHeld(c)?'held':c.current_status};});};
const priorityBaseRenderOrders=renderOrders;
renderOrders=function(){priorityBaseRenderOrders();if($('scenario').value!=='priority')return;
 document.querySelector(boardPartSelectors[0]).innerHTML='<b>Priority Lanes · shared 112-container scenario.</b> Four recorded identities and 108 synthetic containers. Post-arrival status, holds and sensor readings are mocked. All 112 begin in the yard at 06:00; approvals affect future simulation intervals.';
 document.querySelector('.shipment-summary h2').textContent='Priority Lanes shift';document.querySelector('.shipment-summary p').textContent='112 containers already discharged · '+currentRun.ships.length+' source vessel calls';
 document.querySelector('[data-page="orders"] .attention').innerHTML='<div><span class="badge blue">Connected decisions</span><h3>Inspect the evidence before acting</h3><p>Gate Command approvals update this scenario. Source holds remain blocked; releasing an operational flag does not clear a customs hold.</p></div><button class="button" data-go="p-gate">Open Gate Command →</button>';
};
const priorOpenContainer=openContainer;
openContainer=function(number){priorOpenContainer(number);if($('scenario').value==='priority'&&$('orderDialog').open){const data=PRIORITY_CARGO.find(b=>b.number===number);const link=document.createElement('div');link.className='detail-section';link.innerHTML=`<p><b>${esc(data.cargo)}</b> · ${data.real?'Recorded identity, simulated operational state':'Synthetic cargo'}</p><p>${esc(data.holdReason||'No blocking discrepancy in the mocked records.')}</p><button class="button" id="openPriorityEvidence">Compare source evidence →</button>`;$('orderDetail').prepend(link);$('openPriorityEvidence').onclick=()=>{$('orderDialog').close();prioritySelectedNumber=number;location.hash='p-box';sendPriority('route',{screen:'box',boxId:data.id});};}};
function ensurePriorityScenario(){if($('scenario').value==='priority')return;closeCargoInspection(false);playing=false;currentStep=0;$('scenario').value='priority';$('scenario').dispatchEvent(new Event('change'));}
function showPriorityPage(){const active=activePage.startsWith('p-');priorityPane.hidden=!active;document.querySelector('.page-heading').hidden=active;document.body.classList.toggle('priority-page',active);if(!active)return;ensurePriorityScenario();sendPriority('route',{screen:activePage.slice(2),boxId:PRIORITY_CARGO.find(c=>c.number===prioritySelectedNumber)?.id});sendPriority('snapshot',{snapshot:prioritySnapshot()});}
window.addEventListener('hashchange',showPriorityPage);
const priorityRenderWorkspace=renderWorkspace;
renderWorkspace=function(){priorityRenderWorkspace();if($('scenario').value==='priority'){
 $('scenarioNote').textContent='Priority Lanes: 112 containers already in the yard. Post-arrival evidence and decisions are mocked. Operating costs use the approved resource plan.';
 if(activePage==='ledger'){
  $('dataLedger').innerHTML=$('dataLedger').innerHTML.replace('4 source containers','112 Priority Lanes containers · already in yard');
  if(priorityForecast)$('ledgerFlow').insertAdjacentHTML('beforeend',`<div class="notice-box"><b>Gate decision forecast · separate cost scope</b><p>${money(priorityForecast.cost)} projected delay / handling charges under Shannon’s 07:30 gate assumptions; ${money(priorityForecast.baseline)} under a blanket hold. These estimates are not added to terminal operating expenses.</p><button class="button" data-go="p-gate">Review gate statistics →</button></div>`);
 }
 if(activePage==='orchestrator'&&priorityLog.length)$('activityLog').insertAdjacentHTML('afterbegin','<h3>Gate decisions</h3>'+priorityLog.slice(0,8).map(e=>`<p>${esc(e.text)}</p>`).join(''));
 }
 if(priorityReady&&activePage.startsWith('p-'))sendPriority('snapshot',{snapshot:prioritySnapshot()});
};
const priorityOrchestratorDetail=renderOrchestratorDetail;
renderOrchestratorDetail=function(incident){priorityOrchestratorDetail(incident);if($('scenario').value!=='priority'||orchestratorArea!=='cargo')return;const c=PRIORITY_CARGO.find(c=>c.number===prioritySelectedNumber)||PRIORITY_CARGO[4];$('orchestratorDetail').innerHTML=`<span class="badge amber">Priority Lanes · mock evidence</span><h2>${esc(c.number)}</h2><p>${esc(c.cargo)}</p><section class="cargo-hold-reason"><h3>${c.blocked?'Why this cargo is held':'Cargo review'}</h3><p>${esc(c.holdReason||'No blocking discrepancy in the mocked records.')}</p><p><b>Recommended action:</b> ${esc(c.recommendedAction)}. Inspect the source comparison before approving a gate action.</p><small>Post-arrival evidence is invented. Binding source holds remain in force in the simulator.</small></section><div class="ops-actions"><button class="button" id="priorityEvidence">Review source evidence</button><button class="button" id="priorityInspect">Inspect cargo in 3D</button></div>`;$('priorityEvidence').onclick=()=>{location.hash='p-box';sendPriority('route',{screen:'box',boxId:c.id});};$('priorityInspect').onclick=()=>openCargoInspection(c.number,'orchestrator');};
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==priorityFrame.contentWindow||event.data?.source!=='priority-lanes')return;const message=event.data;
 if(message.type==='ready'){priorityReady=true;showPriorityPage();return;}
 if(message.type==='route'&&priorityPages[message.screen]){if(priorityPane.hidden)return;if(message.boxId){const b=PRIORITY_CARGO.find(c=>c.id===message.boxId);if(b)prioritySelectedNumber=b.number;}if(location.hash!=='#p-'+message.screen)location.hash='p-'+message.screen;return;}
 if(message.type==='inspect'){const c=PRIORITY_CARGO.find(c=>c.number===message.number);if(!c)return;ensurePriorityScenario();prioritySelectedNumber=c.number;openCargoInspection(c.number,'p-box');return;}
 if(message.type==='live'||message.type==='resources'){ensurePriorityScenario();location.hash=message.type==='live'?'live':'orchestrator';return;}
 if(message.type!=='decisions'||!Array.isArray(message.approvals)||!['ordinary','disruption'].includes(message.mode))return;
 priorityForecast=message.forecast;priorityLog=Array.isArray(message.log)?message.log:[];
 const signature=JSON.stringify([message.mode,message.approvals]);if(signature===priorityDecisionSignature){if(priorityReady&&activePage.startsWith('p-'))sendPriority('snapshot',{snapshot:prioritySnapshot()});return;}priorityDecisionSignature=signature;
 if($('scenario').value!=='priority')return;
 const approved=new Map(message.approvals.map(a=>[a.number,a]));
 for(const c of PRIORITY_CARGO){const a=approved.get(c.number),key=a&&a.state!=='rejected'?a.key:'rejected';if(!['release','watch','flag','slow','reroute','inspect','hold','close','rejected'].includes(key))continue;const last=priorityActions.filter(x=>x.number===c.number).at(-1);if((last?.key||'rejected')===key)continue;
 const readyStep=key==='slow'?Math.max(currentStep,Math.ceil(((a?.readyAt||new Date('2026-10-29T21:00:00Z').getTime())-new Date('2026-10-29T13:00:00Z').getTime())/600000)):currentStep;
 priorityActions.push({number:c.number,key,step:currentStep,readyStep});logAction(`Gate decision: ${c.number} → ${key} at ${clockOf(currentStep)}`);
 }
 recalc();if(activePage==='orchestrator')renderOrchestrator();sendPriority('snapshot',{snapshot:prioritySnapshot()});
});
$('scenario').addEventListener('change',()=>{if(activePage.startsWith('p-')&&$('scenario').value!=='priority')location.hash='orders';});
$('reset').addEventListener('click',()=>{priorityActions=[];priorityDecisionSignature='';priorityLog=[];priorityForecast=null;sendPriority('reset');recalc();});
// Offer evidence alongside the existing 3D controls without replacing inspection or action cards.
const priorityBaseCargoProfile=cargoModelProfile;
cargoModelProfile=function(number){
 const c=PRIORITY_CARGO.find(b=>b.number===number);if(!c||$('scenario').value!=='priority')return priorityBaseCargoProfile(number);
 const profile=priorityBaseCargoProfile(c.kind==='hazmat'?'SYN-1-002':c.kind==='industrial'?'SYN-1-003':'SYN-1-001');
 return {...profile,title:c.cargo+' · illustrative load',contents:c.declarations.commodity_text||'Contents unverified; illustrative packaging only',weight:c.sensors.crane_weight_kg?c.sensors.crane_weight_kg.toLocaleString()+' kg':'Unknown',units:profile.units+' · mock packing'};
};
const priorityInspectionUI=renderInspectionUI;
renderInspectionUI=function(){priorityInspectionUI();if(!cargoInspection||$('scenario').value!=='priority')return;prioritySelectedNumber=cargoInspection.number;const c=PRIORITY_CARGO.find(b=>b.number===prioritySelectedNumber);if(!c)return;const panel=document.createElement('section');panel.className='priority-inspection-evidence';panel.innerHTML=`<h3>${esc(c.cargo)} · mock source evidence</h3><p>${esc(c.holdReason||'No blocking discrepancy in the mocked records.')}</p><p>Illustrative interior geometry; the evidence dashboard contains the scenario’s declared cargo and measurements.</p><button class="button" id="inspectionPriorityEvidence">Review evidence & decide →</button>`;inspectionPanel.prepend(panel);$('inspectionPriorityEvidence').onclick=()=>{closeCargoInspection(false);location.hash='p-box';sendPriority('route',{screen:'box',boxId:c.id});};};
recalc();navigate();showPriorityPage();
