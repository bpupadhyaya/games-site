// GAME CONTRACT (docs/GAME-CONTRACT.md). Mehen: the coiled snake race. Four throwing sticks, 2 to 6 seats, lions that walk a spiral of
// carved cells, marbles that nudge a throw, resting stones and captures. The rules are a plainly-stated reconstruction (see Rules).
import { SCREEN, inRect, playFrame, titleFrame, creditHit } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoLocked, demoOver, recKey } from './screens.js';
import { LEVELS, LENGTHS, MIN_PLAYERS, MAX_PLAYERS, TRACK, HEAD, cellOf, isHome, lengthOf, plan, planGen, actionsFor } from './rules.js';
import { describeAction, hintText } from './explain.js';
import {
  createMatch, replayMatch, doThrow, stepMatch, toggleNudge, pickAction, confirmSelected, skipTurn, commit, humanTurn, settled, spawn, allActions, STICK_T,
} from './match.js';
import { tr, lvName, seatColor } from './content.js';
import { THEMES, themeById, PALETTE } from './art.js';
import { trackGeo, cellNear } from './geo.js';
import { createBake, gfx } from './bake.js';
import { seatName, render } from './view.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. meta.width/height are live.
export const meta = { width: SCREEN.width, height: SCREEN.height, fluid: { short: 720 } };

