// Continuous camera inspection in the existing port scene, with explicitly mocked contents.
let cargoInspection=null,inspectionToken=0;
const inspectionHeader=document.createElement('section');inspectionHeader.className='inspection-header card';inspectionHeader.hidden=true;
const inspectionPanel=document.createElement('section');inspectionPanel.className='inspection-panel card padded';inspectionPanel.hidden=true;
const portView=document.querySelector('.port-view');portView.before(inspectionHeader);portView.after(inspectionPanel);
function openCargoInspection(number,returnTo=activePage){
 const record=boardOrders().find(c=>c.number===number);if(!record)return;
 playing=false;if($('orderDialog').open)$('orderDialog').close();
 cargoInspection={number,record,returnTo,profile:cargoModelProfile(number),view:'interior',part:null,doors:true,cutaway:true,location:'Moving to cargo…'};
 inspectionHeader.hidden=false;inspectionPanel.hidden=false;$('operationsInspector').hidden=true;document.querySelector('.live-stage').classList.add('inspecting-cargo');
 $('scrub').disabled=true;$('playBtn').disabled=true;location.hash='live';renderInspectionUI();render();
 const token=++inspectionToken;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token!==inspectionToken||!cargoInspection)return;
  if(window.portInspection?.available){const info=window.portInspection.open(number);cargoInspection.location=info.location;}
  else cargoInspection.location='3D unavailable · manifest preview only';
  renderInspectionUI();portView.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'});
 }));
}
function closeCargoInspection(navigateBack=false){
 if(!cargoInspection)return;const back=cargoInspection.returnTo;inspectionToken++;cargoInspection=null;window.portInspection?.close();inspectionHeader.hidden=true;inspectionPanel.hidden=true;$('operationsInspector').hidden=false;document.querySelector('.live-stage').classList.remove('inspecting-cargo');$('scrub').disabled=false;$('playBtn').disabled=false;operationFocus='yard';selectedCargo=null;renderOperations();if(navigateBack&&back!=='live')location.hash=back;
}
function inspectionView(view,index=null){if(!cargoInspection)return;cargoInspection.view=view;cargoInspection.part=index;
 if(view==='interior'){cargoInspection.doors=true;cargoInspection.cutaway=true;}
 if(view==='exterior'||view==='seal'){cargoInspection.doors=false;cargoInspection.cutaway=false;}
 if(view==='package'){cargoInspection.doors=true;cargoInspection.cutaway=true;}
 window.portInspection?.doors(cargoInspection.doors);window.portInspection?.roof(cargoInspection.cutaway);window.portInspection?.view(view,index);renderInspectionUI();
}
window.selectInspectionPart=(kind,index)=>inspectionView(kind==='seal'?'seal':'package',index);
function renderInspectionUI(){
 if(!cargoInspection)return;const c=cargoInspection,p=c.profile;
 inspectionHeader.innerHTML=`<div><span class="eyebrow">3D CARGO INSPECTION</span><h2>${esc(c.number)}</h2><p>${esc(c.location)} · playback paused</p></div><button class="button" id="leaveCargoInspection">${c.returnTo==='orchestrator'?'← Back to decision':'← Back to port'}</button>`;
 inspectionPanel.innerHTML=`<div class="inspection-view-controls" aria-label="Cargo camera views"><button class="button" data-cargo-view="interior" aria-pressed="${c.view==='interior'}">Interior cutaway</button><button class="button" data-cargo-view="exterior" aria-pressed="${c.view==='exterior'}">Exterior</button><button class="button" data-cargo-view="seal" aria-pressed="${c.view==='seal'}">Door seal</button><button class="button" id="toggleCargoDoors" aria-pressed="${c.doors}">${c.doors?'Close doors':'Open doors'}</button><button class="button" id="toggleCargoRoof" aria-pressed="${c.cutaway}">${c.cutaway?'Show roof':'Hide roof'}</button></div><div class="inspection-manifest"><div><span class="badge amber">Mock contents · illustrative model</span><h2>${p.title}</h2><p>${p.units} · ${p.weight} modeled gross weight</p><p class="muted">Cargo contents and packing are invented for this demo. Terminal49 did not provide an interior manifest. Nearby stacks are hidden during inspection; nothing is unloaded or released.</p></div><div class="inspection-findings" role="status"><small>SELECTED DETAIL</small><h3>${c.view==='seal'?'Door seal & locking bars':c.part!==null?p.packageName+' '+(c.part+1):'Container load'}</h3><p>${c.view==='seal'?(guided.enabled&&guided.holdIds.includes(c.number)?'Mock hold evidence: recorded door seal DEMO-'+esc(c.number)+' differs from original manifest OLD-'+esc(c.number)+'. Verify the replacement-seal record against the updated packing list before approving release.':'Mock seal tag: DEMO-'+esc(c.number)+'. Compare this tag with the mocked document reference before approving the cargo action.'):c.part!==null?p.contents+'. Select another package or drag the scene to orbit.':'Choose a package below or click it in the model to move closer.'}</p></div></div><div class="package-picker" aria-label="Inspect a package">${Array.from({length:p.count},(_,i)=>`<button class="package-choice ${c.part===i?'selected':''}" data-inspection-package="${i}" aria-pressed="${c.part===i}"><span class="package-symbol">${p.key==='cartons'?'▤':p.key==='drums'?'◉':'⚙'}</span><b>P${String(i+1).padStart(2,'0')}</b><small>${p.packageName} ${i+1}</small></button>`).join('')}</div><div class="ops-actions"><button class="button" id="previousCargo">← Previous container</button><button class="button" id="nextCargo">Next container →</button><button class="text-button" id="cargoRecord">Open cargo record</button></div>`;
 $('leaveCargoInspection').onclick=()=>closeCargoInspection(true);
 inspectionPanel.querySelectorAll('[data-cargo-view]').forEach(b=>b.onclick=()=>inspectionView(b.dataset.cargoView));
 inspectionPanel.querySelectorAll('[data-inspection-package]').forEach(b=>b.onclick=()=>inspectionView('package',+b.dataset.inspectionPackage));
 $('toggleCargoDoors').onclick=()=>{c.doors=!c.doors;window.portInspection?.doors(c.doors);renderInspectionUI();};
 $('toggleCargoRoof').onclick=()=>{c.cutaway=!c.cutaway;window.portInspection?.roof(c.cutaway);renderInspectionUI();};
 $('cargoRecord').onclick=()=>openContainer(c.number);
 const all=boardOrders().filter(r=>typeof liveConflictDecision==='undefined'||!liveConflictDecision||guided.holdIds.includes(r.number)),idx=all.findIndex(r=>r.number===c.number);$('previousCargo').disabled=idx<=0;$('nextCargo').disabled=idx===all.length-1;
 for(const [id,delta]of [['previousCargo',-1],['nextCargo',1]])$(id).onclick=()=>{const next=all[idx+delta];if(next)openCargoInspection(next.number,c.returnTo);};
}
const originalInspectOperation=inspectOperation;
inspectOperation=function(type,id){if(type==='container'){openCargoInspection(id,'live');return;}closeCargoInspection(false);originalInspectOperation(type,id);};
// All order dialogs expose the same visual inspection entry point.
const inspectionOpenContainer=openContainer;
openContainer=function(number){inspectionOpenContainer(number);if(!$('orderDialog').open)return;const button=document.createElement('button');button.type='button';button.className='button primary';button.textContent='Inspect cargo in 3D';button.id='inspectRecord3D';button.onclick=()=>openCargoInspection(number,cargoInspection?.returnTo||activePage);$('orderDetail').querySelector('.detail-heading').append(button);};
const originalRenderOrchestratorDetail=renderOrchestratorDetail;
renderOrchestratorDetail=function(incident){originalRenderOrchestratorDetail(incident);
 workbench.querySelectorAll('[data-inspect-order]').forEach(b=>{b.querySelector('small').textContent=(cargoHeld({number:b.dataset.inspectOrder})?'Held for decision':'Mock cargo')+' · inspect in 3D →';b.onclick=()=>openCargoInspection(b.dataset.inspectOrder,'orchestrator');});
 if($('inspectHeld'))$('inspectHeld').onclick=()=>{guided.disposition='inspect';renderOrchestrator();if(guided.holdIds[0])openCargoInspection(guided.holdIds[0],'orchestrator');};
};
window.addEventListener('hashchange',()=>{if(location.hash!=='#live')closeCargoInspection(false);});
renderOrchestrator();
