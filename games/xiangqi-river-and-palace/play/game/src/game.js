// Xiangqi: state and flow. Drawing is view.js; the rule book is rules.js; the computer is engine.js; lessons.js and
// puzzles.js are content. The only file that mutates `state`.
//
// How a move is made: TAP a piece (it lifts, its legal points glow), then TAP a glowing point; or DRAG the piece and drop it.
// A legal move glides there. An illegal one visibly TRIES, shudders and comes back, and a message says why.
import { W, H, BTN, LOOK, RES, titleRows, inRect, squareAt, pointXY } from './layout.js';
import { newGame, fromBoard, applyMove, undoMove, tryMove, legalFor, inCheck, describe, RED, BLACK, SIDE_NAME, TYPE_NAME } from './rules.js';
import { LEVEL_COUNT, createThinker } from './engine.js';
import { LESSONS, stepBoard, sq } from './lessons.js';
import { puzzleFor, moveKey } from './puzzles.js';
import { HOW, ABOUT } from './content.js';
import { invalidateArt } from './art.js';
import { invalidatePieces, warmPiece } from './pieces.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, DEMO_LESSONS = 3, HINTS_PER_GAME = 3;

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const state = {
    scene: 'title', t: 0,
    g: newGame(), human: RED, two: false, level: 3, sound: true, calm: false, big: false, board: 'paper', set: 'boxwood', lang: 'zh',
    sel: -1, targets: [], drag: null, cursor: 85, kb: false, anim: null, parts: [], rings: [], banner: null, msg: null,
    thinking: false, thinkT: 0, hint: null, hintsLeft: HINTS_PER_GAME, last: null, overOpen: false, page: 0,
    lesson: { i: 0, s: 0, done: false, showSol: false }, pz: null,
    progress: { played: 0, wins: 0 }, daily: { last: -1, streak: 0, solvedToday: false }, learned: [], learnedAll: false,
    saved: false, demoGames: 0,
  };
  let thinker = null, hinter = null, pending = null, savedBlob = null, warmI = 0, fontFix = 0;
  const sfx = [];
  const day = config.day ?? 20000;

  // ---- storage ------------------------------------------------------------------------------------------------------
  const savePrefs = () => { storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, board: state.board, set: state.set, lang: state.lang }); };
  storage.get('prefs', null).then((p) => { if (!p) return; Object.assign(state, { level: p.level ?? state.level, sound: p.sound ?? true, calm: !!p.calm, big: !!p.big, board: p.board ?? 'paper', set: p.set ?? 'boxwood', lang: p.lang === 'en' ? 'en' : 'zh' }); audio.setMuted(!state.sound); });
  storage.get('progress', null).then((p) => { if (p) state.progress = { played: p.played | 0, wins: p.wins | 0 }; });
  storage.get('daily', null).then((d) => { if (d) { state.daily.last = d.last ?? -1; state.daily.streak = d.last >= day - 1 ? d.streak ?? 0 : 0; state.daily.solvedToday = d.last === day; } });
  storage.get('learned', []).then((l) => { state.learned = Array.isArray(l) ? l : []; state.learnedAll = state.learned.length >= LESSONS.length; });
  storage.get('demoGames', 0).then((n) => { state.demoGames = n | 0; });
  storage.get('save', null).then((s) => { if (s && s.g && s.g.log && s.g.log.length && !s.g.result) { savedBlob = s; state.saved = true; } });
  const saveGame = () => {
    if (state.scene !== 'play' || state.g.result || state.two) return;
    savedBlob = { g: state.g, human: state.human, level: state.level, hintsLeft: state.hintsLeft };
    storage.set('save', JSON.parse(JSON.stringify(savedBlob))); state.saved = true;
  };
  const clearSave = () => { storage.remove('save'); state.saved = false; savedBlob = null; };

  // ---- small helpers -------------------------------------------------------------------------------------------------
  const say = (text, kind = 'info') => { state.msg = { text, kind, t: 0 }; };
  const sound = (name) => {
    if (!state.sound) return;
    if (name === 'tok') audio.tone({ freq: 240, to: 110, dur: 0.07, type: 'triangle', vol: 0.3 });
    else if (name === 'take') { audio.tone({ freq: 200, to: 90, dur: 0.1, type: 'triangle', vol: 0.36 }); sfx.push({ at: state.t + 0.06, o: { freq: 520, to: 300, dur: 0.12, type: 'square', vol: 0.06 } }); }
    else if (name === 'refuse') audio.tone({ freq: 150, to: 110, dur: 0.14, type: 'sine', vol: 0.22 });
    else if (name === 'check') { audio.tone({ freq: 660, dur: 0.14, type: 'sine', vol: 0.18 }); sfx.push({ at: state.t + 0.13, o: { freq: 880, dur: 0.22, type: 'sine', vol: 0.18 } }); }
    else if (name === 'win') [523, 659, 784, 1046].forEach((f, k) => sfx.push({ at: state.t + k * 0.13, o: { freq: f, dur: 0.3, type: 'sine', vol: 0.2 } }));
    else if (name === 'lose') [392, 330, 262].forEach((f, k) => sfx.push({ at: state.t + k * 0.17, o: { freq: f, dur: 0.32, type: 'triangle', vol: 0.2 } }));
    else if (name === 'ok') audio.tone({ freq: 700, to: 900, dur: 0.09, type: 'sine', vol: 0.14 });
  };
  const flip = () => state.scene === 'play' && state.human === BLACK && !state.two;
  const pxy = (s) => pointXY(s, flip());
  const clearSel = () => { state.sel = -1; state.targets = []; state.drag = null; };
  const busy = () => !!state.anim || state.thinking;
  const myTurn = () => { const g = state.g; if (g.result) return false; if (state.scene === 'play') return state.two || g.turn === state.human; return g.turn === RED; };

  // ---- animation ------------------------------------------------------------------------------------------------------
  const startAnim = (o, next) => { state.anim = { t: 0, ...o, dur: (o.dur ?? 0.3) * (state.calm ? 0.6 : 1) }; pending = next ?? null; };
  const burst = (s) => {
    const p = pxy(s); state.rings.push({ x: p.x, y: p.y, t: 0 });
    if (!state.calm) for (let k = 0; k < 14; k++) { const a = rng.range(0, Math.PI * 2), v = rng.range(60, 230); state.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, max: rng.range(0.35, 0.7), size: rng.range(2.5, 6), c: k % 3 === 0 ? '255,90,60' : '255,214,120' }); }
  };
  // Play a legal move on the board with its animation; `then` runs when it lands.
  const doMove = (m, then) => {
    const g = state.g, p = g.board[m.from], cap = g.board[m.to];
    const text = describe(g, m);
    const r = applyMove(g, m);
    state.last = { f: m.from, t: m.to }; state.hint = null; clearSel();
    startAnim({ type: 'move', from: m.from, to: m.to, p, cap, dur: 0.3 + (cap ? 0.06 : 0) }, () => {
      sound(cap ? 'take' : 'tok'); if (cap) burst(m.to);
      if (g.result) { if (g.result.why === 'checkmate') { state.banner = { text: 'Checkmate', t: 0 }; sound('check'); } }
      else if (r.chk) { state.banner = { text: 'Check!', t: 0 }; sound('check'); }
      if (then) then(r, text);
    });
  };
  const refuse = (from, to, why) => {
    const p = state.g.board[from];
    if (why) say(why, 'warn');
    sound('refuse');
    if (to >= 0 && to !== from) startAnim({ type: 'refuse', from, to, p, dur: 0.55 }, null);
  };

  // ---- starting things -------------------------------------------------------------------------------------------------
  const startGame = (human, two) => {
    if (config.demo) { if (state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; } state.demoGames++; storage.set('demoGames', state.demoGames); }
    state.g = newGame(); state.human = human; state.two = two; state.scene = 'play'; state.hintsLeft = HINTS_PER_GAME;
    Object.assign(state, { last: null, msg: null, overOpen: false, hint: null, anim: null, thinking: false, banner: null }); clearSel(); thinker = null; hinter = null; pending = null;
    if (!two) clearSave();
    afterMove(true);
  };
  const resume = () => {
    if (!savedBlob) return;
    const b = JSON.parse(JSON.stringify(savedBlob));
    Object.assign(state, { g: b.g, human: b.human, level: b.level ?? state.level, hintsLeft: b.hintsLeft ?? 0, two: false, scene: 'play', last: null, msg: null, overOpen: false, hint: null, anim: null, thinking: false });
    const lg = state.g.log[state.g.log.length - 1]; if (lg) state.last = { f: lg.f, t: lg.t };
    clearSel(); thinker = null; afterMove(true);
  };
  const startThinking = () => { state.thinking = true; state.thinkT = 0; thinker = createThinker(state.g, state.level, rng); };
  const afterMove = (quiet) => {
    const g = state.g;
    if (g.result) { finishGame(); return; }
    if (!quiet && !state.two && inCheck(g) && g.turn === state.human) say('You are in check! Capture the attacker, block it, or move your general.', 'warn');
    if (!state.two && g.turn !== state.human) startThinking();
    saveGame();
  };
  const finishGame = () => {
    const r = state.g.result;
    state.overOpen = true; clearSave(); state.hint = null;
    if (!state.two && state.scene === 'play') {
      state.progress.played++; if (r.winner === state.human) state.progress.wins++;
      storage.set('progress', { played: state.progress.played, wins: state.progress.wins });
      monetization.track('game_end', { level: state.level, won: r.winner === state.human });
    }
    sound(r.winner === 0 ? 'ok' : (state.two || r.winner === state.human) ? 'win' : 'lose');
  };
  const takeBack = () => {
    const g = state.g; if (state.anim || g.log.length === 0) return;
    thinker = null; state.thinking = false; state.hint = null; state.overOpen = false; clearSel();
    if (state.two) undoMove(g);
    else { do { if (!undoMove(g)) break; } while (g.turn !== state.human && g.log.length); }
    const lg = g.log[g.log.length - 1]; state.last = lg ? { f: lg.f, t: lg.t } : null;
    say('Move taken back.', 'info'); sound('ok');
    if (!state.two && g.turn !== state.human) startThinking();
    saveGame();
  };
  const useHint = () => {
    if (state.hintsLeft <= 0 || busy() || !myTurn() || state.g.result) return;
    state.hintsLeft--; state.hint = null; hinter = createThinker(state.g, 4, rng); say('Looking for a good move...', 'info');
  };
  const toMenu = () => {
    if (state.scene === 'play') saveGame();
    clearSel(); Object.assign(state, { scene: 'title', overOpen: false, thinking: false, anim: null, msg: null, hint: null, banner: null }); thinker = null; hinter = null; pending = null; state.two = false;
    if (state.pz) state.pz.reply = null;
    state.g = newGame(); savePrefs();
  };

  // ---- lessons -----------------------------------------------------------------------------------------------------------
  const loadStep = () => {
    const st = LESSONS[state.lesson.i].steps[state.lesson.s];
    state.g = fromBoard(stepBoard(st), RED); state.human = RED; state.two = true;
    Object.assign(state.lesson, { done: false, showSol: false }); Object.assign(state, { last: null, msg: null, hint: null, anim: null, banner: null }); clearSel(); pending = null;
  };
  const startLesson = (i) => {
    if (config.demo && i >= DEMO_LESSONS) { state.scene = 'demo-limit'; return; }
    state.scene = 'lesson'; state.lesson = { i, s: 0, done: false, showSol: false }; loadStep();
  };
  const stepDone = () => {
    state.lesson.done = true; sound('ok'); clearSel();
    const l = LESSONS[state.lesson.i];
    if (state.lesson.s === l.steps.length - 1 && !state.learned.includes(state.lesson.i)) { state.learned.push(state.lesson.i); storage.set('learned', state.learned.slice()); state.learnedAll = state.learned.length >= LESSONS.length; }
  };
  const wantMatches = (want, from, to) => {
    if (want.refuse) return false;
    if (want.from && from !== sq(want.from)) return false;
    if (want.to) return want.to.some((p) => sq(p) === to);
    if (want.any) return true;
    const c = JSON.parse(JSON.stringify(state.g)); applyMove(c, { from, to });
    if (want.mate) return !!c.result && c.result.why === 'checkmate';
    if (want.check) return inCheck(c, BLACK);
    return !!want.escape;
  };
  const lessonAttempt = (from, to) => {
    const st = LESSONS[state.lesson.i].steps[state.lesson.s], want = st.want, r = tryMove(state.g, from, to);
    if (want.refuse) {
      if (from === sq(want.refuse) && !r.ok) { refuse(from, to, r.why); stepDone(); return; }
      if (r.ok) { refuse(from, to, 'That move is allowed. This step is about a move that is NOT allowed: pick the piece and try the point described above.'); return; }
      refuse(from, to, r.why); return;
    }
    if (!r.ok) { refuse(from, to, r.why); return; }
    if (wantMatches(want, from, to)) { doMove(r.move, () => stepDone()); return; }
    refuse(from, to, 'That is a legal move, but this step asks for a different one. Tap Hint to see it.');
  };
  const lessonTargets = (from) => {
    const w = LESSONS[state.lesson.i].steps[state.lesson.s].want, all = legalFor(state.g, from);
    if (w.refuse) return [];
    if (w.from && from !== sq(w.from)) return [];
    if (w.to) return all.filter((t) => w.to.some((p) => sq(p) === t));
    if (w.any) return all;
    return all.filter((t) => wantMatches(w, from, t));
  };

  // ---- puzzle --------------------------------------------------------------------------------------------------------------
  const startPuzzle = () => {
    const p = puzzleFor(day);
    state.pz = { puzzle: p, n: p.n, node: p.tree, status: 'play', tries: 0, daily: true, reply: null, wait: 0 };
    state.scene = 'puzzle'; state.g = fromBoard(p.board, RED); state.human = RED; state.two = true;
    Object.assign(state, { last: null, msg: null, hint: null, anim: null, banner: null }); clearSel(); pending = null;
  };
  const markDaily = () => {
    const d = state.daily; if (d.last === day) return;
    d.streak = d.last === day - 1 ? d.streak + 1 : 1; d.last = day; d.solvedToday = true;
    storage.set('daily', { last: d.last, streak: d.streak });
  };
  const puzzleAttempt = (from, to) => {
    const pz = state.pz, r = tryMove(state.g, from, to);
    if (!r.ok) { refuse(from, to, r.why); return; }
    const entry = pz.node[moveKey(from, to)];
    if (!entry) { pz.tries++; refuse(from, to, 'That does not force checkmate in time. Try another move; the position stays as it is.'); return; }
    doMove(r.move, () => {
      if (entry.reply === null) { pz.status = 'solved'; sound('win'); say('Checkmate! Puzzle solved.', 'good'); if (pz.daily) markDaily(); return; }
      say('Good. The opponent replies. Find the next move.', 'good');
      const [f, t] = entry.reply.split('-').map(Number);
      pz.reply = { f, t, next: entry.next }; pz.wait = 0.35;
    });
  };

  // ---- taps -------------------------------------------------------------------------------------------------------------------
  const ownPiece = (s) => { const p = state.g.board[s]; return p !== 0 && (p > 0) === (state.g.turn > 0); };
  const attempt = (from, to) => {
    const sc = state.scene;
    if (sc === 'lesson') { if (!state.lesson.done) lessonAttempt(from, to); return; }
    if (sc === 'puzzle') { if (state.pz.status !== 'solved') puzzleAttempt(from, to); return; }
    const r = tryMove(state.g, from, to);
    if (!r.ok) { refuse(from, to, r.why); clearSel(); return; }
    state.msg = null; doMove(r.move, () => afterMove());
  };
  const select = (s) => {
    state.sel = s; state.hint = null; state.msg = null;
    state.targets = state.scene === 'lesson' ? lessonTargets(s) : legalFor(state.g, s);
    if (state.targets.length === 0 && state.scene !== 'lesson') say(`This ${TYPE_NAME[Math.abs(state.g.board[s])]} has no legal move right now.`, 'info');
    sound('ok');
  };
  const tapSquare = (s) => {
    if (state.anim || state.thinking) return;
    if (state.scene === 'lesson' && state.lesson.done) return;
    if (state.scene === 'puzzle' && (state.pz.status === 'solved' || state.pz.reply)) return;
    if (state.g.result) return;
    if (!myTurn()) return;
    if (s < 0 || state.sel === s) { clearSel(); return; }
    if (state.sel >= 0 && state.targets.includes(s)) { attempt(state.sel, s); return; }
    if (ownPiece(s)) { select(s); return; }
    if (state.sel >= 0) { attempt(state.sel, s); return; }
    if (state.g.board[s]) say('That piece belongs to the opponent. Tap one of your own pieces.', 'info'); else clearSel();
  };
  const KEYMOVE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const boardScene = () => state.scene === 'play' || state.scene === 'lesson' || state.scene === 'puzzle';

  function boardPointer(p) {
    const d = state.drag;
    if (p.pressed && !state.anim) {
      const s = squareAt(p.x, p.y, flip());
      state.kb = false;
      tapSquare(s);
      if (s >= 0 && state.sel === s && myTurn() && !state.thinking && !state.anim) state.drag = { sq: s, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
    }
    if (state.drag && p.down) { const dd = state.drag; dd.x = p.x; dd.y = p.y; if (!dd.moved && Math.hypot(p.x - dd.sx, p.y - dd.sy) > 16) { dd.moved = true; state.msg = null; } }
    if (p.released && d && state.drag === d) {
      state.drag = null;
      if (d.moved) { const s = squareAt(p.x, p.y - 46, flip()); if (s >= 0 && s !== d.sq && !state.anim) attempt(d.sq, s); }
    }
  }

  // ---- update -------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt;
    const p = input.pointer, keys = input.keys;
    // fonts may arrive late: repaint the cached art twice, early
    if (fontFix < 2 && state.t > (fontFix === 0 ? 0.8 : 2.6)) { fontFix++; invalidateArt(); invalidatePieces(); warmI = 0; }
    if (warmI < 14) { warmPiece((warmI < 7 ? 1 : -1) * (1 + (warmI % 7)), 32, state.set, state.lang); warmI++; }
    for (let i = sfx.length - 1; i >= 0; i--) if (sfx[i].at <= state.t) { audio.tone(sfx[i].o); sfx.splice(i, 1); }
    if (state.msg) state.msg.t += dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t > 1.5) state.banner = null; }
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt; }
    state.parts = state.parts.filter((q) => q.t < q.max);
    for (const r of state.rings) r.t += dt;
    state.rings = state.rings.filter((r) => r.t < 0.5);

    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) { const f = pending; state.anim = null; pending = null; if (f) f(); } }
    if (state.pz && state.pz.reply && !state.anim && state.scene === 'puzzle') {
      state.pz.wait -= dt;
      if (state.pz.wait <= 0) { const { f, t, next } = state.pz.reply; state.pz.reply = null; state.pz.node = next; doMove({ from: f, to: t }, () => { if (!state.g.result) say('Your move.', 'info'); }); }
    }
    // the computer thinks a little every frame and never blocks one
    if (state.thinking && !state.anim && thinker) {
      state.thinkT += dt;
      const r = thinker.step();
      if (r.move !== undefined && state.thinkT >= (state.calm ? 0.35 : 0.6)) { const mv = r.move; thinker = null; state.thinking = false; if (mv) doMove(mv, () => afterMove()); }
    }
    if (hinter) { const r = hinter.step(); if (r.move !== undefined) { state.hint = r.move ? { from: r.move.from, to: r.move.to } : null; hinter = null; say(state.hint ? 'A good move is marked in green.' : 'No move found.', 'info'); } }

    if (state.scene === 'demo-limit') { if (p.pressed && inRect({ x: 140, y: 1200, w: 440, h: 84 }, p.x, p.y)) state.scene = 'title'; return; }

    if (keys.pressed.size) {
      const k = [...keys.pressed];
      if (state.scene === 'title') { if (k.includes('Enter') || k.includes('Space')) startGame(RED, false); }
      else if (boardScene()) {
        state.kb = true;
        for (const c of k) {
          if (KEYMOVE[c]) { const [dx, dy] = KEYMOVE[c], f = flip() ? -1 : 1; const x = Math.max(0, Math.min(8, (state.cursor % 9) + dx * f)), y = Math.max(0, Math.min(9, ((state.cursor / 9) | 0) + dy * f)); state.cursor = y * 9 + x; }
          else if (c === 'Space' || c === 'Enter') { if (state.scene === 'play' && state.g.result && state.overOpen) startGame(state.human, state.two); else tapSquare(state.cursor); }
          else if (c === 'Escape') toMenu();
          else if (c === 'KeyU' && state.scene === 'play') takeBack();
          else if (c === 'KeyH' && state.scene === 'play') useHint();
        }
      } else if (keys.pressed.has('Escape')) state.scene = 'title';
    }

    const hit = (r) => p.pressed && inRect(r, p.x, p.y);
    switch (state.scene) {
      case 'title': {
        if (!p.pressed) break;
        const rows = titleRows(state.saved);
        if (state.saved && hit(rows.resume)) resume();
        else if (hit(rows.langZh)) { state.lang = 'zh'; warmI = 0; savePrefs(); }
        else if (hit(rows.langEn)) { state.lang = 'en'; warmI = 0; savePrefs(); }
        else if (hit(rows.learn)) { const open = LESSONS.map((_, i) => i).filter((i) => !state.learned.includes(i)); startLesson(open.length ? open[0] : 0); }
        else if (hit(rows.red)) startGame(RED, false);
        else if (hit(rows.black)) startGame(BLACK, false);
        else if (hit(rows.two)) startGame(RED, true);
        else if (hit(rows.daily)) startPuzzle();
        else if (hit(rows.level)) { state.level = (state.level % LEVEL_COUNT) + 1; savePrefs(); }
        else if (hit(rows.sound)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); }
        else if (hit(rows.how)) { state.scene = 'howto'; state.page = 0; }
        else if (hit(rows.about)) { state.scene = 'about'; state.page = 0; }
        else if (hit(rows.look)) state.scene = 'look';
        break;
      }
      case 'look': {
        if (!p.pressed) break;
        const pick = (arr) => arr.findIndex((r) => inRect(r, p.x, p.y));
        let i;
        if ((i = pick(LOOK.lang)) >= 0) { state.lang = i ? 'en' : 'zh'; warmI = 0; }
        else if ((i = pick(LOOK.boards)) >= 0) state.board = i ? 'night' : 'paper';
        else if ((i = pick(LOOK.sets)) >= 0) { state.set = i ? 'ebony' : 'boxwood'; warmI = 0; }
        else if ((i = pick(LOOK.text)) >= 0) state.big = i === 1;
        else if ((i = pick(LOOK.calm)) >= 0) state.calm = i === 1;
        else if ((i = pick(LOOK.sound)) >= 0) { state.sound = i === 0; audio.setMuted(!state.sound); }
        else if (hit(LOOK.back)) { state.scene = 'title'; i = 0; }
        if (i >= 0) savePrefs();
        break;
      }
      case 'howto': case 'about': {
        if (hit(BTN.prev)) state.scene = 'title'; else if (hit(BTN.page)) state.page = (state.page + 1) % (state.scene === 'howto' ? HOW : ABOUT).length;
        break;
      }
      case 'lesson': {
        const L = state.lesson, l = LESSONS[L.i];
        if (hit(BTN.menu)) { toMenu(); break; }
        if (hit(BTN.undo) && !L.done) { L.showSol = true; say(l.steps[L.s].hint, 'good'); break; }
        if (hit(BTN.hint)) {
          if (!L.done) loadStep();
          else if (L.s + 1 < l.steps.length) { L.s++; loadStep(); }
          else if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
          else toMenu();
          break;
        }
        boardPointer(p);
        break;
      }
      case 'puzzle': {
        const pz = state.pz;
        if (hit(BTN.menu)) { toMenu(); break; }
        if (hit(BTN.undo) && pz.status !== 'solved' && !state.anim) { state.g = fromBoard(pz.puzzle.board, RED); pz.node = pz.puzzle.tree; pz.reply = null; state.last = null; state.msg = null; state.hint = null; clearSel(); break; }
        if (hit(BTN.hint) && pz.status !== 'solved' && !state.anim) { const [f, t] = Object.keys(pz.node)[0].split('-').map(Number); state.hint = { from: f, to: t }; say('The green points show a move that works.', 'good'); break; }
        boardPointer(p);
        break;
      }
      case 'play': {
        const g = state.g;
        if (state.overOpen) {
          if (hit(RES.again)) startGame(state.human, state.two);
          else if (hit(RES.look)) state.overOpen = false;
          else if (hit(RES.menu)) toMenu();
          break;
        }
        if (hit(BTN.menu)) { toMenu(); break; }
        if (hit(BTN.undo)) { takeBack(); break; }
        if (hit(BTN.hint)) { if (g.result) startGame(state.human, state.two); else useHint(); break; }
        boardPointer(p);
        break;
      }
      default: break;
    }
  }

  return {
    update,
    render(ctx) { render(ctx, state); },
    getState() {
      const { g, pz, ...rest } = state;
      return { ...rest, pz: pz ? { n: pz.n, status: pz.status, tries: pz.tries } : null, g: { board: g.board, turn: g.turn, moves: g.log.length, result: g.result } };
    },
  };
}
