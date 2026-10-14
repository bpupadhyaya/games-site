// Blind Man's Buff: the simulation. Pure and deterministic: no drawing, no clock, randomness only from the rng handed in.
// World units: the room is ARENA x ARENA (1000 x 1000); everything is JSON-serializable (it is part of getState()).
//
// Two modes share one world:
//   seek  the player is the blindfolded seeker: guests tease with claps, the seeker hunts by ear, reaches, then names who was caught.
//   hide  the player is a guest: an AI seeker hunts by ear; the player's footsteps and claps are what it hears.

export const ARENA = 1000;
export const MARGIN = 40;
export const SEEKER_SPEED = 130;
export const REACH_R = 84;
export const REACH_HALF = Math.PI / 3;          // 120 degree sweep
export const REACH_T = 0.42;
export const REACH_REC = 1.0;
export const CLAP_CD = 3.0;
export const TEASE_CD = 5.0;
export const WRONG_PENALTY = 6;
export const HIDE_TIME = 75;
export const THINK_TIMES = [3, 5, 8, 10];
export const REVEAL_SECONDS = 2;
export const FEEL_R = 96;                         // a guest this close is felt as a warm shape
export const MARK_AGE = 8;                        // seconds an ear mark stays on the map

// ---- people --------------------------------------------------------------------------------------------------------------------------
export const HEIGHTS = ['short', 'medium', 'tall'];
export const HEADS = ['tricorn', 'plume', 'bonnet', 'wig', 'ribbon'];
export const TRINKETS = ['pearls', 'scarf', 'fan', 'spectacles', 'rose'];
export const CLUE_TEXT = {
  short: 'Your hands are near your own chest: a short person.',
  medium: 'Their head is about level with yours: of middling height.',
  tall: 'You have to reach up: a tall person.',
  tricorn: 'A stiff three-cornered hat, with a firm brim.',
  plume: 'A soft hat with a long feather tickling your wrist.',
  bonnet: 'A frilled bonnet tied under the chin.',
  wig: 'A tall powdered wig, curls at the sides, a dusting of powder.',
  ribbon: 'A silk ribbon bow in the hair.',
  pearls: 'A string of smooth pearls at the throat.',
  scarf: 'A soft scarf wound round the neck.',
  fan: 'A folded fan held in one hand.',
  spectacles: 'Little round spectacles on the nose.',
  rose: 'A silk rose pinned at the chest.',
};
const HEIGHT_NOTE = { short: 'short', medium: 'medium height', tall: 'tall' };
export const heightNote = (h) => HEIGHT_NOTE[h] ?? h;

// Ten characters of the party. Triples (height, head, trinket) are all different, so a full set of clues always names exactly one.
export const ROSTER = [
  { id: 'odile',   name: 'Madame Odile',     height: 'tall',   head: 'wig',     trinket: 'fan',        temper: 'teaser', pitch: 640, skin: 0, outfit: '#d98aa6', trim: '#fff0f4', hair: '#e8e2d8' },
  { id: 'luc',     name: 'Chevalier Luc',    height: 'medium', head: 'tricorn', trinket: 'scarf',      temper: 'speedy', pitch: 300, skin: 1, outfit: '#4d6fb0', trim: '#e8c868', hair: '#4a3020' },
  { id: 'berthe',  name: 'Berthe',           height: 'short',  head: 'bonnet',  trinket: 'rose',       temper: 'shy',    pitch: 720, skin: 2, outfit: '#7aa571', trim: '#f4efe0', hair: '#7a4a28' },
  { id: 'anselm',  name: 'Monsieur Anselm',  height: 'tall',   head: 'tricorn', trinket: 'spectacles', temper: 'sneaky', pitch: 250, skin: 0, outfit: '#7a4a6e', trim: '#d8c070', hair: '#3a3a40' },
  { id: 'clemence',name: 'Clemence',         height: 'medium', head: 'ribbon',  trinket: 'pearls',     temper: 'teaser', pitch: 560, skin: 3, outfit: '#e5b84c', trim: '#fff6dc', hair: '#241812' },
  { id: 'pierre',  name: 'Little Pierre',    height: 'short',  head: 'plume',   trinket: 'scarf',      temper: 'speedy', pitch: 460, skin: 1, outfit: '#c8553d', trim: '#f2e6c4', hair: '#8a5a2a' },
  { id: 'isaure',  name: 'Isaure',           height: 'medium', head: 'bonnet',  trinket: 'pearls',     temper: 'shy',    pitch: 680, skin: 2, outfit: '#8aa8d8', trim: '#ffffff', hair: '#b8864a' },
  { id: 'baptiste',name: 'Baptiste',         height: 'tall',   head: 'plume',   trinket: 'rose',       temper: 'sneaky', pitch: 330, skin: 3, outfit: '#3f7f7a', trim: '#e8d8a0', hair: '#1c1410' },
  { id: 'rosalie', name: 'Rosalie',          height: 'short',  head: 'ribbon',  trinket: 'fan',        temper: 'teaser', pitch: 780, skin: 0, outfit: '#c8789c', trim: '#fde8ee', hair: '#a8581e' },
  { id: 'gaspard', name: 'Old Gaspard',      height: 'medium', head: 'wig',     trinket: 'spectacles', temper: 'shy',    pitch: 270, skin: 1, outfit: '#6d6a8f', trim: '#cfc8a8', hair: '#ece6da' },
];
export const rosterOf = (id) => ROSTER.find((r) => r.id === id);

