// Futbolín: the game shell. Scenes, input, persistence, preview wiring, the Cup, Hint and Watch & Learn. The table itself lives in sim.js.
import { createSim } from './sim.js';
import { W, H, host, isWide, setSize, TEXT_SCALES, readerLayout, setupPins, inRect, playLayout, toTable, setReserve } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderPlay, renderThink, watchHit } from './hud.js';
import { LEVELS, CUP, MATCH_GOALS, THINK_STEPS, HOME_KIT, RIVAL_KITS, dirOf } from './consts.js';
import { drawFloor, drawTable, drawLight, KIT_PAL } from './draw.js';
import { clamp, hash } from './util.js';
import { touches } from './touches.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 2;
const HUMAN_RODS = [2, 4, 6, 7];            // attack, midfield, defence, goalkeeper (top to bottom)
const TEAM_RODS = [HUMAN_RODS, [0, 1, 3, 5]];
const FLICK_PX = 380, FLICK_FULL = 1100;     // finger speed in CSS px per second: a flick starts here, full power from here (same on every screen size)

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, pick: 'touch', thinkIdx: 1 },
    setup: { goals: 5, opp: 2, watch: false, watchA: 3, lastMode: 'match', players: 1 },
    two: false, drags: new Map(),
    cup: { round: 0, won: false },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', restoreMsg: '', setupMsg: '',
    record: { demoMatches: 0, wins: 0, played: 0, goals: 0, bestStreak: 0, streak: 0 },
    sim: null, paused: false, pauseMenu: false, think: null, thinkRects: null, active: 7, drag: null, fx: [], names: ['You', 'Rival'],
    kits: [KIT_PAL(HOME_KIT.col, HOME_KIT.trim), KIT_PAL(RIVAL_KITS[0].col, RIVAL_KITS[0].trim)], cupRound: CUP[0],
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, viewW: 720, viewH: 1280, overT: 0, lockDown: 0, size: '',
  };
  const aboutList = ABOUT;
  let wheelDy = 0;
  if (typeof env.onWheel === 'function') env.onWheel((d) => { wheelDy += d.dy; });
  const takeWheel = () => { const d = wheelDy; wheelDy = 0; return d; };
  function navScroll(input, cur, max, page) {
    let v = cur + takeWheel();
    const k = input.keys;
    if (k.down.has('ArrowDown')) v += 14; if (k.down.has('ArrowUp')) v -= 14;
    if (k.pressed.has('PageDown') || k.pressed.has('Space')) v += page * 0.85;
    if (k.pressed.has('PageUp')) v -= page * 0.85;
    if (k.pressed.has('Home')) v = 0; if (k.pressed.has('End')) v = max;
    return clamp(v, 0, max);
  }
  let S = null, evSeen = 0;
  const simRng = rng.fork();

  // ---- persistence ----------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('record', G.record); storage.set('cup', G.cup); storage.set('setup', { goals: G.setup.goals, opp: G.setup.opp, watchA: G.setup.watchA, players: G.setup.players }); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('cup', null), storage.get('setup', null)]).then(([s, r, c, su]) => {
    if (s) Object.assign(G.settings, s);
    if (r) Object.assign(G.record, r);
    if (c && typeof c.round === 'number') G.cup = { round: clamp(c.round | 0, 0, CUP.length), won: !!c.won };
    if (su) { Object.assign(G.setup, su); G.setup.goals = MATCH_GOALS.includes(G.setup.goals) ? G.setup.goals : 5; G.setup.opp = clamp(G.setup.opp | 0, 1, 5); G.setup.watchA = clamp(G.setup.watchA | 0, 1, 5); G.setup.players = G.setup.players === 2 ? 2 : 1; }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (G.settings.pick !== 'auto') G.settings.pick = 'touch';
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    kick: (p) => { tone({ freq: 150 + p * 80, to: 70, dur: 0.09, type: 'triangle', vol: 0.18 }); tone({ freq: 1400, to: 700, dur: 0.03, type: 'square', vol: 0.03 + 0.03 * p }); },
    swing: () => tone({ freq: 320, to: 180, dur: 0.06, type: 'sawtooth', vol: 0.025 }),
    man: (v) => tone({ freq: 360 + Math.min(300, v), to: 210, dur: 0.05, type: 'triangle', vol: Math.min(0.12, 0.03 + v * 0.0004) }),
    wall: (v) => tone({ freq: 240, to: 130, dur: 0.07, type: 'sine', vol: Math.min(0.12, 0.03 + v * 0.0004) }),
    post: () => tone({ freq: 1320, to: 980, dur: 0.18, type: 'sine', vol: 0.07 }),
    goal: (mine) => { [0, 4, 7, 12].forEach((n, i) => tone({ freq: (mine ? 523 : 392) * Math.pow(2, n / 12), dur: 0.2 + i * 0.05, type: 'triangle', vol: 0.09 })); tone({ freq: 140, to: 100, dur: 0.5, type: 'sawtooth', vol: 0.05 }); },
    start: () => tone({ freq: 880, dur: 0.12, type: 'triangle', vol: 0.06 }),
    ready: () => tone({ freq: 520, dur: 0.1, type: 'triangle', vol: 0.05 }),
  };
  const delayed = [];

  // ---- effects (presentation only, deterministic: positions from hashes, not from the rng) ----------------
  let fxId = 1;
  function spark(x, y, n, col, speed = 30, life = 0.35, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = hash(fxId++) * Math.PI * 2, v = speed * (0.4 + hash(fxId++));
      G.fx.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: life * (0.6 + hash(fxId++) * 0.7), size, col });
    }
  }
  function confetti(cx, cy, n, cols) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (hash(fxId++) - 0.5) * 2.6, v = 30 + hash(fxId++) * 60;
      G.fx.push({ t: 'conf', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 1.6 + hash(fxId++) * 0.8, size: 0.7 + hash(fxId++) * 0.7, rot: hash(fxId++) * 6, spin: (hash(fxId++) - 0.5) * 14, col: cols[i % cols.length] });
    }
    if (G.fx.length > 220) G.fx.splice(0, G.fx.length - 220);
  }
  function stepFx(dt) {
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const p = G.fx[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t === 'conf') { p.vy += 40 * dt; p.vx *= 0.99; } else { p.vx *= 0.9; p.vy *= 0.9; }
      if (p.age >= p.life) G.fx.splice(i, 1);
    }
  }

  // ---- match lifecycle --------------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim; G.drags.clear(); touches.clear(); evSeen = 0; G.think = null; G.drag = null; G.fx = []; G.overT = 0; };
  function setSides(names, rivalKit) {
    G.names = names; G.kits = [KIT_PAL(HOME_KIT.col, HOME_KIT.trim), KIT_PAL(rivalKit.col, rivalKit.trim)];
  }
  function startDemoBg() {
    setSides(['Red', 'Blue'], RIVAL_KITS[0]);
    setSim(createSim({ watch: true, watchLevels: [3, 3], goals: 99 }, simRng.fork())); G.mode = 'none';
  }
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'match') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      const lvl = demo ? Math.min(st.opp, 2) : st.opp;
      if (st.players === 2) { cfg = { goals: demo ? 3 : st.goals, level: 1, two: true }; setSides(['Red', 'Blue'], RIVAL_KITS[0]); }
      else { cfg = { goals: demo ? 3 : st.goals, level: lvl }; setSides(['You', LEVELS[lvl - 1].name], RIVAL_KITS[(lvl - 1) % RIVAL_KITS.length]); }
    } else if (kind === 'cup') {
      const r = CUP[G.cup.round] || CUP[0]; G.cupRound = r;
      cfg = { goals: r.goals, level: r.level };
      setSides(['You', r.team], { col: r.col, trim: r.trim });
    } else if (kind === 'watch') {
      cfg = { goals: 3, watch: true, watchLevels: [st.watchA, st.opp] };
      setSides(['Red', 'Blue'], RIVAL_KITS[0]);
    } else { cfg = { goals: 5, level: 3, bot: true }; setSides(['Red', 'Blue'], RIVAL_KITS[0]); }
    G.mode = kind; G.two = !!cfg.two; if (kind !== 'shot') G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = false; G.ui.scroll = 0; G.active = 7;
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'match' && demo) { G.record.demoMatches++; saveAll(); }
    sfx.start();
  }
  const leaveMatch = () => { G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; startDemoBg(); };

  function processEvents() {
    for (const e of S.s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      const live = G.mode !== 'none';
      if (e.type === 'kick') { if (live) sfx.kick(e.p); spark(e.x, e.y, 7, '#fff3c0', 34, 0.3, 0.45); }
      else if (e.type === 'swing') { if (live && e.team === 0) sfx.swing(); }
      else if (e.type === 'man') { if (live) sfx.man(e.v); }
      else if (e.type === 'wall') { if (live) sfx.wall(e.v); }
      else if (e.type === 'post') { if (live) sfx.post(); spark(e.x, e.y, 5, '#ffe9a0', 30, 0.25, 0.4); }
      else if (e.type === 'serve') { if (live) sfx.ready(); }
      else if (e.type === 'goal') {
        const mine = e.team === 0;
        if (live) sfx.goal(mine);
        confetti(e.x, mine ? -62 : 62, 70, mine ? ['#ffd77a', '#ff6a4a', '#fff3d6', '#f0b82a'] : [G.kits[1].col, '#fff3d6', G.kits[1].trim]);
        if ((G.mode === 'match' || G.mode === 'cup') && !G.two && mine) G.record.goals++;
      } else if (e.type === 'matchEnd') {
        if ((G.mode === 'match' || G.mode === 'cup') && !G.two) {
          G.record.played++;
          if (e.winner === 0) G.record.wins++;
          if (G.mode === 'cup' && e.winner === 0) { G.cup.round = Math.min(CUP.length, G.cup.round + 1); if (G.cup.round >= CUP.length) G.cup.won = true; }
          G.record.streak = e.winner === 0 ? (G.record.streak || 0) + 1 : 0; G.record.bestStreak = Math.max(G.record.bestStreak, G.record.streak);
          saveAll();
        }
      }
    }
  }

  // ---- watch & learn -------------------------------------------------------------------------------------
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.releaseHold(); return true; }
      return false;
    }
    return true;
  }

  // ---- hint ------------------------------------------------------------------------------------------------
  function openThink() {
    const h = S.hint();
    G.think = { plan: { rod: h.rod, tgt: h.tgt, k: h.k, aimX: h.aimX }, reason: h.reason, summary: h.summary };
  }

  // ---- rods and touch --------------------------------------------------------------------------------------
  // The rod that will play the ball next (nearest rod of mine "behind" the ball), used by Auto and as the default highlight.
  function nextRod() {
    const b = S.s.ball; let best = 7, bd = 1e9;
    for (const i of HUMAN_RODS) { const r = S.s.rods[i], a = (b.y - r.y) * dirOf(0); if (a > -1 && a < bd) { bd = a; best = i; } }
    return best;
  }
  function pickRod(p, team = 0) {
    if (!G.two && (G.settings.pick === 'auto' || Math.abs(p.x) > 62 || Math.abs(p.y) > 70)) return nextRod();
    let best = TEAM_RODS[team][3], bd = 1e9;
    for (const i of TEAM_RODS[team]) { const d = Math.abs(S.s.rods[i].y - p.y); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  const makeDrag = (lay, x, y, team) => {
    const p = toTable(lay, x, y), rod = pickRod(p, team);
    return { rod, team, off0: S.s.rods[rod].off, x0: p.x, ly: p.y, px: p.x, vf: 0, vl: 0, t0: G.t, moved: 0, lastKick: -1, kicked: false };
  };
  function beginDrag(lay, ptr) { G.drag = makeDrag(lay, ptr.x, ptr.y, 0); G.active = G.drag.rod; }
  function updateDrag(lay, ptr, dt) { if (G.drag) stepDrag(G.drag, lay, ptr.x, ptr.y); }
  // slide the rod with the finger and turn a quick flick toward the rival goal into a kick
  function stepDrag(d, lay, sx, sy) {
    const p = toTable(lay, sx, sy);
    S.slideTo(d.rod, d.off0 + (p.x - d.x0));
    d.moved = Math.max(d.moved, Math.abs(p.x - d.x0), Math.abs(p.y - (d.ly0 ?? (d.ly0 = d.ly))));
    d.ly = p.y;
    // finger velocity from the last ~70 ms of positions (steady even when touch samples arrive unevenly between frames)
    const hs = d.hist || (d.hist = []);
    hs.push({ t: G.t, x: p.x, y: p.y });
    while (hs.length > 2 && G.t - hs[0].t > 0.12) hs.shift();
    let ref = hs[0]; for (const h of hs) { if (G.t - h.t <= 0.075) { ref = h; break; } }
    const span = Math.max(G.t - ref.t, 1e-3), ok = span >= 0.025;
    d.vf = ok ? dirOf(d.team) * (p.y - ref.y) / span : d.vf; d.vl = ok ? (p.x - ref.x) / span : d.vl;
    const k = lay.s * (host.px || 0.6), vpx = d.vf * k;      // finger speed toward the rival in CSS px/s
    if (G.t - d.lastKick > 0.35) {
      if (!d.pend && vpx > FLICK_PX && d.vf > Math.abs(d.vl) * 0.7) d.pend = { t: G.t, vmax: vpx };
      else if (d.pend) {
        d.pend.vmax = Math.max(d.pend.vmax, vpx);
        if (G.t - d.pend.t >= 0.04) fireFlick(d);      // a few frames after the start, so a hard flick gets its full power
      }
    }
  }
  function fireFlick(d) {
    const power = clamp(0.32 + (d.pend.vmax - FLICK_PX) / (FLICK_FULL - FLICK_PX) * 0.68, 0.32, 1);
    d.pend = null;
    if (S.kick(d.rod, power)) { d.lastKick = G.t; d.kicked = true; }
  }
  function finishDrag(d) {
    if (d && d.pend) fireFlick(d);
    if (d && !d.kicked && G.t - d.t0 < 0.24 && d.moved < 2.2) S.kick(d.rod, 0.42);   // a tap is a soft pass
  }
  function endDrag() { const d = G.drag; G.drag = null; finishDrag(d); }

  // Two players on one screen: every finger is tracked by id (touches.js). Red plays the rods whose handles are on the right (the bottom
  // when the table is turned), Blue the left (the top). A finger picks the nearest rod of its side's team, slides it, and a flick kicks.
  function updateTwo(dt, lay) {
    const sideOf = (x, y) => (lay.wide ? (y < lay.cy ? 1 : 0) : (x < lay.cx ? 1 : 0));
    for (const [id, t] of touches) {
      if (!t.fresh) continue;
      t.fresh = false;
      if (inRect(lay.btn.pause, t.x, t.y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.drags.clear(); touches.clear(); return; }
      if (S.s.phase === 'over') continue;
      const team = sideOf(t.x, t.y);
      for (const [oid, od] of G.drags) if (od.team === team) { finishDrag(od); G.drags.delete(oid); }
      G.drags.set(id, makeDrag(lay, t.x, t.y, team));
    }
    for (const [id, d] of G.drags) {
      const t = touches.get(id);
      if (!t || !t.down) { finishDrag(d); G.drags.delete(id); } else stepDrag(d, lay, t.x, t.y);
    }
    for (const [id, t] of touches) if (!t.down && !G.drags.has(id) && !t.fresh) touches.delete(id);
  }

  const syncReserve = () => setReserve(G.scene === 'play' ? (G.mode === 'watch' ? 'watch' : G.think ? 'think' : null) : null);
  function updatePlay(dt, input) {
    syncReserve();
    const ptr = input.pointer, keys = input.keys;
    const lay = playLayout(G.settings.textIdx);
    if (G.mode === 'shot') { S.update(dt); stepFx(dt); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.think) {
      if (ptr.pressed && G.thinkRects) {
        if (inRect(G.thinkRects.use, ptr.x, ptr.y)) { G.active = G.think.plan.rod; G.think = null; sfx.tick(); }
        else if (inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); }
      }
      if (keys.pressed.has('Escape') || keys.pressed.has('KeyH')) G.think = null;
      return;
    }
    if (G.mode === 'watch') {
      if (ptr.pressed) {
        const i = watchHit(G, ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveAll(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveAll(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      S.update(dt); stepFx(dt); processEvents(); endCheck(dt);
      return;
    }
    const s = S.s;
    if (G.two) {
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.drags.clear(); touches.clear(); return; }
      updateTwo(dt, lay);
      G.active = [...G.drags.values()].map((d) => d.rod);
      S.update(dt); stepFx(dt); processEvents(); endCheck(dt);
      return;
    }
    touches.clear();
    if (ptr.pressed) {
      const x = ptr.x, y = ptr.y;
      if (inRect(lay.btn.pause, x, y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.drag = null; return; }
      if (inRect(lay.btn.hint, x, y)) { G.drag = null; openThink(); return; }
      if (inRect(lay.btn.rods, x, y)) { G.settings.pick = G.settings.pick === 'auto' ? 'touch' : 'auto'; saveAll(); sfx.tick(); return; }
      if (s.phase !== 'over') beginDrag(lay, ptr);
    }
    if (G.drag && ptr.down) updateDrag(lay, ptr, dt);
    if (G.drag && !ptr.down) endDrag();
    if (!G.drag && G.settings.pick === 'auto') G.active = nextRod();
    // keyboard: slide with the arrows (along the rod), kick with Up / Space (Right when the table is turned)
    const kd = keys.down, wide = lay.wide;
    const slideKeys = wide ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'], kickKeys = wide ? ['ArrowRight', 'Space'] : ['ArrowUp', 'Space'];
    let dir = 0;
    if (kd.has(slideKeys[0])) dir -= 1; if (kd.has(slideKeys[1])) dir += 1;
    if (dir && !G.drag) { const r = s.rods[G.active]; S.slideTo(G.active, r.tgt + dir * 700 * dt); }
    [['Digit1', 2], ['Digit2', 4], ['Digit3', 6], ['Digit4', 7]].forEach(([c, r]) => { if (keys.pressed.has(c)) G.active = r; });
    if (keys.pressed.has('Tab')) G.active = HUMAN_RODS[(HUMAN_RODS.indexOf(G.active) + 1) % 4];
    if (kickKeys.some((k) => keys.pressed.has(k))) S.kick(G.active, 0.9);
    if (keys.pressed.has('KeyH')) { openThink(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.drag = null; return; }
    S.update(dt); stepFx(dt); processEvents(); endCheck(dt);
  }
  function endCheck(dt) {
    if (S.s.phase === 'over') {
      G.overT += dt;
      if (G.overT > 1.7 && G.scene === 'play' && (G.mode === 'match' || G.mode === 'cup' || G.mode === 'watch')) { G.scene = 'result'; G.ui.scroll = 0; G.drag = null; }
    }
  }

  // ---- menus -----------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = G.ui.drag, mt = MN.flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); G.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) MN.ensureLayout(G, key);
    if (ptr.pressed) G.ui.drag = { y0: ptr.y, x0: ptr.x, s0: G.ui.scroll, moved: 0 };
    if (G.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && G.ui.drag) {
      const d = G.ui.drag; G.ui.drag = null;
      const lay = MN.flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(MN.hitScreen(ptr.x, ptr.y, G.ui.scroll));
      else if (!scrollable) handler(MN.hitScreen(d.x0, d.y0, G.ui.scroll));
    }
    const mt = MN.flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveAll(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveAll(); }
    G.ui.scroll = navScroll(input, G.ui.scroll, max, mt.bottom - mt.top);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    const st = G.setup;
    if (id === 'play') { st.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'cup') { if (demo) { st.watch = false; G.setupMsg = 'The Cup is in the full game.'; go('setup'); return; } go('cup'); }
    else if (id === 'watch') { st.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('goals')) { const g = +id.slice(5); if (demo && g !== 3) { G.setupMsg = 'Longer matches are in the full game.'; return; } st.goals = g; }
    else if (id === 'pl1' || id === 'pl2') st.players = id === 'pl2' ? 2 : 1;
    else if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id.startsWith('wb')) st.opp = +id.slice(2);
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch && st.players !== 2) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
      saveAll();
      startMatch(st.watch ? 'watch' : 'match');
    } else if (id === 'back') go('title');
  }
  function handleCup(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id === 'cup-go') startMatch('cup');
    else if (id === 'cup-again') { G.cup = { round: 0, won: false }; saveAll(); startMatch('cup'); }
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'pick-touch') st.pick = 'touch';
    else if (id === 'pick-auto') st.pick = 'auto';
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : 'match');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else go('setup'); }
    else if (id === 'cup-next' || id === 'cup-retry') startMatch('cup');
    else if (id === 'menu') { go('title'); startDemoBg(); }
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
    else if (id === 'p-pick') { G.settings.pick = G.settings.pick === 'auto' ? 'touch' : 'auto'; saveAll(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveAll(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveAll(); }
    else if (id === 'quit') leaveMatch();
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const list = G.scene === 'howto' ? HOWTO : G.scene === 'about' ? aboutList : RULES;
    MN.ensureReader(G, list, G.scene === 'howto' ? 'How to Play' : G.scene === 'about' ? 'About' : 'Rules');
    const rd = MN.readerMeta(), RL = readerLayout(), V = RL.view;
    const max = Math.max(0, rd.contentH - rd.viewH);
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; };
    const next = () => { if (max <= 0) close(); else if (G.ui.scroll >= max - 4) G.ui.scroll = 0; else G.ui.scroll = clamp(G.ui.scroll + V.h * 0.85, 0, max); };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y)) next();
      else if (inRect(RL.back, ptr.x, ptr.y)) close();
      else if (inRect(RL.dec, ptr.x, ptr.y)) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveAll(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveAll(); }
      else if (inRect({ x: V.x - 6, y: V.y, w: V.w + 12, h: V.h }, ptr.x, ptr.y)) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) G.ui.scroll = clamp(G.ui.drag.s0 - (ptr.y - G.ui.drag.y0), 0, max);
    if (ptr.released) G.ui.drag = null;
    G.ui.scroll = navScroll(input, G.ui.scroll, max, V.h);
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft') || keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = setupPins();
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ?shot=1 (store screenshots): a real match played by a coached side, frozen after N ticks; ?scene= opens a menu page instead
  function startShot() {
    const sc = config.shotScene;
    if (sc === 'about' || sc === 'howto' || sc === 'rules') { startDemoBg(); G.scene = sc; G.back = 'title'; return; }
    if (sc === 'title') { startDemoBg(); return; }
    startMatch('shot');
  }
  let sizeKey = '';
  function syncSize() {
    setSize(meta.width, meta.height);
    const k = `${W}x${H}`;
    // the kit's "Preview 1:28" pill: top centre in portrait, bottom left in landscape (so it never covers the score card)
    meta.previewBadge = isWide() ? { x: host.l + 16, y: H - host.b - 46, align: 'left' } : undefined;
    if (k !== sizeKey) { if (sizeKey) { G.drag = null; G.ui.drag = null; } sizeKey = k; G.size = k; }
  }
  syncSize();
  if (config.shot) startShot(); else startDemoBg();

  return {
    // Menus, Rules, About, settings, hints and Watch & Learn are free; only live play in a real match counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'match' || G.mode === 'cup')) || G.paused || G.pauseMenu || !!G.think || (S && S.s.phase !== 'live'),
    update(dt, input) {
      syncSize();
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play' && S && G.mode === 'none') { if (S.s.hold) S.releaseHold(); S.update(dt); stepFx(dt); evSeen = S.s.eid; }
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updateSetup(dt, input); break;
        case 'cup': updateFlowScene(dt, input, handleCup, 'cup'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      syncSize();
      G.viewW = (view && view.cssW) || 720; G.viewH = (view && view.cssH) || 1280;
      syncReserve();
      ctx.clearRect(0, 0, W, H);
      if (G.scene === 'play') {
        renderPlay(ctx, G, S);
        if (G.think) renderThink(ctx, G);
        if (G.pauseMenu) MN.renderPause(ctx, G);
        return;
      }
      // every other screen sits on the attract table (two computer sides playing quietly behind a dark veil)
      const lay = playLayout(0);
      drawFloor(ctx, W, H, lay);
      drawTable(ctx, lay, S.s, { kits: G.kits, active: -1, trail: true, fx: G.fx });
      drawLight(ctx, W, H, lay);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'cup': MN.renderCup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        default: break;
      }
    },
    getState: () => G,
    dev: config.dev ? { startMatch, startDemoBg, go, sim: () => S, setSim, createSim: (c) => createSim(c, simRng.fork()) } : undefined,
  };
}
