// ---------- PortTable digital twin ----------
const $ = id => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIER_COL = { medical: '#e5484d', food: '#2fa866', energy: '#f0a020', industry: '#8b5cf6', general: '#c9a77c' };
const AUTO_PLAN = { kind: 'porttable', order: ['medical', 'energy', 'food', 'industry'], dig: 1 };
const money = n => '$' + (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.round(n / 1000) + 'k');
const fmt = n => Math.round(n).toLocaleString('en-US');
const PRESTORM = stepOf('13:30');
const ORD_ID = k => 'ORD-' + String(k + 1).padStart(2, '0');
const TRK_ID = i => 'TRK-' + (2101 + i);
const LIFELINE = ORDERS.map((o, k) => k).filter(k => !ORDERS[k].life);

// ----- layout (plan coordinates in board px, 0.1 world units each) -----
const BERTH_Y = [110, 250, 390, 530];
const YARD = { x: 280, y: 130, w: 190, h: 420 };
const GATE = { x: 545, y: 340 };
const DEST_POS = [
  { x: 770, y: 110, label: 'County Hospital' },
  { x: 770, y: 225, label: 'Grocery DC' },
  { x: 770, y: 340, label: 'Substation' },
  { x: 770, y: 455, label: 'Inland Empire factory' },
  { x: 770, y: 570, label: 'Retail warehouses' },
];
const ROADS = DEST_POS.map(d => [[GATE.x + 40, GATE.y], [620, GATE.y], [655, d.y], [d.x - 62, d.y]]);
const wx = x => (x - 480) * .1, wz = y => (y - 340) * .1;
function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
function pathAt(p, d) {
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === p.length - 1) { const t = l ? Math.max(0, Math.min(1, d / l)) : 0; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }
    d -= l;
  }
}
const ROAD_LEN = ROADS.map(pathLen);
const YARD_SLOTS = [];
for (let r = 0; r < 12; r++) for (let c = 0; c < 7; c++) YARD_SLOTS.push({ x: YARD.x + 17 + c * 26, y: YARD.y + 28 + r * 33 });

// ----- runs -----
const runs = [];
const planText = p => `${p.order.map(t => TIER_NAME[t].split(' ')[0]).join(' › ')} · dig ${p.dig}`;
function buildRun(name, code, color, plan, sub) {
  const r = simulate(plan); Object.assign(r, { name, code, color, plan, sub });
  const agg = new Map();
  r.arrived = DEST_POS.map(() => new Int16Array(STEPS));
  r.orderTruck = ORDERS.map(() => null);
  for (const t of r.sends) {
    const key = t.s0 * 8 + t.d;
    if (!agg.has(key)) agg.set(key, { s0: t.s0, s1: t.s1, d: t.d, n: 0, tier: 'general', orders: new Set(), lane: agg.size % 3 });
    const a = agg.get(key); a.n++;
    const bx = BOXES[t.x];
    if (TIERS.indexOf(bx.tier) < TIERS.indexOf(a.tier)) a.tier = bx.tier;
    if (bx.order >= 0) { a.orders.add(bx.order); const ot = r.orderTruck[bx.order]; if (!ot || t.s0 > ot.s0) r.orderTruck[bx.order] = t; }
    for (let s = t.s1; s < STEPS; s++) r.arrived[t.d][s]++;
  }
  r.trucks = [...agg.values()].sort((a, b) => a.s0 - b.s0 || a.d - b.d);
  // first step each lifeline order reaches each stage: arrived, berthed, off the ship, out the gate, delivered
  r.stages = ORDERS.map((o, k) => {
    const st = [SHIPS[o.ship].s0, -1, -1, -1, r.frames[STEPS - 1].orderDone[k]];
    r.frames.forEach((f, s) => {
      if (st[1] < 0 && f.berth.includes(o.ship)) st[1] = s;
      const w = f.orderWhere[k];
      if (st[2] < 0 && (w === 'yard' || w === 'road' || w === 'done')) st[2] = s;
      if (st[3] < 0 && (w === 'road' || w === 'done')) st[3] = s;
    });
    return st;
  });
  r.onL = LIFELINE.filter(k => r.stages[k][4] >= 0 && r.stages[k][4] <= ORDERS[k].dueS).length;
  return r;
}
function addRun(...a) { runs.push(buildRun(...a)); return runs.length - 1; }
addRun('Today', 'TD', '#8a93a7', { kind: 'today' }, 'Walk-up trucks, first come, first served');
addRun('PortTable · Life 1 only', 'L1', '#5a83ff', { kind: 'booking' }, 'Booked slots, no storm priorities');
const TODAY = 0, AUTO = 2, DRILL = 3;
let decisionLog = [], delegated = false, pending = null, resumeAfter = false, logSel = -1;
let sel = TODAY, lastSmart = AUTO, frameF = PRESTORM, curStep = -1, playing = false, speedIdx = 0;
const SPEEDS = [3, 9];
let focus = { type: 'port' }, tlOrder = 2, tab = 'berths';
let snap = true, reportShownFor = new Set();

// ===================== storm drill: the person decides, PortTable suggests =====================
const TIER_W = { medical: 4, energy: 3, food: 2, industry: 1 };
const onSetOf = r => LIFELINE.filter(k => r.stages[k][4] >= 0 && r.stages[k][4] <= ORDERS[k].dueS);
const utilOf = r => onSetOf(r).reduce((a, k) => a + TIER_W[ORDERS[k].tier] * 1000, 0) + r.score / 1e4;
function rebuildDrill() { const d = runs[DRILL]; runs[DRILL] = buildRun(d.name, d.code, d.color, d.plan, d.sub); }
// the autopilot is PortTable on its own: it takes its own suggestion at every decision point
function autopilotRun() {
  const plan = { ...AUTO_PLAN, live: true, decisions: {} };
  for (let i = 0; i < 20; i++) {
    const r = buildRun('', '', '', plan, '');
    const p = r.points.filter(x => !(x.id in plan.decisions)).sort((a, b) => a.s - b.s)[0];
    if (!p) break;
    const mk = c => buildRun('', '', '', { ...plan, decisions: { ...plan.decisions, [p.id]: c } }, '');
    plan.decisions[p.id] = utilOf(mk('approve')) >= utilOf(mk('reject')) ? 'approve' : 'reject';
  }
  return buildRun('PortTable autopilot', 'PT', '#2457f5', plan, 'Takes every PortTable suggestion on its own');
}
function nextPending() { const r = runs[DRILL]; return r.points.filter(p => !(p.id in r.plan.decisions)).sort((a, b) => a.s - b.s)[0] || null; }
const evalCache = new Map();
// run the rest of the shift both ways, then suggest the option that gets more (and more critical) lifeline cargo out on time
function evaluate(p) {
  const plan = runs[DRILL].plan, key = JSON.stringify(plan.decisions) + '|' + p.id;
  if (evalCache.has(key)) return evalCache.get(key);
  const mk = c => buildRun('', '', '', { ...plan, decisions: { ...plan.decisions, [p.id]: c } }, '');
  const A = mk('approve'), B = mk('reject');
  const res = { p, A, B, material: onSetOf(A).join() !== onSetOf(B).join(), rec: utilOf(A) >= utilOf(B) ? 'approve' : 'reject' };
  evalCache.set(key, res); return res;
}
function decisionTitle(p) {
  if (p.id === 'mode') return 'Switch to lifeline mode for the storm?';
  const [kind, v] = p.id.split(':');
  if (kind === 'swap') return `Swap ${SHIPS[+v].name} into berth B${p.info.berth + 1}?`;
  return `Dig out the ${ORDERS[+v].what.toLowerCase()}?`;
}
function shortTitle(p) {
  if (p.id === 'mode') return 'Lifeline mode';
  const [kind, v] = p.id.split(':');
  return kind === 'swap' ? `Swap ${SHIPS[+v].name} into B${p.info.berth + 1}` : `Dig out ${ORDERS[+v].what}`;
}
function decisionContext(p) {
  if (p.id === 'mode') return 'Weather service: from 2 PM, wind will close berths B3 and B4 until midnight. Lifeline mode keeps lifeline ships off those berths, lets them swap into the sheltered ones, and sends lifeline cargo to the cranes and the gate first. Rejecting keeps first come, first served.';
  const [kind, v] = p.id.split(':');
  if (kind === 'swap') {
    const sh = SHIPS[+v], out = SHIPS[p.info.out];
    const aboard = LIFELINE.filter(k => ORDERS[k].ship === sh.id).map(k => ORDERS[k].what.toLowerCase());
    const outOrders = LIFELINE.filter(k => ORDERS[k].ship === out.id).map(k => ORDERS[k].what.toLowerCase());
    return `${sh.name} is waiting at anchor with ${aboard.join(' and ')}. Sheltered berth B${p.info.berth + 1} is busy with ${out.name}, which carries ${outOrders.length ? 'only lower-tier cargo (' + outOrders.join(', ') + ')' : 'general cargo'}. Approving sends ${out.name} back to anchor until a berth frees up.`;
  }
  const o = ORDERS[+v];
  return `The ${o.n} boxes of ${o.what.toLowerCase()} are under ${p.info.depth} other boxes on ${SHIPS[o.ship].name} at berth B${p.info.berth + 1}. Digging them out costs two crane moves per box and slows everything else on that berth.`;
}
function outcomeLines(X, Y) {
  const sx = onSetOf(X), sy = onSetOf(Y), lines = [];
  const t = k => X.stages[k][4] >= 0 ? clockOf(X.stages[k][4]) : 'after the shift';
  sx.filter(k => !sy.includes(k)).forEach(k => lines.push(['ok', `${ORDERS[k].what} on time (${t(k)}, due ${ORDERS[k].due})`]));
  sy.filter(k => !sx.includes(k)).forEach(k => lines.push(['bad', `${ORDERS[k].what} late (${t(k)}, due ${ORDERS[k].due})`]));
  LIFELINE.filter(k => sx.includes(k) && sy.includes(k)).forEach(k => {
    const d = (X.stages[k][4] - Y.stages[k][4]) * STEP_MIN;
    if (d >= 60) lines.push(['warn', `${ORDERS[k].what} ${Math.floor(d / 60)}h${d % 60 ? ' ' + d % 60 + 'm' : ''} later, still on time`]);
  });
  return lines.length > 4 ? [...lines.slice(0, 3), ['', `and ${lines.length - 3} more`]] : lines;
}
function recReason(ev) {
  const X = ev.rec === 'approve' ? ev.A : ev.B, Y = ev.rec === 'approve' ? ev.B : ev.A;
  const gains = onSetOf(X).filter(k => !onSetOf(Y).includes(k)).map(k => ORDERS[k].what);
  return gains.length ? `It gets ${gains.length === 1 ? gains[0] : gains.slice(0, -1).join(', ') + ' and ' + gains[gains.length - 1]} out on time.` : 'Both options deliver the same lifeline orders on time; this one moves more cargo overall.';
}
function decideNow(choice, how) {
  const ev = pending; if (!ev) return;
  const X = choice === 'approve' ? ev.A : ev.B;
  runs[DRILL].plan.decisions[ev.p.id] = choice;
  decisionLog.push({ id: ev.p.id, s: ev.p.s, choice, how, rec: ev.rec, title: shortTitle(ev.p), onL: onSetOf(X).length, lines: outcomeLines(X, choice === 'approve' ? ev.B : ev.A) });
  pending = null; rebuildDrill(); snap = true;
  if (focus.type === 'decision') focus = { type: 'port' };
  $('decBar').hidden = true;
  resumeAfter = resumeAfter && !pending;
  if (resumeAfter) { playing = true; updatePlay(); }
  renderSite(); tick(true);
}
function checkDrill() {
  if (sel !== DRILL || pending) return;
  const p = nextPending();
  if (!p || frameF < p.s) return;
  frameF = p.s;
  const ev = evaluate(p);
  pending = ev; resumeAfter = playing || resumeAfter;
  if (!ev.material || delegated) { decideNow(ev.rec, ev.material ? 'delegated' : 'auto'); return; }
  playing = false; updatePlay(); tick(true);
  focus = { type: 'decision' }; renderInspector(curStep); showDecBar();
  const pos = ev.p.id === 'mode' ? null : ev.p.id.startsWith('swap') ? shipPos(+ev.p.id.split(':')[1]) : new THREE.Vector3(-28, 0, wz(BERTH_Y[ev.p.info.berth]));
  if (pos) flyFocus(pos, 48); else flyTo(HOME.pos.clone(), HOME.tgt.clone());
}
function showDecBar() {
  const ev = pending;
  $('decTitle').textContent = `Decision needed · ${clockOf(ev.p.s)}`;
  $('decText').textContent = decisionTitle(ev.p);
  $('decSug').textContent = `PortTable suggests: ${ev.rec === 'approve' ? 'Approve' : 'Reject'}`;
  $('decBar').hidden = false;
}
function revisit(i) {
  const e = decisionLog[i];
  for (const x of decisionLog.slice(i)) delete runs[DRILL].plan.decisions[x.id];
  decisionLog = decisionLog.slice(0, i); delegated = false; pending = null; resumeAfter = false;
  rebuildDrill(); frameF = Math.max(0, e.s - 1); snap = true; playing = false; updatePlay();
  focus = { type: 'port' }; renderSite(); tick(true);
}