// Temperament: when to run, how fast, how often to tease.
export const TEMPERS = {
  teaser: { flee: 150, speed: 1.0, clap: [1.8, 3.2], rest: 1.1, run: 2.2, label: 'Teaser' },
  shy:    { flee: 250, speed: 0.98, clap: [3.6, 6.0], rest: 1.4, run: 2.8, label: 'Shy' },
  speedy: { flee: 185, speed: 1.1, clap: [2.2, 4.0], rest: 1.0, run: 2.2, label: 'Speedy' },
  sneaky: { flee: 165, speed: 0.95, clap: [5.0, 8.0], rest: 1.2, run: 2.2, label: 'Sneaky', quiet: true },
};

// ---- venues --------------------------------------------------------------------------------------------------------------------------
// Obstacles: circle {k:'c', x, y, r, art} or rectangle {k:'r', x, y, w, h, art}. Rectangles are axis aligned.
export const VENUES = [
  {
    id: 'salon', name: 'The Salon', blurb: 'A mirrored hall with sofas and a harpsichord.', guests: 3, time: 120, speed: 0.95, floor: 'parquet',
    start: { x: 500, y: 880 },
    obstacles: [
      { k: 'r', x: 130, y: 150, w: 240, h: 96, art: 'sofa' }, { k: 'r', x: 640, y: 780, w: 240, h: 96, art: 'sofa' },
      { k: 'c', x: 500, y: 500, r: 74, art: 'table' }, { k: 'r', x: 730, y: 130, w: 170, h: 120, art: 'harpsichord' },
      { k: 'c', x: 140, y: 800, r: 36, art: 'urn' }, { k: 'c', x: 880, y: 480, r: 36, art: 'urn' },
    ],
  },
  {
    id: 'court', name: 'Fountain Court', blurb: 'Gravel paths, clipped hedges and a splashing fountain.', guests: 4, time: 150, speed: 1.0, floor: 'gravel',
    start: { x: 500, y: 900 },
    obstacles: [
      { k: 'c', x: 500, y: 500, r: 118, art: 'fountain' },
      { k: 'r', x: 150, y: 150, w: 260, h: 54, art: 'hedge' }, { k: 'r', x: 590, y: 150, w: 260, h: 54, art: 'hedge' },
      { k: 'r', x: 150, y: 796, w: 260, h: 54, art: 'hedge' }, { k: 'r', x: 590, y: 796, w: 260, h: 54, art: 'hedge' },
      { k: 'r', x: 60, y: 440, w: 56, h: 120, art: 'bench' }, { k: 'r', x: 884, y: 440, w: 56, h: 120, art: 'bench' },
    ],
  },
  {
    id: 'orangery', name: 'The Orangery', blurb: 'Rows of potted trees make narrow aisles.', guests: 5, time: 180, speed: 1.04, floor: 'tiles',
    start: { x: 500, y: 910 },
    obstacles: [
      { k: 'r', x: 190, y: 250, w: 620, h: 52, art: 'planters' }, { k: 'r', x: 190, y: 700, w: 620, h: 52, art: 'planters' },
      { k: 'c', x: 100, y: 500, r: 44, art: 'tree' }, { k: 'c', x: 900, y: 500, r: 44, art: 'tree' }, { k: 'c', x: 500, y: 500, r: 50, art: 'tree' },
      { k: 'c', x: 140, y: 120, r: 36, art: 'tree' }, { k: 'c', x: 860, y: 880, r: 36, art: 'tree' },
    ],
  },
  {
    id: 'ball', name: 'The Masked Ball', blurb: 'Marble columns, a stage and quick dancers.', guests: 6, time: 210, speed: 1.1, floor: 'marble',
    start: { x: 500, y: 920 },
    obstacles: [
      { k: 'c', x: 250, y: 280, r: 38, art: 'column' }, { k: 'c', x: 750, y: 280, r: 38, art: 'column' },
      { k: 'c', x: 250, y: 720, r: 38, art: 'column' }, { k: 'c', x: 750, y: 720, r: 38, art: 'column' },
      { k: 'c', x: 500, y: 500, r: 40, art: 'column' }, { k: 'r', x: 340, y: 44, w: 320, h: 84, art: 'stage' },
    ],
  },
];
export const venueOf = (id) => VENUES.find((v) => v.id === id) ?? VENUES[0];
export const AUTO_VENUE = 0;
export const AUTO_GUESTS = 2;

