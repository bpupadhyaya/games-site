// Castells: state and flow. The puzzle, the load rule and the climb live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, campaign, play (build -> rise -> climb -> aleta -> unload), result, colla, settings, howto/about/rules, demolimit.
import { createRng } from '../kit/rng.js';
import {
  RECIPES, makeTower, tierCheck, solve, steadiness, newClimb, stepClimb, doAleta, resultOf, advice, isCrown, clamp,
} from './sim.js';
import { stepFx, COLLAS, PLAZAS, resetArt } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, host } from './layout.js';
import { renderPlay, layoutOf, cardRects, slotRects, gridMetrics } from './view.js';
import {
  renderTitle, renderCampaign, renderSettings, renderColla, renderResult, renderPause, renderPages, renderDemoLimit,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, totalStars, towerUnlocked,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 3;
const SLOW = 0.35;       // time scale while a Think hint is showing in the climb
const THINK_SECS = 2.5;
const HINT_SECS = 7;     // how long a Think hint stays lit in the build
const RISE_TRUNK = 0.7, RISE_CROWN = 0.4;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), aiRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, sortW: false },
    record: { stars: {}, bonus: 0, daily: null, collaSel: 0, plazaSel: 0, runs: 0, crowned: 0, unloaded: 0, perfects: 0, demoRuns: 0 },
    play: null, att: null, fx: [], pops: [], banner: null, shake: 0, toast: '', toastT: 0, last: null, collSel: null, collBack: 'title', restoreMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0, gridScroll: 0, loaded: false, hold: 0, beat: 0,
  };
  syncSize();

  // ---- persistence ----------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!rec.stars || typeof rec.stars !== 'object') rec.stars = {};
    const n = totalStars(rec);
    if (!COLLAS[rec.collaSel] || COLLAS[rec.collaSel].need > n) rec.collaSel = 0;
    if (!PLAZAS[rec.plazaSel] || PLAZAS[rec.plazaSel].need > n) rec.plazaSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
    resetArt();
  });

  // ---- sound --------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const note = (n) => 440 * Math.pow(2, n / 12);
  const sfx = {
    place: () => { tone({ freq: 420 + fxRng.next() * 60, to: 300, dur: 0.07, type: 'triangle', vol: 0.08 }); },
    take: () => { tone({ freq: 300, to: 220, dur: 0.07, type: 'triangle', vol: 0.06 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 130, dur: 0.15, type: 'sawtooth', vol: 0.05 }),
    raise: () => { tone({ freq: 110, to: 55, dur: 0.22, type: 'sine', vol: 0.16 }); [0, 4, 7].forEach((n, i) => tone({ freq: note(n - 5), dur: 0.14 + i * 0.03, type: 'triangle', vol: 0.06 })); },
    kick: () => { tone({ freq: 140, to: 60, dur: 0.12, type: 'sine', vol: 0.1 }); tone({ freq: 700, to: 420, dur: 0.1, type: 'sawtooth', vol: 0.015 }); },
    creak: () => tone({ freq: 180 + fxRng.next() * 60, to: 120, dur: 0.22, type: 'sawtooth', vol: 0.025 }),
    beat: (k) => { tone({ freq: 78, to: 44, dur: 0.12, type: 'sine', vol: 0.09 + k * 0.08 }); },
    // a reedy phrase, the way a gralla might sound, for the crowning
    gralla: () => [0, 4, 7, 12, 11, 12].forEach((n, i) => { const d = 0.2 + (i === 5 ? 0.35 : 0); tone({ freq: note(n + 3), dur: d, type: 'sawtooth', vol: 0.045 }); tone({ freq: note(n + 3) * 1.005, dur: d, type: 'square', vol: 0.02 }); }),
    fall: () => { tone({ freq: 160, to: 40, dur: 0.6, type: 'sawtooth', vol: 0.08 }); tone({ freq: 70, to: 30, dur: 0.5, type: 'sine', vol: 0.16 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: note(n), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 3) => { state.toast = text; state.toastT = secs; };
  const banner = (text, sub, col) => { state.banner = { text, sub, col, t: 0, max: 1.7 }; };

  // ---- effects (screen-space particles) -----------------------------------------------------------------------------------------
  const MAX_FX = 90;
  const add = (q) => { if (state.fx.length < MAX_FX) state.fx.push(q); };
  const stageBase = () => { const L = layoutOf(state), R = L.stage; return { x: R.x + R.w / 2, y: R.y + R.h * 0.8, w: R.w, top: R.y + R.h * 0.15 }; };
  const dust = (x, y, n = 8) => { for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI, v = 30 + fxRng.next() * 80; add({ kind: 0, x: x + (fxRng.next() - 0.5) * 80, y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v * 0.4, t: 0, max: 0.5 + fxRng.next() * 0.4, size: 8 + fxRng.next() * 8 }); } };
  const confetti = (x, y, n) => {
    const cols = ['#e5503a', '#f6cf55', '#24b3a4', '#2f56d8', '#fbfaf1', '#a56bd6'];
    for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + fxRng.next() * 0.7), v = 220 + fxRng.next() * 380; add({ kind: 1, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, max: 1.2 + fxRng.next() * 0.9, size: 5 + fxRng.next() * 5, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 16 }); }
  };
  const sparks = (x, y, n = 8) => { for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI * 2, v = 60 + fxRng.next() * 160; add({ kind: 2, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, max: 0.4 + fxRng.next() * 0.4, size: 4 + fxRng.next() * 3, col: '#ffe6a0' }); } };
  const pop = (text, x, y, col = '#fff3b0', size = 30, max = 1.0) => { if (state.pops.length < 6) state.pops.push({ text, x, y, col, size, t: 0, max }); };

  // ---- towers ---------------------------------------------------------------------------------------------------------------------
  const refresh = () => {
    const p = state.play; if (!p) return;
    p.check = tierCheck(p.tower, Math.min(p.cur, p.tower.tiers.length - 1), p.sel);
  };
  const makePlay = (mode, rIdx, seed) => {
    const recipe = RECIPES[rIdx];
    const tower = makeTower(recipe, createRng(seed));
    return {
      mode, rIdx, recipe, seed, tower, cur: 0, sel: [], phase: 'build', riseT: 0, riseTier: -1, climb: null, hints: 0, hintIds: [], hintT: 0,
      thinkT: 0, pushHeld: 0, t: 0, evDone: 0, overT: 0, fallT: 0, dec: null, dead: false, aiObs: { x: 0, v: 0, t: 0 }, aiPush: 0, check: null, steady: 0,
    };
  };
  const recipeFor = (mode) => {
    const unlocked = RECIPES.map((_, i) => i).filter((i) => towerUnlocked(state.record, i));
    if (mode === 'daily') return { rIdx: 1 + (state.day % (RECIPES.length - 2)), seed: state.day * 7919 + 17 };
    if (mode === 'free') return { rIdx: unlocked[runRng.int(unlocked.length)], seed: runRng.int(1e9) + 1 };
    const hi = Math.min(unlocked.length - 1, 4);
    return { rIdx: runRng.int(hi + 1), seed: runRng.int(1e9) + 1 };      // watch
  };
  const startTower = (mode, rIdx, seedArg) => {
    if (state.demo && mode !== 'watch' && state.record.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    let r;
    if (mode === 'campaign') { const i = clamp(rIdx | 0, 0, RECIPES.length - 1); r = { rIdx: i, seed: seedArg ?? 4000 + i * 131 }; }
    else r = seedArg !== undefined ? { rIdx: clamp(rIdx | 0, 0, RECIPES.length - 1), seed: seedArg } : recipeFor(mode);
    const p = makePlay(mode, r.rIdx, r.seed);
    state.play = p; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.hold = 0.45;
    state.fx.length = 0; state.pops.length = 0; state.banner = null; state.ui.scroll = 0; state.gridScroll = 0; state.last = null;
    if (state.demo && mode !== 'watch') { state.record.demoRuns++; save(); }
    refresh();
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every tier, then shows its choice.' : r.rIdx === 0 && !(state.record.stars['3d6']) ? 'Pick people for the base. Each must hold the weight above.' : 'Fill the tier with people who can hold the weight above.', 4);
  };

  // ---- building -------------------------------------------------------------------------------------------------------------------
  const clearHint = () => { const p = state.play; p.hintIds = []; p.hintT = 0; };
  const toggleCard = (id) => {
    const p = state.play; if (!p || p.phase !== 'build' || p.mode === 'watch') return;
    const tier = p.tower.tiers[p.cur], at = p.sel.indexOf(id);
    if (at >= 0) { p.sel.splice(at, 1); sfx.take(); }
    else {
      if (p.sel.length >= tier.n) p.sel.pop();
      p.sel.push(id); sfx.place();
      const b = stageBase(); sparks(b.x, b.y - 40, 3);
    }
    clearHint(); refresh();
  };
  const removeSlot = (j) => {
    const p = state.play; if (!p || p.phase !== 'build' || p.mode === 'watch') return;
    if (j < p.sel.length) { p.sel.splice(j, 1); sfx.take(); clearHint(); refresh(); }
  };
  const raise = () => {
    const p = state.play; if (!p || p.phase !== 'build') return false;
    refresh();
    if (!p.check.ok) { sfx.no(); return false; }
    const tier = p.tower.tiers[p.cur];
    tier.slots = p.sel.slice(); tier.done = true;
    p.phase = 'rise'; p.riseT = 0; p.riseTier = p.cur;
    clearHint(); sfx.raise();
    const b = stageBase(); dust(b.x, b.y, 10);
    state.shake = Math.max(state.shake, 0.12);
    return true;
  };
  const startClimb = () => {
    const p = state.play;
    p.steady = steadiness(p.tower);
    p.climb = newClimb(p.tower, runRng.fork(), p.steady);
    p.phase = 'climb'; p.evDone = 0; p.thinkT = 0;
    banner('Climb!', 'Keep the tower still', '#f0b43c');
    sfx.gralla();
    toast('Hold left or right to push the tower back. Keep the marker in the green.', 4);
  };
  // Is the tower still solvable from the committed tiers? (the solver is fast; this runs only when a tier is raised or lowered)
  const checkDead = () => {
    const p = state.play; if (!p || p.mode === 'watch') return;
    p.dead = p.cur < p.tower.tiers.length && !solve(p.tower, p.cur, 120000);
    if (p.dead) { toast('This tower can no longer be finished. Lower a tier and choose differently.', 5); sfx.no(); }
  };
  const afterRise = () => {
    const p = state.play;
    p.cur++; p.sel = []; p.phase = 'build'; state.gridScroll = 0;
    if (p.cur >= p.tower.tiers.length) startClimb();
    else { refresh(); p.dec = null; checkDead(); }
  };
  const lower = () => {
    const p = state.play; if (!p || p.phase !== 'build' || p.mode === 'watch') return;
    if (p.sel.length > 0) { p.sel = []; sfx.take(); }
    else if (p.cur > 0) {
      p.cur--; const tier = p.tower.tiers[p.cur];
      p.sel = tier.slots.filter((i) => i >= 0); tier.slots = Array(tier.n).fill(-1); tier.done = false; sfx.take();
    } else return;
    state.gridScroll = 0; clearHint(); refresh();
  };

  // ---- hints ----------------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const p = state.play;
    if (!p || state.paused || p.mode === 'watch') return;
    if (p.phase === 'build') {
      const plan = solve(p.tower, p.cur, 200000);
      p.hints++;
      if (!plan) { toast('This tier cannot be finished from here. Lower a tier and try another way.', 4); sfx.no(); return; }
      p.hintIds = plan[0].slice(); p.hintT = HINT_SECS; sfx.tick();
      const names = plan[0].map((id) => p.tower.people[id].name);
      toast(`Try ${names.join(', ')}. Heavier people low in the tower carry less.`, 5);
    } else if (p.phase === 'climb' && p.climb && !p.climb.done) {
      p.hints++; p.thinkT = THINK_SECS; sfx.tick();
    }
  };

  // ---- the climb: events and the finish ---------------------------------------------------------------------------------------------
  const handleClimbEvents = (p) => {
    const c = p.climb, b = stageBase();
    for (const e of c.events) {
      if (e.seq < p.evDone) continue;
      p.evDone = e.seq + 1;
      if (e.type === 'kick') { sfx.kick(); state.shake = Math.max(state.shake, 0.18); dust(b.x + e.dir * 60, b.y, 4); }
      else if (e.type === 'next') { sfx.tick(); if (e.c === 1) banner('Acotxador', 'the next child climbs', '#f0b43c'); else if (e.c === 2) banner('Enxaneta', 'the last climb', '#f0b43c'); }
      else if (e.type === 'crowned') { sfx.gralla(); banner('Crowned!', 'tap Aleta! when it is calm', '#7fe0c8'); confetti(b.x, b.top + 60, 24); }
      else if (e.type === 'aleta') {
        const q = e.q; sfx.win(); confetti(b.x, b.top + 40, q === 'perfect' ? 46 : 24);
        banner(q === 'perfect' ? 'Perfect aleta!' : q === 'good' ? 'Aleta!' : q === 'late' ? 'Aleta' : 'Shaky aleta', 'now take it down', q === 'perfect' ? '#ffe36a' : '#f0b43c');
        if (q === 'perfect') pop('+Perfect', b.x, b.top + 120, '#ffe36a', 34);
      } else if (e.type === 'fall') { sfx.fall(); state.shake = 0.7; dust(b.x, b.y, 18); p.fallT = 0; banner('It fell!', 'the crowd is safe', '#ff9a8a'); }
      else if (e.type === 'unloaded') { sfx.win(); sfx.gralla(); confetti(b.x, b.y - 100, 40); banner('Descarregat!', 'crowned and taken down', '#7fe0c8'); }
    }
  };
  const finishTower = () => {
    const p = state.play, c = p.climb, rec = state.record;
    const res = resultOf(c, p.hints);
    const before = totalStars(rec);
    const r = {
      mode: p.mode, rIdx: p.rIdx, towerName: p.recipe.name, word: res.word, gloss: res.gloss, stars: res.stars, peak: res.peak, aleta: res.aleta,
      hints: p.hints, unlocks: [], next: null, watch: p.mode === 'watch', seed: p.seed,
    };
    if (p.mode !== 'watch') {
      if (p.hints && r.stars > 2) r.stars = 2;
      rec.runs++;
      if (res.crowned) rec.crowned++;
      if (res.unloaded) rec.unloaded++;
      if (res.aleta === 'perfect') rec.perfects++;
      if (p.mode === 'campaign') { const cur = rec.stars[p.recipe.id] | 0; if (r.stars > cur) rec.stars[p.recipe.id] = r.stars; }
      else if (p.mode === 'daily') {
        const first = !rec.daily || rec.daily.day !== state.day;
        if (first || r.stars > rec.daily.stars) { if (first && r.stars >= 2) rec.bonus = Math.min(10, (rec.bonus | 0) + 1); rec.daily = { day: state.day, stars: r.stars }; }
      } else if (p.mode === 'free' && r.stars >= 2 && (rec.bonus | 0) < 10 && rec.runs % 2 === 0) rec.bonus = (rec.bonus | 0) + 1;
      const after = totalStars(rec);
      COLLAS.forEach((d) => { if (d.need > 0 && before < d.need && after >= d.need) r.unlocks.push(`${d.name} shirt`); });
      PLAZAS.forEach((d) => { if (d.need > 0 && before < d.need && after >= d.need) r.unlocks.push(d.name); });
      if (p.mode === 'campaign' && (rec.stars[p.recipe.id] | 0) >= 1 && p.rIdx + 1 < RECIPES.length) r.next = RECIPES[p.rIdx + 1].name;
      if (r.stars > 0) sfx.win();
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.rev++;
    p.phase = 'over';
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT ---------------------------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  const updateWatch = (dt) => {
    const p = state.play;
    if (state.paused || p.phase !== 'build') return;
    let d = p.dec;
    if (!d) {
      const plan = solve(p.tower, p.cur, 200000);
      if (!plan) { p.sel = []; return; }
      d = p.dec = { phase: 'think', t: 0, dur: watchThink(), ids: plan[0].slice(), placed: 0, wait: 0 };
      toast(p.cur === 0 ? 'Thinking: who can hold the weight of everyone above?' : 'Thinking about the next tier…', 3);
    }
    d.t += dt;
    if (d.phase === 'think' && d.t >= d.dur) { d.phase = 'reveal'; d.t = 0; d.dur = 2; p.hintIds = d.ids.slice(); sfx.tick(); }
    else if (d.phase === 'reveal' && d.t >= d.dur) { d.phase = 'act'; d.t = 0; d.wait = 0; }
    else if (d.phase === 'act') {
      d.wait -= dt;
      if (d.wait <= 0) {
        if (d.placed < d.ids.length) { p.sel.push(d.ids[d.placed++]); sfx.place(); d.wait = 0.35; refresh(); }
        else { p.hintIds = []; raise(); p.dec = null; }
      }
    }
  };
  const aiSteer = (dt) => {
    const p = state.play, c = p.climb;
    if (!c || c.done) return 0;
    p.aiObs.t += dt;
    if (p.aiObs.t >= 0.14) { p.aiObs = { x: c.x, v: c.v, t: 0 }; const a = p.aiObs.x + 0.3 * p.aiObs.v; p.aiPush = Math.abs(a) < 0.07 ? 0 : a > 0 ? -1 : 1; }
    if (c.phase === 'aleta' && !c.aleta && c.aletaT > 0.6 && Math.abs(c.x) + Math.abs(c.v) * 0.25 < 0.1) doAleta(c);
    return p.aiPush;
  };

  // ---- the title-screen demo: a finished tower swaying in the square ---------------------------------------------------------------------
  const newAttract = () => {
    const tower = makeTower(RECIPES[0], createRng(77));
    tower.tiers.forEach((t, i) => { t.slots = tower.hidden[i].slice(); t.done = true; });
    const T = tower.T;
    state.att = {
      mode: 'attract', tower, cur: tower.tiers.length, sel: [], phase: 'climb', hintIds: [],
      climb: { x: 0, v: 0, push: 0, wobble: 0, phase: 'aleta', g: 3 * T + 3, total: 3 * T + 3, T, aleta: 'perfect', height: T + 2, done: false, t: 0, climber: 2, tension: 0 },
    };
  };

  // ---- pause ---------------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };

  // ---- the play scene -------------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  let gridDrag = null;
  const updatePlay = (dt, input) => {
    const p = state.play, ptr = input.pointer, keys = input.keys, watch = p.mode === 'watch';
    const L = layoutOf(state);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      return;
    }
    const building = p.phase === 'build' && !state.paused;
    // a card tap or a scroll of the tray ends on release; the end of the last gesture is handled before a new press starts
    if (gridDrag && (ptr.released || !ptr.down)) {
      const d = gridDrag; gridDrag = null;
      if (d.moved < 10 && building) {
        const cr = cardRects(state, L, d.s0);
        const hit = cr.cards.find((c) => inRect(c, d.x0, d.y0));
        if (hit) toggleCard(hit.id);
      }
    }
    // ---- presses
    if (ptr.pressed && state.hold <= 0) {
      if (watch) {
        const D = L.demo;
        if (inRect(L.pause, ptr.x, ptr.y) || inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
        if (inRect(L.think, ptr.x, ptr.y) || inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
      } else if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      else if (inRect(L.think, ptr.x, ptr.y)) requestThink();
      else if (building) {
        if (inRect(L.sort, ptr.x, ptr.y)) { state.settings.sortW = !state.settings.sortW; state.gridScroll = 0; sfx.tick(); save(); }
        else if (inRect(L.raise, ptr.x, ptr.y)) raise();
        else if (inRect(L.lower, ptr.x, ptr.y)) lower();
        else {
          const rs = slotRects(L, p.tower.tiers[p.cur]);
          const j = rs.findIndex((r) => inRect(r, ptr.x, ptr.y));
          if (j >= 0) removeSlot(j);
          else if (inRect(L.grid, ptr.x, ptr.y)) gridDrag = { y0: ptr.y, x0: ptr.x, s0: state.gridScroll, moved: 0 };
        }
      } else if (p.phase === 'climb' && p.climb && p.climb.phase === 'aleta' && !p.climb.aleta && inRect(L.aleta, ptr.x, ptr.y) && !watch) doAleta(p.climb);
    }
    if (gridDrag && ptr.down) {
      gridDrag.moved = Math.max(gridDrag.moved, Math.abs(ptr.y - gridDrag.y0));
      const m2 = gridMetrics(state, L);
      if (gridDrag.moved >= 10) state.gridScroll = clamp(gridDrag.s0 - (ptr.y - gridDrag.y0), 0, m2.max);
    }
    if (building && !watch) {
      if (keys.pressed.has('Enter')) raise();
      if (keys.pressed.has('Backspace')) lower();
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (watch && keys.pressed.has('Space')) state.paused = !state.paused;
    // ---- climb input
    let push = 0;
    if (p.phase === 'climb' && p.climb && !p.climb.done && !watch) {
      const onL = ptr.down && state.hold <= 0 && (inRect(L.padL, ptr.x, ptr.y) || (inRect(L.stage, ptr.x, ptr.y) && ptr.x < L.stage.x + L.stage.w / 2));
      const onR = ptr.down && state.hold <= 0 && (inRect(L.padR, ptr.x, ptr.y) || (inRect(L.stage, ptr.x, ptr.y) && ptr.x >= L.stage.x + L.stage.w / 2));
      const left = keys.down.has('ArrowLeft') || keys.down.has('KeyA') || onL;
      const right = keys.down.has('ArrowRight') || keys.down.has('KeyD') || onR;
      push = (right ? 1 : 0) - (left ? 1 : 0);
      if (keys.pressed.has('KeyH')) requestThink();
      if (keys.pressed.has('Space') && p.climb.phase === 'aleta' && !p.climb.aleta) doAleta(p.climb);
    }
    if (state.paused) return;
    // ---- time passes
    p.t += dt;
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (p.hintT > 0) { p.hintT -= dt; if (p.hintT <= 0) p.hintIds = []; }
    if (watch) updateWatch(dt);
    if (p.phase === 'rise') {
      p.riseT += dt;
      if (p.riseT >= (isCrown(p.tower.tiers[p.riseTier]) ? RISE_CROWN : RISE_TRUNK)) afterRise();
    } else if (p.phase === 'climb' && p.climb) {
      const c = p.climb;
      if (watch) push = aiSteer(dt);
      if (p.thinkT > 0) p.thinkT = Math.max(0, p.thinkT - dt);
      const ts = p.thinkT > 0 && !watch ? SLOW : 1;
      p.pushHeld = push;
      if (!c.done) stepClimb(c, p.tower, dt * ts, push, aiRng);
      handleClimbEvents(p);
      // the drum: faster as the tension rises
      state.beat -= dt;
      if (state.beat <= 0 && !c.done) { sfx.beat(c.tension); state.beat = 0.78 - 0.34 * Math.min(1, c.tension + (c.wobble ? 0.2 : 0)); if (c.wobble) sfx.creak(); }
      if (c.done) {
        p.overT += dt;
        if (c.phase === 'fell') { p.fallT += dt; c.x += Math.sign(c.x || 1) * dt * Math.min(1.4, p.fallT * 1.5); }
        if (p.overT > 2.1 || (ptr.pressed && p.overT > 1.0 && state.hold <= 0)) finishTower();
      }
    }
    stepFx(state.fx, dt);
    for (const q of state.pops) q.t += dt;
    state.pops = state.pops.filter((q) => q.t < q.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'p-retry') { const p = state.play; closePause(); startTower(p.mode, p.rIdx, p.seed); }
    else if (id === 'quit') leaveRun();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'campaign') { state.scene = 'campaign'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'daily' || id === 'free' || id === 'watch') startTower(id, 0);
    else if (id === 'colla') { state.collBack = 'title'; state.collSel = null; state.scene = 'colla'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleCampaign = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id.startsWith('tower:')) { const i = Number(id.slice(6)); if (towerUnlocked(state.record, i)) startTower('campaign', i); }
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
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') { if (r && r.watch) startTower('watch', 0); else if (r && r.mode === 'campaign') startTower('campaign', r.rIdx, r.seed); else startTower(r ? r.mode : 'free', 0); }
    else if (id === 'next') { if (r && r.rIdx + 1 < RECIPES.length) startTower('campaign', r.rIdx + 1); }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'colla') { state.collBack = 'result'; state.collSel = null; state.scene = 'colla'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I ${r.stars >= 2 ? 'crowned and unloaded' : r.stars === 1 ? 'crowned' : 'built'} a ${r.towerName} castell with ${r.stars} stars in Castells from Arcforge!`)).catch(() => {}); }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.rev++; save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.rev++; save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateColla = (dt, input) => {
    const ptr = input.pointer, rec = state.record, n = totalStars(rec);
    ensureLayout(state, 'colla');
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          const same = state.collSel && state.collSel.kind === h.kind && state.collSel.i === h.i;
          if (h.kind === 's') { if (same && n >= COLLAS[h.i].need) { rec.collaSel = h.i; save(); sfx.win(); } else sfx.tick(); }
          else if (same && n >= PLAZAS[h.i].need) { rec.plazaSel = h.i; save(); resetArt(); sfx.win(); } else sfx.tick();
          state.collSel = { kind: h.kind, i: h.i }; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; }
  };
  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; state.rev++; save(); }
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

  resetMenus();
  newAttract();

  // ---- store screenshots (main.js calls shotScene only for ?shot=1&scene=...) ----------------------------------------------------------
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const buildTo = (p, upto) => {
    while (p.cur < upto && p.cur < p.tower.tiers.length) {
      const plan = solve(p.tower, p.cur, 200000);
      if (!plan) break;
      p.sel = plan[0].slice(); refresh(); raise(); advance(60);
    }
  };
  const shotScene = (name) => {
    const rec = state.record;
    rec.stars = { '3d6': 3, '4d6': 3, '3d7': 2, '4d7': 2, '5d7': 1 }; rec.bonus = 2; rec.collaSel = 0; rec.runs = 18; rec.crowned = 12; rec.unloaded = 9; rec.perfects = 5;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(120); return; }
    if (name === 'build' || name === 'build2') {
      startTower('campaign', 3); state.hold = 0; state.toastT = 0; const p = state.play;
      buildTo(p, name === 'build' ? 2 : 3);
      const plan = solve(p.tower, p.cur, 200000);
      if (plan) { p.sel = plan[0].slice(0, Math.max(1, p.tower.tiers[p.cur].n - 1)); refresh(); }
      advance(4); return;
    }
    if (name === 'climb' || name === 'crown' || name === 'wobble') {
      startTower('campaign', 3); state.hold = 0; state.toastT = 0; const p = state.play;
      buildTo(p, p.tower.tiers.length); advance(10);
      const c = p.climb;
      if (c) {
        for (let i = 0; i < 60 * 80 && c.phase !== 'aleta' && !c.done; i++) {
          if (name !== 'crown' && c.g > p.tower.T * 1.9) break;
          const a = advice(c); p.pushHeld = a; stepClimb(c, p.tower, 1 / 60, a, aiRng); handleClimbEvents(p);
        }
        if (name === 'wobble') { c.x = 0.5; c.v = 0.2; }
        state.banner = null; state.toastT = 0; state.fx.length = 0;
        if (name === 'crown') advance(40);
      }
      return;
    }
    if (name === 'aleta') {
      startTower('campaign', 3); state.hold = 0; state.toastT = 0; const p = state.play;
      buildTo(p, p.tower.tiers.length); advance(10);
      const c = p.climb;
      for (let i = 0; i < 60 * 80 && c.phase !== 'aleta' && !c.done; i++) { const a = advice(c); p.pushHeld = a; stepClimb(c, p.tower, 1 / 60, a, aiRng); handleClimbEvents(p); }
      for (let i = 0; i < 60 * 3 && c.phase === 'aleta' && !c.aleta; i++) { stepClimb(c, p.tower, 1 / 60, advice(c), aiRng); if (c.aletaT > 0.5 && Math.abs(c.x) < 0.1) doAleta(c); }
      state.banner = null; state.toastT = 0; state.fx.length = 0; advance(20); return;
    }
    if (name === 'fall' || name === 'pause') {
      startTower('campaign', 3); state.hold = 0; state.toastT = 0; const p = state.play;
      buildTo(p, p.tower.tiers.length); advance(10);
      const c = p.climb;
      if (name === 'pause') { for (let i = 0; i < 60 * 3; i++) { const a = advice(c); stepClimb(c, p.tower, 1 / 60, a, aiRng); } state.banner = null; state.toastT = 0; openPause(); advance(2); return; }
      for (let i = 0; i < 60 * 40 && !c.done; i++) { if (c.g > p.tower.T * 1.6) c.v += 0.02; stepClimb(c, p.tower, 1 / 60, 0, aiRng); }
      handleClimbEvents(p); p.fallT = 0.7; state.banner = null; state.fx.length = 0; state.toastT = 0; state.shake = 0; advance(1); return;
    }
    if (name === 'result') {
      startTower('campaign', 3); state.hold = 0; const p = state.play;
      buildTo(p, p.tower.tiers.length); advance(4);
      const c = p.climb;
      for (let i = 0; i < 60 * 200 && !c.done; i++) {
        stepClimb(c, p.tower, 1 / 60, advice(c), aiRng);
        if (c.phase === 'aleta' && !c.aleta && c.aletaT > 0.5 && Math.abs(c.x) < 0.1) doAleta(c);
      }
      p.hints = 0; finishTower(); advance(3); return;
    }
    if (name === 'colla') { state.scene = 'colla'; state.collBack = 'title'; state.collSel = { kind: 's', i: 2 }; state.rev++; advance(2); return; }
    if (name === 'campaign') { state.scene = 'campaign'; state.rev++; advance(2); return; }
    if (name === 'watch') {
      state.settings.thinkIdx = 0;
      startTower('watch', 0); state.hold = 0; state.toastT = 0;
      for (let i = 0; i < 60 * 60 && !(state.play.dec && state.play.dec.phase === 'reveal' && state.play.cur >= 1); i++) advance(1);
      return;
    }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); }
  };

  // The kit's "Preview 0:42" pill: keep it clear of the HUD (under the title bar in portrait, top-left of the square in landscape).
  const placeBadge = () => {
    if (state.scene === 'play' && state.play) {
      const L = layoutOf(state);
      meta.previewBadge = L.land ? { x: Math.max(12, L.backClear || 0), y: Math.max(8, host.t + 8), align: 'left' } : { x: L.info.x + L.info.w / 2, y: L.info.y + L.info.h + 6, align: 'center' };
    } else meta.previewBadge = { x: 12, y: meta.height - host.b - 46, align: 'left' };
  };

  const api = {
    // Watch & Learn, every menu and the colla are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.play && state.play.mode !== 'watch' && state.play.phase !== 'over') || state.paused || state.hold > 0,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (state.scene === 'play' && state.play && state.play.phase === 'build' && !state.pauseMenu) { const m = gridMetrics(state, layoutOf(state)); state.gridScroll = clamp(state.gridScroll + dy, 0, m.max); }
          else if (['title', 'campaign', 'settings', 'result', 'demolimit', 'colla'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      placeBadge();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play' && state.att) { state.att.climb.t += dt; stepFx(state.fx, dt); }
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'campaign': updateFlowScene(dt, input, handleCampaign, 'campaign'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'colla': updateColla(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'campaign': renderCampaign(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'colla': renderColla(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.play) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  return api;
}
