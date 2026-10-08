// Russian Loto: Barrels. State and flow. Drawing lives in view.js; the rules engine in rules.js. This is the only file that mutates
// `state` (apart from view.js caching the reference-page height). Deterministic: randomness from env.rng (or the daily seed), time from dt.
//
// How a round plays: a keg tumbles out of the bag every few seconds. TAP the matching number on your cards (while that keg is still among
// the last few called) to cover it with a chip. Claim ROW / TWO ROWS / LOTO when you have them, before the computer players do.
// Watch & Learn plays a whole round itself: THINK -> REVEAL -> ACT. Pause freezes everything.
import { createRng, seedFrom } from '../kit/rng.js';
import { inRect, TEXT_SCALES, THINK_STEPS, AUTO_REVEAL_SECS, AUTO_ACT_SECS, SETUP_KEYS, DUO_SETUP_KEYS, layoutFor } from './layout.js';
import {
  KEGS, MAX_CARDS, MAX_DUO_CARDS, SCORE, STAGE_POINTS, LOCKOUT_SECS, HINTS_PER_ROUND, GOALS, PACES, SKILLS, CPU_NAMES, byId, colOf,
  dealCards, freshMarks, newBag, reached, claimable, activeStages, endStage, tapOutcome, deadCells, stagePossible, cellsFor, markPoints, lotoBonus,
  cpuReact, cpuClaimDelay, cpuCards, isOpen,
} from './rules.js';
import { cardGeom, cellAtCard, cellRectOf, THEME_IDS } from './art.js';
import { render } from './view.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
const DEMO_ROUNDS = 3;
const SHOWCASE_SEED_MIN = 777000;       // reserved seeds that open a staged screen for store screenshots
const DROP_SECS = 0.62;                 // a keg tumbles this long before it lands and is called
const STAGE_NAME = { row: 'Row', two: 'Two rows', loto: 'LOTO' };