// ---- small geometry ------------------------------------------------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// Push a circle (x,y,r) out of every obstacle and keep it inside the walls.
export function resolve(p, r, obstacles) {
  for (let it = 0; it < 2; it++) {
    for (const o of obstacles) {
      if (o.k === 'c') {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), m = o.r + r;
        if (d < m) { const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0; p.x = o.x + nx * m; p.y = o.y + ny * m; }
      } else {
        const cx = clamp(p.x, o.x, o.x + o.w), cy = clamp(p.y, o.y, o.y + o.h), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 1e-6) { p.x = cx + (dx / d) * r; p.y = cy + (dy / d) * r; }
          else { // centre inside the rectangle: leave by the nearest side
            const l = p.x - o.x, rr = o.x + o.w - p.x, t = p.y - o.y, b = o.y + o.h - p.y, m = Math.min(l, rr, t, b);
            if (m === l) p.x = o.x - r; else if (m === rr) p.x = o.x + o.w + r; else if (m === t) p.y = o.y - r; else p.y = o.y + o.h + r;
          }
        }
      }
    }
  }
  p.x = clamp(p.x, MARGIN, ARENA - MARGIN); p.y = clamp(p.y, MARGIN, ARENA - MARGIN);
}
const blocked = (x, y, r, obstacles) => {
  if (x < MARGIN || y < MARGIN || x > ARENA - MARGIN || y > ARENA - MARGIN) return true;
  for (const o of obstacles) {
    if (o.k === 'c') { if (Math.hypot(x - o.x, y - o.y) < o.r + r) return true; }
    else if (Math.hypot(x - clamp(x, o.x, o.x + o.w), y - clamp(y, o.y, o.y + o.h)) < r) return true;
  }
  return false;
};
// Walk-ability of a straight line (sampled).
const lineClear = (ax, ay, bx, by, r, obstacles) => {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 24));
  for (let i = 1; i <= n; i++) if (blocked(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, r, obstacles)) return false;
  return true;
};

// ---- creating a world ----------------------------------------------------------------------------------------------------------------
function freeSpot(rng, obstacles, r, avoid, minD) {
  for (let i = 0; i < 80; i++) {
    const p = { x: rng.range(MARGIN + 30, ARENA - MARGIN - 30), y: rng.range(MARGIN + 30, ARENA - MARGIN - 30) };
    if (blocked(p.x, p.y, r + 10, obstacles)) continue;
    if (avoid && dist(p, avoid) < minD) continue;
    return p;
  }
  return { x: 500, y: 300 };
}

// mode: 'seek' | 'hide'.  auto: Watch and Learn (a gentler party and no sand).
export function newWorld({ mode, venueIdx, rng, auto = false, roster = null }) {
  const v = VENUES[venueIdx] ?? VENUES[0];
  const n = auto ? AUTO_GUESTS : v.guests;
  const picks = roster ?? rng.shuffle(ROSTER.map((r) => r.id)).slice(0, n);
  const w = {
    mode, venue: v.id, venueIdx, auto, t: 0, timeTotal: mode === 'hide' ? HIDE_TIME : v.time, timeLeft: mode === 'hide' ? HIDE_TIME : v.time,
    me: { x: v.start.x, y: v.start.y, a: -Math.PI / 2, reach: 0, rec: 0, clapCd: 0, vx: 0, vy: 0, step: 0, gait: 0, tiredRun: 0, hit: false },
    guests: [], events: [], evN: 0, phase: 'seek', hold: null, clue: 0, picked: null, shake: 0,
    wrong: 0, feels: 0, hints: 0, caught: [], misses: 0, calls: 0, close: 0, runT: 0, teases: 0, done: null, msg: null, msgT: 0,
    seeker: null, party: picks.slice(), log: [],
  };
  const obs = v.obstacles;
  picks.forEach((id, i) => {
    const p = freeSpot(rng, obs, 18, w.me, 330);
    const r = rosterOf(id), T = TEMPERS[r.temper];
    w.guests.push({
      id, x: p.x, y: p.y, a: rng.range(0, TAU), state: 'wander', timer: rng.range(0.2, 1.4), wp: null, clapT: rng.range(0.6, T.clap[1]),
      replyT: -1, alert: 0, immune: 0, fleeT: 0, restT: 0, stuck: 0, out: false, stepT: rng.range(0, 0.5), seq: i,
    });
  });
  if (mode === 'hide') {
    // the player is a guest (index -1: `me`), the seeker is the AI, the other guests are decoys
    w.me.x = rng.range(300, 700); w.me.y = v.start.y - 120; w.me.a = -Math.PI / 2;
    const sp = { x: 500, y: 330 };
    w.seeker = { x: sp.x, y: sp.y, a: Math.PI / 2, target: null, wait: 1.2, reach: 0, rec: 0, lastN: 0, listenT: 0, state: 'wait', wp: null, stuck: 0, hitMe: false };
  }
  return w;
}

