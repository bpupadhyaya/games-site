// Oware: state and flow. Drawing is view.js; the rule book is rules.js; the computer is engine.js; lessons.js and puzzles.js are
// content. The rule book applies a move to `state.game` at once; `state.anim` then PLAYS it (lift, sow pit by pit, capture)
// while `state.shown` (the pit counts the player sees) catches up. Input is ignored while an animation runs.
import { W, H, BTN, SET, titleRows, inRect, pitNear, pitPos, TEXT_SCALES } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalMoves, sow, sideOf } from './rules.js';
import { LEVELS, createThinker } from './engine.js';
import { LESSONS } from './lessons.js';
import { puzzleFor, puzzleGame, gains, isWeekend } from './puzzles.js';
import { RULES } from './content.js';
import { ABOUT } from './about.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3, SEEDSETS = ['nuts', 'cowries', 'glass'], WOODS = ['iroko', 'ebony'];
const NODES_PER_TICK = 3500;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(), shown: null, two: false, level: 1, sound: true, calm: false, big: false, seeds: 'nuts', wood: 'iroko',
    cursor: 2, kb: false, anim: null, msg: null, think: 0, thinking: false, undo: [], hintsLeft: HINTS, hint: null,
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0, lesson: null, pz: null, ref: null,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true, page: 0,
    textScaleIdx: 0, // index into TEXT_SCALES; the About/Rules reference pages' own text size
  };
  state.shown = { pits: state.game.pits.slice(), store: [0, 0] };
  let thinker = null, hintThinker = null;

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.seeds = v.seeds ?? 'nuts'; state.wood = v.wood ?? 'iroko'; state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner === null && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, seeds: state.seeds, wood: state.wood, textScaleIdx: state.textScaleIdx });
  const saveGame = () => { if (state.scene === 'play' && state.game.winner === null) { state.saved = { game: clone(state.game), two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };

  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f, to: f * 0.5, dur: 0.05, type: 'sine', vol: 0.1 });
  // a seed dropped into a pit: pitch climbs a little along the sowing, so a long run sounds like a run
  const seedTick = (n) => tone({ freq: 300 + n * 26, to: 180 + n * 12, dur: 0.045, type: 'triangle', vol: 0.09 });
  const chime = (k) => tone({ freq: 620 + k * 90, to: 900 + k * 120, dur: 0.24, type: 'sine', vol: 0.09 });
  const syncShown = () => { state.shown = { pits: state.game.pits.slice(), store: state.game.store.slice() }; };
  const reset = (extra) => { thinker = hintThinker = null; Object.assign(state, { anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS, ref: null }, extra); syncShown(); };
  const humanTurn = () => state.game.winner === null && (state.two || state.game.turn === 0);
  const durf = (d) => (state.calm ? d * 0.5 : d);

  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    reset({ scene: 'play', game: newGame(), two });
    say(two ? 'Player one (bottom row) begins. TAP one of your pits to sow it.' : 'You play the bottom row. TAP one of your pits to sow it.');
    monetization.track('game_start', { two, level: state.level });
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', game: clone(v.game), two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS });
    say('Game restored.'); if (!humanTurn()) state.think = 0.5;
  }
  function startLesson(i) {
    const l = LESSONS[i], g = newGame(); g.pits = l.pits.slice(); g.store = l.store.slice();
    reset({ scene: 'lesson', game: g, two: true, lesson: { i, done: false } });
  }
  function startPuzzle() {
    const p = puzzleFor(state.daily.day);
    reset({ scene: 'puzzle', game: puzzleGame(p), two: true, pz: { puzzle: p, status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', tries: 0, wrong: 0 } });
    if (state.pz.status === 'ready') say(p.hard ? 'Weekend puzzle. TAP the one pit that captures the most seeds.' : 'TAP the one pit that captures the most seeds.');
  }

  // Start playing a move: the rule book changes the game now; the animation shows it.
  function play(pit) {
    const before = clone(state.game), r = applyMove(state.game, pit);
    state.shown = { pits: before.pits.slice(), store: before.store.slice() }; state.shown.pits[pit] = 0;
    state.anim = { r, before, phase: 'lift', timer: 0, idx: 0, from: pit, n: before.pits[pit], sd: durf(Math.max(0.07, Math.min(0.2, 2.4 / r.path.length))), cap: 0 };
    state.hint = null; state.ref = null;
    clack(500);
  }
  // Advance the animation. Returns true when it just ended.
  function stepAnim(dt) {
    const A = state.anim, r = A.r, sh = state.shown;
    A.timer += dt; A.dropT = (A.dropT ?? 9) + dt;
    if (A.phase === 'lift') {
      if (A.timer >= durf(0.22)) { A.phase = 'sow'; A.timer = 0; }
    } else if (A.phase === 'sow') {
      while (A.timer >= A.sd && A.idx < r.path.length) { A.timer -= A.sd; const at = r.path[A.idx]; sh.pits[at] += 1; A.n -= 1; A.idx += 1; A.lastDrop = at; A.dropT = 0; seedTick(A.idx); }
      if (A.idx >= r.path.length) { A.phase = r.captured.length ? 'capwait' : 'end'; A.timer = 0; }
    } else if (A.phase === 'capwait') {
      if (A.timer >= durf(0.3)) { A.phase = 'cap'; A.timer = 0; }
    } else if (A.phase === 'cap') {
      if (A.timer >= durf(0.34)) {
        const c = r.captured[A.cap]; sh.store[r.player] += sh.pits[c]; sh.pits[c] = 0; chime(A.cap); A.cap += 1; A.timer = 0;
        if (A.cap >= r.captured.length) A.phase = 'end';
      }
    } else if (A.phase === 'end') {
      if (A.timer >= durf(r.slam ? 0.9 : 0.25)) { state.anim = null; syncShown(); return true; }
    }
    return false;
  }
  const describe = (r, who) => {
    if (r.slam) return 'Grand slam: that would take every seed, so nothing is captured.';
    if (r.gain > 0) return `${who} captured ${r.gain} seed${r.gain === 1 ? '' : 's'}.`;
    return '';
  };
  function afterMove(r) {
    const g = state.game, mine = r.player === 0 || state.two;
    const t = describe(r, state.two ? (r.player === 0 ? 'Player one' : 'Player two') : r.player === 0 ? 'You' : 'The computer');
    if (t) say(t, 3.5);
    else if (!state.two && r.player === 1) say(`The computer sowed ${r.before[r.pit]} seed${r.before[r.pit] === 1 ? '' : 's'}.`, 2.5);
    void mine;
    if (g.winner !== null) { finish(); return; }
    saveGame();
    if (!humanTurn()) state.think = 0.55;
  }
  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === 0) { state.stats.wins += 1; state.stats.badges['L' + state.level] = true; }
    saveStats();
    tone({ freq: g.winner === 'draw' ? 330 : 523, to: g.winner === 'draw' ? 330 : 880, dur: 0.45, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
  }

  // ---- tapping a pit -------------------------------------------------------------------------------------------
  function tapPit(i) {
    const g = state.game, res = tryMove(g, i);
    if (res.error) { state.ref = { pit: i, t: 0 }; say(res.error, 6); tone({ freq: 190, to: 130, dur: 0.15, type: 'triangle', vol: 0.06 }); return null; }
    return i;
  }

  function updateTitle(tap) {
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(false);
    else if (hit(R.two)) start(true);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(R.settings)) state.scene = 'settings';
    else if (hit(R.rules)) { state.scene = 'rules'; state.page = 0; }
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(SET.level, tap.x, tap.y)) { state.level = (state.level + 1) % LEVELS.length; clack(); }
    else if (inRect(SET.sound, tap.x, tap.y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); clack(); }
    else if (inRect(SET.calm, tap.x, tap.y)) { state.calm = !state.calm; clack(); }
    else if (inRect(SET.big, tap.x, tap.y)) { state.big = !state.big; clack(); }
    else if (inRect(SET.seeds, tap.x, tap.y)) { state.seeds = SEEDSETS[(SEEDSETS.indexOf(state.seeds) + 1) % SEEDSETS.length]; clack(); }
    else if (inRect(SET.wood, tap.x, tap.y)) { state.wood = WOODS[(WOODS.indexOf(state.wood) + 1) % WOODS.length]; clack(); }
    else if (inRect(SET.back, tap.x, tap.y)) state.scene = 'title';
    else return;
    savePrefs();
  }

  // The computer thinks a slice per tick (a few thousand nodes) so a frame never stalls.
  function think(dt) {
    state.think -= dt;
    if (state.think > 0) return;
    if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
    const n0 = thinker.nodes();
    for (;;) {
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move >= 0) play(r.move); return; }
      if (thinker.nodes() - n0 >= NODES_PER_TICK) return;
    }
  }
  function updateHint() {
    const n0 = hintThinker.nodes();
    for (;;) {
      const r = hintThinker.step();
      if (r.move !== undefined) {
        hintThinker = null; state.thinking = false;
        if (r.move >= 0) {
          const p = state.game.pits.slice(), s = sow(p, state.game.turn, r.move);
          const why = s.gain > 0 ? `Sowing this pit captures ${s.gain} seeds.` : s.last < 6 || (state.game.turn === 1 && s.last >= 6) ? 'This keeps its seeds at home and leaves your opponent little to capture.' : 'The computer’s search likes this one: it gives the opponent the fewest captures.';
          state.hint = { pit: r.move, t: 0 }; say(`Hint: sow the glowing pit. ${why}`, 6);
        }
        return;
      }
      if (hintThinker.nodes() - n0 >= NODES_PER_TICK) return;
    }
  }

  function updatePlay(dt, tap) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 6) state.hint = null; }
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (state.anim) { const rr = state.anim.r; if (stepAnim(dt)) afterMove(rr); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    if (!humanTurn()) { think(dt); return; }
    if (hintThinker) { updateHint(); return; }
    if (tap && inRect(BTN.undo, tap.x, tap.y)) {
      if (state.undo.length) { state.game = state.undo.pop(); syncShown(); state.hint = null; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 2, rng); state.thinking = true; }
      return;
    }
    if (!tap) return;
    const i = pitNear(tap.x, tap.y); if (i < 0) return;
    const m = tapPit(i);
    if (m !== null) { state.undo.push(clone(state.game)); play(m); }
  }

  function updateLesson(dt, tap) {
    const L = state.lesson, l = LESSONS[L.i];
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (state.anim) { const A = state.anim; if (stepAnim(dt)) { const r = A.r; const t = describe(r, 'You'); L.done = true; say(l.done + (t && !r.slam ? '' : ''), 12); tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); } return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try a game against the computer.', 7); }
      }
      return;
    }
    if (!tap) return;
    const i = pitNear(tap.x, tap.y); if (i < 0) return;
    const m = tapPit(i); if (m === null) return;
    if (l.want.includes(m)) { play(m); } else say(l.hint ?? 'That is a real move, but not the one this lesson teaches. TAP the glowing pit.', 6);
  }

  function updatePuzzle(dt, tap) {
    const P = state.pz;
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (state.anim) {
      if (stepAnim(dt)) {
        if (P.wrong > 0) return;
        P.status = 'solved';
        if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
        say(`Solved! That captures ${P.puzzle.gain} seeds, the most possible.`, 8); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
      }
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); syncShown(); P.wrong = 0; say('Set up again. Count where each pit’s last seed lands.'); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Oware daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (!tap) return;
    const i = pitNear(tap.x, tap.y); if (i < 0) return;
    const m = tapPit(i); if (m === null) return;
    if (m === P.puzzle.best) play(m);
    else {
      const g = gains(state.game).find((x) => x.m === m);
      P.tries += 1; P.wrong = 1.8; play(m);
      say(`That takes ${g ? g.gain : 0}. Another pit takes more.`, 4);
    }
  }

  // Keyboard (web): Left/Right along your row, Enter/Space sows, U undo, H hint, Esc menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { const R = titleRows(!!state.saved); if (k.has('Enter') || k.has('Space')) return at(R.resume || R.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(BTN.again); if (k.has('Escape')) return at(BTN.back); return null; }
    if (sc === 'settings') { if (k.has('Escape')) return at(SET.back); return null; }
    if (sc === 'about') { if (k.has('Escape')) return at(BTN.aboutBack); if (k.has('Enter') || k.has('Space')) return at(BTN.aboutNext); return null; }
    if (sc === 'rules') { if (k.has('Escape')) return at(BTN.rulesBack); if (k.has('Enter') || k.has('Space')) return at(BTN.rulesNext); return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return at(BTN.menu);
    if (k.has('KeyU')) return at(BTN.undo);
    if (k.has('KeyH')) return at(BTN.hint);
    if (sc === 'lesson' && state.lesson.done && (k.has('Enter') || k.has('Space'))) return at(BTN.next);
    if (k.has('ArrowLeft')) { state.kb = true; state.cursor = Math.max(0, state.cursor - 1); return null; }
    if (k.has('ArrowRight')) { state.kb = true; state.cursor = Math.min(5, state.cursor + 1); return null; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const p = pitPos(state.game.turn === 0 ? state.cursor : 11 - state.cursor); return { x: p.x, y: p.y }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'about') {
        if (tap && inRect(BTN.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); }
        else if (tap && inRect(BTN.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); }
        else if (tap && inRect(BTN.aboutBack, tap.x, tap.y)) state.scene = 'title';
        else if (tap && inRect(BTN.aboutNext, tap.x, tap.y)) state.page = (state.page + 1) % ABOUT.pages.length;
      }
      else if (sc === 'rules') {
        if (tap && inRect(BTN.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); }
        else if (tap && inRect(BTN.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); }
        else if (tap && inRect(BTN.rulesBack, tap.x, tap.y)) state.scene = 'title';
        else if (tap && inRect(BTN.rulesNext, tap.x, tap.y)) state.page = (state.page + 1) % RULES.length;
      }
      else if (sc === 'play') updatePlay(dt, tap);
      else if (sc === 'lesson') updateLesson(dt, tap);
      else if (sc === 'puzzle') updatePuzzle(dt, tap);
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.two);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
export { isWeekend, sideOf };
