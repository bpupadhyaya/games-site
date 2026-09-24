// Scopa: state and flow. Drawing is view.js; the rule book is rules.js; the computer is engine.js; lessons.js and
// puzzles.js are content. The rule book applies a play to `state.g` at once; a short queue of animation steps then
// SHOWS it (card flight, capture, scopa, sweep, deal) while `state.slots`/`hslots` (what is drawn) catch up.
import { W, H, BTN, SET, HAND, inRect, handPos, tableGrid, slotPos, seatPos, deckPos, pilePos, titleRows, CLOTH, TEXT_SCALES, AP_THINK_STEPS } from './layout.js';
import { newMatch, startRound, captures, legalPlays, applyPlay, scoreRound, whyNot, clone, teamOf, rankOf, cardName, RANK_NAMES } from './rules.js';
import { LEVELS, createThinker, hintFor } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './rulesContent.js';
import { CONTROLS } from './controlsContent.js';
import { puzzleFor, puzzleGame, pv, isWeekend } from './puzzles.js';
import { render, tableCardAt } from './view.js';
import { warm } from './art.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3, NODES_PER_TICK = 260;
const SLOTS = 24;
// Auto Play: a whole AI-vs-AI teaching game driven by the SAME engine.js thinker used for the real
// computer opponent, for BOTH seats, in 2-player mode. Maestro (level index 3) gives the strongest,
// most instructive play; sampled hidden-hand search means two Maestro-vs-Maestro games still play
// out differently every time, so there is no risk of a repetitive, fully deterministic replay.
// REVEAL is a fixed pause distinct from the configurable THINK pause.
const AP_LEVEL = 3, AP_REVEAL_TIME = 2, AP_ROUND_PAUSE = 3;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, g: newMatch(2, 11), n: 2, level: 1, sound: true, calm: false, big: false, french: false, target: 11,
    textScaleIdx: 0, // index into TEXT_SCALES; the About/Controls/Rules reference pages' text size
    apThinkIdx: 1, // index into AP_THINK_STEPS; the Auto Play THINK-phase pause, default 5s
    ap: null, // transient Auto Play loop state: { phase: 'run'|'think'|'reveal'|'act', timer, move }
    slots: new Array(SLOTS).fill(null), hslots: [null, null, null], hide: [], fly: [], held: [], glow: [], pileShown: [0, 0], fx: [],
    sel: null, cur: 0, curZone: 'hand', kb: false, msg: null, thinking: false, undo: null, hintsLeft: HINTS, hint: null, ref: null,
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0, lesson: null, pz: null, panel: null,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true, deckShown: 0, seatShown: [0, 0, 0, 0],
  };
  let thinker = null, sched = [], clock = 0, warmN = 0, thinkT = 0, autoT = 0;
  // Screenshot mode (?shot=1, used by `tools/arc shots`): pointer input is ignored and the scene follows the seed.
  const SHOT = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search || '');
  const isAutoplay = () => state.scene === 'autoplay' || state.scene === 'autoplay-over';

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.french = v.french ?? false; state.target = v.target ?? 11; state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); state.apThinkIdx = Math.min(Math.max(v.apThinkIdx ?? 1, 0), AP_THINK_STEPS.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.phase === 'play' && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, french: state.french, target: state.target, textScaleIdx: state.textScaleIdx, apThinkIdx: state.apThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && state.g.phase === 'play') { state.saved = { g: clone(state.g), n: state.n, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };

  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  // Auto Play is silent by design regardless of the player's own sound setting (same principle as
  // the menu's attract-mode preview) - never surprise a viewer with sound from a demo.
  const tone = (o) => { if (state.sound && !isAutoplay()) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f, to: f * 0.6, dur: 0.05, type: 'triangle', vol: 0.1 });
  const swish = () => tone({ freq: 900, to: 380, dur: 0.09, type: 'sine', vol: 0.05 });
  const chime = (k = 0) => tone({ freq: 620 + k * 110, to: 900 + k * 140, dur: 0.24, type: 'sine', vol: 0.09 });
  const dur = (d) => (state.calm ? d * 0.45 : d);
  const busy = () => state.fly.length > 0 || sched.length > 0;

  // ---- scheduling and flying cards ------------------------------------------------------------------------------
  const after = (d, fn) => { sched.push({ at: clock + d, fn }); };
  function fly(card, from, to, d, o = {}) {
    if (card >= 0 && !state.hide.includes(card)) state.hide.push(card);
    state.fly.push({ card, x0: from.x, y0: from.y, x1: to.x, y1: to.y, w0: from.w ?? 118, w1: to.w ?? 118, r0: from.r ?? 0, r1: to.r ?? 0, t: -(o.delay ?? 0), d: dur(d), flip: !!o.flip, arc: o.arc ?? 40, land: o.land || null });
    swish();
  }
  function stepFly(dt) {
    for (let i = state.fly.length - 1; i >= 0; i--) {
      const f = state.fly[i]; f.t += dt;
      if (f.t >= f.d) { state.fly.splice(i, 1); const k = state.hide.indexOf(f.card); if (k >= 0 && !state.fly.some((q) => q.card === f.card)) state.hide.splice(k, 1); if (f.land) f.land(); clack(500 + (f.card % 7) * 20); }
    }
    for (let i = sched.length - 1; i >= 0; i--) { /* run in order below */ }
    const due = sched.filter((s) => s.at <= clock).sort((a, b) => a.at - b.at);
    if (due.length) { sched = sched.filter((s) => s.at > clock); for (const s of due) s.fn(); }
    state.glow = state.glow.filter((g) => (g.t += dt) < g.d);
    state.fx = state.fx.filter((f) => (f.t += dt) < f.d);
  }

  // ---- table slots -----------------------------------------------------------------------------------------------
    const freeSlot = () => { const k = state.slots.indexOf(null); return k < 0 ? 0 : k; };
  const slotOf = (id) => state.slots.indexOf(id);
  function syncAll() {
    const g = state.g; state.hide = []; state.fly = []; sched = []; state.held = []; state.glow = []; state.fx = [];
    state.slots = new Array(SLOTS).fill(null); g.table.forEach((c, i) => { state.slots[i] = c; });
    state.hslots = [null, null, null]; g.hands[0].forEach((c, i) => { state.hslots[i] = c; });
    state.pileShown = [g.piles[0].length, g.piles[1].length]; state.deckShown = g.deck.length; state.seatShown = g.hands.map((h) => h.length); while (state.seatShown.length < 4) state.seatShown.push(0);
    state.sel = null; state.hint = null; state.thinking = false; thinker = null; thinkT = 0;
  }
  const gridNow = () => tableGrid(Math.max(state.slots.filter((x) => x !== null).length + 1, state.g.table.length));
  const posOfSlot = (i) => { const gr = gridNow(); return { ...slotPos(i, gr), w: gr.w }; };
  const seatFrom = (seat) => { const p = seatPos(state.n, seat); return { x: p.x, y: p.y, w: 56, r: 0 }; };
  const pileTo = (team) => (team === 0 ? { ...pilePos, w: 60 } : { x: 70, y: 276, w: 44 });

  // ---- dealing ---------------------------------------------------------------------------------------------------
  function dealAnim(first, cb) {
    const g = state.g; let k = 0;
    if (first) {
      g.table.forEach((c, i) => { state.slots[i] = null; });
      g.table.forEach((c, i) => { const to = { ...posOfSlot(i), w: gridNow().w }; state.hide.push(c); fly(c, { ...deckPos, w: 60, r: 0.3 }, to, 0.4, { delay: k++ * 0.09, flip: true, land: () => { state.slots[i] = c; } }); });
      state.deckShown = 40;
      after(0.1, () => {});
    }
    const seats = []; for (let s = 0; s < g.n; s++) seats.push(s);
    // hands: three cards each, dealt round the table
    for (let r = 0; r < 3; r++) for (const s of seats) {
      const card = g.hands[s][g.hands[s].length - 3 + r];
      const delay = k++ * 0.085;
      if (s === 0) { const hi = state.hslots.indexOf(null); state.hslots[hi] = card; state.hide.push(card); fly(card, { ...deckPos, w: 60 }, { ...handPos(hi), w: HAND.w }, 0.42, { delay, flip: true }); }
      else { state.seatShown[s] = Math.min(3, state.seatShown[s]); const sp = seatPos(state.n, s); fly(-1, { ...deckPos, w: 40 }, { x: sp.x, y: sp.y, w: 56 }, 0.4, { delay, land: () => { state.seatShown[s] += 1; } }); }
    }
    state.deckShown = g.deck.length;
    after(k * 0.085 + 0.6, () => { if (cb) cb(); });
  }
  function newRound() {
    const g = state.g; startRound(g, rng);
    state.slots = new Array(SLOTS).fill(null); state.hslots = [null, null, null]; state.hide = []; state.fly = []; state.held = []; sched = [];
    state.pileShown = [0, 0]; state.seatShown = [0, 0, 0, 0]; state.panel = null; state.sel = null; state.undo = null;
    dealAnim(true, () => { beginTurn(); });
    if (isAutoplay()) say(`Round ${g.round}: watching Player A and Player B play.`, 3);
    else say(`Round ${g.round}: ${state.n === 4 ? 'you and your partner (opposite) against two opponents. ' : ''}TAP a card in your hand.`, 5);
  }

  // ---- starting things ---------------------------------------------------------------------------------------------
  // Auto Play: free, silent, never touches real save/stats (see isPreviewExempt below and
  // finishRound's autoplay branch). Both seats are driven by the real thinker; the loop lives in
  // updateAutoPlay.
  function startAutoPlay() {
    state.n = 2; state.g = newMatch(2, 11); state.g.dealer = 1; state.hintsLeft = HINTS; state.scene = 'autoplay'; state.lesson = null; state.pz = null;
    state.ap = { phase: 'run', timer: 0, move: null };
    newRound();
  }
  function start(n) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    state.n = n; state.g = newMatch(n, state.target); state.g.dealer = n - 1; state.hintsLeft = HINTS; state.scene = 'play'; state.lesson = null; state.pz = null;
    newRound(); monetization.track('game_start', { n, level: state.level });
  }
  function resume() {
    const v = state.saved; state.n = v.n; state.g = clone(v.g); state.level = v.level ?? state.level; state.hintsLeft = v.hintsLeft ?? HINTS; state.scene = 'play';
    syncAll(); say('Game restored.'); beginTurn();
  }
  function startLesson(i) {
    const l = LESSONS[i], g = newMatch(2, 11); g.hands = [l.hand.slice(), []]; g.table = l.table.slice(); g.deck = []; g.turn = 0; g.round = 1;
    if (l.score) { const rest = []; for (let c = 0; c < 40; c++) if (!l.hand.includes(c) && !l.table.includes(c)) rest.push(c); g.piles = [rest.filter((c) => (c % 3 === 0 || c === 6 || c === 19) && c !== 4), []]; g.piles[1] = rest.filter((c) => !g.piles[0].includes(c)); g.scope = [1, 0]; }
    state.n = 2; state.g = g; state.scene = 'lesson'; state.lesson = { i, done: false, tries: 0 }; state.panel = null; state.pz = null;
    syncAll(); state.slots.fill(null); g.table.forEach((c, k) => { state.slots[k] = c; });
    // the lesson's opponent has cards so the seat is not empty
    state.seatShown = [3, 3, 0, 0];
  }
  function startPuzzle() {
    const p = puzzleFor(state.daily.day);
    state.n = 2; state.g = puzzleGame(p); state.scene = 'puzzle'; state.lesson = null; state.panel = null;
    state.pz = { p, status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', tries: 0, wrong: 0 };
    syncAll(); state.seatShown = [3, 3, 0, 0];
    say(p.hard ? 'Weekend deal. Find the most valuable capture.' : 'Find the most valuable capture. TAP a card, then the table cards to take.', 8);
  }

  // ---- taking a turn -----------------------------------------------------------------------------------------------
  const isHuman = () => state.g.turn === 0 && state.g.phase === 'play';
  function beginTurn() {
    const g = state.g; if (g.phase !== 'play') return;
    state.sel = null; state.hint = null; state.cur = 0; state.curZone = 'hand';
    if (g.turn !== 0) { thinkT = state.calm ? 0.35 : 0.7; state.thinking = true; thinker = null; }
    else state.thinking = false;
  }

  // Play a card (any seat): the rule book acts now, the animation shows it, then `then()` continues.
  function playOut(seat, card, take, then) {
    const g = state.g;
    const from = seat === 0 ? { ...handPos(Math.max(0, state.hslots.indexOf(card))), w: HAND.w } : seatFrom(seat);
    const hi = state.hslots.indexOf(card);
    const res = applyPlay(g, seat, card, take);
    const team = teamOf(g, seat);
    state.sel = null; state.hint = null;
    if (seat === 0 && hi >= 0) { state.hslots[hi] = null; state.hide.push(card); }
    if (seat !== 0) state.seatShown[seat] = Math.max(0, state.seatShown[seat] - 1);
    const gw = gridNow();
    let to, freeIdx = -1;
    if (take.length) to = { ...posOfSlot(slotOf(take[0])), w: gw.w };
    else { freeIdx = freeSlot(); state.slots[freeIdx] = null; to = { ...posOfSlot(freeIdx), w: gw.w }; }
    const arriveT = 0.5;
    fly(card, from, to, arriveT, { arc: seat === 0 ? 70 : 50, flip: seat !== 0, land: () => {
      if (!take.length) { state.slots[freeIdx] = card; state.glow.push({ card, t: 0, d: 0.5 }); }
      else state.held.push({ card, x: to.x, y: to.y, w: to.w });
    } });
    const T1 = dur(arriveT) + (take.length ? dur(0.45) : dur(0.25));
    after(dur(arriveT) + 0.001, () => { if (take.length) for (const t of take) state.glow.push({ card: t, t: 0, d: dur(0.5) }); });
    if (take.length) {
      after(T1, () => {
        state.held = state.held.filter((h) => h.card !== card);
        const all = [card, ...take]; let dl = 0;
        const dest = pileTo(team);
        for (const id of all) {
          const si = slotOf(id), src = id === card ? { x: to.x, y: to.y, w: to.w } : { ...posOfSlot(si), w: gw.w };
          if (si >= 0) state.slots[si] = null;
          fly(id, src, dest, 0.5, { delay: dl++ * 0.05, arc: 30, land: () => { state.pileShown[team] += 1; } });
        }
        chime(all.length);
      });
    }
    let tail = T1 + (take.length ? dur(0.5) + all6(take.length) : 0) + 0.05;
    function all6(n) { return (n + 1) * 0.05; }
    if (res.scopa) {
      after(tail, () => { state.fx.push({ kind: 'scopa', t: 0, d: dur(1.2), team }); chime(3); tone({ freq: 400, to: 900, dur: 0.5, type: 'triangle', vol: 0.08 }); });
      tail += dur(1.05);
    }
    if (seat !== 0 || true) after(tail, () => describe(res, seat));
    if (res.swept) {
      after(tail + 0.1, () => {
        const lt = teamOf(g, res.sweptTo), dest = pileTo(lt); let dl = 0;
        for (const id of res.swept) { const si = slotOf(id); const src = { ...posOfSlot(si < 0 ? 0 : si), w: gw.w }; if (si >= 0) state.slots[si] = null; fly(id, src, dest, 0.5, { delay: dl++ * 0.05, land: () => { state.pileShown[lt] += 1; } }); }
      });
      tail += dur(0.5) + (res.swept.length + 1) * 0.05 + 0.15;
    }
    after(tail + 0.05, () => {
      if (res.roundEnd) { finishRound(); return; }
      if (res.dealt) { state.deckShown = g.deck.length; dealAnim(false, then); return; }
      then();
    });
  }
  function describe(res, seat) {
    const who = isAutoplay() ? (seat === 0 ? 'Player A' : 'Player B') : state.scene === 'play' ? (seat === 0 ? 'You' : state.n === 2 ? 'The computer' : seat === 2 ? 'Your partner' : 'An opponent') : 'You';
    const nm = (id) => RANK_NAMES[rankOf(id)];
    if (res.take.length) say(`${who} played the ${nm(res.card)} and took ${res.take.map(nm).join(' + ')}${res.scopa ? ': SCOPA!' : '.'}`, 3.5);
    else say(`${who} laid down the ${cardName(res.card)}.`, 3);
  }
  function afterHuman() { thinkT = 0; afterPlay(); }
  function afterPlay() {
    const g = state.g;
    if (g.phase !== 'play') return;
    beginTurn(); saveGame();
  }
  function finishRound() {
    const g = state.g, s = scoreRound(g); state.panel = 'round';
    if (state.scene === 'lesson') { state.lesson.done = true; chime(2); return; }
    // Auto Play never touches the player's real save/stats/monetization tracking - just pause on
    // the round-summary panel a beat (updateAutoPlay's timer) before the loop continues.
    if (state.scene === 'autoplay') { chime(2); state.ap.timer = AP_ROUND_PAUSE; return; }
    clearSave(); chime(2);
    if (g.phase === 'over') {
      const won = g.winner === 0; state.stats.games += 1; if (won) { state.stats.wins += 1; state.stats.badges[state.n === 4 ? 'P' : 'L' + state.level] = true; } saveStats();
      tone({ freq: won ? 523 : 330, to: won ? 880 : 300, dur: 0.5, type: 'triangle', vol: 0.09 });
      monetization.track('game_end', { winner: g.winner, rounds: g.round, level: state.level });
    }
    void s;
  }

  // The computer thinks a slice per tick, then plays.
  function think(dt) {
    const g = state.g;
    if (busy()) return;
    thinkT -= dt; if (thinkT > 0) return;
    const seat = g.turn;
    if (!thinker) thinker = createThinker(g, state.level, rng, seat);
    const r = thinker.step(NODES_PER_TICK);
    if (r.play) { thinker = null; state.thinking = false; const p = r.play; playOut(seat, p.card, p.take, afterPlay); }
  }

  // Auto Play's own loop: THINK (board sits still, the real engine search runs silently in the
  // background so it's ready the instant the timer elapses) -> REVEAL (fixed pause: the chosen
  // card + its capture glow via the SAME state.sel/state.hint highlight code a human's own turn and
  // the real Hint button already use) -> ACT (the real playOut()/applyPlay() path - reuses busy()
  // to animate and call back into 'run' when done) -> loops, for whichever seat's turn it is.
  // Exit/think-time controls always take the tap first; the round-summary panel auto-advances on
  // its own timer instead of waiting for a tap.
  function updateAutoPlay(dt, tap) {
    const g = state.g, AP = state.ap;
    if (tap && inRect(BTN.apExit, tap.x, tap.y)) { thinker = null; sched = []; state.fly = []; state.panel = null; state.hint = null; state.sel = null; state.scene = 'title'; return; }
    if (tap && inRect(BTN.apDec, tap.x, tap.y) && state.apThinkIdx > 0) { state.apThinkIdx--; savePrefs(); clack(); return; }
    if (tap && inRect(BTN.apInc, tap.x, tap.y) && state.apThinkIdx < AP_THINK_STEPS.length - 1) { state.apThinkIdx++; savePrefs(); clack(); return; }
    if (state.panel === 'round') {
      AP.timer -= dt;
      if (AP.timer <= 0) { state.panel = null; AP.phase = 'run'; AP.move = null; if (g.phase === 'over') state.scene = 'autoplay-over'; else newRound(); }
      return;
    }
    if (busy() || g.phase !== 'play') return;
    if (AP.phase === 'think') {
      AP.timer -= dt;
      if (AP.timer <= 0) { AP.phase = 'reveal'; AP.timer = AP_REVEAL_TIME; state.hint = { card: AP.move.card, take: AP.move.take, t: 0 }; state.sel = { card: AP.move.card, take: [] }; }
      return;
    }
    if (AP.phase === 'reveal') {
      AP.timer -= dt;
      if (AP.timer <= 0) { const m = AP.move, seat = g.turn; AP.move = null; AP.phase = 'act'; playOut(seat, m.card, m.take, () => { AP.phase = 'run'; }); }
      return;
    }
    if (AP.phase === 'act') return; // waiting for playOut's callback (or finishRound) to move on
    // AP.phase === 'run': think silently via the real engine, for whichever seat's turn it is
    const seat = g.turn;
    if (!thinker) thinker = createThinker(g, AP_LEVEL, rng, seat);
    const r = thinker.step(NODES_PER_TICK);
    if (r.play) { thinker = null; AP.move = r.play; AP.phase = 'think'; AP.timer = AP_THINK_STEPS[state.apThinkIdx]; }
  }

  // ---- player input on the cards -----------------------------------------------------------------------------------
  const key = (a) => a.slice().sort((x, y) => x - y).join(',');
  const refuse = (id, text) => { state.ref = { card: id, t: 0 }; say(text, 6); tone({ freq: 190, to: 130, dur: 0.15, type: 'triangle', vol: 0.06 }); };
  function selectCard(c) {
    const g = state.g, caps = captures(g.table, c);
    state.sel = { card: c, take: [] }; state.hint = null; clack(560);
    const r = rankOf(c), same = g.table.filter((t) => rankOf(t) === r);
    if (!caps.length) say(`No capture with the ${RANK_NAMES[r]}. TAP it again to lay it on the table.`, 5);
    else if (same.length > 1) say(`Two matching ${RANK_NAMES[r]}s: TAP the one you want to take.`, 5);
    else if (same.length === 1) say(`A matching ${RANK_NAMES[r]}: TAP it (or TAP your card again) to take it.`, 5);
    else say(`The ${RANK_NAMES[r]} can take cards adding up to ${r}. TAP the table cards to take.`, 5);
  }
  // Is `take` a legal capture, or can it still grow into one?
  function tryCommit(card, take, act) { act(card, take); }
  function tapHand(i, act) {
    const g = state.g, c = state.hslots[i]; if (c === null || !g.hands[0].includes(c)) return;
    if (state.sel && state.sel.card === c) {
      const caps = captures(g.table, c);
      if (!caps.length) return act(c, []);
      if (caps.length === 1) return act(c, caps[0]);
      if (state.sel.take.length) { const w = whyNot(g, c, state.sel.take); if (w) refuse(c, w); return; }
      say('Several captures are possible: TAP the table cards you want to take.', 5); return;
    }
    selectCard(c);
  }
  function tapTable(t, act) {
    const g = state.g, S = state.sel;
    if (!S) { say('First TAP a card in your hand, then the table cards you want to take.', 4); return; }
    const r = rankOf(S.card), caps = captures(g.table, S.card);
    if (S.take.includes(t)) { S.take = S.take.filter((x) => x !== t); clack(380); return; }
    const take = S.take.concat([t]), sum = take.reduce((a, x) => a + rankOf(x), 0);
    const same = g.table.filter((x) => rankOf(x) === r);
    if (same.length && rankOf(t) !== r) return refuse(t, `A ${RANK_NAMES[r]} is on the table, so you must take a matching ${RANK_NAMES[r]} on its own. TAP the ${RANK_NAMES[r]}.`);
    if (!caps.length) return refuse(t, `Nothing on the table adds up to ${r}. TAP your card again to lay it down.`);
    if (caps.some((c) => key(c) === key(take))) { S.take = take; return act(S.card, take); }
    if (!caps.some((c) => take.every((x) => c.includes(x)))) return refuse(t, sum > r ? `That adds up to ${sum}, more than ${r}.` : `The ${RANK_NAMES[rankOf(t)]} does not fit: no set of table cards with it adds up to ${r}.`);
    S.take = take; clack(500); say(`${sum} of ${r} so far. Keep TAPPING table cards.`, 3);
  }
  function tapEmptyTable(act) {
    const S = state.sel; if (!S) return;
    const caps = captures(state.g.table, S.card);
    if (!caps.length) act(S.card, []); else say('You can capture, so you must: TAP the highlighted table cards.', 4);
  }

  // Human plays in the real game.
  function actPlay(card, take) {
    state.undo = { g: clone(state.g), n: state.n }; state.thinking = false;
    playOut(0, card, take, afterPlay);
  }
  function doUndo() {
    if (!state.undo || busy()) { say(state.undo ? 'Wait for the cards to settle.' : 'Nothing to take back yet.'); return; }
    state.g = state.undo.g; state.undo = null; syncAll(); state.panel = null; say('Your last play was taken back.'); clack(340); beginTurn(); saveGame();
  }
  function doHint() {
    if (state.hintsLeft <= 0) { say('No hints left in this game.'); return; }
    state.hintsLeft -= 1; const h = hintFor(state.g, 0, rng);
    state.hint = { card: h.play.card, take: h.play.take, t: 0 }; state.sel = { card: h.play.card, take: [] };
    say(`Hint: play the glowing card${h.play.take.length ? ' and take the glowing table cards' : ''}: ${h.why}`, 8);
  }

  // Lessons and puzzle share the same tapping; only what a finished play means differs.
  function actLesson(card, take) {
    const L = state.lesson, l = LESSONS[L.i];
    const ok = l.want.some((w) => w.card === card && key(w.take) === key(take));
    if (!ok) { L.tries += 1; state.sel = null; refuse(card, (l.hint ?? 'That is legal, but not the play this lesson teaches.') + ' Try again.'); return; }
    playOut(0, card, take, () => {
      L.done = true; say(l.done, 14); chime(2);
    });
  }
  function actPuzzle(card, take) {
    const P = state.pz, g = state.g, v = pv(g, { card, take }), best = P.p.value;
    const good = card === P.p.best.card && key(take) === key(P.p.best.take);
    if (good) {
      P.status = 'solved';
      if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
      const gg = clone(g); playOut(0, card, take, () => { say(`Solved! That play is worth ${best} points, the most of any play.`, 12); chime(3); }); void gg;
    } else {
      P.tries += 1; state.sel = null;
      say(`That play is worth ${v}. There is a play worth more. Look for coins, 7s and the sette bello.`, 6); refuse(card, `That play is worth ${v}. Another play is worth more. Try again.`);
    }
  }
  const actFor = () => (state.scene === 'play' ? actPlay : state.scene === 'lesson' ? actLesson : actPuzzle);

  // ---- menus ---------------------------------------------------------------------------------------------------
  function updateTitle(tap) {
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(2);
    else if (hit(R.four)) start(4);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.autoplay)) startAutoPlay();
    else if (hit(R.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(R.controls)) { state.scene = 'controls'; state.page = 0; }
    else if (hit(R.rules)) { state.scene = 'rules'; state.page = 0; }
    else if (hit(R.settings)) state.scene = 'settings';
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(SET.level, tap.x, tap.y)) state.level = (state.level + 1) % LEVELS.length;
    else if (inRect(SET.sound, tap.x, tap.y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); }
    else if (inRect(SET.calm, tap.x, tap.y)) state.calm = !state.calm;
    else if (inRect(SET.big, tap.x, tap.y)) state.big = !state.big;
    else if (inRect(SET.deck, tap.x, tap.y)) state.french = !state.french;
    else if (inRect(SET.target, tap.x, tap.y)) state.target = state.target === 11 ? 21 : 11;
    else if (inRect(SET.back, tap.x, tap.y)) { state.scene = 'title'; savePrefs(); return; }
    else return;
    clack(); savePrefs();
  }

  // The playing screens: taps on hand cards, table cards, buttons.
  function updateBoard(dt, tap) {
    const sc = state.scene, g = state.g;
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 9) state.hint = null; }
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (state.panel === 'round') {
      if (tap && inRect(BTN.cont, tap.x, tap.y)) {
        if (sc === 'lesson') { state.panel = null; L_next(); return; }
        if (g.phase === 'over') { state.panel = null; state.scene = 'over'; return; }
        newRound();
      }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { if (sc === 'play') saveGame(); state.scene = 'title'; thinker = null; state.thinking = false; sched = []; state.fly = []; return; }
    if (sc === 'lesson' && state.lesson.done && !busy()) { if (tap && inRect(BTN.next, tap.x, tap.y)) L_next(); return; }
    if (sc === 'puzzle' && state.pz.status === 'solved' && !busy()) { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Scopa daily deal: solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (sc === 'play' && !isHuman()) { if (!busy() || true) think(dt); }
    if (busy() || !tap) return;
    if (sc === 'play' && !isHuman()) return;
    if (sc === 'play' && tap && inRect(BTN.undo, tap.x, tap.y)) { doUndo(); return; }
    if (sc === 'play' && tap && inRect(BTN.hint, tap.x, tap.y)) { doHint(); return; }
    const act = actFor();
    // hand cards (a selected card is drawn lifted, so hit the lifted rectangle too)
    for (let i = 0; i < 3; i++) {
      const p = handPos(i), lift = state.sel && state.sel.card === state.hslots[i] ? HAND.lift : 0;
      if (state.hslots[i] !== null && Math.abs(tap.x - p.x) <= HAND.w / 2 + 6 && tap.y >= p.y - HAND.h / 2 - lift && tap.y <= p.y + HAND.h / 2 - lift + 4) { tapHand(i, act); return; }
    }
    const t = tableCardAt(state, tap.x, tap.y);
    if (t !== null) { tapTable(t, act); return; }
    if (tap.y > CLOTH.y && tap.y < CLOTH.y + CLOTH.h) tapEmptyTable(act);
  }
  function L_next() {
    const L = state.lesson;
    if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
    else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know Scopa. Try a game against the computer.', 7); }
  }

  // Keyboard: 1-3 pick a card, Left/Right move the green cursor along the table cards, Enter toggles the card under the
  // cursor, Space plays (takes the selection / lays the card down), H hint, U undo, Esc menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { const R = titleRows(!!state.saved); if (k.has('Enter') || k.has('Space')) return at(R.resume || R.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(BTN.again); if (k.has('Escape')) return at(BTN.back); return null; }
    if (sc === 'settings') { if (k.has('Escape')) return at(SET.back); return null; }
    if (sc === 'about' || sc === 'controls' || sc === 'rules') { if (k.has('Escape')) return at(BTN.pageBack); if (k.has('Enter')) return at(BTN.pageNext); return null; }
    if (sc === 'autoplay') { if (k.has('Escape')) return at(BTN.apExit); return null; }
    if (sc === 'autoplay-over') { if (k.has('Enter') || k.has('Space')) return at(BTN.again); if (k.has('Escape')) return at(BTN.back); return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (state.panel === 'round') { if (k.has('Enter') || k.has('Space')) return at(BTN.cont); return null; }
    if (k.has('Escape')) return at(BTN.menu);
    if (k.has('KeyU')) return at(BTN.undo);
    if (k.has('KeyH')) return at(BTN.hint);
    if (sc === 'lesson' && state.lesson.done && (k.has('Enter') || k.has('Space'))) return at(BTN.next);
    if (busy()) return null;
    for (let i = 0; i < 3; i++) if (k.has('Digit' + (i + 1)) || k.has('Numpad' + (i + 1))) { state.kb = true; const p = handPos(i); return { x: p.x, y: p.y }; }
    const cards = state.slots.map((c, i) => (c === null ? null : i)).filter((x) => x !== null);
    if (k.has('ArrowLeft') || k.has('ArrowRight')) { state.kb = true; state.curZone = 'table'; const d = k.has('ArrowRight') ? 1 : -1; state.cur = (state.cur + d + Math.max(1, cards.length)) % Math.max(1, cards.length); return null; }
    if (k.has('Enter') && state.sel && cards.length) { state.kb = true; const si = cards[state.cur % cards.length], p = slotPos(si, gridNow()); return { x: p.x, y: p.y }; }
    if (k.has('Space') && state.sel) { const S = state.sel, caps = captures(state.g.table, S.card); if (!caps.length) return { x: 360, y: CLOTH.y + 6 }; if (caps.length === 1 || S.take.length) { const p = handPos(state.hslots.indexOf(S.card)); return { x: p.x, y: p.y }; } }
    return null;
  }

  function shotInit() {
    const sd = (config.seed ?? 1) % 8;
    if (sd === 2 || sd === 5) { state.level = 3; start(2); }
    else if (sd === 3) { state.level = 3; start(4); }
    else if (sd === 4) { startLesson(5); state.sel = { card: state.g.hands[0][0], take: [] }; }
    else if (sd === 6) startPuzzle();
    else if (sd === 7) state.scene = 'about';
    else if (sd === 0) state.scene = 'settings';
  }
  if (SHOT) after(0.001, shotInit);

  return {
    update(dt, input) {
      state.t += dt; clock += dt;
      if (warmN < 40 && typeof OffscreenCanvas !== 'undefined') warmN = warm(warmN, state.french);
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      stepFly(dt);
      const p = input.pointer, kbd = keyboard(input);
      let tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (SHOT) { tap = null; if (state.scene === 'play' && isHuman() && !busy() && state.panel === null) { autoT += dt; if (autoT > 0.9) { autoT = 0; const h = hintFor(state.g, 0, rng).play; actPlay(h.card, h.take); } } else if (state.panel === 'round' && state.scene === 'play' && (config.seed ?? 1) % 8 === 5) { /* hold the score panel */ } }
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'about' || sc === 'controls' || sc === 'rules') {
        const list = sc === 'about' ? ABOUT : sc === 'rules' ? RULES : CONTROLS;
        // Back steps to the previous page, or exits to the title from page 1 (owner-reported bug,
        // 2026-09-23: Back used to always jump straight to the title, discarding whatever page you
        // were reading).
        if (tap && inRect(BTN.pageBack, tap.x, tap.y)) {
          if (state.page > 0) state.page -= 1; else state.scene = 'title';
        }
        // On the last page the button reads "Done" (view.js) and exits to the title instead of
        // silently wrapping back to page one, so it's never a dead-end tap.
        else if (tap && inRect(BTN.pageNext, tap.x, tap.y)) {
          if (state.page === list.length - 1) { state.scene = 'title'; state.page = 0; } else state.page++;
        }
        else if (tap && inRect(BTN.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); }
        else if (tap && inRect(BTN.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); }
      }
      else if (sc === 'play' || sc === 'lesson' || sc === 'puzzle') updateBoard(dt, tap);
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.n);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
      else if (sc === 'autoplay') updateAutoPlay(dt, tap);
      else if (sc === 'autoplay-over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) startAutoPlay();
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state, { warmFrench: () => {} }); },
    getState: () => state,
    // Auto Play is a free teaching demo, not real play: exempt from the kit's whole-app
    // free-preview timer the same way the menu's own attract-mode preview would be.
    isPreviewExempt: () => isAutoplay(),
  };
}
export { isWeekend };