// ---- noise -----------------------------------------------------------------------------------------------------------------------------
// kind: clap | giggle | step | call (the seeker's own clap) | taunt (the player's tease in hide mode)
const LOC_ERR = { clap: 40, taunt: 30, giggle: 30, step: 18, call: 0 };
export function emit(w, kind, x, y, loud, who = null, rng = null) {
  w.evN += 1;
  // you hear where a sound came from only roughly
  if (rng && who !== 'me' && LOC_ERR[kind]) { const a = rng.range(0, TAU), d = rng.range(0.25, 1) * LOC_ERR[kind]; x += Math.cos(a) * d; y += Math.sin(a) * d; }
  w.events.push({ n: w.evN, kind, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, age: 0, loud, who });
  if (w.events.length > 48) w.events.shift();
}

// ---- guests ----------------------------------------------------------------------------------------------------------------------------
const freeGuest = (g) => !g.out;

function pickFlee(g, from, obstacles, rng) {
  // twelve headings: prefer away from the threat, open space ahead, away from walls
  let best = g.a, bestS = -1e9;
  const away = Math.atan2(g.y - from.y, g.x - from.x);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, ax = Math.cos(a), ay = Math.sin(a);
    let s = Math.cos(angDiff(a, away)) * 1.0;
    for (const L of [40, 90, 150]) {
      const px = g.x + ax * L, py = g.y + ay * L;
      if (blocked(px, py, 18, obstacles)) s -= L === 40 ? 2.2 : L === 90 ? 1.2 : 0.5;
    }
    // stay off the walls a little
    const ex = g.x + ax * 120, ey = g.y + ay * 120;
    if (ex < MARGIN + 30 || ex > ARENA - MARGIN - 30 || ey < MARGIN + 30 || ey > ARENA - MARGIN - 30) s -= 0.35;
    s += Math.cos(angDiff(a, g.a)) * 0.12 + rng.range(-0.04, 0.04);
    if (s > bestS) { bestS = s; best = a; }
  }
  return best;
}

function moveGuest(g, dt, speed, obstacles) {
  const px = g.x, py = g.y;
  g.x += Math.cos(g.a) * speed * dt; g.y += Math.sin(g.a) * speed * dt;
  resolve(g, 18, obstacles);
  return Math.hypot(g.x - px, g.y - py);
}

function stepGuest(w, g, dt, rng, threats, obstacles, vspeed) {
  if (g.out) return;
  const r = rosterOf(g.id), T = TEMPERS[r.temper], gentle = w.auto ? 0.86 : 1;
  const speed = 118 * T.speed * vspeed * gentle;
  if (g.immune > 0) g.immune = Math.max(0, g.immune - dt);
  if (g.alert > 0) g.alert = Math.max(0, g.alert - dt);
  // the nearest seeker (the player in seek mode, the AI in hide mode)
  let near = null, nd = 1e9;
  for (const t of threats) { const d = Math.hypot(t.x - g.x, t.y - g.y); if (d < nd) { nd = d; near = t; } }
  const fleeR = (T.flee + (g.alert > 0 ? 70 : 0)) * (w.auto ? 0.8 : 1);

  // scheduled answer to a call
  if (g.replyT >= 0) { g.replyT -= dt; if (g.replyT < 0) { emit(w, 'giggle', g.x, g.y, 760, g.id, rng); g.replyT = -1; } }
  // teasing claps
  g.clapT -= dt;
  if (g.clapT <= 0) {
    g.clapT = rng.range(T.clap[0], T.clap[1]) * (w.auto ? 1.1 : 1);
    if (g.state !== 'rest' && (w.mode === 'seek' ? true : nd > 80)) emit(w, 'clap', g.x, g.y, 1000, g.id, rng);
  }

  if (g.state === 'rest') {
    g.restT -= dt;
    moveGuest(g, dt, speed * 0.15, obstacles);
    if (g.restT <= 0) g.state = 'wander';
  } else if (near && nd < fleeR && g.immune <= 0) {
    if (g.state !== 'flee') { g.state = 'flee'; g.fleeT = 0; }
    g.fleeT += dt;
    // re-plan a few times a second
    g.timer -= dt;
    if (g.timer <= 0) { g.timer = 0.16; g.a = pickFlee(g, near, obstacles, rng); }
    const moved = moveGuest(g, dt, speed, obstacles);
    if (moved < speed * dt * 0.35) g.stuck += dt; else g.stuck = Math.max(0, g.stuck - dt);
    if (!T.quiet) { g.stepT -= dt; if (g.stepT <= 0) { g.stepT = 0.34; emit(w, 'step', g.x, g.y, 280, g.id, rng); } }
    if (g.fleeT > T.run) { g.state = 'rest'; g.restT = T.rest; g.fleeT = 0; if (nd < 400) emit(w, 'giggle', g.x, g.y, 760, g.id, rng); }
  } else {
    if (g.state === 'flee') g.state = 'wander';
    // wander between waypoints; sneaky guests drift behind the seeker (but keep out of reach)
    if (!g.wp || Math.hypot(g.wp.x - g.x, g.wp.y - g.y) < 28 || g.stuck > 0.8) {
      if (g.timer > 0 && g.wp && g.stuck <= 0.8) { g.timer -= dt; }
      else {
        const p = r.temper === 'sneaky' && near && rng.chance(0.5)
          ? { x: clamp(near.x + rng.range(-260, 260), MARGIN + 30, ARENA - MARGIN - 30), y: clamp(near.y + rng.range(-260, 260), MARGIN + 30, ARENA - MARGIN - 30) }
          : freeSpot(rng, obstacles, 18, null, 0);
        if (blocked(p.x, p.y, 20, obstacles)) { g.timer = 0.1; return; }
        g.wp = p; g.timer = rng.range(0.3, 1.2); g.stuck = 0;
      }
    }
    if (g.wp) {
      g.a = Math.atan2(g.wp.y - g.y, g.wp.x - g.x);
      const sp = speed * (r.temper === 'sneaky' ? 0.55 : 0.68);
      const moved = moveGuest(g, dt, sp, obstacles);
      if (moved < sp * dt * 0.3) g.stuck += dt * 2; else g.stuck = Math.max(0, g.stuck - dt);
      if (!T.quiet && nd < 300) { g.stepT -= dt; if (g.stepT <= 0) { g.stepT = 0.6; emit(w, 'step', g.x, g.y, 150, g.id, rng); } }
    }
  }
}

