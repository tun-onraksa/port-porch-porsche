// Shared workspace adapter for Priority Lanes V2 and the terminal simulation.
// Only exact-origin messages from our dashboard frame may edit this mock scenario.
const priorityPages={gate:['Dashboard','Decisions, queue & gate plan'],forecast:['Gate forecast','Demand & capacity'],security:['Security review','Conflicting source evidence'],learning:['Learning log','Outcomes & reliability'],built:['Data & methodology','Sources & model assumptions'],rulebook:['Rulebook','Priority Lanes rules']};
let priorityActions=[],priorityDecisionSignature='',priorityForecast=null,priorityLog=[],prioritySelectedNumber=PRIORITY_CARGO.find(c=>c.id==='sim-0001')?.number||PRIORITY_CARGO[4].number;
let priorityReady=false;
const priorityPane=document.createElement('section');priorityPane.id='priorityDashboard';priorityPane.hidden=true;priorityPane.innerHTML='<iframe id="priorityFrame" title="Priority Lanes operational dashboards" src="priority-lanes-v2/priority-lanes.html?porttable=1#gate"></iframe>';$('main').append(priorityPane);
const priorityFrame=$('priorityFrame');
for(const[key,[label,sub]]of Object.entries(priorityPages))pageInfo['p-'+key]=[label,'PRIORITY LANES',sub];
const navigationGroups=[['Operations',['p-gate','live','p-security']],['Planning',['orchestrator','p-forecast']],['Reference',['p-learning','p-rulebook','p-built']]];
const navigationIcons={live:'live','p-gate':'orders','p-security':'ledger',orchestrator:'orchestrator','p-forecast':'live','p-learning':'ledger','p-built':'ledger','p-rulebook':'config'};
$('navigation').innerHTML=navigationGroups.map(([label,pages])=>`<section class="nav-section" aria-labelledby="nav-${label.toLowerCase()}"><h2 class="nav-group-label" id="nav-${label.toLowerCase()}">${label}</h2>${pages.map(key=>`<a href="#${key}" data-page-link="${key}">${icon(navigationIcons[key])}<span>${pageInfo[key][0]}</span></a>`).join('')}</section>`).join('');

function sendPriority(type,data={}){priorityFrame.contentWindow?.postMessage({source:'porttable',type,...data},location.origin);}
function prioritySnapshot(){return {...buildSimulationDashboard(currentRun,currentStep,$('scenario').value,simulationOptions(),$('scenario').value==='priority'?PRIORITY_CARGO:[],guided,simulationEvents),runId:simulationRunId};}
function publishSimulationSnapshot(){if(priorityReady&&activePage.startsWith('p-'))sendPriority('snapshot',{snapshot:prioritySnapshot()});}

