// GAME CONTRACT (docs/GAME-CONTRACT.md): exports meta and createGame(env) -> { update, render, getState }.
// This file owns state and flow (scenes, input, tricks, runs, saving). Rules and scoring live in rules.js, everything drawn in
// view.js / art.js. `state` is plain JSON: closures hold nothing that matters.
import { W, H, inRect, layoutFor, creditHit, live } from './layout.js';
import {
  levelInfo, newEvent, newTrick, pressAt, releaseAt, expire, trickOver, trickAccuracy, starsFor, nextNote, trickInfo, newRun, sizeOfHold,
  flightTime, judgeThrow, idealRelease, finishPart, planTrick, planRun,
} from './rules.js';
import { screenButtons, screenLayout, readerMax, TEXT_SCALES, AP_THINK_STEPS } from './ui.js';
import { render as draw } from './view.js';

export const wheelInput = { dy: 0 };
export const meta = { width: W, height: H, fluid: { short: 720 } };

const DEMO_EVENTS = 1;
const AP_REVEAL = 2;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const fx = rng.fork(); // visual randomness never shifts the event's stream
  const lay = () => { live.w = meta.width; live.h = meta.height; return layoutFor(meta.width, meta.height); };

  const state = {
    scene: 'title', t: 0, demo: !!config.demo, demoEvents: 0,
    prefs: { sound: true, calm: false, guide: true, textScaleIdx: 0, apThinkIdx: 1 },
    setup: { level: 'charro', len: 5 },
    stats: { played: 0, won: 0, stars: 0 },
    menuOpen: false, howPage: 0, aboutPage: 0, rulesPage: 0, refFrom: 'title', scroll: 0, press: null, jump: null,
    m: null, ph: 'intro', wait: 0, msg: '', tr: null, tc: 0, run: null, rc: 0, hold: null, loops: [], caught: null, coil: 0, res: null,
    kbDown: false, hintT: 0, hintRun: false, canHint: false, ap: { paused: false }, apPlan: null, apIdx: [0, 0], apTime: 5, apHold: false,
    spin: 0.2, flash: 0, shake: 0, combo: 0, mult: 1, last: null, beatN: -1, runPress: false,
    parts: [], pops: [], sfx: [], over: null, showcase: false,
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  state.owned = !!monetization?.owns?.('unlock_game');
  monetization?.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });

  // ---- storage -----------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (v) {
      Object.assign(state.prefs, v);
      state.prefs.textScaleIdx = clampN(state.prefs.textScaleIdx ?? 0, 0, TEXT_SCALES.length - 1);
      state.prefs.apThinkIdx = clampN(state.prefs.apThinkIdx ?? 1, 0, AP_THINK_STEPS.length - 1);
      audio.setMuted(!state.prefs.sound);
    }
  });
  storage.get('stats', null).then((v) => { if (v) Object.assign(state.stats, v); });
  storage.get('setup', null).then((v) => { if (v && state.scene === 'title') Object.assign(state.setup, v); });
  storage.get('demoEvents', 0).then((v) => { state.demoEvents = Math.max(state.demoEvents, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); audio.setMuted(!state.prefs.sound); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.won }); };

  // ---- sound (all synthesized; delayed tones are scheduled in update so it stays deterministic) --------------------------------
  const isAuto = () => state.scene === 'autoplay' || state.scene === 'autoplay-over';
  // Auto Play is silent by design regardless of the player's sound setting: never surprise a viewer with sound from a demo.
  const tone = (o, delay = 0) => { if (!state.prefs.sound) return; if (delay > 0) state.sfx.push({ t: delay, o }); else audio.tone(o); };
  const PENT = [392, 440, 523, 587, 659, 784];
  const sounds = {
    ui: () => tone({ freq: 520, to: 700, dur: 0.06, type: 'sine', vol: 0.07 }),
    tick: (strong) => tone({ freq: strong ? 880 : 660, dur: 0.035, type: 'square', vol: 0.025 }),
    hit: (perfect, n) => { const f = PENT[n % PENT.length]; tone({ freq: f * (perfect ? 2 : 1), dur: 0.16, type: 'triangle', vol: 0.09 }); if (perfect) tone({ freq: f * 3, dur: 0.1, type: 'sine', vol: 0.04 }, 0.02); },
    stray: () => tone({ freq: 180, to: 140, dur: 0.07, type: 'triangle', vol: 0.05 }),
    miss: () => tone({ freq: 240, to: 150, dur: 0.14, type: 'triangle', vol: 0.07 }),
    whirl: (u) => tone({ freq: 150 + 500 * u, to: 220 + 520 * u, dur: 0.1, type: 'sawtooth', vol: 0.018 }),
    throw: () => tone({ freq: 200, to: 900, dur: 0.22, type: 'sawtooth', vol: 0.045 }),
    catch: (g) => { tone({ freq: 110, to: 70, dur: 0.2, type: 'triangle', vol: 0.13 }); [523, 659, 784].slice(0, g === 'clean' ? 3 : 2).forEach((f, k) => tone({ freq: f, dur: 0.22, type: 'sawtooth', vol: 0.05 }, 0.12 + k * 0.1)); },
    fall: () => tone({ freq: 300, to: 90, dur: 0.3, type: 'triangle', vol: 0.07 }),
    fanfare: () => [523, 659, 784, 1046, 1318].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'sawtooth', vol: 0.06 }, k * 0.13 + 0.001)),
  };

  // ---- effects (scene-normalised coordinates: x, y in 0..1 of the arena rectangle) -------------------------------------------------
  const SPARK = ['#ffd24a', '#ff7a3c', '#f2495c', '#35c2a8', '#fff3c2'];
  function burst(x, y, n = 12, speed = 0.5, cols = SPARK) {
    if (state.prefs.calm) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = fx.next() * Math.PI * 2, sp = speed * (0.3 + fx.next() * 0.8);
      state.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.25, life: 0.5 + fx.next() * 0.6, max: 1, col: cols[k % cols.length], sz: 3 + fx.next() * 4 });
    }
  }
  const pop = (x, y, text, color = '#fff3c2') => { state.pops.push({ x, y, text, color, t: 0 }); };

  // ---- helpers ---------------------------------------------------------------------------------------------------------------------
  const say = (text) => { state.msg = text; };
  const inPlay = () => state.scene === 'play' || state.scene === 'autoplay';
  const go = (scene) => { state.scene = scene; state.scroll = 0; state.menuOpen = false; };
  const think = () => AP_THINK_STEPS[state.prefs.apThinkIdx ?? 1];
  const part = () => (state.m ? state.m.plan[state.m.step] : null);
  const partNo = () => {
    const m = state.m, p = m && m.plan[m.step]; if (!p) return { n: 0, of: 0 };
    return { n: m.plan.slice(0, m.step + 1).filter((q) => q.kind === p.kind).length, of: m.plan.filter((q) => q.kind === p.kind).length };
  };

  // ---- starting things ---------------------------------------------------------------------------------------------------------------
  function resetView() {
    state.menuOpen = false; state.tr = null; state.run = null; state.hold = null; state.loops = []; state.caught = null; state.coil = 0; state.res = null;
    state.parts = []; state.pops = []; state.sfx = []; state.over = null; state.ap = { paused: false }; state.apPlan = null; state.kbDown = false;
    state.hintT = 0; state.hintRun = false; state.combo = 0; state.mult = 1; state.last = null; state.spin = 0.2; state.flash = 0; state.shake = 0; state.beatN = -1;
  }
  function startEvent() {
    if (state.demo && state.demoEvents >= DEMO_EVENTS) { go('demo-limit'); return; }
    if (state.demo) { state.demoEvents++; storage.set('demoEvents', state.demoEvents); }
    const s = state.setup; storage.set('setup', s);
    state.m = newEvent({ level: s.level, len: s.len, rng });
    go('play'); resetView(); beginPart();
  }
  function startAutoPlay() {
    state.m = newEvent({ level: 'charro', len: 3, rng });
    go('autoplay'); resetView(); beginPart();
  }
  function beginPart() {
    const m = state.m, p = part(), auto = state.scene === 'autoplay', lv = levelInfo(m.level);
    state.res = null; state.caught = null; state.loops = []; state.hold = null; state.coil = 0; state.hintT = 0; state.hintRun = false;
    state.combo = 0; state.mult = 1; state.last = null; state.apPlan = null; state.apIdx = [0, 0]; state.apHold = false; state.beatN = -1;
    const pn = partNo();
    if (p.kind === 'trick') {
      const info = trickInfo(p.id);
      state.tr = newTrick(p.id, m.level); state.tc = 0; state.run = null;
      if (auto) {
        state.apPlan = planTrick(state.tr, lv.skill, rng);
        state.ph = 'apthink'; state.wait = state.apTime = think(); state.canHint = false;
        say(`Trick ${pn.n} of ${pn.of}: ${info.name} (${info.en}). Reading the beat.`);
      } else {
        state.ph = 'intro'; state.wait = state.prefs.calm ? 1.0 : 1.6; state.canHint = true;
        say(`Trick ${pn.n} of ${pn.of}: ${info.name} (${info.en}). Tap each knot as it reaches the line.`);
      }
    } else {
      state.run = newRun(m.level, rng); state.rc = 0; state.tr = null;
      if (auto) {
        state.apPlan = planRun(state.run, lv.skill, rng);
        state.ph = 'apthink'; state.wait = state.apTime = think(); state.canHint = false;
        say(`Target run ${pn.n} of ${pn.of}: working out the lead for the loop.`);
      } else {
        state.ph = 'intro'; state.wait = state.prefs.calm ? 1.0 : 1.5; state.canHint = true;
        say(`Target run ${pn.n} of ${pn.of}: hold to swing the loop, let go to throw it at the post.`);
      }
    }
  }

  // ---- tricks ------------------------------------------------------------------------------------------------------------------------
  function onGrade(r) {
    if (!r) return;
    const tr = state.tr;
    state.combo = tr.combo; state.mult = 1 + Math.min(3, Math.floor(tr.combo / 4));
    if (r.stray) { sounds.stray(); state.last = { g: 'stray', t: 0 }; return; }
    if (r.grade === 'miss') { sounds.miss(); pop(0.36, 0.3, 'Miss', '#ff9a8a'); state.last = { g: 'miss', t: 0 }; state.shake = 0.2; return; }
    if (r.grade === 'late') { sounds.miss(); pop(0.36, 0.3, 'Let go on the mark', '#ffd2a0'); state.last = { g: 'late', t: 0 }; return; }
    const perfect = r.grade === 'perfect';
    sounds.hit(perfect, tr.hits);
    state.spin = Math.min(1, state.spin + 0.25); state.flash = 0.18;
    pop(0.36, 0.3, perfect ? 'Perfect' : 'Good', perfect ? '#ffe27a' : '#cfe9ff');
    burst(0.36, 0.3, perfect ? 14 : 7, 0.45, perfect ? SPARK : ['#cfe9ff', '#fff3c2']);
    state.last = { g: r.grade, t: 0 };
  }
  function autoTrick() {
    const tr = state.tr, pl = state.apPlan; if (!tr || !pl) return;
    for (let k = 0; k < tr.notes.length; k++) {
      const n = tr.notes[k], q = pl[k];
      if (state.apIdx[0] <= k && state.tc >= q.press) { state.apIdx[0] = k + 1; if (n.state === 'wait') onGrade(pressAt(tr, state.tc)); }
      if (n.hold && state.apIdx[1] <= k && state.tc >= q.release && n.state === 'held') { state.apIdx[1] = k + 1; onGrade(releaseAt(tr, state.tc)); }
    }
  }
  function stepTrick(dt) {
    const tr = state.tr, human = state.scene === 'play';
    state.tc += dt;
    // metronome: a quiet tick on every beat (stronger on the first beat of a bar)
    const bn = Math.floor(state.tc / tr.per + 1e-9);
    if (bn !== state.beatN) { state.beatN = bn; if (state.tc < tr.end) sounds.tick(bn % 4 === 0); }
    if (!human) autoTrick();
    for (const r of expire(tr, state.tc)) onGrade(r);
    state.spin = Math.max(0.2, state.spin - dt * 0.35);
    if (trickOver(tr, state.tc)) finishTrick();
  }
  function finishTrick() {
    const m = state.m, tr = state.tr;
    for (const n of tr.notes) { if (n.state === 'wait') { n.state = 'miss'; tr.misses++; } }
    const acc = trickAccuracy(tr), stars = starsFor(acc), pts = tr.score;
    finishPart(m, 'trick', tr.id, pts, { acc: Math.round(acc * 100) / 100, stars, combo: tr.bestCombo });
    state.res = { kind: 'trick', pts, acc, stars, name: trickInfo(tr.id).name, rival: m.rival[m.step - 1], combo: tr.bestCombo };
    state.ph = 'result'; state.wait = state.prefs.calm ? 1.4 : 2.2; state.canHint = false; state.hold = null;
    sounds.fanfare(); burst(0.5, 0.35, 8 + stars * 6, 0.6);
    say(`${state.res.name}: ${pts} points, ${stars} star${stars === 1 ? '' : 's'}. ${m.names[1]} scored ${state.res.rival}.`);
  }

  // ---- target runs -------------------------------------------------------------------------------------------------------------------
  function releaseLoop(size, auto) {
    const run = state.run;
    run.throws++;
    const res = judgeThrow(run, state.rc, size);
    if (run.throws >= 2) res.pts = Math.round(res.pts * 0.8);
    state.loops.push({ t0: state.rc, size, T: res.T, res, done: false, auto: !!auto });
    state.hold = null; state.coil = 0.7; state.hintRun = false;
    sounds.throw(); burst(0.2, 0.45, 5, 0.3, ['#f1d9a0', '#ffffff']);
  }
  function stepRun(dt) {
    const run = state.run, human = state.scene === 'play';
    if (!state.caught) state.rc += dt;
    state.spin = Math.max(0.2, state.spin - dt * 0.4);
    if (state.coil > 0) state.coil = Math.max(0, state.coil - dt);
    // the human's hand: press starts the swing (game flow below), release throws (update)
    if (human && state.runPress && !state.caught && !state.hold && state.coil <= 0 && run.throws < run.maxThrows) { state.hold = { t: 0 }; state.hintT = 0; }
    if (!human && state.apPlan && !state.caught && !state.hold && run.throws === 0 && !state.apHold && state.rc >= state.apPlan.t - state.apPlan.hold) { state.apHold = true; state.hold = { t: 0 }; }
    if (state.hold) {
      state.hold.t += dt;
      if (Math.floor(state.hold.t * 10) !== Math.floor((state.hold.t - dt) * 10)) sounds.whirl(sizeOfHold(state.hold.t));
      state.spin = Math.min(1, 0.4 + 0.6 * sizeOfHold(state.hold.t));
      if (!human && state.apPlan && state.rc >= state.apPlan.t) releaseLoop(state.apPlan.size, true);
    }
    // loops in the air
    for (const lp of state.loops) {
      if (lp.done || state.rc < lp.t0 + lp.T) continue;
      lp.done = true;
      const r = lp.res, x = clampN(r.x, 0, 1);
      if (r.grade !== 'miss') {
        state.caught = { grade: r.grade, pts: r.pts, x: r.x, size: lp.size, t: 0 };
        sounds.catch(r.grade); burst(0.5, 0.5, r.grade === 'clean' ? 22 : 12, 0.7); state.shake = 0.25;
        pop(0.15 + 0.7 * x, 0.42, r.grade === 'clean' ? 'Clean catch!' : r.grade === 'good' ? 'Good catch' : 'Brushed it', r.grade === 'brush' ? '#ffd2a0' : '#ffe27a');
        state.wait = 1.3;
        say(`${r.grade === 'clean' ? 'Clean catch' : r.grade === 'good' ? 'Good catch' : 'Just caught it'}: +${r.pts}.`);
      } else {
        sounds.fall(); pop(0.5, 0.42, r.early < 0 ? 'Too late' : 'Too early', '#ff9a8a');
        say(r.early < 0 ? 'The target had already gone past: throw earlier, it needs lead.' : 'The loop came down before the target: wait a little longer.');
      }
    }
    if (state.caught) { state.caught.t += dt; state.wait -= dt; if (state.wait <= 0) finishRun(state.caught.pts, state.caught.grade); return; }
    const air = state.loops.some((q) => !q.done);
    if (!air && (state.rc >= run.D || (run.throws >= run.maxThrows && state.coil <= 0))) { state.hold = null; finishRun(0, 'miss'); }
  }
  function finishRun(pts, grade) {
    const m = state.m, run = state.run;
    finishPart(m, 'run', 'run', pts, { grade, throws: run.throws });
    state.res = { kind: 'run', pts, grade, rival: m.rival[m.step - 1], name: 'Target run' };
    state.ph = 'result'; state.wait = state.prefs.calm ? 1.3 : 2.0; state.canHint = false; state.hold = null; state.caught = null;
    say(pts ? `Target run: ${pts} points. ${m.names[1]} scored ${state.res.rival}.` : `The target got away. ${m.names[1]} scored ${state.res.rival}.`);
  }

  function afterResult() { if (state.m.done) finishEvent(); else beginPart(); }
  function finishEvent() {
    const m = state.m, auto = state.scene === 'autoplay';
    const stars = m.log.reduce((a, e) => a + (e.stars || 0), 0);
    state.over = { winner: m.winner, youWon: !auto && m.winner === 0, stars };
    if (!auto) { state.stats.played++; if (m.winner === 0) state.stats.won++; state.stats.stars = (state.stats.stars || 0) + stars; saveStats(); }
    sounds.fanfare(); say(m.winner < 0 ? 'The event is a draw.' : `${m.names[m.winner]} win${m.winner === 0 ? '' : 's'} the event.`);
    state.parts = []; state.pops = [];
    go(auto ? 'autoplay-over' : 'over');
  }

  // ---- buttons -----------------------------------------------------------------------------------------------------------------------
  function useHint() {
    if (!state.m || state.scene !== 'play') return;
    if (state.tr && (state.ph === 'intro' || state.ph === 'trick')) {
      state.hintT = 3;
      const n = nextNote(state.tr);
      say(n && n.hold ? 'Hint: press on the line and keep your finger down, then let go on the second mark.' : 'Hint: tap the instant a knot touches the gold line. Perfect is the centre of the line.');
    } else if (state.run && (state.ph === 'intro' || state.ph === 'run')) {
      state.hintRun = true; state.hintT = 6;
      say('Hint: hold to swing (longer = a wider loop but a slower throw), then let go when the dashed ring around the target meets the post.');
    }
  }
  function act(id) {
    const s = state;
    sounds.ui();
    if (id === 'new') go('setup');
    else if (id === 'about') { go('about'); s.aboutPage = 0; s.refFrom = 'title'; }
    else if (id === 'how') { go('how'); s.howPage = 0; s.refFrom = 'title'; }
    else if (id === 'rules') { go('rules'); s.rulesPage = 0; s.refFrom = 'title'; }
    else if (id === 'settings') go('settings');
    else if (id === 'back') { if (s.scene === 'how' || s.scene === 'rules' || s.scene === 'about') go(s.refFrom || 'title'); else go('title'); }
    else if (id === 'title') go('title');
    else if (id === 'page') s.scroll = 0;
    else if (id === 'textDec') { if (s.prefs.textScaleIdx > 0) { s.prefs.textScaleIdx--; savePrefs(); clampPages(); } }
    else if (id === 'textInc') { if (s.prefs.textScaleIdx < TEXT_SCALES.length - 1) { s.prefs.textScaleIdx++; savePrefs(); clampPages(); } }
    else if (id === 'start') startEvent();
    else if (id === 'autoplay') startAutoPlay();
    else if (id === 'apDec') { if (s.prefs.apThinkIdx > 0) { s.prefs.apThinkIdx--; savePrefs(); } }
    else if (id === 'apInc') { if (s.prefs.apThinkIdx < AP_THINK_STEPS.length - 1) { s.prefs.apThinkIdx++; savePrefs(); } }
    else if (id === 'appause') s.ap.paused = true;
    else if (id === 'apresume') s.ap.paused = false;
    else if (id.startsWith('lv:')) s.setup.level = id.slice(3);
    else if (id.startsWith('len:')) s.setup.len = Number(id.slice(4));
    else if (id.startsWith('set:')) { const k = id.slice(4); s.prefs[k] = !s.prefs[k]; savePrefs(); }
    else if (id === 'menu') { s.menuOpen = true; s.scroll = 0; }
    else if (id === 'resume') { s.menuOpen = false; s.scroll = 0; }
    else if (id === 'howmenu' || id === 'rulesmenu') { const from = s.scene; go(id === 'howmenu' ? 'how' : 'rules'); s.refFrom = from; s.howPage = 0; s.rulesPage = 0; }
    else if (id === 'leave') { s.tr = null; s.run = null; s.hold = null; go('title'); }
    else if (id === 'sound') { s.prefs.sound = !s.prefs.sound; savePrefs(); }
    else if (id === 'hint') useHint();
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned || !monetization?.restore) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'again') { if (s.scene === 'autoplay-over') startAutoPlay(); else startEvent(); }
  }
  function clampPages() { state.scroll = Math.min(state.scroll || 0, readerMax(state)); }

  // ---- the flow of the event, one tick at a time ---------------------------------------------------------------------------------------
  function flow(dt) {
    const ph = state.ph;
    if (ph === 'intro') {
      state.wait -= dt;
      if (state.wait <= 0) {
        state.ph = state.tr ? 'trick' : 'run'; state.tc = 0; state.rc = 0; state.beatN = -1; state.canHint = true;
        say(state.run ? 'Hold to swing the loop. Let go to throw.' : 'Count in: tap each knot as it reaches the gold line.');
      }
      return;
    }
    if (ph === 'apthink') {
      state.wait -= dt;
      if (state.wait <= 0) {
        state.ph = 'apreveal'; state.wait = AP_REVEAL;
        if (state.tr) say(`Plan: ${state.tr.notes.length} notes at ${levelInfo(state.m.level).bpm} beats a minute. Tap as each knot meets the line, and let go of held notes on the second mark.`);
        else say(`Plan: swing a ${state.apPlan.size < 0.5 ? 'tight' : 'wide'} loop and let go ${flightTime(state.apPlan.size).toFixed(1)} seconds before the target reaches the post.`);
      }
      return;
    }
    if (ph === 'apreveal') {
      state.wait -= dt;
      if (state.wait <= 0) { state.ph = state.tr ? 'trick' : 'run'; state.tc = 0; state.rc = 0; state.beatN = -1; say(state.tr ? 'Playing the trick.' : 'Swinging the loop.'); }
      return;
    }
    if (ph === 'trick') { stepTrick(dt); return; }
    if (ph === 'run') { stepRun(dt); return; }
    if (ph === 'result') { state.wait -= dt; if (state.wait <= 0) afterResult(); }
  }

  // ---- showcase scenes (store screenshots only) --------------------------------------------------------------------------------------
  // main.js sets env.config.showcase in `?shot=1` mode only. A showcase is a real position played by the real game code.
  function showEvent(opts) {
    state.m = newEvent({ level: opts.level || 'charro', len: opts.len || 5, rng });
    state.prefs.guide = true; state.prefs.calm = false;
    const k = opts.step || 0;
    for (let i = 0; i < k; i++) state.m.log.push({ i, kind: state.m.plan[i].kind, id: state.m.plan[i].id, pts: 300, rival: 260, stars: 2 });
    state.m.step = k; state.m.score = [300 * k, 260 * k];
    go('play'); resetView(); beginPart();
  }
  function showTrick(id, k) {
    showEvent({ step: 0 });
    state.m.plan[0] = { kind: 'trick', id }; state.tr = newTrick(id, 'charro'); state.ph = 'trick'; state.canHint = true;
    state.spin = 0.9; state.showcase = true; state.msg = `Trick 1 of 5: ${trickInfo(id).name}. Tap each knot as it reaches the line.`;
    state.tc = state.tr.t0 + k * state.tr.per + 0.12;
    let c = 0;
    for (const n of state.tr.notes) if (n.t < state.tc - 0.2 && n.state === 'wait') { n.state = 'done'; n.pg = 'perfect'; n.pts = 100; state.tr.score += 100 * (1 + Math.min(3, Math.floor(c / 4))); state.tr.combo++; state.tr.hits++; c++; }
    state.combo = state.tr.combo; state.mult = 1 + Math.min(3, Math.floor(state.combo / 4));
  }
  function showRun(dir, rc) {
    showEvent({ step: 2 }); const run = state.run = newRun('charro', rng); run.dir = dir; state.tr = null; state.ph = 'run'; state.rc = rc; state.canHint = true; state.showcase = true;
    return run;
  }
  const SHOW = {
    trick() { showTrick('media', 3); },
    flower() {
      showTrick('flor', 2.2); const tr = state.tr, n = tr.notes[2];
      state.tc = n.t + 0.9 * tr.per; n.state = 'held'; n.pg = 'perfect'; n.pts = 50; state.hold = { t: 1 }; state.spin = 1;
    },
    ready() { const run = showRun(1, 0.4); void run; state.msg = 'Target run 1 of 2: hold to swing the loop, let go to throw it at the post.'; },
    swing() { const run = showRun(1, 2.1); void run; state.hold = { t: 0.7 }; state.spin = 0.9; state.hintRun = true; state.hintT = 6; state.msg = 'Hold to swing the loop. Let go to throw.'; },
    flight() {
      const run = showRun(1, 0), ir = idealRelease(run, 0.6);
      state.rc = ir.t + 0.38; run.throws = 1; state.loops = [{ t0: ir.t, size: 0.6, T: ir.T, res: judgeThrow(run, ir.t, 0.6), done: false }]; state.coil = 0.4; state.msg = 'Away!';
    },
    catch() {
      const run = showRun(-1, 0), ir = idealRelease(run, 0.55), res = judgeThrow(run, ir.t, 0.55);
      state.rc = ir.t + ir.T; run.throws = 1; state.loops = [{ t0: ir.t, size: 0.55, T: ir.T, res, done: true }];
      state.caught = { grade: res.grade, pts: res.pts, x: res.x, size: 0.55, t: 0.3 }; state.wait = 5; state.msg = `Clean catch: +${res.pts}.`; pop(0.5, 0.42, 'Clean catch!', '#ffe27a');
    },
    result() { showEvent({ step: 3 }); state.ph = 'result'; state.res = { kind: 'trick', pts: 640, acc: 0.93, stars: 3, name: 'Flor de oro', rival: 480, combo: 7 }; state.wait = 99; state.showcase = true; state.msg = 'Flor de oro: 640 points, 3 stars. Don Rafael scored 480.'; },
    autoplay() { state.setup.level = 'charro'; startAutoPlay(); state.wait = 0.01; },
    over() { showEvent({ step: 4 }); state.m.done = true; state.m.step = state.m.plan.length; state.m.winner = 0; state.m.score = [2210, 1840]; state.m.best = { trick: 740, run: 125 }; state.stats.played = 4; state.stats.won = 2; finishEvent(); },
    setup() { go('setup'); },
    settings() { go('settings'); },
    rules() { go('rules'); state.jump = 4; },
    rules3() { go('rules'); state.prefs.textScaleIdx = 4; state.jump = 3; },
    how() { go('how'); state.jump = 1; },
    about() { go('about'); },
    title() { state.t = 8; },
  };
  function applyShowcase(name) { const f = SHOW[name]; if (f) f(); }

  const btnAt = (x, y) => screenButtons(state, lay()).find((b) => inRect(b, x, y) && (!b.clip || inRect(b.clip, x, y)));
  if (config.showcase) applyShowcase(config.showcase);

  return {
    update(dt, input) {
      const sc = state.scene, ptr = input.pointer, keys = input.keys.pressed, L = lay();
      if (sc === 'how' || sc === 'rules' || sc === 'about') clampPages(); // a rotation can change the scroll range
      const paused = sc === 'autoplay' && state.ap.paused;
      state.runPress = false;

      // pointer: buttons act on release (so a drag can scroll), the arena reacts on press and on release
      let gamePress = false, gameRelease = false;
      if (ptr.pressed) {
        const b = btnAt(ptr.x, ptr.y), afZone = sc === 'title' ? creditHit(L.title.lock) : null;
        state.press = { x: ptr.x, y: ptr.y, moved: false, s0: state.scroll, b: b && !b.dim ? b.id : null, af: Boolean(afZone && inRect(afZone, ptr.x, ptr.y)), game: false };
        if (!b && sc === 'play' && !state.menuOpen && !state.showcase) { gamePress = true; state.press.game = true; }
      }
      if (ptr.down && state.press && !state.press.game) {
        const pr = state.press, dy = ptr.y - pr.y;
        if (Math.abs(dy) > 14 || Math.abs(ptr.x - pr.x) > 14) pr.moved = true;
        const sl = screenLayout(state, L), mx = sl ? sl.maxScroll : readerMax(state);
        if (pr.moved && mx > 0) state.scroll = Math.min(Math.max(pr.s0 - dy, 0), mx);
      }
      if (ptr.released && state.press) {
        const pr = state.press; state.press = null;
        if (pr.game) gameRelease = true;
        else {
          if (!pr.moved && pr.b) { const b = btnAt(ptr.x, ptr.y); if (b && b.id === pr.b) act(b.id); }
          if (!pr.moved && pr.af && sc === 'title' && inRect(creditHit(L.title.lock), ptr.x, ptr.y)) env.openArcforgeHome?.();
        }
      }
      // keyboard
      let kbPress = false, kbRelease = false;
      if (inPlay()) {
        if (keys.has('Escape')) { state.menuOpen = !state.menuOpen; state.scroll = 0; }
        if (!state.menuOpen && !paused && sc === 'play' && !state.showcase) {
          const down = input.keys.down.has('Space') || input.keys.down.has('Enter');
          if (keys.has('Space') || keys.has('Enter')) { kbPress = true; state.kbDown = true; }
          else if (state.kbDown && !down) { kbRelease = true; state.kbDown = false; }
          if (keys.has('KeyH')) useHint();
        }
      } else {
        const sl = screenLayout(state, L);
        if (sl && sl.maxScroll > 0) { if (keys.has('ArrowDown')) state.scroll = Math.min(sl.maxScroll, (state.scroll || 0) + 80); if (keys.has('ArrowUp')) state.scroll = Math.max(0, (state.scroll || 0) - 80); }
        if (sc === 'how' || sc === 'about' || sc === 'rules') {
          const rmx = readerMax(state), set = (v) => { state.scroll = Math.max(0, Math.min(rmx, v)); };
          if (wheelInput.dy) { set((state.scroll || 0) + wheelInput.dy); wheelInput.dy = 0; }
          for (const [k, d] of [['ArrowDown', 80], ['ArrowUp', -80], ['PageDown', 500], ['PageUp', -500], ['Space', 500]]) if (keys.has(k)) set((state.scroll || 0) + d);
          if (keys.has('Home')) set(0); if (keys.has('End')) set(rmx);
          if (keys.has('Escape')) act('back');
        } else if (sl && wheelInput.dy) state.scroll = Math.max(0, Math.min(sl.maxScroll, (state.scroll || 0) + wheelInput.dy));
        wheelInput.dy = 0;
      }

      // everything below is the simulation: a paused Auto Play freezes ALL of it (timers, flights, particles)
      if (paused) return;
      state.t += dt;
      if (state.hintT > 0) state.hintT = Math.max(0, state.hintT - dt);
      for (const p of state.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.9 * dt; }
      state.parts = state.parts.filter((p) => p.life > 0);
      for (const p of state.pops) p.t += dt;
      state.pops = state.pops.filter((p) => p.t < 1.4);
      for (const e of state.sfx) e.t -= dt;
      for (const e of state.sfx.filter((q) => q.t <= 0)) audio.tone(e.o);
      state.sfx = state.sfx.filter((q) => q.t > 0);
      if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
      if (state.last) state.last.t += dt;

      if (inPlay() && !state.menuOpen && state.m && !state.showcase) {
        const human = sc === 'play';
        if (human && state.ph === 'trick' && state.tr) {
          // a press or release lands on the trick clock BEFORE the clock advances (the instant the player acted)
          if (gamePress || kbPress) onGrade(pressAt(state.tr, state.tc));
          if (gameRelease || kbRelease) { const r = releaseAt(state.tr, state.tc); if (r) onGrade(r); }
        } else if (human && state.ph === 'run') {
          if (gamePress || kbPress) state.runPress = true;
          if ((gameRelease || kbRelease) && state.hold) releaseLoop(sizeOfHold(state.hold.t), false);
        } else if (human && state.ph === 'intro' && (gamePress || kbPress)) {
          state.wait = Math.min(state.wait, 0.05); // a tap during the announcement just starts the part sooner
        }
        flow(dt);
      }
      if ((sc === 'over' || sc === 'autoplay-over') && state.over && state.t % 1.6 < dt) burst(0.1 + fx.next() * 0.8, 0.2, 10, 0.5);
    },
    render(ctx, view) {
      live.w = view?.width ?? meta.width; live.h = view?.height ?? meta.height;
      const L = layoutFor(live.w, live.h);
      // The kit's "Preview 1:28" pill sits in the empty sky at the top right of the arena, clear of the score board and the message plaque.
      meta.previewBadge = { x: L.play.scene.x + L.play.scene.w - 10, y: L.play.scene.y + 8, align: 'right' };
      draw(ctx, state, L);
    },
    getState: () => state,
    // Only real event play counts against the kit's free-preview timer. Menus, setup, settings, How/Rules/About, the pause menu,
    // result screens and Auto Play (a free teaching demo) are all exempt.
    isPreviewExempt: () => !(state.scene === 'play' && !state.menuOpen),
  };
}
