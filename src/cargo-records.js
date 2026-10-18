// Cargo records are opened in context from the terminal or evidence dashboards.
function openContainer(number){
 const c=boardOrders().find(c=>c.number===number);if(!c)return;
 const modeled=c.synthetic;
 const rows=modeled?[['Arrival',c.pod_eta_at],['Discharged',c.dischargeStep!==null&&c.dischargeStep<=currentStep?clockOf(c.dischargeStep):'Not yet'],['Terminal exit',c.exitStep!==null&&c.exitStep<=currentStep?clockOf(c.exitStep)+' · '+c.exitMode:'Not yet']]:[['Tracking snapshot','17 Oct 2026'],['Estimated arrival','28 Oct 2026 · 06:00 PDT'],['Pickup availability','Unverified'],['Fees / last free day','Unknown']];
 $('orderDetail').innerHTML=`<div class="detail-heading"><div><h2 id="detailTitle">${esc(number)}</h2><p>${modeled?'Modeled operational state':'Terminal49 recorded tracking'}</p></div><span class="badge blue">${esc(modelStatus[c.current_status]||c.current_status)}</span></div><div class="detail-section"><h3>Vessel & destination</h3><dl><dt>Vessel</dt><dd>${esc(c.pod_vessel_name)}</dd><dt>Terminal</dt><dd>${esc(c.pod_terminal_name)}</dd><dt>Destination</dt><dd>${esc(c.port_of_discharge_name)}</dd>${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="notice-box">${modeled?'Operational events and cargo contents are simulated. They do not establish real clearance.':'The recorded destination is Los Angeles / APM Terminals. The Long Beach terminal and release assumptions are hypothetical.'}</p></div>`;
 if(!$('orderDialog').open)$('orderDialog').showModal();
}