runs.push(autopilotRun());
runs.push(buildRun('Storm drill · you decide', 'YOU', '#e0861a', { ...AUTO_PLAN, live: true, decisions: {} }, 'You approve or reject PortTable\'s moves as the storm unfolds'));

// ===================== 3D scene =====================
const host = $('scene');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { renderer = null; }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 16 / 10, 1, 700);
let controls = null;
if (renderer) {
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.maxPolarAngle = 1.3; controls.minDistance = 18; controls.maxDistance = 190;
} else host.innerHTML = '<div class="nogl">This 3D view needs WebGL. Try a recent Chrome, Edge, Firefox or Safari.</div>';
const HOME = { pos: new THREE.Vector3(-42, 84, 90), tgt: new THREE.Vector3(-8, 0, -2) };
camera.position.copy(HOME.pos); if (controls) controls.target.copy(HOME.tgt); else camera.lookAt(HOME.tgt);
let camAnim = null;
function flyTo(pos, tgt) {
  if (!controls) return;
  if (reduced) { camera.position.copy(pos); controls.target.copy(tgt); return; }
  camAnim = { from: { pos: camera.position.clone(), tgt: controls.target.clone() }, to: { pos, tgt }, t: 0 };
}
function flyFocus(p, dist = 42) {
  const dir = camera.position.clone().sub(controls ? controls.target : HOME.tgt).normalize();
  flyTo(p.clone().add(dir.multiplyScalar(dist)), p.clone());
}

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: .02, ...o });
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
const hemi = new THREE.HemisphereLight(0xffffff, 0xc9d2e3, .62); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfffaf0, 1.25);
sun.position.set(-30, 90, 50); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70, near: 10, far: 260 });
scene.add(sun);
scene.fog = new THREE.Fog(0xeef3fb, 230, 420);