// ---- the seeker (player in seek mode) -------------------------------------------------------------------------------------------------
function stepMe(w, dt, rng, ctl, venue) {
  const me = w.me, obs = venue.obstacles;
  if (me.clapCd > 0) me.clapCd = Math.max(0, me.clapCd - dt);
  if (me.rec > 0) me.rec = Math.max(0, me.rec - dt);
  if (w.mode === 'seek') {
    const mag = Math.hypot(ctl.dx, ctl.dy);
    const slow = me.reach > 0 ? 0.35 : 1;
    if (mag > 0.05) {
      const k = Math.min(1, mag);
      me.a = Math.atan2(ctl.dy, ctl.dx);
      me.x += (ctl.dx / mag) * SEEKER_SPEED * slow * k * dt; me.y += (ctl.dy / mag) * SEEKER_SPEED * slow * k * dt;
      me.gait += dt * 6 * k;
    }
    resolve(me, 20, obs);
    // clap = the call
    if (ctl.clap && me.clapCd <= 0) {
      me.clapCd = CLAP_CD; w.calls += 1;
      emit(w, 'call', me.x, me.y, 1000, 'me');
      for (const g of w.guests) {
        if (g.out) continue;
        const d = dist(g, me);
        if (d < 520) g.replyT = 0.18 + d / 650;
        if (d < 280) g.alert = 3.2;
      }
    }
    // arms out
    if (ctl.reach && me.reach <= 0 && me.rec <= 0) { me.reach = REACH_T; me.hit = false; }
    if (me.reach > 0) {
      me.reach = Math.max(0, me.reach - dt);
      // who is within the sweep (the sweep widens over its length: the arms come round)
      let best = null, bd = 1e9;
      for (const g of w.guests) {
        if (g.out || g.immune > 0) continue;
        const d = dist(g, me);
        if (d > REACH_R + 14) continue;
        if (Math.abs(angDiff(Math.atan2(g.y - me.y, g.x - me.x), me.a)) > REACH_HALF + (d < 40 ? 1.2 : 0)) continue;
        if (d < bd) { bd = d; best = g; }
      }
      if (best) { me.hit = true; me.reach = 0; me.rec = 0.3; caughtBy(w, best.id); return; }
      if (me.reach === 0) {
        me.rec = REACH_REC; w.misses += 1;
        // a near guest laughs and gives a position away
        let near = null, nd = 260;
        for (const g of w.guests) if (!g.out) { const d = dist(g, me); if (d < nd) { nd = d; near = g; } }
        if (near) near.replyT = 0.25;
      }
    }
    // walking into someone catches them too
    for (const g of w.guests) {
      if (g.out || g.immune > 0) continue;
      if (dist(g, me) < 30) { me.rec = 0.3; caughtBy(w, g.id); return; }
    }
  }
}

function caughtBy(w, id) {
  w.phase = 'feel'; w.hold = id; w.clue = 1; w.picked = null;
  const g = w.guests.find((q) => q.id === id);
  if (g) { g.state = 'held'; }
  w.msg = 'Caught someone!'; w.msgT = 1.6;
}

// ---- identification ------------------------------------------------------------------------------------------------------------------
export const cluesOf = (id) => { const r = rosterOf(id); return [r.height, r.head, r.trinket]; };
export const candidatesOf = (w) => w.guests.filter((g) => !g.out).map((g) => g.id);
export function feelMore(w) {
  if (w.phase !== 'feel' || w.clue >= 3) return false;
  w.clue += 1; w.feels += 1; return true;
}
// A guess is right if it names the held guest.
export function guess(w, id, rng) {
  if (w.phase !== 'feel') return { ok: false, none: true };
  const held = w.guests.find((g) => g.id === w.hold);
  const ok = id === w.hold;
  if (ok) {
    held.out = true; held.state = 'out'; w.caught.push(held.id);
    w.phase = 'seek'; w.hold = null; w.msg = `${rosterOf(id).name}!`; w.msgT = 1.8;
    w.log.push({ t: Math.round(w.t), id, feels: w.clue - 1 });
    if (candidatesOf(w).length === 0) finish(w, 'won');
  } else {
    w.wrong += 1; w.timeLeft = Math.max(0, w.timeLeft - WRONG_PENALTY);
    held.state = 'flee'; held.immune = 1.8; held.fleeT = 0; held.timer = 0;
    for (const g of w.guests) if (!g.out) { g.alert = 4; if (g.id !== held.id) g.timer = 0; }
    w.phase = 'seek'; w.hold = null; w.msg = `Not ${rosterOf(id).name}: they slipped away`; w.msgT = 2.2;
    w.me.rec = 0.8;
    if (w.timeLeft <= 0) finish(w, 'time');
  }
  return { ok, id };
}

