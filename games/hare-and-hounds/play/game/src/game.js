// Hare and Hounds: state and flow. Drawing is in view.js; the rule book is rules.js; the computer's brain is
// engine.js; lessons.js, campaign.js and puzzles.js are content. See design/ARCHITECTURE.md for the whole map.
//
// How a move is made (owner's spec): tap a piece (it lifts, its legal points glow), then tap where it should go.
// A legal move glides there. An illegal one visibly TRIES: the piece travels toward the point, shudders, comes
// back, and a message says why.
import { W, H, BTN, LOOK, RULES_NAV, RULES_HEADER, TEXT_SCALES, TILE, titleRows, inRect, pointNear, pointAt, overButtons } from './layout.js';
import { RULES } from './content.js';
import { newGame, clone, applyMove, tryMove, legalMoves, DEFAULT_LIMIT } from './rules.js';
import { LEVELS, createThinker, bestMove, chooseMove, forcingMoves } from './engine.js';
import { LESSONS, boardOf } from './lessons.js';
import { CAMPAIGN } from './campaign.js';
import { dailyPuzzle, puzzleGame, PUZZLE_TEXT } from './puzzles.js';
import { UNLOCKS, unlocked } from './unlocks.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3;
const SIDE = { H: 'hare', D: 'hounds' };
const same = (a, b) => a.to === b.to && a.from === b.from;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(), human: 'D', two: false, level: 1, marks: true, sound: true, calm: false,
    look: { board: 'autumn', set: 'wild', big: false },     // cosmetics and message size (unlocked by wins, see UNLOCKS)
    cursor: 5, kb: false,                                    // keyboard play: which point the cursor is on, and whether to show it
    sel: -1, anim: null, msg: null, think: 0, thinking: false, undo: [], hintsLeft: HINTS_PER_GAME, hint: null,
    stats: { games: 0, wins: 0, badges: {}, camp: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null,                                   // { i, done }
    rulesPage: 0, textScaleIdx: 0,                   // index into TEXT_SCALES; the Rules reference page's text size
    pz: null,                                       // { status: 'making' | 'ready' | 'solved', puzzle, n, tries, wrong }
    camp: -1, result: null,                         // the campaign level being played, and the result shown on the last screen
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 },
    dev: config.dev === true,
  };
  let hintThinker = null;

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.look = { ...state.look, ...(v.look || {}) }; state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) }, camp: { ...(v.camp || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, marks: state.marks, sound: state.sound, calm: state.calm, look: state.look, textScaleIdx: state.textScaleIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.game.winner) { state.saved = { game: clone(state.game), human: state.human, two: state.two, level: state.level, hintsLeft: state.hintsLeft, camp: state.camp }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  // Reduced motion (title toggle): quicker moves, no shudder, no bobbing, steady glows.
  // A refused move must still be CLEAR: the piece still travels toward the point and comes back.
  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  // a soft "pat" of paws: a short round sine that drops in pitch
  const pat = (f = 420) => tone({ freq: f * 0.8, to: f * 0.4, dur: 0.06, type: 'sine', vol: 0.11 });
  const reset = (extra) => Object.assign(state, { sel: -1, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, result: null }, extra);
  const demoBlocked = () => {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return true; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    return false;
  };

  function start(human, two) {
    if (demoBlocked()) return;
    hintThinker = null;
    reset({ scene: 'play', game: newGame(), human, two, camp: -1 });
    if (!two && human === 'H' && state.level === 3) say('Master hounds never slip: no hare can win from the start. Last as long as you can.', 7);
    else say(two ? 'The hounds begin: tap a hound, then tap where it should go.' : human === 'D' ? 'You are the hounds. Tap a hound, then tap where it should go.' : 'You are the hare. The hounds move first.');
    if (!two && human === 'H') state.think = 0.45;
    monetization.track('game_start', { side: two ? 'two' : human, level: state.level });
  }
  function startCampaign(i) {
    if (demoBlocked()) return;
    const c = CAMPAIGN[i], g = newGame(c.limit);
    g.board = boardOf(c.board); g.turn = c.turn;
    hintThinker = null;
    reset({ scene: 'play', game: g, human: c.side, two: false, level: c.opp, camp: i });
    say(c.note, 6);
    if (c.turn !== c.side) state.think = 0.45;
    monetization.track('campaign_start', { level: i + 1 });
  }
  function resume() {
    const v = state.saved; hintThinker = null;
    reset({ scene: 'play', game: clone(v.game), human: v.human, two: v.two, level: v.level ?? state.level, camp: v.camp ?? -1, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME });
    say('Game restored.');
    if (!(state.two || state.game.turn === state.human)) state.think = 0.45;
  }
  function startLesson(i) {
    const l = LESSONS[i], g = newGame(l.limit ?? DEFAULT_LIMIT);
    g.board = boardOf(l.board); g.turn = l.turn; g.hm = l.hm ?? 0;
    hintThinker = null;
    reset({ scene: 'lesson', game: g, human: l.turn, two: true, lesson: { i, done: false }, camp: -1 });
  }
  function startPuzzle() {
    hintThinker = null;
    const tries = state.pz?.tries ?? 0, pz = dailyPuzzle(state.daily.day);
    reset({ scene: 'puzzle', game: puzzleGame(pz), human: PUZZLE_TEXT[pz.type].side, two: false, camp: -1, pz: { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', puzzle: pz, n: pz.n, tries, wrong: 0 } });
  }

  const humanTurn = () => !state.game.winner && (state.two || state.game.turn === state.human);

  // Animate a legal move and apply it to the rule book.
  function play(m) {
    const g = state.game;
    state.anim = { type: 'move', kind: g.board[m.from], from: m.from, to: m.to, t: 0, dur: dur(g.board[m.from] === 'H' ? 0.3 : 0.26) };
    applyMove(g, m); state.sel = -1; state.hint = null;
    pat(g.board[m.to] === 'H' ? 560 : 400);
  }
  // An illegal move: the piece tries, fails and returns, and the player is told why.
  function refuse(from, to, why) {
    state.anim = { type: 'refuse', kind: state.game.board[from], from, to, t: 0, dur: dur(0.62) };
    state.sel = -1; say(why);
    tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
    if (state.scene === 'lesson' && LESSONS[state.lesson.i].want === 'refused' && from !== to) state.lesson.done = true;
  }

  // What a tap on board point i means. Returns the legal move that was chosen, or null.
  function tapBoard(i) {
    const g = state.game, me = g.turn, there = g.board[i];
    if (state.sel < 0) {
      if (there === me) { state.sel = i; pat(600); }
      else if (there) say(me === 'D' ? "It is the hounds' turn. Tap one of the hounds." : "It is the hare's turn. Tap the hare.");
      else say(`First tap the ${me === 'D' ? 'hound' : 'hare'} you want to move, then tap where it should go.`);
      return null;
    }
    if (i === state.sel) { state.sel = -1; return null; }
    if (there === me) { state.sel = i; pat(600); return null; }          // changed their mind: pick another piece
    const r = tryMove(g, state.sel, i);
    if (r.move) return r.move;
    refuse(state.sel, i, r.error); return null;
  }

  function finish() {
    const g = state.game, human = !state.two && g.winner === state.human;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    state.result = null;
    if (human) { state.stats.wins += 1; if (state.camp < 0) state.stats.badges[state.human + state.level] = true; }
    if (state.camp >= 0) {
      const c = CAMPAIGN[state.camp], slipped = g.reason.startsWith('The hare slipped');
      const stars = !human ? 0 : c.side === 'D' ? (g.hm <= c.par ? 3 : g.hm <= c.par + 2 ? 2 : 1) : slipped ? (g.hm <= c.par ? 3 : 2) : 1;
      if (stars > (state.stats.camp[state.camp] || 0)) state.stats.camp[state.camp] = stars;
      state.result = { stars, note: !human ? '' : c.side === 'D' ? `Par: ${c.par} moves` : `Par: ${c.par} moves to slip past` };
    } else if (!state.two && state.human === 'H' && state.level === 3 && g.winner === 'D') {
      state.result = { stars: 0, note: g.hm >= 12 ? '★ You lasted as long as perfect hounds allow.' : 'Perfect hounds need 12 moves: try to last longer.' };
      if (g.hm >= 12) state.stats.badges.S3 = true;
    } else if (human) state.result = { stars: 0, note: `★ ${LEVELS[state.level].name} beaten as the ${SIDE[state.human]}` };
    storage.set('stats', state.stats);
    tone({ freq: 523, to: human ? 784 : 392, dur: 0.4, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
  }

  // ---- per-scene updates ----------------------------------------------------------------------------------
  function updateTitle(tap) {
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.campaign)) state.scene = 'campaign';
    else if (hit(R.hare)) start('H', false);
    else if (hit(R.hound)) start('D', false);
    else if (hit(R.two)) start('D', true);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); pat(); }
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); pat(); }
    else if (hit(R.marks)) { state.marks = !state.marks; savePrefs(); pat(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); pat(); }
    else if (hit(R.look)) state.scene = 'look';
    else if (hit(R.rules)) { state.rulesPage = 0; state.scene = 'rules'; }
  }

  function updateRules(tap) {
    if (!tap) return;
    if (inRect(RULES_NAV.back, tap.x, tap.y)) { state.scene = 'title'; pat(); }
    else if (inRect(RULES_NAV.next, tap.x, tap.y)) { state.rulesPage = (state.rulesPage + 1) % RULES.length; pat(); }
    else if (inRect(RULES_HEADER.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); pat(); }
    else if (inRect(RULES_HEADER.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); pat(); }
  }
  const campaignOpen = (i) => i === 0 || (state.stats.camp[i - 1] || 0) > 0 || state.dev;
  function updateCampaign(tap) {
    if (!tap) return;
    if (inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    CAMPAIGN.forEach((c, i) => { if (inRect(TILE(i), tap.x, tap.y)) { if (campaignOpen(i)) startCampaign(i); else say('Win the level before it to open this one.', 3); } });
  }

  function updatePlay(dt, tap) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 4) state.hint = null; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t >= state.anim.dur) { state.anim = null; if (state.game.winner) finish(); else { saveGame(); if (!humanTurn()) state.think = 0.45; } }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; state.msg = null; state.thinking = false; return; }
    if (!humanTurn()) {                                                       // the computer answers after a short think
      state.think -= dt;
      if (state.think > 0) return;
      state.thinking = false;
      const m = chooseMove(state.game, state.level, rng);
      if (m) play(m);
      return;
    }
    if (tap && inRect(BTN.undo, tap.x, tap.y)) {
      // the stack holds the position before each HUMAN move, so one pop also takes back the computer's reply
      if (state.undo.length) { state.game = state.undo.pop(); state.sel = -1; state.hint = null; say('Move taken back.'); pat(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; const m = bestMove(state.game, rng); state.sel = -1; if (m) { state.hint = { from: m.from, to: m.to, t: 0 }; say('Hint: move the glowing piece to the glowing point.'); } }
      return;
    }
    if (!tap) return;
    const i = pointNear(tap.x, tap.y);
    if (i < 0) { state.sel = -1; return; }
    const m = tapBoard(i);
    if (m) { state.undo.push(clone(state.game)); play(m); }
  }

  function updateLesson(dt, tap) {
    const L = state.lesson, l = LESSONS[L.i];
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) state.anim = null; return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try the hounds against the Easy computer.', 7); }
      }
      return;
    }
    if (!tap) return;
    const i = pointNear(tap.x, tap.y);
    if (i < 0) { state.sel = -1; return; }
    const m = tapBoard(i);
    if (!m) return;
    const after = applyMove(clone(state.game), m);
    const kindOk = l.want === 'step' ? true : l.want === 'win' ? after.winner === l.turn : false;
    const ok = kindOk && (!l.at || l.at.includes(m.to));
    if (ok) { play(m); state.game.winner = null; L.done = true; tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); }
    else { state.sel = -1; say(l.hint ?? (l.want === 'win' ? 'That is not the winning move. Look at the open point.' : l.want === 'refused' ? 'That move is allowed. Try the point right behind the hound.' : 'Not that one. Read the line above and try again.')); }
  }

  function updatePuzzle(dt, tap) {
    const P = state.pz;
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t < state.anim.dur) return;
      state.anim = null;
      const g = state.game, side = PUZZLE_TEXT[P.puzzle.type].side;
      if (P.wrong > 0) return;                                               // wait, then the position is set up again
      if (g.winner === side) {
        P.status = 'solved'; g.winner = null;
        if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
        say('Solved!', 6); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
      } else if (g.turn !== side && !g.winner) { const reply = bestMove(g, rng); if (reply) play(reply); }
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); P.n = P.puzzle.n; P.wrong = 0; say('Set up again. Look for the move that leaves no escape.'); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Hare and Hounds daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (!tap) return;
    const i = pointNear(tap.x, tap.y);
    if (i < 0) { state.sel = -1; return; }
    const m = tapBoard(i);
    if (!m) return;
    const good = forcingMoves(state.game, P.puzzle.type, P.n) || [];
    play(m);
    if (good.some((x) => same(x, m))) P.n -= 1;
    else { P.tries += 1; P.wrong = 1.4; say(P.puzzle.type === 'trap' ? 'That lets the hare escape.' : 'That lets the hounds close the net.'); }
  }

  function updateLook(tap) {
    if (!tap) return;
    const pick = (group, key, set) => { if (unlocked(state, group, key)) { state.look[set] = key; savePrefs(); pat(); } else say(UNLOCKS[group][key].need + ' Then it is yours.', 4); };
    const B3 = ['autumn', 'winter', 'night'], S2 = ['wild', 'snow'];
    LOOK.boards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) pick('board', B3[i], 'board'); });
    LOOK.sets.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) pick('set', S2[i], 'set'); });
    LOOK.text.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.look.big = i === 1; savePrefs(); pat(); } });
    if (inRect(LOOK.back, tap.x, tap.y)) state.scene = 'title';
  }

  function updateOver(tap) {
    if (!tap) return;
    const g = state.game, won = !state.two && g.winner === state.human, hasNext = state.camp >= 0 && state.camp + 1 < CAMPAIGN.length;
    for (const b of overButtons(state.camp, won, hasNext)) {
      if (!inRect(b.rect, tap.x, tap.y)) continue;
      if (b.id === 'next') startCampaign(state.camp + 1);
      else if (b.id === 'again') { if (state.camp >= 0) startCampaign(state.camp); else start(state.human, state.two); }
      else if (b.id === 'levels') state.scene = 'campaign';
      else state.scene = 'title';
    }
  }

  // Keyboard (web demo): arrows move a cursor over the board, Space or Enter is a tap on that point, Escape is Menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return { key: 'start' }; return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.again.x + 5, y: BTN.again.y + 5 }; return null; }
    if (sc === 'look') { if (k.has('Escape')) return { x: LOOK.back.x + 5, y: LOOK.back.y + 5 }; return null; }
    if (sc === 'rules') { if (k.has('Escape')) return { x: RULES_NAV.back.x + 5, y: RULES_NAV.back.y + 5 }; return null; }
    if (sc === 'campaign') { if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) {                                            // the nearest point in that direction on the screen
      state.kb = true; const c = pointAt(state.cursor); let best = -1, bs = Infinity;
      for (let j = 0; j < 11; j++) { if (j === state.cursor) continue; const p = pointAt(j), along = (p.x - c.x) * dx + (p.y - c.y) * dy, perp = Math.abs((p.x - c.x) * dy) + Math.abs((p.y - c.y) * dx); if (along > 20 && along + perp * 1.5 < bs) { bs = along + perp * 1.5; best = j; } }
      if (best >= 0) state.cursor = best; return null;
    }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const p = pointAt(state.cursor); return { x: p.x, y: p.y }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      let tap = p.pressed ? { x: p.x, y: p.y } : kbd && kbd.x !== undefined ? kbd : null;
      if (kbd && kbd.key === 'start') tap = { x: titleRows(!!state.saved).hound.x + 5, y: titleRows(!!state.saved).hound.y + 5 };
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'look') updateLook(tap);
      else if (state.scene === 'rules') updateRules(tap);
      else if (state.scene === 'campaign') updateCampaign(tap);
      else if (state.scene === 'play') updatePlay(dt, tap);
      else if (state.scene === 'lesson') updateLesson(dt, tap);
      else if (state.scene === 'puzzle') updatePuzzle(dt, tap);
      else if (state.scene === 'over') updateOver(tap);
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
