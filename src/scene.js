function startPortScene() {
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

// ===================== 3D scene =====================
const host = $('scene');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { renderer = null; }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 16 / 10, .03, 700);
let controls = null;
if (renderer) {
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .85;
  host.appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.maxPolarAngle = 1.3; controls.minDistance = 18; controls.maxDistance = 190;
} else host.innerHTML = '<div class="nogl">This 3D view needs WebGL. Try a recent Chrome, Edge, Firefox or Safari.</div>';
const HOME = { pos: new THREE.Vector3(-42, 84, 90), tgt: new THREE.Vector3(-10, 1, 3) };
camera.position.copy(HOME.pos); if (controls) controls.target.copy(HOME.tgt); else camera.lookAt(HOME.tgt);
let camAnim = null;
function flyTo(pos, tgt) {
  if (!controls) return;
  if (reduced) { camera.position.copy(pos); controls.target.copy(tgt); return; }
  camAnim = { from: { pos: camera.position.clone(), tgt: controls.target.clone() }, to: { pos, tgt }, t: 0, started:performance.now(), duration:1100 };
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
const sun = new THREE.DirectionalLight(0xfffaf0, .9);
sun.position.set(-30, 90, 50); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70, near: 10, far: 260 });
scene.add(sun);
scene.fog = new THREE.Fog(0xeef3fb, 230, 420);