// sea
const seaGeo = new THREE.PlaneGeometry(160, 240, 48, 72); seaGeo.rotateX(-Math.PI / 2);
const seaMat = M(0x6fb0ec, { roughness: .35, flatShading: true });
const sea = new THREE.Mesh(seaGeo, seaMat); sea.position.set(-107.5, -.7, 0); sea.receiveShadow = true; scene.add(sea);
const seaBase = Float32Array.from(seaGeo.attributes.position.array);
// land, apron, quay edge
box(170, 2, 240, M(0xd9e0ec), 57.5, -1, 0, scene, false);
box(5.6, .16, 240, M(0xf6f8fc), -24.9, .08, 0, scene, false);
box(.5, .5, 240, M(0xffffff), -27.6, .25, 0, scene, false);
for (let z = -60; z <= 60; z += 3.2) box(.35, .45, .35, M(0x8a93a7), -27.1, .5, z, scene, false);
// yard pad with yellow work-zone outlines
(function () {
  const c = document.createElement('canvas'); c.width = 190; c.height = 420;
  const g = c.getContext('2d'); g.fillStyle = '#dde3ee'; g.fillRect(0, 0, 190, 420);
  g.strokeStyle = '#f2c94c'; g.lineWidth = 2.2;
  for (const sl of YARD_SLOTS) g.strokeRect(sl.x - 11 - YARD.x, sl.y - 14 - YARD.y, 22, 28);
  g.setLineDash([10, 8]); g.strokeRect(3, 3, 184, 414);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  const side = M(0xd3dae6);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(YARD.w * .1, .2, YARD.h * .1), [side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }), side, side, side]);
  pad.position.set(wx(YARD.x + YARD.w / 2), .1, wz(YARD.y + YARD.h / 2)); pad.receiveShadow = true; scene.add(pad);
  pad.userData.pick = { type: 'yard' };
})();
// conveyors berth -> yard and yard -> gate
const beltMat = M(0xffffff), beltRail = M(0x2457f5);
for (const y of BERTH_Y) { box(5.4, .3, 1.2, beltRail, wx(256), .18, wz(y), scene, false); box(5.4, .34, .8, beltMat, wx(256), .2, wz(y), scene, false); }
box(4.6, .3, 1.2, beltRail, wx(497), .18, wz(GATE.y), scene, false); box(4.6, .34, .8, beltMat, wx(497), .2, wz(GATE.y), scene, false);
// roads with lane dashes
const roadMat = M(0xcdd5e4), dashMat = M(0xffffff);
for (const p of ROADS) for (let i = 1; i < p.length; i++) {
  const a = p[i - 1], b = p[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]) * .1, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const cx = wx((a[0] + b[0]) / 2), cz = wz((a[1] + b[1]) / 2);
  const r = box(len + 2.6, .1, 2.6, roadMat, cx, .05, cz, scene, false); r.rotation.y = -ang;
  for (let d = -len / 2 + .8; d < len / 2 - .4; d += 2) {
    const m = box(.9, .12, .14, dashMat, cx + Math.cos(ang) * d, .06, cz + Math.sin(ang) * d, scene, false); m.rotation.y = -ang;
  }
}
// trees
const trunkMat = M(0x9b7b5b), leafMats = [M(0x5cb85c), M(0x48a868), M(0x6cc070)];
const rndT = mulberry(31);
function tree(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(.35 * s, 1.6 * s, .35 * s, trunkMat, 0, .8 * s, 0, g);
  const l = new THREE.Mesh(new THREE.SphereGeometry(1.25 * s, 10, 8), leafMats[Math.floor(rndT() * 3)]); l.position.y = 2.4 * s; l.scale.y = 1.15; l.castShadow = true; g.add(l);
}
for (let z = -26; z <= 26; z += 6.5) { if (Math.abs(z) > 3) tree(wx(600), z + 1.5, .8); }
for (let x = 2; x <= 30; x += 6) { tree(x, wz(60), .85); tree(x + 3, wz(625), .85); }
for (const d of DEST_POS) { tree(wx(d.x) + 7.4, wz(d.y) - 3, .8); tree(wx(d.x) + 7.4, wz(d.y) + 3, .7); }
for (let i = 0; i < 10; i++) tree(-18 + rndT() * 30, -42 - rndT() * 14, .9 + rndT() * .3);
// gate canopy
const gateGroup = new THREE.Group(); gateGroup.position.set(wx(GATE.x), 0, wz(GATE.y)); scene.add(gateGroup);
box(7.4, .55, 17.4, M(0xffffff), 0, 4.4, 0, gateGroup);
box(7.6, .3, 17.6, M(0x2457f5), 0, 4.05, 0, gateGroup);
for (const z of [-7.8, -2.6, 2.6, 7.8]) for (const x of [-3.1, 3.1]) box(.4, 4, .4, M(0xc7cfdd), x, 2, z, gateGroup);
for (const z of [-5.2, 0, 5.2]) { box(1.4, 1.9, 1.4, M(0xffffff), 0, .95, z, gateGroup); box(1.42, .3, 1.42, M(0x2457f5), 0, 1.95, z, gateGroup); }
gateGroup.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'gate' }; });
// destinations
const BLUE = M(0x2457f5), WHITE = M(0xffffff), WIN = M(0x9fb7ee);
const destGroups = DEST_POS.map((d, i) => {
  const g = new THREE.Group(); g.position.set(wx(d.x), 0, wz(d.y)); scene.add(g);
  box(13, .16, 10, M(0xf3f5fa), 0, .08, 0, g, false);
  if (i === 0) {
    box(8.4, 4.6, 6.6, WHITE, -.6, 2.3, 0, g); box(3.6, 7, 3.4, WHITE, 2.2, 3.5, 0, g);
    box(2.6, .25, .7, M(0xe5484d), 2.2, 7.1, 0, g); box(.7, .25, 2.6, M(0xe5484d), 2.2, 7.1, 0, g);
    for (let k = -3.5; k <= 1.5; k += 1.6) box(1, .7, .1, WIN, k, 2.8, 3.35, g, false);
  }
  if (i === 1) {
    box(10.2, 3.8, 7, WHITE, 0, 1.9, 0, g); box(10.4, .35, 7.2, M(0x2fa866), 0, 3.9, 0, g);
    for (let k = -3.6; k <= 3.6; k += 2.4) { box(1.6, 2.2, .14, BLUE, k, 1.1, 3.55, g, false); box(1.3, 1.9, .16, M(0xe9edf5), k, 1, 3.6, g, false); }
  }
  if (i === 2) {
    box(10.4, .3, 7.8, M(0xd3dae6), 0, .2, 0, g);
    for (const x of [-3.2, 0, 3.2]) { box(2.1, 2.5, 2.2, M(0xeef1f6), x, 1.6, -1.4, g); box(.3, 1.3, .3, M(0xf0a020), x, 3.4, -1.4, g); }
    box(2, 2, 2.6, M(0xf0a020), -2.6, 1.2, 2.3, g); box(2, 2, 2.6, M(0xf0a020), .6, 1.2, 2.3, g);
  }
  if (i === 3) {
    box(10.6, 3.2, 7.4, WHITE, 0, 1.6, 0, g);
    for (let k = -4; k <= 4.2; k += 2.7) { const r = box(2.7, 1.5, 7.4, BLUE, k, 3.7, 0, g); r.rotation.z = .5; }
    box(.9, 6.4, .9, M(0xc7cfdd), 4.4, 3.2, -2.9, g);
  }
  if (i === 4) {
    box(10.6, 4, 7.4, M(0xf1f3f8), 0, 2, 0, g); box(10.8, .3, 7.6, M(0xd5dcea), 0, 4.1, 0, g);
    for (let k = -3.6; k <= 3.6; k += 1.8) { box(1.3, 2.2, .14, BLUE, k, 1.1, 3.75, g, false); }
    for (let k = -3; k <= 3; k += 3) box(1.2, .6, 1.2, M(0xc7cfdd), k, 4.55, -1.5, g);
  }
  g.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'dest', i }; });
  return g;
});
// cranes
const craneParts = BERTH_Y.map((y, b) => {
  const g = new THREE.Group(); g.position.set(-23.6, 0, wz(y)); scene.add(g);
  const leg = M(0xf4f6fb), boom = M(0x2457f5);
  for (const x of [-1.6, 1.6]) for (const z of [-3.2, 3.2]) box(.45, 11, .45, leg, x, 5.5, z, g);
  box(3.8, .5, .5, leg, 0, 10.5, -3.2, g); box(3.8, .5, .5, leg, 0, 10.5, 3.2, g);
  box(19, .6, 1.1, boom, -5.5, 11.2, 0, g);
  box(2, 1.9, 2.6, WHITE, 1.2, 12.3, 0, g);
  const trolley = box(1.4, .9, 1.6, WHITE, -8, 10.4, 0, g);
  const cable = box(.08, 4, .08, M(0x4a5266), -8, 8, 0, g, false);
  const spreader = box(1.3, .3, 2.6, M(0xf2c94c), -8, 6, 0, g);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  beacon.position.set(1.2, 13.6, 0); beacon.visible = false; g.add(beacon);
  const zone = new THREE.Mesh(new THREE.BoxGeometry(13, 7, 13.4), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: .14, depthWrite: false }));
  zone.position.set(-7.4, 3.2, 0); zone.visible = false; g.add(zone);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(zone.geometry), new THREE.LineBasicMaterial({ color: 0xe5484d }));
  edges.position.copy(zone.position); edges.visible = false; g.add(edges);
  g.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'berth', b }; });
  zone.userData.pick = null;
  return { g, leg: boom, trolley, cable, spreader, beacon, zone, edges };
});
// ships
const GEN_COLS = [0xd9b48a, 0xe9e4da, 0xc7d2e6, 0xb9a184, 0xf1efe9, 0xa9bad6];
const shipObjs = SHIPS.map(sh => {
  const L = 11.8, Wd = 3.2;
  const g = new THREE.Group(); scene.add(g);
  const shape = new THREE.Shape();
  shape.moveTo(-L / 2, -Wd / 2); shape.lineTo(L / 2 - 1.9, -Wd / 2); shape.lineTo(L / 2, 0); shape.lineTo(L / 2 - 1.9, Wd / 2); shape.lineTo(-L / 2, Wd / 2); shape.closePath();
  const hg = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false }); hg.rotateX(Math.PI / 2); hg.translate(0, 1.0, 0);
  const hull = new THREE.Mesh(hg, M(0x1d3f9e)); hull.castShadow = true; g.add(hull);
  const deck = new THREE.Mesh(hg.clone().scale(.97, .06, .9), WHITE); deck.position.y = .96; g.add(deck);
  box(1.6, 2.6, 2.9, WHITE, -L / 2 + 1.2, 2.3, 0, g);
  box(1.62, .45, 2.92, M(0x9fb7ee), -L / 2 + 1.2, 3.1, 0, g, false);
  box(.5, 1.1, .5, M(0x2457f5), -L / 2 + 1.2, 4.1, 0, g);
  const special = [];
  for (const [t, n] of Object.entries(sh.mix)) for (let q = 0; q < Math.max(1, Math.round(n / 3)); q++) special.push(new THREE.Color(TIER_COL[t]));
  const spots = [5, 12, 19, 26, 9, 23];
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, .95, 1.4), M(0xffffff), 28);
  const tmp = new THREE.Object3D(); let n = 0;
  for (let layer = 1; layer >= 0; layer--) for (let k = 0; k < 7; k++) for (let j = 0; j < 2; j++) {
    tmp.position.set(-L / 2 + 2.7 + k * 1.15, 2.05 + layer * 1.0, (j - .5) * 1.45); tmp.updateMatrix();
    inst.setMatrixAt(n, tmp.matrix);
    const sp = spots.indexOf(n);
    inst.setColorAt(n, sp >= 0 && sp < special.length ? special[sp] : new THREE.Color(GEN_COLS[(sh.id * 3 + n) % GEN_COLS.length]));
    n++;
  }
  inst.castShadow = true; g.add(inst);
  g.scale.setScalar(1.2);
  g.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'ship', id: sh.id }; });
  g.visible = false;
  return { g, inst, cur: new THREE.Vector3(-170, 0, 0) };
});
// yard containers, trucks, conveyor items
const yardInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 1.0, 2.5), M(0xffffff), YARD_SLOTS.length * 3);
yardInst.castShadow = yardInst.receiveShadow = true; scene.add(yardInst); yardInst.userData.pick = { type: 'yard' };
const TRUCKS = 60;
const trailers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 1.15, 1.05), M(0xffffff), TRUCKS);
const stripes = new THREE.InstancedMesh(new THREE.BoxGeometry(2.32, .3, 1.07), M(0xffffff), TRUCKS);
const cabs = new THREE.InstancedMesh(new THREE.BoxGeometry(.95, 1.05, 1.05), M(0x2457f5), TRUCKS);
trailers.castShadow = cabs.castShadow = true; scene.add(trailers, stripes, cabs);
let truckSlots = [];
const beltInst = new THREE.InstancedMesh(new THREE.BoxGeometry(.62, .5, .62), M(0xd9b48a), 40); scene.add(beltInst);
// pins and route preview
const pinMat = M(0x2457f5, { emissive: 0x0b2a8a, emissiveIntensity: .35 }), pinRed = M(0xe5484d, { emissive: 0x6b0a06, emissiveIntensity: .35 });
function makePin(s = 1) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(.85, 18, 14), pinMat); head.position.y = 1.9; head.castShadow = true;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.62, 1.5, 16), pinMat); tip.rotation.x = Math.PI; tip.position.y = .95;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 10), WHITE); dot.position.set(0, 1.95, .62);
  g.add(head, tip, dot); g.scale.setScalar(s); g.visible = false; scene.add(g);
  g.userData.parts = [head, tip];
  return g;
}
const pins = Array.from({ length: 10 }, () => makePin(1));
const bigPin = makePin(1.6);
const routeDots = new THREE.InstancedMesh(new THREE.SphereGeometry(.32, 10, 8), M(0x2457f5, { emissive: 0x0b2a8a, emissiveIntensity: .4 }), 120);
routeDots.count = 0; scene.add(routeDots);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.3, 40), new THREE.MeshBasicMaterial({ color: 0x2457f5, transparent: true, opacity: .55, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
const selBox = new THREE.Box3Helper(new THREE.Box3(), 0x2457f5); selBox.visible = false; scene.add(selBox);
const selVol = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2457f5, transparent: true, opacity: .1, depthWrite: false })); selVol.visible = false; scene.add(selVol);
// rain and lamps
const RAIN = 1200, rainPos = new Float32Array(RAIN * 6), rainSeed = mulberry(17);
const drops = Array.from({ length: RAIN }, () => ({ x: -80 + rainSeed() * 150, y: rainSeed() * 50, z: -50 + rainSeed() * 100, v: 30 + rainSeed() * 20 }));
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x7f8fb0, transparent: true, opacity: .5 }));
rain.frustumCulled = false; scene.add(rain);
const lamps = [...BERTH_Y.map(y => [-22, 12, wz(y)]), [wx(GATE.x), 10, wz(GATE.y)]].map(([x, y, z]) => {
  const l = new THREE.PointLight(0xffd9a0, 0, 28, 1.6); l.position.set(x, y, z); scene.add(l); return l;
});

// ----- HTML labels pinned to the scene -----
const labelLayer = $('labels');
function makeTag() { const el = document.createElement('div'); el.className = 'tag'; labelLayer.appendChild(el); return { el, p: new THREE.Vector3(), html: '' }; }
const tags = {
  anchor: makeTag(), berths: BERTH_Y.map(() => makeTag()), dests: DEST_POS.map(() => makeTag()), focus: makeTag(),
};
tags.anchor.p.set(-45, 3, -28);
BERTH_Y.forEach((y, b) => tags.berths[b].p.set(-31, 5.2, wz(y) + 6.6));
DEST_POS.forEach((d, i) => tags.dests[i].p.set(wx(d.x), 8.6, wz(d.y)));
const pv = new THREE.Vector3();
function place(t) {
  pv.copy(t.p).project(camera);
  const w = host.clientWidth, h = host.clientHeight;
  if (pv.z > 1 || Math.abs(pv.x) > 1.1 || Math.abs(pv.y) > 1.1) { t.el.style.display = 'none'; return; }
  t.el.style.display = '';
  t.el.style.transform = `translate(${(pv.x + 1) / 2 * w}px, ${(1 - pv.y) / 2 * h}px) translate(-50%, -100%)`;
}
function setTag(t, html, cls = '') { if (t.html !== html) { t.el.innerHTML = html; t.html = html; } t.el.className = 'tag ' + cls; }
let pops = [];
function addPop(p, text, cls) {
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text; labelLayer.appendChild(el);
  const pop = { el, p: p.clone() }; pops.push(pop);
  setTimeout(() => { el.remove(); pops = pops.filter(x => x !== pop); }, 1800);
}

