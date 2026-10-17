const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('src/terminal49.js','utf8')+fs.readFileSync('src/sim.js','utf8')+';globalThis.api={simulate,DEFAULT_PLAN,DEFAULT_RATES,TERMINAL49}',ctx);
const {simulate,DEFAULT_PLAN:p,DEFAULT_RATES:r,TERMINAL49:data}=ctx.api;
{ // Shared Priority Lanes inventory, source holds and future-only cargo decisions.
vm.runInContext(fs.readFileSync('src/priority-data.js','utf8')+';globalThis.priorityCargo=PRIORITY_CARGO',ctx);
const priority=ctx.priorityCargo,priorityOptions={priorityCargo:priority};
assert.equal(priority.length,112);assert.equal(priority.filter(c=>c.real).length,4);
const priorityRun=simulate(p,r,false,priorityOptions);
assert.equal(priorityRun.frames[0].yard,112);
assert.equal(priorityRun.backlog,priority.filter(c=>c.blocked).length);
for(const f of priorityRun.frames)assert.equal(f.yard+f.departed,112);
const held=priority.find(c=>c.blocked),clear=priority.find(c=>!c.blocked);
const blockedRelease=simulate(p,r,false,{...priorityOptions,cargoActions:[{number:held.number,key:'release',step:0,readyStep:0}]});
assert.equal(blockedRelease.containers.find(c=>c.number===held.number).exitStep,null);
const rerouted=simulate(p,r,false,{...priorityOptions,cargoActions:[{number:clear.number,key:'reroute',step:0,readyStep:0}]});
assert.equal(rerouted.containers.find(c=>c.number===clear.number).exitStep,null);
const withRail=simulate({...p,rail:20},r,false,{...priorityOptions,cargoActions:[{number:clear.number,key:'reroute',step:0,readyStep:0}]});
assert.equal(withRail.containers.find(c=>c.number===clear.number).exitMode,'Rail');
const next=priorityRun.containers.find(c=>c.exitStep>3),historyPlan=simulate(p,r,false,{...priorityOptions,cargoActions:[{number:next.number,key:'hold',step:3,readyStep:3}]});
assert.deepEqual(historyPlan.frames.slice(0,4),priorityRun.frames.slice(0,4));
assert.equal(historyPlan.containers.find(c=>c.number===next.number).exitStep,null);
assert.equal(simulate({...p,gates:0,rail:0},r,false,priorityOptions).departed,0);
console.log('PASS: shared inventory, hold enforcement, rail routing, historical preservation and capacity limits.');
}
assert.equal(data.records.length,4);assert.equal(new Set(data.records.map(x=>x.number)).size,4);assert(data.records.every(x=>x.port_of_discharge_name==='Los Angeles'&&!x.availability_known));
const base=simulate();assert.equal(base.total,4);assert.equal(base.departed,4);assert.equal(base.cost,48520);
for(const stress of [false,true])for(const patch of [{},{berths:0},{cranes:0},{workers:0},{hours:0},{yardAcres:0},{gates:0,rail:0},{gates:0,rail:50},{berths:4,cranes:8,workers:80,hours:24}]){
 const run=simulate({...p,...patch},r,stress);
 for(const f of run.frames){assert.equal(f.remaining.reduce((a,b)=>a+b,0)+f.yard+f.departed,run.total);assert.equal(run.containers.filter(c=>c.exitStep!==null&&c.exitStep<=f.step).length,f.departed);assert.equal(run.containers.filter(c=>c.dischargeStep!==null&&c.dischargeStep<=f.step&&(c.exitStep===null||c.exitStep>f.step)).length,f.yard);assert(f.yard<=run.yardLimit);assert(f.cost>=0);assert.equal(f.departed,f.truckOut+f.railOut);}
 assert.equal(run.departed+run.backlog,run.total);
 if(patch.hours===0||patch.workers===0||patch.berths===0||patch.cranes===0||patch.yardAcres===0)assert.equal(run.departed,0);
}
const stress=simulate(p,r,true),up=simulate({...p,berths:4,cranes:4,workers:40,hours:24},r,true);assert(up.departed>stress.departed);
const rail=simulate({...p,gates:0,rail:50},r,true);assert(rail.railOut>0);assert.equal(rail.costs.rail,Math.ceil(rail.railOut/100)*r.trainCost);
assert.equal(simulate({...p,berths:4}).departed,base.departed);
assert.throws(()=>simulate({...p,hours:NaN}));
console.log('PASS: source provenance, cost reconciliation, flow conservation, zero-resource cases, rail billing, capacity response.');

const holdIds=Array.from({length:12},(_,i)=>'SYN-1-'+String(i+1).padStart(3,'0'));
const held=simulate(p,r,true,{holdIds,holdStart:12,releaseStep:null});
assert(held.containers.filter(c=>holdIds.includes(c.number)).every(c=>c.exitStep===null));
const edited=simulate({...p,gates:3,workers:32,hours:20},r,true,{initialPlan:p,holdIds,holdStart:12,releaseStep:15,planChanges:[{step:12,plan:{...p,gates:3,workers:32,hours:20}}]});
assert.deepEqual(edited.frames.slice(0,13),held.frames.slice(0,13));
assert.equal(edited.frames[13].plan.workers,32);
assert(edited.containers.filter(c=>holdIds.includes(c.number)).every(c=>c.exitStep>15));
assert(edited.departed>held.departed);
for(const f of edited.frames)assert.equal(f.remaining.reduce((a,b)=>a+b,0)+f.yard+f.departed,1000);
assert(Math.abs(Object.values(edited.costs).reduce((a,b)=>a+b,0)-edited.cost)<0.000001);
console.log('PASS: cargo holds, approved release timing, future-only resource changes, historical frames and costs preserved.');