// sea
const seaGeo = new THREE.PlaneGeometry(160, 240, 48, 72); seaGeo.rotateX(-Math.PI / 2);
const seaMat = M(0x4f9be6, { roughness: .35, flatShading: true });
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
// gate lane lights: green moving, red blocked or flooded
const LANE_Z = [-6.8, -3.4, 0, 3.4, 6.8];
const laneLights = LANE_Z.map(z => { const m = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 10), new THREE.MeshBasicMaterial({ color: 0x1f8f4e })); m.position.set(wx(GATE.x) - 3.9, 4.6, z); scene.add(m); return m; });
// exception bay: flagged boxes wait here, plugged in, without touching a gate lane
const BAY = new THREE.Vector3(wx(505), 0, wz(500));
const HELD_POS = new THREE.Vector3(wx(YARD.x + YARD.w) - 1.8, 0, wz(GATE.y) + 6);
(function () {
  const g = new THREE.Group(); g.position.copy(BAY); scene.add(g);
  box(9, .18, 8, M(0xfff1d3), 0, .09, 0, g, false);
  for (const [w, d, x, z] of [[9, .35, 0, -4], [9, .35, 0, 4], [.35, 8, -4.5, 0], [.35, 8, 4.5, 0]]) box(w, .2, d, M(0xf0a020), x, .2, z, g, false);
  box(9, .25, 3.2, M(0xffffff), 0, 3.4, -2.4, g); box(9.2, .2, 3.4, M(0xf0a020), 0, 3.2, -2.4, g, false);
  for (const x of [-4.2, 4.2]) box(.3, 3.3, .3, M(0xc7cfdd), x, 1.65, -3.8, g);
  for (const x of [-2.6, 0, 2.6]) { box(.5, 1.6, .5, M(0x2457f5), x, .8, 3.3, g); }
  g.traverse(o => { if (o.isMesh) o.userData.pick = { type: 'bay' }; });
})();
const excObjs = STORIES.map((t, i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, 1.25), M(t.reefer ? 0xf4f6fb : 0xd9b48a));
  m.castShadow = true; m.visible = false; m.userData.pick = { type: 'box', i }; scene.add(m);
  if (t.reefer) { const u = new THREE.Mesh(new THREE.BoxGeometry(.3, 1.0, 1.1), M(0x2457f5)); u.position.x = -1.35; m.add(u); }
  return m;
});
const plugCables = STORIES.map(() => { const c = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 1.6), M(0x2457f5, { emissive: 0x2457f5, emissiveIntensity: .8 })); c.visible = false; scene.add(c); return c; });
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
const craneParts = Array.from({length:8},(_,index) => {
 const b=index%4,y=BERTH_Y[b];
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
yardInst.setColorAt(0,new THREE.Color(0x235bc5));
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
let excTagsOn = [];
const tags = {
  anchor: makeTag(), berths: BERTH_Y.map(() => makeTag()), dests: DEST_POS.map(() => makeTag()), focus: makeTag(),
};
const excTags = STORIES.map(() => makeTag());
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


trailers.count = stripes.count = cabs.count = beltInst.count = 0;
rain.visible = false;
scene.background = new THREE.Color(0xeef3fb);
const temp = new THREE.Object3D();
function fitPort() {
 const target = HOME.tgt;
 const direction = HOME.pos.clone().sub(target).normalize();
 camera.position.copy(target).add(direction); camera.lookAt(target);
 const inverse = camera.quaternion.clone().invert();
 const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
 let distance = 0;
 // Frame the active terminal closely; offshore queue and distant scenery stay outside the default view.
 for (const x of [-43, 24]) for (const y of [0, 15]) for (const z of [-27, 33]) {
  const point = new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);
  distance = Math.max(distance, point.z + Math.abs(point.x)/(tan*camera.aspect), point.z + Math.abs(point.y)/tan);
 }
 camera.position.copy(target).addScaledVector(direction, distance * 1.04);
 if (controls) { controls.maxDistance = Math.max(190,distance*2); controls.target.copy(target); controls.update(); }
}
let inspectionAsset=null,inspectionOrigin=null,inspectionDoors=0,inspectionOpen=true,inspectionRoof=true,inspectionCamera='interior',inspectionDoorMotion=null;
function resize() {
 const w=host.clientWidth, h=host.clientHeight;
 if (!w || !h) return;
 camera.aspect=w/h; camera.updateProjectionMatrix();
 if(renderer) renderer.setSize(w,h,false);
 if(window.c184View?.active){window.c184View.refocus();return;}
 if(inspectionAsset)frameInspection(inspectionCamera);else if(window.focusPort)window.focusPort(viewFocus);else fitPort();
}
new ResizeObserver(resize).observe(host); resize();
let viewFocus='overview';
window.focusPort=(focus,type,id)=>{
 if(inspectionAsset)closeInspectionModel();
 viewFocus=focus;camAnim=null;
 if(focus==='overview'){fitPort();selBox.visible=false;return;}
 let target=focus==='berths'?new THREE.Vector3(-30,2,0):focus==='yard'?new THREE.Vector3(-10,1,0):focus==='gate'?new THREE.Vector3(7,1,0):new THREE.Vector3(8,1,29);
 let distance=focus==='berths'?105:focus==='yard'?85:60;
 if(type==='berth'){target=new THREE.Vector3(-29,2,wz(BERTH_Y[id]));distance=52;}
 if(type==='ship'&&shipObjs[id]){target=shipObjs[id].g.position.clone();distance=45;}
 if(type==='container'){const index=visibleCargo.findIndex(c=>c.number===id);if(index>=0){const slot=YARD_SLOTS[index%YARD_SLOTS.length];target=new THREE.Vector3(wx(slot.x),1,wz(slot.y));distance=35;}}
 const dir=new THREE.Vector3(-.35,.9,1).normalize();
 flyTo(target.clone().addScaledVector(dir,distance/Math.min(1,camera.aspect)),target);
 selBox.box.setFromCenterAndSize(target,type==='container'?new THREE.Vector3(2.2,3.5,2.8):new THREE.Vector3(focus==='berths'?16:focus==='yard'?19:12,2,focus==='yard'?42:14));selBox.visible=true;
};
$('camHome').onclick=()=>{if(typeof inspectOperation==='function')inspectOperation('overview');else fitPort();};
const railGroup=new THREE.Group();scene.add(railGroup);
for(const z of [27,29])box(24,.15,.15,M(0x657487),8,.2,z,railGroup,false);
for(let x=-4;x<20;x+=1.5)box(.25,.1,3,M(0x6a584a),x,.1,28,railGroup,false);
const railCargo=box(4,1.5,1.5,M(0x235bc5),0,1.1,28,railGroup);
railGroup.traverse(o=>{if(o.isMesh)o.userData.pick={type:'rail'};});
const yardTag=makeTag(),gateTag=makeTag(),railTag=makeTag();yardTag.p.set(-10,5,14);gateTag.p.set(7,7,0);railTag.p.set(8,4,29);
let visibleCargo=[],lastRun=null,lastStep=-1,latestMoves=[],latestExits=[];
function closeInspectionModel(){
 if(!inspectionAsset)return;scene.remove(inspectionAsset.group);inspectionAsset.dispose();inspectionAsset=null;yardInst.visible=true;labelLayer.hidden=false;host.dataset.inspection='';
}
function frameInspection(view,index){
 if(!inspectionAsset)return;inspectionCamera=view;
 const origin=inspectionOrigin.clone();let target=origin.clone().add(new THREE.Vector3(0,.48,0)),offset;
 if(view==='seal'){
  target=origin.clone().add(new THREE.Vector3(.22,.32,1.33));offset=new THREE.Vector3(.2,.12,.8);inspectionOpen=false;
 }else if(view==='package'&&inspectionAsset.packages[index]){
  inspectionRoof=true;inspectionOpen=true;
  inspectionAsset.packages[index].g.updateWorldMatrix(true,false);target=inspectionAsset.packages[index].g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.3,0));offset=new THREE.Vector3(.2,1.0,1.45);
 }else if(view==='exterior'){offset=new THREE.Vector3(-3,2.0,4.3);inspectionRoof=false;inspectionOpen=false;
 }else{target.z+=.2;offset=new THREE.Vector3(-2.5,3.1,4.9);inspectionRoof=true;inspectionOpen=true;}
 // Keep the container fully in frame on narrow screens.
 if(view==='interior'||view==='exterior')offset.multiplyScalar(1/Math.min(1,camera.aspect));
 selBox.visible=view==='package';if(view==='package')selBox.box.setFromCenterAndSize(target,new THREE.Vector3(.68,.65,.68));
 if(controls){controls.minDistance=.35;controls.enableDamping=!reduced;}
 flyTo(target.clone().add(offset),target);
 inspectionAsset.roof.visible=!inspectionRoof;
 host.dataset.cameraView=view;
}
window.portInspection={
 available:!!renderer,
 open(number){
  closeInspectionModel();const inventory=currentRun.containers.filter(c=>c.dischargeStep!==null&&c.dischargeStep<=currentStep&&(c.exitStep===null||c.exitStep>currentStep));const index=inventory.findIndex(c=>c.number===number);
  // Yard selections use their stack position; other records use a labeled mock inspection bay.
  const inYard=index>=0&&index<252,slot=inYard?YARD_SLOTS[index%YARD_SLOTS.length]:null;
  inspectionOrigin=inYard?new THREE.Vector3(wx(slot.x),.3+Math.floor(index/YARD_SLOTS.length)*1.1,wz(slot.y)):new THREE.Vector3(2.5,.3,16);
  inspectionAsset=buildCargoInspection(THREE,number);inspectionAsset.group.position.copy(inspectionOrigin);scene.add(inspectionAsset.group);inspectionDoors=0;inspectionDoorMotion={from:0,to:Math.PI*.61,at:performance.now()};inspectionOpen=true;inspectionRoof=true;
  yardInst.visible=false;labelLayer.hidden=true;selBox.visible=false;host.dataset.inspection=number;
  frameInspection('interior');return {location:inYard?'At selected yard stack':'Mock inspection bay',profile:inspectionAsset.profile};
 },view:frameInspection,
 doors(open){inspectionOpen=open;},roof(cutaway){inspectionRoof=cutaway;if(inspectionAsset)inspectionAsset.roof.visible=!cutaway;},
 close(){closeInspectionModel();window.focusPort('yard');},
 state(){return inspectionAsset?{number:host.dataset.inspection,profile:inspectionAsset.profile.key,packages:inspectionAsset.packages.length,doorAngle:inspectionDoors,roofCutaway:inspectionRoof,camera:inspectionCamera}:null;}
};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
if(renderer){
 let down=null;
 renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];camAnim=null;});
 renderer.domElement.addEventListener('pointerup',e=>{
  if(window.c184View?.active)return;
  if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  if(inspectionAsset){const target=raycaster.intersectObjects(inspectionAsset.group.children,true).find(h=>h.object.userData.inspection&&(inspectionOpen||h.object.userData.inspection.kind==='seal'));if(target&&window.selectInspectionPart){const part=target.object.userData.inspection;window.selectInspectionPart(part.kind,part.index);}return;}
  const hit=raycaster.intersectObjects(scene.children,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return h.object.userData.pick&&['yard','gate','rail','ship','berth'].includes(h.object.userData.pick.type);});
  if(!hit||typeof inspectOperation!=='function')return;
  const pick=hit.object.userData.pick;
  if(hit.object===yardInst&&visibleCargo[hit.instanceId])inspectOperation('container',visibleCargo[hit.instanceId].number);
  else inspectOperation(pick.type,pick.b??pick.id);
 });
}