export function createGame(env) {
  const { rng, storage, audio, config } = env;
  const state = {
    scene: 'menu', t: 0, today: 0, theme: 'felt', sound: true, textIdx: 0,
    cfg: { goal: 'row', pace: 'classic', cards: 2, duoCards: 1, opps: 2, skill: 'normal' },
    mode: 'solo', best: 0, total: 0, roundNo: 0, demoRounds: 0, demoAuto: 0, daily: { day: -1, best: 0, plays: 0, streak: 0, last: -1 },
    coach: false, round: null, page: 0, returnScene: null, refScroll: 0, refMax: 0, refView: 400,
    paused: false, toast: null, parts: [], floats: [], thinkIdx: 1, resetDone: 0, frozen: false, showcaseInit: false, lkDown: false,
  };
  let sfx = [], lastPointer = null, wheelHooked = false, refDrag = null;
  const today = () => Math.floor(config.day ?? 0);
  const nCardsNow = () => { const r = state.round; return r && (state.scene === 'play' || state.scene === 'auto') ? r.players[0].cards.length : state.cfg.cards; };
  const nDuoNow = () => { const r = state.round; return r && state.scene === 'duo' ? r.players[0].cards.length : state.cfg.duoCards; };
  const oppsNow = () => { const r = state.round; return r && (state.scene === 'play' || state.scene === 'auto') ? r.players.length > 1 : false; };
  const lay = () => layoutFor(meta.width, meta.height, nCardsNow(), nDuoNow(), oppsNow());
  const lay2 = (v) => layoutFor(v?.width ?? meta.width, v?.height ?? meta.height, nCardsNow(), nDuoNow(), oppsNow());

  // ---- persistence ----------------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', { theme: state.theme, sound: state.sound, textIdx: state.textIdx, cfg: state.cfg, thinkIdx: state.thinkIdx, coach: state.coach });
  const saveStats = () => storage.set('stats', { best: state.best, total: state.total, roundNo: state.roundNo, daily: state.daily });
  const saveDemo = () => storage.set('demo', { rounds: state.demoRounds, auto: state.demoAuto });
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    const clampI = (v, n, d) => Math.min(Math.max(Number.isInteger(v) ? v : d, 0), n - 1);
    state.theme = THEME_IDS.includes(p.theme) ? p.theme : 'felt'; state.sound = p.sound !== false;
    state.textIdx = clampI(p.textIdx, TEXT_SCALES.length, 0); state.thinkIdx = clampI(p.thinkIdx, THINK_STEPS.length, 1);
    if (p.cfg) {
      const c = state.cfg;
      if (GOALS.some((x) => x.id === p.cfg.goal)) c.goal = p.cfg.goal;
      if (PACES.some((x) => x.id === p.cfg.pace)) c.pace = p.cfg.pace;
      if (SKILLS.some((x) => x.id === p.cfg.skill)) c.skill = p.cfg.skill;
      if (Number.isInteger(p.cfg.cards) && p.cfg.cards >= 1 && p.cfg.cards <= MAX_CARDS) c.cards = p.cfg.cards;
      if (Number.isInteger(p.cfg.duoCards) && p.cfg.duoCards >= 1 && p.cfg.duoCards <= MAX_DUO_CARDS) c.duoCards = p.cfg.duoCards;
      if ([1, 2, 3].includes(p.cfg.opps)) c.opps = p.cfg.opps;
    }
    state.coach = p.coach === true; audio.setMuted(!state.sound);
  });
  storage.get('stats', null).then((s) => { if (s) { state.best = s.best | 0; state.total = s.total | 0; state.roundNo = s.roundNo | 0; if (s.daily) Object.assign(state.daily, s.daily); } });
  storage.get('demo', null).then((d) => { if (d) { state.demoRounds = d.rounds | 0; state.demoAuto = d.auto | 0; } });

  // ---- small helpers ----------------------------------------------------------------------------------------------------------
  const say = (text, kind = 'info', secs = 1.8) => { state.toast = { text, kind, t: 0, max: secs }; };
  const play = (o, delay = 0) => { if (!state.sound) return; if (delay > 0) sfx.push({ at: state.t + delay, o }); else audio.tone(o); };
  const sound = (name, k = 0) => {
    if (name === 'ok') play({ freq: 680, to: 880, dur: 0.09, type: 'sine', vol: 0.12 });
    else if (name === 'chip') { play({ freq: 210, to: 120, dur: 0.07, type: 'triangle', vol: 0.32 }); play({ freq: 1500, to: 900, dur: 0.04, type: 'square', vol: 0.04 }, 0.02); }
    else if (name === 'wrong') play({ freq: 170, to: 100, dur: 0.2, type: 'sawtooth', vol: 0.12 });
    else if (name === 'rattle') for (let i = 0; i < 7; i++) play({ freq: 120 + ((i * 53 + k * 29) % 150), to: 90, dur: 0.05, type: i % 2 ? 'triangle' : 'square', vol: 0.05 + 0.02 * (i % 3) }, i * 0.07);
    else if (name === 'land') { play({ freq: 170, to: 80, dur: 0.1, type: 'triangle', vol: 0.34 }); play({ freq: 330, to: 140, dur: 0.07, type: 'triangle', vol: 0.2 }, 0.09); play({ freq: 880, dur: 0.18, type: 'sine', vol: 0.1 }, 0.14); }
    else if (name === 'stage') [523, 659, 784].forEach((f, i) => play({ freq: f, dur: 0.22, type: 'triangle', vol: 0.18 }, i * 0.09));
    else if (name === 'win') [523, 659, 784, 1046, 1318].forEach((f, i) => play({ freq: f, dur: 0.3, type: 'triangle', vol: 0.2 }, i * 0.11));
    else if (name === 'lose') [392, 330, 262].forEach((f, i) => play({ freq: f, dur: 0.34, type: 'triangle', vol: 0.17 }, i * 0.18));
  };
  const COLS_C = ['#f2b84b', '#e0563c', '#fff4de', '#6fd3b6', '#5fb3ff', '#ff8fb1'];
  const confetti = (x, y, n, big = false) => {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), v = rng.range(90, big ? 540 : 260);
      state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (big ? 280 : 100), rot: rng.range(0, 6.28), vr: rng.range(-8, 8), t: 0, max: rng.range(0.9, big ? 2.6 : 1.4), c: COLS_C[i % COLS_C.length], s: rng.range(8, 15), kind: 'conf' });
    }
  };
  const sparks = (x, y, n) => {
    for (let i = 0; i < n; i++) { const a = rng.range(0, Math.PI * 2), v = rng.range(60, 200); state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: 0, vr: 0, t: 0, max: rng.range(0.4, 0.8), c: '#ffd86a', s: rng.range(5, 9), kind: 'spark' }); }
  };
  const go = (scene) => { state.scene = scene; state.paused = false; state.page = 0; state.refScroll = 0; state.toast = null; };
  const REF_SCENES = new Set(['about', 'howto', 'rules']);
  function refInput(input) {
    const p = input.pointer, k = input.keys.pressed, set = (v) => { state.refScroll = Math.max(0, Math.min(state.refMax || 0, v)); };
    const d = lay().d, q = d.to(p.x, p.y), pn = d.panel;
    if (p.pressed && !state.paused && q.x >= pn.x && q.x <= pn.x + pn.w && q.y >= pn.y + 90 && q.y <= pn.y + pn.maxH) refDrag = { y0: q.y, s0: state.refScroll || 0 };
    if (refDrag) { if (p.down) set(refDrag.s0 - (q.y - refDrag.y0)); else refDrag = null; }
    if (k.has('ArrowDown')) set((state.refScroll || 0) + 70); if (k.has('ArrowUp')) set((state.refScroll || 0) - 70);
    if (k.has('PageDown') || k.has('Space')) set((state.refScroll || 0) + (state.refView || 400) * 0.9); if (k.has('PageUp')) set((state.refScroll || 0) - (state.refView || 400) * 0.9);
    if (k.has('Home')) set(0); if (k.has('End')) set(1e9);
  }

  // ---- screen positions of cells (for floating text and sparks) ------------------------------------------------------------------
  function cellCenter(r, pi, ci, cell) {
    const L = lay(); let rect, q;
    if (r.mode === 'duo') { rect = L.duo.cards.rects[ci]; const c = cellRectOf(cardGeom(rect), cell); q = { x: c.x + c.w / 2, y: c.y + c.h / 2 }; return pi === 1 ? L.duo.rot(q.x, q.y) : q; }
    rect = (r.mode === 'auto' ? L.auto : L.play).cards.rects[ci]; const c = cellRectOf(cardGeom(rect), cell);
    return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
  }
  const floatAt = (x, y, text, c = '#ffe9a8') => { state.floats.push({ x, y, text, c, t: 0, max: 1.1 }); if (state.floats.length > 14) state.floats.shift(); };

  // ---- rounds ----------------------------------------------------------------------------------------------------------------------
  const mkPlayer = (kind, name, cards, skill = 'normal') => ({
    kind, name, cards, marks: freshMarks(cards.length), chipT: cards.map(() => Array(27).fill(9)), dead: cards.map(() => Array(27).fill(false)),
    lock: 0, stats: { marks: 0, wrong: 0, falses: 0, quick: 0, missed: 0, best: 0 }, score: 0, streak: 0, hints: HINTS_PER_ROUND, hint: null, flash: null,
    pending: [], claimAt: -1, skill, stagePts: 0, said: { row: false, two: false, loto: false },
  });
  function makeRound(mode, o) {
    const rg = o.rg ?? rng, pace = byId(PACES, o.pace), players = [];
    if (mode === 'duo') { players.push(mkPlayer('human', 0, dealCards(rg, o.cards)), mkPlayer('human', 1, dealCards(rg, o.cards))); }
    else {
      players.push(mkPlayer('human', 0, dealCards(rg, o.cards)));
      const names = rg.shuffle([0, 1, 2]);
      for (let i = 0; i < o.opps; i++) players.push(mkPlayer('cpu', names[i], dealCards(rg, cpuCards(o.cards, o.skill)), o.skill));
    }
    return {
      mode, rg, goal: o.goal, paceId: pace.id, secs: mode === 'auto' ? 5 : pace.secs, window: mode === 'auto' ? 99 : pace.window,
      bag: newBag(rg), drawn: 0, called: [], landT: {}, callT: 0, timer: 1.6, clock: 0, drop: null, last: 0, players, claims: {},
      status: 'running', winner: -1, endT: 0, endAt: 0, ff: false, num: state.roundNo + 1, auto: null, daily: !!o.daily, result: null,
    };
  }
  function startDrop(r) {
    if (r.drawn >= KEGS || r.drop) return false;
    const n = r.bag[r.drawn++]; r.drop = { n, t: 0, seed: n * 7 + r.drawn };
    sound('rattle', n); return true;
  }
  const humanCanStill = (r, p) => activeStages(r.goal).some((s) => !r.claims[s] && stagePossible(p.cards, p.marks, r.called, r.window, s));
  function landDrop(r) {
    const n = r.drop.n; r.drop = null; r.called.push(n); r.landT[n] = r.clock; r.callT = 0; r.last = n; sound('land');
    const L = lay(), st = r.mode === 'auto' ? L.auto : r.mode === 'duo' ? null : L.play;
    if (st) sparks(st.stage.tray.x + st.stage.tray.w / 2, st.stage.tray.y + st.stage.tray.h / 2, 10);
    for (const p of r.players) {
      let newlyDead = false;
      p.cards.forEach((card, ci) => { const d = deadCells(card, p.marks[ci], r.called, r.window); for (let i = 0; i < 27; i++) if (d[i] && !p.dead[ci][i]) newlyDead = true; p.dead[ci] = d; });
      if (newlyDead && p.kind === 'human') { p.streak = 0; p.stats.missed++; }
      if (p.kind === 'cpu' && r.mode !== 'auto') {
        const sk = byId(SKILLS, p.skill);
        p.cards.forEach((card, ci) => {
          const cell = card.indexOf(n);
          if (cell < 0) return;
          if (r.rg.chance(sk.miss)) { p.streak = 0; p.stats.missed++; return; }          // overlooked: the cell is lost and the run ends
          p.pending.push({ at: r.clock + cpuReact(r.rg, sk, p.cards.length), ci, cell });
        });
        if (r.rg.chance(sk.wrong)) { p.score += SCORE.wrong; p.streak = 0; p.stats.wrong++; }  // a mis-tap
        p.pending.sort((a, b) => a.at - b.at);
      }
    }
    const human = r.players[0];
    r.ff = r.mode === 'solo' && !r.daily && r.status === 'running' && r.players.length > 1 && !humanCanStill(r, human) && r.players.some((p) => p.kind === 'cpu' && humanCanStill(r, p));
  }
  function noteStages(r, pi) {
    const p = r.players[pi], rc = reached(p.cards, p.marks);
    for (const s of activeStages(r.goal)) {
      if (rc[s] && !p.said[s]) {
        p.said[s] = true;
        if (p.kind === 'human' && !r.claims[s] && r.mode !== 'auto') { say(`${STAGE_NAME[s]}! Press ${STAGE_NAME[s].toUpperCase()}`, 'good', 2.4); sound('stage'); }
      }
    }
  }
  function placeChip(r, pi, ci, cell, byTap) {
    const p = r.players[pi]; p.marks[ci][cell] = true; p.chipT[ci][cell] = 0;
    const n = p.cards[ci][cell];
    if (byTap) {
      const age = r.clock - (r.landT[n] ?? r.clock), mp = markPoints(age, r.secs, p.streak);
      p.score += mp.pts; p.streak++; p.stats.best = Math.max(p.stats.best, p.streak); p.stats.marks++; if (mp.speed >= SCORE.speedMax * 0.55) p.stats.quick++;
      const c = cellCenter(r, pi, ci, cell); floatAt(c.x, c.y - 10, `+${mp.pts}`); sparks(c.x, c.y, 7);
    } else p.stats.marks++;
    sound('chip');
    if (p.hint && p.hint.cells.some((h) => h.ci === ci && h.cell === cell)) p.hint = null;
    noteStages(r, pi);
  }
  function tapCell(r, pi, ci, cell) {
    const p = r.players[pi];
    if (r.status !== 'running' || cell < 0 || r.last === 0) return;
    const out = tapOutcome(p.cards[ci], p.marks[ci], cell, r.called, r.window);
    if (out === 'blank' || out === 'already') return;
    if (out === 'mark') placeChip(r, pi, ci, cell, true);
    else if (out === 'early') { p.score += SCORE.wrong; p.streak = 0; p.stats.wrong++; p.flash = { ci, cell, t: 0, kind: 'wrong' }; sound('wrong'); say('Not called yet!', 'warn'); const c = cellCenter(r, pi, ci, cell); floatAt(c.x, c.y - 10, `${SCORE.wrong}`, '#ff8a7a'); }
    else { p.flash = { ci, cell, t: 0, kind: 'wrong' }; sound('wrong'); say('Too late for that one', 'warn'); }
  }
  function claim(r, pi) {
    const p = r.players[pi];
    if (r.status !== 'running' || p.lock > 0) return;
    const best = claimable(r.goal, p.cards, p.marks, r.claims);
    if (best) { takeStages(r, pi, best); return; }
    const rc = reached(p.cards, p.marks);
    if (activeStages(r.goal).some((s) => rc[s] && r.claims[s])) { say('Already claimed', 'info'); return; }
    p.stats.falses++; p.score += SCORE.falseClaim; p.lock = LOCKOUT_SECS; sound('wrong'); say(`False claim! ${SCORE.falseClaim}`, 'warn', 2);
  }
  function takeStages(r, pi, best) {
    const p = r.players[pi], rc = reached(p.cards, p.marks), order = activeStages(r.goal); let got = 0;
    for (const s of order) if (order.indexOf(s) <= order.indexOf(best) && rc[s] && !r.claims[s]) { r.claims[s] = { by: pi, at: r.called.length }; p.stagePts += STAGE_POINTS[s]; p.score += STAGE_POINTS[s]; got += STAGE_POINTS[s]; }
    const nm = r.mode === 'duo' ? `Player ${pi + 1}` : pi === 0 ? 'You' : CPU_NAMES[p.name];
    say(`${nm}: ${STAGE_NAME[best]}! +${got}`, p.kind === 'human' ? 'good' : 'info', 2.4); sound('stage');
    if (r.mode === 'duo') confetti(meta.width / 2, meta.height / 2, 24, false); else confetti(meta.width / 2, meta.height * 0.35, p.kind === 'human' ? 30 : 8);
    if (best === endStage(r.goal)) endRound(r, pi);
  }
  function endRound(r, winner) {
    if (r.status !== 'running') return;
    r.status = winner >= 0 ? 'won' : 'draw'; r.winner = winner; r.endT = 0;
    if (winner >= 0) { const w = r.players[winner], b = r.goal === 'row' ? Math.round(lotoBonus(r.called.length) / 4) : lotoBonus(r.called.length); w.score += b; w.bonus = b; }
    // standings: the round is won on POINTS (accuracy, speed, runs, claims), not only by shouting first; face to face keeps first-to-claim
    r.ranks = r.players.map((p, i) => i).sort((a, b) => r.players[b].score - r.players[a].score || (a === winner ? -1 : b === winner ? 1 : a - b));
    r.top = r.mode === 'duo' || winner < 0 ? winner : r.ranks[0];
    r.result = r.players.map((p) => (p.kind === 'human' ? { marks: p.stats.marks, wrong: p.stats.wrong, falses: p.stats.falses, quick: p.stats.quick, best: p.stats.best, stagePts: p.stagePts, bonus: p.bonus ?? 0, total: p.score } : null));
    const humanWon = r.top >= 0 && r.players[r.top].kind === 'human';
    sound(humanWon ? 'win' : 'lose'); confetti(meta.width / 2, meta.height * 0.3, humanWon ? 90 : 12, true);
    if (r.mode === 'solo') {
      const t = r.players[0].score; state.total += Math.max(0, t); state.best = Math.max(state.best, t);
      if (r.daily) {
        const dd = state.daily, d = today();
        if (dd.day !== d) { dd.streak = dd.last === d - 1 ? dd.streak + 1 : 1; dd.last = d; dd.day = d; dd.best = t; dd.plays = 1; }
        else { dd.best = Math.max(dd.best, t); dd.plays++; }
        r.dailyInfo = { best: dd.best, streak: dd.streak };
      }
      saveStats();
    }
  }

  // ---- the running round -----------------------------------------------------------------------------------------------------------------
  function stepPlayers(r, dt) {
    for (const p of r.players) {
      p.lock = Math.max(0, p.lock - dt);
      for (const row of p.chipT) for (let i = 0; i < 27; i++) if (row[i] < 9) row[i] += dt;
      if (p.flash) { p.flash.t += dt; if (p.flash.t > 0.5) p.flash = null; }
      if (p.hint) { p.hint.t -= dt; if (p.hint.t <= 0) p.hint = null; }
    }
  }
  function cpuTurn(r, i) {
    const p = r.players[i];
    for (let k = 0; k < p.pending.length;) {
      const it = p.pending[k];
      if (it.at > r.clock) { k++; continue; }
      p.pending.splice(k, 1);
      const n = p.cards[it.ci][it.cell];
      if (!p.marks[it.ci][it.cell] && isOpen(r.called, n, r.window)) {
        p.marks[it.ci][it.cell] = true; p.chipT[it.ci][it.cell] = 0; p.stats.marks++;
        if (r.rg.chance(byId(SKILLS, p.skill).slip)) p.streak = 0;                    // hesitated: the run ends
        const mp = markPoints(r.clock - (r.landT[n] ?? r.clock), r.secs, p.streak); p.score += mp.pts; p.streak++;
        noteStages(r, i);
        if (p.claimAt < 0 && claimable(r.goal, p.cards, p.marks, r.claims)) p.claimAt = r.clock + cpuClaimDelay(r.rg, byId(SKILLS, p.skill));
      }
    }
    if (p.claimAt >= 0 && r.clock >= p.claimAt) {
      p.claimAt = -1; const best = claimable(r.goal, p.cards, p.marks, r.claims);
      if (best && r.status === 'running') takeStages(r, i, best);
    }
  }
  function stepRound(r, dt0) {
    stepPlayers(r, dt0);
    if (r.status !== 'running') { r.endT += dt0; return; }
    const dt = r.ff ? dt0 * 3 : dt0;
    r.clock += dt; r.callT += dt;
    if (r.drop) { r.drop.t += dt; if (r.drop.t >= DROP_SECS) landDrop(r); }
    else if (r.drawn < KEGS) { r.timer -= dt; if (r.timer <= 0) { startDrop(r); r.timer += r.secs; } }
    else { r.endAt += dt; if (r.endAt > r.secs * r.window * 0.6 + 1) { endRound(r, -1); return; } }
    for (let i = 1; i < r.players.length && r.status === 'running'; i++) cpuTurn(r, i);
  }

  // ---- hints -------------------------------------------------------------------------------------------------------------------------
  function useHint(r, pi) {
    const p = r.players[pi];
    if (r.status !== 'running' || p.hints <= 0 || r.last === 0) return;
    const open = r.called.slice(-r.window).reverse(); let found = null;
    for (const n of open) { const hit = cellsFor(p.cards, n).find((h) => !p.marks[h.ci][h.cell]); if (hit) { found = hit; break; } }
    p.hints--; sound('ok');
    if (found) { p.hint = { cells: [found], t: 3.2 }; say(`Look in column ${colOf(p.cards[found.ci][found.cell]) + 1}`, 'good', 2.2); }
    else say('Nothing to mark right now', 'info', 2);
  }

  // ---- watch & learn -----------------------------------------------------------------------------------------------------------------
  const autoTargets = (r) => cellsFor(r.players[0].cards, r.last).filter((h) => !r.players[0].marks[h.ci][h.cell]);
  function autoNext(r, a) { a.phase = 'drop'; a.timer = 0; if (!startDrop(r)) endRound(r, -1); }
  function autoAct(r, a) {
    const me = r.players[0];
    for (const h of a.targets) if (!me.marks[h.ci][h.cell]) placeChip(r, 0, h.ci, h.cell, false);
    for (let i = 1; i < r.players.length; i++) {
      const p = r.players[i], sk = byId(SKILLS, p.skill);
      p.cards.forEach((card, ci) => { const cell = card.indexOf(r.last); if (cell >= 0 && !p.marks[ci][cell] && !r.rg.chance(sk.miss)) { p.marks[ci][cell] = true; p.chipT[ci][cell] = 0; p.stats.marks++; noteStages(r, i); } });
    }
    let who = -1;
    if (claimable(r.goal, me.cards, me.marks, r.claims)) who = 0;
    else for (let i = 1; i < r.players.length; i++) if (claimable(r.goal, r.players[i].cards, r.players[i].marks, r.claims)) { who = i; break; }
    if (who >= 0) { a.who = who; a.phase = 'claim'; a.timer = 2.4; sound('stage'); } else { a.phase = 'pause'; a.timer = AUTO_ACT_SECS; }
  }
  function autoStep(dt) {
    const r = state.round, a = r.auto;
    stepPlayers(r, dt);
    if (r.status !== 'running') { r.endT += dt; return; }
    r.clock += dt; r.callT += dt; a.timer -= dt;
    if (r.drop) {
      r.drop.t += dt;
      if (r.drop.t >= DROP_SECS) { landDrop(r); a.targets = autoTargets(r); a.col = colOf(r.last); if (a.targets.length) { a.phase = 'think'; a.timer = THINK_STEPS[state.thinkIdx]; } else { a.phase = 'miss'; a.timer = 1.6; } }
      return;
    }
    if (a.timer > 0) return;
    if (a.phase === 'intro' || a.phase === 'pause') autoNext(r, a);
    else if (a.phase === 'think') { a.phase = 'reveal'; a.timer = AUTO_REVEAL_SECS; r.players[0].hint = { cells: a.targets, t: AUTO_REVEAL_SECS + 0.5 }; sound('ok'); }
    else if (a.phase === 'reveal') { r.players[0].hint = null; autoAct(r, a); }
    else if (a.phase === 'miss') autoAct(r, a);
    else if (a.phase === 'claim') { const best = claimable(r.goal, r.players[a.who].cards, r.players[a.who].marks, r.claims); if (best) takeStages(r, a.who, best); if (r.status === 'running') { a.phase = 'pause'; a.timer = 0.4; } }
  }

  // ---- starting things -----------------------------------------------------------------------------------------------------------------
  function startRound(mode, o) {
    if (config.demo && mode !== 'auto' && state.demoRounds >= DEMO_ROUNDS) { go('demolimit'); return; }
    if (config.demo && mode === 'auto' && state.demoAuto >= 1) { go('demolimit'); return; }
    state.mode = mode; state.parts = []; state.floats = [];
    const r = makeRound(mode === 'daily' ? 'solo' : mode, { ...o, daily: mode === 'daily' });
    state.round = r;
    if (mode === 'auto') { r.auto = { phase: 'intro', timer: 1.2, targets: [], col: 0, who: -1 }; state.demoAuto++; saveDemo(); go('auto'); }
    else { state.demoRounds++; saveDemo(); go(mode === 'duo' ? 'duo' : 'play'); }
    state.roundNo++; r.num = state.roundNo; saveStats();
    if (mode === 'solo' && !state.coach) { state.coach = true; savePrefs(); say('Tap a number on your cards once its keg has landed', 'info', 5); }
  }
  const startSolo = () => startRound('solo', { ...state.cfg });
  const startDuo = () => startRound('duo', { goal: state.cfg.goal, pace: state.cfg.pace, cards: state.cfg.duoCards });
  const startAuto = () => startRound('auto', { goal: 'row', pace: 'classic', cards: 2, opps: 2, skill: 'normal' });
  function startDaily() {
    const d = today(), g = createRng(seedFrom('russian-loto-daily-' + d));
    const pace = ['classic', 'rapid', 'rapid', 'blitz', 'classic', 'rapid', 'calm'][Math.abs(d) % 7];
    startRound('daily', { goal: 'row', pace, cards: 3 + (Math.abs(d) % 2), opps: 2, skill: 'normal', rg: g });
  }

  // ---- input -------------------------------------------------------------------------------------------------------------------------------
  const hit = (r, x, y) => inRect(r, x, y);
  const cyc = (list, cur, d) => list[(list.indexOf(cur) + d + list.length) % list.length];
  const setupKeys = () => (state.mode === 'duo' ? DUO_SETUP_KEYS : SETUP_KEYS);
  function adjust(key, d) {
    const c = state.cfg, duo = state.mode === 'duo';
    if (key === 'goal') c.goal = cyc(GOALS.map((x) => x.id), c.goal, d);
    else if (key === 'pace') c.pace = cyc(PACES.map((x) => x.id), c.pace, d);
    else if (key === 'cards') { if (duo) c.duoCards = Math.min(MAX_DUO_CARDS, Math.max(1, c.duoCards + d)); else c.cards = Math.min(MAX_CARDS, Math.max(1, c.cards + d)); }
    else if (key === 'opps') c.opps = Math.min(3, Math.max(1, c.opps + d));
    else if (key === 'skill') c.skill = cyc(SKILLS.map((x) => x.id), c.skill, d);
    else if (key === 'look') state.theme = cyc(THEME_IDS, state.theme, d);
    savePrefs(); sound('ok');
  }
  function backFromRef() { const s = state.returnScene; state.returnScene = null; if (s) { state.scene = s; state.page = 0; state.refScroll = 0; } else go('menu'); }
  function tap(x0, y0) {
    const sc = state.scene;
    if (state.frozen) return;
    if (sc === 'play') return playTap(x0, y0);
    if (sc === 'duo') return duoTap(x0, y0);
    if (sc === 'auto') return autoTap(x0, y0);
    const L = lay(), d = L.d, { x, y } = d.to(x0, y0);
    if (sc === 'menu') {
      const m = L.menuRows(TEXT_SCALES[state.textIdx] ?? 1);
      if (hit(L.lockTap(m), x0, y0)) { env.openArcforgeHome?.(); return; }
      if (hit(d.sound, x, y)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); sound('ok'); }
      else if (hit(m.play, x, y)) { state.mode = 'solo'; go('setup'); sound('ok'); }
      else if (hit(m.duo, x, y)) { state.mode = 'duo'; go('setup'); sound('ok'); }
      else if (hit(m.daily, x, y)) startDaily();
      else if (hit(m.watch, x, y)) startAuto();
      else if (hit(m.howto, x, y)) { go('howto'); sound('ok'); }
      else if (hit(m.rules, x, y)) { go('rules'); sound('ok'); }
      else if (hit(m.about, x, y)) { go('about'); sound('ok'); }
      else if (hit(m.settings, x, y)) { go('settings'); sound('ok'); }
    } else if (sc === 'setup') {
      const rows = L.setupRows(setupKeys());
      if (hit(d.back, x, y)) { go('menu'); sound('ok'); return; }
      for (const k of setupKeys()) if (hit(rows[k], x, y)) { adjust(k, x < rows[k].x + rows[k].w / 2 ? -1 : 1); return; }
      if (hit(rows.start, x, y)) { sound('ok'); if (state.mode === 'duo') startDuo(); else startSolo(); }
    } else if (sc === 'about' || sc === 'howto' || sc === 'rules') {
      if (hit(d.textDec, x, y) && state.textIdx > 0) { state.textIdx--; state.refScroll = 0; savePrefs(); sound('ok'); }
      else if (hit(d.textInc, x, y) && state.textIdx < TEXT_SCALES.length - 1) { state.textIdx++; state.refScroll = 0; savePrefs(); sound('ok'); }
      else if (hit(d.refBack, x, y) || hit(d.refNext, x, y)) { backFromRef(); sound('ok'); }
    } else if (sc === 'settings') {
      const rows = d.settings, left = (r) => x < r.x + r.w / 2;
      if (hit(d.back, x, y)) { go('menu'); sound('ok'); return; }
      if (hit(rows.sound, x, y)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); sound('ok'); }
      else if (hit(rows.text, x, y)) { state.textIdx = Math.min(TEXT_SCALES.length - 1, Math.max(0, state.textIdx + (left(rows.text) ? -1 : 1))); savePrefs(); sound('ok'); }
      else if (hit(rows.look, x, y)) adjust('look', left(rows.look) ? -1 : 1);
      else if (hit(rows.think, x, y)) { state.thinkIdx = Math.min(THINK_STEPS.length - 1, Math.max(0, state.thinkIdx + (left(rows.think) ? -1 : 1))); savePrefs(); sound('ok'); }
      else if (hit(rows.reset, x, y)) { state.best = 0; state.total = 0; saveStats(); state.resetDone = 2; sound('ok'); }
    } else if (sc === 'demolimit') { if (hit(d.demo.back, x, y)) go('menu'); }
  }
  function overlayTap(x0, y0, r) {
    const d = lay().d, { x, y } = d.to(x0, y0);
    if (state.paused) {
      const P = d.pause;
      if (hit(P.resume, x, y)) { state.paused = false; sound('ok'); }
      else if (hit(P.rules, x, y)) { state.returnScene = state.scene; state.scene = 'rules'; state.page = 0; state.refScroll = 0; sound('ok'); }
      else if (hit(P.menu, x, y)) { go('menu'); sound('ok'); }
      return true;
    }
    if (r.status !== 'running') {
      if (r.endT > 1.2) {
        const RS = d.result;
        if (hit(RS.again, x, y)) { if (r.daily) startDaily(); else if (r.mode === 'duo') startDuo(); else startSolo(); }
        else if (hit(RS.menu, x, y)) { go('menu'); sound('ok'); }
        else if (hit(RS.rules, x, y)) { state.returnScene = state.scene; state.scene = 'rules'; state.page = 0; state.refScroll = 0; sound('ok'); }
      }
      return true;
    }
    return false;
  }
  function cardTap(r, pi, rects, x, y) {
    for (let ci = 0; ci < rects.length; ci++) { const g = cardGeom(rects[ci]), c = cellAtCard(g, x, y); if (c >= 0) { tapCell(r, pi, ci, c); return true; } }
    return false;
  }
  function playTap(x, y) {
    const r = state.round, P = lay().play;
    if (overlayTap(x, y, r)) return;
    if (hit(P.pause, x, y)) { state.paused = true; sound('ok'); return; }
    if (hit(P.bar.hint, x, y)) { useHint(r, 0); return; }
    if (hit(P.bar.claim, x, y)) { claim(r, 0); return; }
    cardTap(r, 0, P.cards.rects, x, y);
  }
  function duoTap(x, y) {
    const r = state.round, D = lay().duo;
    if (overlayTap(x, y, r)) return;
    if (hit(D.pause, x, y)) { state.paused = true; sound('ok'); return; }
    const bottom = y > D.cy; let px = x, py = y;
    if (!bottom) { const q = D.rot(x, y); px = q.x; py = q.y; }
    if (py < D.band.y + D.band.h) return;
    const pi = bottom ? 0 : 1;
    if (hit(D.claim, px, py)) { claim(r, pi); return; }
    cardTap(r, pi, D.cards.rects, px, py);
  }
  function autoTap(x, y) {
    const r = state.round, a = r.auto, B = lay().auto.bar;
    if (r.status !== 'running') {
      if (r.endT > 1.2) { const RS = lay().d.result, q = lay().d.to(x, y); if (hit(RS.again, q.x, q.y)) startAuto(); else if (hit(RS.menu, q.x, q.y)) { go('menu'); sound('ok'); } }
      return;
    }
    if (hit(B.exit, x, y)) { go('menu'); sound('ok'); }
    else if (hit(B.pause, x, y)) { state.paused = !state.paused; sound('ok'); }
    else if (state.paused) return;
    else if (hit(B.dec, x, y)) { if (state.thinkIdx > 0) { state.thinkIdx--; savePrefs(); sound('ok'); } }
    else if (hit(B.inc, x, y)) { if (state.thinkIdx < THINK_STEPS.length - 1) { state.thinkIdx++; savePrefs(); sound('ok'); } }
    else if (hit(B.speed, x, y)) { if (a.phase !== 'intro' && !r.drop) a.timer = Math.min(a.timer, 0.01); }
  }
  function keyboard(keys) {
    if (state.frozen) return;
    const sc = state.scene, r = state.round;
    if (keys.pressed.has('Escape')) { if (sc === 'play' || sc === 'duo') state.paused = !state.paused; else if (sc !== 'menu') go('menu'); return; }
    if (keys.pressed.has('KeyP') && (sc === 'play' || sc === 'duo' || sc === 'auto')) { state.paused = !state.paused; return; }
    if (sc !== 'play' || state.paused || !r || r.status !== 'running') return;
    if (keys.pressed.has('Space')) claim(r, 0);
    if (keys.pressed.has('KeyH')) useHint(r, 0);
  }

  // ---- showcase: staged screens for store screenshots, opened by a reserved seed range ------------------------------------------------------
  function stageMidRound(cards, kegs, opts = {}) {
    const r = makeRound('solo', { goal: 'ladder', pace: 'classic', cards, opps: 2, skill: 'normal' });
    state.round = r; state.scene = 'play'; state.roundNo = 4; r.num = 4; r.timer = 1.4; r.clock = 140;
    const me = r.players[0];
    for (let k = 0; k < kegs; k++) {
      const v = r.bag[r.drawn++]; r.called.push(v); r.landT[v] = r.clock - (kegs - k) * 3.6; r.last = v;
      cellsFor(me.cards, v).forEach((h) => { if (rng.chance(opts.hit ?? 0.88)) { me.marks[h.ci][h.cell] = true; me.stats.marks++; } });
      for (let i = 1; i < r.players.length; i++) r.players[i].cards.forEach((c, ci) => { const cell = c.indexOf(v); if (cell >= 0 && rng.chance(0.85)) r.players[i].marks[ci][cell] = true; });
    }
    for (const p of r.players) p.cards.forEach((c, ci) => { p.dead[ci] = deadCells(c, p.marks[ci], r.called, r.window); });
    me.score = 164; me.streak = 6; r.callT = 1.2;
    return r;
  }
  function showcase(n) {
    state.frozen = true;
    if (n === 1) return;
    if (n === 2) { go('about'); return; }
    if (n === 3) { stageMidRound(3, 24); return; }
    if (n === 4) { const r = stageMidRound(4, 34); r.players[0].hint = { cells: cellsFor(r.players[0].cards, r.last).slice(0, 1), t: 99 }; return; }
    if (n === 5) {
      const r = stageMidRound(3, 38), me = r.players[0];
      me.cards[0].forEach((v, i) => { if (v) me.marks[0][i] = true; });
      r.status = 'won'; r.winner = 0; r.top = 0; r.ranks = [0, 1, 2]; r.claims = { row: { by: 0 }, two: { by: 0 }, loto: { by: 0 } };
      state.best = 780; r.players[1].score = 512; r.players[2].score = 436; me.stagePts = 430; me.bonus = 104; me.score = 780; r.result = [{ marks: 40, wrong: 1, falses: 0, quick: 14, best: 11, stagePts: 430, bonus: 104, total: 780 }, null, null]; r.endT = 5; state.parts = []; return;
    }
    if (n === 6) {
      const r = makeRound('duo', { goal: 'ladder', pace: 'classic', cards: 2 }); state.round = r; state.scene = 'duo'; state.mode = 'duo'; r.clock = 40; r.timer = 1.2;
      for (let k = 0; k < 22; k++) { const v = r.bag[r.drawn++]; r.called.push(v); r.landT[v] = 30 + k; r.last = v; r.players.forEach((p) => cellsFor(p.cards, v).forEach((h) => { if (rng.chance(0.8)) p.marks[h.ci][h.cell] = true; })); }
      r.callT = 1.2; return;
    }
    if (n === 7) {
      startAuto(); state.frozen = true; const r = state.round;
      for (let i = 0; i < 6000 && !(r.called.length >= 6 && r.auto.phase === 'reveal'); i++) autoStep(0.1);
      r.auto.timer = 1.2; state.paused = false; return;
    }
    if (n === 8) { go('rules'); return; }
    if (n === 9) { state.mode = 'solo'; go('setup'); return; }
    if (n === 10) { stageMidRound(6, 30); return; }
    if (n === 11) {
      const r = makeRound('duo', { goal: 'ladder', pace: 'classic', cards: 3 }); state.round = r; state.scene = 'duo'; state.mode = 'duo'; r.clock = 40; r.timer = 1.2;
      for (let k = 0; k < 26; k++) { const v = r.bag[r.drawn++]; r.called.push(v); r.landT[v] = 30 + k; r.last = v; r.players.forEach((p) => cellsFor(p.cards, v).forEach((h) => { if (rng.chance(0.8)) p.marks[h.ci][h.cell] = true; })); }
      r.callT = 1.2; return;
    }
    if (n === 12) { stageMidRound(1, 20); return; }
    if (n === 13) { stageMidRound(2, 28); return; }
  }

  const api = {
    update(dt, input) {
      lastPointer = input.pointer;
      { const L0 = lay(), ip = input.pointer; state.lkDown = state.scene === 'menu' && !!ip.down && hit(L0.lockTap(L0.menuRows(TEXT_SCALES[state.textIdx] ?? 1)), ip.x, ip.y); }
      if (!wheelHooked && input.onWheel) { wheelHooked = true; input.onWheel(({ dy }) => { if (REF_SCENES.has(state.scene)) state.refScroll = Math.max(0, Math.min(state.refMax || 0, (state.refScroll || 0) + dy)); }); }
      if (REF_SCENES.has(state.scene)) refInput(input);
      if (!state.showcaseInit) { state.showcaseInit = true; if (config.seed >= SHOWCASE_SEED_MIN && config.seed < SHOWCASE_SEED_MIN + 100) showcase(config.seed - SHOWCASE_SEED_MIN + 1); }
      // Pause freezes EVERYTHING (timers, the auto-play loop, animations): only the pause controls are read.
      if (state.paused) {
        const k = input.keys;
        if (k.pressed.has('KeyP') || k.pressed.has('Escape')) state.paused = false;
        else if (input.pointer.pressed && !state.frozen) { if (state.scene === 'auto') autoTap(input.pointer.x, input.pointer.y); else tap(input.pointer.x, input.pointer.y); }
        return;
      }
      state.t += dt; state.today = today();
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.max) state.toast = null; }
      if (state.resetDone > 0) state.resetDone -= dt;
      for (const s of sfx) if (s.at <= state.t) audio.tone(s.o);
      sfx = sfx.filter((s) => s.at > state.t);
      for (const p of state.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 0.995; p.rot += p.vr * dt; }
      state.parts = state.parts.filter((p) => p.t < p.max);
      for (const f of state.floats) { f.t += dt; f.y -= 46 * dt; }
      state.floats = state.floats.filter((f) => f.t < f.max);
      if (input.pointer.pressed) tap(input.pointer.x, input.pointer.y);
      keyboard(input.keys);
      const r = state.round;
      if ((state.scene === 'play' || state.scene === 'duo') && r && !state.paused && !state.frozen) stepRound(r, dt);
      else if (state.scene === 'auto' && r && !state.paused && !state.frozen) autoStep(dt);
    },
    render(ctx, view) { render(ctx, state, lastPointer, lay2(view)); },
    getState() { return state; },
    // Only real play counts against the free preview: a running, unpaused solo / face-to-face / daily round.
    // Menus, setup, Rules/About/How to play, Settings, Watch & Learn, paused and finished rounds and staged store scenes are free.
    isPreviewExempt() {
      if (state.frozen || state.paused) return true;
      const sc = state.scene, r = state.round;
      if (sc === 'play' || sc === 'duo') return !r || r.status !== 'running';
      return true;
    },
  };
  return api;
}
