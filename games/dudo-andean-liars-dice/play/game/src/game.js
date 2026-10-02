// GAME CONTRACT (docs/GAME-CONTRACT.md). Dudo: Andean bluff dice. Real Dudo rules, five computer levels, pass-and-play, Think with exact odds.
import { SCREEN, inRect, BACK_BTN, PAUSE_BTN, autoLayout, playLayout } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoOver, recKey, specsFromSetup, AUTO_SPECS, MAX_PLAYERS } from './screens.js';
import { LEVELS, decide } from './ai.js';
import { LESSONS } from './lessons.js';
import { setLang, tr, HOWTO_COUNT, RULE_COUNT } from './content.js';
import { THEMES } from './art.js';
import { describeMove } from './explain.js';
import {
  createMatch, snapshot, stepMatch, spawn, humanBid, humanCall, think, ackHandoff, nextRoundStart, resumeTurn, applyDecision, selFace, selQty,
  seatOrder, bottomSeat, skipToTurn, doBid, doCall, isHumanTurn,
} from './match.js';
import { render } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const VERSION = '1.0.0';
const WIN_NOTES = [523, 659, 784, 1047, 1319];
const isDigit = /^(Digit|Numpad)([1-6])$/;

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'aguayo', textIdx: 0, thinkIdx: 1, lang: 'en',
    setup: { humans: 1, cpus: 3, level: 2 }, stats: {}, lessons: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, lq: { i: 0, q: 0, picked: -1 }, endInfo: null,
    toast: null, toastT: 0, winSeq: null, demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: VERSION,
    shot: false, lastPtr: { x: 0, y: 0 }, firstGame: true, ended: false, lastSpecs: null,
  };

  const [set, stats, les, save, dg, prog] = await Promise.all([storage.get('dudo.settings', null), storage.get('dudo.stats', null), storage.get('dudo.lessons', null), storage.get('dudo.save', null), storage.get('dudo.demo', 0), storage.get('dudo.progress', null)]);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (set.lang === 'es') S.lang = 'es';
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
    if (set.setup && Number.isInteger(set.setup.humans) && Number.isInteger(set.setup.cpus)) {
      const lv = set.setup.level === 'mixed' || LEVELS.some((l) => l.n === set.setup.level) ? set.setup.level : 2;
      S.setup = { humans: Math.min(4, Math.max(1, set.setup.humans)), cpus: Math.min(5, Math.max(0, set.setup.cpus)), level: lv };
      fixSetup();
    }
  }
  if (stats && typeof stats === 'object') S.stats = stats;
  if (les && typeof les === 'object') S.lessons = les;
  if (save && Array.isArray(save.specs) && save.snap && Array.isArray(save.snap.players) && save.snap.players.length === save.specs.length) S.save = save;
  if (Number.isInteger(dg)) S.demoGames = dg;
  if (prog && Number.isInteger(prog.wins) && Number.isInteger(prog.games)) S.progress = { games: prog.games, wins: prog.wins };
  S.firstGame = !Object.keys(S.stats).length && !Object.keys(S.lessons).length;
  setLang(S.lang);
  audio.setMuted(!S.sound);
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  function fixSetup() {
    const s = S.setup;
    s.cpus = Math.min(s.cpus, MAX_PLAYERS - s.humans);
    if (s.humans === 1 && s.cpus < 1) s.cpus = 1;
  }
  const saveSettings = () => storage.set('dudo.settings', { sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, lang: S.lang, setup: S.setup });
  const saveStats = () => storage.set('dudo.stats', S.stats);
  const saveLessons = () => storage.set('dudo.lessons', S.lessons);
  const saveGame = () => {
    const M = S.match;
    if (S.shot || S.scene !== 'play' || !M || M.auto) return;
    if (M.over || humansAlive(M) === 0) { if (S.save) clearSave(); return; }
    S.save = { specs: M.specs, snap: snapshot(M), levelKey: M.levelKey };
    storage.set('dudo.save', S.save);
  };
  const clearSave = () => { S.save = null; storage.set('dudo.save', null); };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    rattle: (i) => { sfx({ freq: 1400 + (i % 5) * 170, dur: 0.03, type: 'square', vol: 0.025 }); sfx({ freq: 190 + (i % 3) * 30, to: 120, dur: 0.05, type: 'triangle', vol: 0.05 }); },
    land: (i) => { sfx({ freq: 260 - i * 14, to: 120, dur: 0.08, type: 'triangle', vol: 0.15 }); sfx({ freq: 1800 + i * 60, dur: 0.02, type: 'square', vol: 0.03 }); },
    bid: () => { sfx({ freq: 420, to: 300, dur: 0.1, type: 'triangle', vol: 0.12 }); sfx({ freq: 900, dur: 0.04, type: 'square', vol: 0.03 }); },
    dudo: () => { sfx({ freq: 150, to: 70, dur: 0.35, type: 'sawtooth', vol: 0.12 }); sfx({ freq: 98, dur: 0.4, type: 'triangle', vol: 0.15 }); },
    calzo: () => { sfx({ freq: 880, dur: 0.4, type: 'sine', vol: 0.1 }); sfx({ freq: 1320, dur: 0.5, type: 'sine', vol: 0.06 }); },
    flip: () => sfx({ freq: 520, to: 700, dur: 0.07, type: 'sine', vol: 0.09 }),
    select: () => sfx({ freq: 620, to: 760, dur: 0.05, type: 'sine', vol: 0.07 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.07 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    lose: () => { [392, 330, 262].forEach((f, i) => sfx({ freq: f, to: f * 0.96, dur: 0.35, type: 'sine', vol: 0.09 - i * 0.01 })); },
    gain: () => { [392, 523, 659].forEach((f) => sfx({ freq: f, dur: 0.25, type: 'sine', vol: 0.09 })); },
    handoff: () => { sfx({ freq: 330, dur: 0.15, type: 'sine', vol: 0.1 }); sfx({ freq: 440, dur: 0.2, type: 'sine', vol: 0.08 }); },
  };

  // ------------------------------------------------------------------------------ geometry helpers
  const layNow = (M) => playLayout(TEXT_SCALES[S.textIdx], seatOrder(M).length);
  function seatPos(M, seat) {
    const lay = layNow(M);
    if (seat === bottomSeat(M)) return [lay.dice.x + lay.dice.w / 2, lay.dice.y + lay.dice.h / 2];
    const i = seatOrder(M).indexOf(seat);
    const r = lay.seats[Math.max(0, i)];
    return [r.x + r.w / 2, r.y + r.h / 2];
  }

  // ------------------------------------------------------------------------------ matches
  function launch(M, auto) {
    S.match = M; S.scene = auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.endInfo = null; S.winSeq = null; S.toast = null; S.ended = false;
  }
  function startMatch(setup, count = true) {
    if (count && demoOver(S)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    const specs = specsFromSetup(setup, S.lang);
    const M = createMatch({ specs }, rng);
    M.specs = specs; M.setupCopy = { ...setup };
    M.levelKey = setup.humans === 1 && setup.cpus > 0 ? (setup.level === 'mixed' ? 'mixed' : String(setup.level)) : '';
    if (count && S.demo) { S.demoGames += 1; storage.set('dudo.demo', S.demoGames); }
    launch(M, false);
    S.lastSetup = { ...setup };
    clearSave();
    saveGame();
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = createMatch({ specs: sv.specs, resume: sv.snap }, rng);
    M.specs = sv.specs; M.levelKey = sv.levelKey ?? '';
    launch(M, false);
    S.overlay = 'pause'; S.ovT = 0; // resume starts paused
  }

  function humansAlive(M) { return M.st.players.filter((p) => p.kind === 'human' && p.dice > 0).length; }
  function onEnd(M) {
    if (M.ended) return;
    M.ended = true;
    const st = M.st, specsHuman = M.humans.length;
    const winner = M.over && M.over.winner >= 0 ? st.players[M.over.winner] : null;
    const youWon = specsHuman === 1 && winner && winner.kind === 'human';
    let head, body;
    if (M.auto) { head = tr('autoSession'); body = ''; }
    else if (winner) { head = specsHuman === 1 ? (youWon ? tr('youWin') : tr('winsMatch', { name: winner.name })) : tr('winsMatch', { name: winner.name }); body = tr('matchOverBody'); }
    else { head = tr('youOut'); body = ''; }
    let rec = '';
    if (!M.auto && specsHuman === 1 && M.levelKey) {
      const r = S.stats[recKey(M.levelKey)] ?? [0, 0];
      r[youWon ? 0 : 1] += 1; S.stats[recKey(M.levelKey)] = r; saveStats();
      S.progress.games += 1; if (youWon) S.progress.wins += 1; storage.set('dudo.progress', S.progress);
      rec = `${tr('record')}: ${r[0]} ${tr('wins')}, ${r[1]} ${tr('losses')}`;
      S.firstGame = false;
    }
    clearSave();
    S.endInfo = { head, body, rec, win: Boolean(youWon || (winner && specsHuman > 1)) };
    if (S.endInfo.win) { S.winSeq = { t: 0, i: 0 }; const [x, y] = seatPos(M, winner.id); for (let i = 0; i < 2; i++) spawn(M, rng, x, y, 'win'); } else SOUNDS.lose();
  }

  function handleEvents(M) {
    for (const e of M.events) {
      if (e.type === 'shake') { for (let i = 0; i < 9; i++) SOUNDS.rattle(i); }
      else if (e.type === 'land') { SOUNDS.land(e.i); const [x, y] = seatPos(M, bottomSeat(M)); spawn(M, rng, x - 120 + e.i * 60, y + 20, 'thud'); }
      else if (e.type === 'bid') SOUNDS.bid();
      else if (e.type === 'call') { if (e.kind === 'dudo') SOUNDS.dudo(); else SOUNDS.calzo(); M.shake = 0.3; }
      else if (e.type === 'flip') SOUNDS.flip();
      else if (e.type === 'refuse') SOUNDS.refuse();
      else if (e.type === 'hint') SOUNDS.hint();
      else if (e.type === 'handoff') SOUNDS.handoff();
      else if (e.type === 'verdict') {
        const r = M.snap.res;
        const lay = layNow(M), cx = lay.table.x + lay.table.w / 2, cy = lay.table.y + lay.table.h * 0.45;
        if (r.loser >= 0) { SOUNDS.lose(); spawn(M, rng, cx, cy, 'lose'); } else if (r.gainer >= 0) { SOUNDS.gain(); spawn(M, rng, cx, cy, 'gain'); }
      } else if (e.type === 'result') {
        if (!M.over && !M.auto && humansAlive(M) === 0) M.over = { winner: -1 };
      } else if (e.type === 'save') saveGame();
    }
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
    const M = createMatch({ specs: AUTO_SPECS, auto: true }, rng);
    M.specs = AUTO_SPECS;
    S.match = M; S.winSeq = null; S.endInfo = null; M.ended = false;
    Object.assign(S.auto, { phase: 'idle', t: 0, plan: null, note: { head: '', why: '' }, rt: 0 });
  }
  function startAuto() {
    S.auto = { phase: 'idle', t: 0, paused: false, plan: null, note: { head: '', why: '' }, rt: 0 };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoGame();
  }
  // THINK (configurable) -> REVEAL (2 s: the choice is explained) -> ACT (the bid or call), all with every cup open.
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    if (M.phase === 'result') {
      a.rt += dt;
      if (a.rt >= 3.6) { a.rt = 0; if (M.over) { if (!M.ended) { M.ended = true; S.overlay = 'autosum'; S.ovT = 0; } } else { a.phase = 'idle'; nextRoundStart(M); } }
      return;
    }
    a.rt = 0;
    if (M.phase !== 'autowait') { if (a.phase !== 'act') a.phase = 'idle'; return; }
    a.t += dt;
    if (a.phase === 'idle' || a.phase === 'act') {
      a.phase = 'think'; a.t = 0;
      const st = M.st;
      a.plan = decide(st, st.turn, rng);
      a.note = describeMove(st, st.turn, a.plan);
      a.note = { head: `${st.players[st.turn].name}: ${a.note.head}`, why: a.note.why };
      M.autoPlan = a.plan;
    } else if (a.phase === 'think') {
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) { a.phase = 'act'; a.t = 0; applyDecision(M, a.plan, rng); M.autoPlan = null; }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001..900060 stage a real moment of play; 901001+ and 902001+ show the Rules pages at 100 and 300 percent.
  function settle(M, secs) { for (let i = 0; i < secs * 60; i++) stepMatch(M, 1 / 60, rng); M.events.length = 0; M.parts.length = 0; }
  function stageShot(n) {
    S.shot = true;
    S.stats = { '2': [4, 2], '3': [1, 3] }; S.lessons = { pacos: true, legal: true };
    S.firstGame = false;
    const mk = (setup, hands, bids, o = {}) => {
      S.setup = { ...setup };
      startMatch(setup, false);
      const M = S.match;
      skipToTurn(M); M.t = 0; M.rollT = 99;
      hands.forEach((h, i) => { if (h) { M.st.players[i].hand = h; M.st.players[i].dice = h.length; } });
      M.st.turn = o.opener ?? 0; M.st.opener = M.st.turn; M.st.palifico = Boolean(o.pal);
      for (const [who, q, f] of bids) { M.st.turn = who; doBid(M, q, f); M.gapT = 1; M.bidT = 99; }
      M.events.length = 0; M.phase = 'idle'; M.cpuT = 0;
      M.st.turn = o.turn ?? 0;
      M.phase = 'gap'; M.gapT = 1; stepMatch(M, 1 / 60, rng); M.freeze = true; M.events.length = 0; M.bidT = 99; M.shot = true;
      return M;
    };
    if (n === 1) { mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 5, 5]], { opener: 0, turn: 0 }); }
    else if (n === 2) { const M = mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 6, 5]], { opener: 0, turn: 0 }); think(M); M.events.length = 0; }
    else if (n === 3) { const M = mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 6, 5]], { opener: 0, turn: 0 }); M.freeze = false; doCall(M, 'dudo', rng); settle(M, 1.2 + 4 * 0.5 + 0.9); }
    else if (n === 4) { startAuto(); S.thinkIdx = 0; const M = S.match; skipToTurn(M); M.st.players.forEach((p, i) => { p.hand = [[2, 4, 4, 1, 6], [5, 5, 3, 1, 2], [6, 3, 4, 4, 1]][i]; }); M.st.turn = 0; doBid(M, 4, 4); M.gapT = 1; settle(M, 0.8); M.freeze = true; S.auto.phase = 'reveal'; S.auto.t = 1; const st = M.st; S.auto.plan = decide(st, st.turn, rng); S.auto.note = { head: `${st.players[st.turn].name}: ${describeMove(st, st.turn, S.auto.plan).head}`, why: describeMove(st, st.turn, S.auto.plan).why }; M.phase = 'autowait'; }
    else if (n === 5) { const M = mk({ humans: 1, cpus: 2, level: 2 }, [[3], [4, 2, 6, 6], [5, 5, 1, 2]], [[0, 2, 3]], { opener: 0, pal: true, turn: 1 }); M.st.players[0].palUsed = true; M.phase = 'human'; M.st.turn = 0; M.st.bids = []; M.st.palifico = true; M.st.turn = 0; M.sel = { q: 1, f: 3 }; }
    else if (n === 6) { S.scene = 'setup'; S.setup = { humans: 1, cpus: 4, level: 'mixed' }; }
    else if (n === 7) { S.scene = 'lesson'; S.lq = { i: 3, q: 1, picked: -1 }; }
    else if (n === 8) { S.themeId = 'altiplano'; mk({ humans: 1, cpus: 5, level: 'mixed' }, [[2, 3, 3, 5, 1], [4, 4], [6, 5, 5, 3], [1, 1, 2, 6, 5], [3, 4, 6], [5, 5, 5, 6, 6]], [[0, 4, 3], [1, 4, 5], [2, 6, 3], [3, 7, 3]], { opener: 0, turn: 4 }); S.match.phase = 'cpu'; }
    else if (n === 9) { S.themeId = 'titicaca'; mk({ humans: 2, cpus: 1, level: 3 }, [[3, 1, 5, 5, 2], [4, 6, 6], [2, 2, 3, 5, 5]], [[0, 3, 5]], { opener: 0, turn: 1 }); S.match.phase = 'handoff'; S.match.ack = false; }
    else if (n === 10) { S.themeId = 'titicaca'; S.scene = 'title'; S.t = 2.2; }
    else if (n === 11) { S.themeId = 'altiplano'; S.scene = 'title'; S.t = 3; }
    else if (n === 12) { S.scene = 'title'; S.t = 2.4; }
    else if (n === 13) { S.lang = 'es'; setLang('es'); mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 5, 5]], { opener: 0, turn: 0 }); }
    else if (n === 14) { S.lang = 'es'; setLang('es'); S.scene = 'title'; S.t = 2.4; }
    else if (n >= 20 && n <= 60) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 20) S.scene = 'title';
      else if (n === 21) S.scene = 'settings';
      else if (n === 22) S.scene = 'about';
      else if (n === 23) { const M = mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 5, 5]], { opener: 0, turn: 0 }); M.freeze = true; }
      else if (n === 24) { S.scene = 'learn'; }
      else if (n === 25) { S.scene = 'setup'; S.setup = { humans: 2, cpus: 4, level: 'mixed' }; }
      else if (n === 26) { mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 5, 5]], { opener: 0, turn: 0 }); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 27) { mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 5, 5]], { opener: 0, turn: 0 }); S.endInfo = { head: tr('youWin'), body: tr('matchOverBody'), rec: `${tr('record')}: 5 ${tr('wins')}, 2 ${tr('losses')}`, win: true }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 28) S.scene = 'demo-limit';
      else if (n === 29) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 30) { const M = mk({ humans: 1, cpus: 5, level: 'mixed' }, [[2, 3, 3, 5, 1], [4, 4], [6, 5, 5, 3], [1, 1, 2, 6, 5], [3, 4, 6], [5, 5, 5, 6, 6]], [[0, 4, 3], [1, 4, 5], [2, 6, 3], [3, 7, 3]], { opener: 0, turn: 0 }); M.freeze = true; }
      else if (n === 31) { const M = mk({ humans: 1, cpus: 5, level: 'mixed' }, [[2, 3, 3, 5, 1], [4, 4], [6, 5, 5, 3], [1, 1, 2, 6, 5], [3, 4, 6], [5, 5, 5, 6, 6]], [[0, 4, 3], [1, 4, 5], [2, 6, 3], [3, 7, 3]], { opener: 0, turn: 0 }); M.freeze = false; doCall(M, 'dudo', rng); settle(M, 1.2 + 6 * 0.5 + 0.9); }
      else if (n === 32) { const M = mk({ humans: 1, cpus: 3, level: 3 }, [[4, 1, 6, 4, 2], [3, 3, 5, 2, 6], [1, 5, 5, 2, 4], [6, 6, 3, 1, 4]], [[0, 3, 4], [1, 3, 5], [2, 4, 5], [3, 6, 5]], { opener: 0, turn: 0 }); think(M); M.events.length = 0; }
      else if (n === 33) { S.scene = 'lesson'; S.lq = { i: 1, q: 1, picked: 0 }; }
      else if (n === 34) { S.scene = 'rules'; S.page.rules = 4; }
      else if (n === 35) { startAuto(); S.thinkIdx = 0; const M = S.match; skipToTurn(M); M.st.players.forEach((p, i) => { p.hand = [[2, 4, 4, 1, 6], [5, 5, 3, 1, 2], [6, 3, 4, 4, 1]][i]; }); M.st.turn = 0; doBid(M, 4, 4); M.gapT = 1; settle(M, 0.8); M.freeze = true; S.auto.phase = 'reveal'; S.auto.t = 1; const st = M.st; S.auto.plan = decide(st, st.turn, rng); S.auto.note = { head: `${st.players[st.turn].name}: ${describeMove(st, st.turn, S.auto.plan).head}`, why: describeMove(st, st.turn, S.auto.plan).why }; M.phase = 'autowait'; S.auto.paused = true; }
      else if (n === 36) { mk({ humans: 2, cpus: 1, level: 3 }, [[3, 1, 5, 5, 2], [4, 6, 6], [2, 2, 3, 5, 5]], [[0, 3, 5]], { opener: 0, turn: 1 }); S.match.phase = 'handoff'; S.match.ack = false; }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900060) || (sd >= 901001 && sd <= 901030) || (sd >= 902001 && sd <= 902030)) ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {};
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
  function leaveToMenu() { saveGame(); S.match = null; S.auto = null; gotoScene('title'); }
  const toast = (msg) => { S.toast = msg; S.toastT = 2.4; };

  function startLesson(i) {
    if (!LESSONS[i] || (S.demo && i >= 3)) { S.scene = 'demo-limit'; return; }
    S.lq = { i, q: 0, picked: -1 }; S.scene = 'lesson'; S.scroll = {}; SOUNDS.ui();
  }
  function setPlayers(key, v) {
    const s = S.setup;
    if (key === 'hum') s.humans = v; else s.cpus = v;
    fixSetup(); saveSettings(); SOUNDS.ui();
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('hum:')) { setPlayers('hum', Number(id.slice(4))); return; }
    if (id.startsWith('cpu:')) { setPlayers('cpu', Number(id.slice(4))); return; }
    if (id.startsWith('lv:')) { const v = id.slice(3); S.setup.level = v === 'mixed' ? 'mixed' : Number(v); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('theme:')) { S.themeId = id.slice(6); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('lang:')) { S.lang = id.slice(5) === 'es' ? 'es' : 'en'; setLang(S.lang); saveSettings(); S.scroll = {}; SOUNDS.ui(); return; }
    if (id.startsWith('les:')) { startLesson(Number(id.slice(4))); return; }
    if (id.startsWith('ans:')) {
      const L = LESSONS[S.lq.i], q = L.qs[S.lq.q];
      if (S.lq.picked >= 0) return;
      S.lq.picked = Number(id.slice(4)); S.scroll = {};
      if (S.lq.picked === q.ans) SOUNDS.hint(); else SOUNDS.refuse();
      return;
    }
    switch (id) {
      case 'play': gotoScene('setup'); return;
      case 'continue': continueGame(); return;
      case 'start': saveSettings(); startMatch({ ...S.setup }); return;
      case 'learn': gotoScene('learn'); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': if (S.scene === 'lesson') gotoScene('learn'); else gotoScene('title'); return;
      case 'menu': gotoScene('title'); return;
      case 'lq:next': S.lq = { ...S.lq, q: S.lq.q + 1, picked: -1 }; S.scroll = {}; SOUNDS.ui(); return;
      case 'lq:done': {
        const L = LESSONS[S.lq.i]; S.lessons[L.id] = true; saveLessons();
        const n = S.lq.i + 1;
        if (n >= LESSONS.length || (S.demo && n >= 3)) gotoScene('learn'); else startLesson(n);
        return;
      }
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
        S.stats = {}; S.lessons = {}; S.firstGame = true; S.progress = { games: 0, wins: 0 }; clearSave();
        saveStats(); saveLessons(); storage.set('dudo.progress', S.progress); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; if (S.match && S.match.phase === 'resumed') resumeTurn(S.match); return;
      case 'ov:restart': S.overlay = null; startMatch(S.lastSetup ? { ...S.lastSetup } : { ...S.setup }, S.demo); return;
      case 'ov:menu': S.overlay = null; leaveToMenu(); return;
      case 'ov:again': S.overlay = null; startMatch(S.lastSetup ? { ...S.lastSetup } : { ...S.setup }); return;
      case 'ov:setup': S.overlay = null; S.match = null; gotoScene('setup'); return;
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
    if ((S.scene === 'play') && !S.overlay && S.match) { playDown(x, y); return; }
    if (S.scene === 'auto' && !S.overlay) { autoDown(x, y); return; }
    const ui = buildUi(S);
    if (!ui.layout) return;
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
    if (!pr) return;
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) return;
      if (pr.scrolling) { S.scrollVel[ui.scrollKey] = pr.vel; return; }
      const hit = hitDoc(ui.layout, x - ui.region.x, y - ui.region.y - (ui.offY || 0) + getScroll(ui));
      if (hit && hit.id === pr.id && !hit.disabled) activate(hit.id);
    } else if (pr.kind === 'fixed') { if (inRect(x, y, pr.rect)) activate(pr.id); }
    else if (pr.kind === 'hud') { if (inRect(x, y, pr.rect)) hudAction(pr.id); }
    else if (pr.kind === 'auto') { if (inRect(x, y, pr.rect)) autoAction(pr.id); }
    else if (pr.kind === 'play') { if (S.scene === 'play' && !S.overlay && inRect(x, y, pr.rect)) playAction(pr.id); }
  }

  // ---- play
  function playHits(M) {
    const lay = layNow(M), out = [];
    if (M.phase === 'human') {
      lay.face.forEach((r, i) => out.push({ id: `face:${i + 1}`, rect: r }));
      out.push({ id: 'qty:-', rect: lay.minus }, { id: 'qty:+', rect: lay.plus }, { id: 'bid', rect: lay.bid }, { id: 'dudo', rect: lay.dudo }, { id: 'calzo', rect: lay.calzo }, { id: 'think', rect: lay.think });
    } else if (M.phase === 'handoff') out.push({ id: 'hand:ack', rect: lay.handoff });
    else if (M.phase === 'result') out.push({ id: 'next:round', rect: lay.next });
    return out;
  }
  function playDown(x, y) {
    const M = S.match;
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: BACK_BTN }; return; }
    if (inRect(x, y, PAUSE_BTN)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: PAUSE_BTN }; return; }
    for (const h of playHits(M)) if (inRect(x, y, h.rect)) { S.press = { id: h.id, active: true, kind: 'play', rect: h.rect }; return; }
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; }
  }
  function playAction(id) {
    const M = S.match;
    if (!M) return;
    if (id.startsWith('face:')) { if (selFace(M, Number(id.slice(5)))) SOUNDS.select(); else SOUNDS.refuse(); }
    else if (id === 'qty:-') { if (selQty(M, -1)) SOUNDS.select(); }
    else if (id === 'qty:+') { if (selQty(M, 1)) SOUNDS.select(); }
    else if (id === 'bid') humanBid(M);
    else if (id === 'dudo') humanCall(M, 'dudo', rng);
    else if (id === 'calzo') { if (!humanCall(M, 'calzo', rng)) toast(tr('calzoLocked')); }
    else if (id === 'think') think(M);
    else if (id === 'hand:ack') ackHandoff(M);
    else if (id === 'next:round') { if (M.over || (!M.auto && humansAlive(M) === 0)) { if (!M.over) M.over = { winner: -1 }; M.overT = 9; } else nextRoundStart(M); }
  }

  // ---- auto
  function autoDown(x, y) {
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: BACK_BTN }; return; }
    const lay = autoLayout(TEXT_SCALES[S.textIdx], seatOrder(S.match).length);
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, lay[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: lay[id] }; return; }
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
      for (const k of keys.pressed) { const m = isDigit.exec(k); if (m) playAction(`face:${m[2]}`); }
      if (has('ArrowUp') || has('Equal') || has('NumpadAdd')) playAction('qty:+');
      if (has('ArrowDown') || has('Minus') || has('NumpadSubtract')) playAction('qty:-');
      if (has('Enter')) { if (M.phase === 'human') playAction('bid'); else if (M.phase === 'handoff') playAction('hand:ack'); else if (M.phase === 'result') playAction('next:round'); }
      if (has('Space')) { if (M.phase === 'handoff') playAction('hand:ack'); else if (M.phase === 'result') playAction('next:round'); }
      if (has('KeyD') && M.phase === 'human') playAction('dudo');
      if (has('KeyC') && M.phase === 'human') playAction('calzo');
      if (has('KeyT') && M.phase === 'human') playAction('think');
      if (has('Escape') || has('KeyP')) { S.overlay = 'pause'; S.ovT = 0; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('KeyP'))) { activate('ov:resume'); return; }
    if (S.scene === 'auto' && S.auto) {
      if (has('Space') || has('KeyP')) S.auto.paused = !S.auto.paused;
      if (has('Escape') && !S.overlay) autoAction('auto:exit');
      return;
    }
    const ui = buildUi(S);
    if (ui.layout && ui.region) {
      if (keys.down.has('ArrowDown') || keys.down.has('PageDown')) setScroll(ui, getScroll(ui) + 18);
      if (keys.down.has('ArrowUp') || keys.down.has('PageUp')) setScroll(ui, getScroll(ui) - 18);
    }
    if (has('Escape') && ['setup', 'learn', 'lesson', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) activate('back');
    if (S.scene === 'howto' || S.scene === 'rules') {
      if (has('ArrowRight')) activate('next');
      if (has('ArrowLeft')) activate('prev');
    }
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && S.press.kind === 'play' && !ptr.down && !ptr.pressed && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded): let go where the finger last was.
        const p = S.press; S.press = null;
        if (S.scene === 'play' && !S.overlay && inRect(S.lastPtr.x, S.lastPtr.y, p.rect)) playAction(p.id);
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
      if (M && !M.freeze) {
        if (S.scene === 'play') {
          if (S.overlay !== 'pause') stepMatch(M, dt, rng);
        } else if (S.scene === 'auto' && !frozen && !S.overlay) { stepMatch(M, dt, rng); updateAuto(dt); }
        if (S.scene === 'play' || S.scene === 'auto') {
          handleEvents(M);
          if (!frozen) stepWinSeq(dt);
        }
        if (S.scene === 'play' && !S.overlay && M.over && M.phase === 'result' && M.overT > 1.3 && !S.shot) { onEnd(M); S.overlay = 'end'; S.ovT = 0; }
      } else if (M && M.freeze) { M.parts.length = 0; }
    },

    render(ctx) {
      render(ctx, S, buildUi(S));
    },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, lang: S.lang, setup: S.setup,
        stats: S.stats, lessons: Object.keys(S.lessons).length, lq: S.lq, page: S.page, scroll: S.scroll, demoGames: S.demoGames, hasSave: Boolean(S.save),
        auto: S.auto ? { phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          phase: M.phase, round: M.st.round, turn: M.st.turn, dice: M.st.players.map((p) => p.dice), bids: M.st.bids.map((b) => [b.p, b.q, b.f]), pal: M.st.palifico,
          sel: [M.sel.q, M.sel.f], over: M.over ? M.over.winner : null, hand: M.st.players[bottomSeat(M)].hand.join(''), hint: M.hint ? M.hint.act : null, hot: M.hot,
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, setup, lessons, Rules / How to Play / About, Settings, every overlay, the pass-the-phone
    // screen, the demo card and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && (S.match.auto || S.match.phase === 'handoff')),
  };
}
