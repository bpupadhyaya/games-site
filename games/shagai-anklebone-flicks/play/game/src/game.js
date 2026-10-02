// GAME CONTRACT (docs/GAME-CONTRACT.md): exports meta and createGame(env) -> { update, render, getState }.
// This file owns state and flow (scenes, input, rides, saving). Rules live in rules.js, the computer in ai.js, everything
// drawn in view.js. `state` is plain JSON: closures hold nothing that matters.
import { W, TRAY, BONE_SPOTS, inRect, stationXY } from './layout.js';
import { FINISH, BONES, newGame, tossBones, scoreOf, comboLabel, previewGallop, applyGallop, beginRide, nextTurn, ranking, deepClone } from './rules.js';
import { chooseAction, bestAction, describeAction } from './ai.js';
import { screenButtons, screenLayout, readerPages, TEXT_SCALES, AP_THINK_STEPS, zoomOf, rideInfo } from './ui.js';
import { render as draw } from './view.js';
import { RIDER } from './art.js';

export const meta = { width: W, height: 1560 };

const DEMO_RACES = 2;
const RIDE_CAP = 500;
// Auto Play (Watch & Learn): a whole computer-only race driven by the SAME ai.js planner used for every real computer rider.
// THINK (configurable, default 5 s, max 10 s) -> REVEAL (fixed 2 s: the held bones are shown and the choice explained) -> ACT.
// A real Pause freezes everything (timers, tossing bones, the gallop, particles) and resumes exactly where it was.
const AP_LEVELS = ['sharp', 'steady', 'sharp'], AP_REVEAL_TIME = 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, audio, config } = env;
  const fx = rng.fork(); // visual randomness never shifts the bone stream

  const state = {
    scene: 'title', t: 0, demo: !!config.demo, demoRaces: 0,
    prefs: { sound: true, calm: false, auto: true, textScaleIdx: 0, apThinkIdx: 1 },
    setup: { players: 3, opp: 'mixed' },
    stats: { played: 0, wins: 0 },
    saved: null, menuOpen: false, howPage: 0, aboutPage: 0, rulesPage: 0, refFrom: 'title', scroll: 0, press: null,
    g: newGame({ humans: [true, false] }), phase: 'throw', wait: 0, msg: '',
    ride: { faces: [2, 2, 3, 3], hold: [false, false, false, false], left: 0, total: 3, pose: [], anim: null, autoT: null, hint: false, plan: null, tossed: false },
    gal: null, fly: [], parts: [], sfx: [], pops: [], ap: { paused: false }, over: null, shake: null, fast: false, showcase: null,
  };

  // ---- storage --------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (v) {
      Object.assign(state.prefs, v);
      state.prefs.textScaleIdx = clamp(state.prefs.textScaleIdx ?? 0, 0, TEXT_SCALES.length - 1);
      state.prefs.apThinkIdx = clamp(state.prefs.apThinkIdx ?? 1, 0, AP_THINK_STEPS.length - 1);
      audio.setMuted(!state.prefs.sound);
    }
  });
  storage.get('stats', null).then((v) => { if (v) Object.assign(state.stats, v); });
  storage.get('demoRaces', 0).then((v) => { state.demoRaces = Math.max(state.demoRaces, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.winner < 0 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => { storage.set('prefs', state.prefs); audio.setMuted(!state.prefs.sound); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };
  const saveGame = () => { if (state.scene === 'play' && state.g.winner < 0) { state.saved = { g: deepClone(state.g) }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  // ---- sound (all synthesized; delayed tones are scheduled in update so it stays deterministic) -----------------------------
  const isAutoplay = () => state.scene === 'autoplay' || state.scene === 'autoplay-over';
  // Auto Play is silent by design regardless of the player's sound setting: never surprise a viewer with sound from a demo.
  const tone = (o, delay = 0) => { if (!state.prefs.sound || isAutoplay()) return; if (delay > 0) state.sfx.push({ t: delay, o }); else audio.tone(o); };
  let snd = 1;
  const sr = (n) => { snd = (Math.imul(snd, 1664525) + 1013904223) >>> 0; return snd % n; };
  const clack = (f = 900, v = 0.08, dur = 0.04, delay = 0) => tone({ freq: f, to: f * 0.45, dur, type: 'triangle', vol: v }, delay);
  const sounds = {
    toss: () => { for (let k = 0; k < 9; k++) clack(1100 + sr(900), 0.045, 0.03, k * 0.1 + 0.001); },
    land: () => { clack(520, 0.1, 0.07); clack(760, 0.07, 0.05, 0.05); },
    hold: () => tone({ freq: 620, to: 840, dur: 0.07, type: 'sine', vol: 0.07 }),
    release: () => tone({ freq: 520, to: 380, dur: 0.07, type: 'sine', vol: 0.06 }),
    combo: () => [523, 659, 784].forEach((f, k) => tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.07 }, k * 0.08 + 0.001)),
    big: () => [523, 659, 784, 1046].forEach((f, k) => tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.08 }, k * 0.08 + 0.001)),
    hoof: (k) => { tone({ freq: 190 + (k % 2) * 40, to: 90, dur: 0.07, type: 'triangle', vol: 0.1 }); },
    wind: () => { tone({ freq: 300, to: 900, dur: 0.5, type: 'sine', vol: 0.06 }); tone({ freq: 420, to: 1200, dur: 0.5, type: 'triangle', vol: 0.04 }, 0.06); },
    burrow: () => { tone({ freq: 160, to: 55, dur: 0.35, type: 'sawtooth', vol: 0.09 }); },
    stream: () => [700, 820, 640].forEach((f, k) => tone({ freq: f, to: f * 1.3, dur: 0.1, type: 'sine', vol: 0.06 }, k * 0.09 + 0.001)),
    camp: () => [392, 523].forEach((f, k) => tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.07 }, k * 0.14 + 0.001)),
    bump: () => { tone({ freq: 260, to: 80, dur: 0.22, type: 'square', vol: 0.07 }); tone({ freq: 900, to: 500, dur: 0.14, type: 'triangle', vol: 0.06 }, 0.06); },
    win: () => [523, 659, 784, 1046, 1318].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.09 }, k * 0.14 + 0.001)),
    refuse: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.07 }),
    ui: () => tone({ freq: 520, to: 700, dur: 0.06, type: 'sine', vol: 0.07 }),
  };

  // ---- particles ------------------------------------------------------------------------------------------------------------
  function burst(x, y, cols, n, speed = 220, size = 5, up = 60) {
    if (state.prefs.calm) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = fx.next() * Math.PI * 2, sp = speed * (0.3 + fx.next() * 0.8);
      state.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up, life: 0.6 + fx.next() * 0.5, max: 1.1, col: cols[k % cols.length], sz: size * (0.6 + fx.next() * 0.8), rect: k % 3 === 0, rot: fx.next() * 6 });
    }
  }
  const GOLD = ['#ffe27a', '#fff4d6', '#f4c20d'], DUST = ['#e9d3a0', '#c9a96c', '#f5e8c4'];
  function pop(x, y, text, color = '#fff4d6') { state.pops.push({ x, y, text, color, t: 0 }); }

  // ---- helpers ---------------------------------------------------------------------------------------------------------------
  const say = (text) => { state.msg = text; };
  const R = () => state.ride;
  const cur = () => state.g.riders[state.g.turn];
  const isHuman = () => cur().human;
  const apTurn = () => state.scene === 'autoplay';
  const aiTurn = () => apTurn() || !isHuman();
  const nameOf = (p) => state.g.riders[p].name;
  const youNow = () => isHuman() && state.g.riders.filter((p) => p.human).length === 1;
  const subj = (verbYou, verbHe) => (youNow() ? `You ${verbYou}` : `${nameOf(state.g.turn)} ${verbHe}`);
  const canThrow = () => state.scene === 'play' && state.phase === 'throw' && isHuman() && state.wait <= 0;
  const go = (scene) => { state.scene = scene; state.scroll = 0; state.menuOpen = false; };
  const think = () => AP_THINK_STEPS[state.prefs.apThinkIdx ?? 1];
  const pl = () => state.g.turn;
  const poseNew = () => ({ dx: (fx.next() - 0.5) * 24, dy: (fx.next() - 0.5) * 22, rot: (fx.next() - 0.5) * 0.5 });
  const freshRide = (total = 3) => ({ faces: [2, 2, 3, 3], hold: [false, false, false, false], left: 0, total, pose: BONE_SPOTS.map(() => ({ dx: 0, dy: 0, rot: 0 })), anim: null, autoT: null, hint: false, plan: null, tossed: false });

  // ---- starting things ----------------------------------------------------------------------------------------------------------
  function levelsFor(n) {
    const o = state.setup.opp;
    if (o === 'mixed') return ['steady', 'sharp', 'beginner'].slice(0, n);
    return Array.from({ length: n }, () => o);
  }
  function resetView() {
    state.menuOpen = false; state.gal = null; state.fly = []; state.over = null; state.parts = []; state.sfx = []; state.pops = []; state.fast = false; state.ap = { paused: false };
    state.ride = freshRide();
  }
  function startAutoPlay() { state.g = newGame({ humans: [false, false, false], levels: AP_LEVELS }); go('autoplay'); resetView(); beginTurn(); }
  function startRace() {
    if (state.demo && state.demoRaces >= DEMO_RACES) { go('demo-limit'); return; }
    if (state.demo) { state.demoRaces++; storage.set('demoRaces', state.demoRaces); }
    const n = state.setup.players;
    state.g = newGame({ humans: Array.from({ length: n }, (_, i) => i === 0), levels: levelsFor(n - 1) });
    go('play'); resetView(); clearSave(); beginTurn();
  }
  function continueRace() { const s = state.saved; if (!s) return; state.g = deepClone(s.g); go('play'); resetView(); beginTurn(); }
  function beginTurn() {
    const g = state.g, total = beginRide(g, g.turn);
    state.ride = freshRide(total);
    state.phase = 'throw'; state.gal = null;
    state.wait = aiTurn() ? 0.7 : 0.2;
    if (isHuman()) state.fast = false;
    const extra = total > 3 ? ' Camp: one extra toss this ride!' : total < 3 ? ' Stream: one fewer toss this ride.' : '';
    say(apTurn() ? `${nameOf(g.turn)} (${cur().level}) is about to toss the bones.` : !isHuman() ? `${nameOf(g.turn)} is about to toss. TAP to hurry.` : `Your ride: TAP or SWIPE UP on the mat to toss.${extra}`);
  }

  // ---- tossing -------------------------------------------------------------------------------------------------------------------
  function doToss(force) {
    const rd = R(), calm = state.prefs.calm, first = !rd.tossed;
    const faces = force ? force.slice() : tossBones(rng, first ? null : rd.faces, first ? null : rd.hold);
    const tossing = Array.from({ length: BONES }, (_, i) => first || !rd.hold[i]);
    const items = BONE_SPOTS.map((sp, i) => {
      if (!tossing[i]) return null;
      const p = poseNew(); rd.pose[i] = p;
      return { x0: sp.x + (fx.next() - 0.5) * 80, y0: 1400, tx: sp.x + p.dx, ty: sp.y + p.dy, r0: fx.next() * 6.28, r1: p.rot, face0: fx.int(4), dl: i * 0.05 };
    });
    if (rd.tossed) rd.left--; else rd.left = rd.total - 1;
    rd.tossed = true; rd.faces = faces; rd.anim = { t: 0, dur: calm ? 0.4 : 1.1, items, tossing }; rd.autoT = null; rd.hint = false; rd.plan = null;
    state.phase = 'toss'; state.wait = 0;
    sounds.toss();
    say(youNow() ? 'The bones tumble...' : `${nameOf(pl())} tosses the bones...`);
  }
  function tossDone() {
    const rd = R(), sc = scoreOf(rd.faces);
    sounds.land();
    if (sc.bonus > 0) { if (sc.bonus >= 4) sounds.big(); else sounds.combo(); }
    rd.anim = null; rd.hold = rd.hold.map(() => false);
    state.phase = 'show'; state.wait = 0.4;
    if (sc.bonus > 0) pop(360, 1066, comboLabel(rd.faces), '#ffe27a');
  }
  function afterShow() {
    const rd = R(), g = state.g, sc = scoreOf(rd.faces);
    const lead = `${subj('tossed', 'tossed')}: ${comboLabel(rd.faces).toLowerCase()}. ${sc.total} strides.`;
    if (apTurn()) {
      rd.plan = chooseAction(g, pl(), rd.faces, rd.left, cur().level, rng);
      state.phase = 'apthink'; state.wait = think(); say(`${nameOf(pl())} is thinking... (think time ${think()}s)`);
      return;
    }
    if (!isHuman()) { rd.plan = chooseAction(g, pl(), rd.faces, rd.left, cur().level, rng); state.phase = 'aithink'; state.wait = 0.55; say(`${lead} ${nameOf(pl())} is choosing...`); return; }
    state.phase = 'decide';
    if (rd.left <= 0) { say(`${lead} That was your last toss.`); rd.autoT = state.prefs.auto ? 1.4 : null; }
    else say(`${lead} TAP bones to HOLD them, then Toss again, or Gallop.`);
  }
  function aiAct() { // the planned action is carried out
    const rd = R(), a = rd.plan;
    if (!a || a.gallop || rd.left <= 0) { startGallop(); return; }
    rd.hold = a.hold.slice(); doToss();
  }
  function tossAgain() {
    const rd = R(), ri = rideInfo(state);
    if (!ri.canToss) { if (state.phase === 'decide') { say(rd.left <= 0 ? 'No tosses left: press Gallop.' : 'Release a bone first, or press Gallop.'); sounds.refuse(); } return; }
    doToss();
  }
  function humanGallop() { if (state.phase === 'decide') startGallop(); }
  function toggleHold(i) {
    const rd = R();
    if (state.phase !== 'decide') return;
    if (rd.left <= 0) { say('No tosses left: press Gallop.'); sounds.refuse(); return; }
    rd.hold[i] = !rd.hold[i]; rd.hint = false; rd.autoT = null;
    (rd.hold[i] ? sounds.hold : sounds.release)();
    const n = rd.hold.filter(Boolean).length;
    say(n === 0 ? 'Nothing held: Toss again would toss all four bones.' : n === BONES ? 'All four held: press Gallop, or release a bone to toss again.' : `${n} held. Toss again tosses the other ${BONES - n}.`);
  }
  function useHint() {
    const rd = R();
    if (state.phase !== 'decide' || state.scene !== 'play') return;
    const a = bestAction(state.g, pl(), rd.faces, rd.left, 'track');
    rd.hold = a.hold.slice(); rd.hint = true; rd.autoT = null;
    say(`Hint: ${describeAction(state.g, pl(), rd.faces, a, rd.left)}`);
  }

  // ---- galloping -----------------------------------------------------------------------------------------------------------------
  function startGallop() {
    const g = state.g, rd = R(), calm = state.prefs.calm, sc = scoreOf(rd.faces), res = previewGallop(g, pl(), sc.total);
    rd.hold = rd.faces.map(() => false); rd.autoT = null; rd.hint = false;
    state.gal = { res, stage: 'run', t: 0, dur: calm ? 0.3 : clamp(0.5 + res.strides * 0.075, 0.6, 1.5), dur2: 0.5, step: res.from, u: res.from };
    state.phase = 'gallop'; state.wait = 0;
    say(`${subj('gallop', 'gallops')} ${res.strides} stations${res.finished ? ' to the finish' : ''}.`);
  }
  function galStage(next, dur) { const G = state.gal; G.stage = next; G.t = 0; G.dur2 = state.prefs.calm ? 0.2 : dur; }
  function stepGallop(dt) {
    const G = state.gal, res = G.res; G.t += dt;
    if (G.stage === 'run') {
      const f = clamp(G.t / G.dur, 0, 1), u = res.from + (res.landed - res.from) * ease(f);
      G.u = u;
      while (G.step < Math.floor(u) && G.step < FINISH) {
        G.step++; sounds.hoof(G.step);
        const p = stationXY(G.step); burst(p.x, p.y + 6, DUST, 2, 70, 3, 10);
      }
      if (f >= 1) {
        G.u = res.landed;
        if (res.finished) { endGallop(); return; }
        if (res.effect) {
          const k = res.effect.kind, p = stationXY(res.landed);
          if (k === 'wind') { sounds.wind(); burst(p.x, p.y, ['#cfeaff', '#ffffff', '#8fd0ff'], 18, 240, 4, 20); pop(p.x, p.y - 44, `Tailwind +${res.effect.to - res.landed}`, '#bfe6ff'); galStage('wind', 0.55); }
          else if (k === 'burrow') { sounds.burrow(); burst(p.x, p.y, DUST, 16, 160, 5, 60); pop(p.x, p.y - 44, `Burrow -${res.landed - res.effect.to}`, '#ffb59a'); galStage('burrow', 0.6); }
          else { (k === 'camp' ? sounds.camp : sounds.stream)(); burst(p.x, p.y, k === 'camp' ? GOLD : ['#bfe6ff', '#ffffff'], 14, 150, 4, 40); pop(p.x, p.y - 44, k === 'camp' ? 'Camp: +1 toss' : 'Stream: -1 toss', k === 'camp' ? '#ffe27a' : '#bfe6ff'); galStage('mark', 0.7); }
        } else endGallop();
      }
    } else {
      const f = clamp(G.t / G.dur2, 0, 1);
      if (G.stage !== 'mark') G.u = res.landed + (res.effect.to - res.landed) * ease(f);
      if (f >= 1) endGallop();
    }
  }
  function endGallop() {
    const g = state.g, G = state.gal, res = G.res, me = pl();
    const end = stationXY(res.final);
    res.bumped.forEach((b) => { const a = stationXY(b.from); state.fly.push({ pl: b.pl, from: a, to: stationXY(b.to), t: 0, dur: state.prefs.calm ? 0.2 : 0.8 }); burst(a.x, a.y, ['#fff0b0', '#ffffff', RIDER[b.pl]], 18, 260, 5); });
    applyGallop(g, res);
    state.gal = null;
    if (res.bumped.length) { const names = res.bumped.map((b) => nameOf(b.pl)).join(' and '); sounds.bump(); pop(end.x, end.y - 46, `Flicked ${names} back ${res.bumped[0].from - res.bumped[0].to}`, '#ffe27a'); say(`${subj('flick', 'flicks')} ${names} back!`); }
    if (res.finished) { sounds.win(); burst(end.x, end.y, GOLD, 40, 340, 7); say(`${nameOf(me)} ${youNow() ? 'reach' : 'reaches'} the finish!`); state.phase = 'won'; state.wait = 1.3; return; }
    state.phase = 'after'; state.wait = res.bumped.length ? 0.9 : 0.35;
  }
  function endTurn() {
    const g = state.g;
    nextTurn(g);
    if (g.rides >= RIDE_CAP) { // practically never: a stalled race ends with the usual ranking
      g.winner = ranking({ ...g, winner: -1 })[0].pl; state.phase = 'won'; state.wait = 0.2; return;
    }
    saveGame(); beginTurn();
  }
  function resetOverFx() { state.parts = []; state.gal = null; state.fly = []; state.pops = []; }
  function finishRace() {
    const g = state.g, s = state.stats, solo = g.riders.filter((p) => p.human).length === 1;
    s.played++; if (solo && g.riders[g.winner].human) s.wins++;
    saveStats(); clearSave();
    state.over = { winner: g.winner, rank: ranking(g), youWon: solo && g.riders[g.winner].human };
    say(state.over.youWon ? 'You win the race!' : `${nameOf(g.winner)} wins the race.`);
    go('over'); resetOverFx();
  }
  function apFinishRace() { state.over = { winner: state.g.winner, rank: ranking(state.g), youWon: false }; go('autoplay-over'); resetOverFx(); }

  // ---- hitting things -------------------------------------------------------------------------------------------------------------
  function boneAt(x, y) {
    const rd = R(); let best = -1, bd = 1e9;
    BONE_SPOTS.forEach((sp, i) => { const p = rd.pose[i] || { dx: 0, dy: 0 }, dx = Math.abs(x - (sp.x + p.dx)), dy = Math.abs(y - (sp.y + p.dy)); if (dx < 64 && dy < 60 && dx + dy < bd) { bd = dx + dy; best = i; } });
    return best;
  }
  function tapBoard(x, y) {
    if (state.phase === 'throw') { if (isHuman()) say('TAP or SWIPE UP on the felt mat to toss the bones.'); return; }
    if (state.phase !== 'decide') return;
    const i = boneAt(x, y);
    if (i >= 0) toggleHold(i);
  }
  function act(id) {
    const s = state;
    sounds.ui();
    if (id === 'new') go('setup');
    else if (id === 'continue') continueRace();
    else if (id === 'about') { go('about'); s.aboutPage = 0; s.refFrom = 'title'; }
    else if (id === 'how') { go('how'); s.howPage = 0; s.refFrom = 'title'; }
    else if (id === 'rules') { go('rules'); s.rulesPage = 0; s.refFrom = 'title'; }
    else if (id === 'settings') go('settings');
    else if (id === 'back') {
      if (s.scene === 'how') { if (s.howPage > 0) s.howPage -= 1; else leaveReader(); }
      else if (s.scene === 'rules') { if (s.rulesPage > 0) s.rulesPage -= 1; else leaveReader(); }
      else if (s.scene === 'about') { if (s.aboutPage > 0) s.aboutPage -= 1; else leaveReader(); }
      else go('title');
    }
    else if (id === 'title') go('title');
    else if (id === 'page') {
      const pages = readerPages(s.scene, zoomOf(s)), k = s.scene === 'how' ? 'howPage' : s.scene === 'rules' ? 'rulesPage' : 'aboutPage';
      if (s[k] >= pages.length - 1) leaveReader(); else s[k] += 1;
    }
    else if (id === 'textDec') { if (s.prefs.textScaleIdx > 0) { s.prefs.textScaleIdx--; savePrefs(); clampPages(); } }
    else if (id === 'textInc') { if (s.prefs.textScaleIdx < TEXT_SCALES.length - 1) { s.prefs.textScaleIdx++; savePrefs(); clampPages(); } }
    else if (id === 'start') startRace();
    else if (id === 'autoplay') startAutoPlay();
    else if (id === 'apDec') { if (s.prefs.apThinkIdx > 0) { s.prefs.apThinkIdx--; savePrefs(); } }
    else if (id === 'apInc') { if (s.prefs.apThinkIdx < AP_THINK_STEPS.length - 1) { s.prefs.apThinkIdx++; savePrefs(); } }
    else if (id === 'appause') s.ap.paused = true;
    else if (id === 'apresume') s.ap.paused = false;
    else if (id.startsWith('pl:')) s.setup.players = Number(id.slice(3));
    else if (id.startsWith('opp:')) s.setup.opp = id.slice(4);
    else if (id.startsWith('set:')) { const k = id.slice(4); s.prefs[k] = !s.prefs[k]; savePrefs(); }
    else if (id === 'menu') { s.menuOpen = true; s.scroll = 0; }
    else if (id === 'resume') { s.menuOpen = false; s.scroll = 0; }
    else if (id === 'howmenu' || id === 'rulesmenu') { const from = s.scene; go(id === 'howmenu' ? 'how' : 'rules'); s.refFrom = from; s.howPage = 0; s.rulesPage = 0; }
    else if (id === 'leave') { if (s.scene === 'play') saveGame(); s.gal = null; s.fly = []; s.phase = 'throw'; go('title'); }
    else if (id === 'sound') { s.prefs.sound = !s.prefs.sound; savePrefs(); }
    else if (id === 'toss') tossAgain();
    else if (id === 'gallop') humanGallop();
    else if (id === 'hint') useHint();
    else if (id === 'again') { if (s.scene === 'autoplay-over') startAutoPlay(); else startRace(); }
  }
  function leaveReader() { go(state.refFrom || 'title'); }
  function clampPages() {
    const sc = state.scene; if (sc !== 'how' && sc !== 'rules' && sc !== 'about') return;
    const k = sc === 'how' ? 'howPage' : sc === 'rules' ? 'rulesPage' : 'aboutPage', n = readerPages(sc, zoomOf(state)).length;
    state[k] = Math.min(state[k], n - 1);
  }

  // ---- update -----------------------------------------------------------------------------------------------------------------------
  function flow(dt) {
    let ph = state.phase;
    if ((ph === 'gallop' && !state.gal) || (ph === 'toss' && !R().anim)) { state.phase = ph = 'throw'; state.wait = 0.2; }
    if (ph === 'gallop') { stepGallop(dt); return; }
    if (ph === 'toss') { const a = R().anim; a.t += dt; if (a.t >= a.dur) tossDone(); return; }
    if (state.wait > 0) { state.wait -= dt; if (state.wait > 0) return; state.wait = 0; }
    const rd = R();
    switch (ph) {
      case 'throw': if (aiTurn()) doToss(); break;
      case 'show': afterShow(); break;
      case 'decide':
        if (rd.autoT != null) { rd.autoT -= dt; if (rd.autoT <= 0) { rd.autoT = null; startGallop(); } }
        break;
      case 'aithink': {
        const a = rd.plan;
        if (a && !a.gallop && rd.left > 0) { rd.hold = a.hold.slice(); say(`${nameOf(pl())} holds ${a.hold.filter(Boolean).length} and tosses ${a.hold.filter((h) => !h).length}.`); } else say(`${nameOf(pl())} gallops ${scoreOf(rd.faces).total}.`);
        state.phase = 'aiact'; state.wait = 0.8; break;
      }
      case 'aiact': aiAct(); break;
      case 'apthink': {
        const a = rd.plan && rd.left > 0 ? rd.plan : { gallop: true, hold: rd.faces.map(() => true), ev: 0, now: scoreOf(rd.faces).total };
        if (!a.gallop) rd.hold = a.hold.slice();
        state.phase = 'apreveal'; state.wait = AP_REVEAL_TIME;
        say(`${nameOf(pl())}: ${describeAction(state.g, pl(), rd.faces, a, rd.left)}`);
        break;
      }
      case 'apreveal': aiAct(); break;
      case 'after': endTurn(); break;
      case 'won': if (apTurn()) apFinishRace(); else finishRace(); break;
      default: break;
    }
  }

  // ---- showcase scenes (store screenshots only) ----------------------------------------------------------------------------------
  // main.js sets env.config.showcase in `?shot=1` mode only. A showcase is a real, legal position played by the real game code
  // (forced bones), so store screenshots show a human mid-race instead of a menu.
  const SHOWCASE = {
    hold: { players: 4, pos: [10, 24, 17, 31], faces: [0, 0, 2, 3], hold: [true, true, false, false], left: 1 },
    wind: { players: 3, pos: [10, 24, 17], faces: [0, 1, 2, 3], hold: [false, false, false, false], left: 1, hint: true },
    bump: { players: 4, pos: [20, 29, 40, 8], faces: [0, 0, 2, 3], hold: [false, false, false, false], left: 1, gallop: true },
    burrow: { players: 3, pos: [18, 33, 27], faces: [0, 2, 2, 3], hold: [false, false, false, false], left: 0 },
    win: { players: 3, pos: [64, 40, 51], faces: [0, 0, 1, 1], win: 0 },
    setup: { scene: 'setup', players: 3 },
    autoplay: { scene: 'autoplay' },
    rules3: { scene: 'rules', z: 4, page: 2 },
    rules1: { scene: 'rules', z: 0, page: 3 },
    settings3: { scene: 'settings', z: 4 },
    over: { players: 4, pos: [64, 40, 51, 12], faces: [0, 0, 1, 1], win: 0 },
  };
  function applyShowcase(name) {
    const S = SHOWCASE[name]; if (!S) return;
    state.prefs.auto = false; state.prefs.calm = false;
    if (S.scene === 'autoplay') { startAutoPlay(); return; }
    if (S.scene) { state.setup.players = S.players || 3; state.prefs.textScaleIdx = S.z || 0; go(S.scene); state.rulesPage = S.page || 0; state.t = 12; return; }
    state.g = newGame({ humans: Array.from({ length: S.players }, (_, i) => i === 0), levels: ['steady', 'sharp', 'beginner'] });
    S.pos.forEach((p, i) => { state.g.riders[i].pos = p; }); state.g.rides = 14;
    go('play'); resetView(); beginTurn(); state.wait = 0; state.showcase = S;
    if (S.win != null) { state.g.winner = S.win; state.g.riders[S.win].pos = FINISH; state.stats.played = 3; state.stats.wins = 1; finishRace(); return; }
    doToss(S.faces); state.ride.anim.t = state.ride.anim.dur - 0.02; state.t = 12;
  }
  function showcaseStep() {
    const S = state.showcase;
    if (!S || S.done || state.phase !== 'decide') return;
    S.done = true; state.ride.autoT = null;
    S.hold.forEach((h, i) => { state.ride.hold[i] = h; }); state.ride.left = S.left;
    if (S.hint) useHint();
    if (S.gallop) { startGallop(); state.gal.t = state.gal.dur * 0.55; state.gal.step = state.gal.res.from + Math.floor(state.gal.res.strides * 0.5); }
  }

  const btnAt = (x, y) => screenButtons(state).find((b) => inRect(b, x, y) && (!b.clip || inRect(b.clip, x, y)));

  if (config.showcase) applyShowcase(config.showcase);

  return {
    update(dt, input) {
      const sc = state.scene, ptr = input.pointer, keys = input.keys.pressed;
      const inPlay = sc === 'play' || sc === 'autoplay';
      const paused = sc === 'autoplay' && state.ap.paused;

      // pointer: buttons act on release (so a drag can scroll), board taps act on press
      if (ptr.pressed) {
        const b = btnAt(ptr.x, ptr.y);
        state.press = { x: ptr.x, y: ptr.y, moved: false, s0: state.scroll, b: b && !b.dim ? b.id : null };
        if (!b && inPlay && !state.menuOpen && !paused) {
          if (canThrow() && inRect({ x: TRAY.x, y: TRAY.y - 20, w: TRAY.w, h: TRAY.h + 40 }, ptr.x, ptr.y)) { doToss(); state.press = null; }
          else if (aiTurn() && sc === 'play' && state.phase !== 'won') state.fast = true;
          else if (sc === 'play') tapBoard(ptr.x, ptr.y);
        }
      }
      if (ptr.down && state.press) {
        const pr = state.press, dy = ptr.y - pr.y;
        if (Math.abs(dy) > 14 || Math.abs(ptr.x - pr.x) > 14) pr.moved = true;
        const lay = screenLayout(state);
        if (pr.moved && lay && lay.maxScroll > 0) state.scroll = Math.min(Math.max(pr.s0 - dy, 0), lay.maxScroll);
      }
      if (ptr.released && state.press) {
        const pr = state.press; state.press = null;
        if (!pr.moved && pr.b) { const b = btnAt(ptr.x, ptr.y); if (b && b.id === pr.b) act(b.id); }
        if (!state.menuOpen && sc === 'play' && pr.y > 900 && pr.y - ptr.y > 70) { if (canThrow()) doToss(); else if (state.phase === 'decide') tossAgain(); }
      }
      // keyboard
      if (inPlay) {
        if (keys.has('Escape')) { state.menuOpen = !state.menuOpen; state.scroll = 0; }
        if (!state.menuOpen && !paused && sc === 'play') {
          if (keys.has('Space') || keys.has('Enter')) { if (canThrow()) doToss(); else if (state.phase === 'decide') { if (rideInfo(state).canToss && R().hold.some(Boolean)) tossAgain(); else humanGallop(); } }
          for (let i = 0; i < BONES; i++) if (keys.has('Digit' + (i + 1))) toggleHold(i);
          if (keys.has('KeyT')) tossAgain();
          if (keys.has('KeyG')) humanGallop();
          if (keys.has('KeyH')) useHint();
        }
      } else {
        const lay = screenLayout(state);
        if (lay && lay.maxScroll > 0) { if (keys.has('ArrowDown')) state.scroll = Math.min(lay.maxScroll, (state.scroll || 0) + 80); if (keys.has('ArrowUp')) state.scroll = Math.max(0, (state.scroll || 0) - 80); }
        if (sc === 'how' || sc === 'about' || sc === 'rules') { if (keys.has('ArrowRight')) act('page'); if (keys.has('ArrowLeft')) act('back'); }
      }

      // everything below is the simulation: a paused Auto Play freezes ALL of it (timers, bones, gallop, particles)
      if (paused) return;
      state.t += dt;
      if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.55) state.shake = null; }
      for (const f of state.fly) f.t += dt;
      state.fly = state.fly.filter((f) => f.t < f.dur);
      for (const p of state.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 0.99; p.rot = (p.rot || 0) + dt * 6; }
      state.parts = state.parts.filter((p) => p.life > 0);
      for (const p of state.pops) p.t += dt;
      state.pops = state.pops.filter((p) => p.t < 1.5);
      for (const e of state.sfx) e.t -= dt;
      for (const e of state.sfx.filter((q) => q.t <= 0)) audio.tone(e.o);
      state.sfx = state.sfx.filter((q) => q.t > 0);
      if ((sc === 'over' || sc === 'autoplay-over') && state.over && state.t % 1.2 < dt) burst(180 + fx.next() * 360, 420, [RIDER[state.over.winner % 4], '#ffe27a', '#fff4d6'], 14, 240, 6);
      if (inPlay && !state.menuOpen) flow(dt * (state.fast && aiTurn() && sc === 'play' ? 2.8 : 1));
      showcaseStep();
    },
    render(ctx) { draw(ctx, state); },
    getState: () => state,
    // Only real play counts against the kit's free-preview timer. Menus, setup, settings, How/Rules/About, the pause menu,
    // result screens and Auto Play (a free teaching demo) are all exempt.
    isPreviewExempt: () => !(state.scene === 'play' && !state.menuOpen),
  };
}
