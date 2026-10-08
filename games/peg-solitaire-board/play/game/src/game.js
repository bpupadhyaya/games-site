// Peg Solitaire: state and flow. Drawing is view.js, geometry is layout.js, the rule book is rules.js, the solver is solver.js,
// puzzles are levels-data.js (baked by verify/gen-levels.mjs) and generate.js (the daily). Pure and deterministic.
//
// How a move is made: tap a peg (it lifts, golden holes show where it can jump) then tap a golden hole, or drag the peg onto one.
// A peg that can jump again stays lifted so a chain is one smooth gesture. Undo takes back one jump at a time.
import { BOARDS, boardById } from './boards.js';
import { fullBoard, count, legalJumps, jumpsFrom, findJump, applyJump, undoJump, countMoves, pegStars, keyOf } from './rules.js';
import { createSolver } from './solver.js';
import { solveOptimal } from './optimal.js';
import { makePuzzle } from './generate.js';
import { LEVELS, SOLUTIONS } from './levels-data.js';
import { CLASSIC_START, START_NOTE, DOCS, labelFor } from './content.js';
import { WOOD_KEYS, PEG_KEYS } from './art.js';
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { render, docMetrics, holeAt, pitchFor } from './view.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PLAYS = 3, AUTO_REVEAL_SECS = 2, PLAN_NODE_CAP = 1200000;
const DAILY_BOARDS = ['english', 'french', 'triangle', 'diamond', 'cross'];
const SPARK = [[255, 226, 140], [255, 250, 220], [150, 205, 255]];
const clone = (v) => JSON.parse(JSON.stringify(v));

export function dailyInfo(day) {
  const bid = DAILY_BOARDS[((day % 5) + 5) % 5], tri = bid === 'triangle', lo = tri ? 6 : 8, hi = tri ? 10 : 14;
  const pegs = lo + ((day * 7) % (hi - lo + 1) + (hi - lo + 1)) % (hi - lo + 1);
  return { bid, pegs, seed: (Math.imul(day + 12345, 2654435761) >>> 0) ^ 0x5bd1e995 };
}

