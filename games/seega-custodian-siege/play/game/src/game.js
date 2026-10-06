// GAME CONTRACT (docs/GAME-CONTRACT.md). Seega: placement, custodian capture, five opponent levels, a tutor path.
import { SCREEN, lockHit, inRect, BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, playLayout, setSize } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoLevelLocked, demoOver, recKey } from './screens.js';
import { NN, N, CENTRE, STALL_LIMIT, legalMoves, applyMove, isPlacing, countOf, other } from './rules.js';
import { LEVELS, seeded, placementSearch, chooseMovement } from './ai.js';
import { thinkAdvice, describeMove, explainMove, explainPlacement } from './explain.js';
import { LESSONS, lessonStart, judge } from './lessons.js';
import { createMatch, playMove, undoMatch, tapCell, stepMatch, spawn, canUndo, humanTurn, settled } from './match.js';
import { RULE_COUNT, HOWTO_COUNT, tr, cellWords, sideLabel, lvName, stonesText, stonesObj } from './content.js';
import { setLang, getLang } from './lang.js';
import { boardGeo, themeById, THEMES } from './art.js';
import { render } from './view.js';

// Fluid viewport (kit 1.7): the short side is always 720 units, the long side follows the screen; the kit updates width / height live.
export const meta = { width: SCREEN.width, height: SCREEN.height, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the scrolling document screens; empty in headless runs.
export const wheelInput = { dy: 0 };

const VERSION = '1.1.2';   // fallback only: the About page shows env.manifest.version (game.json) when the kit provides it
const WIN_NOTES = [523, 659, 784, 1047, 1319];
// Watch & Learn: Skilled plays the pebbles and Casual the date stones, which gives a lively game with captures and a finish.
const AUTO_LEVEL = { 1: 'skilled', 2: 'casual' };

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'sand', textIdx: 0, thinkIdx: 1,
    setup: { level: 'skilled', side: 1 }, stats: {}, lessons: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, lessonIdx: 0, endInfo: null, lessonInfo: null,
    toast: null, toastT: 0, ghost: -1, ghostWho: 0, kbd: false, canUndo: false, firstGame: true, winSeq: null, lessonWait: -1, lessonOk: null, lastOpts: null,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: env.manifest?.version ?? VERSION, shot: false, lastPtr: { x: 0, y: 0 },
  };

  const [set, stats, les, save, dg, prog] = await Promise.all([storage.get('sg.settings', null), storage.get('sg.stats', null), storage.get('sg.lessons', null), storage.get('sg.save', null), storage.get('sg.demo', 0), storage.get('sg.progress', null)]);
  if (set) {
    if (set.lang === 'ar' || set.lang === 'en') setLang(set.lang);
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
    if (set.setup) {
      const lv = set.setup.level === 'two' || LEVELS.some((l) => l.id === set.setup.level) ? set.setup.level : 'skilled';
      S.setup = { level: lv, side: set.setup.side === 2 ? 2 : 1 };
    }
  }
  if (stats && typeof stats === 'object') S.stats = stats;
  if (les && typeof les === 'object') S.lessons = les;
  if (save && Array.isArray(save.moves) && (save.two || LEVELS.some((l) => l.id === save.level))) S.save = save;
  if (Number.isInteger(dg)) S.demoGames = dg;
  if (prog && Number.isInteger(prog.wins) && Number.isInteger(prog.games)) S.progress = { games: prog.games, wins: prog.wins };
  if (!set) setLang('en');
  S.firstGame = !Object.keys(S.stats).length && !Object.keys(S.lessons).length;
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const th = () => themeById(S.themeId);
  const pal = () => ({ 1: th().p.glow, 2: th().d.glow });
  const saveSettings = () => storage.set('sg.settings', { lang: getLang(), sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, setup: S.setup });
  const saveStats = () => storage.set('sg.stats', S.stats);
  const saveLessons = () => storage.set('sg.lessons', S.lessons);
  const saveGame = () => {
    const M = S.match;
    if (S.scene !== 'play' || !M || M.lesson || M.auto) return;
    S.save = M.over || !M.hist.length ? null : { level: M.level, human: M.human, two: M.two, moves: M.hist.map((h) => [h.mv.from, h.mv.to]) };
    storage.set('sg.save', S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    place: (who) => {
      if (who === 1) { sfx({ freq: 210, to: 120, dur: 0.1, type: 'sine', vol: 0.16 }); sfx({ freq: 1250, dur: 0.02, type: 'square', vol: 0.025 }); }
      else { sfx({ freq: 330, to: 190, dur: 0.09, type: 'triangle', vol: 0.15 }); sfx({ freq: 880, to: 700, dur: 0.12, type: 'sine', vol: 0.05 }); }
    },
    swish: () => sfx({ freq: 520, to: 300, dur: 0.1, type: 'sine', vol: 0.035 }),
    slide: () => sfx({ freq: 300, to: 480, dur: 0.14, type: 'sine', vol: 0.06 }),
    capture: () => { sfx({ freq: 560, to: 220, dur: 0.18, type: 'triangle', vol: 0.13 }); sfx({ freq: 150, to: 90, dur: 0.22, type: 'sine', vol: 0.12 }); },
    select: () => sfx({ freq: 620, to: 760, dur: 0.06, type: 'sine', vol: 0.08 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.06 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    pass: () => { sfx({ freq: 330, dur: 0.14, type: 'sine', vol: 0.08 }); sfx({ freq: 247, dur: 0.2, type: 'sine', vol: 0.08 }); },
    lose: () => { [392, 330, 262].forEach((f, i) => sfx({ freq: f, to: f * 0.96, dur: 0.4, type: 'sine', vol: 0.09 - i * 0.01 })); },
    draw: () => { sfx({ freq: 440, dur: 0.3, type: 'sine', vol: 0.09 }); sfx({ freq: 392, dur: 0.4, type: 'sine', vol: 0.07 }); },
  };

  // ------------------------------------------------------------------------------ geometry helpers
  const lay = (chain = false) => playLayout(TEXT_SCALES[S.textIdx], chain);
  const geoNow = () => { const l = lay(); return boardGeo(l.board.x, l.board.y, l.board.side); };
  const chainOpen = (M) => Boolean(M && !M.over && !M.auto && M.st.chain >= 0 && humanTurn(M));
  const cellAt = (x, y) => {
    const g = geoNow(), r = g.cell / 2 + 3;
    for (let i = 0; i < NN; i++) { const [cx, cy] = g.centers[i]; if (Math.abs(x - cx) <= r && Math.abs(y - cy) <= r) return i; }
    return -1;
  };
  const toast = (msg) => { S.toast = msg; S.toastT = 2.4; };

  // ------------------------------------------------------------------------------ matches
  function launch(M) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.ghost = -1; S.endInfo = null; S.lessonInfo = null; S.winSeq = null; S.toast = null; S.lessonWait = -1; S.lessonOk = null;
  }
  function startMatch(opts, count = true) {
    if (demoLevelLocked(S, opts.level) || (count && demoOver(S))) { S.scene = 'demo-limit'; S.overlay = null; return; }
    const two = opts.level === 'two';
    const M = createMatch({ level: two ? 'skilled' : opts.level, human: opts.side ?? 1, two, pal: pal(), lesson: opts.lesson ?? null, start: opts.start });
    if (count && S.demo) { S.demoGames += 1; storage.set('sg.demo', S.demoGames); }
    launch(M);
    if (!opts.lesson) { S.lastOpts = opts; S.save = null; storage.set('sg.save', null); }
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = createMatch({ level: sv.level ?? 'skilled', human: sv.human ?? 1, two: Boolean(sv.two), pal: pal() });
    for (const [from, to] of sv.moves) {
      const mv = legalMoves(M.st).find((m) => m.from === from && m.to === to);
      if (!mv) break;
      playMove(M, mv, true);
    }
    M.events.length = 0; M.aiT = 0.6;
    launch(M);
    S.lastOpts = { level: sv.two ? 'two' : sv.level, side: sv.human ?? 1 };
    S.overlay = 'pause'; S.ovT = 0; // resuming starts paused
  }
  function startLesson(i) {
    const L = LESSONS[i];
    if (!L || (S.demo && i >= 3)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    S.lessonIdx = i;
    startMatch({ level: 'novice', side: 1, lesson: L, start: lessonStart(L) }, false);
    const M = S.match;
    M.gate = (mv) => {
      const j = judge(L, M.st, mv);
      if (!j.ok) { S.lessonInfo = { ok: false, head: tr('notQuite'), body: j.text.replace(/^(Not quite\.|ليس تمامًا\.)\s*/, '') }; S.overlay = 'lesson'; S.ovT = 0; SOUNDS.refuse(); return false; }
      S.lessonOk = j; S.lessonWait = 0;
      return true;
    };
  }

  // who is "You", a level name, or a side name (two players, Watch & Learn, lessons)
  const named = (M) => M.two || M.auto || M.lesson;
  const nameFor = (M, who) => (named(M) ? sideLabel(who) : who === M.human ? tr('youWord') : lvName(M.level));
  function onEnd(M, e) {
    const w = e.winner;
    const youWon = !M.two && !M.auto && !M.lesson && w === M.human;
    const st = M.st, a = countOf(st, 1), b = countOf(st, 2);
    let head, body;
    if (w === 0) head = tr('aDraw');
    else if (named(M)) head = tr('sideWin', { side: sideLabel(w) });
    else head = youWon ? tr('youWin') : tr('levelWins', { name: lvName(M.level) });
    if (e.why === 'captured') {
      const lo = other(w);
      if (named(M)) body = tr('reducedSide', { side: sideLabel(lo) });
      else body = lo === M.human ? tr('reducedYou') : tr('reducedOne', { name: lvName(M.level) });
    } else {
      const lead = e.why === 'stall' ? tr('stallLead', { n: STALL_LIMIT }) : tr('lockLead');
      const hi = w === 1 ? a : b, lo = w === 1 ? b : a;
      if (w === 0) body = tr('endEqual', { lead, n: stonesText(a) });
      else if (named(M)) body = tr('endMoreSide', { lead, side: sideLabel(w), a: hi, b: lo });
      else if (w === M.human) body = tr('endMoreYou', { lead, a: hi, b: lo });
      else body = tr('endMoreOne', { lead, name: lvName(M.level), a: hi, b: lo });
    }
    let rec = '';
    if (!M.two && !M.auto && !M.lesson) {
      const key = recKey(M.level, M.human);
      const r = S.stats[key] ?? [0, 0, 0];
      r[w === 0 ? 1 : youWon ? 0 : 2] += 1;
      S.stats[key] = r; saveStats(); S.firstGame = false;
      S.progress.games += 1; if (youWon) S.progress.wins += 1; storage.set('sg.progress', S.progress);
      const tot = [0, 0, 0];
      for (const sd of [1, 2]) { const q = S.stats[recKey(M.level, sd)] ?? [0, 0, 0]; for (let i = 0; i < 3; i++) tot[i] += q[i]; }
      rec = tr('recordLine', { label: tr('record'), level: lvName(M.level), w: tot[0], d: tot[1], l: tot[2] });
      S.save = null; storage.set('sg.save', null);
    }
    S.endInfo = { head, body, rec, winner: w };
    if (w === 0) SOUNDS.draw();
    else if (M.two || M.auto || M.lesson || youWon) S.winSeq = { t: 0, i: 0 };
    else SOUNDS.lose();
  }

  function handleEvents(M) {
    for (const e of M.events) {
      if (e.type === 'place') SOUNDS.swish();
      else if (e.type === 'slide') SOUNDS.slide();
      else if (e.type === 'land') { SOUNDS.place(e.who); const g = geoNow(), [cx, cy] = g.centers[e.at]; spawn(M, rng, cx, cy, e.who, 'land'); }
      else if (e.type === 'capturing') { if (S.scene === 'play') toast(tr('capturedToast', { n: stonesObj(e.n) })); }
      else if (e.type === 'capture') { SOUNDS.capture(); const g = geoNow(), [cx, cy] = g.centers[e.at]; spawn(M, rng, cx, cy, e.who, 'capture'); }
      else if (e.type === 'pass') SOUNDS.pass();
      else if (e.type === 'refuse') {
        SOUNDS.refuse();
        if (e.why === 'centre') toast(tr('tCentre'));
        else if (e.why === 'taken') toast(tr('tTaken'));
        else if (e.why === 'stuck') toast(tr('tStuck'));
        else if (e.why === 'foe') toast(tr('tFoe'));
        else if (e.why === 'far') toast(tr('tFar'));
        else if (e.why === 'chain') toast(tr('tChain'));
      } else if (e.type === 'select') SOUNDS.select();
      else if (e.type === 'undo') SOUNDS.undo();
      else if (e.type === 'end') onEnd(M, e);
      else if (e.type === 'burst' && M.over && M.over.winner) {
        const g = geoNow();
        for (let i = 0; i < NN; i++) if (M.st.cells[i] === M.over.winner && i % 3 === 0) { const [cx, cy] = g.centers[i]; spawn(M, rng, cx, cy, M.over.winner, 'win'); }
      }
    }
    if (M.events.some((e) => e.type === 'place' || e.type === 'slide' || e.type === 'undo' || e.type === 'endturn')) saveGame();
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
  function startAutoGame() {
    const a = S.auto;
    const M = createMatch({ auto: true, pal: pal() });
    S.match = M; S.winSeq = null; S.endInfo = null;
    Object.assign(a, { phase: 'intro', t: 0, plan: null, task: null, scan: null, note: { head: '', why: '' }, actIdx: 0 });
  }
  function startAuto() {
    S.auto = { phase: 'intro', t: 0, paused: false, plan: null, task: null, scan: null, note: { head: '', why: '' }, actIdx: 0, games: 0 };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoGame();
  }
  // One decision: placement is a pair of stones (the turn), movement is one slide. Runs in slices so Pause can freeze it.
  function* planGen(st) {
    const arng = seeded(0x5ee9a ^ (st.tn * 977) ^ (st.placed[0] * 7919 + st.placed[1] * 131) ^ (countOf(st, 1) * 31));
    if (st.phase === 'place') {
      const empties = [];
      for (let i = 0; i < NN; i++) if (st.cells[i] === 0 && i !== CENTRE) empties.push(i);
      const r1 = yield* placementSearch(st, AUTO_LEVEL[st.turn], arng);
      const mv1 = { from: -1, to: r1.cell };
      const s1 = applyMove(st, mv1);
      const r2 = yield* placementSearch(s1, AUTO_LEVEL[st.turn], arng);
      const mv2 = { from: -1, to: r2.cell };
      return {
        mvs: [mv1, mv2], options: empties,
        note: { head: tr('autoPlaceHead', { side: sideLabel(st.turn) }), why: tr('autoFirst', { cell: cellWords(r1.cell), why: explainPlacement(st, r1.cell) }) },
      };
    }
    const mv = chooseMovement(st, AUTO_LEVEL[st.turn], arng);
    return { mvs: [mv], moves: legalMoves(st), note: { head: describeMove(st, mv), why: explainMove(st, mv) } };
  }
  function beginThink() { const a = S.auto; a.phase = 'think'; a.t = 0; a.plan = null; a.scan = null; a.task = planGen(S.match.st); }
  const settledEnough = (M, idx) => idx === 0 || Object.values(M.anim).every((x) => x.t >= 0.25);
  // THINK (configurable, the engine search runs in slices) -> REVEAL (2 s: the options light up, the chosen one is marked) -> ACT
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1.2) beginThink();
    } else if (a.phase === 'think') {
      if (a.task) { const r = a.task.next(); if (r.done) { a.plan = r.value; a.note = a.plan.note; a.task = null; } }
      const empties = M.st.cells.map((c, i) => (c === 0 && i !== CENTRE ? i : -1)).filter((i) => i >= 0);
      a.scan = empties.length ? empties[Math.floor(a.t / 0.4) % empties.length] : null;
      if (a.t >= THINK_STEPS[S.thinkIdx] && a.plan) { a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) { a.phase = 'act'; a.t = 0; a.actIdx = 0; }
    } else if (a.phase === 'act') {
      const mvs = a.plan.mvs;
      if (a.actIdx < mvs.length && a.t >= a.actIdx * 0.65 && settledEnough(M, a.actIdx)) { playMove(M, mvs[a.actIdx]); a.actIdx += 1; }
      if (a.actIdx >= mvs.length && a.t >= 0.7 + (mvs.length - 1) * 0.65 && settled(M)) {
        if (M.over) { a.phase = 'celebrate'; a.t = 0; } else beginThink();
      }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.6) { a.games += 1; S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001..900050 stage a real moment instead of random play; 901001+ and
  // 902001+ show the Rules pages at 100 and 300 percent.
  function thinkAdviceNow(st) { const g = thinkAdvice(st); for (;;) { const r = g.next(); if (r.done) return r.value; } }
  function runPlan(st) { const g = planGen(st); for (;;) { const r = g.next(); if (r.done) return r.value; } }
  function stageShot(n) {
    const settle = (M, secs) => { for (let i = 0; i < secs * 60; i++) stepMatch(M, 1 / 60, rng); M.events.length = 0; M.parts.length = 0; };
    const mk = (level = 'skilled', side = 1, two = false) => { S.setup = { level: two ? 'two' : level, side }; startMatch({ level: two ? 'two' : level, side }, false); S.match.freeze = true; return S.match; };
    const pickPlace = (st, level, r) => { const g = placementSearch(st, level, r); for (;;) { const x = g.next(); if (x.done) return x.value.cell; } };
    // play `plies` engine moves silently (a fixed seed, so the staged position is the same every time)
    const ff = (M, plies, level = 'casual', seed = 7) => {
      const r = seeded(seed);
      for (let i = 0; i < plies && !M.over; i++) {
        const mv = M.st.phase === 'place' ? { from: -1, to: pickPlace(M.st, level, r) } : chooseMovement(M.st, level, r);
        playMove(M, mv, true);
      }
      M.anim = {}; M.ghosts = []; M.events.length = 0; M.last = M.st.last;
    };
    const canCap = (st, m) => applyMove(st, m).last.captured.length > 0;
    // advance quietly until `who` has a capturing slide available
    const toCapture = (M, who) => {
      for (let k = 0; k < 160 && !M.over; k++) {
        if (M.st.phase === 'move' && M.st.turn === who && M.st.chain < 0 && legalMoves(M.st).some((m) => canCap(M.st, m))) return legalMoves(M.st).find((m) => canCap(M.st, m));
        ff(M, 1, 'casual', 100 + k);
      }
      return null;
    };
    S.shot = true;
    setLang('en');
    S.stats = { 'skilled:1': [4, 1, 2], 'expert:1': [1, 0, 3], 'casual:2': [3, 0, 0] };
    ['corners', 'beside', 'first'].forEach((id) => { S.lessons[id] = true; });
    S.firstGame = false;
    if (n === 1) { const M = mk(); ff(M, 15, 'casual', 3); settle(M, 1); }
    else if (n === 2) { const M = mk(); ff(M, 21, 'casual', 5); settle(M, 1); }
    else if (n === 3) { const M = mk(); ff(M, 24, 'casual', 11); const mv = toCapture(M, 1); if (mv) M.sel = mv.from; settle(M, 1); }
    else if (n === 4) { const M = mk(); ff(M, 24, 'casual', 13); const mv = toCapture(M, 1); M.freeze = false; if (mv) playMove(M, mv); M.freeze = true; for (let i = 0; i < 0.52 * 60; i++) stepMatch(M, 1 / 60, rng); handleEvents(M); }
    else if (n === 5) { const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
    else if (n === 6) { S.thinkIdx = 0; startAuto(); const M = S.match; ff(M, 24, 'casual', 19); toCapture(M, 1); settle(M, 1); S.auto.plan = runPlan(M.st); S.auto.note = S.auto.plan.note; S.auto.phase = 'reveal'; S.auto.t = 1; }
    else if (n === 7) { startLesson(5); settle(S.match, 1); S.lessonOk = null; }
    else if (n === 8) { S.scene = 'setup'; S.setup = { level: 'expert', side: 2 }; }
    else if (n === 9) { S.scene = 'learn'; }
    else if (n === 10) { S.themeId = 'basalt'; const M = mk(); ff(M, 24, 'casual', 13); const mv = toCapture(M, 1); if (mv) M.sel = mv.from; settle(M, 1); }
    else if (n === 11) { S.themeId = 'oasis'; const M = mk(); ff(M, 16, 'casual', 3); settle(M, 1); }
    else if (n === 12) { S.themeId = 'basalt'; S.scene = 'title'; S.t = 0.5; }
    else if (n === 13) { S.themeId = 'oasis'; S.scene = 'title'; S.t = 0.5; }
    else if (n >= 14 && n <= 50) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 14) S.scene = 'title';
      else if (n === 15) S.scene = 'settings';
      else if (n === 16) S.scene = 'about';
      else if (n === 17) { const M = mk(); ff(M, 24, 'casual', 29); S.match.freeze = true; M.over = { winner: 1, why: 'stall' }; onEnd(M, { winner: 1, why: 'stall' }); S.overlay = 'end'; S.ovT = 1; }
      else if (n === 18) S.scene = 'learn';
      else if (n === 19) S.scene = 'setup';
      else if (n === 20) { const M = mk(); ff(M, 10, 'casual', 3); settle(M, 1); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 21) S.scene = 'demo-limit';
      else if (n === 22) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 23) { startAuto(); ff(S.match, 24, 'casual', 19); toCapture(S.match, 1); settle(S.match, 1); S.auto.plan = runPlan(S.match.st); S.auto.note = S.auto.plan.note; S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.paused = true; }
      else if (n === 24) { S.demo = true; S.textIdx = 0; S.scene = 'title'; }
      else if (n === 25) { const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (n === 26) { S.textIdx = 0; const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (n === 27) { startLesson(3); S.textIdx = 2; settle(S.match, 1); }
      else if (n === 28) { S.textIdx = 0; startLesson(6); settle(S.match, 1); S.lessonInfo = { ok: false, head: tr('notQuite'), body: tr('jUnsafe', { n: stonesObj(1) }).replace(/^(Not quite\.|ليس تمامًا\.)\s*/, '') }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (n === 29) { S.textIdx = 0; const M = mk(); ff(M, 13, 'casual', 3); settle(M, 1); }
      else if (n === 30) { S.textIdx = 2; const M = mk(); ff(M, 24, 'casual', 13); toCapture(M, 1); settle(M, 1); }
      else if (n === 31) { S.textIdx = 0; startLesson(5); settle(S.match, 1); }
      else if (n === 32) { S.textIdx = 1; const M = mk(); ff(M, 24, 'casual', 13); const mv = toCapture(M, 1); if (mv) M.sel = mv.from; settle(M, 1); }
      else if (n === 33) { S.textIdx = 0; const M = mk('skilled', 1, true); ff(M, 24, 'casual', 13); toCapture(M, 1); settle(M, 1); }
      else if (n === 34) { S.textIdx = 0; const M = mk('skilled', 2); settle(M, 0.1); }
      else if (n === 35) { S.textIdx = 0; S.setup = { level: 'skilled', side: 1 }; startMatch({ level: 'skilled', side: 1, start: lessonStart(LESSONS[5]) }, false); const M = S.match; M.freeze = true; playMove(M, { from: 2, to: 7 }, true); M.anim = {}; M.ghosts = []; M.events.length = 0; settle(M, 0.5); }
      else if (n === 36) { S.textIdx = 0; startMatch({ level: 'skilled', side: 1, start: lessonStart(LESSONS[8]) }, false); const M = S.match; M.freeze = true; playMove(M, { from: 22, to: 23 }); for (let i = 0; i < 40; i++) stepMatch(M, 1 / 60, rng); M.events.length = 0; M.parts.length = 0; }
      else if (n === 37) { S.textIdx = 0; const M = mk(); ff(M, 12, 'casual', 3); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (n === 40) { S.textIdx = 0; const M = mk('skilled', 1, true); ff(M, 5, 'casual', 3); settle(M, 1); }
      else if (n === 41) { S.textIdx = 4; startMatch({ level: 'skilled', side: 1, start: lessonStart(LESSONS[5]) }, false); const M = S.match; M.freeze = true; playMove(M, { from: 2, to: 7 }, true); M.anim = {}; M.ghosts = []; M.events.length = 0; settle(M, 0.5); }
      else if (n === 49) { S.textIdx = 0; S.scene = 'title'; S.t = 6.2; }
      else if (n === 50) { S.textIdx = 0; startLesson(1); settle(S.match, 1); }
      else if (n >= 42 && n <= 48) { S.textIdx = 0; S.scene = 'howto'; S.page.howto = n - 42; }
      else if (n === 38) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 39) { S.textIdx = 0; S.scene = 'about'; }
    } else if (n >= 51 && n <= 80) { // Arabic: review and store shots
      setLang('ar');
      const k = n - 50;
      if (k === 1) S.scene = 'title';
      else if (k === 2) { S.scene = 'setup'; S.setup = { level: 'expert', side: 2 }; }
      else if (k === 3) { const M = mk(); ff(M, 24, 'casual', 11); const mv = toCapture(M, 1); if (mv) M.sel = mv.from; settle(M, 1); }
      else if (k === 4) { const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (k === 5) { S.thinkIdx = 0; startAuto(); const M = S.match; ff(M, 24, 'casual', 19); toCapture(M, 1); settle(M, 1); S.auto.plan = runPlan(M.st); S.auto.note = S.auto.plan.note; S.auto.phase = 'reveal'; S.auto.t = 1; }
      else if (k === 6) { S.scene = 'learn'; }
      else if (k === 7) { S.scene = 'settings'; }
      else if (k === 8) { S.scene = 'about'; }
      else if (k === 9) { S.scene = 'howto'; S.page.howto = 3; }
      else if (k === 10) { startLesson(6); settle(S.match, 1); S.lessonInfo = { ok: false, head: tr('notQuite'), body: tr('jUnsafe', { n: stonesObj(1) }).replace(/^(Not quite\.|ليس تمامًا\.)\s*/, '') }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (k === 11) { const M = mk(); ff(M, 24, 'casual', 29); M.over = { winner: 1, why: 'captured' }; onEnd(M, { winner: 1, why: 'captured' }); S.overlay = 'end'; S.ovT = 1; }
      else if (k === 12) { const M = mk(); ff(M, 15, 'casual', 3); settle(M, 1); }
      else if (k === 13) { startMatch({ level: 'skilled', side: 1, start: lessonStart(LESSONS[5]) }, false); const M = S.match; M.freeze = true; playMove(M, { from: 2, to: 7 }, true); M.anim = {}; M.ghosts = []; M.events.length = 0; settle(M, 0.5); }
      else if (k === 14) { S.textIdx = 4; S.scene = 'title'; }
      else if (k === 15) { S.textIdx = 4; const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (k === 16) { S.textIdx = 4; S.scene = 'settings'; }
      else if (k === 17) { S.textIdx = 4; S.scene = 'setup'; }
      else if (k === 18) { const M = mk(); ff(M, 10, 'casual', 3); settle(M, 1); S.overlay = 'pause'; S.ovT = 1; }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; }
    else if (n >= 3001 && n <= 3030) { setLang('ar'); S.scene = 'rules'; S.page.rules = n - 3001; }
    else if (n >= 4001 && n <= 4030) { setLang('ar'); S.scene = 'rules'; S.page.rules = n - 4001; S.textIdx = 4; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900080) || (sd >= 901001 && sd <= 901030) || (sd >= 902001 && sd <= 902030) || (sd >= 903001 && sd <= 903030) || (sd >= 904001 && sd <= 904030)) ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {}; S.ghost = -1;
    if (scene === 'howto') S.page.howto = 0;
    if (scene === 'rules') S.page.rules = 0;
    S.scroll[scene] = 0;
    SOUNDS.ui();
  }
  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }
  function leaveToMenu() { saveGame(); S.match = null; S.auto = null; S.ghost = -1; gotoScene('title'); }

  function doThink() {
    const M = S.match;
    if (!M || M.over || !humanTurn(M) || M.hintTask || M.lesson) return;
    const st = M.st;
    M.hint = null; M.sel = -1;
    M.hintTask = { gen: thinkAdvice(st), done: (adv) => { if (S.match === M && M.st === st) { M.hint = adv; SOUNDS.hint(); } } };
  }
  function doRestart() {
    const M = S.match;
    if (!M || M.auto) return;
    if (M.lesson) { startLesson(S.lessonIdx); return; }
    startMatch(S.lastOpts ?? { level: M.two ? 'two' : M.level, side: M.human }, S.demo);
  }
  function doEndTurn() {
    const M = S.match;
    if (chainOpen(M) && S.scene === 'play' && !S.overlay) tapCell(M, M.st.chain);
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lv:')) { const l = id.slice(3); if (demoLevelLocked(S, l)) return; S.setup.level = l; saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('side:')) { S.setup.side = Number(id.slice(5)); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('lang:')) { setLang(id.slice(5)); S.scroll = {}; saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('theme:')) { S.themeId = id.slice(6); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('les:')) { SOUNDS.ui(); startLesson(Number(id.slice(4))); return; }
    switch (id) {
      case 'play': gotoScene('setup'); return;
      case 'continue': continueGame(); return;
      case 'start': saveSettings(); startMatch({ ...S.setup }); return;
      case 'learn': gotoScene('learn'); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': case 'menu': gotoScene('title'); return;
      case 'prev': S.page[S.scene] = Math.max(0, S.page[S.scene] - 1); S.scroll = {}; SOUNDS.ui(); return;
      case 'next': {
        const total = S.scene === 'rules' ? RULE_COUNT : HOWTO_COUNT;
        if (S.scene === 'howto' && S.page.howto >= total - 1) { activate('play'); return; }
        S.page[S.scene] = Math.min(total - 1, S.page[S.scene] + 1); S.scroll = {}; SOUNDS.ui(); return;
      }
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.stats = {}; S.lessons = {}; S.save = null; S.firstGame = true; S.progress = { games: 0, wins: 0 };
        saveStats(); saveLessons(); storage.set('sg.save', null); storage.set('sg.progress', S.progress); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:restart': S.overlay = null; doRestart(); return;
      case 'ov:menu': S.overlay = null; leaveToMenu(); return;
      case 'ov:again': S.overlay = null; startMatch(S.lastOpts ?? { ...S.setup }); return;
      case 'ov:setup': S.overlay = null; S.match = null; gotoScene('setup'); return;
      case 'ov:lessons': S.overlay = null; S.match = null; gotoScene('learn'); return;
      case 'ov:lessonretry': S.overlay = null; return;
      case 'ov:lessonagain': S.overlay = null; startLesson(S.lessonIdx); return;
      case 'ov:lessonnext': { S.overlay = null; const n = S.lessonIdx + 1; if (n >= LESSONS.length) { S.match = null; gotoScene('learn'); } else startLesson(n); return; }
      case 'ov:autoagain': S.overlay = null; startAuto(); return;
      case 'ov:autoexit': S.overlay = null; S.auto = null; S.match = null; gotoScene('title'); return;
      default:
    }
  }

  // ------------------------------------------------------------------------------ pointer handling
  function fixedHit(ui, x, y) {
    const list = [...ui.fixed];
    if (ui.nav) list.push(ui.nav.prev, ui.nav.next);
    for (const f of list) if (f.id != null && !f.disabled && inRect(x, y, f.rect)) return f;
    return null;
  }

  function onDown(x, y) {
    S.toast = null;
    if (S.scene === 'play' && !S.overlay && S.match) { playDown(x, y); return; }
    if (S.scene === 'auto' && !S.overlay) { autoDown(x, y); return; }
    const ui = buildUi(S);
    if (!ui.layout) return;
    if (S.scene === 'title') { const hz = lockHit(); if (inRect(x, y, hz)) { S.press = { id: 'lock', active: true, kind: 'lock', rect: hz }; return; } }
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
    if (pr.kind === 'cell') {
      const c = S.match ? cellAt(x, y) : -1;
      pr.active = c === pr.id;
      if (pr.active) setGhost(pr.id); else S.ghost = -1;
      return;
    }
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

  function onUp(x, y) {
    const pr = S.press;
    S.press = null;
    S.ghost = -1;
    if (!pr) return;
    if (pr.kind === 'cell') {
      if (S.scene === 'play' && S.match && !S.overlay && cellAt(x, y) === pr.id) { S.kbd = false; S.match.cur = pr.id; tapCell(S.match, pr.id); }
      return;
    }
    if (pr.kind === 'lock') { if (inRect(x, y, pr.rect)) env.openArcforgeHome?.(); return; }
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) return;
      if (pr.scrolling) { S.scrollVel[ui.scrollKey] = pr.vel; return; }
      const hit = hitDoc(ui.layout, x - ui.region.x, y - ui.region.y - (ui.offY || 0) + getScroll(ui));
      if (hit && hit.id === pr.id && !hit.disabled) activate(hit.id);
    } else if (pr.kind === 'fixed') { if (inRect(x, y, pr.rect)) activate(pr.id); }
    else if (pr.kind === 'hud') { if (inRect(x, y, pr.rect)) hudAction(pr.id); }
    else if (pr.kind === 'auto') { if (inRect(x, y, pr.rect)) autoAction(pr.id); }
    else if (pr.kind === 'tool') { if (inRect(x, y, pr.rect)) toolAction(pr.id.slice(5)); }
  }

  function setGhost(i) {
    const M = S.match;
    if (!M || !humanTurn(M) || M.over) { S.ghost = -1; return; }
    if (isPlacing(M.st) && M.st.cells[i] === 0 && i !== CENTRE) { S.ghost = i; S.ghostWho = M.st.turn; } else S.ghost = -1;
  }

  // ---- play
  function playDown(x, y) {
    const M = S.match;
    const l = lay(chainOpen(M));
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: BACK_BTN }; return; }
    if (inRect(x, y, PAUSE_BTN)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: PAUSE_BTN }; return; }
    if (l.endBtn && inRect(x, y, l.endBtn)) { S.press = { id: 'hud:end', active: true, kind: 'hud', rect: l.endBtn }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      if (inRect(x, y, l.tool[i])) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: l.tool[i] }; return; }
    }
    const c = cellAt(x, y);
    if (c >= 0) { S.press = { id: c, active: true, kind: 'cell' }; setGhost(c); }
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; S.ghost = -1; }
    else if (id === 'hud:end') doEndTurn();
  }
  function toolAction(id) {
    const M = S.match;
    if (!M) return;
    if (id === 'undo') { if (S.canUndo) undoMatch(M); else toast(tr('tUndo')); }
    else if (id === 'think') doThink();
    else if (id === 'restart') doRestart();
  }

  // ---- auto
  function autoDown(x, y) {
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: BACK_BTN }; return; }
    const l = autoLayout(TEXT_SCALES[S.textIdx]);
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, l[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: l[id] }; return; }
    }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.match = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
  }

  // ---- keyboard
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match) {
      const M = S.match;
      const mv = (dr, dc) => { S.kbd = true; const r = Math.floor(M.cur / N), c = M.cur % N; M.cur = Math.max(0, Math.min(N - 1, r + dr)) * N + Math.max(0, Math.min(N - 1, c + dc)); };
      if (has('ArrowLeft')) mv(0, -1);
      if (has('ArrowRight')) mv(0, 1);
      if (has('ArrowUp')) mv(-1, 0);
      if (has('ArrowDown')) mv(1, 0);
      if (has('Enter') || has('Space')) { S.kbd = true; tapCell(M, M.cur); }
      if (has('KeyU')) toolAction('undo');
      if (has('KeyT')) toolAction('think');
      if (has('KeyR')) toolAction('restart');
      if (has('KeyE')) doEndTurn();
      if (has('Escape') || has('KeyP')) { S.overlay = 'pause'; S.ovT = 0; S.ghost = -1; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('KeyP'))) { S.overlay = null; return; }
    if (S.scene === 'auto' && S.auto) {
      if (has('Space') || has('KeyP')) S.auto.paused = !S.auto.paused;
      if (has('Escape') && !S.overlay) autoAction('auto:exit');
      return;
    }
    const ui = buildUi(S);
    if (ui.layout && ui.region) {
      if (keys.down.has('ArrowDown') || keys.down.has('PageDown')) setScroll(ui, getScroll(ui) + 18);
      if (keys.down.has('ArrowUp') || keys.down.has('PageUp')) setScroll(ui, getScroll(ui) - 18);
      if (has('Home')) setScroll(ui, 0);
      if (has('End')) setScroll(ui, 1e9);
    }
    if (has('Escape') && ['setup', 'learn', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) gotoScene('title');
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      setSize(meta.width, meta.height);
      if (wheelInput.dy) {
        const ui = buildUi(S);
        if (ui.layout && ui.region) setScroll(ui, getScroll(ui) + wheelInput.dy);
        wheelInput.dy = 0;
      }
      // Watch & Learn's Pause (and the in-game pause card) freezes the whole loop: timers, search, animations, particles, the ambient clock.
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0 && !frozen) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && S.press.kind === 'cell' && !ptr.down && !ptr.pressed && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded): let go where the finger last was.
        const p = S.press; S.press = null; S.ghost = -1;
        if (S.match && S.scene === 'play' && !S.overlay && cellAt(S.lastPtr.x, S.lastPtr.y) === p.id) tapCell(S.match, p.id);
      }
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }

      const M = S.match;
      if (M) {
        if (S.scene === 'play') {
          if (S.overlay !== 'pause') stepMatch(M, dt, rng);
          S.canUndo = canUndo(M);
        } else if (S.scene === 'auto' && !frozen) { stepMatch(M, dt, rng); updateAuto(dt); }
        if (S.scene === 'play' || S.scene === 'auto') {
          handleEvents(M);
          if (!frozen) stepWinSeq(dt);
        }
        // Lessons: the right move shows its explanation once the stone has landed (when the turn ends).
        const L = M.lesson;
        if (S.scene === 'play' && !S.overlay && L && S.lessonOk && !S.shot) {
          const turnDone = M.st.turn !== M.human || M.over || L.finish === 'accept';
          if (turnDone && settled(M)) {
            S.lessonWait += dt;
            if (S.lessonWait > 0.7) {
              S.lessons[L.id] = true; saveLessons();
              S.lessonInfo = { ok: true, head: tr('correct'), body: S.lessonOk.text };
              S.overlay = 'lesson'; S.ovT = 0; S.lessonOk = null;
              SOUNDS.hint();
            }
          }
        }
        if (S.scene === 'play' && M.over && !S.overlay && !L && M.overT > 1.6 && settled(M) && !S.shot) { S.overlay = 'end'; S.ovT = 0; }
      }
    },

    render(ctx) {
      setSize(meta.width, meta.height);
      render(ctx, S, buildUi(S));
    },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, lang: getLang(), textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, setup: S.setup,
        stats: S.stats, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoGames: S.demoGames,
        auto: S.auto ? { phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          level: M.level, human: M.human, two: M.two, cells: M.st.cells.join(''), turn: M.st.turn, phase: M.st.phase, drops: M.st.drops, chain: M.st.chain, quiet: M.st.quiet,
          moves: M.hist.length, sel: M.sel, over: M.over ? [M.over.winner, M.over.why] : null, hint: M.hint ? [M.hint.mv.from, M.hint.mv.to] : null, anim: Object.keys(M.anim).length, ghosts: M.ghosts.length, ai: [Math.round(M.aiT * 100) / 100, Boolean(M.task), M.thinking, Boolean(M.hintTask)],
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, setup, Learn, Rules / How to Play / About, Settings, every overlay (pause, result,
    // lesson, Watch & Learn summary), the demo card, the lessons and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && S.match.lesson),
  };
}
