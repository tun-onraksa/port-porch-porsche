const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx=vm.createContext({});vm.runInContext(['terminal49.js','sim.js','priority-data.js','dashboard-data.js'].map(f=>fs.readFileSync('src/'+f,'utf8')).join('\n')+';globalThis.api={simulate,buildSimulationDashboard,DEFAULT_PLAN,DEFAULT_RATES,PRIORITY_CARGO}',ctx);
const{simulate,buildSimulationDashboard:report,DEFAULT_PLAN:p,DEFAULT_RATES:r,PRIORITY_CARGO:source}=ctx.api;
for(const scenario of ['sample','stress','priority'])for(const patch of [{},{gates:0,rail:0},{workers:0},{hours:0},{gates:1,workers:2,hours:7},{gates:0,rail:40,workers:40},{hours:24,workers:60,cranes:4}]){
 const options=scenario==='priority'?{priorityCargo:source}:{};const run=simulate({...p,...patch},r,scenario==='stress',options);
 for(const step of [0,1,11,47,95,143,144]){
  const d=report(run,step,scenario,options,scenario==='priority'?source:[]),f=run.frames[step];
  assert.equal(d.forecast.hours.reduce((n,h)=>n+h.truck,0),run.truckOut-f.truckOut);
  assert.equal(d.forecast.hours.reduce((n,h)=>n+h.rail,0),run.railOut-f.railOut);
  assert.equal(d.departed+d.forecast.truck+d.forecast.rail+d.backlog,d.total);
  assert.equal(d.yard+d.onShip+d.departed,d.total);
  assert.equal(d.provenance.recorded+d.provenance.synthetic,d.total);
  assert.equal(d.forecast.hours.reduce((n,h)=>n+h.minutes,0),(144-step)*10);
  for(const h of d.forecast.hours){assert(h.truck<=h.capacity);assert(h.ready+h.held<=h.yard);assert(h.minutes>0&&h.minutes<=60);}
  if(step===144)assert.equal(d.forecast.hours.length,0);
  if(scenario==='sample')assert.equal(d.security.unknown,4);
 }
}
const ids=Array.from({length:12},(_,i)=>'SYN-1-'+String(i+1).padStart(3,'0'));
const options={holdIds:ids,holdStart:12,releaseStep:null};const run=simulate(p,r,true,options);
assert.equal(report(run,11,'stress',options).security.cases.length,0);
assert.equal(report(run,12,'stress',options).security.held,12);
const changed={...options,initialPlan:p,releaseStep:15,planChanges:[{step:12,plan:{...p,gates:3,workers:32,hours:20}}]};const updated=simulate(changed.planChanges[0].plan,r,true,changed);
assert.deepEqual(updated.frames.slice(0,13),run.frames.slice(0,13));
assert.equal(report(updated,12,'stress',changed).plan.gates,3);
assert.equal(report(updated,15,'stress',changed,[],{status:'approved'}).security.held,0);
const events=[{scenario:'stress',step:12},{scenario:'sample',step:0},{scenario:'stress',step:20}];assert.equal(report(run,12,'stress',options,[],{},events).events.length,1);
const pr=simulate(p,r,false,{priorityCargo:source});const d=report(pr,0,'priority',{priorityCargo:source},source);assert.equal(d.security.held,source.filter(c=>c.blocked).length);assert(d.security.cases.some(c=>c.details.length));
console.log('PASS dashboard reconciliation for all scenarios, clock boundaries, zero/partial capacity, rail, holds, future resource changes, provenance and run-scoped events.');