function finish(w, how) {
  if (w.done) return;
  w.done = how;
  w.phase = 'over';
}

// ---- the AI seeker (hide mode) -------------------------------------------------------------------------------------------------------
function stepSeekerAI(w, dt, rng, venue) {
  const s = w.seeker, obs = venue.obstacles, speed = 104 * venue.speed;
  if (s.rec > 0) s.rec = Math.max(0, s.rec - dt);
  s.listenT -= dt;
  // hear: the strongest unheard-of noise within the last 2.5 s
  if (s.listenT <= 0) {
    s.listenT = 0.2;
    let best = null, bs = 0;
    for (const e of w.events) {
      if (e.n <= s.lastN || e.age > 2.5 || e.kind === 'call') continue;
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d > e.loud) continue;
      const sc = e.loud / (60 + d) / (1 + e.age);
      if (sc > bs) { bs = sc; best = e; }
    }
    for (const e of w.events) if (e.n > s.lastN) s.lastN = Math.max(s.lastN, e.n);
    if (best) {
      const d = Math.hypot(best.x - s.x, best.y - s.y), err = 16 + d * 0.12;
      s.target = { x: clamp(best.x + rng.range(-err, err), MARGIN, ARENA - MARGIN), y: clamp(best.y + rng.range(-err, err), MARGIN, ARENA - MARGIN) };
      s.state = 'go'; s.wait = 0;
    }
  }
  if (s.reach > 0) {
    s.reach = Math.max(0, s.reach - dt);
    // catch whoever the sweep reaches (me and decoys)
    const targets = [{ me: true, x: w.me.x, y: w.me.y }, ...w.guests.filter((g) => !g.out).map((g) => ({ g, x: g.x, y: g.y }))];
    for (const t of targets) {
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d > REACH_R + 10) continue;
      if (Math.abs(angDiff(Math.atan2(t.y - s.y, t.x - s.x), s.a)) > REACH_HALF + (d < 40 ? 1.2 : 0)) continue;
      if (t.me) { w.done = 'caught'; w.phase = 'over'; w.me.hit = true; return; }
      t.g.out = true; t.g.state = 'out'; s.reach = 0; s.rec = 0.6; w.msg = `${rosterOf(t.g.id).name} was found`; w.msgT = 1.6;
    }
    if (s.reach === 0) {
      s.rec = 0.9;
      if (Math.hypot(w.me.x - s.x, w.me.y - s.y) < 105) { w.close += 1; w.msg = 'Close call!'; w.msgT = 1.4; }
    }
    return;
  }
  // bump
  if (Math.hypot(w.me.x - s.x, w.me.y - s.y) < 34) { w.done = 'caught'; w.phase = 'over'; w.me.hit = true; return; }
  for (const g of w.guests) if (!g.out && Math.hypot(g.x - s.x, g.y - s.y) < 32) { g.out = true; g.state = 'out'; w.msg = `${rosterOf(g.id).name} was found`; w.msgT = 1.6; }
  if (s.state === 'wait') { s.wait -= dt; if (s.wait <= 0) { s.state = 'patrol'; s.wp = freeSpot(rng, obs, 24, null, 0); } }
  else if (s.state === 'search') {
    s.wait -= dt;
    if (s.wait <= 0) { s.state = 'patrol'; s.wp = freeSpot(rng, obs, 24, null, 0); }
  }
  if (s.rec > 0) return;
  const goal = s.state === 'go' ? s.target : s.state === 'patrol' ? s.wp : null;
  if (goal) {
    const dx = goal.x - s.x, dy = goal.y - s.y, d = Math.hypot(dx, dy);
    if (d < 38) {
      if (s.state === 'go') { s.reach = REACH_T; s.state = 'search'; s.wait = 0.9; s.a = Math.atan2(dy, dx); }
      else { s.state = 'search'; s.wait = 0.5; }
    } else {
      s.a = Math.atan2(dy, dx);
      const px = s.x, py = s.y;
      s.x += (dx / d) * speed * dt; s.y += (dy / d) * speed * dt;
      resolve(s, 22, obs);
      if (Math.hypot(s.x - px, s.y - py) < speed * dt * 0.3) {
        s.stuck += dt;
        if (s.stuck > 0.5) { s.stuck = 0; s.reach = REACH_T; s.state = 'search'; s.wait = 0.5; s.target = null; }
      } else s.stuck = 0;
    }
  }
}

