// Disc Flick Table: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js and menus.js, the
// opponent in ai.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// Flicking: press anywhere in the play area and drag back like a slingshot; pull length = power, pull direction = aim;
// release flicks. The slider under the board sets where along the baseline the disc starts.
import {
  createWorld, newDisc, launch, stepWorld, resolveShot, previewShot, startPoint, clamp, MAX_U, R_BASE, discValue,
  speedForDistance, speedToPower, PEGS, spotBlocked, freeSpot,
} from './sim.js';
import { newMatch, beginRound, afterShot, scoreRound, applyRound, anyRivals } from './match.js';
import { createPlanner, executePlan } from './ai.js';
import { PROFILES } from './opponents.js';
import {
  W, H, inRect, PULL, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, TEXT_SCALES, THINK_STEPS, SETUP_PINS,
} from './layout.js';
import { renderPlay, layoutOf, sliderSign } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout, resetMenus } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_ROUND_CAP = 2;
const FALL_T = 0.5;
// Stray-touch guard (the kit has one pointer): a second finger shows up as the pointer jumping across the screen in a
// single tick. During a pull such a jump is ignored, and a release that lands that far from the last accepted pull
// position is a second finger lifting, so it cancels the pull instead of flicking from the wrong spot.
export const STRAY_JUMP = 220;
const PEGX = PEGS.map((p) => p.x), PEGY = PEGS.map((p) => p.y);

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, rotate: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoRounds: 0, flicks: 0, topRound: 0 },
    setup: { mode: 'ai', opp: 0, rounds: 2 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    att: null, w: null, m: null,
    aim: { u: 0, ang: -Math.PI / 2, power: 0.5, active: false, manual: false }, preview: null, hint: null, hintPreview: null, hintBusy: false, alts: null,
    parts: [], pops: [], pegFlash: new Array(8).fill(0), pass: null, lastSide: -1, toast: '', toastT: 0, humanTurn: false, view: { rot: 0, target: 0 },
    think: null, aiDrag: null, kbOn: false, blocked: false, drag: null, hadRiv: false, restT: 0, flyT: 0, clearT: 0, loaded: false, restoreMsg: '', ff: 1,
    saved: null,
  };
  let planner = null, hintPlanner = null, previewKey = '', slideDrag = false;

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('match', null)]).then(([s, r, mt]) => {
    if (s) Object.assign(state.settings, s);
    if (!state.saved) state.saved = validSnapshot(mt);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // A match is written down at every safe point (a turn is about to start, so every disc is at rest) and offered
  // as Continue on the menu. Killed mid-flick, the player resumes at the start of that flick. Watch & Learn is not saved.
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  function validSnapshot(sn) {
    try {
      if (!sn || sn.v !== 1 || !sn.cfg || !(sn.cfg.mode === 'ai' || sn.cfg.mode === 'two')) return null;
      const c = sn.cfg;
      if (!num(c.opp, 0, PROFILES.length - 1) || !num(c.rounds, 1, 99) || !num(c.first, 0, 1)) return null;
      if (!num(sn.round, 1, 99) || !num(sn.rounds, sn.round, 99) || !num(sn.turn, 0, 1) || !num(sn.shots, 0, 9999) || !num(sn.u, -1, 1)) return null;
      if (!Array.isArray(sn.scores) || sn.scores.length !== 2 || !sn.scores.every((v) => num(v, 0, 99999))) return null;
      if (!Array.isArray(sn.hand) || sn.hand.length !== 2 || !sn.hand.every((v) => num(v, 0, 8)) || sn.hand[sn.turn] < 1) return null;
      if (!Array.isArray(sn.log) || sn.log.length > 99 || !sn.log.every((r) => r && num(r.round, 1, 99) && Array.isArray(r.pts) && r.pts.length === 2 && r.pts.every((v) => num(v, 0, 999)))) return null;
      if (!Array.isArray(sn.discs) || sn.discs.length > 16 || !num(sn.nextId, 1, 99999)) return null;
      if (!sn.discs.every((d) => d && num(d.id, 1, 99999) && (d.team === 0 || d.team === 1) && (d.mode === 'live' || d.mode === 'pocket') && num(d.x, -400, 400) && num(d.y, -400, 400) && num(d.spin, -1e6, 1e6))) return null;
      return sn;
    } catch { return null; }
  }
  const snapshot = () => {
    const { m, w } = state;
    return {
      v: 1, cfg: { mode: m.cfg.mode, opp: m.cfg.opp, rounds: m.cfg.rounds, first: m.cfg.first ?? 0 },
      round: m.round, rounds: m.rounds, scores: m.scores.slice(), hand: m.hand.slice(), first: m.first, turn: m.turn, shots: m.shots,
      log: m.roundLog.map((r) => ({ round: r.round, pts: r.pts.slice() })), u: state.aim.u, nextId: w.nextId,
      discs: w.discs.filter((d) => d.mode === 'live' || d.mode === 'pocket').map((d) => ({ id: d.id, team: d.team, mode: d.mode, x: d.x, y: d.y, spin: d.spin })),
    };
  };
  const persistMatch = () => { if (state.m && state.m.cfg.mode !== 'watch' && !state.m.over) { state.saved = snapshot(); storage.set('match', state.saved); } };
  const clearSaved = () => { if (state.saved) { state.saved = null; storage.set('match', null); } };

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whoosh: (p = 0.5) => tone({ freq: 260 + p * 380, to: 90, dur: 0.2, type: 'sawtooth', vol: 0.035 }),
    clack: (v) => {
      const q = Math.min(1, v / 700);
      tone({ freq: 1500 + fx.next() * 500, to: 800, dur: 0.045, type: 'square', vol: 0.025 + 0.06 * q });
      tone({ freq: 520 + fx.next() * 120, to: 300, dur: 0.1, type: 'triangle', vol: 0.05 + 0.12 * q });
    },
    ting: (v) => tone({ freq: 2300 + fx.next() * 300, to: 2100, dur: 0.16, type: 'sine', vol: 0.03 + 0.05 * Math.min(1, v / 500) }),
    drop: () => { tone({ freq: 360, to: 90, dur: 0.3, type: 'sine', vol: 0.16 }); tone({ freq: 880, dur: 0.35, type: 'triangle', vol: 0.08 }); },
    gutter: () => tone({ freq: 150, to: 60, dur: 0.2, type: 'sine', vol: 0.08 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.19, i), dur: 0.22, type: 'sine', vol: 0.09 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles -------------------------------------------------------------------------------
  const MAX_PARTS = 160;   // hard cap: a pile-up of hits can never make the frame cost grow without bound
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const burst = (parts, x, y, n, col) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = 30 + fx.next() * 90; addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + fx.next() * 0.3, size: 1.6 + fx.next() * 1.6, col }); }
  };
  const sparks = (parts, x, y, n) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = 140 + fx.next() * 280; addPart(parts, { kind: 1, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.18 + fx.next() * 0.16 }); }
  };
  const confetti = (parts, x, y, n) => {
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 110 + fx.next() * 260, leaf = i % 3 === 0;
      addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.8 + fx.next() * 0.5, size: leaf ? 8 + fx.next() * 4 : 2.5 + fx.next() * 2, leaf, rot: fx.next() * 6, col: leaf ? (i % 2 ? '#e4504a' : '#ffd35a') : '#ffe08a' });
    }
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.3 }); if (state.pops.length > 12) state.pops.shift(); };

  const worldEvents = (w, parts, ev, live) => {
    for (const e of ev) {
      if (e.t === 'hit') {
        sparks(parts, e.x, e.y, Math.min(9, 2 + Math.floor(e.v / 90)));
        burst(parts, e.x, e.y, 2 + Math.floor(e.v / 200), 'rgba(255,238,200,0.9)');
        addPart(parts, { kind: 2, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.35, size: 26, col: '#fff6d8' });
        for (const d of w.discs) if (d.id === e.a || d.id === e.b) d.heat = Math.min(1, e.v / 500);
        if (live) {
          sfx.clack(e.v);
        }
      } else if (e.t === 'peg') {
        let bi = 0, bd = 1e9;
        for (let i = 0; i < 8; i++) { const d = Math.hypot(e.x - PEGX[i], e.y - PEGY[i]); if (d < bd) { bd = d; bi = i; } }
        state.pegFlash[bi] = 1;
        addPart(parts, { kind: 2, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.34, size: 30, col: '#ffe08a' });
        sparks(parts, e.x, e.y, 5);
        if (live) sfx.ting(e.v);
      } else if (e.t === 'pocket') {
        confetti(parts, 0, 0, 22);
        addPart(parts, { kind: 2, x: 0, y: 0, vx: 0, vy: 0, t: 0, max: 0.6, size: 70, col: '#ffd35a' });
        if (live) { sfx.drop(); pop(0, -50, '+20', '#ffe08a', 44); }
      } else if (e.t === 'gutter') {
        burst(parts, e.x, e.y, 4, 'rgba(60,34,16,0.8)');
        if (live) sfx.gutter();
      }
    }
  };

  // ---- the attract table behind the menus ---------------------------------------------------------------
  const startAttract = () => {
    const w = createWorld();
    for (const [team, x, y] of [[0, -70, -120], [1, 90, -60], [0, 40, 120], [1, -120, 60]]) w.discs.push(newDisc(w, team, x, y));
    state.att = { w, parts: [], wait: 1.4, n: 0 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    for (const d of a.w.discs) if (d.heat > 0) d.heat = Math.max(0, d.heat - dt * 2.2);
    if (a.wait <= 0 && a.w.settled) {
      a.wait = 3.4;
      a.w.discs = a.w.discs.filter((d) => d.mode === 'live');
      if (a.w.discs.length > 9) a.w.discs.splice(0, 3);
      const side = a.n++ % 2, u = (fx.next() - 0.5) * 1.0;
      const tr = 40 + fx.next() * 170, ta = fx.next() * Math.PI * 2, tx = Math.cos(ta) * tr, ty = Math.sin(ta) * tr;
      const p = startPoint(side, u), dist = Math.hypot(tx - p.x, ty - p.y);
      launch(a.w, side, u, Math.atan2(ty - p.y, tx - p.x), speedToPower(speedForDistance(dist + 40)));
    }
    if (!a.w.settled || a.w.discs.some((d) => d.mode !== 'live')) {
      const ev = stepWorld(a.w, dt);
      worldEvents(a.w, a.parts, ev, false);
      if (a.w.settled && a.w.shot) { resolveShot(a.w, false); a.w.shot = null; }
      a.w.discs = a.w.discs.filter((d) => !(d.mode === 'gutter' && d.fall > FALL_T) && !(d.mode === 'pocket' && d.fall > 0.6));
    }
    stepParts(a.parts, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);
  const sideLabel = (side) => {
    const m = state.m;
    if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
    if (m.cfg.mode === 'watch') return profOf(side).name;
    return side === 0 ? 'You' : profOf(1).name;
  };
  const centreAim = (side, u) => { const p = startPoint(side, u); return Math.atan2(-p.y, -p.x); };

  const beginTurn = (resumed = false) => {
    const m = state.m, side = m.turn;
    m.phase = 'aim';
    state.humanTurn = !isAI(side);
    state.hint = null; state.hintPreview = null; state.alts = null; state.think = null; state.preview = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.kbOn = false; slideDrag = false;
    // fixed camera rule: the playing surface never moves. Only the optional setting (off by default) turns the board.
    state.view.target = m.cfg.mode === 'two' && side === 1 && state.settings.rotate ? Math.PI : 0;
    state.pass = (!resumed && m.cfg.mode === 'two' && state.lastSide >= 0 && state.lastSide !== side) ? { side, t: 0 } : null;
    state.lastSide = side;
    const u = state.humanTurn ? freeSpot(state.w, side, clamp(state.aim.u, -MAX_U, MAX_U)) : 0;
    state.aim = { u, ang: centreAim(side, u), power: 0.5, active: false, manual: false };
    if (resumed) toast('Match restored. Press Resume to carry on', 3.2);
    else if (state.humanTurn) toast(m.cfg.mode === 'two' ? `${sideLabel(side)}: your flick` : (anyRivals(state.w, side) ? 'Your flick: you must touch a rival disc' : 'Your flick: aim for the middle'), 2.8);
    else if (m.cfg.mode !== 'watch') toast(`${sideLabel(side)} is thinking…`, 2.0);
    if (!resumed) persistMatch();
  };
  const startRound = () => { beginRound(state.m, state.w); state.parts = []; state.pops = []; beginTurn(); toast(`Round ${state.m.round}: ${sideLabel(state.m.turn)} shoots first`, 2.6); };

  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.w = createWorld();
    state.m = newMatch({ mode: 'ai', opp: 0, rounds: 2, first: aiRng.int(2), watchA: 3, ...cfg });
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.view.rot = 0; state.view.target = 0; state.aim.u = 0; state.pass = null; state.lastSide = -1;
    beginRound(state.m, state.w);
    beginTurn();
  };
  const resumeMatch = () => {
    const sn = state.saved;
    if (!sn) return;
    if (state.demo && state.record.demoRounds >= DEMO_ROUND_CAP) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const w = createWorld();
    w.nextId = sn.nextId;
    for (const d of sn.discs) { const q = newDisc(w, d.team, d.x, d.y); q.id = d.id; q.mode = d.mode; q.spin = d.spin; if (d.mode === 'pocket') q.fall = 99; w.discs.push(q); }
    w.nextId = Math.max(w.nextId, ...w.discs.map((d) => d.id + 1));
    const m = newMatch({ ...sn.cfg, watchA: 3 });
    Object.assign(m, { round: sn.round, rounds: sn.rounds, scores: sn.scores.slice(), hand: sn.hand.slice(), first: sn.first, turn: sn.turn, shots: sn.shots, roundLog: sn.log.map((r) => ({ round: r.round, pts: r.pts.slice() })), phase: 'aim' });
    state.w = w; state.m = m;
    state.scene = 'play'; state.ui.scroll = 0; state.parts = []; state.pops = [];
    state.aim.u = sn.u; state.hadRiv = false; state.flyT = 0; state.restT = 0; state.ff = 1;
    beginTurn(true);
    state.view.rot = state.view.target;
    openPause();    // always resumes paused: nothing moves, and no preview time is used, until the player presses Resume
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, rounds: 1 });
  };

  const throwDisc = (side, p) => {
    const { m, w } = state;
    state.hadRiv = anyRivals(w, side);
    launch(w, side, p.u, p.ang, p.power);
    m.phase = 'fly';
    if (!isAI(side)) state.record.flicks = (state.record.flicks | 0) + 1;
    state.humanTurn = false; state.preview = null; state.hint = null; state.hintPreview = null; state.alts = null; state.drag = null; state.think = null; state.aiDrag = null; state.kbOn = false;
    state.aim.active = false;
    planner = null; hintPlanner = null; state.hintBusy = false;
    state.restT = 0; state.flyT = 0;
    sfx.whoosh(p.power);
  };

  const describeNote = (n) => (n.k === 'nohit' ? 'No rival disc touched: that disc is removed' : n.k === 'short' ? 'Too short: that disc is removed' : 'Off the scoring rings: removed');
  const onSettled = () => {
    const { m, w } = state;
    const notes = resolveShot(w, state.hadRiv);
    const shot = w.discs.find((d) => d.id === w.shot);
    if (notes.length) {
      toast(describeNote(notes[0]), 2.6); sfx.no();
      pop(notes[0].x, notes[0].y, notes[0].k === 'nohit' ? 'No contact' : 'Out', '#ffb48a', 26);
      for (const n of notes) { burst(state.parts, n.x, n.y, 10, 'rgba(255,170,130,0.9)'); addPart(state.parts, { kind: 2, x: n.x, y: n.y, vx: 0, vy: 0, t: 0, max: 0.45, size: 34, col: '#ffb48a' }); }
    } else if (shot && shot.mode === 'pocket') toast('Twenty! In the pocket', 2.4);
    m.phase = 'clear'; state.clearT = 0;
  };
  const finishClear = () => {
    const { m, w } = state;
    const over = afterShot(m, w);
    if (over) {
      const info = scoreRound(m, w);
      const sc = w.discs.filter((d) => d.mode === 'live' && discValue(d) > 0).length;
      for (let i = 0; i < Math.min(6, sc + info.pockets[0] + info.pockets[1]); i++) sfx.chime(i);
      toast(info.pts[0] === info.pts[1] ? 'Round tied' : `${sideLabel(info.pts[0] > info.pts[1] ? 0 : 1)} ${mode() === 'ai' && info.pts[0] > info.pts[1] ? 'take' : 'takes'} round ${info.round}`, 3.4);
    } else beginTurn();
  };
  const afterRound = () => {
    const m = state.m;
    applyRound(m, m.roundInfo);
    if (m.cfg.mode !== 'watch') state.record.demoRounds++;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      if (m.cfg.mode === 'ai') {
        state.record.played++;
        if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); sfx.win(); } else state.record.streak = 0;
      }
      state.record.topRound = Math.max(state.record.topRound | 0, ...m.roundLog.map((r) => r.pts[0]));
      clearSaved(); save();
    } else if (state.demo && m.cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { clearSaved(); save(); state.scene = 'demolimit'; state.ui.scroll = 0; }
    else { save(); startRound(); }
  };

  // ---- aiming ------------------------------------------------------------------------------------
  const updatePreview = () => {
    const { m, w, aim } = state;
    const key = `${m.turn}|${aim.u.toFixed(3)}|${aim.ang.toFixed(3)}|${aim.power.toFixed(3)}`;
    if (key === previewKey && state.preview) return;
    previewKey = key;
    const pv = previewShot(w, m.turn, aim.u, aim.ang, aim.power, 3);
    pv.needHit = anyRivals(w, m.turn);
    state.preview = pv;
  };
  const dragAim = (dr, ptr) => {
    const side = state.m.turn, rot = state.view.rot, c = Math.cos(-rot), s = Math.sin(-rot);
    const vx = dr.sx - ptr.x, vy = dr.sy - ptr.y;
    const wx = vx * c - vy * s, wy = vx * s + vy * c;
    const len = Math.hypot(wx, wy);
    const p = startPoint(side, state.aim.u);
    dr.len = len;
    dr.valid = len >= PULL.min && (wx * -p.x + wy * -p.y) > 0.05 * len * R_BASE;
    if (len > 4) { state.aim.ang = Math.atan2(wy, wx); state.aim.manual = true; }
    state.aim.power = clamp((len - PULL.min) / (PULL.max - PULL.min), 0, 1);
    state.aim.active = len >= PULL.min;
    if (dr.valid) updatePreview(); else state.preview = null;
  };
  const setSpot = (x) => {
    const u = clamp(sliderSign(state) * ((x - W / 2) / 276) * MAX_U, -MAX_U, MAX_U);
    if (u !== state.aim.u) {
      state.aim.u = u;
      if (!state.aim.manual) state.aim.ang = centreAim(state.m.turn, u);
      state.preview = null; state.hint = null; state.hintPreview = null;
    }
  };

  // ---- AI turn -----------------------------------------------------------------------------------
  const describePlan = (plan) => {
    const k = { pocket: 'try for the 20 pocket', takeout: 'knock a rival away', place: 'place a disc in the rings' }[plan.kind] ?? 'flick';
    return `${k} (power about ${Math.round(plan.power * 100)}%)`;
  };
  const beginPull = (th) => {
    const prof = profOf(state.m.turn);
    th.p = executePlan(th.plan, prof, aiRng);
    th.phase = 'pull'; th.t = 0; th.dur = 0.6; state.hint = null; state.alts = null; state.preview = null;
  };
  const updateAI = (dt) => {
    const { m } = state;
    if (m.phase !== 'aim' || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch', side = m.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, p: null };
      planner = createPlanner(state.w, side, prof, aiRng, {});
      if (watch) toast(`${sideLabel(side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { planner.step(12); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hint = th.plan; state.alts = th.plan.alts;
        state.aim = { u: th.plan.u, ang: th.plan.ang, power: th.plan.power, active: false, manual: true };
        const pv = previewShot(state.w, side, th.plan.u, th.plan.ang, th.plan.power, 3); pv.needHit = anyRivals(state.w, side);
        state.preview = pv; state.hintPreview = null;
        toast(`${sideLabel(side)}: ${describePlan(th.plan)}`, 2.1);
      } else beginPull(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginPull(th);
    else if (th.phase === 'pull') {
      const k = Math.min(1, th.t / th.dur), e = 1 - Math.pow(1 - k, 3);
      state.aim = { u: th.p.u, ang: th.p.ang, power: th.p.power * e, active: true, manual: true };
      state.aiDrag = true;
      if (th.t >= th.dur) { const p = { ...th.p, u: freeSpot(state.w, side, th.p.u) }; state.aiDrag = null; throwDisc(side, p); }
    }
  };

  // ---- hint --------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim' || !state.humanTurn) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m.turn, PROFILES[4], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(14);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      state.hint = r; state.alts = r.alts.slice(0, 2);
      const pv = previewShot(state.w, state.m.turn, r.u, r.ang, r.power, 3); pv.needHit = anyRivals(state.w, state.m.turn);
      state.hintPreview = pv;
      state.aim = { u: r.u, ang: r.ang, power: r.power, active: false, manual: true }; state.preview = null;
      toast(`Hint: ${describePlan(r)}`, 4);
    }
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state), barHidden = L.bannerReplacesBar && m.phase === 'score';
    // the hand-over card: the board is untouched; one tap from the next player starts their flick
    const passUp = !!state.pass && m.phase === 'aim' && !state.paused;
    if (passUp) { state.pass.t += dt; }
    if (config.dev && keys.pressed.has('KeyK')) { clearSaved(); m.scores[0] = 100; m.scores[1] = 60; m.over = { win: 0, extra: false }; m.phase = 'over'; state.scene = 'result'; state.ui.scroll = 0; return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    if (watch) {
      if (ptr.pressed && !barHidden) {
        const DEMO_BAR = L.demo;
        if (inRect(DEMO_BAR.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(DEMO_BAR.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(DEMO_BAR.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(DEMO_BAR.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && !barHidden && inRect(L.menu, ptr.x, ptr.y)) { openPause(); return; }
    state.ff = (m.phase === 'fly') && ptr.down && !state.paused ? 2 : 1;

    state.blocked = state.humanTurn && m.phase === 'aim' && spotBlocked(state.w, m.turn, state.aim.u);
    if (state.humanTurn && !state.paused && m.phase === 'aim' && !state.pass) {
      if (ptr.pressed) {
        if (inRect(L.slider, ptr.x, ptr.y)) { slideDrag = true; setSpot(ptr.x); }
        else if (inRect(L.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        else if (inRect(L.zone, ptr.x, ptr.y) && Math.abs(state.view.rot - state.view.target) < 0.05) { state.drag = { sx: ptr.x, sy: ptr.y, lx: ptr.x, ly: ptr.y, len: 0, valid: false }; state.hint = null; state.hintPreview = null; state.alts = null; state.kbOn = false; }
      }
      if (slideDrag) { if (ptr.down) setSpot(ptr.x); if (ptr.released || !ptr.down) slideDrag = false; }
      if (state.drag) {
        const d0 = state.drag;
        const stray = Math.hypot(ptr.x - d0.lx, ptr.y - d0.ly) > STRAY_JUMP;
        if (ptr.down && !stray) { d0.lx = ptr.x; d0.ly = ptr.y; dragAim(d0, ptr); }
        if (ptr.released && stray) {
          // a second finger lifted: not the pulling finger, so no flick (the pull is dropped; pull again)
          state.drag = null; state.aim.active = false; state.preview = null; toast('Second touch ignored: pull again', 1.8);
        } else if (ptr.released) {
          const d = state.drag; state.drag = null; state.aim.active = false;
          if (d.valid && state.blocked) { state.preview = null; toast('A disc is in the way: slide to a clear spot', 2.2); sfx.no(); }
          else if (d.valid) throwDisc(m.turn, { u: state.aim.u, ang: state.aim.ang, power: state.aim.power });
          else { state.preview = null; if (d.len > 8) toast(d.len < PULL.min ? 'Pull back further, then let go' : 'Pull away from the board, so the flick goes into it', 1.8); }
        }
      }
      // keyboard
      let touched = false;
      const side = m.turn;
      if (keys.down.has('ArrowLeft')) { state.aim.ang -= 0.006; state.aim.manual = true; touched = true; }
      if (keys.down.has('ArrowRight')) { state.aim.ang += 0.006; state.aim.manual = true; touched = true; }
      if (keys.down.has('ArrowUp')) { state.aim.power = clamp(state.aim.power + 0.01, 0.02, 1); touched = true; }
      if (keys.down.has('ArrowDown')) { state.aim.power = clamp(state.aim.power - 0.01, 0.02, 1); touched = true; }
      if (keys.down.has('KeyA')) { state.aim.u = clamp(state.aim.u - 0.012, -MAX_U, MAX_U); if (!state.aim.manual) state.aim.ang = centreAim(side, state.aim.u); touched = true; }
      if (keys.down.has('KeyD')) { state.aim.u = clamp(state.aim.u + 0.012, -MAX_U, MAX_U); if (!state.aim.manual) state.aim.ang = centreAim(side, state.aim.u); touched = true; }
      if (keys.pressed.has('KeyH')) requestHint();
      if (touched) { state.kbOn = true; state.aim.active = true; state.hint = null; state.hintPreview = null; updatePreview(); }
      if (keys.pressed.has('Space') && state.kbOn && !state.drag && !state.blocked) throwDisc(side, { u: state.aim.u, ang: state.aim.ang, power: state.aim.power });
    } else if (state.drag && !state.humanTurn) { state.drag = null; state.aim.active = false; }
    if (passUp && state.pass.t > 0.35 && ptr.pressed) { state.pass = null; sfx.tick(); }
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    // the view turns so the shooter is at the bottom (pass-and-play)
    const v = state.view;
    if (v.rot !== v.target) { v.rot += (v.target - v.rot) * Math.min(1, dt * 7); if (Math.abs(v.target - v.rot) < 0.002) v.rot = v.target; }
    // physics
    if (m.phase === 'fly' || m.phase === 'clear') {
      for (let i = 0; i < state.ff; i++) {
        const ev = stepWorld(state.w, dt);
        if (ev.length) worldEvents(state.w, state.parts, ev, true);
        if (m.phase === 'fly') {
          state.flyT += dt;
          if (state.flyT > 12) for (const d of state.w.discs) { d.vx = 0; d.vy = 0; }   // safety: nothing may slide forever
          if (state.w.settled) { state.restT += dt; if (state.restT > 0.4) { onSettled(); break; } } else state.restT = 0;
        }
      }
      if (m.phase === 'clear') { state.clearT += dt; if (state.clearT > 0.6) finishClear(); }
    }
    for (const d of state.w.discs) if (d.heat > 0) d.heat = Math.max(0, d.heat - dt * 2.2);
    for (let i = 0; i < 8; i++) if (state.pegFlash[i] > 0) state.pegFlash[i] = Math.max(0, state.pegFlash[i] - dt * 3);
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (m.phase === 'score') {
      m.roundInfo.t += dt;
      const auto = (watch && m.roundInfo.t > 4.8) || m.roundInfo.t > 9;
      if ((ptr.pressed && m.roundInfo.t > 0.9) || auto) afterRound();
    }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') resumeMatch();
    else if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'len2') s.rounds = 2;
    else if (id === 'len4') s.rounds = 4;
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, rounds: s.rounds });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'set-rotate') st.rotate = !st.rotate;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, first: aiRng.int(2) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
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
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) {
      handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const n = pageCount();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; };
    const next = () => { if (state.page >= n - 1) close(); else state.page++; };
    const prev = () => { if (state.page <= 0) close(); else state.page--; };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) next();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) prev();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    }
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };

  startAttract();
  resetMenus();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.pass,
    update(dt, input) {
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
  };
}