if(renderer&&controls)window.c184View=buildC184Scene({THREE,scene,camera,controls,host,reduced});
function animate(t) {
 requestAnimationFrame(animate);
 if (!host.clientWidth || !host.clientHeight) return;
 if(window.c184View?.active){camAnim=null;window.c184View.draw(t);renderer.render(scene,camera);return;}
 const f=currentRun.frames[currentStep],p=f.plan;
 if(lastRun!==currentRun||lastStep!==currentStep){
  visibleCargo=currentRun.containers.filter(c=>c.dischargeStep!==null&&c.dischargeStep<=currentStep&&(c.exitStep===null||c.exitStep>currentStep)).slice(0,252);
  latestMoves=currentRun.containers.filter(c=>c.dischargeStep===currentStep);
  latestExits=currentRun.containers.filter(c=>c.exitStep===currentStep);
  lastRun=currentRun;lastStep=currentStep;
 }
 craneParts.forEach((cp,i)=>{
  const b=i%Math.max(1,p.berths);cp.g.visible=i<p.cranes&&p.berths>0;
  cp.g.position.z=wz(BERTH_Y[b])+(Math.floor(i/Math.max(1,p.berths))-.5)*3.5;
  cp.g.traverse(o=>{if(o.isMesh&&o.userData.pick)o.userData.pick={type:'berth',b};});
  const recent=latestMoves.some(c=>currentRun.frames[Math.max(0,currentStep-1)].berth[b]===c.shipIndex||f.berth[b]===c.shipIndex);
  const working=recent&&i<f.activeCranes;
  cp.leg.color.setHex(working?0x235bc5:0x8793a5);
  cp.trolley.position.x=working&&playing&&!reduced?-5+Math.sin(t/250+i)*4:-8;
  cp.cable.position.x=cp.spreader.position.x=cp.trolley.position.x;
 });
 for(let b=0;b<4;b++){
  const ship=f.berth[b];
  const state=b>=p.berths?'inactive':ship<0?'available':!f.open?'shift closed':!f.activeCranes?'no supported crane':f.yard>=f.yardLimit?'yard full':'alongside';
  setTag(tags.berths[b],'B'+(b+1)+' · '+state+(ship>=0?' · '+f.remaining[ship]+' boxes':''));place(tags.berths[b]);
 }
 shipObjs.forEach((o,i)=>{
  const sh=currentRun.ships[i]; o.g.visible=!!sh && currentStep>=sh.arrival && f.remaining[i]>0;
  const b=f.berth.indexOf(i); o.g.position.set(b>=0?-33:-52-i*8,0,b>=0?wz(BERTH_Y[b]):-18+i*14); o.g.rotation.y=Math.PI/2;if(sh)o.inst.count=Math.ceil(28*f.remaining[i]/sh.boxes);
 });
 const n=Math.min(f.yard,YARD_SLOTS.length*3); yardInst.count=n;
 for(let i=0;i<n;i++){const p=YARD_SLOTS[i%YARD_SLOTS.length];temp.position.set(wx(p.x),.8+Math.floor(i/YARD_SLOTS.length)*1.1,wz(p.y));temp.updateMatrix();yardInst.setMatrixAt(i,temp.matrix);yardInst.setColorAt(i,new THREE.Color(visibleCargo[i]&&typeof cargoHeld==='function'&&cargoHeld(visibleCargo[i])?0xd28a22:visibleCargo[i]&&(visibleCargo[i].preDischarged||currentStep-visibleCargo[i].dischargeStep>=currentRates.releaseHours*6)?0x14724e:0x235bc5));}
 yardInst.instanceMatrix.needsUpdate=true; if(yardInst.instanceColor)yardInst.instanceColor.needsUpdate=true;
 setTag(tags.anchor,'Queue: '+f.waiting+' ships');place(tags.anchor);
 tags.dests.forEach(tag=>tag.el.style.display='none');
 setTag(yardTag,'Yard · '+f.yard+' / '+f.yardLimit);place(yardTag);
 setTag(gateTag,'Truck · '+f.truckOut+' exited');place(gateTag);
 setTag(railTag,'Rail · '+f.railOut+' exited');place(railTag);
 const truckBatch=latestExits.filter(c=>c.exitMode==='Truck').length;
 trailers.count=cabs.count=Math.min(12,truckBatch);
 for(let i=0;i<trailers.count;i++){
  const phase=playing&&!reduced?(t/850+i*.21)%1:.5;
  temp.position.set(8+phase*13,1,(i%3-1)*2);temp.rotation.set(0,0,0);temp.updateMatrix();trailers.setMatrixAt(i,temp.matrix);
  temp.position.x+=1.6;temp.updateMatrix();cabs.setMatrixAt(i,temp.matrix);
 }
 trailers.instanceMatrix.needsUpdate=true;cabs.instanceMatrix.needsUpdate=true;
 railCargo.visible=latestExits.some(c=>c.exitMode==='Rail');railCargo.position.x=playing&&!reduced?(t/150%24)-4:8;
 if(camAnim){camAnim.t=Math.min(1,(t-camAnim.started)/camAnim.duration);const q=1-Math.pow(1-camAnim.t,3);camera.position.lerpVectors(camAnim.from.pos,camAnim.to.pos,q);controls.target.lerpVectors(camAnim.from.tgt,camAnim.to.tgt,q);if(camAnim.t===1)camAnim=null;}

 laneLights.forEach((l,i)=>l.material.color.setHex(f.open&&i<Math.min(p.gates,Math.floor(p.workers/2))?0x1f8f4e:0xcf3329));
 if(inspectionAsset){
  const desired=inspectionOpen?Math.PI*.61:0;if(!inspectionDoorMotion||inspectionDoorMotion.to!==desired)inspectionDoorMotion={from:inspectionDoors,to:desired,at:t};const phase=Math.min(1,(t-inspectionDoorMotion.at)/750);inspectionDoors=reduced?desired:inspectionDoorMotion.from+(desired-inspectionDoorMotion.from)*(1-Math.pow(1-phase,3));
  inspectionAsset.doors[0].rotation.y=-inspectionDoors;inspectionAsset.doors[1].rotation.y=inspectionDoors;
 }
 if(controls)controls.update(); if(renderer)renderer.render(scene,camera);
}
requestAnimationFrame(animate);
}