export function createGame(env) {
  const { storage, audio, monetization, config } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const heroStart = fullBoard(boardById('english'), 16), heroRoute = SOLUTIONS['english:16'].map(([from, over, to]) => ({ from, over, to }));
  const S = {
    scene: 'title', t: 0, sceneT: 1, g: null, saved: null,
    sound: true, calm: false, targetsOn: true, wood: 'maple', pegs: 'sapphire', textScaleIdx: 0, autoThinkIdx: 1,
    progress: { stars: {}, classic: {}, played: 0 }, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 },
    tab: 1, demoPlays: 0, dev: config.dev === true,
    docId: 'rules', docPage: 0, docScroll: 0, confirmReset: false,
    anim: null, hint: null, drag: null, shake: null, fx: [], heroFx: [], sinceCapture: 1, msg: null, kb: false, cursor: 16, sndq: [],
    wantHint: false, planStatus: 'idle',
    autoMode: false, autoPhase: null, autoTimer: 0, autoPaused: false,
    hero: { i: 0, t: 0, anim: null, holes: heroStart.slice() },
  };
  const syncZoom = () => { config.textScale = TEXT_SCALES[S.textScaleIdx]; };   // the kit's unlock overlay follows it
  S.unlocked = (bid, i) => i === 0 || (S.progress.stars[`${bid}:${i - 1}`] ?? 0) > 0 || S.dev;
  let lastScene = S.scene, pl = null, pend = null, drag0 = null, dailyCache = null;

  // ---- persistence ------------------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (!v) return; S.sound = v.sound ?? true; S.calm = v.calm ?? false; S.targetsOn = v.targetsOn ?? true; if (WOOD_KEYS.includes(v.wood)) S.wood = v.wood; if (PEG_KEYS.includes(v.pegs)) S.pegs = v.pegs; S.textScaleIdx = clamp(v.textScaleIdx ?? 0, 0, TEXT_SCALES.length - 1); syncZoom(); S.autoThinkIdx = clamp(v.autoThinkIdx ?? 1, 0, THINK_STEPS.length - 1); audio.setMuted?.(!S.sound); });
  storage.get('progress', null).then((v) => { if (v) S.progress = { stars: { ...(v.stars || {}), ...S.progress.stars }, classic: { ...(v.classic || {}) , ...S.progress.classic }, played: Math.max(v.played ?? 0, S.progress.played) }; });
  storage.get('daily', null).then((v) => { if (v) { S.daily.solvedDay = v.solvedDay ?? -1; S.daily.streak = v.streak ?? 0; } });
  storage.get('demoPlays', 0).then((v) => { S.demoPlays = Math.max(S.demoPlays, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.phase !== 'over' && S.scene === 'title') S.saved = v; });
  const savePrefs = () => { syncZoom(); storage.set('prefs', { sound: S.sound, calm: S.calm, targetsOn: S.targetsOn, wood: S.wood, pegs: S.pegs, textScaleIdx: S.textScaleIdx, autoThinkIdx: S.autoThinkIdx }); };
  const saveProgress = () => storage.set('progress', S.progress);
  const saveGame = () => { if (S.scene === 'play' && !S.autoMode && S.g && S.g.phase !== 'over' && !S.g.watched) { S.saved = { g: clone(S.g) }; storage.set('save', S.saved); } };
  const clearSave = () => { S.saved = null; storage.remove('save'); };

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.sound) audio.tone(o); };
  const later = (delay, o) => S.sndq.push({ t: delay, o });
  const sTap = () => tone({ freq: 700, to: 560, dur: 0.05, type: 'sine', vol: 0.07 });
  const sLift = () => tone({ freq: 520, to: 880, dur: 0.09, type: 'sine', vol: 0.07 });
  const sLand = (n) => { tone({ freq: 240, to: 90, dur: 0.08, type: 'triangle', vol: 0.16 }); later(0.04, { freq: 1500 + n * 140, to: 1180 + n * 100, dur: 0.22, type: 'sine', vol: 0.06 }); later(0.07, { freq: 2250 + n * 200, to: 1900, dur: 0.14, type: 'sine', vol: 0.025 }); };
  const sNo = () => tone({ freq: 190, to: 130, dur: 0.14, type: 'triangle', vol: 0.07 });
  const sWin = () => [523, 659, 784, 1047, 1319].forEach((f, k) => later(k * 0.11, { freq: f, to: f * 1.005, dur: 0.3, type: 'triangle', vol: 0.09 }));
  const sEnd = () => { tone({ freq: 392, to: 330, dur: 0.3, type: 'triangle', vol: 0.08 }); later(0.18, { freq: 330, to: 262, dur: 0.4, type: 'triangle', vol: 0.07 }); };
  const say = (text, hold = 5) => { S.msg = { text, t: 0, hold }; };

  // ---- starting games --------------------------------------------------------------------------------------------------------------------
  function gate() {
    if (config.demo && S.demoPlays >= DEMO_PLAYS) { S.scene = 'demo-limit'; return false; }
    if (config.demo) { S.demoPlays += 1; storage.set('demoPlays', S.demoPlays); }
    return true;
  }
  function reset(g, scene = 'play') {
    pl = null; pend = null; drag0 = null;
    Object.assign(S, { g, scene, anim: null, hint: null, drag: null, shake: null, fx: [], msg: null, wantHint: false, planStatus: 'idle', autoMode: false, autoPhase: null, autoTimer: 0, autoPaused: false, sinceCapture: 1, cursor: boardById(g.bid).centre });
  }
  const mkGame = (o) => ({ mode: 'puzzle', bid: 'english', level: 0, holes: [], start: [], hist: [], sel: -1, phase: 'play', startHole: -1, hints: 0, par: null, result: null, watched: false, captured: 0, ...o });
  function startPuzzle(bid, i) {
    if (!gate()) return;
    const b = boardById(bid), L = LEVELS[bid][i], holes = new Array(b.n).fill(0); L.pegs.forEach((k) => (holes[k] = 1));
    reset(mkGame({ mode: 'puzzle', bid, level: i, holes, start: holes.slice(), par: L.par }));
    say('Jump a peg over a neighbour. Leave just one.');
    monetization.track('puzzle_start', { board: bid, level: i + 1 });
  }
  function startClassic(bid) {
    if (!gate()) return;
    const b = boardById(bid);
    reset(mkGame({ mode: 'classic', bid, holes: new Array(b.n).fill(1), phase: 'setup' }));
    S.cursor = CLASSIC_START[bid];
    say(`Tap a peg to take it out and begin. ${START_NOTE[bid]}`, 9);
    monetization.track('classic_start', { board: bid });
  }
  function dailyPuzzle() {
    const day = S.daily.day;
    if (dailyCache && dailyCache.day === day) return dailyCache;
    const info = dailyInfo(day), b = boardById(info.bid), holes = makePuzzle(b, info.pegs, info.seed, 6);
    let par = null; const s = createSolver(b, holes); while (!s.done) s.step(5000); if (s.solution) par = countMoves(s.solution);
    return (dailyCache = { day, bid: info.bid, holes, par });
  }
  function startDaily() {
    if (!gate()) return;
    const d = dailyPuzzle();
    reset(mkGame({ mode: 'daily', bid: d.bid, holes: d.holes.slice(), start: d.holes.slice(), par: d.par }));
    say(S.daily.solvedDay === S.daily.day ? 'Solved today. Play it again for practice.' : 'Today\'s puzzle is the same for everyone. Leave one peg.');
  }
  function startAuto() {
    const b = boardById('english');
    reset(mkGame({ mode: 'classic', bid: 'english', holes: fullBoard(b, 16), startHole: 16, watched: true, autoDemo: true }));
    beginAuto();
    say('Auto Play: the solver finds a way to a single peg. Watch, then compare with your own idea.', 99);
  }
  function beginAuto() {
    S.autoMode = true; S.autoPhase = null; S.autoPaused = false; S.hint = null; S.wantHint = false; pl = null; S.g.sel = -1; ensurePlan();
  }
  function resume() {
    const v = S.saved; reset(clone(v.g)); say('Game restored.');
  }

  // ---- the solver as a planner (hints and Auto Play) ----------------------------------------------------------------------------------
  function bakedRoute(g) {
    if (g.mode !== 'classic' || g.startHole < 0) return null;
    const r = SOLUTIONS[`${g.bid}:${g.startHole}`]; if (!r) return null;
    const b = boardById(g.bid), h = fullBoard(b, g.startHole), want = keyOf(g.holes);
    for (let i = 0; i <= r.length; i++) { if (keyOf(h) === want) return r.slice(i).map(([from, over, to]) => ({ from, over, to })); if (i < r.length) applyJump(h, { from: r[i][0], over: r[i][1], to: r[i][2] }); }
    return null;
  }
  function ensurePlan() {
    const g = S.g, key = keyOf(g.holes);
    if (pl && pl.key === key) return;
    const b = boardById(g.bid); pl = { key, status: 'working', jumps: null, solver: null, left: 1 };
    const baked = bakedRoute(g);
    if (baked) { pl.jumps = baked; pl.status = 'ready'; }
    else if (count(g.holes) <= 14) { const r = solveOptimal(b, g.holes, { maxStates: 60000 }); if (r) { pl.jumps = r.jumps; pl.status = 'ready'; } }
    if (pl.status === 'working') pl.solver = createSolver(b, g.holes);
    S.planStatus = pl.status;
  }
  function planTick() {
    if (!pl || pl.status !== 'working') return;
    const s = pl.solver; s.step(3500);
    if (s.done || s.nodes > PLAN_NODE_CAP) {
      if (s.solution) { pl.jumps = s.solution; pl.status = 'ready'; }
      else { pl.jumps = s.best.path; pl.left = s.best.left; pl.status = 'partial'; pl.exhaustive = s.done; }
      pl.solver = null; S.planStatus = pl.status;
    }
  }
  const planAdvance = (j) => {
    if (pl && pl.jumps && pl.jumps.length && pl.jumps[0].from === j.from && pl.jumps[0].to === j.to) { pl.jumps = pl.jumps.slice(1); pl.key = keyOf(S.g.holes); } else pl = null;
    S.planStatus = pl ? pl.status : 'idle';
  };

  // ---- moves ---------------------------------------------------------------------------------------------------------------------------
  const finishAnim = () => { if (S.anim) { S.anim.t = S.anim.dur; afterAnim(); } };
  const dur = (d) => (S.calm ? d * 0.6 : d);
  function sparkle(at, n, dst = S.fx) {
    const b = boardById(S.g ? S.g.bid : 'english');
    const p = b.pos[at]; for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + at; dst.push({ x: p.x, y: p.y, vx: Math.cos(a) * (0.9 + (k % 3) * 0.5), vy: Math.sin(a) * (0.9 + (k % 3) * 0.5) - 0.6, life: 0.7 + (k % 4) * 0.12, max: 0.7 + (k % 4) * 0.12, c: SPARK[k % 3] }); }
    if (dst.length > 80) dst.splice(0, dst.length - 80);
  }
  function doJump(j, silent = false) {
    finishAnim();
    const g = S.g, chain = g.hist.length && g.hist[g.hist.length - 1].to === j.from;
    g.hist.push({ from: j.from, over: j.over, to: j.to }); applyJump(g.holes, j); g.captured += 1;
    S.anim = { j, t: 0, dur: dur(0.46), dir: 1 }; S.hint = null; S.drag = null; pend = null; drag0 = null; S.wantHint = false;
    if (!silent) { sLift(); }
    const n = chain ? Math.min(6, countChain(g)) : 0; S.lastN = n;
    g.sel = -1;
    if (!S.autoMode) planAdvance(j);
  }
  const countChain = (g) => { let c = 0; for (let i = g.hist.length - 1; i >= 0; i--) { c++; if (i === 0 || g.hist[i - 1].to !== g.hist[i].from) break; } return c; };
  function afterAnim() {
    const a = S.anim; if (!a) return; S.anim = null;
    const g = S.g, b = boardById(g.bid);
    if (a.dir > 0) {
      sLand(S.lastN ?? 0); sparkle(a.j.over, 9); S.sinceCapture = 0;
      if (!S.autoMode) {
        const more = jumpsFrom(b, g.holes, a.j.to);
        if (more.length) { g.sel = a.j.to; say('The same peg can jump again. Tap a golden hole, or tap elsewhere to put it down.', 4); }
      }
      if (!legalJumps(b, g.holes).length) endGame();
      else saveGame();
    }
  }
  function undo() {
    const g = S.g; if (!g.hist.length) { say('Nothing to take back yet.', 3); return; }
    finishAnim();
    const j = g.hist.pop(); undoJump(g.holes, j); g.captured = Math.max(0, g.captured - 1); g.sel = -1; g.phase = 'play'; g.result = null;
    S.anim = { j, t: 0, dur: dur(0.3), dir: -1 }; S.hint = null; pl = null; S.planStatus = 'idle'; sTap(); say('Jump taken back.', 3); saveGame();
  }
  function removeFirst(i) {
    const g = S.g; g.holes[i] = 0; g.startHole = i; g.phase = 'play'; g.start = g.holes.slice(); sparkle(i, 10); S.sinceCapture = 0; sLand(0); saveGame();
    say(i === CLASSIC_START[g.bid] ? 'Good start. Now jump a peg over a neighbour.' : 'Now jump a peg over a neighbour.', 5);
    if (!legalJumps(boardById(g.bid), g.holes).length) endGame();
  }
  function endGame() {
    const g = S.g, left = count(g.holes), moves = countMoves(g.hist);
    g.phase = 'over'; g.sel = -1; S.hint = null; S.sceneT = 0;
    const r = { left, moves, stars: 0, hinted: g.hints > 0, perfectStart: g.mode === 'classic' && g.startHole >= 0 && g.holes[g.startHole] === 1, newBest: false };
    if (!g.watched && !S.autoMode) {
      r.stars = pegStars(left); if (r.hinted && left === 1) r.stars = 2;
      if (g.mode === 'puzzle') { const k = `${g.bid}:${g.level}`; if ((S.progress.stars[k] ?? 0) < r.stars) S.progress.stars[k] = r.stars; }
      if (g.mode === 'classic') { const best = S.progress.classic[g.bid]; if (best === undefined || left < best) { S.progress.classic[g.bid] = left; r.newBest = best !== undefined; } }
      if (g.mode === 'daily' && left === 1 && S.daily.solvedDay !== S.daily.day) { S.daily.streak = S.daily.solvedDay === S.daily.day - 1 ? S.daily.streak + 1 : 1; S.daily.solvedDay = S.daily.day; storage.set('daily', { solvedDay: S.daily.solvedDay, streak: S.daily.streak }); }
      S.progress.played += 1; saveProgress(); clearSave();
      monetization.track('game_end', { mode: g.mode, board: g.bid, left, moves });
    }
    g.result = r;
    if (left === 1) { sWin(); for (let k = 0; k < 3; k++) sparkle(boardById(g.bid).centre, 12); } else sEnd();
  }

  // ---- taps on the board -----------------------------------------------------------------------------------------------------------------
  function tapHole(i) {
    const g = S.g, b = boardById(g.bid);
    if (g.phase === 'setup') { if (g.holes[i]) removeFirst(i); return; }
    if (g.phase !== 'play') return;
    if (g.sel >= 0) { const j = findJump(b, g.holes, g.sel, i); if (j) { doJump(j); return; } }
    if (g.holes[i]) {
      if (jumpsFrom(b, g.holes, i).length) { g.sel = g.sel === i ? -1 : i; if (g.sel >= 0) sLift(); else sTap(); }
      else { g.sel = -1; S.shake = { i, t: 0 }; sNo(); say('That peg has no jump right now. It needs a neighbour and an empty hole beyond it.', 4); }
    } else { if (g.sel >= 0) sTap(); g.sel = -1; }
  }

  // ---- hints and Auto Play --------------------------------------------------------------------------------------------------------------
  function askHint() {
    const g = S.g; if (g.phase !== 'play') return;
    if (!legalJumps(boardById(g.bid), g.holes).length) return;
    S.wantHint = true; ensurePlan(); sTap();
  }
  function showHint() {
    const g = S.g; S.wantHint = false;
    if (!pl || !pl.jumps || !pl.jumps.length) { say('No jump leads anywhere useful from here.', 4); return; }
    const j = pl.jumps[0]; g.hints += 1; g.sel = -1; S.hint = { from: j.from, to: j.to, t: 0 };
    if (pl.status === 'ready') say('Hint: move the ringed peg to the glowing hole. This route reaches one peg.', 6);
    else say(pl.exhaustive ? `Hint: from here one peg is out of reach. This line leaves ${pl.left} at best. Undo a few jumps to try for one.` : `Hint: no route to one peg was found. This line leaves ${pl.left}.`, 8);
  }
  function autoTick(dt) {
    if (S.autoPhase === 'reveal') { S.autoTimer -= dt; if (S.autoTimer > 0) return; const j = pl.jumps[0]; S.autoPhase = null; S.hint = null; doJump(j); pl.jumps = pl.jumps.slice(1); pl.key = keyOf(S.g.holes); return; }
    if (S.autoPhase === 'think') { S.autoTimer -= dt; if (S.autoTimer > 0) return; const j = pl.jumps[0]; S.hint = { from: j.from, to: j.to, t: 0 }; S.autoPhase = 'reveal'; S.autoTimer = AUTO_REVEAL_SECS; say('This is the jump. Compare it with your own idea.', AUTO_REVEAL_SECS + 0.5); return; }
    ensurePlan(); planTick();
    if (!pl || pl.status === 'working') return;
    if (!pl.jumps || !pl.jumps.length) { if (!legalJumps(boardById(S.g.bid), S.g.holes).length) endGame(); else { S.autoMode = false; say('No further route found.'); } return; }
    S.autoPhase = 'think'; S.autoTimer = THINK_STEPS[S.autoThinkIdx];
    say(`Thinking… ${pl.status === 'ready' ? 'the way to one peg is clear.' : ''}`, S.autoTimer + 3);
  }
  function exitToTitle() { saveGame(); S.autoMode = false; S.autoPhase = null; S.autoPaused = false; S.hint = null; S.msg = null; S.anim = null; S.scene = 'title'; pl = null; }
  function watchHere() {
    const g = S.g; if (g.phase !== 'play') return; g.watched = true; clearSave(); finishAnim(); S.anim = null; beginAuto(); say('Watching from this position. Your stars are not affected, but this attempt will not count.', 8);
  }

  // ---- scenes ---------------------------------------------------------------------------------------------------------------------------
  function updateTitle(dt, tap) {
    if (!tap) return;
    const T = lay().title(!!S.saved), R = T.rows, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.lockupHit)) env.openArcforgeHome?.();
    else if (R.resume && hit(R.resume)) resume();
    else if (hit(R.puzzles)) { S.scene = 'puzzles'; }
    else if (hit(R.classic)) S.scene = 'classic';
    else if (hit(R.daily)) startDaily();
    else if (hit(R.auto)) startAuto();
    else if (hit(R.howto)) openDoc('howto');
    else if (hit(R.rules)) openDoc('rules');
    else if (hit(R.about)) openDoc('about');
    else if (hit(R.settings)) { S.scene = 'settings'; S.confirmReset = false; }
  }
  function openDoc(id) { S.docId = id; S.docPage = 0; S.docScroll = 0; S.scene = 'doc'; drag0 = null; }
  function updateHero(dt) {
    const h = S.hero;
    if (S.calm) { if (h.i !== 10) { h.holes = heroStart.slice(); for (let k = 0; k < 10; k++) applyJump(h.holes, heroRoute[k]); h.i = 10; h.anim = null; } return; }
    h.t += dt;
    if (h.anim) { h.anim.t += dt; if (h.anim.t >= h.anim.dur) { sparkle2(h.anim.j.over); h.anim = null; } return; }
    if (h.i >= 15) { if (h.t > 3) { h.i = 0; h.t = 0; h.holes = heroStart.slice(); } return; }
    if (h.t > 1.3) { const j = heroRoute[h.i]; h.anim = { j, t: 0, dur: 0.55, dir: 1 }; applyJump(h.holes, j); h.i++; h.t = 0; }
  }
  function sparkle2(at) { const p = boardById('english').pos[at]; for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28; S.heroFx.push({ x: p.x, y: p.y, vx: Math.cos(a), vy: Math.sin(a) - 0.5, life: 0.7, max: 0.7, c: SPARK[k % 3] }); } }

  function updateSelect(tap, which) {
    if (!tap) return;
    const C = lay().select;
    if (inRect(C.back, tap.x, tap.y)) { S.scene = 'title'; sTap(); return; }
    if (which === 'puzzles') {
      C.tabs.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { S.tab = i; sTap(); } });
      C.grid.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { if (S.unlocked(BOARDS[S.tab].id, i)) startPuzzle(BOARDS[S.tab].id, i); else { say('Clear the previous puzzle to open this one.', 3); sNo(); } } });
    } else C.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) startClassic(BOARDS[i].id); });
  }

  let sdrag = null;
  function updateDoc(tap, input) {
    const D = lay().doc, p = input.pointer, keys = input.keys.pressed, max = docMetrics.max;
    const set = (v) => { S.docScroll = clamp(v, 0, docMetrics.max); };
    if (wheelInput.dy) { set(S.docScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) set(S.docScroll + 70); if (keys.has('ArrowUp')) set(S.docScroll - 70);
    if (keys.has('PageDown')) set(S.docScroll + docMetrics.view * 0.9); if (keys.has('PageUp')) set(S.docScroll - docMetrics.view * 0.9);
    if (p.pressed && max > 0) { if (inRect(D.scrollbar, p.x, p.y)) sdrag = { bar: true }; else if (inRect(D.viewport, p.x, p.y)) sdrag = { y0: p.y, s0: S.docScroll }; }
    if (sdrag) { if (!p.down) sdrag = null; else if (sdrag.bar) set(((p.y - D.scrollbar.y) / D.scrollbar.h) * max); else set(sdrag.s0 - (p.y - sdrag.y0)); }
    S.docScroll = clamp(S.docScroll, 0, docMetrics.max);
    if (!tap) return;
    const pages = DOCS[S.docId].pages.length;
    if (inRect(D.nav.back, tap.x, tap.y)) { S.scene = 'title'; sdrag = null; sTap(); }
    else if (inRect(D.nav.prev, tap.x, tap.y)) { if (S.docPage > 0) { S.docPage--; S.docScroll = 0; sTap(); } }
    else if (inRect(D.nav.next, tap.x, tap.y)) { if (S.docPage < pages - 1) { S.docPage++; S.docScroll = 0; sTap(); } else { S.scene = 'title'; sTap(); } }
    else if (inRect(D.header.dec, tap.x, tap.y) && S.textScaleIdx > 0) { S.textScaleIdx--; S.docScroll = 0; savePrefs(); sTap(); }
    else if (inRect(D.header.inc, tap.x, tap.y) && S.textScaleIdx < TEXT_SCALES.length - 1) { S.textScaleIdx++; S.docScroll = 0; savePrefs(); sTap(); }
  }

  function updateSettings(tap) {
    if (!tap) return;
    const C = lay().settings, hit = (r) => inRect(r, tap.x, tap.y), R = C.rows;
    if (hit(C.back)) { S.scene = 'title'; S.confirmReset = false; sTap(); return; }
    if (!hit(R.reset)) S.confirmReset = false;
    if (hit(R.sound)) { S.sound = !S.sound; audio.setMuted?.(!S.sound); sTap(); }
    else if (hit(R.calm)) { S.calm = !S.calm; sTap(); }
    else if (hit(R.targets)) { S.targetsOn = !S.targetsOn; sTap(); }
    else if (hit(R.wood)) { S.wood = WOOD_KEYS[(WOOD_KEYS.indexOf(S.wood) + 1) % WOOD_KEYS.length]; sTap(); }
    else if (hit(R.pegs)) { S.pegs = PEG_KEYS[(PEG_KEYS.indexOf(S.pegs) + 1) % PEG_KEYS.length]; sTap(); }
    else if (hit(R.text)) { S.textScaleIdx = (S.textScaleIdx + 1) % TEXT_SCALES.length; sTap(); }
    else if (hit(R.reset)) { if (S.confirmReset) { S.progress = { stars: {}, classic: {}, played: 0 }; S.daily.solvedDay = -1; S.daily.streak = 0; saveProgress(); storage.set('daily', { solvedDay: -1, streak: 0 }); clearSave(); S.confirmReset = false; say('Progress erased.', 3); } else S.confirmReset = true; }
    savePrefs();
  }

  function playBox() { const B = lay().play.board; return { b: boardById(S.g.bid), cx: B.cx, cy: B.cy, D: B.D }; }
  function updatePlay(dt, input, tap) {
    const g = S.g, P = lay().play, p = input.pointer, hitB = (r) => tap && inRect(r, tap.x, tap.y);
    if (S.autoMode) {
      if (hitB(P.autoBtn.exit)) { exitToTitle(); return; }
      if (hitB(P.autoBtn.pause)) { S.autoPaused = !S.autoPaused; return; }
      if (hitB(P.autoBtn.dec)) { if (S.autoThinkIdx > 0) { S.autoThinkIdx--; savePrefs(); } return; }
      if (hitB(P.autoBtn.inc)) { if (S.autoThinkIdx < THINK_STEPS.length - 1) { S.autoThinkIdx++; savePrefs(); } return; }
      if (g.phase === 'over') { overTap(tap); return; }
      if (S.autoPaused) return;
      if (S.hint) { S.hint.t += dt; }
      if (S.anim) { S.anim.t += dt; if (S.anim.t >= S.anim.dur) afterAnim(); return; }
      autoTick(dt); return;
    }
    if (S.hint) { S.hint.t += dt; if (S.hint.t > 8) S.hint = null; }
    if (S.shake) { S.shake.t += dt; if (S.shake.t > 0.35) S.shake = null; }
    if (S.anim) { S.anim.t += dt; if (S.anim.t >= S.anim.dur) afterAnim(); }
    if (S.wantHint) { planTick(); if (pl && pl.status !== 'working') showHint(); }
    if (g.phase === 'over') { overTap(tap); return; }
    // buttons
    if (tap) {
      const B = P.btn;
      if (inRect(B.menu, tap.x, tap.y)) { exitToTitle(); return; }
      if (inRect(B.undo, tap.x, tap.y)) { undo(); return; }
      if (inRect(B.restart, tap.x, tap.y)) { restartGame(); return; }
      if (inRect(B.hint, tap.x, tap.y)) { askHint(); return; }
      if (inRect(B.auto, tap.x, tap.y)) { watchHere(); return; }
    }
    // the board: press selects (and starts a drag), a press on a golden hole jumps, release after a drag drops
    const bx = playBox();
    if (p.pressed) {
      const i = holeAt(bx, p.x, p.y);
      if (i >= 0) {
        finishAnim();
        const wasSel = g.sel; tapHole(i);
        if (g.phase === 'play' && g.sel === i && wasSel !== i) pend = { from: i, x0: p.x, y0: p.y };
      } else if (g.phase === 'play') { if (g.sel >= 0) sTap(); g.sel = -1; }
    }
    if (pend) {
      if (p.down) { if (!S.drag && Math.hypot(p.x - pend.x0, p.y - pend.y0) > 18) S.drag = { from: pend.from, x: p.x, y: p.y }; if (S.drag) { S.drag.x = p.x; S.drag.y = p.y; } }
      if (p.released || !p.down) {
        if (S.drag) { const i = holeAt(bx, p.x, p.y + pitchFor(bx.b, bx.D) * 0.35), j = i >= 0 ? findJump(bx.b, g.holes, pend.from, i) : null; S.drag = null; pend = null; if (j) doJump(j); }
        else pend = null;
      }
    }
  }
  function restartGame() {
    const g = S.g; if (g.autoDemo) { startAuto(); return; }
    if (g.mode === 'puzzle') { reset(mkGame({ mode: 'puzzle', bid: g.bid, level: g.level, holes: g.start.slice(), start: g.start.slice(), par: g.par })); say('Back to the start.', 3); }
    else if (g.mode === 'daily') { reset(mkGame({ mode: 'daily', bid: g.bid, holes: g.start.slice(), start: g.start.slice(), par: g.par })); say('Back to the start.', 3); }
    else { const b = boardById(g.bid); reset(mkGame({ mode: 'classic', bid: g.bid, holes: new Array(b.n).fill(1), phase: 'setup' })); S.cursor = CLASSIC_START[g.bid]; say('Tap a peg to take it out and begin.', 5); }
    sTap();
  }
  function overTap(tap) {
    if (!tap || S.sceneT < 0.5) return;
    const C = lay().result, g = S.g, r = g.result, hit = (x) => inRect(x, tap.x, tap.y);
    if (hit(C.primary)) {
      if (g.mode === 'puzzle' && r.stars > 0 && g.level < 11 && !g.watched) startPuzzle(g.bid, g.level + 1);
      else if (g.autoDemo) startAuto();
      else if (g.watched) restartGame();
      else if (g.mode === 'classic' || g.mode === 'puzzle' || g.mode === 'daily') restartGame();
    } else if (hit(C.second)) {
      if (r.left > 1 && !g.watched) { g.phase = 'play'; undo(); } else restartGame();
    } else if (hit(C.third)) {
      if (g.mode === 'daily' && r.left === 1) env.share(`Peg Solitaire daily puzzle: solved in ${r.moves} moves (par ${g.par}). Streak ${S.daily.streak}.`);
      else { S.autoMode = false; S.scene = g.mode === 'classic' ? 'classic' : 'puzzles'; if (g.mode === 'puzzle') S.tab = BOARDS.findIndex((b) => b.id === g.bid); }
    } else if (hit(C.menu)) { S.autoMode = false; S.scene = 'title'; }
  }

  // ---- keyboard (web demo): arrows move a cursor over the holes, Space / Enter acts on it ----------------------------------------------------
  function keyboard(input) {
    const k = input.keys.pressed, sc = S.scene;
    if (input.pointer.pressed) { S.kb = false; return null; }
    if (sc !== 'play') { if (k.has('Escape') && sc !== 'title') return { x: sc === 'doc' ? lay().doc.nav.back.x + 5 : (sc === 'settings' ? lay().settings.back.x + 5 : lay().select.back.x + 5), y: sc === 'doc' ? lay().doc.nav.back.y + 5 : (sc === 'settings' ? lay().settings.back.y + 5 : lay().select.back.y + 5) }; return null; }
    const g = S.g; if (!g || S.autoMode) return null;
    if (k.has('Escape')) return { x: lay().play.btn.menu.x + 5, y: lay().play.btn.menu.y + 5 };
    if (k.has('KeyU')) return { x: lay().play.btn.undo.x + 5, y: lay().play.btn.undo.y + 5 };
    if (k.has('KeyH')) return { x: lay().play.btn.hint.x + 5, y: lay().play.btn.hint.y + 5 };
    const b = boardById(g.bid); let dx = 0, dy = 0; if (!b.pos[S.cursor]) S.cursor = b.centre;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) {
      S.kb = true; const c = b.pos[S.cursor]; let best = -1, bs = Infinity;
      b.pos.forEach((q, i) => { if (i === S.cursor) return; const ax = (q.x - c.x) * dx + (q.y - c.y) * dy, perp = Math.abs((q.x - c.x) * dy) + Math.abs((q.y - c.y) * dx); if (ax > 0.3 && ax + perp * 1.6 < bs) { bs = ax + perp * 1.6; best = i; } });
      if (best >= 0) S.cursor = best; return null;
    }
    if (k.has('Enter') || k.has('Space')) { S.kb = true; const B = lay().play.board, P = pitchFor(b, B.D), q = b.pos[S.cursor]; return { x: B.cx + q.x * P, y: B.cy + q.y * P, board: true }; }
    return null;
  }

  // Scripted states for the verification matrix and the store screenshots (dev / ?shot=1 only; never used in play).
  function debugScript(name, n) {
    const g = S.g; if (!g) return; const b = boardById(g.bid);
    const playN = (k) => { for (let i = 0; i < k; i++) { const js = legalJumps(b, g.holes); if (!js.length) break; doJump(js[(i * 5) % js.length]); finishAnim(); } };
    if (name === 'mid') { if (g.phase === 'setup') removeFirst(CLASSIC_START[g.bid]); playN(n); S.hint = null; const i = g.holes.findIndex((v, k) => v && jumpsFrom(b, g.holes, k).length); if (i >= 0) g.sel = i; }
    else if (name === 'pick') { const i = g.holes.findIndex((v, k) => v && jumpsFrom(b, g.holes, k).length); if (i >= 0) g.sel = i; }
    else if (name === 'hint') { askHint(); for (let k = 0; k < 400 && S.wantHint; k++) { planTick(); if (pl && pl.status !== 'working') showHint(); } }
    else if (name === 'result') { const s = createSolver(b, g.holes); while (!s.done) s.step(5000); for (const j of s.solution ?? []) { doJump(j); finishAnim(); } }
    else if (name === 'lose') { playN(80); }
    else if (name === 'autosteps') { ensurePlan(); for (let i = 0; i < 600 && pl.status === 'working'; i++) planTick(); for (let i = 0; i < n && pl.jumps && pl.jumps.length; i++) { const j = pl.jumps[0]; doJump(j); pl.jumps = pl.jumps.slice(1); pl.key = keyOf(g.holes); finishAnim(); } if (pl.jumps && pl.jumps.length) { S.hint = { from: pl.jumps[0].from, to: pl.jumps[0].to, t: 0 }; S.autoPhase = 'reveal'; S.autoTimer = 1.5; say('This is the jump. Compare it with your own idea.', 30); } }
    S.anim = null; S.fx = []; S.sinceCapture = 1;
  }

  return {
    update(dt, input) {
      S.t += dt;
      if (S.scene !== lastScene) { lastScene = S.scene; S.sceneT = 0; } else S.sceneT += dt;
      if (S.scene !== 'doc') wheelInput.dy = 0;
      const frozen = S.autoMode && S.autoPaused && S.scene === 'play';
      if (!frozen) {
        if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
        for (const q of S.sndq) q.t -= dt;
        while (S.sndq.length && S.sndq[0].t <= 0) tone(S.sndq.shift().o);
        for (const list of [S.fx, S.heroFx]) { for (const f of list) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 1.6 * dt; } for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1); }
        S.sinceCapture += dt;
      }
      if (S.scene === 'title') updateHero(dt);
      const p = input.pointer, kbd = keyboard(input);
      let tap = p.pressed ? { x: p.x, y: p.y } : kbd && kbd.x !== undefined ? kbd : null;
      if (kbd && kbd.board && S.scene === 'play') { const B = playBox(); const i = holeAt(B, kbd.x, kbd.y); if (i >= 0 && !S.autoMode) { finishAnim(); tapHole(i); } tap = null; }
      switch (S.scene) {
        case 'title': updateTitle(dt, tap); break;
        case 'puzzles': updateSelect(tap, 'puzzles'); break;
        case 'classic': updateSelect(tap, 'classic'); break;
        case 'doc': updateDoc(tap, input); break;
        case 'settings': updateSettings(tap); break;
        case 'play': updatePlay(dt, input, kbd && kbd.board ? null : tap); break;
        case 'demo-limit': if (tap && inRect(lay().simple.back, tap.x, tap.y)) S.scene = 'title'; break;
        default: break;
      }
    },
    render(ctx, view) {
      const w = view?.width ?? meta.width, h = view?.height ?? meta.height, L = layoutFor(w, h);
      meta.previewBadge = { x: L.ins.l + (L.backBox.w ? L.backBox.w + 10 : 16), y: L.ins.t + 12, align: 'left' };   // beside the host back button, clear of titles and boards
      render(ctx, S, L);
    },
    getState: () => S,
    // Free preview counts real play only: a live puzzle / classic / daily game. Menus, Rules, Settings, Auto Play, results and the demo-limit screen are exempt.
    isPreviewExempt() { return !(S.scene === 'play' && !S.autoMode && S.g && S.g.phase !== 'over'); },
    // dev / verification hook (main.js, only with ?dev=1 or ?shot=1): put the game into a named screen
    debug: { layout: () => lay(), startPuzzle, startClassic, startDaily, startAuto, openDoc, S, script: (name, n = 8) => debugScript(name, n), holeXY: (i) => { const B = lay().play.board, b = boardById(S.g.bid), P = pitchFor(b, B.D); return { x: B.cx + b.pos[i].x * P, y: B.cy + b.pos[i].y * P }; } },
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