const priorSimulationOptions=simulationOptions;
simulationOptions=function(){return {...priorSimulationOptions(),...($('scenario').value==='priority'?{priorityCargo:PRIORITY_CARGO,cargoActions:priorityActions}:{})};};
const priorCargoHeld=cargoHeld;
cargoHeld=function(c,step=currentStep){if($('scenario').value!=='priority')return priorCargoHeld(c,step);const data=PRIORITY_CARGO.find(b=>b.number===c.number),action=priorityActions.filter(a=>a.number===c.number&&a.step<=step).at(-1);return !!data?.blocked||!!action&&(['hold','inspect','close'].includes(action.key)||action.readyStep>step);};
const priorBoardOrders=boardOrders;
boardOrders=function(){const records=priorBoardOrders();if($('scenario').value!=='priority')return records;return records.map(c=>{const data=PRIORITY_CARGO.find(b=>b.number===c.number);return {...c,priorityCargo:true,sourceIdentity:data.real,cargo:data.cargo,equipment_type:data.equipment_type,pod_terminal_name:'Modeled terminal · Priority Lanes',pod_eta_at:'Before shift',current_status:c.current_status!=='exited'&&cargoHeld(c)?'held':c.current_status};});};
const priorOpenContainer=openContainer;
openContainer=function(number){priorOpenContainer(number);if($('scenario').value==='priority'&&$('orderDialog').open){const data=PRIORITY_CARGO.find(b=>b.number===number);const link=document.createElement('div');link.className='detail-section';link.innerHTML=`<p><b>${esc(data.cargo)}</b> · ${data.real?'Recorded identity, simulated operational state':'Synthetic cargo'}</p><p>${esc(data.holdReason||'No blocking discrepancy in the mocked records.')}</p><button class="button" id="openPriorityEvidence">Inspect cargo in 3D →</button>`;$('orderDetail').prepend(link);$('openPriorityEvidence').onclick=()=>{$('orderDialog').close();prioritySelectedNumber=number;openCargoInspection(number,activePage);};}};
function ensurePriorityScenario(){if($('scenario').value==='priority')return;closeCargoInspection(false);playing=false;currentStep=0;$('scenario').value='priority';$('scenario').dispatchEvent(new Event('change'));}
function showPriorityPage(){const active=activePage.startsWith('p-');priorityPane.hidden=!active;document.querySelector('.page-heading').hidden=active;document.body.classList.toggle('priority-page',active);if(!active)return;sendPriority('route',{screen:activePage.slice(2),boxId:PRIORITY_CARGO.find(c=>c.number===prioritySelectedNumber)?.id});sendPriority('snapshot',{snapshot:prioritySnapshot()});}
window.addEventListener('hashchange',showPriorityPage);
const priorityRenderWorkspace=renderWorkspace;
renderWorkspace=function(){priorityRenderWorkspace();if($('scenario').value==='priority'){
 if(activePage==='orchestrator'&&priorityLog.length)$('activityLog').insertAdjacentHTML('afterbegin','<h3>Gate decisions</h3>'+priorityLog.slice(0,8).map(e=>`<p>${esc(e.text)}</p>`).join(''));
 }
 publishSimulationSnapshot();
};
const priorityOrchestratorDetail=renderOrchestratorDetail;
renderOrchestratorDetail=function(incident){priorityOrchestratorDetail(incident);if($('scenario').value!=='priority'||orchestratorArea!=='cargo')return;const c=PRIORITY_CARGO.find(c=>c.number===prioritySelectedNumber)||PRIORITY_CARGO[4];$('orchestratorDetail').innerHTML=`<span class="badge amber">Priority Lanes · mock evidence</span><h2>${esc(c.number)}</h2><p>${esc(c.cargo)}</p><section class="cargo-hold-reason"><h3>${c.blocked?'Why this cargo is held':'Cargo review'}</h3><p>${esc(c.holdReason||'No blocking discrepancy in the mocked records.')}</p><p><b>Recommended action:</b> ${esc(c.recommendedAction)}. </p><small>Mock evidence · source holds remain.</small></section><div class="ops-actions"><button class="button" id="priorityInspect">Inspect cargo in 3D</button></div>`;$('priorityInspect').onclick=()=>openCargoInspection(c.number,'orchestrator');};
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==priorityFrame.contentWindow||event.data?.source!=='priority-lanes')return;const message=event.data;
 if(message.type==='ready'){priorityReady=true;showPriorityPage();return;}
 if(message.type==='route'&&priorityPages[message.screen]){if(priorityPane.hidden)return;if(message.boxId){const b=PRIORITY_CARGO.find(c=>c.id===message.boxId);if(b)prioritySelectedNumber=b.number;}if(location.hash!=='#p-'+message.screen)location.hash='p-'+message.screen;return;}
 if(message.type==='inspect'){const c=currentRun.containers.find(c=>c.number===message.number);if(!c)return;prioritySelectedNumber=c.number;openCargoInspection(c.number,activePage);return;}
 if(message.type==='gate'){location.hash='p-gate';return;}
 if(message.type==='select-priority'){ensurePriorityScenario();showPriorityPage();return;}
 if(message.type==='live'||message.type==='resources'){location.hash=message.type==='live'?'live':'orchestrator';return;}
 if(message.type==='investigate'){if($('scenario').value==='stress'&&guided.status==='paused'){location.hash='live';investigateSceneConflict();}return;}
 if($('scenario').value!=='priority')return;
 if(message.runId!==simulationRunId||message.scenario!==$('scenario').value)return;
 if(message.type!=='decisions'||!Array.isArray(message.approvals)||!['ordinary','disruption'].includes(message.mode))return;
 priorityForecast=message.forecast;priorityLog=Array.isArray(message.log)?message.log:[];
 const signature=JSON.stringify([message.mode,message.approvals]);if(signature===priorityDecisionSignature)return;priorityDecisionSignature=signature;
 if($('scenario').value!=='priority')return;
 const approved=new Map(message.approvals.map(a=>[a.number,a])),decisionNotes=[];
 for(const c of PRIORITY_CARGO){const a=approved.get(c.number),key=a&&a.state!=='rejected'?a.key:'rejected';if(!['release','watch','flag','slow','reroute','inspect','hold','close','rejected'].includes(key))continue;const last=priorityActions.filter(x=>x.number===c.number).at(-1);if((last?.key||'rejected')===key)continue;
 const readyStep=key==='slow'?Math.max(currentStep,Math.ceil(((a?.readyAt||new Date('2026-10-29T21:00:00Z').getTime())-new Date('2026-10-29T13:00:00Z').getTime())/600000)):currentStep;
 priorityActions.push({number:c.number,key,step:currentStep,readyStep});decisionNotes.push(`Gate decision: ${c.number} → ${key} at ${clockOf(currentStep)}`);
 }
 recalc();decisionNotes.forEach(text=>logAction(text,{publish:false}));if(activePage==='orchestrator')renderOrchestrator();sendPriority('snapshot',{snapshot:prioritySnapshot()});
});
$('scenario').addEventListener('change',()=>{priorityActions=[];priorityDecisionSignature='';priorityLog=[];sendPriority('reset');recalc();showPriorityPage();});