// ----- per-frame scene update -----
const tmpO = new THREE.Object3D(), tmpC = new THREE.Color();
const SKY = { day: new THREE.Color(0xeef3fb), night: new THREE.Color(0x7a87a6), storm: new THREE.Color(0xc3cbd8), stormNight: new THREE.Color(0x6a7590) };
function sunAt(sf) {
  const m = ((H0 * 60 + sf * STEP_MIN) % 1440) / 60;
  if (m < 5.8) return 0; if (m < 6.8) return m - 5.8; if (m < 18.6) return 1; if (m < 19.6) return 1 - (m - 18.6); return 0;
}
function shipTarget(id, f, s) {
  const b = f.berth.indexOf(id);
  if (b >= 0) return { x: -31.6, z: wz(BERTH_Y[b]), show: true };
  const a = f.anchor.indexOf(id);
  if (a >= 0) return { x: -45 - Math.floor(a / 4) * 8, z: -19 + (a % 4) * 13, show: true };
  if (s >= SHIPS[id].s0) return { x: -170, z: wz(BERTH_Y[id % 4]), show: false };
  return { x: -170, z: -20 + (id % 4) * 14, show: false };
}
function shipPos(id) { return shipObjs[id].g.visible ? shipObjs[id].g.position.clone() : null; }
function orderPos(k, f, s) {
  const w = f.orderWhere[k], o = ORDERS[k];
  if (w === 'anchor' || w === 'berth') return shipPos(o.ship);
  if (w === 'yard') return new THREE.Vector3(wx(YARD.x + YARD.w - 20), 1, wz(GATE.y));
  if (w === 'road') { const t = runs[sel].orderTruck[k]; if (t && frameF >= t.s0 && frameF < t.s1) { const q = pathAt(ROADS[t.d], (frameF - t.s0) / (t.s1 - t.s0) * ROAD_LEN[t.d]); return new THREE.Vector3(wx(q.x), 1, wz(q.y)); } }
  if (w === 'done') { const d = DEST_POS[DIDX[o.dest]]; return new THREE.Vector3(wx(d.x), 1, wz(d.y)); }
  return null;
}
function update3D(T, dt) {
  const run = runs[sel], s = Math.min(STEPS - 1, Math.floor(frameF)), f = run.frames[s];
  const smart = run.plan.kind === 'porttable';
  const daylight = sunAt(frameF), storm = inStorm(s);
  const sky = (storm ? SKY.storm.clone().lerp(SKY.stormNight, 1 - daylight) : SKY.night.clone().lerp(SKY.day, daylight));
  scene.background = sky; scene.fog.color.copy(sky);
  sun.intensity = (storm ? .55 : 1.25) * (.3 + .7 * daylight);
  hemi.intensity = .5 + .2 * daylight;
  lamps.forEach(l => l.intensity = (1 - daylight) * .55);
  seaMat.color.set(storm ? 0x5f8bb8 : 0x6fb0ec);
  const amp = storm ? .5 : .14, pos = seaGeo.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) { const x = seaBase[i], z = seaBase[i + 2]; pos[i + 1] = Math.sin(x * .35 + T * (storm ? 2.2 : 1)) * amp + Math.cos(z * .27 + T * .8) * amp * .6; }
  seaGeo.attributes.position.needsUpdate = true;
  rain.visible = storm;
  if (storm) {
    drops.forEach((d, i) => {
      d.y -= d.v * dt; d.x += 3.5 * dt;
      if (d.y < 0) { d.y = 45 + Math.random() * 8; d.x = -80 + Math.random() * 150; }
      const o = i * 6; rainPos[o] = d.x; rainPos[o + 1] = d.y; rainPos[o + 2] = d.z; rainPos[o + 3] = d.x - .45; rainPos[o + 4] = d.y + 1.4; rainPos[o + 5] = d.z;
    });
    rainGeo.attributes.position.needsUpdate = true;
  }
  // ships ease toward their anchor slot or berth, and sail away when done
  const ease = snap ? 1 : 1 - Math.pow(.03, dt);
  SHIPS.forEach((sh, id) => {
    const o = shipObjs[id], tg = shipTarget(id, f, s);
    if (!tg.show && !o.g.visible) { o.cur.set(tg.x, 0, tg.z); return; }
    o.cur.lerp(new THREE.Vector3(tg.x, 0, tg.z), ease);
    if (!tg.show && o.cur.x < -120) { o.g.visible = false; return; }
    o.g.visible = true;
    o.g.position.set(o.cur.x, storm ? Math.sin(T * 1.5 + id) * .22 : 0, o.cur.z);
    o.g.rotation.set(storm ? Math.sin(T * 1.3 + id) * .035 : 0, Math.PI / 2, 0);
    const b = f.berth.indexOf(id);
    const left = b >= 0 ? f.berthLeft[b] : (f.anchor.includes(id) ? sh.boxes : 0);
    o.inst.count = Math.ceil(28 * left / sh.boxes);
  });
  BERTH_Y.forEach((y, b) => {
    const c = craneParts[b], closed = storm && STORM_BERTHS.includes(b);
    const working = f.berth[b] >= 0 && !closed && f.berthOut[b] > 0;
    const tx = working ? -8 + Math.sin(T * 1.2 + b) * 4 : -3;
    const lift = working ? 6 + Math.max(0, Math.sin(T * 2.4 + b)) * 3 : 8.5;
    c.trolley.position.x = c.cable.position.x = c.spreader.position.x = tx;
    c.spreader.position.y = lift; c.cable.scale.y = (10.4 - lift) / 4; c.cable.position.y = (10.4 + lift) / 2;
    c.leg.color.set(closed ? 0x9aa3b5 : 0x2457f5);
    c.beacon.visible = closed && Math.floor(T * 3) % 2 === 0;
    c.zone.visible = c.edges.visible = closed;
    c.zone.material.opacity = .1 + Math.sin(T * 3) * .04;
  });
  // yard stacks: PortTable keeps lifeline boxes in the rows nearest the gate
  const total = f.yard, perSlot = Math.max(2, Math.ceil(total / (YARD_SLOTS.length * 3)));
  const cells = [];
  TIERS.forEach((t, i) => { const n = Math.ceil(f.yardTier[i] / perSlot); for (let j = 0; j < n; j++) cells.push(t); });
  const order = smart ? cells : cells.slice().sort((a, b) => ((TIERS.indexOf(a) * 7919) % 13) - ((TIERS.indexOf(b) * 7919) % 13));
  const nCells = Math.min(order.length, YARD_SLOTS.length * 3);
  for (let j = 0; j < nCells; j++) {
    const k = j % YARD_SLOTS.length;
    const slot = smart ? YARD_SLOTS[(k % 12) * 7 + (6 - Math.floor(k / 12))] : YARD_SLOTS[(k * 37) % YARD_SLOTS.length];
    tmpO.position.set(wx(slot.x), .75 + Math.floor(j / YARD_SLOTS.length) * 1.08, wz(slot.y)); tmpO.rotation.set(0, 0, 0); tmpO.scale.set(1, 1, 1); tmpO.updateMatrix();
    yardInst.setMatrixAt(j, tmpO.matrix); yardInst.setColorAt(j, tmpC.set(TIER_COL[order[j]]));
  }
  yardInst.count = nCells; yardInst.instanceMatrix.needsUpdate = true; if (yardInst.instanceColor) yardInst.instanceColor.needsUpdate = true;
  // trucks
  let nt = 0; truckSlots = [];
  run.trucks.forEach((tr, ti) => {
    if (frameF < tr.s0 || frameF >= tr.s1 || nt >= TRUCKS) return;
    const q = pathAt(ROADS[tr.d], (frameF - tr.s0) / (tr.s1 - tr.s0) * ROAD_LEN[tr.d]);
    const side = (tr.lane - 1) * .4, nx = -Math.sin(q.ang), nz = Math.cos(q.ang);
    const x = wx(q.x) + nx * side, z = wz(q.y) + nz * side;
    tmpO.position.set(x, .78, z); tmpO.rotation.set(0, -q.ang, 0); tmpO.updateMatrix(); trailers.setMatrixAt(nt, tmpO.matrix);
    trailers.setColorAt(nt, tmpC.set(tr.tier === 'general' ? 0xffffff : TIER_COL[tr.tier]));
    tmpO.position.y = 1.2; tmpO.updateMatrix(); stripes.setMatrixAt(nt, tmpO.matrix); stripes.setColorAt(nt, tmpC.set(tr.tier === 'general' ? 0x2457f5 : 0xffffff));
    tmpO.position.set(x + Math.cos(q.ang) * 1.7, .72, z + Math.sin(q.ang) * 1.7); tmpO.updateMatrix(); cabs.setMatrixAt(nt, tmpO.matrix);
    truckSlots.push({ ti, x, z }); nt++;
  });
  trailers.count = stripes.count = cabs.count = nt;
  [trailers, stripes, cabs].forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  let nb = 0;
  const flow = (x0, x1, z) => { const off = (T * 3) % 1.5; for (let d = off; d < Math.abs(x1 - x0) && nb < 40; d += 1.5) { tmpO.position.set(x0 + Math.sign(x1 - x0) * d, .62, z); tmpO.rotation.set(0, 0, 0); tmpO.updateMatrix(); beltInst.setMatrixAt(nb++, tmpO.matrix); } };
  BERTH_Y.forEach((y, b) => { if (f.berthOut[b] > 0) flow(wx(230), wx(283), wz(y)); });
  if (f.gateOut > 0) flow(wx(472), wx(522), wz(GATE.y));
  beltInst.count = nb; beltInst.instanceMatrix.needsUpdate = true;

  // pins over ships still carrying lifeline orders
  pins.forEach(p => p.visible = false);
  let pi = 0;
  const shipsWithOrders = new Set(LIFELINE.filter(k => f.orderDone[k] < 0 && ['anchor', 'berth'].includes(f.orderWhere[k])).map(k => ORDERS[k].ship));
  for (const id of shipsWithOrders) {
    const p = shipPos(id); if (!p || pi >= pins.length) continue;
    const pin = pins[pi++], b = f.berth.indexOf(id), stuck = b >= 0 && storm && STORM_BERTHS.includes(b);
    pin.visible = true; pin.position.set(p.x, 5.2 + Math.sin(T * 2.4 + id) * .3, p.z);
    pin.userData.parts.forEach(m => m.material = stuck ? pinRed : pinMat);
  }
  // selected order: big pin at its current location and a route preview to the destination
  routeDots.count = 0; bigPin.visible = false; ring.visible = false;
  const k = focus.type === 'order' ? focus.k : (focus.type === 'truck' ? null : null);
  let routeFrom = null, routeD = null;
  if (focus.type === 'order') {
    const p = orderPos(k, f, s), w = f.orderWhere[k];
    routeD = DIDX[ORDERS[k].dest];
    if (p && w !== 'done') { bigPin.visible = true; bigPin.position.set(p.x, (w === 'road' ? 2 : 5.4) + Math.sin(T * 2.4) * .3, p.z); }
    routeFrom = w === 'road' ? p : (w === 'done' || w === 'due' ? null : new THREE.Vector3(wx(GATE.x + 40), 0, wz(GATE.y)));
    if (w === 'road') routeFrom = p;
  } else if (focus.type === 'truck') {
    const tr = run.trucks[focus.ti];
    if (tr && frameF >= tr.s0 && frameF < tr.s1) { const q = pathAt(ROADS[tr.d], (frameF - tr.s0) / (tr.s1 - tr.s0) * ROAD_LEN[tr.d]); routeFrom = new THREE.Vector3(wx(q.x), 0, wz(q.y)); routeD = tr.d; }
  }
  if (routeFrom && routeD !== null) {
    const p = ROADS[routeD];
    let startD = 0, best = 1e9;
    for (let d = 0; d <= ROAD_LEN[routeD]; d += 4) { const q = pathAt(p, d), dd = Math.hypot(wx(q.x) - routeFrom.x, wz(q.y) - routeFrom.z); if (dd < best) { best = dd; startD = d; } }
    let n = 0;
    for (let d = startD + 8; d < ROAD_LEN[routeD] - 10 && n < 120; d += 12) { const q = pathAt(p, d); tmpO.position.set(wx(q.x), .45, wz(q.y)); tmpO.updateMatrix(); routeDots.setMatrixAt(n++, tmpO.matrix); }
    routeDots.count = n; routeDots.instanceMatrix.needsUpdate = true;
    const dp = DEST_POS[routeD];
    ring.visible = true; ring.position.set(wx(dp.x - 62), .15, wz(dp.y)); ring.scale.setScalar(1 + Math.sin(T * 3) * .08);
  }
  // selection outline
  selBox.visible = false;
  const selObj = focus.type === 'ship' ? (shipObjs[focus.id].g.visible ? shipObjs[focus.id].g : null) : focus.type === 'dest' ? destGroups[focus.i] : focus.type === 'gate' ? gateGroup : focus.type === 'berth' ? craneParts[focus.b].g : null;
  if (selObj) { selBox.box.setFromObject(selObj); selBox.box.expandByScalar(.4); selBox.visible = true; }
  if (focus.type === 'truck') { const ts = truckSlots.find(t => t.ti === focus.ti); if (ts) { selBox.box.setFromCenterAndSize(new THREE.Vector3(ts.x, .8, ts.z), new THREE.Vector3(4.2, 2.2, 4.2)); selBox.visible = true; } }
  if (focus.type === 'yard') { selBox.box.setFromCenterAndSize(new THREE.Vector3(wx(YARD.x + YARD.w / 2), 2, wz(YARD.y + YARD.h / 2)), new THREE.Vector3(YARD.w * .1 + 1, 4, YARD.h * .1 + 1)); selBox.visible = true; }

  selVol.visible = selBox.visible;
  if (selVol.visible) { selBox.box.getCenter(selVol.position); selBox.box.getSize(selVol.scale); selVol.material.opacity = .08 + Math.sin(T * 3) * .03; }
  // labels
  setTag(tags.anchor, `Anchorage<small>${f.anchor.length} waiting</small>`);
  BERTH_Y.forEach((y, b) => {
    const id = f.berth[b], closed = storm && STORM_BERTHS.includes(b), swapped = smart && s - f.swapAt[b] < 4;
    let html = `B${b + 1}`, cls = '';
    if (closed) { html += '<small>Closed, wind</small>'; cls = 'red'; }
    else if (swapped) { html += '<small>Priority swap</small>'; cls = 'gold'; }
    else if (f.held[b]) { html += '<small>Held for storm</small>'; cls = 'gold'; }
    else html += `<small>${id >= 0 ? SHIPS[id].name : 'Empty'}</small>`;
    setTag(tags.berths[b], html, cls);
  });
  DEST_POS.forEach((d, i) => {
    const mine = LIFELINE.filter(kk => DIDX[ORDERS[kk].dest] === i);
    if (!mine.length) { setTag(tags.dests[i], `${d.label}<small>${fmt(run.arrived[i][s])} boxes</small>`); return; }
    const ok = mine.filter(kk => f.orderDone[kk] >= 0 && f.orderDone[kk] <= ORDERS[kk].dueS).length;
    const late = mine.filter(kk => f.orderDone[kk] > ORDERS[kk].dueS || (f.orderDone[kk] < 0 && s > ORDERS[kk].dueS)).length;
    setTag(tags.dests[i], `${d.label}<small>${ok}/${mine.length} on time${late ? ` · ${late} late` : ''}</small>`, late ? 'red' : '');
  });
  let fp = null, fh = '';
  if (focus.type === 'ship' && shipObjs[focus.id].g.visible) { fp = shipObjs[focus.id].g.position.clone().setY(7.6); fh = `${SHIPS[focus.id].name}<small>${shipStatus(focus.id, f, s).label}</small>`; }
  if (focus.type === 'truck') { const ts = truckSlots.find(t => t.ti === focus.ti); if (ts) { fp = new THREE.Vector3(ts.x, 3.4, ts.z); fh = `${TRK_ID(focus.ti)}<small>to ${DEST_POS[run.trucks[focus.ti].d].label}</small>`; } }
  if (focus.type === 'order' && bigPin.visible) { fp = bigPin.position.clone().setY(bigPin.position.y + 3.6); fh = `${ORD_ID(focus.k)}<small>${ORDERS[focus.k].what}</small>`; }
  if (!fp && selBox.visible && ['dest', 'gate', 'berth', 'yard'].includes(focus.type)) {
    fp = new THREE.Vector3(); selBox.box.getCenter(fp); fp.y = selBox.box.max.y + 2.5;
    fh = focus.type === 'dest' ? DEST_POS[focus.i].label : focus.type === 'gate' ? `Truck gate<small>${f.gateOut} per 10 min</small>` : focus.type === 'berth' ? `Berth B${focus.b + 1}` : `Container yard<small>${fmt(f.yard)} boxes</small>`;
  }
  tags.focus.el.style.display = fp ? '' : 'none';
  if (fp) { tags.focus.p.copy(fp); setTag(tags.focus, fh, 'blue'); }
  [tags.anchor, ...tags.berths, ...tags.dests].forEach(place);
  if (fp) place(tags.focus);
  for (const p of pops) place(p);
  snap = false;
}

