// Practice drills for the Learn path. Each drill sets up the real sim (the same horses, ball and stroke as a match), watches its events and
// reports progress: { text, markers, done, score, n }. Pure and deterministic.
import { HW, HL, GOAL_HW } from './consts.js';
import { LESSONS } from './content.js';

const hyp = Math.hypot;

export function drillConfig(id) {
  return { human: 1, levels: [3, 3], mateLevel: 3, periods: 1, periodSecs: 600, drill: id };
}

export function startDrill(G, S) {
  const l = LESSONS[G.learn.cur], id = l.id, s = S.s;
  const me = s.riders.find((r) => r.human);
  const park = () => { for (const r of s.riders) if (!r.human) { S.placeRider(r.id, r.team === 0 ? -6 + r.role * 3 : 6 - r.role * 3, r.team === 0 ? -HL + 3 : HL - 3, r.team === 0 ? 0 : Math.PI); } };
  park();
  const d = { id, t0: s.t, score: 0, tries: 0, n: l.n, need: l.need, text: '', markers: [], done: false, phase: 'ready', until: 0, hookWinds: 0, last: -1 };
  if (id === 'ride') {
    S.placeBall(6, 14); S.placeRider(me.id, 0, -12, 0);
    d.pts = [[-4, -5], [4, 1], [-3, 8], [3, 13], [0, 5]]; d.idx = 0; d.limit = 45;
  } else if (id === 'sprint') {
    S.placeBall(6, 14); S.placeRider(me.id, 0, -HL + 2, 0); d.limit = 7; d.started = false; d.markers = [{ x: 0, z: HL - 2, label: 'line', r: 3, active: true }];
  } else if (id === 'swing' || id === 'power') {
    nextBall(S, me, d, id);
  } else if (id === 'hook') {
    S.placeBall(6, 14); S.placeRider(me.id, 0, -8, 0); S.placeRider(3, 2.2, -8, 0); d.limit = 80;
  }
  return d;
}

function nextBall(S, me, d, id) {
  d.tries++;
  S.placeRider(me.id, -2.8, -12, 0);
  S.placeBall(-1.6, -6.5, 0, 0);
  d.until = S.s.t + 16; d.phase = 'ball'; d.hit = false; d.hitAt = 0;
  if (id === 'power') d.target = { x: ((d.tries % 3) - 1) * 2.2, z: 7 + (d.tries % 2) * 4 };
}

export function updateDrill(G, S) {
  const d = G.drill, s = S.s, me = s.riders.find((r) => r.human);
  if (!d || d.done) return;
  const id = d.id;
  const evs = s.events.filter((e) => e.id > (d.last ?? -1));
  if (evs.length) d.last = evs[evs.length - 1].id;
  const el = s.t - d.t0;
  if (id === 'ride') {
    const p = d.pts[Math.min(d.idx, 4)];
    if (d.idx < 5 && hyp(me.x - p[0], me.z - p[1]) < 1.7) { d.idx++; d.score = d.idx; }
    d.markers = d.pts.map((q, i) => ({ x: q[0], z: q[1], label: String(i + 1), done: i < d.idx, active: i === d.idx, r: 1.5 }));
    d.text = d.idx >= 5 ? 'All markers reached' : `Ride to marker ${d.idx + 1}. Time left ${Math.max(0, Math.ceil(d.limit - el))} s`;
    if (d.idx >= 5 || el > d.limit) d.done = true;
  } else if (id === 'sprint') {
    if (!d.started && me.v > 1) { d.started = true; d.t1 = s.t; }
    const t = d.started ? s.t - d.t1 : 0;
    d.text = `Push the stick to its edge to sprint. Time ${t.toFixed(1)} s of ${d.limit} s. Stamina bar: keep it above zero.`;
    if (me.z >= HL - 2.5) { d.score = t <= d.limit ? 1 : 0; d.done = true; }
    else if (d.started && t > d.limit) { d.score = 0; d.done = true; }
  } else if (id === 'swing' || id === 'power') {
    const target = d.target;
    d.markers = id === 'power' ? [{ x: target.x, z: target.z, label: 'target', r: 2.2, active: true }] : [{ x: 0, z: HL - 0.5, label: 'goal', r: GOAL_HW, active: true }];
    for (const e of evs) {
      if (e.type === 'hit' && e.rider === me.id && !d.hit) { d.hit = true; d.hitAt = s.t; }
      if (e.type === 'goal' && id === 'swing' && d.phase === 'ball') { d.score++; d.phase = 'wait'; d.until = s.t + 1.2; }
    }
    const b = s.ball, still = hyp(b.vx, b.vz) < 0.4 && b.y < 0.4;
    if (id === 'power' && d.phase === 'ball' && d.hit && still && s.t - d.hitAt > 0.8) { if (hyp(b.x - target.x, b.z - target.z) < 2.2) d.score++; d.phase = 'wait'; d.until = s.t + 1.0; }
    if (d.phase === 'ball' && d.hit && still && s.t - d.hitAt > 1.2) { d.phase = 'wait'; d.until = s.t + 0.8; }
    if (d.phase === 'ball' && s.t > d.until) { d.phase = 'wait'; d.until = s.t + 0.5; }
    if (d.phase === 'wait' && s.t >= d.until) { if (d.tries >= d.n) d.done = true; else nextBall(S, me, d, id); }
    d.text = `Ball ${Math.min(d.tries, d.n)} of ${d.n}. ${id === 'swing' ? `Goals ${d.score}.` : `In the circle ${d.score}.`} Ride past it, then hold SWING and release when the ring is green.`;
  } else if (id === 'hook') {
    for (const e of evs) {
      if (e.type === 'wind' && e.rider === 3) { d.hookWinds++; d.windAt = s.t; }
      if (e.type === 'hooked' && e.rider === me.id) d.score++;
    }
    d.tries = d.hookWinds;
    d.text = `Rival winds: ${d.hookWinds} of ${d.n}. Hooked: ${d.score}. Press HOOK while he winds up.`;
    if (d.hookWinds >= d.n && s.t - d.windAt > 2.2) d.done = true;
    if (el > d.limit) d.done = true;
  }
}