// ---- the player as a guest (hide mode) ----------------------------------------------------------------------------------------------
function stepRunner(w, dt, ctl, venue) {
  const me = w.me, obs = venue.obstacles;
  if (me.clapCd > 0) me.clapCd = Math.max(0, me.clapCd - dt);
  const mag = Math.min(1, Math.hypot(ctl.dx, ctl.dy));
  let sp = 0, loud = 0, gap = 0.5;
  if (mag > 0.12) {
    if (mag < 0.45) { sp = 62; loud = 0; }
    else if (mag < 0.8) { sp = 104; loud = 150; gap = 0.5; }
    else { sp = 150; loud = 380; gap = 0.3; w.runT += dt; }
    me.a = Math.atan2(ctl.dy, ctl.dx);
    const m = Math.hypot(ctl.dx, ctl.dy) || 1;
    me.x += (ctl.dx / m) * sp * dt; me.y += (ctl.dy / m) * sp * dt;
    resolve(me, 18, obs);
    me.gait += dt * (sp / 20);
  }
  me.noise = loud;
  if (loud > 0) { me.step -= dt; if (me.step <= 0) { me.step = gap; emit(w, 'step', me.x, me.y, loud, 'me'); } } else me.step = 0;
  if (ctl.clap && me.clapCd <= 0) {
    me.clapCd = TEASE_CD; w.teases += 1;
    emit(w, 'taunt', me.x, me.y, 1100, 'me');
  }
}

// ---- one fixed step ------------------------------------------------------------------------------------------------------------------
// ctl: { dx, dy, reach, clap }. Returns nothing; everything is in w.
export function stepWorld(w, dt, rng, ctl) {
  if (w.done) return;
  const v = VENUES[w.venueIdx] ?? VENUES[0];
  w.t += dt;
  for (const e of w.events) e.age += dt;
  while (w.events.length && w.events[0].age > MARK_AGE) w.events.shift();
  if (w.msgT > 0) { w.msgT -= dt; if (w.msgT <= 0) w.msg = null; }
  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt);

  if (w.phase === 'feel') return;       // holding someone: the room waits while you feel and decide

  if (w.mode === 'seek') {
    stepMe(w, dt, rng, ctl, v);
    if (w.phase === 'feel') return;
    for (const g of w.guests) stepGuest(w, g, dt, rng, [w.me], v.obstacles, v.speed);
    if (!w.auto) { w.timeLeft -= dt; if (w.timeLeft <= 0) { w.timeLeft = 0; finish(w, 'time'); } }
  } else {
    stepRunner(w, dt, ctl, v);
    stepSeekerAI(w, dt, rng, v);
    if (w.done) return;
    for (const g of w.guests) stepGuest(w, g, dt, rng, [w.seeker], v.obstacles, v.speed);
    w.timeLeft = Math.max(0, w.timeTotal - w.t);
    if (w.timeLeft <= 0) finish(w, 'won');
  }
}

// ---- what the seeker can know (used by the view, the hint and the coach) -------------------------------------------------------------
// Ear marks: guest sounds heard in the last MARK_AGE seconds, with how much to trust the position.
export function earMarks(w) {
  // one mark per voice: the newest sound each guest has made (you follow a voice, not every sound)
  const latest = new Map();
  for (const e of w.events) {
    if (e.kind === 'call' || e.who === 'me') continue;
    if (e.kind === 'step' && Math.hypot(e.x - w.me.x, e.y - w.me.y) > e.loud) continue;
    const old = latest.get(e.who);
    if (!old || e.n > old.n) latest.set(e.who, e);
  }
  const out = [];
  for (const e of latest.values()) out.push({ n: e.n, x: e.x, y: e.y, age: e.age, kind: e.kind, unc: 14 + e.age * 17 });
  return out;
}
// Guests close enough to be felt as warm shapes.
export const feltGuests = (w) => w.guests.filter((g) => !g.out && g.state !== 'held' && dist(g, w.me) < FEEL_R);

