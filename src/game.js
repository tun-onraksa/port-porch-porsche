const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const money=n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currentPlan={...DEFAULT_PLAN},currentRates={...DEFAULT_RATES},currentStep=36,playing=false;
let currentRun=simulate(currentPlan,currentRates),baseline=simulate(DEFAULT_PLAN,currentRates);
const defs=[['berths','1 · Berths available',0,4,1,'berths'],['cranes','2 · Cranes operating',0,8,1,'cranes'],['workers','3 · Workers per shift',0,100,1,'workers'],['hours','4 · Operating hours per day',0,24,1,'hours'],['yardAcres','5 · Yard space available',0,50,1,'acres'],['gates','6 · Truck-gate capacity',0,5,1,'lanes'],['rail','↳ Rail capacity',0,100,5,'containers/h']];
$('controls').innerHTML=defs.map(([key,label,min,max,step,unit])=>`<div class="control"><label for="${key}">${label}<output id="${key}Value">${currentPlan[key]} ${unit}</output></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${currentPlan[key]}" data-unit="${unit}"></div>`).join('');
const rateNames={berthDay:'Berth upkeep · $/day',craneHour:'Crane · $/reserved hour',workerHour:'Worker · $/paid hour',yardAcreDay:'Yard · $/acre/day',gateHour:'Gate equipment · $/lane/hour',trainCost:'Rail · $/train-equivalent',overheadDay:'Shared overhead · $/day',craneProductivity:'Containers / crane-hour',gateProductivity:'Containers / lane-hour',slotsPerAcre:'Container slots / acre',releaseHours:'Assumed pickup lag · hours'};
$('rateControls').innerHTML=Object.entries(rateNames).map(([key,label])=>`<label for="rate-${key}">${label}<input id="rate-${key}" type="number" min="0" max="1000000" step="any" value="${currentRates[key]}"></label>`).join('');
function render(){
 if(typeof guided!=='undefined'&&guided.enabled&&guided.status==='armed'&&currentStep>=guided.holdStart&&typeof checkSimulationConflict==='function')checkSimulationConflict();
 if(typeof guided!=='undefined'&&guided.enabled&&guided.status==='paused'&&currentStep!==guided.holdStart){currentStep=guided.holdStart;playing=false;}
 if(typeof renderOperations==='function' && typeof operationsReady!=='undefined')renderOperations();
 const f=currentRun.frames[currentStep],end=currentRun.frames[144],r=currentRates,p=f.plan;
 $('clockTxt').textContent=clockOf(currentStep);$('scrub').value=currentStep;
 $('playBtn').textContent=playing?'Pause':'Play';
 const metrics=[['Operating cost · elapsed',money(f.cost),'24-hour plan: '+money(end.cost)],['Containers completed',f.departed+' / '+currentRun.total,'Truck '+f.truckOut+' · rail '+f.railOut],['Remaining at day end',currentRun.backlog,'On ship or in yard'],['Cost / completed container',f.departed?money(f.cost/f.departed):'—','Terminal exit; not a port-wide unit cost']];
 $('kpis').innerHTML=metrics.map(([a,b,c])=>`<div class="metric"><small>${a}</small><strong>${b}</strong><small>${c}</small></div>`).join('');
 const formulas={berths:`${p.berths} berths × ${money(r.berthDay)}/day`,cranes:`${p.cranes} cranes × ${p.hours} h × ${money(r.craneHour)}/h`,workers:`${p.workers} workers × ${p.hours} h × ${money(r.workerHour)}/h`,yard:`${p.yardAcres} acres × ${money(r.yardAcreDay)}/acre/day`,gates:`${p.gates} lanes × ${p.hours} h × ${money(r.gateHour)}/h`,rail:`${Math.ceil(end.railOut/100)} train-equivalents × ${money(r.trainCost)}`,overhead:'Fixed daily shared costs'};
 $('breakdown').innerHTML=Object.entries(end.costs).map(([key,value])=>`<div class="cost-row"><span>${key[0].toUpperCase()+key.slice(1)}<small>${formulas[key]}</small></span><b>${money(value)}</b></div>`).join('');
 const delta=end.cost-baseline.cost;
 $('comparison').textContent=`Against default resources at the same rates and demand: ${money(Math.abs(delta))} ${delta<0?'less':'more'} per day; ${end.departed-baseline.departed>=0?'+':''}${end.departed-baseline.departed} containers completed. Ship queue: ${end.waitHours.toFixed(1)} ship-hours. Yard waiting: ${end.containerHours.toFixed(1)} container-hours.`;
 $('flow').textContent=`At ${clockOf(currentStep)}: ${f.remaining.reduce((a,b)=>a+b,0)} containers on ships; ${f.yard} in yard; ${f.departed} exited. Storage capacity ${f.yardLimit}; peak occupancy ${end.peakYard}. Staffing and berth limits support ${currentRun.activeCranes} of ${p.cranes} scheduled cranes. ${currentRun.backlog?'Backlog remains: adjust resources or operating hours.':'All scenario cargo exits within the modeled day.'}`;
 $('scenarioNote').textContent=$('scenario').value==='stress'?'Synthetic demand: four invented calls of 250 containers. This is not a Terminal49 forecast.':'Four real container records, one vessel. Arrival at simulation start and pickup clearance are assumptions. Extra berths cannot speed up one ship.';
}
function recalc(){const stress=$('scenario').value==='stress';currentRun=simulate(currentPlan,currentRates,stress,typeof simulationOptions==='function'?simulationOptions():{});baseline=simulate(DEFAULT_PLAN,currentRates,stress);render();if(typeof renderWorkspace==='function')renderWorkspace();}
for(const [key,,, , ,unit] of defs)$(key).addEventListener('input',e=>{currentPlan[key]=+e.target.value;$(key+'Value').textContent=e.target.value+' '+unit;recalc();});
for(const key of Object.keys(rateNames))$('rate-'+key).addEventListener('change',e=>{const v=Number(e.target.value);if(e.target.value===''||!Number.isFinite(v)||v<0||v>1000000){e.target.value=currentRates[key];if(typeof announce==='function')announce('Enter a non-negative rate no greater than 1,000,000. The previous value was kept.');return;}currentRates[key]=v;recalc();});
$('scenario').onchange=recalc;
$('reset').onclick=()=>{currentPlan={...DEFAULT_PLAN};currentRates={...DEFAULT_RATES};for(const[key,,,,,unit]of defs){$(key).value=currentPlan[key];$(key+'Value').textContent=currentPlan[key]+' '+unit;}for(const key of Object.keys(rateNames))$('rate-'+key).value=currentRates[key];currentStep=36;playing=false;recalc();};

$('scrub').oninput=e=>{currentStep=+e.target.value;playing=false;render();if(typeof renderLiveFlow==='function')renderLiveFlow();};
$('playBtn').onclick=()=>{if(currentStep===144)currentStep=0;playing=!playing;render();};
setInterval(()=>{if(!playing)return;currentStep=Math.min(144,currentStep+1);if(typeof checkSimulationConflict==='function')checkSimulationConflict();if(currentStep===144)playing=false;render();if(typeof renderLiveFlow==='function')renderLiveFlow();},150);
render();
if(typeof THREE!=='undefined' && THREE.OrbitControls){startPortScene();}else{$('scene').innerHTML='<p style="padding:70px 25px">3D preview unavailable: its CDN could not load. All controls, calculations and cargo data remain available.</p>';}
