// Finnish Pin Toss: state and flow. The engine is sim.js, the match rules match.js, the rivals ai.js, drawing view.js and
// menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, records, play (also Watch & Learn), result, howto/about/rules, demolimit.
// A throw: press on the lawn and pull back like a sling (direction aims, length is strength); a dotted arc and a landing
// ring preview it; holding still tightens the ring. Let go to throw. The same physics (sim.js) runs for the player, the
// rivals and the hint, so what you see is what happens.
import {
  startSkittles, cloneSk, makeThrow, specFor, landingOf, flightOf, resetIds, pointsOf, V_MIN, V_MAX, STEP, BOUNDS,
} from './sim.js';
import { newMatch, applyThrow, nextTurn, adviceFor, LENGTHS } from './match.js';
import { PROFILES, createPlanner, executePlan, throwName } from './ai.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, W, H } from './layout.js';
import { renderPlay, layoutOf, nameOf, camTarget, throwView } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderRecords, renderSheet,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { GL } from './glbridge.js';

export { meta };
const DEMO_MATCH_CAP = 2;
const MAX_PARTS = 140;
const SX = 4, SY = 8;               // one standard deviation (cm) of a throw's landing at the loosest hand
const PULL_V0 = 270, PULL_KV = 1.75, PULL_KP = 420, PULL_MAX = 330, PULL_MIN = 14;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const thRng = rng.fork();
  resetIds();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, sheet: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, style: 0, flat: false },
    record: { wins: [0, 0, 0, 0], played: 0, streak: 0, best: 0, bestSolo: 0, bestKnock: 0, demoMatches: 0, throws: 0, exact: 0 },
    setup: { mode: 'ai', opp: 0, count: 1, length: 'classic' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, m: null, sk: startSkittles(), cam: { x: 0, y: 0, span: 150 }, aim: null, aimSet: { style: 0, flat: false },
    pull: null, steady: 0, kb: null, act: null, rise: [], parts: [], pops: [], toast: '', toastT: 0, info: '', glow: 0,
    humanTurn: false, pass: null, think: null, hint: null, hintBusy: false, delay: 0, last: null, restoreMsg: '', restoreBusy: false, owned: () => !!monetization?.owns?.('unlock_game'), endT: -1, camShake: 0,
  };
  let planner = null, hintPlanner = null;

  // ---- persistence ---------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.style = state.settings.style ? 1 : 0; state.settings.flat = !!state.settings.flat;
    state.aimSet = { style: state.settings.style, flat: state.settings.flat };
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 4) state.record.wins = [0, 0, 0, 0];
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  let clackT = 0;
  const sfx = {
    whoosh: (p) => tone({ freq: 180 + 220 * p, to: 520, dur: 0.38, type: 'sawtooth', vol: 0.025 + 0.02 * p }),
    thud: (v) => tone({ freq: 140, to: 60, dur: 0.16, type: 'sine', vol: 0.12 + Math.min(0.1, v / 5000) }),
    knock: (v, num) => { if (clackT > 0) return; clackT = 0.035; tone({ freq: 520 + (num % 6) * 70 + Math.min(260, v * 0.5), to: 240, dur: 0.07, type: 'triangle', vol: 0.07 + Math.min(0.08, v / 4000) }); },
    clack: (v) => { if (clackT > 0) return; clackT = 0.04; tone({ freq: 880, to: 420, dur: 0.05, type: 'triangle', vol: 0.05 + Math.min(0.07, v / 3000) }); },
    score: (n) => [0, 4, 7].slice(0, 1 + Math.min(2, n >> 1)).forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.2 + i * 0.05, type: 'sine', vol: 0.1 })),
    miss: () => tone({ freq: 260, to: 150, dur: 0.25, type: 'triangle', vol: 0.07 }),
    drop: () => [7, 4, 0].forEach((s, i) => tone({ freq: 440 * Math.pow(2, s / 12), dur: 0.16, type: 'triangle', vol: 0.08 + i * 0.01 })),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- effects (lawn units) ---------------------------------------------------------------------
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const chips = (parts, x, y, n, col = 'rgba(244,224,176,1)') => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 20 + fx.next() * 70;
      addPart(parts, { kind: 0, x, y, z: 4 + fx.next() * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0, t: 0, max: 0.45 + fx.next() * 0.35, size: 0.5 + fx.next() * 0.7, col });
    }
  };
  const sparkle = (parts, x, y, n, col = '#ffd35a') => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 20 + fx.next() * 60;
      addPart(parts, { kind: 3, x, y, z: 14 + fx.next() * 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, t: 0, max: 0.8 + fx.next() * 0.5, size: 1.1 + fx.next() * 1.0, col });
    }
  };
  const dustPuff = (parts, x, y, n) => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 8 + fx.next() * 24;
      addPart(parts, { kind: 0, x, y, z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + fx.next() * 0.3, size: 1 + fx.next() * 1.2, col: 'rgba(210,200,160,0.7)' });
    }
  };
  const ringFx = (parts, x, y, size, col) => addPart(parts, { kind: 1, x, y, z: 1, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= 0.95; if (q.kind === 3) q.z += 14 * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 40) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.6 }); if (state.pops.length > 6) state.pops.shift(); };

  // ---- camera ----------------------------------------------------------------------------------
  const easeCam = (cam, tgt, dt, rate = 3.2) => {
    const k = 1 - Math.exp(-rate * dt);
    if (tgt.pitch) cam.pitch = (cam.pitch ?? tgt.pitch) + (tgt.pitch - (cam.pitch ?? tgt.pitch)) * k;
    cam.x += (tgt.x - cam.x) * k; cam.y += (tgt.y - cam.y) * k; cam.span += (tgt.span - cam.span) * k; cam.spanY = (cam.spanY || tgt.spanY || 150) + ((tgt.spanY || 150) - (cam.spanY || tgt.spanY || 150)) * k;
  };
  const camFor = (sk, bodies, wide) => {
    const extra = [];
    if (bodies) for (const b of bodies) if (b.st === 1 && (b.vx || b.vy)) extra.push({ x: b.x, y: b.y });
    const a = state.act;
    if (a && (a.wind > 0 || a.th.air)) return throwView(wide);   // pulled back: the person, the arc and the bundle
    return camTarget(sk, extra, wide);
  };

  // ---- the attract lawn behind the menus --------------------------------------------------------
  const ATTRACT = [[0, 2, 0, false, 0.4], [-6, 4, 1, true, 1.1], [5, 10, 0, true, 1.9], [0, -2, 1, false, 0], [-9, 8, 1, false, 0], [8, 0, 0, true, 0.7]];
  const startAttract = () => {
    state.att = { scene: { sk: startSkittles(), cam: { x: 0, y: 4, span: 150, pitch: 0.5 }, parts: [], rise: [], t: 0, bodies: null, flying: null }, th: null, wait: 1.2, n: 0 };
  };
  const updateAttract = (dt) => {
    const a = state.att; if (!a) return;
    const sc = a.scene;
    sc.t += dt;
    for (const r of sc.rise) r.t += dt;
    sc.rise = sc.rise.filter((r) => r.t < 0.5);
    if (!a.th) {
      a.wait -= dt;
      if (a.wait <= 0) {
        if (a.n % 4 === 0) sc.sk = startSkittles();
        const [tx, ty, style, flat, yaw] = ATTRACT[a.n % ATTRACT.length];
        a.th = makeThrow(cloneSk(sc.sk), specFor(tx, ty, style, flat, yaw)); a.n++;
        a.wind = 0.8; a.windTot = 0.8; a.ant = 0.45; a.released = false; a.pw = 0;
        sc.bodies = a.th.bodies; sc.sk = null;
      }
    } else {
      let adt = dt;
      if (a.wind > 0) { a.wind -= dt; if (a.wind > 0) adt = 0; else { adt = -a.wind; a.wind = 0; a.released = true; } }
      if (adt > 0) a.th.advance(adt);
      if (a.th.air) {
        const f = a.th.f, tt = a.th.t - a.th.tl;
        const P = { x: f.vh * f.sx * a.th.t, y: -350 + f.vh * f.sy * a.th.t, z: 38 + f.vz * a.th.t - 490.5 * a.th.t * a.th.t };
        const ph = -9 * tt;
        sc.flying = { P, axis: { x: f.sx * Math.cos(ph), y: f.sy * Math.cos(ph), z: Math.sin(ph) }, spin: 0 };
      } else sc.flying = null;
      for (const e of a.th.events) if (e.type === 'topple') chips(sc.parts, e.x, e.y, 3);
      a.th.events.length = 0;
      if (a.th.done) {
        sc.sk = a.th.standUp(); sc.bodies = null; sc.flying = null; sc.rise = sc.sk.map((s) => ({ num: s.num, t: 0 })); a.th = null; a.wait = 2.4;
      }
    }
    stepParts(sc.parts, dt);
    // the title's lawn: a slow, wide view of the thrower and the bundle (the menu column sits over the foreground)
    easeCam(sc.cam, W > H ? { x: 40, y: -60, span: 330, spanY: 760, pitch: 0.3 } : { x: -20, y: -30, span: 360, spanY: 1000, pitch: 0.3 }, dt, 2);
  };

  // ---- match flow ------------------------------------------------------------------------------
  const m0 = () => state.m;
  const cur = () => state.m.players[state.m.turn];
  const isAI = (i) => state.m.players[i].ai >= 0;
  const isWatch = () => state.m.cfg.mode === 'watch';
  const profOf = (i) => PROFILES[state.m.players[i].ai];
  const ctxOf = (p) => ({ score: p.score, target: state.m.target, back: state.m.back, misses: p.misses });

  const beginTurn = (newSide = false) => {
    const m = state.m, p = cur();
    state.humanTurn = !isAI(m.turn);
    state.hint = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.pull = null; state.aim = null; state.kb = null; state.glow = 0;
    state.steady = 0;
    state.aimSet = { style: state.settings.style, flat: state.settings.flat };
    state.pass = state.humanTurn && m.cfg.mode === 'two' && m.players.filter((q) => !q.out).length > 1 && newSide ? { t: 0 } : null;
    state.delay = Math.max(state.delay, 0.5);
    if (state.humanTurn && p.throws === 0 && m.cfg.mode !== 'two') toast('Pull back on the lawn like a sling and let go', 4.5);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    resetIds();
    const len = LENGTHS[cfg.length] ?? LENGTHS.classic;
    let players;
    if (cfg.mode === 'watch') players = [{ name: PROFILES[cfg.watchA].name, ai: cfg.watchA }, { name: PROFILES[cfg.opp].name, ai: cfg.opp }];
    else if (cfg.mode === 'two') players = Array.from({ length: cfg.count }, (_, i) => ({ name: `Player ${i + 1}`, ai: -1 }));
    else if (cfg.mode === 'solo') players = [{ name: 'You', ai: -1 }];
    else {
      players = [{ name: 'You', ai: -1 }];
      for (let i = 0; i < cfg.count; i++) { const k = (cfg.opp + i) % 4; players.push({ name: PROFILES[k].name, ai: k }); }
    }
    const first = cfg.first !== undefined ? cfg.first : (players.length > 1 && cfg.mode !== 'watch' ? aiRng.int(players.length) : 0);
    state.m = newMatch({ ...cfg, target: len.target, players, first });
    state.sk = startSkittles();
    state.cam = { x: 0, y: 0, span: 150 };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.sheet = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.act = null; state.rise = []; state.endT = -1; state.pass = null; state.last = null; state.delay = 0;
    if (cfg.mode !== 'watch' && state.demo) { state.record.demoMatches++; save(); }
    beginTurn(false);
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, length: 'short', first: 0 });
  };

  // ---- aiming ----------------------------------------------------------------------------------
  const rfOf = () => 1 - 0.72 * state.steady;
  const specFromAim = (psi, v) => ({ psi, v, style: state.aimSet.style, flat: state.aimSet.flat, yaw: 0, spinDir: 1, jit: 0 });
  const setAim = (psi, v) => {
    const spec = specFromAim(psi, v), lnd = landingOf(spec), rf = rfOf();
    state.aim = { spec, x: lnd.x, y: lnd.y, rx: 2 * SX * rf, ry: 2 * SY * rf, steady: state.steady, psi, v };
  };

  // ---- the act of a throw -----------------------------------------------------------------------
  // wind: seconds from the decision to the pin leaving the hand (the person is drawn winding back and swinging; the physics waits).
  // A human has already wound back by pulling, so only the swing remains; a rival anticipates first. pw = how far back the pull was.
  const beginThrow = (sp, o = {}) => {
    const m = state.m;
    if (state.act || m.over) return;
    const th = makeThrow(cloneSk(state.sk), sp);
    const ant = o.ant ?? 0, swing = o.swing ?? 0.3;
    state.act = { th, side: m.turn, trail: [], ev: 0, slow: 0, wind: ant + swing, windTot: ant + swing, ant, pw: o.pw ?? 0, released: false };
    state.humanTurn = false; state.hint = null; state.aim = null; state.pull = null; state.kb = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false;
    state.pass = null; state.toastT = Math.min(state.toastT, 0.2);
    state.act.whoosh = clamp((sp.v - V_MIN) / (V_MAX - V_MIN), 0, 1);
  };
  // the delivery of a person: the hand's wobble (smaller when steady) moves where the pin lands
  const humanThrow = (psi, v) => {
    const base = specFromAim(psi, v), l = landingOf(base), rf = rfOf();
    const g = () => (thRng.next() + thRng.next() + thRng.next() - 1.5) / 0.5;
    const tx = l.x + g() * SX * rf, ty = l.y + g() * SY * rf;
    const sp = specFor(tx, ty, base.style, base.flat, thRng.next() * Math.PI, thRng.next() < 0.5 ? -1 : 1);
    sp.jit = g() * 0.07;
    beginThrow(sp, { ant: 0, swing: 0.3, pw: clamp((v - V_MIN) / (V_MAX - V_MIN), 0, 1) });
  };
  const aiThrow = (plan, prof) => {
    const ex = executePlan(plan, prof, aiRng);
    const sp = specFor(clamp(ex.tx, -120, 120), clamp(ex.ty, -90, 140), plan.style, plan.flat, aiRng.next() * Math.PI, aiRng.next() < 0.5 ? -1 : 1);
    sp.jit = (aiRng.next() - 0.5) * 0.16;
    beginThrow(sp, { ant: 0.45, swing: 0.32, pw: 0 });
  };

  const handleEvents = (a, ev) => {
    for (const e of ev) {
      if (e.type === 'land') { sfx.thud(e.v); dustPuff(state.parts, e.x, e.y, 5); if (e.v > 300) state.camShake = Math.max(state.camShake, Math.min(1, e.v / 900)); }
      else if (e.type === 'topple') { sfx.knock(e.v, e.num); chips(state.parts, e.x, e.y, 4); if (e.v > 220) state.camShake = Math.max(state.camShake, 0.3); }
      else if (e.type === 'knock') sfx.clack(e.v);
      else if (e.type === 'tap') sfx.clack(e.v * 0.6);
    }
  };
  const describe = (name, res, m) => {
    if (res.kind === 'miss') return `${name} missed${res.out ? ' for the third time in a row and is out' : ''}`;
    const how = res.kind === 'single' ? `the ${res.num}` : `${res.count} skittles`;
    if (res.win) return `${name} knocked ${how}: exactly ${m.target}. A win`;
    if (res.dropped) return `${name} knocked ${how}: ${res.before} + ${res.pts} is over ${m.target}, back to ${m.back}`;
    return `${name} knocked ${how}: ${res.before} + ${res.pts} = ${res.after}`;
  };
  const settle = () => {
    const m = state.m, a = state.act, p = m.players[a.side], th = a.th;
    const knocked = th.knocked.slice().sort((x, y) => x - y);
    const before = state.sk;
    const after = th.standUp();
    state.sk = after;
    const moved = after.filter((s) => { const o = before.find((q) => q.num === s.num); return !o || Math.hypot(o.x - s.x, o.y - s.y) > 0.5; });
    state.rise = moved.map((s) => ({ num: s.num, t: 0 }));
    state.act = null;
    const res = applyThrow(m, knocked);
    const nm = p.name;
    state.last = { text: describe(nm, res, m), res };
    const rec = state.record;
    if (m.cfg.mode !== 'watch') { rec.throws++; rec.bestKnock = Math.max(rec.bestKnock | 0, knocked.length); }
    if (res.kind === 'miss') { pop(0, 0, res.out ? 'OUT' : 'MISS', '#ffb59a', 44); sfx.miss(); }
    else {
      const label = res.kind === 'single' ? `${res.num}` : `${res.count}`;
      pop(0, 0, res.win ? `${m.target}!` : res.dropped ? `Over! Back to ${m.back}` : `+${res.pts}`, res.dropped ? '#ff9a7a' : '#fff1b0', res.dropped ? 34 : 50);
      if (res.dropped) sfx.drop(); else sfx.score(res.pts);
      if (res.kind === 'multi' && !res.dropped && !res.win) pop(0, -14, `${label} skittles`, '#ffe9c0', 26);
      sparkle(state.parts, 0, 0, res.win ? 40 : 10);
    }
    state.glow = 0;
    const e = nextTurn(m);
    if (m.over) { finishMatch(); return; }
    state.delay = 1.3;
    if (res.dropped) toast(`Over ${m.target}: ${nm} drops back to ${m.back}`, 3);
    beginTurn(e.kind === 'next' && m.n > 1);
  };
  const updateAct = (dt) => {
    const a = state.act, th = a.th;
    if (a.wind > 0) {
      a.wind -= dt;
      if (a.wind > 0) return;
      dt = -a.wind; a.wind = 0; a.released = true; sfx.whoosh(a.whoosh || 0);
      if (dt <= 0) return;
    }
    let step = dt;
    if (!th.air) { a.slow += dt; if (a.slow < 1.1) step = dt * 0.75; }
    th.advance(step);
    if (th.air) {
      const f = th.f;
      a.trail.push({ x: f.vh * f.sx * th.t, y: -350 + f.vh * f.sy * th.t, z: 38 + f.vz * th.t - 490.5 * th.t * th.t });
      if (a.trail.length > 18) a.trail.shift();
    } else if (a.trail.length) a.trail.length = 0;
    if (th.events.length) { handleEvents(a, th.events); th.events.length = 0; }
    if (th.done) settle();
  };
  const finishMatch = () => {
    const m = state.m, o = m.over;
    state.endT = 0; state.humanTurn = false; state.act = null;
    const r = state.record;
    if (m.cfg.mode === 'watch') { sfx.win(); return; }
    r.played++;
    const w = o.win;
    if (m.cfg.mode === 'solo') { if (w === 0 && o.why === 'exact') { const t = m.players[0].throws; r.bestSolo = r.bestSolo ? Math.min(r.bestSolo, t) : t; r.exact++; sfx.win(); } }
    else if (m.cfg.mode === 'ai') {
      if (w === 0) { r.wins[m.cfg.opp]++; r.streak++; r.best = Math.max(r.best, r.streak); sfx.win(); } else r.streak = 0;
    } else if (w >= 0) sfx.win();
    if (w >= 0 && o.why === 'exact') r.exact = (r.exact | 0) + (m.cfg.mode === 'solo' ? 0 : 1);
    save();
  };

  // ---- AI turn ---------------------------------------------------------------------------------
  const nearestNum = (x, y) => {
    let best = null, bd = 1e9;
    for (const s of state.sk) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
    return best ? best.num : 0;
  };
  const describePlan = (p) => {
    const pts = p.predicted ? pointsOf(p.predicted) : 0;
    const n = p.predicted ? p.predicted.length : 0;
    const what = n === 0 ? 'a safe landing' : n === 1 ? `the ${p.predicted[0]} alone` : p.sure === false ? `about ${n} skittles` : `${n} skittles for ${pts}`;
    return `${throwName(p.style, p.flat)} near the ${nearestNum(p.tx, p.ty)}: aiming at ${what}`;
  };
  const planVisual = (p) => ({ tx: p.tx, ty: p.ty, spec: specFor(p.tx, p.ty, p.style, p.flat, 1.25) });
  const updateAI = (dt) => {
    const m = state.m;
    if (state.act || m.over || !isAI(m.turn) || state.paused || state.pass || state.delay > 0) return;
    const prof = profOf(m.turn), watch = isWatch(), p = cur();
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, p: null };
      planner = createPlanner(state.sk, ctxOf(p), prof, aiRng);
      if (watch) toast(`${p.name} is thinking…`, Math.min(dur, 6));
    }
    const th = state.think;
    th.t += dt;
    if (planner) { if (!planner.done) planner.step(60); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      state.hint = planVisual(th.plan); state.glow = nearestNum(th.plan.tx, th.plan.ty);
      state.aimSet = { style: th.plan.style, flat: th.plan.flat };
      th.phase = 'reveal'; th.t = 0; th.dur = watch ? 2 : 0.7;
      if (watch) toast(`${p.name}: ${describePlan(th.plan)}`, 2.2);
    } else if (th.phase === 'reveal' && th.t >= th.dur) {
      aiThrow(th.plan, prof);
    }
  };

  // ---- hint ------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || state.act || !state.humanTurn || m.over) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.sk, ctxOf(cur()), PROFILES[4], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    if (!hintPlanner.done) hintPlanner.step(70);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.act || !state.humanTurn) return;
      state.hint = planVisual(r);
      state.aimSet = { style: r.style, flat: r.flat };
      state.glow = nearestNum(r.tx, r.ty);
      toast(`Hint: ${describePlan(r)}. Pull until your ring sits on the gold one.`, 5);
    }
  };

  // ---- the play scene --------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.sheet = false; state.ui.scroll = 0; state.pull = null; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const openSheet = () => { state.sheet = true; state.paused = true; state.ui.scroll = 0; state.pull = null; };
  const closeSheet = () => { state.sheet = false; state.paused = state.pauseMenu; state.ui.scroll = 0; };

  const infoNow = () => {
    const m = state.m;
    if (m.over) return 'Match over';
    const p = cur();
    if (state.act) return `${p.name} throws…`;
    if (state.last && state.delay > 0.2) return state.last.text;
    if (state.humanTurn) { const a = adviceFor(m, p); return `${p.name}${m.cfg.mode === 'two' ? '' : ''}, your throw. ${a}`; }
    return `${p.name} is thinking… ${adviceFor(m, p) ? '' : ''}`.trim();
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state);
    if (config.dev && keys.pressed.has('KeyK')) {
      m.players[0].score = m.target; m.over = { win: 0, why: 'exact' }; state.act = null; finishMatch(); state.scene = 'result'; state.ui.scroll = 0; return;
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.sheet) closeSheet(); else if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused;
    }
    if (keys.pressed.has('KeyC') && !watch && !state.pauseMenu) { if (state.sheet) closeSheet(); else openSheet(); }
    if (state.pauseMenu || state.sheet) {
      if (flowMeta().key !== (state.sheet ? 'sheet' : 'pause')) return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    if (m.over && state.endT >= 0 && !state.act) {
      state.endT += dt;
      if (state.endT > 2.2 || (ptr.pressed && state.endT > 0.8)) { state.scene = 'result'; state.ui.scroll = 0; state.endT = -1; return; }
    }
    let onButton = false;
    if (watch) {
      if (ptr.pressed && L.demo) {
        const D2 = L.demo;
        if (inRect(D2.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D2.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D2.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D2.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && L.btns) {
      if (inRect(L.btns.menu, ptr.x, ptr.y) && !state.pass) { openPause(); return; }
      if (inRect(L.btns.card, ptr.x, ptr.y) && !state.pass) { openSheet(); sfx.tick(); return; }
      if (inRect(L.btns.hint, ptr.x, ptr.y)) { onButton = true; if (state.humanTurn && !state.pass) { requestHint(); sfx.tick(); } }
    }
    const canAim = state.humanTurn && !state.paused && !state.act && !m.over && state.delay <= 0;
    if (state.pass) {
      state.pass.t += dt;
      if (ptr.pressed && state.pass.t > 0.35) { state.pass = null; sfx.tick(); }
    } else if (canAim) {
      const tg = L.tg;
      if (ptr.pressed && !onButton) {
        if (inRect(tg.style, ptr.x, ptr.y)) { state.aimSet.style = 1 - state.aimSet.style; state.settings.style = state.aimSet.style; state.hint = state.hint ? null : null; sfx.tick(); save(); onButton = true; }
        else if (inRect(tg.spin, ptr.x, ptr.y)) { state.aimSet.flat = !state.aimSet.flat; state.settings.flat = state.aimSet.flat; state.hint = null; sfx.tick(); save(); onButton = true; }
        else if (inRect(L.field, ptr.x, ptr.y)) {
          state.pull = { x0: ptr.x, y0: ptr.y, x: ptr.x, y: ptr.y, v: PULL_V0, lx: ptr.x, ly: ptr.y };
          state.steady = 0; state.kb = null;
        }
      }
      const pu = state.pull;
      if (pu) {
        if (ptr.down || ptr.released) {
          const mv = Math.hypot(ptr.x - pu.lx, ptr.y - pu.ly);
          pu.lx = ptr.x; pu.ly = ptr.y; pu.x = ptr.x; pu.y = ptr.y;
          if (mv < 0.9) state.steady = Math.min(1, state.steady + dt / 1.3);
          else if (mv > 3) state.steady = Math.max(0, state.steady - dt * 2.2);
          else state.steady = Math.max(0, state.steady - dt * 0.3);
        }
        const dy = clamp(pu.y - pu.y0, 0, PULL_MAX), dx = pu.x - pu.x0;
        const psi = clamp(-dx / PULL_KP, -0.4, 0.4), v = clamp(PULL_V0 + PULL_KV * dy, V_MIN, V_MAX);
        pu.v = v;
        if (dy >= PULL_MIN) setAim(psi, v); else state.aim = null;
        if (ptr.released) {
          state.pull = null;
          const cancel = inRect(L.tg.style, ptr.x, ptr.y) || inRect(L.tg.spin, ptr.x, ptr.y) || (L.btns && (inRect(L.btns.hint, ptr.x, ptr.y) || inRect(L.btns.menu, ptr.x, ptr.y) || inRect(L.btns.card, ptr.x, ptr.y)));
          if (dy >= PULL_MIN && !cancel) humanThrow(psi, v);
          else { state.aim = null; if (!cancel && dy > 3) toast('Pull a little further, then let go', 1.8); }
        }
      }
      // keyboard
      const k = keys.down;
      let used = false;
      const kb = state.kb ?? { psi: 0, v: 620 };
      if (k.has('ArrowLeft') || k.has('KeyA')) { kb.psi = clamp(kb.psi - 0.0035, -0.4, 0.4); used = true; }
      if (k.has('ArrowRight') || k.has('KeyD')) { kb.psi = clamp(kb.psi + 0.0035, -0.4, 0.4); used = true; }
      if (k.has('ArrowUp') || k.has('KeyW')) { kb.v = clamp(kb.v + 4, V_MIN, V_MAX); used = true; }
      if (k.has('ArrowDown') || k.has('KeyS')) { kb.v = clamp(kb.v - 4, V_MIN, V_MAX); used = true; }
      if (keys.pressed.has('Digit1')) { state.aimSet.style = 1 - state.aimSet.style; state.settings.style = state.aimSet.style; used = true; save(); }
      if (keys.pressed.has('Digit2')) { state.aimSet.flat = !state.aimSet.flat; state.settings.flat = state.aimSet.flat; used = true; save(); }
      if (used && !state.pull) { state.kb = kb; state.steady = 1; }
      if (state.kb && !state.pull) setAim(state.kb.psi, state.kb.v);
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) {
        if (state.kb) humanThrow(state.kb.psi, state.kb.v);
        else if (state.aim) humanThrow(state.aim.psi, state.aim.v);
      }
    } else if (state.pull && !state.humanTurn) state.pull = null;
    if (state.paused) return;
    state.delay = Math.max(0, state.delay - dt);
    updateHint();
    updateAI(dt);
    if (state.act) updateAct(dt);
    clackT = Math.max(0, clackT - dt);
    for (const r of state.rise) r.t += dt;
    state.rise = state.rise.filter((r) => r.t < 0.5);
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    state.camShake = Math.max(0, state.camShake - dt * 3);
    const bodies = state.act ? state.act.th.bodies : null;
    const tgt = camFor(state.sk, bodies, L.land);
    easeCam(state.cam, tgt, dt, state.act ? 4 : 2.6);
    state.info = infoNow();
  };

  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.sheet = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null;
    state.hintBusy = false; state.pull = null; state.act = null; state.pass = null; state.aim = null; state.hint = null;
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'sheet-close') closeSheet();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus -----------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const gotoSetup = (mode) => { state.setup.mode = mode; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') gotoSetup('ai');
    else if (id === 'two') gotoSetup('two');
    else if (id === 'solo') gotoSetup('solo');
    else if (id === 'watch') startWatch();
    else if (id === 'records') { state.scene = 'records'; state.ui.scroll = 0; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('cnt')) s.count = Number(id.slice(3));
    else if (id === 'len-classic') s.length = 'classic';
    else if (id === 'len-short') s.length = 'short';
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, count: s.mode === 'ai' ? clamp(s.count, 1, 3) : clamp(Math.max(2, s.count), 2, 4), length: s.length });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore' && !state.restoreBusy && !state.owned()) {
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = state.owned() ? 'Purchase restored. Thank you!' : 'No earlier purchase found.'; }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, first: cfg.players.length > 1 ? aiRng.int(cfg.players.length) : 0 });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : 4);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    ensureLayout(state, 'setup');
    const pins = setupPinRects(state);
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  let shotTick = 0;
  const shotQ = (() => { try { return new URLSearchParams(globalThis.location?.search ?? ''); } catch { return new URLSearchParams(''); } })();
  const shotMode = shotQ.has('shot'), shotTicks = Number(shotQ.get('ticks') ?? 0) || 0;
  startAttract();
  resetMenus();
  void BOUNDS; void STEP; void flightOf;

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.pass,
    update(dt, input) {
      if (shotMode) {
        // Store screenshots: a scripted scene, not the kit's random taps. ticks 0 = title; otherwise a rivals-only match plays itself.
        shotTick++;
        input = { pointer: { x: -9999, y: -9999, down: false, pressed: false, released: false }, keys: { pressed: new Set(), down: new Set() }, onWheel: input.onWheel, wheel: { dx: 0, dy: 0 } };
        if (shotTick === 1 && shotTicks > 0) { state.demo = false; startWatch(); }
      }
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit', 'records'].includes(state.scene) || state.pauseMenu || state.sheet) state.ui.scroll = clamp(state.ui.scroll + dy, 0, Math.max(0, flowMeta().h ?? 0));
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'records': updateFlowScene(dt, input, (id) => { if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; } }, 'records'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      GL.state = state;
      if (GL.on) ctx.clearRect(0, 0, meta.width, meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'records': renderRecords(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          else if (state.sheet) renderSheet(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // QA only (reachable through window.__dft when the dev flag is on): start a match without tapping through the menus
    devStart: (cfg) => { if (config.dev) { state.demo = false; startMatch(cfg); } },
    devGo: (scene) => { if (config.dev) { state.scene = scene; state.ui.scroll = 0; } },
    lockupZone: () => lockupZone(),
  };
}
void nameOf;