// The coach: decides what the seeker should do next from what it can hear and feel only.
// Returns { kind: 'felt'|'walk'|'clap'|'wait', tx, ty, why: [line, line] }.
export function coachPlan(w) {
  const me = w.me, felt = feltGuests(w);
  if (felt.length) {
    const g = felt.slice().sort((a, b) => dist(a, me) - dist(b, me))[0];
    return { kind: 'felt', tx: g.x, ty: g.y, why: ['Someone is right here: a warm shape within arm\'s reach.', 'Turn towards them and sweep the arms.'] };
  }
  const marks = earMarks(w).filter((m) => m.kind !== 'step' || m.age < 3);
  if (!marks.length) {
    if (me.clapCd <= 0) return { kind: 'clap', tx: me.x, ty: me.y, why: ['Silence. Nobody has made a sound for a while.', 'Call out: a clap makes the guests answer, and the answers show where they are.'] };
    return { kind: 'wait', tx: me.x, ty: me.y, why: ['Silence. The call has to rest a moment.', 'Listen for the next giggle or clap.'] };
  }
  // nearest and freshest: distance plus a penalty per second of age
  let best = null, bs = 1e9;
  for (const m of marks) { const sc = Math.hypot(m.x - me.x, m.y - me.y) + m.age * 55; if (sc < bs) { bs = sc; best = m; } }
  const d = Math.round(Math.hypot(best.x - me.x, best.y - me.y) / 10) * 10;
  const side = dirWord(best.x - me.x, best.y - me.y);
  return {
    kind: 'walk', tx: best.x, ty: best.y, n: best.n,
    why: [`${marks.length} sound${marks.length > 1 ? 's' : ''} on the map. The best one: ${side}, about ${d} steps away, ${best.age.toFixed(0)} s old.`, 'Fresh and near beats old and far: walk towards it and listen again.'],
  };
}
export function dirWord(dx, dy) {
  const a = Math.atan2(dy, dx), k = Math.round(a / (Math.PI / 4));
  return ['to the right', 'down to the right', 'straight down', 'down to the left', 'to the left', 'up to the left', 'straight up', 'up to the right'][((k % 8) + 8) % 8];
}

// What the coach says and does at the identify card: reveal clues until only one guest fits, then name them.
export function coachGuess(w) {
  const cands = candidatesOf(w);
  const clues = cluesOf(w.hold), fit = (id) => { const c = cluesOf(id); for (let i = 0; i < w.clue; i++) if (c[i] !== clues[i]) return false; return true; };
  const matching = cands.filter(fit);
  if (matching.length > 1 && w.clue < 3) {
    return { kind: 'feel', ids: matching, why: [`${matching.length} guests still fit what the hands told you.`, 'Feel for one more clue before guessing.'] };
  }
  const pick = matching[0] ?? cands[0];
  return { kind: 'guess', id: pick, ids: matching, why: [matching.length === 1 ? 'Only one guest fits every clue felt so far.' : 'Nothing separates them any further: take the best match.', `That is ${rosterOf(pick).name}.`] };
}

// ---- results ---------------------------------------------------------------------------------------------------------------------------
export function resultOf(w) {
  const won = w.done === 'won';
  let score = 0, feathers = 0;
  if (w.mode === 'seek') {
    const total = w.party.length;
    score = w.caught.length * 100 + Math.round(w.timeLeft) * 2 - w.wrong * 30 - w.feels * 10 - w.hints * 15;
    if (won) {
      feathers = 1;
      if (w.timeLeft >= w.timeTotal * 0.5) feathers += 1;
      if (w.wrong + w.feels + w.hints <= Math.floor(total * 0.5)) feathers += 1;
    }
  } else {
    score = Math.round(w.t) * 10 + w.close * 50 - w.teases * 5;
    if (won) {
      feathers = 1;
      if (w.close >= 2) feathers += 1;
      if (w.runT < 4) feathers += 1;
    }
  }
  return { won, how: w.done, score: Math.max(0, score), feathers, caught: w.caught.length, total: w.party.length, wrong: w.wrong, feels: w.feels, hints: w.hints, seconds: Math.round(w.t), close: w.close, teases: w.teases, timeLeft: Math.round(w.timeLeft), misses: w.misses, calls: w.calls };
}

// ---- the coach's hands (Watch and Learn, and the tests): turns a plan into stick/button input ----------------------------------------
export function autoControl(w, plan, rng) {
  const ap = w.ap ?? (w.ap = { px: w.me.x, py: w.me.y, st: 0, det: 0, dir: 1, ck: 0 });
  const me = w.me, ctl = { dx: 0, dy: 0, reach: false, clap: false };
  if (plan.kind === 'clap') { ctl.clap = true; return ctl; }
  if (plan.kind === 'wait') return ctl;
  let tx = plan.tx, ty = plan.ty;
  const d = Math.hypot(tx - me.x, ty - me.y);
  if (plan.kind === 'felt') {
    if (d < REACH_R - 10 && me.rec <= 0 && me.reach <= 0) { ctl.reach = true; }
  } else if (d < 36) return ctl;
  let a = Math.atan2(ty - me.y, tx - me.x);
  // stuck detection: walking but not getting anywhere, so slide round the obstacle
  ap.ck += 1 / 60;
  if (ap.ck >= 0.3) {
    const moved = Math.hypot(me.x - ap.px, me.y - ap.py);
    if (moved < SEEKER_SPEED * 0.3 * 0.35) { ap.st += 1; } else ap.st = 0;
    if (ap.st >= 2 && ap.det <= 0) { ap.det = 0.9; ap.dir = rng.chance(0.5) ? 1 : -1; }
    ap.px = me.x; ap.py = me.y; ap.ck = 0;
  }
  if (ap.det > 0) { ap.det -= 1 / 60; a += ap.dir * Math.PI * 0.45; }
  ctl.dx = Math.cos(a); ctl.dy = Math.sin(a);
  return ctl;
}
