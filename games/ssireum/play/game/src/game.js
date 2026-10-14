// Ssireum: state and flow. The engine lives in sim.js, the computer wrestlers and the coach in ai.js, drawing in view.js, hud.js and
// menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A fall is a series of beats. Phases: ready (3-2-1), choose (secret move), pass (two players: hand over the phone), reveal (both
// moves play), fallen (the loser goes down), end. Watch & Learn uses wthink / wplan instead of choose.
import { newFall, resolve, legalMove, WINS_NEEDED, techniqueName } from './sim.js';
import { PROFILES, createDriver, chooseMove, coachMove, explainMove, moveLabel } from './ai.js';
import { inRect, setSize, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawStage, newPose, stepPose, petalAt, RINGS, WORLD } from './view.js';
import { layoutFor, drawHud, drawBoard, drawControls, drawOverlays, drawCard, drawToast, drawCover, cardRectFor, nextRect } from './hud.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderReason, renderPages, renderDemoLimit,
  hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone, stepAttract, newAttract,
} from './menus.js';
import { ABOUT, HOWTO, RULES, TIMERS } from './content.js';
import { setPress } from './ui.js';

// Fluid viewport: the short side is always 720 units; meta.width / meta.height follow the real screen.
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_FALL_CAP = 3;       // falls of real play in the free web demo
const REVEAL_TIME = 1.7;       // seconds a beat takes to play out
const PLAN_TIME = 2.6;         // Watch & Learn: how long both plans are shown
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => { const t = clamp(u, 0, 1); return t * t * (3 - 2 * t); };
const BLANK = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
const KEY_DIR = { ArrowUp: 0, KeyE: 1, ArrowRight: 2, KeyC: 3, ArrowDown: 4, KeyZ: 5, ArrowLeft: 6, KeyQ: 7 };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, timerIdx: 1 },
    record: { matches: 0, wins: [0, 0, 0, 0, 0], falls: 0, demoBouts: 0, longest: 0 },
    setup: { mode: 'ai', opp: 1, hall: 'danoh' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, F: newFall(), disp: [{ x: 0, y: 0 }, { x: 0, y: 0 }], trail: null, pose: newPose(), looks: [0, 1], builds: [1, 1], drivers: [null, null],
    phase: 'ready', ready: 3, endT: 0, ring: 'danoh', who: 0, sel: { kind: 'pull', dir: -1, pow: 2 }, sels: [null, null], pending: null,
    timer: 0, timerOn: false, humanTurn: false, rep: null, revealT: 0, showMoves: null, labels: ['', ''], revealFx: false,
    parts: [], pops: [], toast: '', toastT: 0, card: null, hint: null, think: null, w: null, ff: false,
    cheer: 0, shotMode: null, att: null, loaded: false, restoreMsg: '', wlabel: '', owned: () => { try { return !!monetization.owns?.('unlock_game'); } catch { return false; } },
  };
  Object.defineProperty(state, 'lay', { value: null, writable: true, enumerable: false });

  // ---- persistence -------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.timerIdx = clamp(state.settings.timerIdx | 0, 0, TIMERS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    count: (go) => tone({ freq: go ? 196 : 147, to: go ? 98 : 120, dur: go ? 0.4 : 0.16, type: 'sine', vol: go ? 0.2 : 0.14 }),
    drum: () => { tone({ freq: 120, to: 55, dur: 0.22, type: 'sine', vol: 0.2 }); tone({ freq: 240, to: 110, dur: 0.08, type: 'triangle', vol: 0.05 }); },
    pull: (v) => { tone({ freq: 190 + 40 * v, to: 90, dur: 0.14, type: 'triangle', vol: 0.1 }); tone({ freq: 1200, to: 600, dur: 0.04, type: 'square', vol: 0.018 }); },
    hook: () => tone({ freq: 520, to: 180, dur: 0.16, type: 'sawtooth', vol: 0.05 }),
    root: () => tone({ freq: 90, to: 70, dur: 0.22, type: 'sine', vol: 0.14 }),
    thud: () => { tone({ freq: 90, to: 40, dur: 0.3, type: 'sine', vol: 0.26 }); tone({ freq: 300, to: 100, dur: 0.1, type: 'triangle', vol: 0.06 }); },
    clap: () => { tone({ freq: 1800, dur: 0.05, type: 'square', vol: 0.015 }); tone({ freq: 1500, dur: 0.07, type: 'square', vol: 0.012 }); },
    spent: () => tone({ freq: 300, to: 160, dur: 0.25, type: 'triangle', vol: 0.07 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.26 + i * 0.04, type: 'triangle', vol: 0.09 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.08 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles -----------------------------------------------------------------------------------------------
  const MAX_PARTS = 120;
  const add = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const dust = (x, y, n, col = '#e7d3a4') => { for (let i = 0; i < n; i++) { const a = -Math.PI * (0.1 + fx.next() * 0.8), s = 30 + fx.next() * 100; add({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.45 + fx.next() * 0.45, size: 4 + fx.next() * 5, col }); } };
  const ring = (x, y, size, col) => add({ kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const confetti = (x, y, n) => { const cols = ['#ffd24a', '#c8312f', '#2c5fb8', '#f7ead2', '#8cb08a']; for (let i = 0; i < n; i++) { const a = -Math.PI * fx.next(), s = 80 + fx.next() * 260; add({ kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 1.2 + fx.next() * 0.8, size: 1, col: cols[fx.int(cols.length)], spin: 6 + fx.next() * 10 }); } };
  const stepParts = (dt) => {
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.97; q.vy = q.vy * 0.97 + (q.kind === 3 ? 260 : 120) * dt; }
    for (let i = state.parts.length - 1; i >= 0; i--) if (state.parts[i].t >= state.parts[i].max) state.parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 34) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.3 }); if (state.pops.length > 4) state.pops.shift(); };
  const footX = (side) => WORLD.cx + (side === 0 ? -76 : 76);

  // ---- the match ---------------------------------------------------------------------------------------------------
  function newMatch(cfg) {
    const mode = cfg.mode;
    let players;
    const P = (i, look) => ({ name: PROFILES[i].name, cls: PROFILES[i].cls, ai: i, look, build: PROFILES[i].build });
    if (mode === 'watch') players = [P(cfg.a, 1 + cfg.a), P(cfg.b, 1 + cfg.b)];
    else if (mode === 'two') players = [{ name: 'Player 1', ai: -1, look: 0, build: 1 }, { name: 'Player 2', ai: -1, look: 1, build: 1 }];
    else players = [{ name: 'You', ai: -1, look: 0, build: 1 }, P(cfg.opp, 1 + cfg.opp)];
    return { cfg: { mode: 'ai', opp: 1, hall: 'danoh', ...cfg }, players, idx: 0, wins: [0, 0], results: [], over: null };
  }
  let lastCount = 4;
  function startFall() {
    const m = state.m;
    state.F = newFall();
    state.looks = m.players.map((p) => p.look);
    state.builds = m.players.map((p) => p.build);
    state.ring = m.cfg.hall;
    state.drivers = m.players.map((p) => (p.ai >= 0 ? createDriver(PROFILES[p.ai], aiRng.fork()) : null));
    state.phase = 'ready'; state.ready = 3; state.endT = 0; state.card = null; state.hint = null; state.think = null;
    state.parts = []; state.pops = []; state.pose = newPose(); state.paused = false; state.pauseMenu = false; state.reasonOpen = false;
    state.disp = [{ x: 0, y: 0 }, { x: 0, y: 0 }]; state.trail = null; state.rep = null; state.showMoves = null; state.pending = null;
    state.who = 0; state.humanTurn = false; state.timerOn = false;
    state.w = m.cfg.mode === 'watch' ? { plan: [null, null], timer: 0, ex: [null, null] } : null;
    state.wlabel = '';
    lastCount = 4;
    if (m.cfg.mode === 'watch') toast(`${m.players[0].name} against ${m.players[1].name}`, 2.2);
  }
  function startMatch(cfg) {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoBouts >= DEMO_FALL_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = newMatch(cfg);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    startFall();
  }
  function startWatch() {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', a, b, hall: RINGS[aiRng.int(3)].id });
  }

  // ---- beats ---------------------------------------------------------------------------------------------------------
  const timerSecs = () => TIMERS[state.settings.timerIdx].s;
  function fixPower() {
    while (state.sel.pow > 1 && !legalMove(state.F, state.who, state.sel)) state.sel.pow--;
  }
  function beginChoose(side) {
    state.phase = 'choose'; state.who = side;
    state.humanTurn = true;
    const prev = state.sels[side] ?? { kind: 'pull', dir: -1, pow: 2 };
    state.sel = { kind: prev.kind, dir: -1, pow: prev.pow };
    fixPower();
    // first beat of a match: a few extra seconds to find the controls; one short extension if nothing is picked yet
    state.timerOn = timerSecs() > 0; state.timer = timerSecs() + (state.F.beat === 0 && state.m.results.length === 0 ? 8 : 0);
    state.timerExt = false; state.tickAt = 99;
    state.hint = null; state.card = null; state.think = null;
  }
  function beginBeat() {
    if (state.m.cfg.mode === 'watch') { beginWatchThink(); return; }
    beginChoose(0);
  }
  function startReveal(moves) {
    const before = { p: state.F.p.map((p) => ({ ...p })) };
    state.rep = resolve(state.F, moves);
    state.trail = before.p;
    state.showMoves = moves;
    state.labels = moves.map((mv) => moveLabel(mv));
    state.phase = 'reveal'; state.revealT = 0; state.revealFx = false; state.humanTurn = false; state.timerOn = false;
    state.card = null; state.hint = null; state.think = null; state.wlabel = '';
    for (let i = 0; i < 2; i++) { const s = state.pose.s[i]; s.act = 1; s.actKind = moves[i].kind; s.actDir = moves[i].dir; }
  }
  function revealEffects() {
    const rep = state.rep;
    for (let s = 0; s < 2; s++) {
      const mv = rep.moves[s], o = 1 - s, sd = rep.side[s];
      if (mv.kind === 'pull') { sfx.pull(mv.pow); dust(footX(s), WORLD.floorY - 6, 3 + mv.pow); }
      else if (mv.kind === 'hook') { sfx.hook(); dust(footX(s) + (s === 0 ? 40 : -40), WORLD.floorY - 4, 4); }
      else { sfx.root(); dust(footX(s), WORLD.floorY - 4, 3, '#d8c08a'); }
      if (mv.kind !== 'brace') {
        const moved = Math.hypot(sd.force.x, sd.force.y);
        if (rep.side[o].soak > 0.45 && mv.kind === 'pull') pop(footX(o), 250, 'Rooted!', '#b8d8ff', 30);
        else if (sd.whiff && mv.kind === 'hook') pop(footX(s), 250, 'Whiff!', '#ffb892', 30);
        else if (moved > 0.28 && !rep.over && !rep.slip) pop(footX(o), 250, techniqueName(mv.kind, mv.dir).replace(/ \(.*\)/, ''), '#ffe27a', 28);
      }
    }
    for (let i = 0; i < 2; i++) if (rep.nudged[i]) { pop(footX(i), 220, 'Caution!', '#ffb892', 30); sfx.spent(); }
    if (rep.slip) pop(WORLD.cx, 230, 'Both slip!', '#fff1c0', 34);
    state.cheer = Math.min(1, state.cheer + 0.25);
  }
  function endFall() {
    const m = state.m, o = state.F.over;
    state.phase = 'fallen'; state.endT = 0;
    m.wins[o.win]++; m.results.push({ win: o.win, name: o.name, beats: o.beats });
    const human = m.cfg.mode === 'ai' ? 0 : -1;
    const lx = footX(o.loser) + (o.loser === 0 ? -30 : 30);
    dust(lx, WORLD.floorY - 10, 14); ring(lx, WORLD.floorY - 20, 90, '#fff1c0');
    confetti(WORLD.cx, 240, o.win === human || m.cfg.mode !== 'ai' ? 46 : 14);
    sfx.thud(); sfx.clap();
    if (human === 0 && o.win !== 0) sfx.lose(); else sfx.win();
    if (m.cfg.mode !== 'watch') {
      state.record.demoBouts = (state.record.demoBouts | 0) + 1;
      state.record.falls = (state.record.falls | 0) + 1;
      state.record.longest = Math.max(state.record.longest || 0, o.beats);
      save();
    }
    if (m.wins[o.win] >= WINS_NEEDED) {
      m.over = { win: o.win, record: null };
      if (m.cfg.mode !== 'watch') {
        state.record.matches++;
        if (m.cfg.mode === 'ai' && o.win === 0) {
          const k = Math.min(4, m.cfg.opp);
          state.record.wins[k]++;
          m.over.record = `${PROFILES[m.cfg.opp].name} beaten ${state.record.wins[k]} time${state.record.wins[k] === 1 ? '' : 's'} in all.`;
        }
        save();
      }
    }
  }
  function afterFall() {
    const m = state.m;
    if (m.over) { state.scene = 'result'; state.ui.scroll = 0; return; }
    if (state.demo && m.cfg.mode !== 'watch' && state.record.demoBouts >= DEMO_FALL_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    m.idx++; startFall();
  }

  // ---- choosing --------------------------------------------------------------------------------------------------
  const attackDisc = () => (state.sel.kind === 'brace' ? state.who : 1 - state.who);
  function lockIn(auto = false) {
    if (state.phase !== 'choose' || !state.humanTurn) return;
    const s = state.sel;
    let mv = { kind: s.kind, dir: s.dir, pow: s.pow };
    if (mv.dir < 0) { if (!auto) return; mv = { kind: 'brace', dir: 0, pow: 1 }; }
    if (!legalMove(state.F, state.who, mv)) mv = { ...mv, pow: 1 };
    if (!legalMove(state.F, state.who, mv)) mv = { kind: 'brace', dir: mv.dir, pow: 1 };
    sfx.drum();
    const m = state.m;
    state.sels[state.who] = { kind: mv.kind, dir: -1, pow: mv.pow };
    if (m.cfg.mode === 'two') {
      if (state.who === 0) { state.pending = mv; state.who = 1; state.phase = 'pass'; state.humanTurn = false; state.timerOn = false; state.hint = null; return; }
      startReveal([state.pending, mv]);
      return;
    }
    const ai = chooseMove(state.F, 1, PROFILES[m.cfg.opp], aiRng).move;
    startReveal([mv, ai]);
  }

  function humanChoose(input, lay) {
    const ptr = input.pointer, keys = input.keys, b = lay.btn, st = state.sel;
    const hit = (r) => r && inRect(r, ptr.x, ptr.y);
    const setKind = (k) => {
      const wasB = st.kind === 'brace';
      st.kind = k; if ((k === 'brace') !== wasB) st.dir = -1;
      fixPower(); sfx.tick();
    };
    const setPow = (p) => { if (legalMove(state.F, state.who, { kind: st.kind, pow: p })) { st.pow = p; sfx.tick(); } };
    if (ptr.pressed) {
      if (hit(lay.kinds.pull)) setKind('pull');
      else if (hit(lay.kinds.hook)) setKind('hook');
      else if (hit(lay.kinds.brace)) setKind('brace');
      else if (hit(lay.pows.p1)) setPow(1);
      else if (hit(lay.pows.p2)) setPow(2);
      else if (hit(lay.pows.p3)) setPow(3);
      else if (hit(b.lock)) { if (st.dir >= 0) lockIn(); }
      else if (hit(b.think)) { if (state.m.cfg.mode !== 'two') openThink(); }
      else if (hit(b.menu)) { openPause(); sfx.tick(); }
      else {
        const d = lay.discs[attackDisc() === 0 ? 'me' : 'th'];
        const k = petalAt(d.cx, d.cy, d.r, ptr.x, ptr.y);
        if (k >= 0) { if (st.dir === k) lockIn(); else { st.dir = k; sfx.tick(); } }
      }
    }
    for (const code of Object.keys(KEY_DIR)) if (keys.pressed.has(code)) { st.dir = KEY_DIR[code]; sfx.tick(); }
    if (keys.pressed.has('Digit1')) setKind('pull');
    if (keys.pressed.has('Digit2')) setKind('hook');
    if (keys.pressed.has('Digit3')) setKind('brace');
    if (keys.pressed.has('KeyF')) setPow(1);
    if (keys.pressed.has('KeyG')) setPow(2);
    if (keys.pressed.has('KeyH')) setPow(3);
    if ((keys.pressed.has('Enter') || keys.pressed.has('Space')) && st.dir >= 0) lockIn();
    if (keys.pressed.has('KeyT') && state.m.cfg.mode !== 'two') openThink();
  }

  // ---- Think (the coach) and Watch & Learn ---------------------------------------------------------------------------
  function openThink() {
    if (state.phase !== 'choose' || state.m.cfg.mode !== 'ai' || state.paused) return;
    const c = coachMove(state.F, 0);
    const ex = explainMove(state.F, 0, c.move, { rivalLikely: c.rivalLikely });
    state.card = { title: `Think: ${ex.title}`, text: ex.text, sticky: true };
    state.hint = { disc: c.move.kind === 'brace' ? 0 : 1, dir: c.move.dir };
    state.think = { coach: true, move: c.move };
    state.paused = true;
    sfx.tick();
  }
  function closeThink() { state.card = null; state.paused = false; state.think = null; sfx.tick(); }
  function beginWatchThink() {
    const F = state.F, m = state.m;
    const mv = [chooseMove(F, 0, PROFILES[m.players[0].ai], aiRng), chooseMove(F, 1, PROFILES[m.players[1].ai], aiRng)];
    state.w.plan = [mv[0].move, mv[1].move];
    state.w.ex = [explainMove(F, 0, mv[0].move, { rivalLikely: mv[0].rivalLikely }), explainMove(F, 1, mv[1].move, { rivalLikely: mv[1].rivalLikely })];
    state.w.timer = THINK_STEPS[state.settings.thinkIdx];
    state.phase = 'wthink'; state.humanTurn = false;
    state.wlabel = `${m.players[0].name} and ${m.players[1].name} are thinking…`;
    state.hint = null; state.card = null; state.showMoves = null;
  }
  function updateWatchPhase(dt) {
    const w = state.w, m = state.m;
    if (state.phase === 'wthink') {
      w.timer -= dt * (state.ff ? 3 : 1);
      if (w.timer <= 0) {
        state.phase = 'wplan'; w.timer = PLAN_TIME;
        state.card = { title: 'The plans', text: `${m.players[0].name}: ${w.ex[0].title}. ${w.ex[0].text} ${m.players[1].name}: ${w.ex[1].title}. ${w.ex[1].text}`, sticky: true };
        state.showMoves = [w.plan[0], w.plan[1]];
        state.wlabel = '';
      }
    } else if (state.phase === 'wplan') {
      w.timer -= dt * (state.ff ? 3 : 1);
      if (w.timer <= 0) { state.card = null; startReveal([w.plan[0], w.plan[1]]); }
    }
  }

  // ---- the play scene ------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.reasonOpen = false; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.think = null; state.card = null; state.hint = null;
  };
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  function modalInput(ptr, key, handler) {
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10 && flowMeta().key === key) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    const st = state.settings;
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); }
    else if (id === 'p-timer') { st.timerIdx = (st.timerIdx + 1) % TIMERS.length; if (state.phase === 'choose') { state.timerOn = timerSecs() > 0; state.timer = timerSecs(); } save(); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); }
    else if (id === 'quit') leaveMatch();
  }

  function updatePlay(dt, input) {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const lay = layoutFor(state);
    state.lay = lay;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause();
      else if (state.reasonOpen) state.reasonOpen = false;
      else if (state.think && state.think.coach) closeThink();
      else if (watch) state.paused = !state.paused;
      else openPause();
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') state.reasonOpen = false; }); return; }

    const b = lay.btn;
    if (ptr.pressed) {
      const hit = (id) => b[id] && inRect(b[id], ptr.x, ptr.y);
      if (state.card && inRect(cardRectFor(lay), ptr.x, ptr.y)) {
        if (state.think && state.think.coach) closeThink(); else { state.reasonOpen = true; state.ui.scroll = 0; }
        return;
      }
      if (state.phase === 'pass') {
        const r = lay.coverBtn;
        if (r && inRect(r, ptr.x, ptr.y)) { sfx.tick(); beginChoose(1); }
        return;
      }
      if (state.think && state.think.coach) { if (hit('think')) closeThink(); return; }
      if (watch) {
        if (hit('pause')) { state.paused = !state.paused; sfx.tick(); return; }
        else if (hit('fast')) { state.ff = !state.ff; sfx.tick(); return; }
        else if (hit('dec')) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); return; }
        else if (hit('inc')) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); return; }
        else if (hit('exit')) { leaveMatch(); return; }
      } else {
        if (state.phase === 'end' && state.endT > 0.7 && inRect(nextRect(lay), ptr.x, ptr.y)) { sfx.tick(); afterFall(); return; }
        if (hit('menu') && state.phase !== 'choose') { openPause(); sfx.tick(); return; }
      }
    }
    const phase0 = state.phase;
    if (state.phase === 'end' && !watch && state.endT > 0.7 && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) { afterFall(); return; }
    if (state.phase === 'choose' && state.humanTurn && !state.paused) humanChoose(input, lay);
    if (phase0 === 'pass' && state.phase === 'pass' && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) beginChoose(1);
    if (state.paused) return;

    state.cheer = Math.max(0, state.cheer - dt * 0.6);
    stepParts(dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    const sdt = watch && state.ff ? dt * 3 : dt;

    if (state.phase === 'ready') {
      state.ready -= sdt;
      const n = Math.ceil(state.ready);
      if (n < lastCount && n > 0) { lastCount = n; sfx.count(false); }
      if (state.ready <= 0) { sfx.count(true); pop(WORLD.cx, 210, 'Satba!', '#ffe27a', 52); beginBeat(); }
    } else if (state.phase === 'choose') {
      if (state.timerOn) {
        state.timer -= dt;
        const c = Math.ceil(state.timer);
        if (state.timer > 0 && c <= 3 && c < state.tickAt) { state.tickAt = c; sfx.tick(); }
        if (state.timer <= 0) {
          if (state.sel.dir < 0 && !state.timerExt) { state.timerExt = true; state.timer = 5; state.tickAt = 99; toast('Five more seconds', 1.4); }
          else { toast('Time!', 1.2); lockIn(true); }
        }
      }
    } else if (state.phase === 'reveal') {
      state.revealT += sdt;
      if (!state.revealFx && state.revealT >= 0.3) { state.revealFx = true; revealEffects(); }
      if (state.revealT >= REVEAL_TIME) {
        state.showMoves = null; state.trail = null;
        if (state.F.over) endFall(); else beginBeat();
      }
    } else if (state.phase === 'fallen') {
      state.endT += sdt;
      if (state.endT > 1.4) { state.phase = 'end'; state.endT = 0; }
    } else if (state.phase === 'end') {
      state.endT += sdt;
      if (watch && state.endT > 3.4) afterFall();
    } else if (watch) updateWatchPhase(dt);
    // displayed dots and the wrestlers' pose
    const F = state.F;
    if (state.phase === 'reveal' && state.rep) {
      const u = smooth((state.revealT - 0.25) / 0.65), bf = state.rep.before.p, af = F.p;
      for (let i = 0; i < 2; i++) state.disp[i] = { x: bf[i].x + (af[i].x - bf[i].x) * u, y: bf[i].y + (af[i].y - bf[i].y) * u };
    } else for (let i = 0; i < 2; i++) state.disp[i] = { x: F.p[i].x, y: F.p[i].y };
    const over = state.phase === 'fallen' || state.phase === 'end' ? F.over : null;
    stepPose(state.pose, state.disp, sdt, over, null, -1);
  }

  // ---- rendering ---------------------------------------------------------------------------------------------------------
  function renderPlay(ctx) {
    const lay = layoutFor(state);
    state.lay = lay;
    // the kit's "Preview m:ss" pill: keep it off the scoreboard, in the top-right corner of the bout picture
    try { globalThis.__previewBadge = { x: lay.stage.x + lay.stage.w - 10, y: lay.stage.y + 8, align: 'right' }; } catch { /* no globalThis writes */ }
    drawStage(ctx, lay.stage, { ring: state.ring, t: state.t, pose: state.pose, looks: state.looks, builds: state.builds, parts: state.parts, pops: state.pops, cheer: state.cheer, shake: 0 });
    drawHud(ctx, state, lay);
    drawBoard(ctx, state, lay);
    drawControls(ctx, state, lay);
    drawOverlays(ctx, state, lay);
    drawCard(ctx, state, lay);
    drawToast(ctx, state, lay);
    if (state.m.cfg.mode === 'watch' && state.wlabel && !state.card) {
      const s = lay.stage; ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(14, Math.round(lay.fs * 0.8))}px system-ui, sans-serif`;
      const w = Math.min(s.w - 20, ctx.measureText(state.wlabel).width + 30);
      ctx.fillStyle = 'rgba(28,18,12,0.85)'; ctx.fillRect(s.x + s.w / 2 - w / 2, s.y + s.h - 56, w, 36);
      ctx.fillStyle = '#ffd24a'; ctx.fillText(state.wlabel, s.x + s.w / 2, s.y + s.h - 31); ctx.restore();
    }
    if (state.phase === 'pass') lay.coverBtn = drawCover(ctx, state, lay);
    if (state.paused && !state.pauseMenu && !state.think && state.phase !== 'ready') {
      const s = lay.stage; ctx.save(); ctx.fillStyle = 'rgba(20,10,4,0.45)'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fbf1dc'; ctx.font = `800 ${Math.round(lay.fs * 1.6)}px system-ui, sans-serif`; ctx.fillText('Paused', s.x + s.w / 2, s.y + s.h / 2); ctx.restore();
    }
  }

  // ---- menus ---------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('mode-')) { s.mode = id.slice(5); state.setupMsg = ''; }
    else if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('hall-')) { const v = id.slice(5); if (state.demo && v !== 'danoh') { state.setupMsg = 'That ring is in the full game.'; return; } s.hall = v; state.setupMsg = ''; }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, hall: s.hall });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'timer-dec') st.timerIdx = Math.max(0, st.timerIdx - 1);
    else if (id === 'timer-inc') st.timerIdx = Math.min(TIMERS.length - 1, st.timerIdx + 1);
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreBusy = false; state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreBusy = false; state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg }); }
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
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (wheelInput.dy) { state.ui.scroll = clamp(state.ui.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
    void dt;
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const setScroll = (v) => { state.ui.scroll = clamp(v, 0, READER.max); };
    if (ptr.pressed) {
      if (inRect(refCloseRect(), ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else if (ptr.y >= READER.y0 && ptr.y <= READER.y1) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) setScroll(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (wheelInput.dy) { setScroll(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
    const step = 70, pgs = Math.max(100, READER.view - 80);
    if (keys.pressed.has('ArrowDown')) setScroll(state.ui.scroll + step);
    if (keys.pressed.has('ArrowUp')) setScroll(state.ui.scroll - step);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setScroll(state.ui.scroll + pgs);
    if (keys.pressed.has('PageUp')) setScroll(state.ui.scroll - pgs);
    if (keys.pressed.has('Home')) setScroll(0);
    if (keys.pressed.has('End')) setScroll(READER.max);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  // ---- showcase (store screenshots: ?shot=1 renders a scripted, real position instead of the random player) ---------------
  const SHOWCASE = [
    { ring: 'danoh', opp: 1, p: [[0.12, -0.2], [0.35, 0.68]], grip: [4, 3], sel: { kind: 'pull', dir: 1, pow: 3 }, beats: 4 },
    { ring: 'moon', opp: 3, p: [[-0.42, 0.3], [0.1, 0.5]], grip: [3, 5], sel: { kind: 'brace', dir: 7, pow: 2 }, think: true, beats: 5 },
    { ring: 'court', opp: 2, p: [[-0.2, -0.5], [0.4, 0.45]], grip: [2, 4], reveal: true, moves: [{ kind: 'pull', dir: 2, pow: 2 }, { kind: 'brace', dir: 6, pow: 2 }], beats: 6 },
    { ring: 'danoh', opp: 4, p: [[0.1, 0.1], [0.3, 0.8]], grip: [3, 2], fall: true, beats: 7 },
    { ring: 'moon', opp: 0, p: [[0.5, 0.1], [-0.2, 0.2]], grip: [4, 4], sel: { kind: 'hook', dir: 3, pow: 2 }, beats: 3 },
    { ring: 'court', opp: 2, p: [[0.1, 0.1], [0.3, 0.8]], grip: [3, 2], fall: true, end: true, beats: 8 },
  ];
  function setupShowcase(kind) {
    const sc = SHOWCASE[kind % SHOWCASE.length];
    state.m = newMatch({ mode: 'ai', opp: sc.opp, hall: sc.ring });
    state.scene = 'play';
    startFall();
    const F = state.F;
    state.phase = 'choose'; state.ready = 0; state.humanTurn = true; state.who = 0; state.timerOn = true; state.timer = 11;
    F.beat = sc.beats;
    F.p = sc.p.map(([x, y]) => ({ x, y })); F.grip = sc.grip.slice();
    if (sc.sel) state.sel = { ...sc.sel };
    for (let i = 0; i < 2; i++) state.disp[i] = { ...F.p[i] };
    state.m.wins = [kind % 2, kind % 3 === 0 ? 1 : 0];
    if (sc.think) {
      const c = coachMove(F, 0), ex = explainMove(F, 0, c.move, { rivalLikely: c.rivalLikely });
      state.card = { title: `Think: ${ex.title}`, text: ex.text, sticky: true }; state.hint = { disc: c.move.kind === 'brace' ? 0 : 1, dir: c.move.dir };
      state.think = { coach: true, move: c.move }; state.paused = true;
    }
    if (sc.reveal) {
      const before = F.p.map((p) => ({ ...p }));
      state.rep = resolve(F, sc.moves); state.trail = before; state.showMoves = sc.moves; state.labels = sc.moves.map((mv) => moveLabel(mv));
      state.phase = 'reveal'; state.revealT = 0.9; state.humanTurn = false; state.timerOn = false; state.revealFx = true;
      for (let i = 0; i < 2; i++) state.disp[i] = { ...F.p[i] };
      state.pose.s[0].act = 0.6; state.pose.s[0].actKind = 'pull'; state.pose.s[1].actKind = 'brace';
      dust(footX(1), WORLD.floorY - 6, 6); pop(footX(1), 250, 'Rooted!', '#b8d8ff', 30); state.pops[0].t = 0.2;
    }
    if (sc.fall) {
      F.p = [{ x: 0.1, y: 0.1 }, { x: 0.3, y: -1.05 }];
      F.over = { win: 0, loser: 1, how: 'pull', name: 'Belly lift (baejigi)', beats: sc.beats, dir: 'back', vec: { x: 0.3, y: -1.05 } };
      state.disp = F.p.map((p) => ({ ...p }));
      state.m.wins[0] = 1; state.m.results.push({ win: 0, name: 'Belly lift (baejigi)', beats: sc.beats });
      state.phase = sc.end ? 'end' : 'fallen'; state.endT = sc.end ? 2 : 0.4; state.humanTurn = false; state.timerOn = false;
      const steps = sc.end ? 90 : 26;
      for (let i = 0; i < steps; i++) stepPose(state.pose, state.disp, 1 / 30, F.over, null, -1);
      dust(footX(1) + 30, WORLD.floorY - 10, 14); ring(footX(1) + 30, WORLD.floorY - 20, 90, '#fff1c0'); confetti(WORLD.cx, 240, 40);
      for (const p of state.parts) p.t += 0.2;
    } else for (let i = 0; i < 60; i++) stepPose(state.pose, state.disp, 1 / 30, null, null, -1);
    state.shotMode = { kind };
  }
  function finishDemoResult() {
    state.m = newMatch({ mode: 'ai', opp: 2, hall: 'moon' });
    state.m.wins = [2, 1]; state.m.results = [{ win: 0, name: 'Belly lift (baejigi)', beats: 6 }, { win: 1, name: 'Outside leg hook (batdari-geolgi)', beats: 9 }, { win: 0, name: 'Side pull', beats: 7 }];
    state.m.over = { win: 0, record: 'Seojun beaten 1 time in all.' };
    state.scene = 'result';
  }
  state.att = newAttract(rng.fork());
  resetMenus();
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % SHOWCASE.length);
    const q = (k) => { try { const mm = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'result') finishDemoResult();
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.page = 0; state.ui.scroll = (Number(q('page')) | 0) * 900; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else if (v === 'two') { state.shotMode = null; startMatch({ mode: 'two', hall: 'moon' }); state.ready = 0; }
      else if (v === 'pass') { state.shotMode = null; startMatch({ mode: 'two', hall: 'court' }); state.ready = 0; state.phase = 'pass'; state.who = 1; }
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;
    if (adv > 0 && state.scene === 'play' && v === 'watch') for (let i = 0; i < adv; i++) { state.t += 1 / 60; updatePlay(1 / 60, BLANK()); }
  }

  return {
    // Watch & Learn and every menu are free; only real falls count against the free preview (a paused game or a countdown does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch' && ['choose', 'reveal', 'pass'].includes(state.phase)) || state.paused,
    update(dt, input) {
      if (SHOT_MODE) input = BLANK();
      setSize(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') stepAttract(state.att, dt);
      if (state.shotMode) return;
      switch (state.scene) {
        case 'title': if (input.keys.pressed.has('Enter')) { handleTitle('play'); break; } updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      wheelInput.dy = 0;
    },
    render(ctx, view) {
      setSize(view?.width ?? meta.width, view?.height ?? meta.height);
      if (state.scene !== 'play') { try { globalThis.__previewBadge = null; } catch { /* ignore */ } }
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
          if (state.m) renderPlay(ctx);
          if (state.pauseMenu) renderPause(ctx, state);
          else if (state.reasonOpen) renderReason(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    ...(config.dev ? { dev: { startMatch, startWatch, openPause, leaveMatch } } : {}),
    lockupZone: () => lockupZone(),
  };
}
