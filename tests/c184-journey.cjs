const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const Model=vm.runInNewContext(fs.readFileSync('src/c184-model.js','utf8')+';C184Journey');
for(const route of ['priority','standard']){
 const m=new Model();assert.equal(m.release(),false);m.advance(999);assert.equal(m.phase,'flagged');assert.equal(m.elapsed,12);m.advance(99);assert.equal(m.elapsed,12);assert.equal(m.choose(route),false);
 assert(m.investigate());m.advance(999);assert.equal(m.phase,'choice');assert.equal(m.elapsed,15);assert(m.choose(route));const wait=route==='priority'?10:45;
 m.toggle();m.advance(10);assert.equal(m.phaseTime,0);m.toggle();m.advance(wait-1);assert.equal(m.phase,'queue');assert.equal(m.release(),false);m.advance(1);assert.equal(m.phase,'inspection');assert.equal(m.elapsed,15+wait);
 m.advance(14);assert.equal(m.release(),false);m.advance(999);assert.equal(m.phase,'cleared');assert.equal(m.elapsed,30+wait);m.advance(999);assert.equal(m.phase,'cleared');assert(m.release());m.advance(999);assert.equal(m.phase,'departed');assert.equal(m.elapsed,35+wait);
 m.reset();assert.equal(m.elapsed,0);assert.equal(m.route,null);assert.equal(m.events.length,1);
}
console.log('PASS C184: explicit decisions, pause, 10/45 minute waits, 15 minute checks, release lock, 35-minute difference and reset.');
