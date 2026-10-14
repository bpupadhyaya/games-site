// GAME CONTRACT (docs/GAME-CONTRACT.md): export meta + createGame(env) -> { update, render, getState }.
// Lapta: the Russian bat-and-run. Aim and time the swing, decide whether to run, dodge the thrown ball, and bank points at the far line and
// back. State machine: title / setup / settings / howto / about / rules / play / result / demolimit. Play phases (m.ph):
//   intro -> [think -> reveal] -> play (one turn, see sim.js) -> sum -> intro ... -> over
import {
  K, RIVALS, newTurn, stepTurn, planBatter, batterInput, resultOf, adviseServe, adviseRun, isOver,
} from './sim.js';
import { FR, setFrame, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, playLayout, readerLayout, inRect } from './layout.js';
import { P, unP, emit, stepFx } from './art.js';
import { setPress } from './ui.js';
import { renderTitle, renderFlow, renderModal, renderReader, hitFlow, flowMax, readerState, flowRects, unlockedCount } from './menus.js';
import { renderPlay, isHumanSide, fieldGeom } from './view.js';
import { pressLockup } from './brand.js';
import { GL } from './glbridge.js';
import { stepCam } from './cam.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } };
const DEMO_INNINGS = 1, DEMO_TURNS = 4;
const GRASS = ['#9fe070', '#7cc455', '#c8f09a'], DUST = ['#d9c39a', '#c2a876', '#e8d8b4'], GOLD = ['#ffe08a', '#ffd04a', '#fff3c4', '#ffffff'];
const RIVAL_STEPS = 3;                       // simulation steps per frame while a computer side bats (fast forward)

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }

  const state = {
    scene: 'title', t: 0, shot: false, demo: !!config.demo, layKey: '',
    settings: { textIdx: 0, thinkIdx: 1, sound: true, guide: true, kit: 0 },
    record: { innings: 0, best: 0, turns: 0, rounds: 0, outs: 0, career: 0, demoGames: 0 },
    setup: { mode: 'solo', level: 0, opp: 1 },
    ui: { scroll: 0, drag: null, page: 0, back: 'title' },
    m: null, resume: null, prevBest: 0,
    fx: [], floats: [], shake: 0, paused: false, pauseMenu: false, hint: null, cheer: 0,
  };
  const frand = () => rng.next();
  state.owned = !!monetization.owns?.('unlock_game');
  state.restoreMsg = ''; state.restoreBusy = false;
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });

  // ---- saving ------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => storage.set('settings', state.settings);
  const saveRecord = () => storage.set('record', state.record);
  const snapshot = (m) => ({ cfg: m.cfg, i: m.i, side: m.side, nSides: m.nSides, nTurns: m.nTurns, seedBase: m.seedBase, totals: m.totals, outs: m.outs, turns: m.turns });
  const saveResume = () => { const m = state.m; if (m && m.cfg.mode !== 'watch' && m.ph !== 'over') { state.resume = JSON.parse(JSON.stringify(snapshot(m))); storage.set('resume', state.resume); } };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (res && res.cfg && res.seedBase !== undefined && !shotMode) state.resume = res;
    audio.setMuted(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  let budget = 0;
  const tone = (o) => { if (budget < 5) { budget++; audio.tone(o); } };
  const sfx = {
    hit: (q) => { tone({ freq: 180 + q * 120, to: 90, dur: 0.16, type: 'square', vol: 0.16 }); tone({ freq: 700 + q * 500, to: 300, dur: 0.07, type: 'triangle', vol: 0.12 }); },
    whiff: () => tone({ freq: 500, to: 160, dur: 0.22, type: 'sine', vol: 0.09 }),
    bounce: () => tone({ freq: 140, to: 80, dur: 0.07, type: 'sine', vol: 0.1 }),
    catch: () => { tone({ freq: 260, to: 140, dur: 0.1, type: 'square', vol: 0.15 }); },
    pick: () => tone({ freq: 330, to: 250, dur: 0.07, type: 'triangle', vol: 0.08 }),
    throw: () => tone({ freq: 700, to: 260, dur: 0.22, type: 'sawtooth', vol: 0.05 }),
    tag: () => { tone({ freq: 150, to: 60, dur: 0.25, type: 'square', vol: 0.2 }); },
    go: () => tone({ freq: 440, to: 660, dur: 0.1, type: 'triangle', vol: 0.09 }),
    dodge: () => tone({ freq: 900, to: 1500, dur: 0.07, type: 'sine', vol: 0.08 }),
    far: () => [523, 784].forEach((f, i) => tone({ freq: f, dur: 0.12 + i * 0.05, type: 'triangle', vol: 0.12 })),
    home: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14 + i * 0.03, type: 'triangle', vol: 0.12 })),
    soft: () => tone({ freq: 330, to: 220, dur: 0.3, type: 'sine', vol: 0.12 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'square', vol: 0.04 }),
    win: () => [523, 659, 784, 1047].forEach((f) => tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.12 })),
  };

  // ---- an innings ------------------------------------------------------------------------------------------------------------
  const rivalOf = (m) => (m.cfg.mode === 'watch' ? RIVALS[2] : m.cfg.mode === 'ai' && m.side === 1 ? RIVALS[m.cfg.opp] : null);
  const floatAt = (x, y, text, col, o = {}) => state.floats.push({ x, y, text, col, t: 0, life: o.life ?? 1.3, size: o.size ?? 40, big: !!o.big });
  const banner = (text, sub, col) => { state.m.banner = { text, sub, col, t: 0, life: 1.6 }; };
  const world = (x, y, z = 0) => P(fieldGeom(), x, y, z);

  const newMatch = (cfg, from = null) => {
    const demo = state.demo && cfg.mode !== 'watch';
    const m = from ? { ...from, cfg } : {
      cfg, i: 0, side: 0, nSides: cfg.mode === 'ai' || cfg.mode === 'two' ? 2 : 1, nTurns: demo ? DEMO_TURNS : K.TURNS,
      seedBase: rng.int(1 << 28) + 1, totals: [0, 0], outs: 0, turns: [[], []],
    };
    Object.assign(m, { T: null, ph: 'intro', pt: 0, plan: null, ai: null, last: null, banner: null, winner: -1, thinkDur: 3, aiming: false, coachAt: -9 });
    return m;
  };
  const startMatch = (cfg, from = null) => {
    if (state.demo && cfg.mode !== 'watch' && !from && state.record.demoGames >= DEMO_INNINGS) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.prevBest = state.record.best;
    state.m = newMatch(cfg, from);
    state.scene = 'play'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.fx = []; state.floats = []; state.shake = 0; state.cheer = 0;
    if (!from && state.demo && cfg.mode !== 'watch') { state.record.demoGames++; saveRecord(); }
    if (cfg.mode !== 'watch') monetization.track('innings_start', { mode: cfg.mode });
    beginTurn();
  };
  const beginTurn = () => {
    const m = state.m;
    m.T = newTurn(m.seedBase, m.i, m.cfg.level);
    Object.assign(m, { ph: 'intro', pt: 0, plan: null, ai: null, last: null, banner: null, aiming: false });
    state.hint = null; state.floats = []; state.fx = [];
  };

  // The computer batters plan on copies of the serve, then play it with the same controls a person has.
  const planFor = (m, P0) => {
    const T = m.T;
    const thinkDur = m.cfg.mode === 'watch' ? THINK_STEPS[state.settings.thinkIdx] : P0.think[0] + frand() * (P0.think[1] - P0.think[0]);
    const plan = planBatter(T, P0, rng.int(1 << 30) + 1);
    m.ai = { plan, P: P0, st: {} };
    m.thinkDur = thinkDur;
    const a = Math.round(plan.plannedAim), side = a < -4 ? `to the left (about ${Math.abs(a)} degrees)` : a > 4 ? `to the right (about ${a} degrees)` : 'straight up the middle';
    const tm = plan.d < -0.04 ? 'a touch early for a high, pulled hit' : plan.d > 0.04 ? 'a touch late for a flat drive' : 'right on the ring for the hardest hit';
    m.plan = { aim: plan.aim, text: `Aim ${side} and swing ${tm}.${plan.expected >= 1.2 ? ` In tests this scored about ${plan.expected.toFixed(1)} points.` : ''}` };
  };

  // Drain engine events into sounds, particles and banners.
  const react = () => {
    const m = state.m, T = m.T, r = T.runner;
    for (const e of T.ev) {
      if (e.type === 'hit') {
        sfx.hit(e.q);
        const p = world(0, K.HOME_Y + 0.3, 1);
        emit(state.fx, 'blade', p.x, p.y, 10, frand, { speed: 160, size: 14, life: 0.7, up: 90, cols: GRASS, g: 260 });
        if (e.q > 0.92) { banner('SWEET HIT!', 'right on the ring', '#ffe08a'); state.shake = 0.6; emit(state.fx, 'star', p.x, p.y, 10, frand, { speed: 240, size: 12, life: 0.8, cols: GOLD }); }
        else if (T.swing && Math.abs(T.swing.d) > 0.06) floatAt(p.x, p.y - 40, T.swing.d < 0 ? 'Early' : 'Late', '#ffffff', { size: 36, life: 0.9 });
      } else if (e.type === 'whiff') { sfx.whiff(); const p = world(0, K.HOME_Y, 2); floatAt(p.x, p.y - 30, e.d < 0 ? 'Too early' : 'Too late', '#ffb98a', { size: 38 }); }
      else if (e.type === 'miss') { sfx.soft(); }
      else if (e.type === 'catch') { sfx.catch(); const p = world(e.at.x, e.at.y, 1.8); emit(state.fx, 'puff', p.x, p.y, 8, frand, { speed: 120, size: 9, life: 0.5, cols: DUST }); banner('CAUGHT!', 'out', '#ffb3a0'); }
      else if (e.type === 'pick') sfx.pick();
      else if (e.type === 'drop') { sfx.bounce(); const p = world(e.at.x, e.at.y, 1.5); floatAt(p.x, p.y - 20, 'Dropped!', '#fff3c4', { size: 34, life: 0.9 }); }
      else if (e.type === 'throw') sfx.throw();
      else if (e.type === 'go') { sfx.go(); }
      else if (e.type === 'dodge') { sfx.dodge(); const p = world(r.x, r.y, 0.2); emit(state.fx, 'puff', p.x, p.y, 8, frand, { speed: 110, size: 8, life: 0.45, cols: DUST }); }
      else if (e.type === 'tag') { sfx.tag(); state.shake = 1; const p = world(e.at.x, e.at.y, 1); emit(state.fx, 'star', p.x, p.y, 12, frand, { speed: 280, size: 13, life: 0.7, cols: ['#ffd04a', '#ff8a6a', '#fff'] }); banner('TAGGED!', 'hit by the ball', '#ffb3a0'); }
      else if (e.type === 'far') {
        sfx.far(); const p = world(r.x, r.y, 2); floatAt(p.x, p.y - 20, `+${K.PTS.far}`, '#ffe08a', { size: 52, big: true });
        emit(state.fx, 'star', p.x, p.y, 8, frand, { speed: 200, size: 11, life: 0.8, cols: GOLD }); state.cheer = 1.6;
      } else if (e.type === 'home') {
        sfx.home(); const p = world(r.x, r.y, 2.2); floatAt(p.x, p.y - 20, `+${K.PTS.home}`, '#9ff0ff', { size: 56, big: true });
        emit(state.fx, 'star', p.x, p.y, 20, frand, { speed: 300, size: 13, life: 1.0, cols: GOLD }); banner('ROUND TRIP!', `${T.pts} points`, '#ffe08a'); state.cheer = 2.4;
      }
    }
    T.ev.length = 0;
    // dust while running
    if ((r.st === 'toFar' || r.st === 'back') && ((state.t * 60) | 0) % 6 === 0) { const p = world(r.x, r.y, 0.1); emit(state.fx, 'puff', p.x, p.y, 1, frand, { speed: 40, size: 6, life: 0.4, up: 10, cols: DUST, g: 40 }); }
  };

  const finishTurn = () => {
    const m = state.m, T = m.T, side = m.side, res = resultOf(T);
    m.last = res; m.turns[side].push(res); m.totals[side] += res.pts;
    if (res.out) m.outs++;
    if (m.cfg.mode !== 'watch' && isHumanSide(m)) {
      const r = state.record; r.turns++; r.career += res.pts;
      if (res.kind === 'round') r.rounds++;
      if (res.out) r.outs++;
      saveRecord();
    }
    m.ph = 'sum'; m.pt = 0; state.hint = null; state.ui.scroll = 0;
    if (!m.banner || res.kind === 'stayed' || res.kind === 'far' || res.kind === 'miss') banner(res.name, res.pts ? `+${res.pts}` : '', res.out ? '#ffb3a0' : res.pts ? '#ffe08a' : '#f4fff0');
  };

  const finishMatch = () => {
    const m = state.m, r = state.record;
    m.ph = 'over'; m.pt = 0;
    if (m.nSides === 1) m.winner = 0;
    else m.winner = m.totals[0] === m.totals[1] ? -1 : m.totals[0] > m.totals[1] ? 0 : 1;
    if (m.cfg.mode !== 'watch') {
      r.innings++;
      if (m.cfg.mode === 'solo') r.best = Math.max(r.best, m.totals[0]);
      saveRecord(); clearResume();
      monetization.track('innings_end', { mode: m.cfg.mode, score: m.totals[0] });
    }
    sfx.win();
  };

  const nextTurn = () => {
    const m = state.m;
    const over = m.outs >= K.OUTS || m.i >= m.nTurns - 1;
    if (!over) { m.i++; saveResume(); beginTurn(); return; }
    if (m.side < m.nSides - 1) { m.side++; m.i = 0; m.outs = 0; saveResume(); beginTurn(); return; }
    finishMatch();
  };

  // ---- input helpers ---------------------------------------------------------------------------------------------------------------
  const openPause = () => { const m = state.m; if (state.scene !== 'play' || !m || m.ph === 'over') return; state.paused = true; if (m.cfg.mode !== 'watch') { state.pauseMenu = true; state.ui.scroll = 0; m.aiming = false; } };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const toTitle = () => { saveResume(); state.scene = 'title'; state.m = null; state.paused = false; state.pauseMenu = false; state.hint = null; state.ui.scroll = 0; };
  const openReader = (scene, back) => { state.scene = scene; state.ui.back = back; state.ui.page = 0; state.ui.scroll = 0; state.ui.drag = null; };

  const think = () => {
    const m = state.m, T = m && m.T;
    if (!m || !T || !isHumanSide(m) || m.ph !== 'play') return;
    if (T.ph === 'serve') {
      const a = adviseServe(T);
      T.aim = a.aim;
      state.hint = { kind: 'think', text: a.text, d: a.d };
    } else if (T.ph === 'play') {
      state.hint = { kind: 'think', text: adviseRun(T).text };
    }
  };

  const scrollPointer = (ptr, input, max, hit) => {
    const ui = state.ui;
    if (input.wheel && input.wheel.dy) ui.scroll = clamp(ui.scroll + input.wheel.dy, 0, max);
    if (ptr.pressed) ui.drag = { y0: ptr.y, s0: ui.scroll, x0: ptr.x, moved: false };
    if (ui.drag && ptr.down) {
      if (Math.abs(ptr.y - ui.drag.y0) > 10) ui.drag.moved = true;
      if (ui.drag.moved) ui.scroll = clamp(ui.drag.s0 - (ptr.y - ui.drag.y0), 0, max);
    }
    if (ptr.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (!d.moved) return hit(d.x0, d.y0);
    }
    return null;
  };

  const startSetup = (mode) => { state.setup.mode = mode; state.scene = 'setup'; state.ui.scroll = 0; };
  const onTitle = (id) => {
    if (id === 'solo' || id === 'ai' || id === 'two') startSetup(id);
    else if (id === 'watch') startMatch({ mode: 'watch', level: 1, watch: 2 });
    else if (id === 'resume' && state.resume) startMatch(state.resume.cfg, JSON.parse(JSON.stringify(state.resume)));
    else if (id === 'howto' || id === 'rules' || id === 'about') openReader(id, 'title');
    else if (id === 'settings') { state.scene = 'settings'; state.ui.back = 'title'; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onSetup = (id) => {
    const s = state.setup;
    if (/^lv\d$/.test(id)) s.level = Number(id[2]);
    else if (/^rv\d$/.test(id)) s.opp = Number(id[2]);
    else if (id === 'start') startMatch({ mode: s.mode, level: s.level, opp: s.opp });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const onSettings = (id) => {
    const st = state.settings, un = unlockedCount(state.record.career);
    if (id === 'dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'sound') { st.sound = !st.sound; audio.setMuted(!st.sound); }
    else if (id === 'guide') st.guide = !st.guide;
    else if (id === 'think') st.thinkIdx = (st.thinkIdx + 1) % THINK_STEPS.length;
    else if (id === 'kit') st.kit = (Math.min(st.kit, un - 1) + 1) % un;
    else if (id === 'restore' && !state.restoreBusy && !state.owned) {
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    saveSettings();
  };
  const onResult = (id) => {
    if (id === 'again') startMatch(state.m.cfg);
    else if (id === 'menu') { state.scene = 'title'; state.m = null; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onPause = (id) => {
    if (id === 'resume') closePause();
    else if (id === 'rules') { state.pauseMenu = false; openReader('rules', 'play'); }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted(!state.settings.sound); saveSettings(); }
    else if (id === 'quit') toTitle();
  };

  const updateFlow = (scene, input, handler) => {
    const id = scrollPointer(input.pointer, input, flowMax(state, scene), (x, y) => hitFlow(state, scene, x, y, state.ui.scroll));
    if (id) handler(id);
    if (input.keys.pressed.has('Escape') && (scene === 'setup' || scene === 'settings')) { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateReader = (input) => {
    const ptr = input.pointer, scene = state.scene, rs = readerState(state, scene), L = rs.L;
    const id = scrollPointer(ptr, input, rs.max, (x, y) => {
      if (inRect(L.dec, x, y)) return 'dec'; if (inRect(L.inc, x, y)) return 'inc'; if (inRect(L.back, x, y)) return 'back'; if (inRect(L.next, x, y)) return 'next';
      return null;
    });
    const n = rs.doc.list.length;
    const goBack = () => { if (state.ui.back === 'play') { state.scene = 'play'; state.pauseMenu = true; } else state.scene = 'title'; state.ui.scroll = 0; };
    if (id === 'dec' || id === 'inc') { state.settings.textIdx = clamp(state.settings.textIdx + (id === 'inc' ? 1 : -1), 0, TEXT_SCALES.length - 1); state.ui.scroll = 0; saveSettings(); }
    else if (id === 'back') { if (state.ui.page === 0) goBack(); else { state.ui.page--; state.ui.scroll = 0; } }
    else if (id === 'next') { if (state.ui.page >= n - 1) goBack(); else { state.ui.page++; state.ui.scroll = 0; } }
    if (input.keys.pressed.has('Escape')) goBack();
    if (input.keys.pressed.has('ArrowRight')) { state.ui.page = Math.min(n - 1, state.ui.page + 1); state.ui.scroll = 0; }
    if (input.keys.pressed.has('ArrowLeft')) { state.ui.page = Math.max(0, state.ui.page - 1); state.ui.scroll = 0; }
  };

  // ---- play ------------------------------------------------------------------------------------------------------------------------
  const updateAmbient = (dt) => {
    stepFx(state.fx, dt);
    for (const f of state.floats) f.t += dt;
    state.floats = state.floats.filter((f) => f.t < f.life);
    state.shake = Math.max(0, state.shake - dt * 3.2);
    state.cheer = Math.max(0, state.cheer - dt);
    const m = state.m;
    if (m && m.banner) { m.banner.t += dt; if (m.banner.t > m.banner.life) m.banner = null; }
  };

  // What a person's thumb and keys do to the turn this tick.
  const humanInput = (dt, input, L, hit) => {
    const m = state.m, T = m.T, ptr = input.pointer, kd = input.keys.down, kp = input.keys.pressed, r = T.runner, g = fieldGeom(), inp = {};
    const onUi = (x, y) => inRect(L.action, x, y) || inRect(L.think, x, y) || inRect(L.pause, x, y) || inRect(L.dodgeL, x, y) || inRect(L.dodgeR, x, y);
    const onField = inRect(L.field, ptr.x, ptr.y) && !onUi(ptr.x, ptr.y);
    const act = hit === 'action' || kp.has('Space') || kp.has('Enter');
    if (kp.has('KeyT')) { if (state.hint) state.hint = null; else think(); }
    if (T.ph === 'serve') {
      if (ptr.pressed && onField) { m.aiming = true; if (state.hint) state.hint = null; }
      if (m.aiming && ptr.down) { const p = unP(g, ptr.x, ptr.y); inp.aim = (Math.atan2(p.x, Math.max(0.5, p.y - (K.HOME_Y + 1.2))) * 180) / Math.PI; }
      if (m.aiming && ptr.released) { inp.swing = true; m.aiming = false; }
      const dir = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0);
      if (dir) inp.aim = T.aim + dir * 70 * dt;
      if (act) { inp.swing = true; m.aiming = false; if (state.hint) state.hint = null; }
    } else if (T.ph === 'play') {
      m.aiming = false;
      if (act && (r.st === 'ready' || r.st === 'atFar')) { inp.run = true; if (state.hint) state.hint = null; }
      if (hit === 'dodgeL' || kp.has('ArrowLeft') || kp.has('KeyA')) inp.dodge = -1;
      if (hit === 'dodgeR' || kp.has('ArrowRight') || kp.has('KeyD')) inp.dodge = 1;
      if (ptr.pressed && onField && !inp.dodge) {
        if (r.st === 'ready' || r.st === 'atFar') { inp.run = true; if (state.hint) state.hint = null; }
        else if (r.st === 'toFar' || r.st === 'back') { const p = unP(g, ptr.x, ptr.y), dx = p.x - r.x; inp.dodge = Math.abs(dx) < 0.4 ? (r.x >= 0 ? -1 : 1) : Math.sign(dx); }
      }
    }
    return inp;
  };

  const updatePlay = (dt, input) => {
    const m = state.m, ptr = input.pointer, L = playLayout();
    const watch = m.cfg.mode === 'watch';
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { if (state.paused) { if (watch) state.paused = false; else closePause(); } else openPause(); }
    if (state.pauseMenu) {
      const id = scrollPointer(ptr, input, flowMax(state, 'pause'), (x, y) => hitFlow(state, 'pause', x, y, state.ui.scroll));
      if (id) onPause(id);
      return;
    }
    let hit = null;
    if (ptr.pressed) {
      if (inRect(L.think, ptr.x, ptr.y)) hit = 'think';
      else if (inRect(L.pause, ptr.x, ptr.y)) hit = 'pause';
      else if (!watch && m.ph !== 'sum' && inRect(L.action, ptr.x, ptr.y)) hit = 'action';
      else if (!watch && m.ph === 'play' && inRect(L.dodgeL, ptr.x, ptr.y)) hit = 'dodgeL';
      else if (!watch && m.ph === 'play' && inRect(L.dodgeR, ptr.x, ptr.y)) hit = 'dodgeR';
    }
    if (m.ph !== 'sum' || watch) {
      if (hit === 'pause') { if (watch) { state.scene = 'title'; state.m = null; state.paused = false; return; } openPause(); return; }
      if (hit === 'think') { if (watch) state.paused = !state.paused; else if (state.hint) state.hint = null; else think(); return; }
    }
    if (state.paused) return;

    const T = m.T;
    updateAmbient(dt);
    m.pt += dt;
    const human = isHumanSide(m), rv = rivalOf(m);
    switch (m.ph) {
      case 'intro':
        if (m.pt >= 1.0) {
          if (human) { m.ph = 'play'; m.pt = 0; }
          else { planFor(m, rv); m.ph = 'think'; m.pt = 0; sfx.tick(); }
        }
        break;
      case 'think': case 'reveal':
        if (m.ph === 'think' && m.pt >= m.thinkDur) { m.ph = 'reveal'; m.pt = 0; T.aim = m.ai.plan.aim; sfx.tick(); }
        else if (m.ph === 'reveal' && m.pt >= REVEAL_SECS) { m.ph = 'play'; m.pt = 0; }
        break;
      case 'play': {
        const steps = human || watch ? 1 : RIVAL_STEPS;
        for (let k = 0; k < steps && T.ph !== 'done'; k++) {
          let inp;
          if (human) inp = humanInput(dt, input, L, hit);
          else inp = batterInput(T, m.ai.plan, m.ai.P, m.ai.st);
          stepTurn(T, dt, inp);
          react();
        }
        if (watch && T.ph === 'play' && T.runner.st !== 'out' && state.t - m.coachAt > 1.2 && (T.runner.st === 'ready' || T.runner.st === 'atFar') && T.ball.st !== 'held' && T.t > 0.3) {
          m.coachAt = state.t; state.hint = { kind: 'coach', text: adviseRun(T).text };
        }
        if (T.ph === 'done') { if (state.hint && state.hint.kind === 'coach') state.hint = null; finishTurn(); }
        break;
      }
      case 'sum': {
        if (watch) { if (m.pt >= 3.2) nextTurn(); }
        else if (!human) { if (m.pt >= 1.5) nextTurn(); }
        else {
          const id = scrollPointer(ptr, input, flowMax(state, 'sum'), (x, y) => hitFlow(state, 'sum', x, y, state.ui.scroll));
          if (id === 'next' || input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) nextTurn();
        }
        break;
      }
      case 'over':
        if (m.pt >= 1.2) { state.scene = 'result'; state.ui.scroll = 0; state.paused = false; }
        break;
      default: break;
    }
  };

  // ---- store screenshots: ?shot=1&seed=N picks a fixed screen ----------------------------------------------------------------------
  const applyPreset = () => {
    const n = Number(config.seed) || 1;
    state.shot = true;
    const GOOD = { ...RIVALS[2], sig: 0.004, aimN: 0, plan: 2, margin: 0.05 };
    // play turns with a strong batter until `until(T)` is true (not every serve gives the wanted moment)
    const turn = (cfg, until, o = {}) => {
      startMatch(cfg);
      const m = state.m;
      let ok = false;
      for (let attempt = 0; attempt < 8 && !ok; attempt++) {
        m.i = attempt; beginTurn();
        const T = m.T, plan = planBatter(T, GOOD, 40 + attempt), st = {};
        plan.aim = o.aim ?? plan.aim; if (o.noSwing) plan.d = 9;
        let guard = 0;
        while (!until(T) && !isOver(T) && guard++ < 60 * 40) { stepTurn(T, 1 / 60, batterInput(T, plan, GOOD, st)); T.ev.length = 0; }
        ok = until(T);
        m.ai = { plan, P: GOOD, st };
      }
      m.ph = 'play'; m.pt = 0;
      if (T0done(m.T)) { m.T.ph = 'done'; finishTurn(); }
      state.paused = false;
    };
    const T0done = (T) => isOver(T);
    const cfg = { mode: 'solo', level: 1 };
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { turn(cfg, (T) => T.t >= T.tossT - 0.35, { aim: 14, noSwing: true }); return; }
    if (n === 3) { turn(cfg, (T) => T.ph === 'play' && T.swing && T.ball.st === 'air' && !T.ball.bounced && T.ball.z > 1.0 && T.t > T.swing.t + 0.3, {}); return; }
    if (n === 4) { turn(cfg, (T) => T.ph === 'play' && T.ball.st === 'thrown' && T.runner.st === 'toFar' && T.runner.y > 6, {}); return; }
    if (n === 5) { turn(cfg, (T) => T.runner.st === 'atFar', {}); return; }
    if (n === 6) {
      turn(cfg, (T) => isOver(T), {});
      const m = state.m; m.totals = [17, 0];
      m.turns = [[{ kind: 'round', name: 'Round trip!', pts: 3, out: false }, { kind: 'far', name: 'Far line reached', pts: 1, out: false }, { kind: 'tagged', name: 'Tagged out', pts: 0, out: true }, { kind: 'round', name: 'Round trip!', pts: 3, out: false }, { kind: 'caught', name: 'Caught out', pts: 0, out: true }, { kind: 'round', name: 'Round trip!', pts: 3, out: false }, { kind: 'stayed', name: 'Safe at home', pts: 0, out: false }, { kind: 'round', name: 'Round trip!', pts: 3, out: false }], []];
      m.winner = 0; m.ph = 'over'; state.scene = 'result';
      return;
    }
    if (n >= 7 && n <= 9) { state.scene = ['rules', 'howto', 'about'][n - 7]; state.ui.page = n === 7 ? 3 : 0; state.ui.back = 'title'; return; }
    if (n === 10) {
      startMatch({ mode: 'watch', level: 1, watch: 2 });
      const m = state.m; planFor(m, RIVALS[2]); m.T.aim = m.ai.plan.aim;
      m.ph = 'reveal'; m.pt = 0.5; return;
    }
    if (n === 11) { state.scene = 'settings'; return; }
    if (n === 12) { state.setup.mode = 'ai'; state.scene = 'setup'; return; }
    if (n === 13) { state.settings.textIdx = 4; state.scene = 'rules'; state.ui.page = 3; return; }
    if (n === 14) { turn({ mode: 'solo', level: 2 }, (T) => T.ph === 'play' && T.runner.st === 'back' && T.runner.y < 14, {}); return; }
    if (n === 15) { turn(cfg, (T) => T.t >= T.tossT - 0.5, { noSwing: true }); state.pauseMenu = true; state.paused = true; return; }
    if (n === 16) { turn(cfg, (T) => isOver(T), {}); return; }
    turn(cfg, (T) => T.t >= T.tossT - 0.6, { noSwing: true });
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------
  const game = {
    // Only live action uses up the free preview: aiming and swinging, and the run itself. Menus, rules, settings, hints,
    // Watch & Learn, computer batters, pause and results are free. A tester build (config.dev) never uses it up.
    isPreviewExempt: () => {
      if (config.dev) return true;
      const m = state.m;
      if (state.scene !== 'play' || !m || m.cfg.mode === 'watch') return true;
      if (state.paused || state.pauseMenu || state.hint) return true;
      if (!isHumanSide(m) || m.ph !== 'play' || !m.T) return true;
      const T = m.T;
      if (T.ph === 'serve') return !m.aiming;
      if (T.ph === 'play') return T.runner.st === 'ready';
      return true;
    },
    update(dt, input) {
      if (state.shot) input = NOINPUT;
      setFrame(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      if (state.layKey !== FR.key) {
        if (state.layKey && state.m) { state.m.aiming = false; state.ui.drag = null; }
        state.layKey = FR.key;
      }
      budget = 0;
      // The preview pill sits in the bottom-left corner of the green (the top is the scoreboard and the hint sheet).
      if (state.scene === 'play') {
        const L = playLayout(), fs = Math.max(16, 11.5 / (meta.cssPerUnit || 0.5));
        meta.previewBadge = { x: L.field.x + 10, y: L.field.y + L.field.h - fs * 1.7 - 10, align: 'left' };
      } else meta.previewBadge = null;
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      stepCam(dt, state);
      if (!(state.paused && state.scene === 'play')) state.t += dt;
      switch (state.scene) {
        case 'title': updateFlow('title', input, onTitle); break;
        case 'setup': updateFlow('setup', input, onSetup); break;
        case 'settings': updateFlow('settings', input, onSettings); break;
        case 'result': updateFlow('result', input, onResult); break;
        case 'demolimit': updateFlow('demolimit', input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }); break;
        case 'howto': case 'about': case 'rules': updateReader(input); break;
        case 'play': if (state.m) updatePlay(dt, input); else state.scene = 'title'; break;
        default: break;
      }
    },
    render(ctx) {
      setFrame(meta.width, meta.height);
      // the canvas is transparent: the 3D layer (when on) shows through wherever the 2D layer does not paint
      GL.views.length = 0;
      ctx.clearRect(0, 0, FR.w, FR.h);
      if (!GL.on) { ctx.fillStyle = '#4c9a3e'; ctx.fillRect(0, 0, FR.w, FR.h); }
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderFlow(ctx, state, 'setup'); break;
        case 'settings': renderFlow(ctx, state, 'settings'); break;
        case 'result': renderFlow(ctx, state, 'result', 0.5); break;
        case 'demolimit': renderFlow(ctx, state, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': renderReader(ctx, state, state.scene); break;
        case 'play':
          if (state.m) {
            renderPlay(ctx, state);
            if (state.pauseMenu) renderModal(ctx, state, 'pause');
            else if (state.m.ph === 'sum' && isHumanSide(state.m) && state.m.cfg.mode !== 'watch') renderModal(ctx, state, 'sum');
          }
          break;
        default: break;
      }
    },
    getState: () => state,
    // Every tappable rectangle of the current screen (layout checks in the headless-browser matrix). No gameplay use.
    getRects() {
      const out = [], sc = state.scene;
      if (sc === 'play') {
        const L = playLayout();
        if (state.pauseMenu) out.push(...flowRects(state, 'pause', state.ui.scroll));
        else if (state.m && state.m.ph === 'sum' && isHumanSide(state.m) && state.m.cfg.mode !== 'watch') out.push(...flowRects(state, 'sum', state.ui.scroll));
        else out.push({ id: 'think', ...L.think }, { id: 'pause', ...L.pause }, { id: 'action', ...L.action }, { id: 'dodgeL', ...L.dodgeL }, { id: 'dodgeR', ...L.dodgeR });
      } else if (sc === 'howto' || sc === 'about' || sc === 'rules') {
        const L = readerLayout(); out.push({ id: 'dec', ...L.dec }, { id: 'inc', ...L.inc }, { id: 'back', ...L.back }, { id: 'next', ...L.next });
      } else out.push(...flowRects(state, sc, state.ui.scroll));
      return { frame: { w: FR.w, h: FR.h, land: FR.land, ins: { t: FR.t, r: FR.r, b: FR.b, l: FR.l } }, rects: out, scene: sc, ph: state.m ? state.m.ph : null, tph: state.m && state.m.T ? state.m.T.ph : null };
    },
  };
  if (shotMode) applyPreset();
  return game;
}
