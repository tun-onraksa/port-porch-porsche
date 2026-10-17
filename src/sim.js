// Deterministic 24-hour teaching model. All capacity and cost rates are assumptions.
const STEP_MIN=10, STEPS=144;
const DEFAULT_PLAN={berths:2,cranes:2,workers:24,hours:16,yardAcres:10,gates:2,rail:0};
const DEFAULT_RATES={berthDay:2000,craneHour:180,workerHour:85,yardAcreDay:120,gateHour:60,trainCost:500,overheadDay:3000,craneProductivity:25,gateProductivity:20,slotsPerAcre:30,releaseHours:2};
const STORIES=[], TIER_COL={general:'#c9a77c'};
const SHIPS=Array.from({length:4},(_,id)=>({id,mix:{}}));
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function clockOf(s){const m=Math.round(s*10)+360;return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+(m>=1440?' +1d':'');}
function simulate(plan=DEFAULT_PLAN,rates=DEFAULT_RATES,stress=false,options={}){
 let p={...(options.initialPlan||plan)};const r={...rates};
 for(const v of [...Object.values(p),...Object.values(r)])if(!Number.isFinite(v)||v<0)throw Error('Inputs must be finite and non-negative');
 if(!Number.isInteger(p.berths)||p.berths>4)throw Error('This schematic supports 0–4 berths');
 const ships=stress?Array.from({length:4},(_,i)=>({name:'Synthetic call '+(i+1),arrival:i*12,boxes:250})): [{name:TERMINAL49.records[0].pod_vessel_name,arrival:0,boxes:TERMINAL49.records.length}];
 const containers=ships.flatMap((ship,shipIndex)=>Array.from({length:ship.boxes},(_,i)=>({number:stress?'SYN-'+(shipIndex+1)+'-'+String(i+1).padStart(3,'0'):TERMINAL49.records[i].number,shipIndex,dischargeStep:null,exitStep:null,exitMode:null})));
 const byShip=ships.map((_,i)=>containers.filter(c=>c.shipIndex===i));
 const remaining=ships.map(s=>s.boxes),berth=Array(4).fill(-1),yard=[],frames=[];
 let departed=0,truckOut=0,railOut=0,waitHours=0,containerHours=0,peakYard=0;
 let craneCredit=0,gateCredit=0,railCredit=0;
 // Gate/rail staffing is included in the total workers, never charged twice.
 let gateWorkers,railWorkers,gatesStaffed,railStaffed,activeCranes,yardLimit;
 function updateCapacity(){gateWorkers=p.gates*2;railWorkers=p.rail>0?2:0;
 gatesStaffed=Math.min(p.gates,Math.floor(p.workers/2));
 railStaffed=p.rail>0&&p.workers>=gateWorkers+railWorkers;
 activeCranes=Math.min(p.cranes,p.berths*2,Math.floor(Math.max(0,p.workers-gateWorkers-railWorkers)/8));
 yardLimit=Math.floor(p.yardAcres*r.slotsPerAcre);}
 updateCapacity();
 const costs={berths:0,cranes:0,workers:0,yard:0,gates:0,rail:0,overhead:0};
 function snapshot(step,open){
  const cost=Math.round(Object.values(costs).reduce((a,b)=>a+b,0)*1e8)/1e8;
  return {step,open,plan:{...p},yardLimit,berth:[...berth],remaining:[...remaining],yard:yard.length,departed,truckOut,railOut,cost,costs:{...costs},waitHours,containerHours,peakYard,activeCranes,waiting:ships.filter((sh,i)=>sh.arrival<=step&&remaining[i]>0&&!berth.includes(i)).length};
 }
 frames.push(snapshot(0,p.hours>0));
 for(let s=0;s<STEPS;s++){
  const change=(options.planChanges||[]).filter(c=>c.step<=s).at(-1);if(change)p={...change.plan};updateCapacity();
  for(let b=p.berths;b<4;b++)berth[b]=-1;
  const open=s/6<p.hours;
  for(let b=0;b<p.berths;b++){
   if(berth[b]>=0&&remaining[berth[b]]===0)berth[b]=-1;
   if(berth[b]<0){const i=ships.findIndex((sh,i)=>sh.arrival<=s&&remaining[i]>0&&!berth.includes(i));if(i>=0)berth[b]=i;}
  }
  waitHours+=ships.filter((sh,i)=>sh.arrival<=s&&remaining[i]>0&&!berth.includes(i)).length/6;
  containerHours+=yard.length/6;
  if(open){
   // Discharge first; fresh containers cannot depart until the assumed release lag elapses.
   const occupied=berth.filter(i=>i>=0).length;
   craneCredit+=Math.min(activeCranes,occupied*2)*r.craneProductivity/6;
   let moves=Math.floor(craneCredit);craneCredit-=moves;
   while(moves>0&&yard.length<yardLimit){let moved=false;for(const i of berth){if(i>=0&&remaining[i]>0&&moves>0&&yard.length<yardLimit){const cargo=byShip[i][ships[i].boxes-remaining[i]];cargo.dischargeStep=s+1;remaining[i]--;yard.push({at:s,cargo});moves--;moved=true;}}if(!moved)break;}
   peakYard=Math.max(peakYard,yard.length);
   gateCredit+=gatesStaffed*r.gateProductivity/6;railCredit+=(railStaffed?p.rail:0)/6;
   let gateSlots=Math.floor(gateCredit),railSlots=Math.floor(railCredit);gateCredit-=gateSlots;railCredit-=railSlots;
   let readyIndex;
   const releasable=item=>s-item.at>=r.releaseHours*6&&!(options.holdIds?.includes(item.cargo.number)&&s>=options.holdStart&&(options.releaseStep==null||s<options.releaseStep));
   while((gateSlots>0||railSlots>0)&&(readyIndex=yard.findIndex(releasable))>=0){
    const item=yard.splice(readyIndex,1)[0];item.cargo.exitStep=s+1;item.cargo.exitMode=gateSlots>0?'Truck':'Rail';departed++;if(gateSlots>0){gateSlots--;truckOut++;}else{railSlots--;railOut++;}
   }
  }
  for(let b=0;b<4;b++)if(berth[b]>=0&&remaining[berth[b]]===0)berth[b]=-1;
  costs.berths+=p.berths*r.berthDay/144;costs.yard+=p.yardAcres*r.yardAcreDay/144;costs.overhead+=r.overheadDay/144;
  if(open){costs.cranes+=p.cranes*r.craneHour/6;costs.workers+=p.workers*r.workerHour/6;costs.gates+=p.gates*r.gateHour/6;}
  costs.rail=Math.ceil(railOut/100)*r.trainCost;
  frames.push(snapshot(s+1,(s+1)/6<p.hours));
 }
 const end=frames[STEPS];return {plan:p,rates:r,ships,containers,frames,total:ships.reduce((a,s)=>a+s.boxes,0),...end,backlog:end.yard+remaining.reduce((a,b)=>a+b,0),yardLimit,activeCranes};
}