// ----- picking -----
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let downAt = null;
function pickAt(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const objs = [...shipObjs.filter(o => o.g.visible).map(o => o.g), ...destGroups, gateGroup, ...craneParts.map(c => c.g), yardInst, trailers, cabs, scene.children.find(o => o.userData.pick && o.userData.pick.type === 'yard')];
  for (const h of ray.intersectObjects(objs.filter(Boolean), true)) {
    if (h.object === trailers || h.object === cabs) { const ts = truckSlots[h.instanceId]; if (ts) return { type: 'truck', ti: ts.ti }; continue; }
    if (h.object.userData.pick) return h.object.userData.pick;
  }
  return null;
}
if (renderer) {
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const p = pickAt(e);
    select(p || { type: 'port' }, !!p);
  });
  let hoverAt = 0;
  renderer.domElement.addEventListener('pointermove', e => { if (e.buttons || performance.now() - hoverAt < 120) return; hoverAt = performance.now(); renderer.domElement.style.cursor = pickAt(e) ? 'pointer' : 'grab'; });
}
function entityPos(e) {
  const f = runs[sel].frames[curStep];
  if (e.type === 'ship') return shipPos(e.id) || new THREE.Vector3(-40, 0, 0);
  if (e.type === 'berth') return new THREE.Vector3(-28, 0, wz(BERTH_Y[e.b]));
  if (e.type === 'yard') return new THREE.Vector3(wx(YARD.x + YARD.w / 2), 0, 0);
  if (e.type === 'gate') return new THREE.Vector3(wx(GATE.x), 0, wz(GATE.y));
  if (e.type === 'dest') return new THREE.Vector3(wx(DEST_POS[e.i].x), 0, wz(DEST_POS[e.i].y));
  if (e.type === 'truck') { const ts = truckSlots.find(t => t.ti === e.ti); return ts ? new THREE.Vector3(ts.x, 0, ts.z) : new THREE.Vector3(wx(GATE.x), 0, 0); }
  if (e.type === 'order') return orderPos(e.k, f, curStep) || new THREE.Vector3(-30, 0, 0);
  return HOME.tgt.clone();
}
function select(e, fly) {
  focus = e;
  if (e.type === 'order') tlOrder = e.k;
  if (e.type === 'ship') { const k = LIFELINE.find(kk => ORDERS[kk].ship === e.id); if (k !== undefined) tlOrder = k; }
  if (e.type === 'truck') { const tr = runs[sel].trucks[e.ti]; const k = tr && [...tr.orders][0]; if (k !== undefined) tlOrder = k; }
  if (fly && controls && e.type !== 'port' && e.type !== 'plan') flyFocus(entityPos(e), e.type === 'yard' ? 60 : 42);
  renderPanels(curStep);
}

