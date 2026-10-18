const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const money=n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currentPlan={...DEFAULT_PLAN},currentRates={...DEFAULT_RATES},currentStep=0,playing=false;
let currentRun=simulate(currentPlan,currentRates),baseline=simulate(DEFAULT_PLAN,currentRates);
const defs=[['berths','1 · Berths available',0,4,1,'berths'],['cranes','2 · Cranes operating',0,8,1,'cranes'],['workers','3 · Workers per shift',0,100,1,'workers'],['hours','4 · Operating hours per day',0,24,1,'hours'],['yardAcres','5 · Yard space available',0,50,1,'acres'],['gates','6 · Truck-gate capacity',0,5,1,'lanes'],['rail','↳ Rail capacity',0,100,5,'containers/h']];
const rateNames={berthDay:'Berth upkeep · $/day',craneHour:'Crane · $/reserved hour',workerHour:'Worker · $/paid hour',yardAcreDay:'Yard · $/acre/day',gateHour:'Gate equipment · $/lane/hour',trainCost:'Rail · $/train-equivalent',overheadDay:'Shared overhead · $/day',craneProductivity:'Containers / crane-hour',gateProductivity:'Containers / lane-hour',slotsPerAcre:'Container slots / acre',releaseHours:'Assumed pickup lag · hours'};
$('rateControls').innerHTML=Object.entries(rateNames).map(([key,label])=>`<label for="rate-${key}">${label}<input id="rate-${key}" type="number" readonly value="${currentRates[key]}"></label>`).join('');
function render(){
 if(typeof guided!=='undefined'&&guided.enabled&&guided.status==='armed'&&currentStep>=guided.holdStart&&typeof checkSimulationConflict==='function')checkSimulationConflict();
 if(typeof guided!=='undefined'&&guided.enabled&&guided.status==='paused'&&currentStep!==guided.holdStart){currentStep=guided.holdStart;playing=false;}
 if(typeof renderOperations==='function' && typeof operationsReady!=='undefined')renderOperations();
 const f=currentRun.frames[currentStep],end=currentRun.frames[144],r=currentRates,p=f.plan;
 $('clockTxt').textContent=clockOf(currentStep);$('scrub').value=currentStep;
 $('playBtn').textContent=playing?'Pause':'Play';
 const metrics=[['Spent',money(f.cost)],['Day estimate',money(end.cost)],['Exited',f.departed+' / '+currentRun.total],['Day-end backlog',currentRun.backlog]];
 $('kpis').innerHTML=metrics.map(([a,b])=>`<div class="metric"><small>${a}</small><strong>${b}</strong></div>`).join('');
 $('playbackState').textContent=playing?'Running':currentStep===144?'Day complete':'Paused';
 if(typeof renderLiveSummary==='function')renderLiveSummary();
}
function recalc(){const stress=$('scenario').value==='stress';currentRun=simulate(currentPlan,currentRates,stress,typeof simulationOptions==='function'?simulationOptions():{});baseline=simulate(DEFAULT_PLAN,currentRates,stress,$('scenario').value==='priority'?{priorityCargo:PRIORITY_CARGO}:{});render();if(typeof renderWorkspace==='function')renderWorkspace();}
$('scenario').onchange=recalc;
$('scrub').oninput=e=>{currentStep=+e.target.value;playing=false;render();};
$('playBtn').onclick=()=>{if(currentStep===144)currentStep=0;playing=!playing;render();};
setInterval(()=>{if(!playing)return;currentStep=Math.min(144,currentStep+1);if(typeof checkSimulationConflict==='function')checkSimulationConflict();if(currentStep===144)playing=false;render();},150);
render();
if(typeof THREE!=='undefined' && THREE.OrbitControls){startPortScene();}else{$('scene').innerHTML='<p style="padding:70px 25px">3D preview unavailable: its CDN could not load. All controls, calculations and cargo data remain available.</p>';}