// Offer evidence alongside the existing 3D controls without replacing inspection or action cards.
const priorityBaseCargoProfile=cargoModelProfile;
cargoModelProfile=function(number){
 const c=PRIORITY_CARGO.find(b=>b.number===number);if(!c||$('scenario').value!=='priority')return priorityBaseCargoProfile(number);
 const profile=priorityBaseCargoProfile(c.kind==='hazmat'?'SYN-1-002':c.kind==='industrial'?'SYN-1-003':'SYN-1-001');
 return {...profile,title:c.cargo+' · illustrative load',contents:c.declarations.commodity_text||'Contents unverified; illustrative packaging only',weight:c.sensors.crane_weight_kg?c.sensors.crane_weight_kg.toLocaleString()+' kg':'Unknown',units:profile.units+' · mock packing'};
};
const priorityInspectionUI=renderInspectionUI;
renderInspectionUI=function(){priorityInspectionUI();if(!cargoInspection||$('scenario').value!=='priority')return;prioritySelectedNumber=cargoInspection.number;const c=PRIORITY_CARGO.find(b=>b.number===prioritySelectedNumber);if(!c)return;const panel=document.createElement('section');panel.className='priority-inspection-evidence';panel.innerHTML=`<h3>${esc(c.cargo)} · mock source evidence</h3><p>${esc(c.holdReason||'No blocking discrepancy in the mocked records.')}</p><p></p><button class="button" id="inspectionPriorityEvidence">Gate decisions →</button>`;inspectionPanel.prepend(panel);$('inspectionPriorityEvidence').onclick=()=>{closeCargoInspection(false);location.hash='p-gate';sendPriority('route',{screen:'gate',boxId:c.id});};};
recalc();navigate();showPriorityPage();
// Dashboard is the home page: a bare visit opens it on the 112-container Priority Lanes scenario.
if(window.landedHome){ensurePriorityScenario();showPriorityPage();}
