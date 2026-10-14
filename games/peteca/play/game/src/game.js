// Peteca: state and flow. The court, the strokes, the rival AI and scoring live in sim.js; drawing in view.js, art.js, figure.js and
// menus.js. This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, setup, play (match, rally, watch), result, collection, settings, howto/about/rules, demolimit.
import {
  newRun, stepRun, humanStrike, advise, predictAt, ready, padShots, SHOTS, TO_CHOICES, humanIdx, clamp, RIVALS, Z_MAX, strikeWindow,
} from './sim.js';
import { stepFx, resetArt } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, host } from './layout.js';
import { renderPlay, layoutOf, resetCam } from './view.js';
import { hooks as figureHooks } from './figure.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, courtOwned, petecaOwned,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { COURTS, PETECAS } from './art.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 5;
const SLOW = 0.35;       // time scale while a Think hint is showing
const THINK_SECS = 2.5;  // how long a Think hint lasts
const WATCH_TO = 5, WATCH_LEVEL = 3;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), aiRng = rng.fork(), strikeRng = rng.fork(), attRng = rng.fork(), runRng = rng.fork(), watchRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, gauge: true, textIdx: 0, thinkIdx: 1, match: { format: 'singles', level: 2, to: 11 } },
    record: { wins: 0, matches: 0, perfects: 0, strikes: 0, bestStreak: 0, bestPoints: 0, courtSel: 0, petecaSel: 0, demoRuns: 0, seenTip: false },
    run: null, att: null, attFx: [], attCam: 6, attCamTarget: 6, fx: [], pops: [], banner: null, toast: '', toastT: 0, trail: [], land: null,
    think: null, dec: null, aim: [0.55, 0.55, 0.55, 0.55], overT: 0, last: null, collSel: null, collBack: 'title', restoreMsg: '', restoreBusy: false, owned: !!monetization.owns?.('unlock_game'),
    ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, tick: 0,
  };
  syncSize();
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); state.rev++; });

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) { Object.assign(state.settings, s); state.settings.match = { format: 'singles', level: 2, to: 11, ...(s.match || {}) }; }
    if (r) Object.assign(state.record, r);
    const st = state.settings, rec = state.record;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.match.level = clamp(st.match.level | 0, 1, 5);
    if (!TO_CHOICES.includes(st.match.to)) st.match.to = 11;
    if (st.match.format !== 'doubles') st.match.format = 'singles';
    if (!courtOwned(rec, rec.courtSel)) rec.courtSel = 0;
    if (!petecaOwned(rec, rec.petecaSel)) rec.petecaSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!st.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    palm: (shot, q = 0.7) => {
      const heavy = shot === 'smash' ? 1.5 : shot === 'drop' ? 0.7 : 1;
      tone({ freq: 150 + fxRng.next() * 20, to: 55, dur: 0.11, type: 'sine', vol: 0.15 * heavy });
      tone({ freq: 2100 + fxRng.next() * 500 + q * 400, to: 900, dur: 0.045, type: 'triangle', vol: 0.06 });
      tone({ freq: 3400, to: 2200, dur: 0.03, type: 'square', vol: 0.012 });
    },
    whoosh: () => tone({ freq: 500, to: 180, dur: 0.14, type: 'sawtooth', vol: 0.02 }),
    perfect: () => { tone({ freq: 880, dur: 0.12, type: 'sine', vol: 0.09 }); tone({ freq: 1320, dur: 0.2, type: 'sine', vol: 0.07 }); },
    power: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    net: () => { tone({ freq: 210, to: 90, dur: 0.18, type: 'sawtooth', vol: 0.07 }); tone({ freq: 1400, to: 900, dur: 0.08, type: 'square', vol: 0.02 }); },
    sand: () => tone({ freq: 160, to: 70, dur: 0.16, type: 'triangle', vol: 0.09 }),
    point: (mine) => (mine ? [0, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.2 + i * 0.05, type: 'triangle', vol: 0.09 })) : [0, -3, -7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.07 }))),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 230, to: 140, dur: 0.14, type: 'sawtooth', vol: 0.04 }),
    win: () => [0, 2, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.4) => { state.toast = text; state.toastT = secs; };

  // ---- effects --------------------------------------------------------------------------------------------------
  const MAX_FX = 80;
  const add = (list, q) => { if (list.length < MAX_FX) list.push(q); };
  const dust = (list, x, z, n = 6, s = 1) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI, v = 0.3 + fxRng.next() * 0.9 * s; add(list, { kind: 0, x, z: Math.max(0.03, z), vx: Math.cos(a) * v * 1.2, vz: Math.sin(a) * v * 0.7, t: 0, max: 0.45 + fxRng.next() * 0.35, size: 0.06 + fxRng.next() * 0.06 }); }
  };
  const sparks = (list, x, z, n = 8, cols = ['#fff3b0', '#ffd24a', '#ffffff']) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU, v = 1 + fxRng.next() * 2.2; add(list, { kind: 1, x, z, vx: Math.cos(a) * v, vz: Math.sin(a) * v + 0.8, t: 0, max: 0.4 + fxRng.next() * 0.4, size: 0.035 + fxRng.next() * 0.03, col: cols[i % cols.length] }); }
  };
  const ringFx = (list, x, z, col = '#fff3b0', size = 0.9) => add(list, { kind: 2, x, z, vx: 0, vz: 0, t: 0, max: 0.5, size, col });
  const featherBurst = (list, x, z, n, cols) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU, v = 0.4 + fxRng.next() * 1.3; add(list, { kind: 3, x, z, vx: Math.cos(a) * v, vz: 0.6 + fxRng.next(), t: 0, max: 1.1 + fxRng.next() * 0.7, size: 0.1, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 8 }); }
  };
  const confetti = (list, x, z, n) => {
    const cols = ['#e5503a', '#f6cf55', '#24b3a4', '#2f56d8', '#fbfaf1'];
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU, v = 1 + fxRng.next() * 2; add(list, { kind: 4, x, z, vx: Math.cos(a) * v, vz: 1.5 + fxRng.next() * 2.5, t: 0, max: 0.9 + fxRng.next() * 0.7, size: 0.045 + fxRng.next() * 0.04, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 14 }); }
  };
  const TAU = Math.PI * 2;
  const pop = (text, x, z, col = '#fff3b0', size = 30, max = 0.9) => { if (state.pops.length < 8) state.pops.push({ text, x, z, col, size, t: 0, max }); };
  const banner = (text, sub, col) => { state.banner = { text, sub, col, t: 0, max: 1.6 }; };
  const petecaCols = () => { const d = PETECAS[state.record.petecaSel]; return d.mix ? d.mix : [d.f[0], d.f[1], d.tip]; };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const startRun = (mode) => {
    if (state.demo && mode !== 'watch' && state.record.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const m = state.settings.match;
    const cfg = mode === 'watch' ? { mode, format: 'singles', level: WATCH_LEVEL, to: WATCH_TO, court: state.record.courtSel }
      : mode === 'rally' ? { mode, court: state.record.courtSel, level: 3 }
      : { mode, format: m.format, level: state.demo ? Math.min(3, m.level) : m.level, to: m.to, court: state.demo ? 0 : state.record.courtSel };
    const run = newRun({ ...cfg, firstServer: mode === 'rally' ? 0 : 0 }, runRng);
    state.run = run; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.think = null; state.dec = null; state.land = null; state.trail.length = 0;
    state.fx.length = 0; state.pops.length = 0; state.banner = null; state.overT = 0; state.last = null; state.ui.scroll = 0; state.hold = 0.6;
    resetCam();
    if (state.demo && mode !== 'watch') { state.record.demoRuns++; save(); }
    toast(mode === 'rally' ? 'Beach Rally: keep it flying together' : mode === 'watch' ? 'Watch & Learn: the game stops to think before each of your strokes' : 'Tap a pad as the peteca falls to the glowing height. Left of the pad is short, right is deep.', 3.4);
  };

  const doStrike = (k, depth) => {
    const run = state.run;
    if (!run || run.over || state.paused || state.hold > 0 || run.lock > 0 || run.mode === 'watch') return false;
    const shot = padShots(run)[k];
    state.aim[k] = depth;
    const res = humanStrike(run, shot, depth, strikeRng);
    if (res.ok) { if (state.think) state.think = null; return true; }
    const why = res.why;
    if (why === 'idle' || why === 'serving') return false;
    run.lock = 0.3;
    const pi = humanIdx(run), p = run.players[pi];
    if (p && why !== 'notyours') p.anim = { t: 0, kind: 'whiff', shot, cx: p.x + 0.55, cz: 1.3, dir: p.dir };
    sfx.no();
    const pl = p ? p.x : 0;
    if (why === 'notyours') toast('Your partner has this one.', 1.2);
    else if (why === 'high' || why === 'rising') pop('Wait for it', pl, 2.0, '#ffd9b0', 24, 0.7);
    else if (why === 'low') pop('Too late', pl, 1.9, '#ffd9b0', 24, 0.7);
    else if (why === 'far') pop('Out of reach', pl, 1.9, '#ffd9b0', 24, 0.8);
    else if (why === 'shot') pop(`${SHOTS[shot].name} needs a higher peteca`, pl, 2.1, '#ffd9b0', 22, 0.9);
    else if (why === 'net') pop('Let it come over', pl, 2.0, '#ffd9b0', 24, 0.7);
    return false;
  };

  const GRADE = { perfect: 'Perfect', good: 'Good', early: 'Early', late: 'Late' };
  const handleEvents = (run, list, live) => {
    for (const e of run.events) {
      if (e.seq < run.evDone) continue;
      run.evDone = e.seq + 1;
      if (e.type === 'strike') {
        const human = !!e.human;
        const pl = run.players[e.who];
        dust(list, pl.x, 0.05, human ? 5 : 3, 0.8);
        if (e.perfect) { sparks(list, e.x, e.z, human ? 10 : 5); ringFx(list, e.x, e.z, human ? '#fff3b0' : '#ffd0a0'); }
        if (e.power) { featherBurst(list, e.x, e.z, 8, petecaCols()); ringFx(list, e.x, e.z, '#ff9b2b', 1.4); }
        if (live) {
          sfx.palm(e.shot, e.q);
          if (e.perfect && human) sfx.perfect();
          if (e.spin) sfx.whoosh();
          if (human) {
            const nm = SHOTS[e.shot].name;
            const g = GRADE[e.grade];
            pop(e.perfect ? `Perfect ${nm}!` : `${g} ${nm}`, e.x, e.z + 0.6, e.perfect ? '#ffe36a' : e.grade === 'good' ? '#fff6e0' : '#ffd0b0', e.perfect ? 34 : 28);
            if (e.gain) pop(`+${e.gain}${e.mult > 1 ? ` x${e.mult}` : ''}`, e.x, e.z + 1.15, '#9be8b0', 24, 0.9);
            if (e.power) { banner('Power Palm!', SHOTS[e.shot].name, '#ff7a2b'); }
            if (e.landX !== undefined) state.land = { x: e.landX, t: 0, col: e.perfect ? '#fff3a0' : '#ffffff' };
          } else if (run.mode !== 'rally' || e.team === 1) {
            if (e.landX !== undefined && e.team === 1) state.land = { x: e.landX, t: 0, col: '#ffc9a0' };
            if (e.spin && e.shot === 'smash') pop('Smash!', e.x, e.z + 0.6, '#ffd0b0', 26, 0.7);
          }
          if (run.mode === 'rally' && run.streak > 0 && run.streak % 10 === 0 && human) { banner(`${run.streak}!`, 'strikes without a drop', '#7fe0c8'); confetti(list, e.x, e.z + 0.5, 14); sfx.power(); }
        }
        state.trail.length = 0;
      } else if (e.type === 'net') {
        sparks(list, e.x, e.z, 6, ['#ffffff', '#dcefff']);
        if (live) { sfx.net(); pop('Net!', e.x, Math.max(1, e.z + 0.5), '#ffd0b0', 30, 0.9); }
      } else if (e.type === 'floor') {
        dust(list, e.x, 0.05, 9, 1.2);
        if (live) sfx.sand();
        if (!state.run || run === state.run) featherBurst(list, e.x, 0.12, 4, petecaCols());
      } else if (e.type === 'point') {
        if (live) { sfx.point(e.winner === 0); if (e.kind === 'out') pop('Out!', e.x, 1.3, '#ffd0b0', 32, 1.0); }
      } else if (e.type === 'drop') {
        if (live) sfx.sand();
      } else if (e.type === 'power') {
        if (live) { sfx.power(); toast('Power Palm ready: your next Smash or Drive is struck harder', 2.4); }
      } else if (e.type === 'game') {
        if (live) { sfx.win(); confetti(list, 6, 3, 24); }
      }
    }
  };

  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode, st = run.stats;
    const r = {
      mode, strikes: st.strikes, perfects: st.perfects, longest: run.longest, winners: st.winners, aces: st.aces, hints: run.hints, newBest: false, unlocks: [],
      streak: run.streak, points: run.points, score: [...run.score], win: !!(run.over && run.over.winner === 0), why: run.pointWhy,
    };
    if (mode !== 'watch') {
      const had = { c1: courtOwned(rec, 1), c2: courtOwned(rec, 2), p1: petecaOwned(rec, 1), p2: petecaOwned(rec, 2), p3: petecaOwned(rec, 3) };
      if (mode === 'match') { rec.matches++; if (r.win) rec.wins++; }
      rec.perfects += st.perfects; rec.strikes += st.strikes;
      if (mode === 'rally' && !run.hints) {
        if (run.streak > rec.bestStreak) { rec.bestStreak = run.streak; r.newBest = run.streak > 0; }
        if (run.points > rec.bestPoints) rec.bestPoints = run.points;
      }
      if (!had.c1 && courtOwned(rec, 1)) r.unlocks.push(COURTS[1].name);
      if (!had.c2 && courtOwned(rec, 2)) r.unlocks.push(COURTS[2].name);
      if (!had.p1 && petecaOwned(rec, 1)) r.unlocks.push(`${PETECAS[1].name} peteca`);
      if (!had.p2 && petecaOwned(rec, 2)) r.unlocks.push(`${PETECAS[2].name} peteca`);
      if (!had.p3 && petecaOwned(rec, 3)) r.unlocks.push(`${PETECAS[3].name} peteca`);
      if (r.unlocks.length || r.newBest || r.win) sfx.win();
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.rev++;
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT ---------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  const updateWatch = (dt) => {
    const run = state.run;
    if (state.paused || run.over) return true;      // frozen
    let dec = state.dec;
    const b = run.ball;
    if (dec && (!b.alive || run.recv !== 0 || run.phase === 'point')) { state.dec = null; state.think = null; dec = null; }
    if (!dec && run.recv === 0 && b.alive && b.vz < 0 && b.z < 3.2 && run.phase !== 'point' && !run.players[0].missed && ballNear(run)) {
      const adv = advise(run, 0);
      dec = state.dec = { active: true, phase: 'think', t: 0, dur: watchThink(), adv, zHit: SHOTS[adv.shot].zi + (watchRng.next() - 0.5) * 0.12 };
      state.think = { adv, t: 0 };
    }
    if (dec && dec.phase === 'think') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; } return true; }
    if (dec && dec.phase === 'reveal') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; } return true; }
    return false;
  };
  // the peteca is falling towards your palm: within a second of the best contact height
  const ballNear = (run) => { const pr = predictAt(run.ball, run.wind, 1.3); return pr.t < 1.2 && Math.abs(pr.x - run.players[0].x) < 4.5; };
  const watchAct = () => {
    const run = state.run, dec = state.dec, b = run.ball;
    if (!dec || dec.phase !== 'go') return;
    const w = strikeWindow(run, 0);
    if (b.vz < 0 && b.z <= dec.zHit && w.ok) {
      humanStrike(run, dec.adv.shot, dec.adv.depth, strikeRng, 0);
      state.dec = null; state.think = null;
    } else if (b.z < 0.3) { state.dec = null; state.think = null; }
  };

  // ---- the title-screen demo: four friends rallying on their own -----------------------------------------------------
  const newAttract = () => { state.att = newRun({ mode: 'match', format: 'singles', level: 2, to: 11, attract: true, court: state.record.courtSel, firstServer: attRng.next() < 0.5 ? 0 : 1 }, attRng); };
  const updateAttract = (dt) => {
    if (!state.att || state.att.over || state.att.score[0] + state.att.score[1] >= 6) { newAttract(); }
    const run = state.att;
    stepRun(run, dt, attRng);
    handleEvents(run, state.attFx, false);
    stepFx(state.attFx, dt);
    // smooth, presentation-only camera follow
    const target = run.ball.alive ? run.ball.x : 6;
    state.attCam += (target - state.attCam) * Math.min(1, dt * 2.4);
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || run.over || state.paused || run.mode === 'watch') return;
    run.hints++;
    state.think = { t: 0, adv: advise(run) };
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.dec = null; state.rev++; };

  // ---- the play scene --------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  const padDepth = (r, x) => clamp((x - (r.x + r.w * 0.14)) / (r.w * 0.72), 0, 1);
  const updatePlay = (dt, input) => {
    const run = state.run, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch';
    const L = layoutOf(state);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else { state.paused = !state.paused; } }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (ptr.pressed && !run.over) {
      if (watch) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
      } else if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      else if (inRect(L.think, ptr.x, ptr.y)) requestThink();
      else {
        let hit = -1;
        L.pads.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) hit = k; });
        if (hit >= 0) doStrike(hit, padDepth(L.pads[hit], ptr.x));
      }
    }
    if (!watch && !run.over) {
      const kk = [['Digit1', 'KeyZ'], ['Digit2', 'KeyX'], ['Digit3', 'KeyC'], ['Digit4', 'KeyV']];
      kk.forEach((codes, k) => { if (codes.some((c) => keys.pressed.has(c))) doStrike(k, state.aim[k]); });
      if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA')) state.aim = state.aim.map((v) => clamp(v - 0.15, 0, 1));
      if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD')) state.aim = state.aim.map((v) => clamp(v + 0.15, 0, 1));
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    // time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    let frozen = false;
    if (watch) frozen = updateWatch(dt);
    if (state.think && !watch) { state.think.t += dt; if (state.think.t > THINK_SECS) state.think = null; }
    const ts = state.think && !watch ? SLOW : 1;
    if (!frozen && state.hold <= 0) {
      if (watch) watchAct();
      stepRun(run, dt * ts, aiRng);
      if (!run.ball.held && run.ball.alive && (state.tick++ & 1) === 0) { state.trail.push({ x: run.ball.x, z: run.ball.z, spin: !!run.ball.spin }); if (state.trail.length > 14) state.trail.shift(); }
    }
    handleEvents(run, state.fx, true);
    if (run.phase === 'over') {
      state.overT += dt;
      if (state.overT > 2.2 || (ptr.pressed && state.overT > 1.0)) finishRun();
    }
    stepFx(state.fx, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.land) { state.land.t += dt; if (state.land.t > 1.3) state.land = null; }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'p-gauge') { state.settings.gauge = !state.settings.gauge; save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'match') startRun('match');
    else if (id === 'rally') startRun('rally');
    else if (id === 'watch') startRun('watch');
    else if (id === 'setup') { state.scene = 'setup'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'collection') { state.collBack = 'title'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const m = state.settings.match, rec = state.record;
    sfx.tick();
    if (id === 'fmt-singles') m.format = 'singles';
    else if (id === 'fmt-doubles') m.format = 'doubles';
    else if (id === 'lvl-dec') m.level = Math.max(1, m.level - 1);
    else if (id === 'lvl-inc') m.level = Math.min(state.demo ? 3 : 5, m.level + 1);
    else if (id === 'to-7') m.to = 7;
    else if (id === 'to-11') m.to = 11;
    else if (id === 'court-prev' || id === 'court-next') {
      const dir = id === 'court-next' ? 1 : -1;
      for (let k = 1; k <= COURTS.length; k++) { const i = (rec.courtSel + dir * k + COURTS.length * 3) % COURTS.length; if (courtOwned(rec, i) && !(state.demo && i > 0)) { rec.courtSel = i; resetArt(); break; } }
      if (state.demo) toast('More courts in the full game', 1.6);
    } else if (id === 'start') { save(); state.rev++; startRun('match'); return; }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    state.rev++; save();
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-gauge') st.gauge = !st.gauge;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy || monetization.owns('unlock_game')) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreBusy = false; state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found for this account.'; state.rev++; }).catch(() => { state.restoreBusy = false; state.restoreMsg = 'Could not reach the store. Please try again.'; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'match');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'collection') { state.collBack = 'result'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) {
      const txt = r.mode === 'rally' ? `I kept the peteca flying for ${r.streak} strikes in Peteca from Arcforge!` : `I ${r.win ? 'won' : 'played'} a peteca match ${r.score[0]}-${r.score[1]} in Peteca from Arcforge!`;
      Promise.resolve(env.share?.(txt)).catch(() => {});
    }
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
  const updateCollection = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'collection');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          const same = state.collSel && state.collSel.kind === h.kind && state.collSel.i === h.i;
          if (h.kind === 'p') { if (same && petecaOwned(rec, h.i)) { rec.petecaSel = h.i; save(); sfx.win(); } else sfx.tick(); }
          else if (same && courtOwned(rec, h.i) && !(state.demo && h.i > 0)) { rec.courtSel = h.i; save(); resetArt(); sfx.win(); } else sfx.tick();
          state.collSel = { kind: h.kind, i: h.i }; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
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
  for (let i = 0; i < 60 * 2; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  // a scripted player for screenshots and attract: strikes the advised stroke at its height
  const botStrike = () => {
    const run = state.run;
    if (!run || run.over || run.recv < 0 || !run.players[run.recv].human) return;
    if (!ready(run)) return;
    const adv = advise(run), want = SHOTS[adv.shot].zi;
    if (run.ball.z <= want + 0.04) { const pads = padShots(run); const k = pads.indexOf(adv.shot); if (k >= 0) { run.lock = 0; state.hold = 0; doStrike(k, adv.depth); } }
  };
  const shotScene = (name) => {
    const rec = state.record;
    rec.wins = 5; rec.matches = 9; rec.perfects = 120; rec.bestStreak = 31; rec.bestPoints = 960; rec.petecaSel = 1; rec.courtSel = 0;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(150); return; }
    if (name === 'match' || name === 'smash' || name === 'doubles') {
      state.settings.match = { format: name === 'doubles' ? 'doubles' : 'singles', level: 3, to: 11 };
      startRun('match'); state.toastT = 0; state.hold = 0;
      const goal = name === 'smash' ? 3 : 2;
      let n = 0;
      for (let i = 0; i < 60 * 120 && n < 2000; i++, n++) {
        botStrike(); advance(1);
        const run = state.run;
        if (name === 'smash' && run.players[0].anim && run.players[0].anim.shot === 'smash' && run.players[0].anim.t > 0.02) { advance(2); return; }
        if (run.rally >= goal + 4 && run.ball.alive && run.ball.z > 1.5) break;
      }
      state.toastT = 0;
      return;
    }
    if (name === 'rally') {
      startRun('rally'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 240 && state.run.streak < 14 && !state.run.over; i++) { botStrike(); advance(1); }
      for (let i = 0; i < 60 * 3 && !(state.run.ball.alive && state.run.ball.vz < 0 && state.run.ball.z < 2.4); i++) advance(1);
      state.toastT = 0; return;
    }
    if (name === 'watch') {
      state.settings.thinkIdx = 1;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 70 && !(state.dec && state.dec.phase === 'think' && state.dec.t > 1.2); i++) advance(1);
      return;
    }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 'p', i: 1 }; state.rev++; advance(2); return; }
    if (name === 'setup') { state.scene = 'setup'; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.settings.match = { format: 'singles', level: 2, to: 7 };
      startRun('match'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 400 && state.scene === 'play'; i++) { botStrike(); advance(1); }
      advance(3); return;
    }
    if (name === 'pause') {
      startRun('match'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 40 && state.run.rally < 3 && !state.run.over; i++) { botStrike(); advance(1); }
      openPause(); advance(2); return;
    }
  };

  const api = {
    // Watch & Learn, the Collection and every menu are free; only real play counts against the free preview (a paused game does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch' && !state.run.over) || state.paused || state.hold > 0,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit', 'collection'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateFlowScene(dt, input, handleSetup, 'setup'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'collection': updateCollection(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      ctx.clearRect(0, 0, meta.width, meta.height);          // transparent: the 3D layer (when present) shows through
      if (figureHooks.beginFrame) figureHooks.beginFrame();
      switch (state.scene) {
        case 'title': meta.previewBadge = null; renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'collection': renderCollection(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) {
            renderPlay(ctx, state);
            // keep the free-preview pill clear of the score HUD: in portrait it sits just under the status strip
            const L = layoutOf(state); meta.previewBadge = L.land ? null : { x: meta.width / 2, y: L.stat.y + L.stat.h + 6, align: 'center' };
          }
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  void host; void RIVALS; void Z_MAX; void renderPlay;
  return api;
}
