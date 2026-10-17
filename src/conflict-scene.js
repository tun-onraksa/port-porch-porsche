// Conflicts interrupt the port scene; investigation and decisions stay beside that scene.
let liveConflictDecision=false;
const conflictPopup=document.createElement('dialog');conflictPopup.id='sceneConflictPopup';conflictPopup.setAttribute('role','alertdialog');conflictPopup.setAttribute('aria-labelledby','sceneConflictTitle');conflictPopup.setAttribute('aria-describedby','sceneConflictDescription');
conflictPopup.innerHTML='<div class="conflict-popup-head"><span class="conflict-symbol" aria-hidden="true">!</span><span>CONFLICT DETECTED · SIMULATION PAUSED</span></div><div class="padded"><h2 id="sceneConflictTitle">Cargo seal mismatch</h2><p id="sceneConflictDescription">At 08:00, the recorded door seals on 12 containers from Synthetic call 1 did not match the original manifest. The replacement-seal record is unverified, so truck and rail departure are blocked. Investigate the mock evidence before deciding whether to inspect or release.</p><p class="muted">Mock incident · nothing has been released</p><div class="ops-actions"><button class="button danger" id="investigateSceneConflict">Investigate →</button><button class="button" id="keepConflictPaused">Keep paused</button></div></div>';
document.body.append(conflictPopup);
const conflictBanner=document.createElement('div');conflictBanner.className='scene-conflict-banner';conflictBanner.hidden=true;conflictBanner.innerHTML='<div><b>Conflict unresolved · simulation paused</b><span>Seal records do not match the original manifest · 12 containers held from departure.</span></div><button class="button danger" id="reviewSceneConflict">Investigate →</button>';
document.querySelector('.live-grid').before(conflictBanner);
const liveDecisionDock=document.createElement('aside');liveDecisionDock.className='live-conflict-decisions';liveDecisionDock.hidden=true;document.querySelector('.live-grid').append(liveDecisionDock);
function showSceneConflict(){
 if(!guided.enabled||guided.status!=='paused')return;playing=false;$('statusMessage').hidden=true;conflictBanner.hidden=false;document.querySelector('.port-view').classList.add('has-conflict');
 if(!conflictPopup.open)conflictPopup.showModal();
}
function investigateSceneConflict(){
 if(guided.status!=='paused')return;if(conflictPopup.open)conflictPopup.close();liveConflictDecision=true;
 openCargoInspection(guided.holdIds[0],'live');renderOrchestrator();
}
$('investigateSceneConflict').onclick=investigateSceneConflict;$('reviewSceneConflict').onclick=investigateSceneConflict;
$('keepConflictPaused').onclick=()=>{conflictPopup.close();conflictBanner.hidden=false;};
conflictPopup.addEventListener('cancel',()=>{conflictBanner.hidden=false;});
function mountLiveDecision(){
 const active=liveConflictDecision&&guided.enabled&&guided.status==='paused';liveDecisionDock.hidden=!active;decisionLink.hidden=active;
 conflictBanner.hidden=guided.status!=='paused'||!guided.enabled;document.querySelector('.port-view').classList.toggle('has-conflict',guided.enabled&&guided.status==='paused');
 if(!active)return;
 liveDecisionDock.innerHTML=`<section class="card padded cargo-disposition"><span class="badge conflict-badge">Held cargo · decision required</span><h2>Resolve the seal check</h2><p>Review the 3D cargo, then choose what happens to the affected batch of 12 containers.</p>${cargoHoldReasonMarkup(cargoInspection?.number)}<fieldset><legend>Cargo action</legend><label><input type="radio" name="liveDisposition" value="inspect" ${guided.disposition==='inspect'?'checked':''}><span><b>Inspect, then release</b><small>Hold for 30 modeled minutes after approval.</small></span></label><label><input type="radio" name="liveDisposition" value="release" ${guided.disposition==='release'?'checked':''}><span><b>Release now</b><small>Accept the mocked documents on approval.</small></span></label></fieldset><button class="text-button" id="remainHeld">Keep on hold · stay paused</button><p class="muted" id="liveDispositionStatus" role="status">Choices remain drafts until you approve below.</p><button class="button wide" id="liveInspectSeal">Zoom to door seal</button></section>`;
 const panel=workbench.querySelector('.draft-panel');if(!panel)return;liveDecisionDock.append(panel);
 panel.querySelector('h2').textContent='What would help?';
 const form=$('decisionForm'),submit=form.onsubmit;
 form.onsubmit=e=>{submit(e);if(guided.status==='approved'){liveConflictDecision=false;closeCargoInspection(false);conflictBanner.hidden=true;document.querySelector('.port-view').classList.remove('has-conflict');liveDecisionDock.hidden=true;decisionLink.hidden=false;}};
 liveDecisionDock.querySelectorAll('[name=liveDisposition]').forEach(input=>input.onchange=()=>{guided.disposition=input.value;$('liveDispositionStatus').textContent=input.value==='inspect'?'Draft: inspect for 30 minutes, then release after approval.':'Draft: release the batch immediately on approval.';renderDecisionPreview();});
 $('remainHeld').onclick=()=>{guided.disposition=null;playing=false;liveDecisionDock.querySelectorAll('[name=liveDisposition]').forEach(input=>input.checked=false);$('liveDispositionStatus').textContent='Cargo remains held and playback stays paused. Choose an action when ready.';renderDecisionPreview();};
 $('liveInspectSeal').onclick=()=>inspectionView('seal');
}
const sceneRenderOrchestrator=renderOrchestrator;
renderOrchestrator=function(){
 // Remove the moved form before rebuilding, so IDs never exist twice.
 liveDecisionDock.replaceChildren();sceneRenderOrchestrator();mountLiveDecision();
};
const sceneOpenCargoInspection=openCargoInspection;
openCargoInspection=function(number,returnTo=activePage){if(guided.enabled&&guided.status==='paused'&&guided.holdIds.includes(number)){liveConflictDecision=true;returnTo='live';if(conflictPopup.open)conflictPopup.close();}sceneOpenCargoInspection(number,returnTo);if(liveConflictDecision)renderOrchestrator();};
const sceneCloseCargoInspection=closeCargoInspection;
closeCargoInspection=function(back=false){sceneCloseCargoInspection(back);if(liveConflictDecision){liveConflictDecision=false;renderOrchestrator();}};
const sceneStartConflictDemo=startConflictDemo;
startConflictDemo=function(){if(conflictPopup.open)conflictPopup.close();closeCargoInspection(false);liveConflictDecision=false;sceneStartConflictDemo();};
// The initial live button held the old function reference.
$('startConflictLive').onclick=()=>startConflictDemo();
$('scenario').addEventListener('change',()=>{if(conflictPopup.open)conflictPopup.close();closeCargoInspection(false);liveConflictDecision=false;renderOrchestrator();});
window.addEventListener('hashchange',()=>{if(location.hash!=='#live'&&conflictPopup.open)conflictPopup.close();});
renderOrchestrator();
