// A separate, deterministic presentation clock. It never rewrites terminal cost/inventory history.
class C184Journey {
 constructor(){this.reset();}
 reset(){this.phase='arriving';this.elapsed=0;this.phaseTime=0;this.paused=false;this.route=null;this.events=[{at:0,text:'C184 arrived · chilled strawberries · demo data'}];}
 get duration(){return {arriving:4,unloading:4,intake:4,divert:3,queue:this.route==='priority'?10:45,inspection:15,departing:5}[this.phase]||0;}
 get awaitingDecision(){return ['flagged','choice','cleared','departed'].includes(this.phase);}
 get queuePosition(){return this.phase==='queue'?(this.route==='priority'?1:Math.max(1,4-Math.floor(this.phaseTime/15))):null;}
 get stage(){return ['arriving','unloading','intake'].includes(this.phase)?0:['flagged','divert','choice'].includes(this.phase)?1:['queue','inspection'].includes(this.phase)?2:this.phase==='departed'?4:3;}
 enter(phase,text){this.elapsed=Math.round(this.elapsed*1e8)/1e8;this.phase=phase;this.phaseTime=0;this.paused=this.awaitingDecision;if(text)this.events.push({at:this.elapsed,text});}
 advance(minutes){if(!Number.isFinite(minutes)||minutes<0||this.paused||this.awaitingDecision)return;
  while(minutes>0&&!this.paused&&!this.awaitingDecision){const used=Math.min(minutes,this.duration-this.phaseTime);this.elapsed+=used;this.phaseTime+=used;minutes-=used;if(this.phaseTime+1e-8<this.duration)break;
   const next={arriving:['unloading','Crane unloading'],unloading:['intake','On terminal vehicle · moving to intake'],intake:['flagged','Held: manifest 20 pallets / intake record 18'],divert:['choice','Inspection queue · priority decision required'],queue:['inspection','Inspection started · '+(this.route==='priority'?'10':'45')+' min wait'],inspection:['cleared','20 pallets verified; intake corrected. Awaiting release approval.'],departing:['departed','C184 passed the truck gate']}[this.phase];this.enter(...next);
  }
 }
 investigate(){if(this.phase!=='flagged')return false;this.enter('divert','Investigation opened · diverted from main route');return true;}
 choose(route){if(this.phase!=='choice'||!['priority','standard'].includes(route))return false;this.route=route;this.enter('queue',route==='priority'?'Priority refrigerated bay approved':'Standard inspection queue selected');return true;}
 release(){if(this.phase!=='cleared')return false;this.enter('departing','Release approved · all checks complete');return true;}
 toggle(){if(!this.awaitingDecision)this.paused=!this.paused;}
}