// ===================== dashboard panels =====================
const ICON = {
  ship: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 14h18l-2.5 5H5.5z"/><rect x="6" y="9" width="4" height="4" rx=".5"/><rect x="11" y="9" width="4" height="4" rx=".5"/><rect x="8" y="5" width="4" height="3.4" rx=".5"/></svg>',
  crane: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 21V5M10 21V5M3 5h18M15 5v5"/><rect x="13" y="10" width="4" height="3" fill="currentColor"/></svg>',
  yard: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="8" height="7" rx="1"/><rect x="13" y="12" width="8" height="7" rx="1"/><rect x="8" y="4" width="8" height="7" rx="1"/></svg>',
  gate: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 20V7l9-4 9 4v13"/><path d="M7 20v-7h10v7M7 16h10"/></svg>',
  truck: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="12" height="9" rx="1"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  dest: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  port: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 12H3a9 9 0 0 0 18 0h-2M8 10h8"/></svg>',
  plan: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h6"/><path d="M17 15l3 3-3 3"/></svg>',
};
const STAGE_ICONS = ['<path d="M3 14h18l-2.5 5H5.5z"/>', '<path d="M6 21V5M10 21V5M3 5h18"/>', '<rect x="4" y="10" width="16" height="9" rx="1"/>', '<rect x="2" y="7" width="12" height="9" rx="1"/><path d="M14 10h4l3 3v3h-7z"/>', '<path d="M5 12.5l4.5 4.5L19 7"/>'];
const STAGE_NAMES = ['Ship arrived', 'Berthed', 'Off the ship', 'Out the gate', 'Delivered'];
const chip = (cls, t) => `<span class="chip ${cls}">${t}</span>`;
function orderStatus(k, f, s) {
  const o = ORDERS[k], d = f.orderDone[k], fin = runs[sel].stages[k][4];
  if (d >= 0) return d <= o.dueS ? { cls: 'green', label: 'Delivered on time' } : { cls: 'red', label: 'Delivered late' };
  if (s > o.dueS) return { cls: 'red', label: 'Late' };
  if (s < SHIPS[o.ship].s0) return { cls: 'gray', label: 'Ship due ' + clockOf(SHIPS[o.ship].s0) };
  const b = f.berth.indexOf(o.ship);
  if (b >= 0 && inStorm(s) && STORM_BERTHS.includes(b)) return { cls: 'red', label: 'Stuck: berth closed' };
  if (fin < 0 || fin > o.dueS) return { cls: 'amber', label: 'At risk' };
  return { cls: 'blue', label: 'On track' };
}
function shipStatus(id, f, s) {
  const b = f.berth.indexOf(id);
  if (b >= 0) return inStorm(s) && STORM_BERTHS.includes(b) ? { cls: 'red', label: 'Stuck: berth closed' } : { cls: 'green', label: `Unloading at B${b + 1}` };
  if (f.anchor.includes(id)) return { cls: 'amber', label: 'Waiting at anchor' };
  if (s < SHIPS[id].s0) return { cls: 'gray', label: 'Due ' + clockOf(SHIPS[id].s0) };
  return { cls: 'gray', label: 'Unloaded and gone' };
}
const field = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
function orderRow(k, f, s) {
  const o = ORDERS[k], st = orderStatus(k, f, s);
  return `<li data-sel="order:${k}" style="cursor:pointer"><span class="sw" style="background:${TIER_COL[o.tier]}"></span><span class="grow">${o.what}<small>${ORD_ID(k)} · due ${o.due}</small></span>${chip(st.cls, st.label)}</li>`;
}
function head(icon, eyebrow, title, sub, closable = true) {
  return `<div class="ins-head"><div class="thumb">${ICON[icon]}</div><div class="t"><div class="eyebrow">${eyebrow}</div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <div class="acts">${focus.type !== 'port' && focus.type !== 'plan' ? '<button data-act="locate" aria-label="Show on map"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="4.5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/></svg></button>' : ''}${closable ? '<button data-act="close" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>' : ''}</div></div>`;
}
function renderInspector(s) {
  if (focus.type === 'decision' && (!pending || sel !== DRILL)) focus = { type: 'port' };
  const run = runs[sel], f = run.frames[s], storm = inStorm(s), smart = run.plan.kind === 'porttable';
  let h = '';
  if (focus.type === 'port') {
    const busy = f.berth.filter((id, b) => id >= 0 && !(storm && STORM_BERTHS.includes(b))).length, open = storm ? 2 : 4;
    const yardPct = Math.min(100, f.yard / 400 * 100);
    h = head('port', 'Port · ' + run.code, 'San Pedro Bay terminal', run.sub, false) +
      `<div class="status">${storm ? chip('red', 'Storm · 2 berths closed') : s >= STORM_END ? chip('blue', 'Storm passed') : chip('green', 'Operational')}<span class="muted">${f.anchor.length} waiting · ${f.gateOut} trucks / 10 min</span></div>
      <div class="meters">
        <div class="meter"><div class="lb">Berths working</div><div class="v">${busy}<small> / ${open} open</small></div><div class="pbar"><i style="width:${busy / 4 * 100}%"></i></div></div>
        <div class="meter"><div class="lb">Yard</div><div class="v">${fmt(f.yard)}<small> boxes</small></div><div class="pbar ${yardPct > 70 ? 'red' : 'green'}"><i style="width:${yardPct}%"></i></div></div>
        <div class="meter"><div class="lb">Delivered</div><div class="v">${fmt(run.arrived.reduce((a, d) => a + d[s], 0))}<small> boxes</small></div></div>
        <div class="meter"><div class="lb">Cargo value delivered</div><div class="v">${money(f.value)}</div></div>
      </div>
      <div class="sec">Lifeline orders by tier<span>on time / total</span></div><ul class="rows">${['medical', 'energy', 'food', 'industry'].map(t => {
        const ks = LIFELINE.filter(k => ORDERS[k].tier === t), ok = ks.filter(k => f.orderDone[k] >= 0 && f.orderDone[k] <= ORDERS[k].dueS).length;
        const late = ks.filter(k => f.orderDone[k] > ORDERS[k].dueS || (f.orderDone[k] < 0 && s > ORDERS[k].dueS)).length;
        const risk = ks.filter(k => orderStatus(k, f, s).cls === 'amber' || orderStatus(k, f, s).cls === 'red').length;
        return `<li><span class="sw" style="background:${TIER_COL[t]}"></span><span class="grow">${TIER_NAME[t]}<small>${ks.length} storm orders</small></span><span class="n">${ok}/${ks.length}</span>${late ? chip('red', late + ' late') : risk ? chip('amber', risk + ' at risk') : chip('green', 'On track')}</li>`;
      }).join('')}</ul>
      ${sel === DRILL ? '' : '<div class="btnrow"><button class="btn primary" data-act="drill">Run the storm drill yourself</button></div>'}`;
  } else if (focus.type === 'decision' && pending) {
    const ev = pending, opt = (c) => {
      const X = c === 'approve' ? ev.A : ev.B, Y = c === 'approve' ? ev.B : ev.A, rec = ev.rec === c;
      return `<div class="opt ${rec ? 'rec' : ''}"><div class="opt-h"><b>If you ${c}</b>${rec ? chip('blue', 'Suggested') : ''}</div>
        <div class="opt-n">${onSetOf(X).length}/${LIFELINE.length} lifeline orders on time · ${X.medLate ? `<span class="down">${X.medLate} medical late</span>` : 'no medical late'}</div>
        <ul class="opt-l">${outcomeLines(X, Y).map(([c2, t]) => `<li class="${c2}">${t}</li>`).join('') || '<li>No change to lifeline orders</li>'}</ul></div>`;
    };
    h = head('plan', 'Decision · ' + clockOf(ev.p.s), decisionTitle(ev.p), 'PortTable ran the rest of the shift both ways', false) +
      `<p class="ctx">${decisionContext(ev.p)}</p>
      <div class="sugg"><b>PortTable suggests: ${ev.rec === 'approve' ? 'Approve' : 'Reject'}</b><span>${recReason(ev)}</span></div>
      ${opt('approve')}${opt('reject')}
      <div class="btnrow"><button class="btn ${ev.rec === 'reject' ? 'primary' : ''}" data-act="reject">Reject</button><button class="btn ${ev.rec === 'approve' ? 'primary' : ''}" data-act="approve">Approve</button></div>
      <button class="linkbtn" data-act="delegate">Let PortTable decide the rest of this storm</button>`;
  } else if (focus.type === 'log') {
    const e = decisionLog[focus.i];
    if (!e) { focus = { type: 'port' }; return renderInspector(s); }
    h = head('plan', 'Decision log · ' + clockOf(e.s), e.title, e.how === 'human' ? (e.choice === e.rec ? 'You followed PortTable\'s suggestion' : 'You overrode PortTable\'s suggestion') : e.how === 'auto' ? 'Handled by PortTable: no lifeline order depended on it' : 'Delegated to PortTable') +
      `<div class="status">${chip(e.choice === 'approve' ? 'green' : 'gray', e.choice === 'approve' ? 'Approved' : 'Rejected')}${chip('blue', 'Suggested: ' + (e.rec === 'approve' ? 'approve' : 'reject'))}</div>
      <dl class="fields">${field('Forecast after this call', e.onL + '/' + LIFELINE.length + ' lifeline on time')}</dl>
      ${e.lines.length ? `<ul class="opt-l" style="margin-top:8px">${e.lines.map(([c2, t]) => `<li class="${c2}">${t}</li>`).join('')}</ul>` : ''}
      <div class="btnrow"><button class="btn" data-act="revisit">Revisit this decision</button></div>`;
  } else if (focus.type === 'ship') {
    const sh = SHIPS[focus.id], st = shipStatus(sh.id, f, s), b = f.berth.indexOf(sh.id), left = b >= 0 ? f.berthLeft[b] : f.anchor.includes(sh.id) ? sh.boxes : (s < sh.s0 ? sh.boxes : 0);
    const mix = Object.entries(sh.mix).map(([t, n]) => `${n} ${TIER_NAME[t].toLowerCase()}`).join(', ');
    const ks = LIFELINE.filter(k => ORDERS[k].ship === sh.id);
    h = head('ship', 'Vessel · ' + (b >= 0 ? 'B' + (b + 1) : f.anchor.includes(sh.id) ? 'anchorage' : '—'), sh.name, `${sh.boxes} boxes${mix ? ' · ' + mix : ' · general cargo'}`) +
      `<div class="status">${chip(st.cls, st.label)}<span class="muted">${sh.boxes - left}/${sh.boxes} unloaded</span></div><div class="pbar"><i style="width:${(sh.boxes - left) / sh.boxes * 100}%"></i></div>
      <dl class="fields">${field('Arrived', clockOf(sh.s0))}${field('Crane rate', b >= 0 ? f.berthOut[b] + ' boxes / 10 min' : '—')}${field('Lifeline orders aboard', ks.length || 'None')}</dl>
      ${ks.length ? `<div class="sec">Orders aboard</div><ul class="rows">${ks.map(k => orderRow(k, f, s)).join('')}</ul>` : ''}`;
  } else if (focus.type === 'berth') {
    const b = focus.b, id = f.berth[b], closed = storm && STORM_BERTHS.includes(b);
    const st = closed ? chip('red', 'Closed by wind') : f.held[b] ? chip('amber', 'Held: storm forecast') : id >= 0 ? chip('green', 'Working') : chip('gray', 'Empty');
    h = head('crane', 'Berth · ship-to-shore crane', 'Berth B' + (b + 1), STORM_BERTHS.includes(b) ? 'Exposed to the storm wind' : 'Sheltered berth') +
      `<div class="status">${st}${smart && s - f.swapAt[b] < 4 ? chip('amber', 'Priority swap') : ''}</div>
      <dl class="fields">${field('Ship', id >= 0 ? SHIPS[id].name : '—')}${field('Boxes left', id >= 0 ? f.berthLeft[b] : '—')}${field('Crane rate', f.berthOut[b] + ' boxes / 10 min')}</dl>
      ${id >= 0 ? `<div class="btnrow"><button class="btn" data-sel="ship:${id}">Inspect ${SHIPS[id].name}</button></div>` : ''}`;
  } else if (focus.type === 'yard') {
    h = head('yard', 'Container yard', fmt(f.yard) + ' boxes waiting', smart ? 'Higher tiers leave through the gate first' : 'Boxes leave in the order they landed') +
      `<ul class="rows" style="margin-top:10px">${TIERS.map((t, i) => `<li><span class="sw" style="background:${TIER_COL[t]}"></span><span class="grow">${TIER_NAME[t]}</span><span class="n">${f.yardTier[i]}</span></li>`).join('')}</ul>
      <dl class="fields">${field('Expected wait for pickup', '~' + f.waitMin + ' min')}${field('Average wait before 2 PM', run.life1WaitMin + ' min')}</dl>`;
  } else if (focus.type === 'gate') {
    h = head('gate', 'Truck gate', f.gateOut + ' trucks / 10 min', run.plan.kind === 'today' ? 'Walk-up queue' : 'Booked pickup slots (Life 1)') +
      `<div class="status">${storm ? chip('red', 'Storm: flooded lanes') : chip('green', 'Open')}</div>
      <dl class="fields">${field('Normal capacity', (run.plan.kind === 'today' ? 10 : 12) + ' trucks / 10 min')}${field('Storm capacity', (run.plan.kind === 'today' ? 5 : 6) + ' trucks / 10 min')}${field('Yard wait right now', '~' + f.waitMin + ' min')}${field('Average wait before 2 PM', run.life1WaitMin + ' min')}</dl>`;
  } else if (focus.type === 'truck') {
    const tr = run.trucks[focus.ti];
    if (!tr) { focus = { type: 'port' }; return renderInspector(s); }
    const prog = Math.max(0, Math.min(1, (frameF - tr.s0) / (tr.s1 - tr.s0)));
    const st = frameF >= tr.s1 ? chip('green', 'Delivered') : frameF < tr.s0 ? chip('gray', 'Not dispatched') : chip('blue', 'En route');
    h = head('truck', 'Truck · ' + TIER_NAME[tr.tier], TRK_ID(focus.ti), `${tr.n} box${tr.n > 1 ? 'es' : ''} to ${DEST_POS[tr.d].label}`) +
      `<div class="status">${st}<span class="muted">${Math.round(prog * 100)}%</span></div><div class="pbar"><i style="width:${prog * 100}%"></i></div>
      <dl class="fields">${field('Left the gate', clockOf(tr.s0))}${field('Arrives', clockOf(tr.s1))}${field('Destination', DEST_POS[tr.d].label)}${field('Load', `${tr.n} box${tr.n > 1 ? 'es' : ''} · ${TIER_NAME[tr.tier]}`)}</dl>
      ${tr.orders.size ? `<div class="sec">Lifeline orders on board</div><ul class="rows">${[...tr.orders].map(k => orderRow(k, f, s)).join('')}</ul>` : ''}`;
  } else if (focus.type === 'dest') {
    const d = DEST_POS[focus.i], ks = LIFELINE.filter(k => DIDX[ORDERS[k].dest] === focus.i);
    h = head('dest', 'Destination', d.label, fmt(run.arrived[focus.i][s]) + ' boxes delivered so far') +
      (ks.length ? `<div class="sec">Lifeline orders</div><ul class="rows">${ks.map(k => orderRow(k, f, s)).join('')}</ul>` : '<p class="hint">General cargo only. No lifeline orders.</p>');
  } else if (focus.type === 'order') {
    const k = focus.k, o = ORDERS[k], st = orderStatus(k, f, s), fin = run.stages[k][4];
    const where = { due: 'Ship not here yet', anchor: 'On a ship at anchor', berth: 'On a ship at berth', yard: 'In the container yard', road: 'On a truck', done: 'Delivered' }[f.orderWhere[k]];
    h = head('dest', 'Lifeline order · ' + TIER_NAME[o.tier], o.what, `${ORD_ID(k)} · to ${DESTS[DIDX[o.dest]].name}`) +
      `<div class="status">${chip(st.cls, st.label)}</div>
      <dl class="fields">${field('Due', o.due)}${field('Where now', where)}${f.orderDone[k] >= 0 ? field('Delivered at', clockOf(f.orderDone[k])) : field('Forecast delivery', fin >= 0 ? clockOf(fin) : 'After the shift')}${field('Ship', SHIPS[o.ship].name)}${field('Boxes', o.n)}${field('On-time bonus', money(o.bonus))}</dl>
      <div class="btnrow"><button class="btn" data-sel="ship:${o.ship}">Inspect ship</button><button class="btn" data-sel="dest:${DIDX[o.dest]}">Destination</button></div>`;
  }
  $('inspector').innerHTML = h;
}
$('inspector').addEventListener('click', e => {
  const s = e.target.closest('[data-sel]');
  if (s) { const [type, v] = s.dataset.sel.split(':'); const e2 = type === 'order' ? { type, k: +v } : type === 'ship' ? { type, id: +v } : type === 'dest' ? { type, i: +v } : { type }; select(e2, true); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'close') select({ type: 'port' }, false);
  else if (b.dataset.act === 'locate') flyFocus(entityPos(focus), focus.type === 'yard' ? 60 : 42);
  else if (b.dataset.act === 'drill') { focus = { type: 'port' }; selectRun(DRILL, false); }
  else if (b.dataset.act === 'approve' || b.dataset.act === 'reject') decideNow(b.dataset.act, 'human');
  else if (b.dataset.act === 'delegate') { delegated = true; resumeAfter = true; decideNow(pending.rec, 'delegated'); }
  else if (b.dataset.act === 'revisit') revisit(focus.i);
});

