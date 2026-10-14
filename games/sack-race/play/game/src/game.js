// Sack Race: state and flow. Physics, rivals and scoring live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (race, clock, daily, watch), result, sacks, settings, howto/about/rules, demolimit.
import {
  newRace, stepRace, tap, tapRacer, advise, plan, AIR_T, PERFECT_MIN, HEATS, LEN, ordinal, fmtTime, placeNow,
} from './sim.js';
import { stepFx, SACKS, glState } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, host } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderSacks,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit,
} from './menus.js';
import { ABOUT, HOWTO, RULES, creditsSection } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 5;
const SLOW = 0.35;       // time scale while a Think hint is showing
const THINK_SECS = 2.5;  // how long a Think hint lasts
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

let aboutMemo = { src: null, list: ABOUT };
// About, plus the 3D layer's credits when the layer is present (fonts, characters, motion data and three.js licences).
const aboutList = () => {
  if (aboutMemo.src !== glState.lic) { const c = creditsSection(glState.lic); aboutMemo = { src: glState.lic, list: c ? [...ABOUT, c] : ABOUT }; }
  return aboutMemo.list;
};

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, guide: true, textIdx: 0, thinkIdx: 1 },
    record: { best: 0, bestDaily: 0, dailyDay: -1, races: 0, wins: 0, heat: 0, maxWon: -1, perfects: 0, falls: 0, owned: [true, false, false, false, false, false], sackSel: 0, demoRuns: 0, ghost: null },
    race: null, att: null, attFx: [], attCam: 0, camX: -1.5, fx: [], pops: [], banner: null, shake: 0, toast: '', toastT: 0,
    think: null, dec: null, overT: 0, last: null, collSel: null, collBack: 'title', restoreMsg: '', tapFlash: null, broke: {}, ghost: null,
    streak: 0, ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, lastCuePhase: -1, decFalls: 0,
  };
  syncSize();

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.owned) || rec.owned.length < SACKS.length) rec.owned = [true, false, false, false, false, false];
    rec.owned[0] = true;
    rec.heat = clamp(rec.heat | 0, 0, HEATS.length - 1);
    if (!rec.owned[rec.sackSel]) rec.sackSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    hop: (q = 0.7, n = 0) => {
      tone({ freq: 150 + fxRng.next() * 20, to: 70, dur: 0.1, type: 'sine', vol: 0.11 });
      tone({ freq: 380 + n * 18 + q * 120, to: 260, dur: 0.06, type: 'triangle', vol: 0.045 });
    },
    thud: () => tone({ freq: 90, to: 50, dur: 0.08, type: 'sine', vol: 0.09 }),
    perfect: (n = 0) => tone({ freq: 880 * Math.pow(2, Math.min(7, n) / 12), dur: 0.1, type: 'sine', vol: 0.05 }),
    rut: () => { tone({ freq: 220, to: 110, dur: 0.16, type: 'sawtooth', vol: 0.05 }); },
    mud: () => tone({ freq: 140, to: 60, dur: 0.22, type: 'triangle', vol: 0.07 }),
    fall: () => { tone({ freq: 260, to: 70, dur: 0.4, type: 'sawtooth', vol: 0.06 }); tone({ freq: 90, to: 40, dur: 0.25, type: 'sine', vol: 0.12 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 230, to: 140, dur: 0.12, type: 'sawtooth', vol: 0.035 }),
    set: () => tone({ freq: 520, dur: 0.12, type: 'triangle', vol: 0.08 }),
    go: () => { tone({ freq: 1040, dur: 0.28, type: 'square', vol: 0.05 }); tone({ freq: 1560, dur: 0.28, type: 'triangle', vol: 0.04 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.1 })),
    fin: () => [0, 3, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.07 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- effects --------------------------------------------------------------------------------------------------
  const MAX_FX = 90;
  const add = (list, q) => { if (list.length < MAX_FX) list.push(q); };
  const dust = (list, lane, x, n = 5, col) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI, v = 0.3 + fxRng.next() * 0.8; add(list, { kind: col ? 5 : 0, lane, x: x + (fxRng.next() - 0.5) * 0.3, y: 0.05, vx: Math.cos(a) * v * 1.2, vy: Math.sin(a) * v * (col ? 2 : 0.6), t: 0, max: 0.35 + fxRng.next() * 0.3, size: col ? 0.045 : 0.07 + fxRng.next() * 0.05, col }); }
  };
  const sparks = (list, lane, x, y, n = 8, cols = ['#fff3b0', '#ffd24a', '#ffffff']) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU, v = 0.8 + fxRng.next() * 2; add(list, { kind: 1, lane, x, y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + 0.8, t: 0, max: 0.35 + fxRng.next() * 0.4, size: 0.04 + fxRng.next() * 0.03, col: cols[i % cols.length] }); }
  };
  const grassBits = (list, lane, x, n) => {
    const cols = ['#5aa83e', '#7cc25a', '#3f8a38'];
    for (let i = 0; i < n; i++) add(list, { kind: 3, lane, x, y: 0.05, vx: (fxRng.next() - 0.3) * 2, vy: 1 + fxRng.next() * 1.5, t: 0, max: 0.5 + fxRng.next() * 0.4, size: 0.035, col: cols[i % 3], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 10 });
  };
  const confetti = (list, lane, x, n) => {
    const cols = ['#ff3d7f', '#ffc83d', '#25d0c0', '#7a5cff', '#fff1e2', '#ff7a2f'];
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU, v = 1 + fxRng.next() * 2.2; add(list, { kind: 4, lane, x, y: 0.8 + fxRng.next(), vx: Math.cos(a) * v, vy: 1.5 + fxRng.next() * 3, t: 0, max: 1 + fxRng.next() * 0.8, size: 0.05 + fxRng.next() * 0.04, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 14 }); }
  };
  const pop = (text, lane, x, y, col = '#fff3b0', size = 28, max = 0.9) => { if (state.pops.length < 8) state.pops.push({ text, lane, x, y, col, size, t: 0, max }); };
  const banner = (text, sub, col) => { state.banner = { text, sub, col, t: 0, max: 1.7 }; };
  const laneOff = () => (state.ghost && state.race && state.race.mode === 'clock' ? 1 : 0);

  // ---- races ----------------------------------------------------------------------------------------------------
  const levelFor = (mode) => (mode === 'watch' ? 1 : mode === 'race' ? state.record.heat : 0);
  const startRace = (mode) => {
    if (state.demo && mode !== 'watch' && state.record.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    state.ghost = mode === 'clock' && state.record.ghost && state.record.ghost.xs && state.record.ghost.xs.length ? state.record.ghost : null;
    const race = newRace({ mode, level: levelFor(mode), day: state.day }, runRng);
    state.race = race; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.think = null; state.dec = null;
    state.fx.length = 0; state.pops.length = 0; state.banner = null; state.overT = 0; state.last = null; state.ui.scroll = 0; state.broke = {}; state.streak = 0;
    state.camX = -1.6; state.lastCuePhase = -1; state.decFalls = 0;
    if (state.demo && mode !== 'watch') { state.record.demoRuns++; save(); }
    toast(mode === 'watch' ? 'Watch & Learn: the game stops to think at key moments' : 'Tap RIGHT to push forward, LEFT to rock back. Tap as your feet land.', 3.4);
  };
  const doTap = (side) => {
    const race = state.race;
    if (!race || race.over || state.paused) return;
    state.tapFlash = { side, t: 0 };
    if (!race.go) { sfx.no(); return; }
    const res = tap(race, side);
    if (res === 'early') { const me = race.racers[race.you]; pop('Too early', me.lane + laneOff(), me.x, 1.9, '#ffe0b0', 22, 0.6); sfx.no(); }
    if (state.think) state.think = null;
  };

  // events from the simulation: hops, ruts, mud, falls and finishes become sound, particles and words
  const handleEvents = (race, list, live) => {
    const off = race === state.race ? laneOff() : 0;
    for (const e of race.events) {
      if (e.seq < race.evDone) continue;
      race.evDone = e.seq + 1;
      const r = race.racers[e.id], lane = r ? r.lane + off : 0, mine = r && r.player;
      if (e.type === 'hop') {
        dust(list, lane, e.x, e.q >= PERFECT_MIN ? 2 : 4);
        if (live && mine) {
          if (e.q >= PERFECT_MIN) { state.streak++; sfx.hop(e.q, state.streak); sfx.perfect(state.streak); if (state.streak % 10 === 0) { banner(`${state.streak} clean hops`, 'in a row', '#7fe8d0'); confetti(list, lane, e.x, 10); } sparks(list, lane, e.x, 0.15, 3); }
          else { state.streak = 0; sfx.hop(e.q, 0); if (e.q < 0.5) pop('Late', lane, e.x, 1.9, '#d9e4c8', 22, 0.55); }
        }
      } else if (e.type === 'land') {
        if (live && mine) sfx.thud();
      } else if (e.type === 'rut') {
        dust(list, lane, e.x, 8, '#8a6040'); grassBits(list, lane, e.x, 5);
        if (live && mine) { sfx.rut(); pop(e.dir > 0 ? 'Rut! pitched forward' : 'Rut! pitched back', lane, e.x, 2.0, '#ffd89a', 24, 1); state.shake = Math.max(state.shake, 0.18); }
      } else if (e.type === 'mud') {
        dust(list, lane, e.x, 10, '#6b4a2a');
        if (live && mine) { sfx.mud(); pop('Mud!', lane, e.x, 1.9, '#d6b48a', 24, 0.8); }
      } else if (e.type === 'fall') {
        dust(list, lane, e.x, 12); grassBits(list, lane, e.x, 8);
        if (live && mine) { sfx.fall(); state.shake = 0.5; state.streak = 0; pop(e.fwd ? 'Face first!' : 'Down you go!', lane, e.x, 2.0, '#ffb8a0', 28, 1.2); }
      } else if (e.type === 'go') {
        if (live) sfx.go();
      } else if (e.type === 'finish') {
        confetti(list, lane, e.x, mine ? 36 : 10);
        if (race === state.race) state.broke[lane] = 1;
        if (live && mine) {
          if (race.mode === 'clock' || race.mode === 'watch') { banner('Finished!', `${fmtTime(e.time)} s`, '#ffe074'); sfx.fin(); }
          else if (e.place === 1) { banner('You win!', `${fmtTime(e.time)} s`, '#ffe074'); sfx.win(); }
          else { banner(`${ordinal(e.place)} place`, `${fmtTime(e.time)} s`, '#cfe8ff'); sfx.fin(); }
          state.shake = Math.max(state.shake, 0.2);
        }
      }
    }
  };

  const finishRace = () => {
    const race = state.race, rec = state.record, mode = race.mode, me = race.racers[race.you], o = race.over;
    const r = { mode, place: o.place, time: o.time, best: 0, newBest: false, falls: me.falls, perfects: me.perfects, hints: race.hintsUsed, unlocks: [], heatMsg: '', heatNext: false, dnf: !o.done };
    if (mode !== 'watch') {
      rec.races++; rec.perfects += me.perfects; rec.falls += me.falls;
      const practice = race.hintsUsed > 0;
      if (o.done && !practice) {
        if (mode === 'daily') {
          if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; }
          if (!rec.bestDaily || o.time < rec.bestDaily) { rec.bestDaily = o.time; r.newBest = true; }
          r.best = rec.bestDaily;
        } else {
          if (!rec.best || o.time < rec.best) { rec.best = o.time; r.newBest = true; if (mode === 'clock') rec.ghost = { dt: 0.1, xs: race.rec.slice(0, 600) }; }
          r.best = rec.best;
        }
      } else r.best = mode === 'daily' ? rec.bestDaily : rec.best;
      if (mode === 'race' && o.done) {
        if (o.place === 1) {
          rec.wins++; rec.maxWon = Math.max(rec.maxWon, race.level);
          if (race.level === rec.heat && rec.heat < HEATS.length - 1) { rec.heat++; r.heatNext = true; r.heatMsg = `Heat cleared! Next: ${HEATS[rec.heat].name}`; }
          else if (race.level >= HEATS.length - 1) r.heatMsg = 'Grand Champion! Defend the title.';
        } else r.heatMsg = 'Finish first to move up a heat.';
      }
      const gain = (i) => { if (!rec.owned[i]) { rec.owned[i] = true; r.unlocks.push(SACKS[i].name); sfx.win(); } };
      if (o.done && mode === 'race' && o.place === 1) gain(1);
      if (rec.maxWon >= 2) gain(2);
      if (o.done && me.falls === 0 && !practice) gain(3);
      if (o.done && mode === 'daily') gain(4);
      if (o.done && mode !== 'daily' && o.time < 18 && !practice) gain(5);
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.rev++;
    if (r.newBest) sfx.win();
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT ---------------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  const needDecision = (race, r) => {
    if (r.hops % 8 === 0) return true;
    if (Math.abs(r.th) > 0.45) return true;
    if (r.falls !== state.decFalls) { state.decFalls = r.falls; return true; }
    const nx = r.x + r.v * AIR_T;
    return race.course.ruts.some((u) => u.x + u.w > nx - 0.1 && u.x < nx + 0.9);
  };
  const updateWatch = (dt) => {
    const race = state.race, r = race.racers[race.you];
    if (state.paused || race.over) return true;
    if (!race.go) return false;
    const dec = state.dec;
    if (dec) {
      dec.t += dt;
      if (dec.phase === 'think' && dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; }
      else if (dec.phase === 'reveal' && dec.t >= dec.dur) {
        dec.phase = 'go'; dec.t = 0;
        r.buf = { side: dec.adv.side };
        state.dec = null; state.think = null;
      }
      return true;
    }
    if (r.phase === 'air' && AIR_T - r.pt <= 0.07 && !r.buf && r.botHop !== r.hops) {
      r.botHop = r.hops;
      const adv = advise(race);
      if (needDecision(race, r)) { state.dec = { active: true, phase: 'think', t: 0, dur: watchThink(), adv }; state.think = { adv, t: 0 }; return true; }
      r.buf = { side: adv.side };
    } else if (r.phase === 'ground') {
      tapRacer(race, r, plan(race, r).side);
    } else if (r.phase === 'down') {
      r.botShake = (r.botShake || 0) + dt;
      if (r.botShake > 0.22) { r.botShake = 0; tapRacer(race, r, 1); }
    }
    return false;
  };

  // ---- the title-screen demo: four runners race on their own --------------------------------------------------------------
  const newAttract = () => {
    const race = newRace({ mode: 'race', level: 3, day: 0 }, attRng);
    const me = race.racers[race.you];
    me.player = false; me.skill = 0.84; me.ai = { wait: 0, side: 1, planned: false, hops: 0 };
    state.att = race; state.attFx.length = 0; state.attCam = -3.2;
  };
  const updateAttract = (dt) => {
    if (!state.att || state.att.over) {
      if (state.att && state.att.over) { state.att.endT = (state.att.endT || 0) + dt; if (state.att.endT < 1.2) { stepFx(state.attFx, dt); return; } }
      newAttract();
    }
    const race = state.att;
    stepRace(race, dt);
    handleEvents(race, state.attFx, false);
    stepFx(state.attFx, dt);
    const lead = Math.max(...race.racers.map((q) => q.x));
    state.attCam += ((lead - 1.7) - state.attCam) * Math.min(1, dt * 4);
  };

  // ---- hint ---------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const race = state.race;
    if (!race || race.over || state.paused || race.mode === 'watch' || !race.go) return;
    race.hintsUsed++;
    state.think = { t: 0, adv: advise(race) };
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRace = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.dec = null; state.rev++; };

  // ---- the play scene ----------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  const updatePlay = (dt, input) => {
    const race = state.race, ptr = input.pointer, keys = input.keys, watch = race.mode === 'watch';
    const L = layoutOf(state);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else { state.paused = !state.paused; } }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (ptr.pressed && !race.over) {
      if (watch) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRace(); return; }
      } else if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      else if (inRect(L.think, ptr.x, ptr.y)) requestThink();
      else if (inRect(L.stage, ptr.x, ptr.y)) doTap(ptr.x < L.stage.x + L.stage.w / 2 ? -1 : 1);
    }
    if (!watch && !race.over) {
      if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA') || keys.pressed.has('KeyZ')) doTap(-1);
      if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD') || keys.pressed.has('KeyX') || keys.pressed.has('Space')) doTap(1);
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    // time passes
    let frozen = false;
    if (watch) frozen = updateWatch(dt);
    if (state.think && !watch) {
      state.think.t += dt; state.think.adv = advise(race);
      if (state.think.t > THINK_SECS) state.think = null;
    }
    const ts = state.think && !watch ? SLOW : 1;
    if (!frozen && !race.over) {
      if (!race.go) {   // the whistle cues
        const c = race.count, k = c < 0.7 ? 0 : c < 1.4 ? 1 : 2;
        if (k !== state.lastCuePhase) { state.lastCuePhase = k; if (k < 2) sfx.set(); }
      }
      stepRace(race, dt * ts);
    }
    handleEvents(race, state.fx, true);
    // camera: your runner, a little ahead
    const me = race.racers[race.you];
    const target = me.x + 1.4 + me.v * 0.12;
    if (!frozen) state.camX += (target - state.camX) * Math.min(1, dt * 5);
    if (race.over) {
      state.overT += dt;
      if (state.overT > 2.2 || (ptr.pressed && state.overT > 1.0)) finishRace();
    }
    stepFx(state.fx, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
    if (state.tapFlash) { state.tapFlash.t += dt; if (state.tapFlash.t > 0.25) state.tapFlash = null; }
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'p-guide') { state.settings.guide = !state.settings.guide; save(); state.rev++; }
    else if (id === 'quit') leaveRace();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'race' || id === 'clock' || id === 'daily' || id === 'watch') startRace(id);
    else if (id === 'sacks') { state.collSel = null; state.scene = 'sacks'; state.ui.scroll = 0; state.collBack = 'title'; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = !st.guide;
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
    if (id === 'again') startRace(r ? r.mode : 'race');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sacks') { state.collBack = 'result'; state.collSel = null; state.scene = 'sacks'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { const n = r.time != null ? `${fmtTime(r.time)} seconds` : 'a race'; Promise.resolve(env.share?.(`I hopped ${LEN} metres in ${n} in Sack Race from Arcforge!`)).catch(() => {}); }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.rev++; save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.rev++; save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSacks = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'sacks');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          if (state.collSel === h.i && rec.owned[h.i]) { rec.sackSel = h.i; save(); sfx.win(); } else sfx.tick();
          state.collSel = h.i; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack || 'title'; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack || 'title'; state.ui.scroll = 0; state.rev++; }
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
  for (let i = 0; i < 60 * 4; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  // a good player: taps with the planner's side just as the feet land
  const botTap = () => {
    const race = state.race; if (!race || race.over || !race.go) return;
    const r = race.racers[race.you];
    if (r.phase === 'air' && AIR_T - r.pt <= 0.06 && !r.buf) tapRacer(race, r, plan(race, r).side);
    else if (r.phase === 'ground' || r.phase === 'down') tapRacer(race, r, plan(race, r).side);
  };
  const runTo = (pred, maxFrames = 60 * 60) => { for (let i = 0; i < maxFrames && !pred(state.race) && !state.race.over; i++) { botTap(); advance(1); } };
  const shotScene = (name) => {
    const rec = state.record;
    rec.owned = [true, true, true, true, false, true]; rec.best = 17.84; rec.bestDaily = 19.2; rec.dailyDay = state.day; rec.races = 40; rec.wins = 12; rec.heat = 2; rec.maxWon = 1; rec.sackSel = 1;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(150); return; }
    if (name === 'race' || name === 'crowd' || name === 'ruts') {
      startRace('race'); state.toastT = 0;
      const want = name === 'ruts' ? 17.5 : name === 'crowd' ? 31 : 24;
      runTo((rc) => rc.go && rc.racers[rc.you].x > want, 60 * 70);
      state.toastT = 0; state.paused = true;
      return;
    }
    if (name === 'start') { startRace('race'); state.toastT = 0; advance(40); state.paused = true; return; }
    if (name === 'fall') {
      startRace('race'); state.toastT = 0;
      runTo((rc) => rc.go && rc.racers[rc.you].x > 10, 60 * 30);
      const me = state.race.racers[state.race.you];
      for (let i = 0; i < 60 * 8 && me.phase !== 'down'; i++) { if (me.phase === 'air' && !me.buf) tapRacer(state.race, me, 1); else if (me.phase === 'ground') tapRacer(state.race, me, 1); advance(1); }
      advance(14); state.paused = true; return;
    }
    if (name === 'clock') {
      state.record.ghost = { dt: 0.1, xs: Array.from({ length: 220 }, (_, i) => i * 0.1 * 2.6) };
      startRace('clock'); state.toastT = 0;
      runTo((rc) => rc.go && rc.racers[rc.you].x > 14, 60 * 40);
      state.toastT = 0; state.paused = true; return;
    }
    if (name === 'watch') {
      state.settings.thinkIdx = 1;
      startRace('watch'); state.toastT = 0;
      for (let i = 0; i < 60 * 70 && !(state.dec && state.dec.phase === 'think' && state.dec.t > 1.0); i++) advance(1);
      state.paused = true;
      return;
    }
    if (name === 'sacks') { state.scene = 'sacks'; state.collBack = 'title'; state.collSel = 3; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      startRace('race'); state.toastT = 0;
      for (let i = 0; i < 60 * 90 && state.scene === 'play'; i++) { botTap(); advance(1); }
      advance(3); return;
    }
    if (name === 'pause') {
      startRace('race'); state.toastT = 0;
      runTo((rc) => rc.go && rc.racers[rc.you].x > 8, 60 * 20);
      openPause(); advance(2); return;
    }
  };

  const api = {
    // Watch & Learn, the sack styles and every menu are free; only real racing counts against the free preview (a paused race and the countdown do not).
    isPreviewExempt: () => !(state.scene === 'play' && state.race && state.race.mode !== 'watch' && !state.race.over) || state.paused || !state.race.go,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'sacks'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'sacks': updateSacks(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      syncSize();
      // the 3D layer (web/view3d) draws the field behind this transparent canvas: clear it first, then only HUD and menus are painted
      glState.gl = view && view.gl && view.gl.on ? view.gl : null;
      if (view && view.gl && view.gl.licenses) glState.lic = view.gl.licenses;
      if (view && view.gl) ctx.clearRect(0, 0, meta.width, meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'sacks': renderSacks(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.race) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  void host; void placeNow;
  return api;
}
