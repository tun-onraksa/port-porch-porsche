// ---------- PortTable simulation core (pure, deterministic) ----------
const STEP_MIN = 10, STEPS = 144, H0 = 6;
function stepOf(t) {
  const [hh, mm] = t.split(':').map(Number);
  let m = hh * 60 + mm - H0 * 60; if (m < 0) m += 1440;
  return Math.round(m / STEP_MIN);
}
function clockOf(step) {
  const m = (H0 * 60 + Math.round(step * STEP_MIN)) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const TIERS = ['medical', 'food', 'energy', 'industry', 'general'];
const TIER_NAME = { medical: 'Medical', food: 'Food & water', energy: 'Energy', industry: 'Industry', general: 'General' };
const BOX_VALUE = { medical: 9000, food: 5000, energy: 7000, industry: 6000, general: 4000 };
const STORM_START = stepOf('14:00'), STORM_END = stepOf('00:00');
const inStorm = s => s >= STORM_START && s < STORM_END;
const STORM_BERTHS = [2, 3];            // B3, B4 close in the wind
const CRANE = 4, CRANE_STORM = 3;       // boxes per berth per step
const GATE_TODAY = 10, GATE_PT = 12, GATE_STORM_FACTOR = .5;

const DESTS = [
  { id: 'hospital', name: 'County Hospital', travel: 3 },
  { id: 'grocery', name: 'Grocery distribution center', travel: 5 },
  { id: 'substation', name: 'Substation generators', travel: 4 },
  { id: 'factory', name: 'Inland Empire factory', travel: 8 },
  { id: 'warehouse', name: 'Retail warehouses', travel: 6 },
];
const DIDX = Object.fromEntries(DESTS.map((d, i) => [d.id, i]));
const TIER_DEST = { medical: 'hospital', food: 'grocery', energy: 'substation', industry: 'factory', general: 'warehouse' };

const SHIPS = [
  ['Long Beach Express', '06:00', 100, { industry: 8 }],
  ['Kestrel Bay', '06:00', 110, { food: 4 }],
  ['Hana Star', '06:30', 90, {}],
  ['Ironwood', '07:30', 100, { food: 10 }],
  ['Coral Meridian', '10:00', 120, { industry: 7 }],
  ['Seabright', '11:00', 110, { food: 10 }],
  ['Atlas Reef', '12:30', 100, { industry: 8 }],
  ['Pacific Arrow', '13:00', 100, { medical: 4, energy: 2, food: 3 }],
  ['Golden Tern', '15:00', 90, { energy: 5, food: 4 }],
  ['Marisol', '17:00', 100, { medical: 3, food: 5 }],
  ['Tidewater', '19:00', 90, { medical: 2, industry: 3 }],
  ['Capella', '21:00', 110, {}],
  ['Wren', '23:00', 100, {}],
  ['Nordvik', '01:00', 100, {}],
].map(([name, at, boxes, mix], i) => ({ id: i, name, s0: stepOf(at), boxes, mix }));

const ORDERS = [
  { ship: 0, tier: 'industry', n: 6, what: 'Car parts', due: '13:00', bonus: 80000, life: 1 },
  { ship: 3, tier: 'food', n: 8, what: 'Grocery restock', due: '15:00', bonus: 60000, life: 1 },
  { ship: 7, tier: 'medical', n: 3, what: 'Insulin & IV fluids', due: '16:00', bonus: 400000, why: "County Hospital's insulin stock runs out at 4 PM." },
  { ship: 5, tier: 'food', n: 8, what: 'Fresh produce', due: '20:00', bonus: 150000, why: "Unrefrigerated produce spoils by 8 PM." },
  { ship: 8, tier: 'energy', n: 4, what: 'Generator diesel', due: '19:00', bonus: 250000, why: "The substation's backup generators run dry at 7 PM." },
  { ship: 6, tier: 'industry', n: 6, what: 'Auto parts', due: '22:00', bonus: 80000, why: "The factory's night line stops at 10 PM without them." },
  { ship: 9, tier: 'medical', n: 2, what: 'Dialysis supplies', due: '20:00', bonus: 400000, why: "Evening dialysis sessions start at 8 PM." },
  { ship: 8, tier: 'food', n: 3, what: 'Baby formula', due: '21:00', bonus: 150000, why: "Shelters' formula runs out at 9 PM." },
  { ship: 9, tier: 'food', n: 4, what: 'Water purifiers', due: '03:00', bonus: 150000, why: "Needed before the 3 AM boil-water notice." },
  { ship: 7, tier: 'energy', n: 2, what: 'Transformer parts', due: '04:00', bonus: 250000, why: "Crews need them to restore power before dawn." },
  { ship: 10, tier: 'medical', n: 2, what: 'Antibiotics', due: '23:00', bonus: 400000, why: "The hospital pharmacy's restock window closes at 11 PM." },
  { ship: 4, tier: 'industry', n: 5, what: 'Microchips', due: '05:00', bonus: 80000, why: "The factory's 5 AM shift needs them." },
].map((o, i) => ({ ...o, id: i, dueS: stepOf(o.due), dest: TIER_DEST[o.tier] }));

// Build the containers once: stowage order is fixed per ship, priority boxes land wherever the loader put them.
const BOXES = [];
(function () {
  const rnd = mulberry(21);
  for (const sh of SHIPS) {
    const list = [];
    let special = 0;
    for (const [tier, n] of Object.entries(sh.mix)) {
      const ords = ORDERS.filter(o => o.ship === sh.id && o.tier === tier);
      let k = 0;
      for (const o of ords) for (let j = 0; j < o.n; j++, k++) list.push({ tier, order: o.id });
      for (; k < n; k++) list.push({ tier, order: -1 });
      special += n;
    }
    for (let k = special; k < sh.boxes; k++) list.push({ tier: 'general', order: -1 });
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    sh.box0 = BOXES.length;
    list.forEach((b, k) => BOXES.push({ ...b, ship: sh.id, stow: k, id: BOXES.length }));
  }
})();

// ----- one box, many stories: what each data source says about a box -----
// A box is flagged when two or more sources disagree or raise an issue about it. PortTable reconciles the
// sources when the box comes off the ship and moves flagged boxes to an exception bay, so they never stop a
// gate lane. Today nobody connects the stories until the box is already at the gate.
const SOURCES = ['carrier', 'scale', 'customs', 'reefer'];
const SOURCE_NAME = { carrier: 'Carrier manifest', scale: 'Terminal scale', customs: 'Customs', reefer: 'Reefer plug' };
const SOURCE_TRUST = {
  carrier: 'Paperwork filed by the shipping line before sailing. Often out of date.',
  scale: 'Weighed at the terminal today. Calibrated this morning.',
  customs: 'A legal hold. Only customs can lift it.',
  reefer: 'Live sensor on the refrigeration plug, reporting every 5 minutes.',
};
const STORIES = [
  { code: 'PTLU 448812 3', ship: 8, stow: 22, value: 180000, reefer: true, hold: true, spoil: 21, dest: 'Grocery DC',
    contents: 'Frozen seafood, 21 t (found on inspection)',
    says: { carrier: ['Empty, repositioning', true], scale: ['26.4 t gross', true], customs: ['Hold: agriculture exam', true], reefer: ['−9 °C against −18 °C set, warming 1.5 °C/h', true] } },
  { code: 'TGHU 302177 0', ship: 6, stow: 14, value: 30000, hold: false, dest: 'Retail warehouses',
    contents: 'Steel fittings, 19 t',
    says: { carrier: ['Furniture, 8 t', true], scale: ['21.2 t gross', true], customs: ['Released', false], reefer: ['Not a reefer', false] } },
  { code: 'CAIU 715540 8', ship: 9, stow: 30, value: 40000, hold: true, dest: 'Retail warehouses',
    contents: 'Consumer electronics',
    says: { carrier: ['Household goods', true], scale: ['14.8 t, matches the booking', false], customs: ['Hold: document check', true], reefer: ['Not a reefer', false] } },
  { code: 'MSCU 220981 4', ship: 5, stow: 40, value: 20000, hold: false, dest: 'Retail warehouses',
    contents: 'Toys, 9 t',
    says: { carrier: ['Toys, 9 t', false], scale: ['9.3 t gross', false], customs: ['Routine X-ray at the gate', true], reefer: ['Not a reefer', false] } },
];
STORIES.forEach((t, i) => {
  let x = SHIPS[t.ship].box0 + t.stow;
  while (BOXES[x].tier !== 'general') x++;
  BOXES[x].story = i; t.box = x;
  t.conflicts = SOURCES.filter(k => t.says[k][1]).length;
});
const EXAM_FAST = 4, EXAM_NORMAL = 24, REWEIGH = 3, LANE_BLOCK = 6, FREE_TIME = 9, CHARGE = 25, GATE_HOLD = 12;
// what the terminal planner can do with a flagged box (release is shown but blocked while customs holds it)
const STORY_OPTIONS = {
  separate: 'Separate it: exception bay, plug it in, priority customs exam',
  'hold-box': 'Hold this box in the yard until customs reaches it',
  'hold-gate': 'Hold the whole gate until it is sorted out',
  release: "Release it on the carrier's word",
};

// plan: { kind: 'today' | 'booking' | 'porttable', order: [4 tiers], dig: 0..2 boxes per crane per step,
//         live: true for a storm drill where a person approves each intervention,
//         decisions: { id: 'approve' | 'reject' }, assume: what to do for decisions not made yet }
const MODE_S = stepOf('11:00'), DIG_DEPTH = 10;
function simulate(plan) {
  const booked = plan.kind !== 'today';           // Life 1: booked berth windows and truck slots
  const smart = plan.kind === 'porttable';         // Life 2: lifeline priorities in a crisis
  const live = smart && !!plan.live, decisions = plan.decisions || {}, points = [];
  // lifeline mode switches on when the storm forecast arrives at 11:00; in a live drill only if someone declares it
  let active = false;
  const decide = (id, s, info) => {
    if (!points.some(p => p.id === id)) points.push({ id, s, info, made: id in decisions });
    if (id in decisions) return decisions[id] === 'approve';
    return (plan.assume || 'approve') === 'approve';
  };
  const decideOpt = (id, s, info, def) => {
    if (!points.some(p => p.id === id)) points.push({ id, s, info, made: id in decisions });
    return id in decisions ? decisions[id] : def;
  };
  const declined = new Set();
  const rank = {};
  if (smart) { plan.order.forEach((t, i) => rank[t] = i); rank.general = 4; }
  const dueOf = x => BOXES[x].order >= 0 ? ORDERS[BOXES[x].order].dueS : 999;
  const weight = t => active ? [8, 4, 2, 1, 0][rank[t]] : 0;
  const N = BOXES.length;
  const st = new Uint8Array(N);          // 0 ship, 1 yard, 2 road, 3 done
  const tYard = new Int16Array(N).fill(-1), tDone = new Int16Array(N).fill(-1);
  const nextStow = SHIPS.map(() => 0);   // next box index in stowage order
  const berth = [-1, -1, -1, -1];
  const shipState = SHIPS.map(() => 'due');   // due, anchor, berth, done
  const shipBerth = SHIPS.map(() => -1);
  const yard = [];
  const trucks = [];
  let value = 0, bonus = 0, life1 = 0, life1Wait = 0, life1Gated = 0, swaps = 0;
  const swapAt = [-99, -99, -99, -99];
  const orderDone = ORDERS.map(() => -1);
  const frames = [];
  const exc = STORIES.map(() => ({ state: 'ship', at: -1, release: -1, laneUntil: -1, plugged: false, how: '' }));
  const held = [];
  const laneBlocks = [];
  let gateHoldUntil = -1, charges = 0, spoiled = 0;
  function toYard(x, s) {
    st[x] = 1; tYard[x] = s;
    const i = BOXES[x].story;
    if (i === undefined || STORIES[i].conflicts < 2) { yard.push(x); return; }
    const t = STORIES[i], e = exc[i];
    e.at = s;
    // today: the consignee's truck is already queued for it, so it reaches a gate lane first and the conflict surfaces there
    if (!booked) { e.state = 'yard'; yard.unshift(x); return; }
    const choice = live ? decideOpt('story:' + i, s, { story: i }, 'separate') : (smart ? 'separate' : 'separate-normal');
    e.how = choice;
    if (choice === 'separate' || choice === 'separate-normal') {
      e.state = 'bay'; e.plugged = !!t.reefer;
      e.release = s + (t.hold ? (choice === 'separate' ? EXAM_FAST : EXAM_NORMAL) : REWEIGH);
    } else {
      e.state = 'held'; e.release = s + EXAM_NORMAL;
      if (choice === 'hold-gate') gateHoldUntil = Math.max(gateHoldUntil, s + GATE_HOLD);
    }
    held.push(x);
  }
  const left = sh => { let c = 0; for (let b = sh.box0; b < sh.box0 + sh.boxes; b++) if (st[b] === 0) c++; return c; };
  const prio = sh => { let p = 0; for (let b = sh.box0; b < sh.box0 + sh.boxes; b++) if (st[b] === 0) p = Math.max(p, weight(BOXES[b].tier)); return p; };
  const forecast = s => s >= stepOf('11:00') && s < STORM_END;
  function assign(s, storm) {
    for (let b = 0; b < 4; b++) {
      if (berth[b] !== -1) continue;
      if (storm && STORM_BERTHS.includes(b)) continue;
      let cand = SHIPS.filter((sh, i) => shipState[i] === 'anchor');
      // forecast: keep lifeline ships off the berths the wind will close
      if (active && forecast(s) && STORM_BERTHS.includes(b)) cand = cand.filter(sh => prio(sh) === 0);
      if (!cand.length) continue;
      if (active) cand.sort((a, c) => prio(c) - prio(a) || a.s0 - c.s0);
      const sh = cand[0];
      berth[b] = sh.id; shipState[sh.id] = 'berth'; shipBerth[sh.id] = b;
    }
    // priority swap: a top-two-tier ship takes a safe berth from a ship carrying only low-tier cargo
    if (active && forecast(s)) {
      const waiting = SHIPS.filter((sh, i) => shipState[i] === 'anchor' && prio(sh) >= 4 && !declined.has(sh.id)).sort((a, c) => prio(c) - prio(a) || a.s0 - c.s0);
      for (const sh of waiting.slice(0, 1)) {
        const safe = [0, 1].filter(b => berth[b] >= 0 && prio(SHIPS[berth[b]]) <= 1 && s - swapAt[b] > 12);
        if (!safe.length) continue;
        const b = safe.sort((x, y) => left(SHIPS[berth[y]]) - left(SHIPS[berth[x]]))[0];
        const out = berth[b];
        if (live && !decide('swap:' + sh.id, s, { ship: sh.id, out, berth: b })) { declined.add(sh.id); continue; }
        shipState[out] = 'anchor'; shipBerth[out] = -1;
        berth[b] = sh.id; shipState[sh.id] = 'berth'; shipBerth[sh.id] = b;
        swapAt[b] = s; swaps++;
      }
    }
  }
  for (let s = 0; s < STEPS; s++) {
    const storm = inStorm(s);
    SHIPS.forEach((sh, i) => { if (shipState[i] === 'due' && s >= sh.s0) shipState[i] = 'anchor'; });
    if (smart && s === MODE_S) active = live ? decide('mode', s, {}) : true;
    assign(s, storm);
    // cranes
    const berthOut = [0, 0, 0, 0];
    for (let b = 0; b < 4; b++) {
      const id = berth[b]; if (id === -1) continue;
      if (storm && STORM_BERTHS.includes(b)) continue;
      const sh = SHIPS[id];
      let moves = storm ? CRANE_STORM : CRANE;
      if (live && active) {   // live drill: dig out a buried top-tier order only when someone approves it
        for (const o of ORDERS) {
          if (o.ship !== id || o.life || rank[o.tier] > 1 || moves < 2) continue;
          let depth = -1;
          for (let x = sh.box0; x < sh.box0 + sh.boxes; x++) if (BOXES[x].order === o.id && st[x] === 0) depth = Math.max(depth, BOXES[x].stow - nextStow[id]);
          const asked = points.some(p => p.id === 'dig:' + o.id);
          if (depth < 0 || (!asked && depth < DIG_DEPTH)) continue;
          if (!decide('dig:' + o.id, s, { order: o.id, depth, berth: b })) continue;
          for (let x = sh.box0; x < sh.box0 + sh.boxes && moves >= 2; x++) if (BOXES[x].order === o.id && st[x] === 0) {
            toYard(x, s); berthOut[b]++; moves -= 2; break;
          }
        }
      } else if (active && plan.dig > 0) {   // dig: pull this many priority boxes per berth per step, 2 crane moves each
        let digMoves = Math.min(moves, plan.dig * 2);
        while (digMoves >= 2) {
          let best = -1, bw = 0;
          for (let x = sh.box0; x < sh.box0 + sh.boxes; x++) if (st[x] === 0) { const w = weight(BOXES[x].tier); if (w > bw) { bw = w; best = x; } }
          if (best < 0) break;
          toYard(best, s); berthOut[b]++;
          digMoves -= 2; moves -= 2;
        }
      }
      while (moves > 0) {
        while (nextStow[id] < sh.boxes && st[sh.box0 + nextStow[id]] !== 0) nextStow[id]++;
        if (nextStow[id] >= sh.boxes) break;
        const x = sh.box0 + nextStow[id];
        toYard(x, s); berthOut[b]++; moves--;
      }
      if (left(sh) === 0) { shipState[id] = 'done'; berth[b] = -1; }
    }
    assign(s, storm);
    // flagged boxes: release after the exam, spoil if a reefer sits unplugged too long
    for (let j = held.length - 1; j >= 0; j--) {
      const x = held[j], e = exc[BOXES[x].story];
      if (s >= e.release) { held.splice(j, 1); e.state = 'released'; if (booked) yard.unshift(x); else yard.push(x); }
    }
    STORIES.forEach((t, i) => {
      const e = exc[i];
      if (!t.reefer || e.at < 0 || e.plugged || st[t.box] !== 1 || s < e.at + t.spoil) return;
      e.state = 'spoiled'; st[t.box] = 3; spoiled++;
      let j = yard.indexOf(t.box); if (j >= 0) yard.splice(j, 1);
      j = held.indexOf(t.box); if (j >= 0) held.splice(j, 1);
    });
    // gate: half the lanes are down in the storm, a flagged box at the gate stops a lane, a gate hold stops all of them
    let cap = booked ? GATE_PT : GATE_TODAY;
    if (storm) cap = Math.round(cap * GATE_STORM_FACTOR);
    cap -= 2 * laneBlocks.filter(u => u > s).length;
    if (s < gateHoldUntil) cap = 0;
    cap = Math.max(0, cap);
    if (active) yard.sort((a, c) => (rank[BOXES[a].tier] - rank[BOXES[c].tier]) || (dueOf(a) - dueOf(c)) || (tYard[a] - tYard[c]) || a - c);
    const out = [];
    while (out.length < cap && yard.length) {
      const x = yard.shift(), i = BOXES[x].story;
      if (!booked && i !== undefined && STORIES[i].conflicts >= 2 && exc[i].state === 'yard') {
        const e = exc[i];
        e.state = 'lane'; e.laneUntil = s + LANE_BLOCK; e.release = s + EXAM_NORMAL;
        laneBlocks.push(s + LANE_BLOCK); held.push(x); cap = Math.max(0, cap - 2);
        continue;
      }
      out.push(x);
    }
    for (const x of yard) if (s - tYard[x] > FREE_TIME) charges += CHARGE;
    for (const x of held) if (s - tYard[x] > FREE_TIME) charges += CHARGE;
    const sent = DESTS.map(() => ({ n: 0, top: 'general' }));
    for (const x of out) {
      st[x] = 2;
      if (BOXES[x].story !== undefined) exc[BOXES[x].story].state = 'road';
      if (s < STORM_START) { life1Wait += s - tYard[x]; life1Gated++; }
      const d = DIDX[TIER_DEST[BOXES[x].tier]];
      const travel = Math.round(DESTS[d].travel * (storm ? 1.5 : 1));
      tDone[x] = s + travel;
      sent[d].n++;
      trucks.push({ x, d, s0: s, s1: s + travel });
    }
    // deliveries
    for (const tr of trucks) {
      if (st[tr.x] === 2 && tr.s1 <= s) {
        st[tr.x] = 3;
        const i = BOXES[tr.x].story;
        if (i !== undefined) { exc[i].state = 'delivered'; value += STORIES[i].value; } else value += BOX_VALUE[BOXES[tr.x].tier];
        if (s < STORM_START) life1++;
      }
    }
    ORDERS.forEach((o, k) => {
      if (orderDone[k] >= 0) return;
      let all = true;
      for (let x = 0; x < N; x++) if (BOXES[x].order === k && st[x] !== 3) { all = false; break; }
      if (all) { orderDone[k] = s; if (s <= o.dueS) bonus += o.bonus; }
    });
    // frame
    const yardTier = TIERS.map(() => 0);
    for (const x of yard) yardTier[TIERS.indexOf(BOXES[x].tier)]++;
    const orderWhere = ORDERS.map((o, k) => {
      if (orderDone[k] >= 0) return 'done';
      let w = 3;
      for (let x = 0; x < N; x++) if (BOXES[x].order === k) w = Math.min(w, st[x]);
      if (w === 0) return shipState[o.ship] === 'berth' ? 'berth' : shipState[o.ship] === 'anchor' ? 'anchor' : 'due';
      return ['ship', 'yard', 'road', 'done'][w];
    });
    const orderDepth = ORDERS.map((o, k) => {
      const sh = SHIPS[o.ship];
      let deepest = 0;
      for (let x = sh.box0; x < sh.box0 + sh.boxes; x++) if (BOXES[x].order === k && st[x] === 0) deepest = Math.max(deepest, BOXES[x].stow - nextStow[o.ship]);
      return deepest;
    });
    frames.push({
      berth: berth.slice(), berthLeft: berth.map(id => id >= 0 ? left(SHIPS[id]) : 0), berthOut,
      anchor: SHIPS.filter((sh, i) => shipState[i] === 'anchor').map(sh => sh.id),
      yard: yard.length, yardTier, gateOut: out.length, sent: sent.map(x => x.n),
      trucks: trucks.filter(t => t.s1 > s).length,
      orderWhere, orderDepth, orderDone: orderDone.slice(),
      value, bonus, score: value + bonus, life1,
      waitMin: Math.round(yard.length / Math.max(1, cap) * STEP_MIN), swapAt: swapAt.slice(),
      exc: exc.map(e => (e.state === 'held' && e.laneUntil > s) ? 'lane' : (e.state === 'lane' && e.laneUntil <= s) ? 'held' : e.state),
      lanesBlocked: laneBlocks.filter(u => u > s).length, gateHold: s < gateHoldUntil, cap, charges, spoiled,
      held: berth.map((id, b) => id < 0 && active && forecast(s) && !storm && STORM_BERTHS.includes(b) && SHIPS.some((sh, i) => shipState[i] === 'anchor')),
    });
  }
  const last = frames[STEPS - 1];
  const onTime = ORDERS.filter((o, k) => last.orderDone[k] >= 0 && last.orderDone[k] <= o.dueS).length;
  const medLate = ORDERS.filter((o, k) => o.tier === 'medical' && !(last.orderDone[k] >= 0 && last.orderDone[k] <= o.dueS)).length;
  const delivered = (() => { let c = 0; for (let x = 0; x < N; x++) if (st[x] === 3) c++; return c; })();
  return { frames, score: last.score, value: last.value, bonus: last.bonus, onTime, medLate, delivered, life1: last.life1, life1WaitMin: Math.round(life1Wait / Math.max(1, life1Gated) * STEP_MIN), swaps, sends: trucks, points, charges, spoiled, exc: exc.map(e => ({ ...e })) };
}

