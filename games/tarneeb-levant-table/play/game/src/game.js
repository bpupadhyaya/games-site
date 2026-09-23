// Tarneeb: state and flow. Rules are in rules.js, the computer players in ai.js, drawing in view.js and art.js,
// lessons.js and puzzles.js are content. See design/GDD.md for the ruleset.
//
// Playing a card: TAP a card (it lifts), TAP it again, or DRAG it up onto the table. Illegal cards are refused with a reason.
import { W, H as HEIGHT, BTN, BID, SLOT, SEAT, HAND_Y, handLayout, cardAt, inRect, titleRows, LESSON_ROWS, LESSONS_BACK, ABOUT_BACK, RULES_BACK, RULES_NEXT } from './layout.js';
import { deal, bidAction, setTrump, playCard, legalPlays, canBid, whyNotBid, whyIllegal, scoreHand, matchWinner, cloneHand, cardName, SEAT_NAMES, SUIT_NAMES } from './rules.js';
import { chooseBid, chooseTrump, pickCard, createThinker } from './ai.js';
import { LESSONS } from './lessons.js';
import { RULES } from './rules-content.js';
import { puzzleFor, puzzleHand, puzzleText, createPuzzleBrain } from './puzzles.js';
import { render } from './view.js';

export const meta = { width: W, height: HEIGHT };
const DEMO_MATCHES = 2, HINTS_PER_MATCH = 5, DEAL_TIME = 52 * 0.028 + 0.35;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, page: 0, level: 2, sound: true, calm: false, big: false, target: 31, back: 'garnet',
    stats: { played: 0, wins: 0, hands: 0, maxLevel: 2 }, learned: LESSONS.map(() => false), learnedAll: false,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, demoMatches: 0, saved: null,
    tb: null, lesson: null, puz: null, puzText: '', puzTarget: 0, dev: config.dev === true,
  };
  let thinker = null, brain = null, pz = null;

  // ---- saved data ----------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 2; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.target = v.target ?? 31; state.back = v.back ?? 'garnet'; audio.setMuted?.(!state.sound); } });
  storage.get('progress', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('learned', null).then((v) => { if (Array.isArray(v)) { state.learned = LESSONS.map((_, i) => !!v[i]); state.learnedAll = state.learned.every(Boolean); } });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  storage.get('save', null).then((v) => { if (v && v.H && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, target: state.target, back: state.back });
  const saveProgress = () => storage.set('progress', state.stats);
  const saveMatch = () => { const tb = state.tb; if (tb && tb.mode === 'play' && !tb.over) { state.saved = { H: cloneHand(tb.H), scores: tb.scores.slice(), dealer: tb.dealer, handNo: tb.handNo, level: tb.level, target: tb.target, hintsLeft: tb.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const tone = (o) => { if (state.sound) audio.tone(o); };
  const thock = () => tone({ freq: 210, to: 90, dur: 0.07, type: 'triangle', vol: 0.13 });
  const flick = () => tone({ freq: 1100, to: 600, dur: 0.03, type: 'sine', vol: 0.04 });
  const chime = (f = 660) => { tone({ freq: f, dur: 0.18, type: 'sine', vol: 0.09 }); tone({ freq: f * 1.5, dur: 0.3, type: 'sine', vol: 0.06 }); };
  const say = (text, hold = 4.2) => { if (state.tb) state.tb.msg = { text, t: 0, hold }; };

  // ---- building a table ----------------------------------------------------------------------------------------
  function newTable(mode, H, extra = {}) {
    thinker = null;
    return Object.assign({ mode, H, scores: [0, 0], target: state.target, dealer: H.dealer, handNo: 1, level: state.level, sel: -1, drag: null, flights: [], collect: null, deal: null, wait: 0, msg: null, hint: null, hintsLeft: HINTS_PER_MATCH, undo: [], summary: null, over: null, blocked: false, leaving: false, lessonMsg: '', shake: null, redealIn: 0, coachKey: '', kb: -1, auto: false }, extra);
  }
  function beginHand(dealer) {
    const tb = state.tb; thinker = null;
    tb.H = deal(rng, dealer); tb.dealer = dealer; tb.sel = -1; tb.hint = null; tb.undo = []; tb.summary = null; tb.flights = []; tb.collect = null; tb.wait = 0; tb.redealIn = 0; tb.kb = -1;
    tb.deal = state.calm ? null : { t: 0, tick: 0 };
    const first = SEAT_NAMES[(dealer + 1) % 4];
    say(`Hand ${tb.handNo}. ${first === 'You' ? 'You bid first.' : first + ' bids first.'}`, 3);
    saveMatch();
  }
  function startMatch() {
    if (config.demo && state.demoMatches >= DEMO_MATCHES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoMatches += 1; storage.set('demoMatches', state.demoMatches); }
    const dealer = rng.int(4);
    state.tb = newTable('play', deal(rng, dealer));
    state.scene = 'table'; beginHand(dealer);
    monetization.track('match_start', { level: state.level });
  }
  function resume() {
    const v = state.saved; state.tb = newTable('play', v.H, { scores: v.scores.slice(), dealer: v.dealer, handNo: v.handNo, level: v.level, target: v.target, hintsLeft: v.hintsLeft });
    state.scene = 'table'; say('Match restored.', 3);
  }
  function startLesson(i) {
    const L = LESSONS[i], H = L.setup ? L.setup() : deal(rng, 3);
    state.tb = newTable('lesson', H, { hintsLeft: 99, coach: !L.setup, level: 3 });
    state.lesson = { i, state: 'play' }; state.scene = 'table';
  }
  function startPuzzle(auto = false) {
    pz = puzzleFor(state.daily.day); brain = createPuzzleBrain(pz);
    state.tb = newTable('puzzle', puzzleHand(pz), { hintsLeft: 3, auto });
    state.puz = { state: 'play' }; state.puzText = puzzleText(pz); state.puzTarget = pz.target; state.scene = 'table';
  }
  const goTitle = () => { state.scene = 'title'; state.tb = null; thinker = null; };

  // ---- events (lessons watch these) ----------------------------------------------------------------------------
  function markLearned(i) { state.learned[i] = true; state.learnedAll = state.learned.every(Boolean); storage.set('learned', state.learned); }
  function emit(ev) {
    const tb = state.tb;
    if (tb.mode !== 'lesson' || state.lesson.state !== 'play') return;
    const r = LESSONS[state.lesson.i].check(ev, tb);
    if (r === 'ok') { state.lesson.state = 'done'; tb.blocked = true; tb.lessonMsg = ''; chime(880); markLearned(state.lesson.i); }
    else if (r === 'retry') { state.lesson.state = 'retry'; tb.blocked = true; tone({ freq: 260, to: 200, dur: 0.2, type: 'triangle', vol: 0.08 }); }
  }

  // ---- actions -------------------------------------------------------------------------------------------------
  const snapshot = () => { const tb = state.tb; tb.undo.push(cloneHand(tb.H)); if (tb.undo.length > 60) tb.undo.shift(); };
  function doBid(p, n) {
    const tb = state.tb, H = tb.H;
    if (p === 0) snapshot();
    const res = bidAction(H, n); tb.hint = null; tb.wait = 0; tone({ freq: n ? 520 : 300, dur: 0.1, type: 'sine', vol: 0.08 });
    emit({ t: 'bid', p, n });
    if (res === 'won') { say(`${H.declarer === 0 ? 'You win' : SEAT_NAMES[H.declarer] + ' wins'} the bid with ${H.contract}. ${H.declarer === 0 ? 'Now name trump.' : ''}`, 3); chime(560); }
    else if (res === 'redeal') { say('Everyone passed. A new deal follows.', 2.2); tb.redealIn = 2.2; }
  }
  function doTrump(s) {
    const tb = state.tb, H = tb.H;
    if (H.declarer === 0) snapshot();
    setTrump(H, s); tb.hint = null; tb.wait = 0; chime(720);
    say(`${SUIT_NAMES[s]} are trump. ${H.declarer === 0 ? 'You lead' : SEAT_NAMES[H.declarer] + ' leads'} the first trick.`, 3);
    emit({ t: 'trump', s }); saveMatch();
  }
  function doPlay(c) {
    const tb = state.tb, H = tb.H, p = H.turn;
    let from = SEAT[p], k0 = 0.55;
    if (p === 0) { const i = H.hands[0].indexOf(c), r = handLayout(H.hands[0].length)[i]; from = { x: r.x + r.w / 2, y: r.y + r.h / 2 - (tb.sel === i ? 48 : 0) }; k0 = 1.08; snapshot(); }
    if (tb.drag && p === 0 && tb.drag.moved) from = { x: tb.drag.x, y: tb.drag.y };
    tb.flights.push({ c, from, to: SLOT[p], t: 0, dur: state.calm ? 0.16 : 0.3, k0, k1: 1 });
    const res = playCard(H, c); tb.sel = -1; tb.hint = null; tb.wait = 0; tb.msg = null; thock();
    emit({ t: 'play', p, c });
    if (res.done) tb.collect = { cards: res.cards, winner: res.winner, t: -0.3 };
    if (tb.mode === 'puzzle' && p === 0 && !tb.auto && !res.done && !brain.alive(H)) say('That card lets them stop you now. Use Undo to take it back and try another.', 6);
  }
  function finishTrick() {
    const tb = state.tb, H = tb.H, col = tb.collect; tb.collect = null;
    chime(col.winner % 2 === 0 ? 700 : 420);
    emit({ t: 'trick', winner: col.winner, cards: col.cards });
    if (H.phase === 'done') handEnd(); else if (tb.mode === 'play') saveMatch();
  }
  function handEnd() {
    const tb = state.tb, H = tb.H;
    if (tb.mode === 'puzzle') {
      if (H.tricks[0] >= pz.target) {
        state.puz.state = 'solved'; chime(880);
        if (state.daily.solvedDay !== state.daily.day && !tb.auto) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
      } else state.puz.state = 'failed';
      return;
    }
    const r = scoreHand(H), dt = r.declarerTeam, who = dt === 0 ? 'Your side' : 'The opponents', took = H.tricks[dt];
    tb.scores[0] += r.delta[0]; tb.scores[1] += r.delta[1]; state.stats.hands++;
    const line1 = r.sweep ? `${who} bid 13 and took every trick: the match is won.` : r.made ? `${who} bid ${H.contract} and took ${took}: +${r.delta[dt]} points.` : `${who} bid ${H.contract} but took only ${took}: they lose ${H.contract} points.`;
    const line2 = `${dt === 0 ? 'The opponents' : 'Your side'} took ${H.tricks[1 - dt]} trick${H.tricks[1 - dt] === 1 ? '' : 's'}: +${r.delta[1 - dt]} points.`;
    tb.summary = { made: r.made, declarerTeam: dt, sweep: r.sweep, line1, line2 };
    const w = tb.mode === 'lesson' ? -1 : matchWinner(tb.scores, tb.target, r);
    if (w >= 0) {
      tb.over = { winner: w, unlocked: 0 }; state.stats.played++;
      if (w === 0) { state.stats.wins++; if (tb.level >= state.stats.maxLevel && tb.level < 4) { state.stats.maxLevel = tb.level + 1; tb.over.unlocked = tb.level + 1; } }
      saveProgress(); clearSave(); chime(w === 0 ? 880 : 330);
    } else if (tb.mode === 'play') saveMatch();
  }

  // ---- the human's card / bid / hint ---------------------------------------------------------------------------
  const humanTurn = () => {
    const tb = state.tb;
    return !!tb && tb.H.phase === 'play' && tb.H.turn === 0 && !tb.collect && !tb.flights.length && !tb.deal && !tb.blocked && !tb.summary && !tb.over && !tb.leaving && !tb.auto && !(tb.mode === 'puzzle' && state.puz.state !== 'play');
  };
  function refuse(i, why) {
    const tb = state.tb; tb.shake = { i, t: 0 }; tb.sel = -1; say(why, 4.5); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.07 });
    emit({ t: 'refused', c: tb.H.hands[0][i] });
  }
  function tapCard(i) {
    const tb = state.tb; if (!humanTurn() || i < 0) return;
    const c = tb.H.hands[0][i];
    if (!legalPlays(tb.H, 0).includes(c)) { refuse(i, whyIllegal(tb.H)); return; }
    if (tb.sel === i) doPlay(c); else { tb.sel = i; flick(); tb.msg = null; }
  }
  function dragPlay(i) {
    const tb = state.tb; if (!humanTurn()) return;
    const c = tb.H.hands[0][i];
    if (!legalPlays(tb.H, 0).includes(c)) { refuse(i, whyIllegal(tb.H)); return; }
    doPlay(c);
  }
  function hint(free = false) {
    const tb = state.tb, H = tb.H; if (tb.blocked || tb.summary || tb.over || tb.deal) return;
    const turnBid = H.phase === 'bid' && H.bid.turn === 0, turnTrump = H.phase === 'trump' && H.declarer === 0;
    if (!(turnBid || turnTrump || humanTurn())) return;
    if (!free && tb.hintsLeft <= 0) { say('No hints left in this match.'); return; }
    if (turnBid) { const b = chooseBid(H, 0, 3, null); tb.hint = { n: b.n }; say(b.why, 8); }
    else if (turnTrump) { const s = chooseTrump(H.hands[0]); tb.hint = { s }; say(`Name ${SUIT_NAMES[s].toLowerCase()}: it is your longest and strongest suit.`, 8); }
    else if (tb.mode === 'puzzle') { const g = brain.good(H); if (!g.length) { say('No card reaches the target from here. Use Undo.', 5); return; } tb.hint = { c: g[0] }; say(`Play the ${cardName(g[0])}: it is the only card that keeps your target within reach.`, 9); }
    else { const r = pickCard(H, 0, 3, null); tb.hint = { c: r.card }; say(`${cardName(r.card)}: ${r.why}`, 9); }
    if (!free && tb.mode !== 'lesson') tb.hintsLeft--;
  }
  function undo() {
    const tb = state.tb; if (!tb.undo.length || tb.summary || tb.over || tb.blocked || tb.deal) return;
    tb.H = tb.undo.pop(); tb.flights = []; tb.collect = null; tb.sel = -1; tb.hint = null; tb.msg = null; thinker = null; tb.wait = 0;
    if (tb.mode === 'puzzle') state.puz.state = 'play';
    say('Taken back.', 2);
  }

  // ---- input ---------------------------------------------------------------------------------------------------
  const hit = (r, x, y) => inRect(r, x, y);
  function pressTitle(x, y) {
    const R = titleRows(!!state.saved);
    if (R.resume && hit(R.resume, x, y)) resume();
    else if (hit(R.learn, x, y)) state.scene = 'lessons';
    else if (hit(R.play, x, y)) startMatch();
    else if (hit(R.daily, x, y)) startPuzzle();
    else if (hit(R.about, x, y)) state.scene = 'about';
    else if (hit(R.rules, x, y)) { state.scene = 'rules'; state.page = 0; }
    else if (hit(R.level, x, y)) { let l = state.level; do { l = l % 4 + 1; } while (l > state.stats.maxLevel && !state.dev); state.level = l; savePrefs(); }
    else if (hit(R.sound, x, y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); }
    else if (hit(R.calm, x, y)) { state.calm = !state.calm; savePrefs(); }
    else if (hit(R.big, x, y)) { state.big = !state.big; savePrefs(); }
    else if (hit(R.target, x, y)) { state.target = state.target === 31 ? 41 : 31; savePrefs(); }
  }
  function leave() { if (state.tb.mode === 'lesson') { state.scene = 'lessons'; state.tb = null; thinker = null; } else goTitle(); }
  function nextAfterSummary() {
    const tb = state.tb;
    if (tb.mode === 'lesson') { markLearned(state.lesson.i); state.scene = 'lessons'; state.tb = null; return; }
    tb.summary = null;
    if (tb.over) return;
    tb.handNo++; beginHand((tb.dealer + 1) % 4);
  }
  function pressTable(x, y) {
    const tb = state.tb, H = tb.H;
    if (tb.leaving) {
      if (hit({ x: 110, y: 760, w: 500, h: 76 }, x, y)) tb.leaving = false;
      else if (hit({ x: 110, y: 850, w: 500, h: 70 }, x, y)) leave();
      return;
    }
    if (tb.summary) { if (hit(BTN.next, x, y)) nextAfterSummary(); return; }
    if (tb.over) { if (hit(BTN.again, x, y)) startMatch(); else if (hit(BTN.back, x, y)) goTitle(); return; }
    if (tb.mode === 'puzzle' && state.puz.state !== 'play') {
      if (hit({ x: 110, y: 900, w: 500, h: 80 }, x, y)) goTitle();
      else if (state.puz.state === 'failed' && hit({ x: 110, y: 990, w: 500, h: 70 }, x, y)) startPuzzle(true);
      return;
    }
    if (tb.mode === 'lesson' && (state.lesson.state === 'done' || state.lesson.state === 'retry')) {
      if (hit(BTN.lesson, x, y)) {
        if (state.lesson.state === 'retry') startLesson(state.lesson.i);
        else if (state.lesson.i + 1 < LESSONS.length) startLesson(state.lesson.i + 1); else { state.scene = 'lessons'; state.tb = null; }
      } else if (hit(BTN.leave, x, y)) leave();
      return;
    }
    if (hit(BTN.leave, x, y)) { if (tb.mode === 'play') tb.leaving = true; else leave(); return; }
    if (hit(BTN.undo, x, y)) { undo(); return; }
    if (hit(BTN.hint, x, y)) { hint(); return; }
    if (tb.deal) return;
    if (H.phase === 'bid' && H.bid.turn === 0 && !tb.blocked) {
      if (hit(BID.pass, x, y)) { doBid(0, 0); return; }
      for (const r of BID.nums) if (hit(r, x, y)) { if (canBid(H, r.n)) doBid(0, r.n); else say(whyNotBid(H, r.n), 3.5); return; }
    } else if (H.phase === 'trump' && H.declarer === 0 && !tb.blocked) {
      for (const r of BID.suits) if (hit(r, x, y)) { doTrump(r.s); return; }
    } else if (humanTurn()) {
      const i = cardAt(H.hands[0].length, tb.sel, x, y);
      if (i >= 0) tb.drag = { i, x, y, sx: x, sy: y, moved: false };
    }
  }
  function pointer(p) {
    const tb = state.tb;
    if (p.pressed) {
      if (state.scene === 'title') pressTitle(p.x, p.y);
      else if (state.scene === 'about') { if (hit(ABOUT_BACK, p.x, p.y)) state.scene = 'title'; }
      else if (state.scene === 'rules') {
        if (hit(RULES_BACK, p.x, p.y)) state.scene = 'title';
        else if (hit(RULES_NEXT, p.x, p.y)) state.page = (state.page + 1) % RULES.length;
      }
      else if (state.scene === 'lessons') {
        if (hit(LESSONS_BACK(LESSONS.length), p.x, p.y)) state.scene = 'title';
        LESSON_ROWS(LESSONS.length).forEach((r, i) => { if (hit(r, p.x, p.y)) startLesson(i); });
      } else if (tb) pressTable(p.x, p.y);
    }
    const t2 = state.tb;
    if (t2 && t2.drag && t2 === tb) {
      if (p.down) { t2.drag.x = p.x; t2.drag.y = p.y; if (!t2.drag.moved && Math.hypot(p.x - t2.drag.sx, p.y - t2.drag.sy) > 14) t2.drag.moved = true; }
      if (p.released) { const d = t2.drag; t2.drag = null; if (d.moved) { if (p.y < HAND_Y - 70) dragPlay(d.i); } else tapCard(d.i); }
    }
  }
  function keys(k) {
    const tb = state.tb; if (!k.pressed.size) return;
    if (state.scene === 'title') { if (k.pressed.has('Enter')) { const R = titleRows(!!state.saved), r = R.resume || (state.learnedAll ? R.play : R.learn); pressTitle(r.x + 10, r.y + 10); } return; }
    if (!tb) { if (k.pressed.has('Escape')) state.scene = 'title'; return; }
    if (k.pressed.has('Escape')) { if (tb.mode === 'play') tb.leaving = !tb.leaving; else leave(); return; }
    if (k.pressed.has('KeyH')) hint();
    if (k.pressed.has('KeyU')) undo();
    const H = tb.H, go = k.pressed.has('Enter') || k.pressed.has('Space'), right = k.pressed.has('ArrowRight'), left = k.pressed.has('ArrowLeft');
    if (H.phase === 'bid' && H.bid.turn === 0 && !tb.blocked && !tb.deal) {
      if (k.pressed.has('KeyP')) { doBid(0, 0); return; }
      const opts = [7, 8, 9, 10, 11, 12, 13].filter((n) => canBid(H, n)).concat([0]);
      if (right || left) { const i = opts.indexOf(tb.kb); tb.kb = opts[right ? (i + 1) % opts.length : (i < 0 ? opts.length - 1 : (i + opts.length - 1) % opts.length)]; tb.hint = { n: tb.kb }; }
      if (go && tb.kb >= 0 && (tb.kb === 0 || canBid(H, tb.kb))) doBid(0, tb.kb);
    } else if (H.phase === 'trump' && H.declarer === 0 && !tb.blocked) {
      if (right) { tb.kb = (tb.kb + 1) % 4; tb.hint = { s: tb.kb }; }
      if (left) { tb.kb = (tb.kb + 3) % 4; tb.hint = { s: tb.kb }; }
      if (go && tb.kb >= 0) doTrump(tb.kb);
    } else if (humanTurn()) {
      const n = H.hands[0].length;
      if (right) tb.sel = tb.sel < 0 ? 0 : Math.min(n - 1, tb.sel + 1);
      if (left) tb.sel = tb.sel < 0 ? n - 1 : Math.max(0, tb.sel - 1);
      if (go) { if (tb.sel >= 0) tapCard(tb.sel); else tb.sel = 0; }
    }
  }

  // ---- the clock -----------------------------------------------------------------------------------------------
  const puzzleOver = (tb) => tb.mode === 'puzzle' && state.puz.state !== 'play';
  function tick(dt) {
    const tb = state.tb, H = tb.H;
    if (tb.msg) { tb.msg.t += dt; if (tb.msg.t > tb.msg.hold) tb.msg = null; }
    if (tb.shake) { tb.shake.t += dt; if (tb.shake.t > 0.5) tb.shake = null; }
    for (const f of tb.flights) f.t += dt;
    tb.flights = tb.flights.filter((f) => f.t < f.dur);
    if (tb.deal) {
      tb.deal.t += dt; const k = Math.floor(tb.deal.t / 0.112); if (k > tb.deal.tick) { tb.deal.tick = k; flick(); }
      if (tb.deal.t >= DEAL_TIME) tb.deal = null;
      return;
    }
    if (tb.collect) { tb.collect.t += dt; if (tb.collect.t >= 1.1 && !tb.flights.length) finishTrick(); return; }
    if (tb.redealIn > 0) { tb.redealIn -= dt; if (tb.redealIn <= 0) { tb.handNo++; beginHand((tb.dealer + 1) % 4); } return; }
    if (tb.flights.length || tb.summary || tb.over || tb.leaving || tb.blocked || puzzleOver(tb)) return;
    // coaching in lesson 8: explain each of your decisions once
    const mine = (H.phase === 'bid' && H.bid.turn === 0) || (H.phase === 'trump' && H.declarer === 0) || (H.phase === 'play' && H.turn === 0);
    if (tb.coach && mine) { const key = `${H.phase}${H.played.length}${H.bid.turn}`; if (tb.coachKey !== key) { tb.coachKey = key; hint(true); } }
    tb.wait += dt;
    if (H.phase === 'bid' && H.bid.turn !== 0) {
      if (tb.wait < 0.9) return;
      const p = H.bid.turn, b = chooseBid(H, p, tb.level, rng); doBid(p, b.n && canBid(H, b.n) ? b.n : 0);
    } else if (H.phase === 'trump' && H.declarer !== 0) {
      if (tb.wait < 0.8) return;
      doTrump(chooseTrump(H.hands[H.declarer]));
    } else if (H.phase === 'play' && (H.turn !== 0 || tb.auto)) {
      const p = H.turn;
      if (tb.mode === 'puzzle') { if (tb.wait < 0.55) return; doPlay(p === 0 ? brain.good(H)[0] : brain.pick(H)); return; }
      if (!thinker) thinker = createThinker(H, p, tb.level, rng);
      thinker.step();                                         // one small slice of search per frame: the screen never stalls
      if (thinker.done && tb.wait >= 0.65) { const c = thinker.result.card; thinker = null; doPlay(c); }
    }
  }

  return {
    update(dt, input) {
      state.t += dt;
      pointer(input.pointer); keys(input.keys);
      if (state.tb) tick(dt);
    },
    render(ctx) { render(ctx, state); },
    getState() { return state; },
  };
}
