// Workspace navigation and persistence. Simulation state is shared with Priority Lanes.
const STORAGE_KEY='porttable.workspace.v1';
let annotations={},configuration={name:'Container import',priority:'Standard',zone:'Import yard'},activity=[];
let activePage='live';
let simulationRunId=1,simulationEvents=[];
function beginSimulationRun(){simulationRunId++;simulationEvents=[];}
$('scenario').addEventListener('change',()=>{beginSimulationRun();currentStep=0;},true);
const pageInfo={live:['Live operations','LONG BEACH TERMINAL','Follow the cargo. Understand the bottleneck.'],orchestrator:['Resource planning','OPERATING PLAN','Inspect the situation, shape your response, then approve.']};
const iconPaths={orders:'M4 4h16v16H4z M4 9h16 M9 9v11',live:'M3 17l5-7 5 3 8-9 M3 21h18',config:'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',zones:'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',orchestrator:'M4 4h6v6H4z M14 14h6v6h-6z M7 10v7h7 M10 7h7v7',ledger:'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h3'};
const icon=k=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[k]}"/></svg>`;

$('navigation').innerHTML=Object.entries(pageInfo).map(([key,[label]])=>`<a href="#${key}" data-page-link="${key}">${icon(key)}<span>${label}</span></a>`).join('');
function announce(message){$('statusMessage').innerHTML='<span>'+esc(message)+'</span><button aria-label="Dismiss message">✕</button>';$('statusMessage').hidden=false;$('statusMessage').querySelector('button').onclick=()=>{$('statusMessage').hidden=true;};}
function saveWorkspace(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({plan:currentPlan,rates:currentRates,scenario:$('scenario').value,annotations,configuration,activity:activity.slice(0,30)}));$('saveState').textContent='Saved on this device';}catch{$('saveState').textContent='Session only · storage unavailable';}}
function logAction(text,{publish=true}={}){const entry={at:new Date().toISOString(),text,scenario:$('scenario').value,step:currentStep,runId:simulationRunId,cost:currentRun.cost,backlog:currentRun.backlog};activity.unshift(entry);activity=activity.slice(0,30);simulationEvents.unshift(entry);if(publish&&typeof publishSimulationSnapshot==='function')publishSimulationSnapshot();}
function syncInputs(){for(const key of Object.keys(rateNames))$('rate-'+key).value=currentRates[key];}
function restore(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!saved)return;
 for(const[key,,min,max,step]of defs){const n=saved.plan?.[key];if(Number.isFinite(n)&&n>=min&&n<=max&&n%step===0)currentPlan[key]=n;}
 for(const key of Object.keys(DEFAULT_RATES)){const n=saved.rates?.[key];if(Number.isFinite(n)&&n>=0&&n<=1000000)currentRates[key]=n;}
 if(['sample','stress','priority'].includes(saved.scenario))$('scenario').value=saved.scenario;
 if(saved.annotations&&typeof saved.annotations==='object')annotations=saved.annotations;
 if(saved.configuration&&typeof saved.configuration.name==='string')configuration={name:saved.configuration.name.slice(0,60),priority:['High','Standard'].includes(saved.configuration.priority)?saved.configuration.priority:'Standard',zone:['Import yard','Truck interchange','Rail transfer'].includes(saved.configuration.zone)?saved.configuration.zone:'Import yard'};
 if(Array.isArray(saved.activity))activity=saved.activity.filter(x=>typeof x.text==='string'&&typeof x.at==='string').slice(0,30);
}catch{}}

function navigate(){
 $('statusMessage').hidden=true;const requested=location.hash.slice(1);window.landedHome??=!requested;activePage=['p-box','p-radar','p-drill'].includes(requested)?'p-gate':pageInfo[requested]?requested:'p-gate';
 if(requested!==activePage)history.replaceState(null,'','#'+activePage);
 document.querySelectorAll('[data-page]').forEach(el=>el.hidden=el.dataset.page!==activePage);
 document.querySelectorAll('[data-page-link]').forEach(el=>{if(el.dataset.pageLink===activePage)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 const [title]=pageInfo[activePage];$('pageCrumb').textContent=title;$('pageTitle').textContent=title;document.title=title+' · PortTable';
 $('pageActions').innerHTML=activePage==='live'?'<button class="button" data-assumptions>Assumptions</button><button class="button primary" data-go="orchestrator">Adjust plan</button>':activePage==='orchestrator'?'<button class="button" data-assumptions>Assumptions</button><button class="button" data-go="live">3D terminal →</button>':'';
 if(activePage!=='live')playing=false;render();renderWorkspace();
 if(innerWidth<760){document.body.classList.remove('nav-open');$('toggleSidebar').setAttribute('aria-expanded','false');}
}
window.addEventListener('hashchange',navigate);
document.addEventListener('click',e=>{const a=e.target.closest('[data-go]');if(a)location.hash=a.dataset.go;if(e.target.closest('[data-assumptions]'))$('assumptionsDialog').showModal();});
$('toggleSidebar').onclick=()=>{if(innerWidth<760){document.body.classList.toggle('nav-open');$('toggleSidebar').setAttribute('aria-expanded',String(document.body.classList.contains('nav-open')));}else{document.body.classList.toggle('sidebar-collapsed');$('toggleSidebar').setAttribute('aria-expanded',String(!document.body.classList.contains('sidebar-collapsed')));}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open')){document.body.classList.remove('nav-open');$('toggleSidebar').setAttribute('aria-expanded','false');$('toggleSidebar').focus();}});
const modelStatus={on_ship:'On ship',discharged:'In yard',available:'Ready for pickup',exited:'Exited'};
function boardOrders(){if($('scenario').value==='sample')return TERMINAL49.records;return currentRun.containers.map(c=>{const ship=currentRun.ships[c.shipIndex],status=c.exitStep!==null&&c.exitStep<=currentStep?'exited':c.dischargeStep!==null&&c.dischargeStep<=currentStep?((c.preDischarged||currentStep-1-(c.dischargeStep-1)>=currentRates.releaseHours*6)?'available':'discharged'):'on_ship';return {...c,synthetic:true,current_status:status,pod_vessel_name:ship.name,pod_terminal_name:'Hypothetical terminal',port_of_discharge_name:'Long Beach (modeled)',pod_eta_at:clockOf(ship.arrival),availability_known:true,available_for_pickup:status==='available'};});}

function renderActivity(){$('activityLog').innerHTML=activity.length?activity.map(x=>`<div class="activity-row"><span class="activity-dot"></span><span>${esc(x.text)}</span><time>${esc(new Date(x.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</time></div>`).join(''):'<div class="empty-state"><b>No decisions yet</b><p>Approved resource changes and cargo decisions will appear here.</p></div>';}
function renderWorkspace(){if(activePage==='orchestrator')renderActivity();saveWorkspace();}
restore();syncInputs();recalc();
// Final route resolution happens after the Priority Lanes routes are registered.