const VERSION = '1.0.0';
const WIN_NOTES = [523, 659, 784, 1047, 1319, 1568];

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'sandstone', textIdx: 0, thinkIdx: 1, pace: 0,
    setup: { n: 3, seats: [false, true, true, true, true, true], level: 'skilled', length: 'classic' },
    stats: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    scroll: {}, scrollVel: {}, press: null, match: null, auto: null, endInfo: null,
    w: SCREEN.width, h: SCREEN.height, sizeKey: '', toast: null, toastT: 0, winSeq: null, timers: [],
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: env.manifest?.version || VERSION, shot: false, lastPtr: { x: 0, y: 0 },
    baked: null, bakeJob: null, bakeTheme: '', lastOpts: null, previewPill: false,
  };

  const [set, stats, save, dg, prog] = await Promise.all([storage.get('mh.settings', null), storage.get('mh.stats', null), storage.get('mh.save', null), storage.get('mh.demo', 0), storage.get('mh.progress', null)]);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.pace)) S.pace = Math.min(3, Math.max(0, set.pace));
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
    if (set.setup && Array.isArray(set.setup.seats)) {
      const su = set.setup;
      S.setup = {
        n: Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, su.n | 0 || 3)), seats: Array.from({ length: MAX_PLAYERS }, (_, i) => Boolean(su.seats[i] ?? i > 0)),
        level: LEVELS.some((l) => l.id === su.level) ? su.level : 'skilled', length: LENGTHS.some((l) => l.id === su.length) ? su.length : 'classic',
      };
      if (S.setup.seats.slice(0, S.setup.n).every(Boolean)) S.setup.seats[0] = false;
    }
  }
  if (stats && typeof stats === 'object') S.stats = stats;
  if (save && Array.isArray(save.log) && Array.isArray(save.seats)) S.save = save;
  if (Number.isInteger(dg)) S.demoGames = dg;
  if (prog && Number.isInteger(prog.wins) && Number.isInteger(prog.games)) S.progress = { games: prog.games, wins: prog.wins };
  audio.setMuted(!S.sound);
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const saveSettings = () => storage.set('mh.settings', { sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, pace: S.pace, setup: S.setup });
  const saveStats = () => storage.set('mh.stats', S.stats);
  const saveGame = () => {
    const M = S.match;
    if (S.scene !== 'play' || !M || M.auto) return;
    S.save = M.over || !M.log.length ? null : { seats: M.seats, length: M.length, log: M.log };
    storage.set('mh.save', S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const later = (delay, fn) => S.timers.push({ t: delay, fn });
  const SOUNDS = {
    // sticks: a quick clatter of dry wooden knocks that thins out, then a last settling knock
    throw: () => {
      [0, 0.07, 0.15, 0.25, 0.37, 0.52, 0.7, 0.86].forEach((d, i) => later(d, () => {
        sfx({ freq: 980 - i * 70, to: 380, dur: 0.045, type: 'triangle', vol: 0.12 - i * 0.008 });
        sfx({ freq: 190 + (i % 3) * 30, to: 110, dur: 0.07, type: 'sine', vol: 0.06 });
      }));
    },
    step: () => sfx({ freq: 210, to: 140, dur: 0.06, type: 'triangle', vol: 0.09 }),
    land: () => { sfx({ freq: 170, to: 90, dur: 0.12, type: 'sine', vol: 0.16 }); sfx({ freq: 1500, to: 900, dur: 0.03, type: 'square', vol: 0.02 }); },
    safe: () => { sfx({ freq: 880, dur: 0.22, type: 'sine', vol: 0.1 }); later(0.09, () => sfx({ freq: 1320, dur: 0.3, type: 'sine', vol: 0.09 })); later(0.18, () => sfx({ freq: 1760, dur: 0.35, type: 'sine', vol: 0.05 })); },
    capture: () => { sfx({ freq: 300, to: 70, dur: 0.38, type: 'sawtooth', vol: 0.11 }); sfx({ freq: 120, to: 60, dur: 0.4, type: 'sine', vol: 0.16 }); later(0.05, () => sfx({ freq: 1600, to: 500, dur: 0.1, type: 'square', vol: 0.04 })); },
    home: () => { [523, 659, 784, 1047].forEach((f, i) => later(i * 0.09, () => sfx({ freq: f, dur: 0.3, type: 'sine', vol: 0.11 }))); },
    turn: () => { sfx({ freq: 660, to: 990, dur: 0.2, type: 'sine', vol: 0.1 }); later(0.12, () => sfx({ freq: 990, to: 660, dur: 0.25, type: 'sine', vol: 0.08 })); },
    // a marble rolling down the groove: a run of soft ticks that speeds up, then a glassy tink at the head
    marble: () => { for (let i = 0; i < 14; i++) later(0.18 + i * 0.045 - i * i * 0.0012 + 0.02 * (i % 2), () => sfx({ freq: 1500 + (i % 3) * 140 - i * 22, to: 900, dur: 0.03, type: 'sine', vol: 0.045 })); later(0.85, () => { sfx({ freq: 2200, dur: 0.18, type: 'sine', vol: 0.08 }); sfx({ freq: 3300, dur: 0.12, type: 'sine', vol: 0.03 }); }); },
    tink: () => { sfx({ freq: 2100, dur: 0.14, type: 'sine', vol: 0.08 }); later(0.07, () => sfx({ freq: 2800, dur: 0.12, type: 'sine', vol: 0.05 })); },
    extra: () => { sfx({ freq: 520, to: 780, dur: 0.14, type: 'triangle', vol: 0.1 }); later(0.12, () => sfx({ freq: 780, to: 1040, dur: 0.2, type: 'triangle', vol: 0.1 })); },
    select: () => sfx({ freq: 620, to: 760, dur: 0.06, type: 'sine', vol: 0.08 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.06 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    lose: () => { [392, 330, 262].forEach((f, i) => later(i * 0.2, () => sfx({ freq: f, to: f * 0.96, dur: 0.4, type: 'sine', vol: 0.09 }))); },
    nomove: () => { sfx({ freq: 300, to: 200, dur: 0.2, type: 'sine', vol: 0.07 }); },
  };

  // ------------------------------------------------------------------------------ board texture
  // computer pace: Auto speeds the computer seats up as more of them play
  const paceSpeed = (M) => {
    const ai = M.seats.filter((s) => s.ai).length;
    if (S.pace === 1) return 1;
    if (S.pace === 2) return 1.5;
    if (S.pace === 3) return 2.2;
    return ai >= 5 ? 2.2 : ai >= 3 ? 1.5 : 1;
  };
  function startBake() {
    const th = themeById(S.themeId);
    if (!gfx.make) return;
    if (S.bakeTheme === th.stone) return;
    S.bakeTheme = th.stone;
    S.bakeJob = createBake(th.stone);
  }
  function stepBake() {
    const job = S.bakeJob;
    if (!job) return;
    if (job.step(S.scene === 'title' || S.scene === 'play' || S.scene === 'auto' ? 28 : 40)) { S.baked = job.canvas; S.bakeJob = null; }
  }
  startBake();

  // ------------------------------------------------------------------------------ geometry helpers
  const syncSize = () => {
    const w = Math.round(meta.width || SCREEN.width), h = Math.round(meta.height || SCREEN.height), key = `${w}x${h}`;
    S.w = w; S.h = h;
    if (key !== S.sizeKey) { S.sizeKey = key; S.press = null; S.scrollVel = {}; }   // a rotation: drop a half-made tap, keep everything else
  };
  syncSize();
  const lay = () => playFrame(S.w, S.h, TEXT_SCALES[S.textIdx], S.match ? S.match.st.n : 3);
  const geoNow = () => { const l = lay(); return trackGeo(l.board.x, l.board.y, l.board.side); };
  const toast = (msg) => { S.toast = msg; S.toastT = 2.8; };

  // ------------------------------------------------------------------------------ matches
  function launch(M) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.endInfo = null; S.winSeq = null; S.toast = null; S.timers = [];
  }
  const seatsFromSetup = () => Array.from({ length: S.setup.n }, (_, i) => ({ ai: S.setup.seats[i], level: S.setup.level }));
  function startMatch(opts, count = true) {
    if (count && demoOver(S)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    if (demoLocked(S, 'level', opts.level) || demoLocked(S, 'length', opts.length)) return;
    const M = createMatch({ seats: opts.seats, length: opts.length });
    if (count && S.demo) { S.demoGames += 1; storage.set('mh.demo', S.demoGames); }
    launch(M);
    S.lastOpts = opts; S.save = null; storage.set('mh.save', null);
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = replayMatch({ seats: sv.seats, length: sv.length }, sv.log);
    launch(M);
    S.lastOpts = { seats: sv.seats, length: sv.length, level: sv.seats.find((s) => s.ai)?.level ?? 'skilled' };
    S.overlay = 'pause'; S.ovT = 0;   // resuming starts paused
  }

  function onEnd(M, e) {
    const w = e.winner;
    const humanWon = !M.auto && M.humans === 1 && w === M.you;
    const named = M.auto || M.humans > 1;
    let head;
    if (named) head = tr('wins', { seat: seatName(M, w) });
    else head = humanWon ? tr('youWin') : tr('lostTo', { seat: seatColor(w) });
    const where = lengthOf(M.length).mode === 'full' ? tr('whereHome') : tr('whereHead');
    const body = e.why === 'limit' ? tr('endLimit', { n: M.st.tn, seat: seatColor(w) }) : tr('endBody', { who: named ? `${seatName(M, w)}'s` : (humanWon ? 'your' : `${seatColor(w)}'s`), where, n: M.st.tn });
    const lines = [];
    for (let i = 0; i < M.st.n; i++) {
      const homeN = M.st.lions[i].filter(isHome).length;
      lines.push(`${seatName(M, i)}: ${homeN} of ${M.st.lions[i].length} home, ${M.st.marbles[i]} ${M.st.marbles[i] === 1 ? 'marble' : 'marbles'}`);
    }
    let rec = '';
    if (!M.auto && M.humans === 1) {
      const lvl = M.seats.find((s) => s.ai)?.level ?? 'skilled';
      const key = recKey(lvl, M.st.n);
      const r = S.stats[key] ?? [0, 0];
      r[humanWon ? 0 : 1] += 1; S.stats[key] = r; saveStats();
      S.progress.games += 1; if (humanWon) S.progress.wins += 1; storage.set('mh.progress', S.progress);
      let wn = 0, ls = 0; for (const k of Object.keys(S.stats)) if (k.startsWith(`${lvl}:`)) { wn += S.stats[k][0]; ls += S.stats[k][1]; }
      rec = tr('recordLine', { label: tr('record'), level: lvName(lvl), w: wn, l: ls });
    }
    if (!M.auto) { S.save = null; storage.set('mh.save', null); }
    S.endInfo = { head, body, lines: lines.join('\n'), rec, winner: w };
    if (named || humanWon) S.winSeq = { t: 0, i: 0 }; else SOUNDS.lose();
  }

  function handleEvents(M) {
    const g = geoNow();
    const at = (cell) => (cell >= 1 ? g.cells[Math.min(TRACK, cell)] : g.cells[0]);
    for (const e of M.events) {
      if (e.type === 'throw') SOUNDS.throw();
      else if (e.type === 'nomove') SOUNDS.nomove();
      else if (e.type === 'step') SOUNDS.step();
      else if (e.type === 'land') {
        const pt = at(e.cell), col = `rgb(${PALETTE[e.p % 6].glow})`;
        if (e.kind === 'capture') { /* handled by the capture event */ }
        else if (e.kind === 'safe') { SOUNDS.land(); SOUNDS.safe(); spawn(M, rng, pt.x, pt.y, col, 'safe'); }
        else { SOUNDS.land(); spawn(M, rng, pt.x, pt.y, col, 'land'); }
      } else if (e.type === 'capture') {
        const pt = at(e.cell); SOUNDS.land(); SOUNDS.capture();
        spawn(M, rng, pt.x, pt.y, `rgb(${PALETTE[e.victim % 6].glow})`, 'capture'); spawn(M, rng, pt.x, pt.y, '#ffe08a', 'capture');
      } else if (e.type === 'home') { SOUNDS.home(); spawn(M, rng, g.head.x, g.head.y, '#ffe08a', 'win'); }
      else if (e.type === 'turn') { SOUNDS.turn(); spawn(M, rng, g.head.x, g.head.y, '#ffe08a', 'safe'); }
      else if (e.type === 'spend') SOUNDS.marble();
      else if (e.type === 'extra') SOUNDS.extra();
      else if (e.type === 'select') SOUNDS.select();
      else if (e.type === 'nudgeSet') SOUNDS.ui();
      else if (e.type === 'refuse') {
        SOUNDS.refuse();
        if (e.why === 'marble') toast(tr('tNoMarble')); else toast(tr('tNoLion'));
      } else if (e.type === 'move') {
        if (M.lastMove && (M.lastMove.marbleFrom >= 0 || M.lastMove.marbleGain)) later(e.delay + e.dur + 0.2, SOUNDS.tink);
      } else if (e.type === 'end') onEnd(M, e);
    }
    if (M.events.some((e) => e.type === 'move')) saveGame();
    M.events.length = 0;
  }

  function stepWinSeq(dt) {
    const w = S.winSeq;
    if (!w) return;
    w.t += dt;
    while (w.i < WIN_NOTES.length && w.t >= 0.3 + w.i * 0.11) {
      sfx({ freq: WIN_NOTES[w.i], dur: 0.35, type: 'sine', vol: 0.16 });
      sfx({ freq: WIN_NOTES[w.i] / 2, dur: 0.4, type: 'triangle', vol: 0.06 });
      w.i++;
    }
    if (w.i >= WIN_NOTES.length) S.winSeq = null;
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  const AUTO_SEATS = [{ ai: true, level: 'expert' }, { ai: true, level: 'skilled' }, { ai: true, level: 'skilled' }];
  function startAutoGame() {
    const a = S.auto;
    const M = createMatch({ seats: AUTO_SEATS, length: 'classic', auto: true });
    S.match = M; S.winSeq = null; S.endInfo = null;
    Object.assign(a, { phase: 'intro', t: 0, plan: null, note: { head: '', why: '' }, scan: null, options: [] });
  }
  function startAuto() {
    S.auto = { phase: 'intro', t: 0, paused: false, plan: null, note: { head: '', why: '' }, scan: null, options: [], games: 0 };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoGame();
  }
  // THINK (configurable) -> REVEAL (2 s: the options light up, the chosen move is marked) -> ACT. Pause freezes all of it.
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') { M.autoHold = true; if (a.t >= 1.2) { M.autoHold = false; a.phase = 'wait'; a.t = 0; } return; }
    if (M.over && a.phase !== 'celebrate' && a.phase !== 'summary') { a.phase = 'celebrate'; a.t = 0; }
    if (a.phase === 'wait') {
      if (M.phase === 'choose' && (M.aiPlan || M.aiTask)) { a.phase = 'think'; a.t = 0; a.plan = null; a.scan = null; }
    } else if (a.phase === 'think') {
      if (M.aiPlan && !a.plan) {
        a.plan = M.aiPlan; a.options = a.plan.scored.filter((s) => s.act !== a.plan.act).sort((x, y) => y.score - x.score).slice(0, 3).map((s) => s.act);
        a.note = describeAction(M.st, a.plan.act, seatName(M, M.st.turn));
      }
      const acts = allActions(M);
      a.scan = acts.length ? cellOf(acts[Math.floor(a.t / 0.45) % acts.length].to) : null;
      if (a.t >= THINK_STEPS[S.thinkIdx] && a.plan) { a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) { a.phase = 'act'; a.t = 0; commit(M, a.plan.act); M.aiPlan = null; }
    } else if (a.phase === 'act') {
      if (a.t >= 0.4 && M.phase !== 'moving') { a.phase = 'wait'; a.t = 0; }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.6) { a.games += 1; S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
    }
  }

  // ------------------------------------------------------------------------------ stage helpers (store screenshots / QA)
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001+ stage a real moment instead of random play.
  function settle(M, secs) { for (let i = 0; i < secs * 60; i++) stepMatch(M, 1 / 60, rng); M.events.length = 0; }
  function quickTurn(M, levelId = 'skilled') {
    // plays one whole turn silently: throw, choose, move
    let guard = 0;
    while (M.phase !== 'throw' && M.phase !== 'over' && guard++ < 4000) stepMatch(M, 1 / 30, rng);
    if (M.over) return;
    doThrow(M, rng);
    while (M.phase === 'rolling' && guard++ < 4000) stepMatch(M, 1 / 30, rng);
    if (M.phase === 'choose') {
      M.aiTask = null; M.aiPlan = null;
      const pl = plan(M.st, M.value, levelId, M.st.tn);
      if (pl.act) commit(M, pl.act);
    }
    while ((M.phase === 'moving' || M.phase === 'pass') && guard++ < 4000) stepMatch(M, 1 / 30, rng);
    M.events.length = 0; M.parts.length = 0; M.marbles.length = 0; M.ghosts.length = 0;
  }
  const ff = (M, turns) => { for (let i = 0; i < turns && !M.over; i++) quickTurn(M, 'skilled'); };
  function doThrowFixed(M, v) {
    const flats = v === 5 ? [false, false, false, false] : [0, 1, 2, 3].map((i) => i < v);
    M.sticks = { flats, t: STICK_T + 1, x: [0, 0, 0, 0], ang: [0.06, -0.05, 0.04, -0.07], spin: [0, 0, 0, 0], dy: [0.1, -0.12, 0.08, -0.05] };
    M.value = v; M.phase = 'choose'; M.phaseT = 5; M.adj = 0; M.sel = -1; M.aiTask = null; M.aiPlan = null; M.thinking = false;
  }
  // advance quietly until the seat to move has a throw with at least two choices (and, if asked, one of `wantKind`); leaves M in the choose phase
  function toChoice(M, wantKind) {
    for (let k = 0; k < 300 && !M.over; k++) {
      let guard = 0;
      while (M.phase !== 'throw' && guard++ < 4000) stepMatch(M, 1 / 30, rng);
      for (const v of [2, 3, 1, 4, 5]) {
        if (!M.auto && M.seats[M.st.turn].ai) break;
        const acts = actionsFor(M.st, M.st.turn, v).filter((a) => a.adj === 0);
        if (acts.length >= (wantKind ? 1 : 2) && (!wantKind || acts.some((a) => a.kind === wantKind))) { doThrowFixed(M, v); return acts; }
      }
      quickTurn(M, 'skilled');
    }
    return [];
  }
  function mk(n = 3, level = 'skilled', length = 'classic', humans = 1) {
    S.setup = { n, seats: [0, 1, 2, 3, 4, 5].map((i) => i >= humans), level, length };
    const seats = Array.from({ length: n }, (_, i) => ({ ai: i >= humans, level }));
    startMatch({ seats, length, level }, false);
    return S.match;
  }
  function endNow(M, w) { M.st.lions[w] = M.st.lions[w].map(() => 200); M.st.over = { winner: w, why: 'home' }; M.over = M.st.over; M.phase = 'over'; onEnd(M, { winner: w, why: 'home' }); S.overlay = 'end'; S.ovT = 1; }
  function stageShot(n) {
    S.shot = true;
    S.stats = { 'skilled:3': [4, 2], 'expert:2': [1, 3] };
    if (n === 1) { S.scene = 'title'; S.t = 1.2; }
    else if (n === 2) { const M = mk(3); ff(M, 5); settle(M, 1); }
    else if (n === 3) { const M = mk(3); ff(M, 14); toChoice(M); }
    else if (n === 4) { const M = mk(3); ff(M, 18); const acts = toChoice(M, 'capture'); const a = acts.find((x) => x.kind === 'capture') ?? acts[0]; if (a) M.sel = a.i; }
    else if (n === 5) { const M = mk(3); ff(M, 16); toChoice(M); const pl = plan(M.st, M.value, 'expert', 1); if (pl.act) { M.adj = pl.act.adj; M.sel = pl.act.i; const h = hintText(M.st, pl, 'You'); M.hint = { act: pl.act, head: h.head, why: h.why }; } }
    else if (n === 6) { S.thinkIdx = 0; startAuto(); const M = S.match; M.autoHold = false; ff(M, 12); toChoice(M); const pl = plan(M.st, M.value, 'expert', 2); M.aiPlan = pl; S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.plan = pl; S.auto.options = pl.scored.filter((s) => s.act !== pl.act).slice(0, 3).map((s) => s.act); S.auto.note = describeAction(M.st, pl.act, seatName(M, M.st.turn)); S.auto.paused = true; }
    else if (n === 7) { S.scene = 'setup'; S.setup = { n: 4, seats: [false, true, true, true, true, true], level: 'expert', length: 'classic' }; }
    else if (n === 8) { S.scene = 'rules'; }
    else if (n === 9) { S.scene = 'about'; }
    else if (n === 10) { const M = mk(2, 'skilled', 'quick'); ff(M, 14); endNow(M, 0); }
    else if (n === 11) { S.themeId = 'basalt'; const M = mk(4); ff(M, 14); toChoice(M); }
    else if (n === 12) { S.themeId = 'lapis'; const M = mk(5); ff(M, 20); toChoice(M); }
    else if (n === 13) { S.scene = 'howto'; }
    else if (n === 14) { S.themeId = 'basalt'; S.scene = 'title'; S.t = 2.4; }
    else if (n === 15) { S.themeId = 'lapis'; const M = mk(6); ff(M, 24); toChoice(M); }
    else if (n === 16) { const M = mk(3, 'skilled', 'long'); ff(M, 22); toChoice(M); }
    else if (n === 17) { const M = mk(3, 'skilled', 'classic', 2); ff(M, 14); toChoice(M); }
    else if (n >= 20 && n <= 40) { // text zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 20) S.scene = 'title';
      else if (n === 21) S.scene = 'settings';
      else if (n === 22) S.scene = 'about';
      else if (n === 23) { const M = mk(2); ff(M, 10); endNow(M, 0); }
      else if (n === 24) S.scene = 'setup';
      else if (n === 25) { const M = mk(3); ff(M, 10); settle(M, 1); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 26) S.scene = 'demo-limit';
      else if (n === 27) S.scene = 'howto';
      else if (n === 28) { S.textIdx = 0; const M = mk(6); ff(M, 12); toChoice(M); }
      else if (n === 29) { S.textIdx = 2; const M = mk(3); ff(M, 12); toChoice(M); }
      else if (n === 30) { S.textIdx = 0; S.scene = 'setup'; S.setup.n = 6; }
      else if (n === 31) { S.textIdx = 0; startAuto(); const M = S.match; M.autoHold = false; ff(M, 12); S.auto.paused = true; S.auto.phase = 'think'; }
      else if (n === 32) { S.textIdx = 0; S.demo = true; S.scene = 'title'; }
      else if (n === 33) { S.textIdx = 0; S.scene = 'setup'; }
      else if (n === 34) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 35) { S.textIdx = 0; S.scene = 'about'; }
      else if (n === 36) { S.textIdx = 0; const M = mk(3); ff(M, 10); settle(M, 1); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 37) { S.textIdx = 0; const M = mk(2); ff(M, 10); endNow(M, 0); }
      else if (n === 38) { S.textIdx = 0; S.scene = 'demo-limit'; }
    } else if (n >= 1001 && n <= 1040) { S.scene = 'rules'; S.scroll.rules = (n - 1001) * 420; }
    else if (n >= 2001 && n <= 2040) { S.scene = 'rules'; S.textIdx = 4; S.scroll.rules = (n - 2001) * 420; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && sd >= 900001 && sd <= 902040 ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {};
    S.scroll[scene] = 0;
    SOUNDS.ui();
  }
  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }
  function leaveToMenu() { saveGame(); S.match = null; S.auto = null; gotoScene('title'); }

  function doThink() {
    const M = S.match;
    if (!M || M.over || !humanTurn(M) || M.phase !== 'choose' || M.hintTask) return;
    const st = M.st, v = M.value;
    M.hint = null; M.sel = -1;
    M.hintTask = { gen: planGen(st, v, 'expert', st.tn + 7), done: (pl) => {
      if (S.match === M && M.st === st && M.value === v && pl.act) {
        const h = hintText(st, pl, 'You');
        M.adj = pl.act.adj; M.sel = pl.act.i; M.hint = { act: pl.act, head: h.head, why: h.why }; SOUNDS.hint();
      }
    } };
  }
  function doRestart() {
    const M = S.match;
    if (!M || M.auto) return;
    startMatch(S.lastOpts ?? { seats: M.seats, length: M.length, level: 'skilled' }, S.demo);
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'af:home') { env.openArcforgeHome?.(); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('n:')) {
      S.setup.n = Number(id.slice(2));
      if (S.setup.seats.slice(0, S.setup.n).every(Boolean)) S.setup.seats[0] = false;
      saveSettings(); SOUNDS.ui(); return;
    }
    if (id.startsWith('seat:')) {
      const i = Number(id.slice(5));
      S.setup.seats[i] = !S.setup.seats[i];
      if (S.setup.seats.slice(0, S.setup.n).every(Boolean)) S.setup.seats[i] = false;   // at least one person
      saveSettings(); SOUNDS.ui(); return;
    }
    if (id.startsWith('lv:')) { const l = id.slice(3); if (demoLocked(S, 'level', l)) return; S.setup.level = l; saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('len:')) { const l = id.slice(4); if (demoLocked(S, 'length', l)) return; S.setup.length = l; saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('pace:')) { S.pace = Number(id.slice(5)); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('theme:')) { S.themeId = id.slice(6); saveSettings(); startBake(); SOUNDS.ui(); return; }
    switch (id) {
      case 'play': gotoScene('setup'); return;
      case 'continue': continueGame(); return;
      case 'start': saveSettings(); startMatch({ seats: seatsFromSetup(), length: S.setup.length, level: S.setup.level }); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': case 'menu': gotoScene('title'); return;
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.stats = {}; S.save = null; S.progress = { games: 0, wins: 0 };
        saveStats(); storage.set('mh.save', null); storage.set('mh.progress', S.progress); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:restart': S.overlay = null; doRestart(); return;
      case 'ov:menu': S.overlay = null; leaveToMenu(); return;
      case 'ov:again': S.overlay = null; startMatch(S.lastOpts ?? { seats: seatsFromSetup(), length: S.setup.length, level: S.setup.level }); return;
      case 'ov:setup': S.overlay = null; S.match = null; gotoScene('setup'); return;
      case 'ov:autoagain': S.overlay = null; startAuto(); return;
      case 'ov:autoexit': S.overlay = null; S.auto = null; S.match = null; gotoScene('title'); return;
      default:
    }
  }

  // ------------------------------------------------------------------------------ pointer handling
  function fixedHit(ui, x, y) {
    for (const f of ui.fixed) if (f.id != null && !f.disabled && inRect(x, y, f.rect)) return f;
    return null;
  }

  function toolAt(x, y) {
    const l = lay();
    if (S.scene === 'auto') {
      for (const id of ['exit', 'slower', 'pause', 'faster']) if (l.auto[id] && inRect(x, y, l.auto[id])) return { id: `auto:${id}`, rect: l.auto[id] };
      return null;
    }
    if (l.mode === 'stack' && inRect(x, y, l.pauseTop)) return { id: 'tool:pause', rect: l.pauseTop };
    for (const id of ['nudgeM', 'nudgeP', 'think', 'pause', 'pass', 'throw']) if (inRect(x, y, l.tools[id])) return { id: `tool:${id}`, rect: l.tools[id] };
    return null;
  }

  function onDown(x, y) {
    S.toast = null;
    if ((S.scene === 'play' || S.scene === 'auto') && !S.overlay && S.match) {
      const tl = toolAt(x, y);
      if (tl) { S.press = { id: tl.id, active: true, kind: 'tool', rect: tl.rect }; return; }
      if (S.scene === 'play') {
        const l = lay();
        const M = S.match;
        // a tap on the current seat's plate enters a waiting lion
        for (let i = 0; i < l.plates.length; i++) if (inRect(x, y, l.plates[i]) && i === M.st.turn) { S.press = { id: `plate:${i}`, active: true, kind: 'plate', rect: l.plates[i] }; return; }
        if (!humanTurn(M) && !M.over) { M.turbo = true; return; }
        const g = geoNow(), nr = cellNear(g, x, y);
        if (nr.d < g.cellW * 0.78) S.press = { id: nr.cell, active: true, kind: 'cell' };
      }
      return;
    }
    const ui = buildUi(S);
    if (!ui.layout) return;
    if (S.scene === 'title') {
      const T = ui.title ?? titleFrame(S.w, S.h), zone = T.lock ? creditHit(T.lock) : null;
      if (zone && inRect(x, y, zone)) { S.press = { id: 'af:home', active: true, kind: 'fixed', rect: zone }; return; }
    }
    const f = fixedHit(ui, x, y);
    if (f) { S.press = { id: f.id, active: true, kind: 'fixed', rect: f.rect }; return; }
    const reg = ui.region;
    if (inRect(x, y, { x: reg.x - 6, y: reg.y - 4, w: reg.w + 12, h: reg.h + 8 })) {
      const hit = hitDoc(ui.layout, x - reg.x, y - reg.y - (ui.offY || 0) + getScroll(ui));
      const ok = Boolean(hit && !hit.disabled);
      S.press = { id: ok ? hit.id : null, active: ok, kind: 'doc', x0: x, y0: y, scroll0: getScroll(ui), scrolling: false, lastY: y, vel: 0 };
      S.scrollVel = {};
    } else S.press = null;
  }

  function onMove(x, y, dt) {
    const pr = S.press;
    if (!pr) return;
    if (pr.kind === 'cell') { const g = geoNow(), nr = cellNear(g, x, y); pr.active = nr.cell === pr.id && nr.d < g.cellW * 0.9; return; }
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) { S.press = null; return; }
      if (!pr.scrolling && Math.abs(y - pr.y0) > 10) { pr.scrolling = true; pr.active = false; }
      if (pr.scrolling) {
        setScroll(ui, pr.scroll0 - (y - pr.y0));
        pr.vel = pr.vel * 0.6 + (-(y - pr.lastY) / Math.max(dt, 1e-3)) * 0.4;
        pr.lastY = y;
      }
    } else if (pr.rect) pr.active = inRect(x, y, pr.rect);
  }

  function tapCell(M, cell) {
    if (!humanTurn(M) || M.phase !== 'choose') { if (M.phase === 'throw' && humanTurn(M)) toast(tr('tNotNow')); return; }
    const p = M.st.turn;
    const li = M.st.lions[p].findIndex((c) => c !== 0 && !isHome(c) && cellOf(c) === cell);
    if (li >= 0 && cell !== HEAD) pickAction(M, { lion: li });
    else pickAction(M, { cell });
  }

  function onUp(x, y) {
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'cell') {
      const g = geoNow(), nr = cellNear(g, x, y);
      if (S.scene === 'play' && S.match && !S.overlay && nr.cell === pr.id && nr.d < g.cellW * 0.9) tapCell(S.match, pr.id);
      return;
    }
    if (pr.kind === 'plate') {
      const M = S.match;
      if (M && inRect(x, y, pr.rect) && humanTurn(M) && M.phase === 'choose') { const li = M.st.lions[M.st.turn].findIndex((c) => c === 0); if (li >= 0) pickAction(M, { lion: li }); }
      return;
    }
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) return;
      if (pr.scrolling) { S.scrollVel[ui.scrollKey] = pr.vel; return; }
      const hit = hitDoc(ui.layout, x - ui.region.x, y - ui.region.y - (ui.offY || 0) + getScroll(ui));
      if (hit && hit.id === pr.id && !hit.disabled) activate(hit.id);
    } else if (pr.kind === 'fixed') { if (inRect(x, y, pr.rect)) activate(pr.id); }
    else if (pr.kind === 'tool') { if (inRect(x, y, pr.rect)) toolAction(pr.id); }
  }

  function toolAction(id) {
    const M = S.match;
    if (!M) return;
    if (id.startsWith('auto:')) {
      const a = id.slice(5);
      if (a === 'exit') { S.auto = null; S.match = null; gotoScene('title'); }
      else if (a === 'pause') S.auto.paused = !S.auto.paused;
      else if (a === 'slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
      else if (a === 'faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
      return;
    }
    const a = id.slice(5);
    if (a === 'pause') { S.overlay = 'pause'; S.ovT = 0; return; }
    if (!humanTurn(M)) { toast(tr('tYourTurn')); return; }
    if (a === 'throw') {
      if (M.phase === 'throw') doThrow(M, rng);
      else if (M.phase === 'choose') { if (!confirmSelected(M)) toast(tr('pick', { v: M.value })); }
    } else if (a === 'nudgeM') { if (M.phase === 'choose') toggleNudge(M, -1); else toast(tr('tNotNow')); }
    else if (a === 'nudgeP') { if (M.phase === 'choose') toggleNudge(M, 1); else toast(tr('tNotNow')); }
    else if (a === 'think') { if (M.phase === 'choose') doThink(); else toast(tr('tNotNow')); }
    else if (a === 'pass') skipTurn(M);
  }

  // ---- keyboard
  function tapLion(M, i) { if (humanTurn(M) && M.phase === 'choose' && i < M.st.lions[M.st.turn].length) pickAction(M, { lion: i }); }
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match) {
      const M = S.match;
      if (has('Space') || has('Enter')) toolAction('tool:throw');
      if (has('Digit1')) tapLion(M, 0);
      if (has('Digit2')) tapLion(M, 1);
      if (has('ArrowLeft') || has('KeyN')) toolAction('tool:nudgeM');
      if (has('ArrowRight') || has('KeyM')) toolAction('tool:nudgeP');
      if (has('KeyT')) toolAction('tool:think');
      if (has('KeyS')) toolAction('tool:pass');
      if (has('Escape') || has('KeyP')) { S.overlay = 'pause'; S.ovT = 0; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('KeyP'))) { S.overlay = null; return; }
    if (S.scene === 'auto' && S.auto) {
      if (has('Space') || has('KeyP')) S.auto.paused = !S.auto.paused;
      if (has('Escape') && !S.overlay) toolAction('auto:exit');
      return;
    }
    const ui = buildUi(S);
    if (ui.layout && ui.region) {
      if (keys.down.has('ArrowDown') || keys.down.has('PageDown')) setScroll(ui, getScroll(ui) + 18);
      if (keys.down.has('ArrowUp') || keys.down.has('PageUp')) setScroll(ui, getScroll(ui) - 18);
      if (has('Home')) setScroll(ui, 0);
      if (has('End')) setScroll(ui, 1e9);
    }
    if (has('Escape') && ['setup', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) gotoScene('title');
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      syncSize();
      stepBake();
      // the kit's free-preview pill sits in the badge slot of the play layouts (and shows only while the game is not owned)
      S.previewPill = !S.owns && !S.demo && !S.shot;
      meta.previewBadge = (S.scene === 'play' || S.scene === 'auto') && S.match ? lay().badge : undefined;
      // Watch & Learn's Pause (and the in-game pause card) freezes the whole loop: timers, search, animations, particles, the ambient clock.
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0 && !frozen) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      if (!frozen) {
        for (const q of S.timers) q.t -= dt;
        const due = S.timers.filter((q) => q.t <= 0);
        if (due.length) { S.timers = S.timers.filter((q) => q.t > 0); for (const q of due) q.fn(); }
      }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && (S.press.kind === 'cell' || S.press.kind === 'tool' || S.press.kind === 'plate') && !ptr.down && !ptr.pressed && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded): let go where the finger last was.
        const p = S.press; S.press = null;
        if (p.kind === 'cell') { const g = geoNow(), nr = cellNear(g, S.lastPtr.x, S.lastPtr.y); if (S.match && S.scene === 'play' && !S.overlay && nr.cell === p.id) tapCell(S.match, p.id); }
      }
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      const wv = input.wheel;
      if (wv && wv.dy && !S.shot && !((S.scene === 'play' || S.scene === 'auto') && !S.overlay)) {
        const wui = buildUi(S);
        if (wui.layout && wui.region) { setScroll(wui, getScroll(wui) + wv.dy * 1.4); S.scrollVel = {}; }
      }
      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }

      const M = S.match;
      if (M) {
        if (S.scene === 'play') { if (S.overlay !== 'pause') stepMatch(M, dt, rng, paceSpeed(M)); }
        else if (S.scene === 'auto' && !frozen) { stepMatch(M, dt, rng); updateAuto(dt); }
        if (S.scene === 'play' || S.scene === 'auto') {
          handleEvents(M);
          if (!frozen) stepWinSeq(dt);
        }
        if (S.scene === 'play' && M.over && !S.overlay && M.overT > 1.8 && settled(M) && !S.shot) { S.overlay = 'end'; S.ovT = 0; }
      }
    },

    render(ctx) {
      syncSize();
      render(ctx, S, buildUi(S));
    },

    getState() {
      const M = S.match;
      return {
        size: [S.w, S.h], scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, setup: { ...S.setup, seats: S.setup.seats.slice(0, S.setup.n) },
        stats: S.stats, scroll: S.scroll, demoGames: S.demoGames, baked: Boolean(S.baked),
        auto: S.auto ? { phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          n: M.st.n, length: M.length, turn: M.st.turn, tn: M.st.tn, phase: M.phase, value: M.value, adj: M.adj, sel: M.sel, humans: M.humans,
          lions: M.st.lions.map((a) => a.join(',')).join('|'), marbles: M.st.marbles.join(','), over: M.over ? [M.over.winner, M.over.why] : null,
          hint: M.hint ? [M.hint.act.i, M.hint.act.adj] : null, moving: Boolean(M.anim), log: M.log.length,
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, setup, Rules / How to Play / About, Settings, every overlay (pause, result,
    // Watch & Learn summary), the demo card and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && (S.match.over || (S.match.log.length === 0 && S.match.phase === 'throw'))),
  };
}