function renderKPIs(s) {
  const run = runs[sel], f = run.frames[s], t = runs[TODAY].frames[s];
  const on = k => (fr) => fr.orderDone[k] >= 0 && fr.orderDone[k] <= ORDERS[k].dueS;
  const onNow = LIFELINE.filter(k => on(k)(f)).length, onToday = LIFELINE.filter(k => on(k)(t)).length;
  const late = LIFELINE.filter(k => f.orderDone[k] > ORDERS[k].dueS || (f.orderDone[k] < 0 && s > ORDERS[k].dueS)).length;
  const d = onNow - onToday;
  const kpi = (icon, lb, v, delta, sub) => `<div class="kpi card"><div class="ico">${icon}</div><div><div class="lb">${lb}</div><div class="v">${v}${delta}</div><div class="s">${sub}</div></div></div>`;
  $('kpis').innerHTML = `<div class="kpi card runcard"><div class="ico" style="background:${run.color};color:#fff;font-weight:800;font-size:12px">${run.code}</div><div><div class="lb">Viewing</div><div class="v" style="font-size:16px">${run.name}</div><div class="s">${sel === DRILL ? decisionLog.filter(e => e.how === 'human').length + ' calls made by you' : run.sub}</div></div></div>` +
    kpi(ICON.dest, 'Lifeline orders on time', `${onNow}/${LIFELINE.length}`, sel !== TODAY && d ? `<span class="d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} vs today</span>` : '', late ? `<span class="down">${late} late so far</span>` : 'none late so far') +
    kpi(ICON.ship, 'Lifeline boxes still in port', LIFELINE.filter(k => ['anchor', 'berth', 'yard'].includes(f.orderWhere[k])).reduce((a, k) => a + ORDERS[k].n, 0), '', `${f.anchor.length} ships waiting · ${inStorm(s) ? 2 : 4} of 4 berths open`) +
    kpi(ICON.yard, 'Yard wait for pickup', `~${f.waitMin} min`, '', run.plan.kind === 'today' ? 'walk-up trucks' : 'booked truck slots');
}
function renderTimeline(s) {
  const run = runs[sel], f = run.frames[s], k = tlOrder, o = ORDERS[k], st = run.stages[k], status = orderStatus(k, f, s);
  const reached = st.map(x => x >= 0 && x <= s);
  const curIdx = reached.lastIndexOf(true);
  const late = s > o.dueS && f.orderDone[k] < 0;
  const stages = STAGE_NAMES.map((nm, i) => {
    const t = st[i], cls = reached[i] ? (i === curIdx ? 'cur' : 'done') : (t >= 0 ? 'fc' : '');
    const tm = t < 0 ? '—' : reached[i] ? clockOf(t) : 'est. ' + clockOf(t);
    return `<div class="stg ${cls} ${late && i === curIdx ? 'late' : ''} ${reached[i] ? '' : 'fc'}"><span class="dot"><svg width="14" height="14" viewBox="0 0 24 24" fill="${i === 4 || i === 1 ? 'none' : 'currentColor'}" stroke="currentColor" stroke-width="${i === 4 || i === 1 ? 3 : 0}" stroke-linecap="round">${STAGE_ICONS[i]}</svg></span><span class="nm">${nm}</span><span class="tm">${tm}</span></div>`;
  }).join('');
  const due = o.dueS - s;
  $('timeline').innerHTML = `<div class="tl-main"><div class="tl-top"><button data-tl="-1" aria-label="Previous order"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 2L3.5 5l3 3"/></svg></button><button data-tl="1" aria-label="Next order"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2"><path d="M3.5 2l3 3-3 3"/></svg></button><b>Lifeline order tracking</b><span class="id">${ORD_ID(k)} · ${SHIPS[o.ship].name}</span></div><div class="stages">${stages}</div></div>
    <button class="tl-card" data-sel="order:${k}" style="text-align:left"><span class="row"><b>${o.what}</b><span style="width:10px;height:10px;border-radius:3px;background:${TIER_COL[o.tier]};margin-top:4px"></span></span><span class="muted">To ${DESTS[DIDX[o.dest]].name}</span><span>${chip(status.cls, status.label)}</span><span class="row muted"><span>Due ${o.due}</span><span>${f.orderDone[k] >= 0 ? 'arrived ' + clockOf(f.orderDone[k]) : due >= 0 ? `${Math.floor(due / 6)}h ${due % 6 * 10}m left` : 'overdue'}</span></span></button>`;
}
$('timeline').addEventListener('click', e => {
  const b = e.target.closest('[data-tl]');
  if (b) { const i = LIFELINE.indexOf(tlOrder); tlOrder = LIFELINE[(i + +b.dataset.tl + LIFELINE.length) % LIFELINE.length]; if (focus.type === 'order') focus = { type: 'order', k: tlOrder }; renderPanels(curStep); return; }
  if (e.target.closest('[data-sel]')) select({ type: 'order', k: tlOrder }, true);
});
function renderOps(s) {
  const run = runs[sel], f = run.frames[s], storm = inStorm(s), smart = run.plan.kind === 'porttable';
  const tabs = { berths: `Berths ${f.berth.filter(x => x >= 0).length}/4`, orders: `Orders ${LIFELINE.length}`, ships: `Ships ${f.anchor.length}`, log: `Decisions ${decisionLog.length}` };
  document.querySelectorAll('#tabs [data-tab]').forEach(b => { b.textContent = tabs[b.dataset.tab]; b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
  let rows = '';
  const chev = '<span class="c">›</span>';
  if (tab === 'berths') rows = BERTH_Y.map((y, b) => {
    const id = f.berth[b], closed = storm && STORM_BERTHS.includes(b);
    const st = closed ? chip('red', 'Closed') : smart && s - f.swapAt[b] < 4 ? chip('amber', 'Swap') : f.held[b] ? chip('amber', 'Held') : id >= 0 ? chip('green', 'Working') : chip('gray', 'Empty');
    const prog = id >= 0 ? (SHIPS[id].boxes - f.berthLeft[b]) / SHIPS[id].boxes : 0;
    return `<li data-sel="berth:${b}" class="${focus.type === 'berth' && focus.b === b ? 'sel' : ''}"><span class="k">B${b + 1}<small>${STORM_BERTHS.includes(b) ? 'exposed' : 'sheltered'}</small></span><span class="d">${id >= 0 ? `<i style="background:var(--blue)"></i>${SHIPS[id].name}` : '<span class="muted">No ship</span>'}</span>${st}<span class="m">${id >= 0 ? f.berthLeft[b] + ' left' : ''}${id >= 0 ? `<div class="pbar"><i style="width:${prog * 100}%"></i></div>` : ''}</span>${chev}</li>`;
  }).join('');
  if (tab === 'orders') rows = LIFELINE.map(k => {
    const o = ORDERS[k], st = orderStatus(k, f, s);
    return `<li data-sel="order:${k}" class="${focus.type === 'order' && focus.k === k ? 'sel' : ''}"><span class="k">${ORD_ID(k)}<small>due ${o.due}</small></span><span class="d"><i style="background:${TIER_COL[o.tier]}"></i>${o.what}</span>${chip(st.cls, st.label.replace('Delivered on time', 'On time').replace('Delivered late', 'Late').replace('Stuck: berth closed', 'Stuck'))}<span class="m">${run.stages[k][4] >= 0 ? clockOf(run.stages[k][4]) : '—'}</span>${chev}</li>`;
  }).join('');
  if (tab === 'ships') {
    const list = SHIPS.filter(sh => f.anchor.includes(sh.id) || f.berth.includes(sh.id) || (sh.s0 > s && sh.s0 - s <= 12));
    rows = list.map(sh => {
      const st = shipStatus(sh.id, f, s), ks = LIFELINE.filter(k => ORDERS[k].ship === sh.id && f.orderDone[k] < 0);
      return `<li data-sel="ship:${sh.id}" class="${focus.type === 'ship' && focus.id === sh.id ? 'sel' : ''}"><span class="k">${sh.name.split(' ')[0]}<small>${sh.boxes} boxes</small></span><span class="d">${ks.length ? ks.map(k => `<i style="background:${TIER_COL[ORDERS[k].tier]}"></i>`).join('') + ORDERS[ks[0]].what : '<span class="muted">General cargo</span>'}</span>${chip(st.cls, st.label.replace('Waiting at anchor', 'Waiting').replace(/Unloading at /, '').replace('Stuck: berth closed', 'Stuck'))}<span class="m">${clockOf(sh.s0)}</span>${chev}</li>`;
    }).join('') || '<li style="cursor:default"><span class="muted" style="grid-column:1/-1">No ships at anchor or berth.</span></li>';
  }
  if (tab === 'log') {
    rows = decisionLog.map((e, i) => `<li data-sel="log:${i}" class="${focus.type === 'log' && focus.i === i ? 'sel' : ''}"><span class="k">${clockOf(e.s)}<small>${e.how === 'human' ? 'you' : e.how === 'auto' ? 'auto' : 'delegated'}</small></span><span class="d">${e.title}</span>${chip(e.choice === 'approve' ? 'green' : 'gray', e.choice === 'approve' ? 'Approved' : 'Rejected')}<span class="m">${e.how === 'human' ? (e.choice === e.rec ? 'followed' : 'overrode') : ''}</span><span class="c">›</span></li>`).join('')
      || `<li style="cursor:default"><span class="muted" style="grid-column:1/-1">${sel === DRILL ? 'No decisions yet. The first one arrives with the storm forecast at 11:00.' : 'Decisions are made in the storm drill. Pick "Storm drill · you decide" in the scenario menu.'}</span></li>`;
  }
  $('oplist').innerHTML = rows;
}
$('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; renderOps(curStep); });
$('oplist').addEventListener('click', e => {
  const li = e.target.closest('[data-sel]'); if (!li) return;
  const [type, v] = li.dataset.sel.split(':');
  if (type === 'log') { focus = { type: 'log', i: +v }; renderPanels(curStep); return; }
  select(type === 'berth' ? { type, b: +v } : type === 'order' ? { type, k: +v } : { type, id: +v }, true);
});
function renderSite() {
  const r = runs[sel];
  $('siteCode').textContent = r.code; $('siteCode').style.background = r.color;
  $('siteName').textContent = r.name;
  $('siteSub').textContent = (sel === DRILL ? 'Forecast: ' : 'Shift result: ') + `${r.onL}/${LIFELINE.length} lifeline on time · ${r.medLate ? r.medLate + ' medical late' : 'no medical late'}`;
  $('siteMenu').innerHTML = runs.map((x, i) => `<button data-run="${i}" aria-current="${i === sel}"><span class="code" style="background:${x.color};width:34px;height:30px;border-radius:8px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:11.5px;flex:none">${x.code}</span><span class="grow"><b>${x.name}</b><span class="muted" style="display:block;font-size:11.5px">${x.sub}</span><span class="bar"><i style="width:${x.onL / LIFELINE.length * 100}%;background:${x.medLate ? 'var(--amber)' : 'var(--green)'}"></i></span></span><span class="pct">${x.onL}/${LIFELINE.length}</span></button>`).join('') +
    '';
}
const menu = $('siteMenu');
$('siteBtn').addEventListener('click', () => { menu.hidden = !menu.hidden; $('siteBtn').setAttribute('aria-expanded', String(!menu.hidden)); });
document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#siteMenu, #siteBtn')) { menu.hidden = true; $('siteBtn').setAttribute('aria-expanded', 'false'); } });
menu.addEventListener('click', e => {
  const b = e.target.closest('[data-run]'); if (!b) return;
  menu.hidden = true; $('siteBtn').setAttribute('aria-expanded', 'false');
  selectRun(+b.dataset.run, false);
});

function renderPanels(s) { renderKPIs(s); renderInspector(s); renderTimeline(s); renderOps(s); }
function selectRun(i, restart) {
  if (i !== TODAY) lastSmart = i;
  sel = i; snap = true;
  if (i === DRILL) { tab = 'log'; if (pending) focus = { type: 'decision' }; }
  else if (tab === 'log') tab = 'berths';
  if (restart) { frameF = PRESTORM; playing = !reduced; }
  renderSite(); updatePlay(); tick(true);
}
function updatePlay() {
  $('playIco').innerHTML = playing ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>' : '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2.5 1l10 6-10 6z"/></svg>';
  $('playBtn').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('playBtn').classList.toggle('primary', !playing);
}
function showReport() {
  const list = runs.map((r, i) => [r, i]).filter(([r, i]) => i <= DRILL || i === sel || i === runs.length - 1);
  $('repBody').innerHTML = list.map(([r, i]) => `<tr class="${i === sel ? 'cur' : ''}"><td>${r.name}</td><td>${r.onL}/${LIFELINE.length}</td><td class="${r.medLate ? 'bad' : ''}">${r.medLate}</td><td>${fmt(r.delivered)}</td><td>${money(r.value)}</td></tr>`).join('');
  const t = runs[TODAY], l1 = runs[1], a = runs[AUTO];
  $('repNote').textContent = `Same storm, same ships. Booking alone (Life 1) gets ${l1.onL - t.onL} more lifeline orders out on time than today's port. Switching to lifeline mode in the storm (Life 2) adds ${a.onL - l1.onL} more, and no medical order arrives late.` + (decisionLog.length ? ` In the drill you made ${decisionLog.filter(e => e.how === 'human').length} calls and followed PortTable's suggestion on ${decisionLog.filter(e => e.how === 'human' && e.choice === e.rec).length}.` : '');
  $('reportModal').hidden = false; $('repClose').focus();
}

function onStep(s, prev) {
  const run = runs[sel], f = run.frames[s];
  if (prev >= 0 && s > prev && s - prev < 6) {
    LIFELINE.forEach(k => {
      const d = f.orderDone[k];
      if (d >= 0 && d > prev && d <= s) { const p = DEST_POS[DIDX[ORDERS[k].dest]]; addPop(new THREE.Vector3(wx(p.x), 11, wz(p.y)), d <= ORDERS[k].dueS ? ORDERS[k].what + ' on time' : ORDERS[k].what + ' late', d <= ORDERS[k].dueS ? '' : 'red'); }
    });
  }
  const storm = inStorm(s);
  $('clockTxt').textContent = (storm ? 'Storm ' : 'Sim ') + clockOf(s);
  $('clock').classList.toggle('storm', storm);
  $('scrub').value = String(s);
  const showToast = s >= STORM_START && s < STORM_START + 4;
  if (showToast && $('toast').hidden) {
    $('toastSub').textContent = run.plan.kind === 'porttable' ? 'PortTable switches to lifeline mode: lifeline cargo gets the safe berths, cranes and trucks first.' : run.plan.kind === 'booking' ? 'Booked slots keep running, but still first come, first served.' : 'Still first come, first served.';
    $('toast').classList.toggle('blue', run.plan.kind === 'porttable');
  }
  $('toast').hidden = !showToast || !!(pending && sel === DRILL);
  $('decBar').hidden = !(pending && sel === DRILL);
  renderPanels(s);
  if (s >= STEPS - 1 && prev >= 0 && prev < STEPS - 1 && !reportShownFor.has(sel)) { reportShownFor.add(sel); showReport(); }
}
function tick(force) {
  if (sel === DRILL) { const p = pending ? pending.p : nextPending(); if (p && frameF > p.s) frameF = p.s; }
  const s = Math.min(STEPS - 1, Math.floor(frameF));
  if (s !== curStep || force) { const prev = force ? -1 : curStep; curStep = s; onStep(s, prev); }
}

// ----- controls -----
function togglePlay() {
  if (sel === DRILL && pending) { focus = { type: 'decision' }; renderInspector(curStep); return; }
  if (!playing && frameF >= STEPS - 1) frameF = sel === DRILL ? 0 : PRESTORM;
  playing = !playing; updatePlay();
}
function jumpStorm() { frameF = PRESTORM; snap = true; reportShownFor.clear(); tick(true); }
function swapRuns() { selectRun(sel === TODAY ? lastSmart : TODAY, false); flyPending = true; }
function stepBy(d) { frameF = Math.max(0, Math.min(STEPS - 1, Math.floor(frameF) + d)); playing = false; snap = true; updatePlay(); tick(); }
$('stormBand').style.left = (STORM_START / (STEPS - 1) * 100) + '%';
$('stormBand').style.width = ((STORM_END - STORM_START) / (STEPS - 1) * 100) + '%';
$('scrub').addEventListener('input', e => { frameF = +e.target.value; playing = false; snap = true; updatePlay(); tick(); });
$('playBtn').addEventListener('click', togglePlay);
$('stormBtn').addEventListener('click', jumpStorm);
$('decOpen').addEventListener('click', () => { focus = { type: 'decision' }; renderInspector(curStep); $('inspector').scrollTop = 0; });
$('swapBtn').addEventListener('click', swapRuns);
$('speedBtn').addEventListener('click', () => { speedIdx = (speedIdx + 1) % SPEEDS.length; $('speedBtn').textContent = speedIdx ? '3×' : '1×'; });
function dolly(k) { if (!controls) return; const off = camera.position.clone().sub(controls.target); off.multiplyScalar(k); const l = off.length(); if (l < controls.minDistance || l > controls.maxDistance) return; flyTo(controls.target.clone().add(off), controls.target.clone()); }
function orbit(a) { if (!controls) return; const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); flyTo(controls.target.clone().add(off), controls.target.clone()); }
$('camIn').addEventListener('click', () => dolly(.75));
$('camOut').addEventListener('click', () => dolly(1.33));
$('camL').addEventListener('click', () => orbit(Math.PI / 5));
$('camR').addEventListener('click', () => orbit(-Math.PI / 5));
$('camHome').addEventListener('click', () => flyTo(HOME.pos.clone(), HOME.tgt.clone()));
const how = $('howModal'), rep = $('reportModal');
$('helpBtn').addEventListener('click', () => { playing = false; updatePlay(); how.hidden = false; $('howClose').focus(); });
$('howClose').addEventListener('click', () => { how.hidden = true; $('helpBtn').focus(); });
$('repClose').addEventListener('click', () => { rep.hidden = true; });
$('repReplay').addEventListener('click', () => { rep.hidden = true; reportShownFor.clear(); frameF = PRESTORM; snap = true; playing = !reduced; updatePlay(); tick(true); });
$('repEdit').addEventListener('click', () => { rep.hidden = true; selectRun(DRILL, false); });
[how, rep].forEach(m => m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));
document.addEventListener('keydown', e => {
  if (!how.hidden || !rep.hidden) { if (e.key === 'Escape') { how.hidden = true; rep.hidden = true; } return; }
  if (e.target.closest('input, select, textarea') && e.key !== ' ') return;
  if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
  else if (e.key === 't' || e.key === 'T') swapRuns();
  else if (e.key === 's' || e.key === 'S') jumpStorm();
  else if (e.key === 'ArrowRight' && !e.target.closest('input')) stepBy(1);
  else if (e.key === 'ArrowLeft' && !e.target.closest('input')) stepBy(-1);
  else if (e.key === 'Escape') { menu.hidden = true; select({ type: 'port' }, false); }
});

function resize() {
  const w = host.clientWidth || 800, h = host.clientHeight || 500;
  camera.aspect = w / h;
  // on wide screens the cards cover the right and bottom, so centre the 3D view in the open area
  if (window.innerWidth > 1180) camera.setViewOffset(w, h, Math.round(w * .07), Math.round(h * .02), w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  if (renderer) renderer.setSize(w, h, false);
}
let last = performance.now(), flyPending = false;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (playing) { frameF += dt * SPEEDS[speedIdx]; if (frameF >= STEPS - 1) { frameF = STEPS - 1; playing = false; updatePlay(); } }
  checkDrill();
  tick();
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 1.6);
    const e = camAnim.t < .5 ? 2 * camAnim.t * camAnim.t : 1 - Math.pow(-2 * camAnim.t + 2, 2) / 2;
    camera.position.lerpVectors(camAnim.from.pos, camAnim.to.pos, e);
    controls.target.lerpVectors(camAnim.from.tgt, camAnim.to.tgt, e);
    if (camAnim.t >= 1) camAnim = null;
  }
  if (controls) controls.update();
  // one bad frame must never stop the demo
  try { update3D(reduced ? 0 : now / 1000, dt); if (renderer) renderer.render(scene, camera); } catch (err) { console.error(err); }
  if (flyPending) { flyPending = false; if (focus.type !== 'port' && focus.type !== 'decision') flyFocus(entityPos(focus), focus.type === 'yard' ? 60 : 42); }
}
new ResizeObserver(resize).observe(host);
resize();
selectRun(TODAY, false);
requestAnimationFrame(loop);
