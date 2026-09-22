// Baloot: state and flow. Rules are in rules.js, the computer in ai.js, lessons in lessons.js, the daily deal in daily.js,
// drawing in view.js. This is the only file that changes `state`.
//
// Controls (taught in the game): TAP a card to raise it, TAP it again to play it, or DRAG it up. TAP a big button to bid.
import { W, H as HH, CW, HAND_Y, LIFT, BTN, TRICK, SEAT, DECK, handSlot, inRect, titleRows, bidButtons, bid2Buttons, ACT, OVERLAY_BTN, BACK } from './layout.js';
import { newHand, bidOptions, applyBid, applyDouble, declOptions, declare, playCard, legalCards, matchWinner, whyNot, cardShort, cardName, suitOf, SUIT_NAMES, RUNG, teamOf, nextSeat, declValue, hasBaloot, TARGETS, legalFor, DECL } from './rules.js';
import { LEVELS, createThinker, heuristicBid, bidReason } from './ai.js';
import { LESSONS } from './lessons.js';
import { createDailyMaker, puzzleHand, makeSolver, bestReply } from './daily.js';
import { render } from './view.js';

export const meta = { width: W, height: HH };
const DEMO_HANDS = 5, DEMO_LESSONS = 3, HINTS_PER_HAND = 3, HOLD = 1.25;
const copy = (o) => JSON.parse(JSON.stringify(o));

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, mode: 'match', level: 2, targetIdx: 0,
    set: { sound: true, calm: false, big: false, four: false },
    match: { scores: [0, 0], dealer: 0, hands: 0, winner: -1, log: [] }, H: null,
    ui: { sel: -1, msg: null, hint: null, hintsLeft: HINTS_PER_HAND, declAsked: false, delay: 0, cursor: 0, drag: null, thinking: false, summary: null, wait: 0, peek: null },
    pos: {}, show: null, says: [null, null, null, null], shown: [0, 0, 0, 0], panel: [], panelText: [],
    stats: { played: 0, wins: 0, best: 0, handsWon: 0, hands: 0 }, saved: null, learned: {}, demoHands: 0,
    lesson: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0, tries: 0, status: 'idle', puzzle: null, ready: false, made: 0 },
    undo: [], listScroll: 0, dev: config.dev === true, refuse: null, celebrate: 0,
  };
  if (config.dev) globalThis.__baloot = { state, start: () => startMatch(), lesson: (i) => startLesson(i), daily: () => startDaily() };   // tester hook (dev only)
  let thinker = null, thinkerKey = '', hintThinker = null, solver = null, maker = null, dailyPuzzle = null;
  const ui = state.ui;

  // ---- storage ---------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 2; state.targetIdx = v.targetIdx ?? 0; state.set = { ...state.set, ...(v.set || {}) }; audio.setMuted?.(!state.set.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('learned', {}).then((v) => { state.learned = { ...v, ...state.learned }; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoHands', 0).then((v) => { state.demoHands = Math.max(state.demoHands, v); });
  storage.get('save', null).then((v) => { if (v && v.H && v.match && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, targetIdx: state.targetIdx, set: state.set });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };
  const saveGame = () => {
    if (state.mode !== 'match' || !state.H || state.scene !== 'play' || state.H.phase === 'done' || state.show) return;
    state.saved = { H: copy(state.H), match: copy(state.match), level: state.level, targetIdx: state.targetIdx, hintsLeft: ui.hintsLeft };
    storage.set('save', state.saved);
  };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  // ---- helpers ---------------------------------------------------------------------------------------------
  const target = () => TARGETS[state.targetIdx];
  const say = (text, hold = 4.2) => { ui.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.set.sound) audio.tone(o); };
  const slap = () => tone({ freq: 240, to: 90, dur: 0.07, type: 'triangle', vol: 0.13 });
  const tick = () => tone({ freq: 700, to: 500, dur: 0.03, type: 'sine', vol: 0.05 });
  const chime = (up = true) => tone({ freq: up ? 520 : 330, to: up ? 880 : 240, dur: 0.35, type: 'triangle', vol: 0.09 });
  const buzz = () => tone({ freq: 170, to: 120, dur: 0.16, type: 'sawtooth', vol: 0.05 });
  const dly = (d) => (state.set.calm ? d * 0.6 : d);
  const human = () => state.H.turn === 0;
  const speak = (seat, text) => { state.says[seat] = { text, t: 0 }; };

  // ---- hand flow -------------------------------------------------------------------------------------------
  function beginHand(H, mode = 'match') {
    state.H = H; state.mode = mode; state.pos = {}; state.show = null; state.says = [null, null, null, null]; state.shown = [0, 0, 0, 0];
    state.undo = []; thinker = hintThinker = null; ui.sel = -1; ui.hint = null; ui.hintsLeft = HINTS_PER_HAND; ui.declAsked = false; ui.summary = null; ui.thinking = false; ui.drag = null; ui.wait = 0;
    ui.delay = mode === 'match' ? dly(1.5) : dly(0.3); state.dealT = 0;
  }
  function startMatch() {
    if (config.demo && state.demoHands >= DEMO_HANDS) { state.scene = 'demo-limit'; return; }
    state.match = { scores: [0, 0], dealer: rng.int(4), hands: 0, winner: -1, log: [] };
    clearSave(); state.scene = 'play'; nextHand();
    monetization.track('match_start', { level: state.level });
  }
  function nextHand() {
    if (config.demo && state.demoHands >= DEMO_HANDS) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoHands += 1; storage.set('demoHands', state.demoHands); }
    state.match.hands += 1;
    beginHand(newHand(rng, state.match.dealer, state.match.scores.slice()));
    say(`Dealer: ${['You', 'Right', 'Partner', 'Left'][state.match.dealer]}. ${['You bid first.', 'Right bids first.', 'Partner bids first.', 'Left bids first.'][nextSeat(state.match.dealer)]}`, 3.5);
  }
  function resumeMatch() {
    const v = state.saved; state.match = copy(v.match); state.level = v.level ?? state.level; state.targetIdx = v.targetIdx ?? 0;
    state.scene = 'play'; beginHand(copy(v.H)); ui.hintsLeft = v.hintsLeft ?? HINTS_PER_HAND; ui.delay = 0.4; say('Match restored.');
    if (state.H.phase === 'bid' || state.H.phase === 'double') ui.declAsked = false;
    ui.declAsked = state.H.tricks > 0 || state.H.trick.length > 0 || state.H.declared[0].length > 0;
  }

  const bidWord = (a) => (a.t === 'pass' ? 'Pass' : a.t === 'sun' ? 'Sun' : `Hokum ${'♠♥♦♣'[a.suit]}`);
  function doBid(a, seat) {
    const H = state.H;
    speak(seat, bidWord(a)); tone({ freq: a.t === 'pass' ? 300 : 520, to: a.t === 'pass' ? 260 : 620, dur: 0.1, type: 'triangle', vol: 0.08 });
    const before = H.phase;
    applyBid(H, a); ui.hint = null; ui.sel = -1;
    if (H.phase === 'redeal') { say('Everyone passed twice. New deal.', 3); ui.wait = dly(1.6); return; }
    if (before === 'bid' && H.phase !== 'bid') announceContract();
  }
  function announceContract() {
    const H = state.H, ct = H.contract, who = ['You', 'Right', 'Partner', 'Left'][ct.buyer];
    say(`${who} ${ct.buyer === 0 ? 'take' : 'takes'} ${ct.type === 'sun' ? 'Sun' : 'Hokum, ' + SUIT_NAMES[ct.trump] + ' is trump'}.`, 4);
    ui.delay = dly(1.3);
    for (let s = 0; s < 4; s++) state.says[s] = s === ct.buyer ? { text: ct.type === 'sun' ? 'Sun!' : 'Hokum!', t: 0 } : null;
    chime();
    if (H.phase === 'play') afterPlayStart();
  }
  function afterPlayStart() { ui.declAsked = false; ui.delay = dly(1.5); }
  function doDouble(raise) {
    const H = state.H, seat = H.turn, rung = H.dbl.rung;
    speak(seat, raise ? RUNG[rung] : 'Skip');
    if (raise) { say(`${['You', 'Right', 'Partner', 'Left'][seat]} call${seat === 0 ? '' : 's'} ${RUNG[rung]}: the hand is worth x${rung + 2}.`, 4); chime(false); }
    const ph = H.phase; applyDouble(H, raise); ui.hint = null;
    if (ph === 'double' && H.phase === 'play') { ui.delay = dly(1.1); afterPlayStart(); }
  }
  function doDeclare() {
    const H = state.H; declare(H, 0); ui.declAsked = true;
    const names = H.declared[0].map((d) => d.label).join(', ');
    speak(0, H.declared[0].map((d) => DECL[d.kind].name).join(' + ')); say(`You announce ${names}. It is shown after the first trick.`, 4); chime();
    if (state.mode === 'lesson') lessonAct({ kind: 'declare' });
  }
  function doPlay(card) {
    const H = state.H, seat = H.turn;
    if (state.mode === 'match' && seat === 0) { state.undo.push(copy(H)); if (state.undo.length > 6) state.undo.shift(); }
    if (!state.pos[card]) state.pos[card] = { x: SEAT[seat].x - CW * 0.38, y: SEAT[seat].y - CW * 0.5, sc: 0.5, born: state.t };
    if (H.tricks === 0 && H.trick.length === 0 && seat !== 0) { /* the computer announces before its first card */ }
    if (H.tricks === 0 && seat !== 0 && H.hands[seat].length === 8) { const d = declOptions(H, seat); if (d.length && aiDeclares(seat)) { declare(H, seat); speak(seat, d.map((x) => DECL[x.kind].name).join(' + ')); } }
    const wasBaloot = H.baloot[seat];
    const r = playCard(H, card); ui.sel = -1; ui.hint = null; slap();
    if (!wasBaloot && H.baloot[seat]) { speak(seat, 'Baloot!'); say(`${['You', 'Right', 'Partner', 'Left'][seat]} play${seat === 0 ? '' : 's'} Baloot: King and Queen of trump (+2).`, 4); chime(); }
    if (H.tricks === 2 && H.declWin >= 0 && !ui.declShown) { ui.declShown = true; revealDecls(); }
    if (r) {
      const last = H.history[H.history.length - 1];
      state.show = { plays: last.plays.map((p) => ({ ...p })), winner: last.winner, t: 0 };
      ui.delay = 0;
      if (r.done) { /* summary appears after the collect animation */ }
    }
  }
  function revealDecls() {
    const H = state.H, w = H.declWin, tn = w === 0 ? 'Your team' : 'The other team';
    const parts = []; for (let s = 0; s < 4; s++) if (teamOf(s) === w) for (const d of H.declared[s]) parts.push(`${d.label} (+${declValue(d, H.contract)})`);
    say(`${tn} has the best declaration: ${parts.join(', ')}.`, 5);
  }
  const aiDeclares = () => true;

  function finishHand() {
    const H = state.H, r = H.result;
    if (state.mode === 'lesson') { lessonHandDone(); return; }
    state.match.scores[0] += r.delta[0]; state.match.scores[1] += r.delta[1];
    state.stats.hands += 1; if ((r.buyerWon ? r.buyerTeam : 1 - r.buyerTeam) === 0) state.stats.handsWon += 1;
    const mw = matchWinner(state.match.scores, target(), r);
    state.match.log.push({ delta: r.delta.slice(), sun: H.contract.type === 'sun' });
    state.match.dealer = nextSeat(state.match.dealer);
    ui.summary = { result: r, contract: copy(H.contract), mult: H.mult, matchWinner: mw, buyer: H.contract.buyer };
    const mine = r.delta[0] >= r.delta[1]; chime(mine);
    if (mw >= 0) {
      state.match.winner = mw; state.stats.played += 1; if (mw === 0) state.stats.wins += 1;
      state.stats.best = Math.max(state.stats.best, state.match.scores[0]); saveStats(); clearSave();
      monetization.track('match_end', { winner: mw, level: state.level, hands: state.match.hands });
    } else saveGameAfterHand();
  }
  function saveGameAfterHand() {
    state.saved = { H: null, match: copy(state.match), level: state.level, targetIdx: state.targetIdx, hintsLeft: HINTS_PER_HAND, between: true };
  }

  // ---- panel (what the buttons say) --------------------------------------------------------------------------
  function buildPanel() {
    const H = state.H, P = []; state.panelText = [];
    if (!H || state.show || ui.summary) { state.panel = []; return; }
    if (state.dealT !== undefined && ui.delay > 0 && state.mode === 'match' && H.phase === 'bid' && H.bidLog.length === 0) { state.panel = []; return; }
    const busy = ui.thinking && hintThinker;
    void busy;
    if (H.phase === 'bid' && human() && !(state.mode === 'lesson' && state.lesson?.done)) {
      const opts = bidOptions(H);
      if (H.round === 1) {
        const r = bidButtons(opts.length, 1);
        opts.forEach((o, i) => P.push({ r: r[i], kind: 'bid', a: o, label: o.t === 'hokum' ? 'Hokum' : o.t === 'sun' ? 'Sun' : 'Pass', sub: o.t === 'hokum' ? 'trump: ' : o.t === 'sun' ? 'no trump, x2' : 'skip', suit: o.t === 'hokum' ? o.suit : -1, primary: o.t !== 'pass' }));
        state.panelText = ['Round 1: turned-up card decides the trump suit.'];
      } else {
        const b = bid2Buttons(); let k = 0;
        for (const o of opts) {
          if (o.t === 'hokum') P.push({ r: b.suits[k++], kind: 'bid', a: o, label: 'Hokum', suit: o.suit, primary: true });
          else if (o.t === 'sun') P.push({ r: b.sun, kind: 'bid', a: o, label: 'Sun', sub: 'no trump', primary: true });
          else P.push({ r: b.pass, kind: 'bid', a: o, label: 'Pass' });
        }
        state.panelText = [];
      }
    } else if (H.phase === 'double' && human()) {
      const rung = H.dbl.rung, name = RUNG[rung];
      P.push({ r: ACT.a, kind: 'dbl', raise: true, label: name, sub: rung === 3 ? 'win the match, or lose it' : `hand worth x${rung + 2}`, primary: true });
      P.push({ r: ACT.b, kind: 'dbl', raise: false, label: 'Skip', sub: 'play on' });
      state.panelText = [rung === 0 ? 'You may Double: the hand counts double. Sure?' : rung === 3 ? 'Match call: win this hand and you win the match. Lose it and they do.' : `They doubled. You may answer with ${name}.`];
    } else if (H.phase === 'play' && human() && ui.declAsked === false && H.tricks === 0 && H.trick.length === 0 && state.dealT !== undefined) {
      const d = declOptions(H, 0);
      if (d.length && ui.delay <= 0) {
        P.push({ r: ACT.a, kind: 'decl', label: 'Declare', sub: d.map((x) => DECL[x.kind].name).join(' + '), primary: true });
        P.push({ r: ACT.b, kind: 'declno', label: 'Not now', sub: 'keep it hidden' });
        state.panelText = d.map((x) => `${x.label}: +${declValue(x, H.contract)}`);
      } else if (!d.length) ui.declAsked = true;
    }
    state.panel = P;
  }

  // ---- input helpers -----------------------------------------------------------------------------------------
  function cardAt(px, py) {
    const H = state.H; if (!H || H.phase === 'done') return -1;
    const hand = displayHand(); const n = hand.length; if (!n) return -1;
    const s = handSlot(0, n), step = s.step;
    if (py < HAND_Y - LIFT - 4 || py > HAND_Y + 214) return -1;
    if (px < s.x || px > s.x + CW + step * (n - 1)) return -1;
    let i = step ? Math.min(n - 1, Math.floor((px - s.x) / step)) : 0;
    // the raised card is drawn on top of its neighbours
    if (ui.sel >= 0) { const j = hand.indexOf(ui.sel); if (j >= 0) { const sx = handSlot(j, n).x; if (px >= sx && px <= sx + CW && py < HAND_Y + 30) i = j; } }
    return hand[i];
  }
  const displayHand = () => (state.H ? state.H.hands[0] : []);

  function tryCard(card, viaDrag) {
    const H = state.H;
    if (!human() || H.phase !== 'play' || state.show || ui.delay > 0 || state.scene === 'over' || hintThinker) return;
    if (H.tricks === 0 && H.trick.length === 0 && ui.declAsked === false && declOptions(H, 0).length) { say('First choose: Declare, or Not now.'); return; }
    const legal = legalCards(H, 0);
    if (!legal.includes(card)) {
      const why = whyNot(H.hands[0], H.trick, H.contract, 0, card);
      ui.refuse = { card, t: 0 }; ui.sel = -1; say(why, 6); buzz();
      if (state.mode === 'lesson') lessonAct({ kind: 'refused', card });
      return;
    }
    if (ui.sel !== card && !viaDrag) { ui.sel = card; tick(); return; }
    if (state.mode === 'lesson' && !lessonAllows({ kind: 'play', card })) { ui.sel = -1; return; }
    if (state.mode === 'daily') { dailyPlay(card); return; }
    doPlay(card);
    if (state.mode === 'lesson') lessonAct({ kind: 'play', card }, true);
  }

  // ---- the computer's turn -------------------------------------------------------------------------------------
  function aiTurn(dt) {
    const H = state.H, seat = H.turn;
    if (ui.delay > 0) { ui.delay -= dt; return; }
    const kind = H.phase === 'bid' ? 'bid' : H.phase === 'double' ? 'double' : 'play';
    const key = `${kind}|${seat}|${H.tricks}|${H.trick.length}|${H.bidIdx}|${H.round}|${H.dbl ? H.dbl.rung : ''}`;
    if (!thinker || thinkerKey !== key) { thinker = createThinker(kind, H, seat, state.mode === 'lesson' ? 3 : state.level, rng); thinkerKey = key; }
    ui.thinking = true;
    const r = thinker.step();
    if (!r.done) return;
    thinker = null; ui.thinking = false;
    if (kind === 'bid') doBid(r.action, seat); else if (kind === 'double') doDouble(r.action.raise); else doPlay(r.action.card);
    ui.delay = dly(kind === 'play' ? 0.5 : 0.75);
  }

  // ---- hints ---------------------------------------------------------------------------------------------------
  function askHint() {
    const H = state.H;
    if (!human() || state.show || ui.delay > 0 || hintThinker) return;
    if (H.phase === 'bid') { const a = heuristicBid(H, 0, 3); ui.hint = { kind: 'bid', a, t: 0 }; say('Hint: ' + bidWord(a) + '. ' + bidReason(H, 0, a), 8); return; }
    if (H.phase === 'double') { say('Hint: only Double when your own hand is very strong in their trump suit. Otherwise Skip.', 6); return; }
    if (H.phase !== 'play') return;
    if (state.mode === 'lesson') { say(LESSONS[state.lesson.i].steps[state.lesson.s]?.text ?? '', 6); return; }
    if (ui.hintsLeft <= 0) { say('No hints left in this hand.'); return; }
    ui.hintsLeft -= 1; hintThinker = createThinker('play', H, 0, 4, rng, { hint: true }); ui.thinking = true; ui.sel = -1;
  }
  function stepHint() {
    const r = hintThinker.step();
    if (!r.done) return;
    hintThinker = null; ui.thinking = false; ui.hint = { kind: 'card', card: r.action.card, t: 0 };
    say(`Hint: ${cardName(r.action.card)}. ${r.action.why}`, 8);
  }
  function takeBack() {
    if (state.mode !== 'match' || !human() || state.show || !state.undo.length || state.H.phase !== 'play') { say('Nothing to take back yet.'); return; }
    state.H = state.undo.pop(); thinker = null; ui.sel = -1; ui.hint = null; ui.delay = 0.2; ui.declAsked = state.H.tricks > 0 || state.H.declared[0].length > 0 || ui.declAsked;
    for (const c of Object.keys(state.pos)) { const k = +c; if (!state.H.hands[0].includes(k) && !state.H.trick.some((p) => p.card === k)) delete state.pos[c]; }
    say('Move taken back.'); tick();
  }

  // ---- lessons ------------------------------------------------------------------------------------------------
  function startLesson(i) {
    if (config.demo && i >= DEMO_LESSONS) { say('Lessons 4 to 10 are in the full game.', 4); return; }
    const L = LESSONS[i], H = L.make();
    state.scene = 'lesson'; state.lesson = { i, s: 0, done: false, after: '', wait: false };
    beginHand(H, 'lesson'); state.scene = 'lesson'; ui.declAsked = false; ui.delay = 0.3;
    say(L.intro, 9);
  }
  const curStep = () => LESSONS[state.lesson.i].steps[state.lesson.s];
  function lessonAllows(a) { const st = curStep(); if (!st || state.lesson.done) return false; if (st.want(a, state.H)) return true; say(typeof st.bad === 'function' ? st.bad(a) : st.bad, 6); buzz(); ui.sel = -1; return false; }
  function lessonAct(a, played) {
    const L = state.lesson; if (!L || L.done) return;
    const st = curStep(); if (!st) return;
    let ok = false;
    if (a.kind === 'refused') ok = st.want(a, state.H); else if (a.kind === 'declare') ok = st.want(a, state.H); else if (played) ok = st.want(a, state.H);
    if (!ok) return;
    L.after = st.after; L.s += 1; say(st.after, 7); chime();
    if (L.s >= LESSONS[L.i].steps.length) { L.done = true; state.learned[L.i] = true; storage.set('learned', state.learned); }
  }
  function lessonBid(a) {
    const st = curStep(); const act = { kind: 'bid', t: a.t, suit: a.suit };
    if (!st.want(act, state.H)) { say(typeof st.bad === 'function' ? st.bad(act) : st.bad, 7); buzz(); return; }
    speak(0, bidWord(a)); const L = state.lesson; L.after = st.after; L.s += 1; L.done = true; say(st.after, 8); chime(); state.learned[L.i] = true; storage.set('learned', state.learned);
    state.H.phase = 'lessondone';
  }
  function lessonHandDone() { const L = state.lesson; ui.summary = { result: state.H.result, contract: copy(state.H.contract), mult: 1, lesson: true }; if (!L.done) L.done = true; state.learned[L.i] = true; storage.set('learned', state.learned); }
  // When a lesson step wants a card the game cannot legally offer now, don't strand the player.
  function lessonGuard() {
    const L = state.lesson, H = state.H; if (!L || L.done || !human() || H.phase !== 'play' || state.show || ui.delay > 0) return;
    const st = curStep(); if (!st || st.kind === 'refused' || st.kind === 'declare') return;
    const legal = legalCards(H, 0);
    if (!legal.some((c) => st.want({ kind: 'play', card: c }, H))) { L.s += 1; if (L.s >= LESSONS[L.i].steps.length) { L.done = true; state.learned[L.i] = true; storage.set('learned', state.learned); } }
  }

  // ---- daily deal ----------------------------------------------------------------------------------------------
  function startDaily() {
    if (!dailyPuzzle) { state.daily.status = 'making'; state.scene = 'daily'; return; }
    state.scene = 'daily'; state.daily.status = state.daily.solvedDay === state.daily.day ? 'solved' : 'ready';
    const p = dailyPuzzle; state.daily.puzzle = { target: p.target, total: p.total, type: p.ct.type, trump: p.ct.trump, best: p.best };
    solver = makeSolver(p.ct);
    beginHand(puzzleHand(p), 'daily'); state.scene = 'daily'; ui.delay = 0.2; state.daily.wrong = 0; state.daily.taken = 0;
    say(`Your team needs ${p.target} of the ${p.total} points left. Every hand is face up.`, 8);
  }
  function dailyPlay(card) {
    const H = state.H, p = dailyPuzzle;
    const hs = H.hands.map((h) => h.slice()); hs[0] = hs[0].filter((c) => c !== card);
    const left = H.hands[0].length;
    let v;
    // value of the game after this play: my side's points already banked + best play from here
    v = solver.value(hs, [...H.trick, { seat: 0, card }], 1, left) + H.taken[0];
    doPlay(card);
    state.daily.wrong = v >= p.target ? 0 : 1;
    if (v < p.target) { state.daily.tries += 1; say(`That gives it away: best you can now reach is ${v} of ${p.target}. Tap Try again.`, 8); }
  }
  function dailyReset() { const p = dailyPuzzle; beginHand(puzzleHand(p), 'daily'); state.scene = 'daily'; solver = makeSolver(p.ct); state.daily.wrong = 0; ui.delay = 0.2; say('Set up again. Look for the lead that keeps every point you need.', 5); }
  function dailyAi() {
    const H = state.H, seat = H.turn;
    const r = bestReply(H, solver); doPlay(r.card); ui.delay = dly(0.5);
    void seat;
  }
  function dailyDone() {
    const H = state.H, p = dailyPuzzle, got = H.taken[0];
    if (got >= p.target) {
      state.daily.status = 'solved'; ui.summary = { daily: true, got, target: p.target };
      if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
      chime(); say('Solved! Your team took ' + got + ' points.', 8);
    } else { state.daily.status = 'failed'; ui.summary = { daily: true, got, target: p.target, failed: true }; state.daily.tries += 1; }
  }

  // ---- per-scene updates ---------------------------------------------------------------------------------------
  function updateTitle(tap) {
    if (!maker) maker = createDailyMaker(state.daily.day);
    for (let k = 0; k < 1 && !dailyPuzzle; k++) { const r = maker.step(); state.daily.made += 1; if (r.puzzle) dailyPuzzle = r.puzzle; }
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(R.resume)) { if (state.saved.H) resumeMatch(); else { state.match = copy(state.saved.match); state.scene = 'play'; state.level = state.saved.level; nextHand(); } }
    else if (hit(R.play)) startMatch();
    else if (hit(R.learn)) { state.scene = 'lessons'; }
    else if (hit(R.daily)) startDaily();
    else if (hit(R.level)) { if (tap.x > 360) { state.level = state.level % LEVELS.length + 1; } else { state.targetIdx = (state.targetIdx + 1) % TARGETS.length; } savePrefs(); tick(); }
    else if (hit(R.settings)) state.scene = 'settings';
    else if (hit(R.about)) state.scene = 'about';
    else if (hit(R.how)) state.scene = 'how';
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    const rows = settingsRows();
    rows.forEach((r) => { if (inRect(r.r, tap.x, tap.y)) { state.set[r.key] = !state.set[r.key]; if (r.key === 'sound') audio.setMuted?.(!state.set.sound); savePrefs(); tick(); } });
  }
  function updateLessons(tap) {
    if (!tap) return;
    if (inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    LESSONS.forEach((L, i) => { if (inRect(lessonRow(i), tap.x, tap.y)) startLesson(i); });
  }
  function updateSimple(tap) { if (tap && inRect(BACK, tap.x, tap.y)) state.scene = 'title'; }

  function updateTable(dt, tap, input) {
    const H = state.H, sc = state.scene;
    if (ui.msg) { ui.msg.t += dt; if (ui.msg.t > ui.msg.hold) ui.msg = null; }
    for (let s = 0; s < 4; s++) if (state.says[s]) { state.says[s].t += dt; if (state.says[s].t > 3.2 && H.phase !== 'bid') state.says[s] = null; }
    if (ui.refuse) { ui.refuse.t += dt; if (ui.refuse.t > 0.6) ui.refuse = null; }
    if (ui.hint) ui.hint.t += dt;
    state.dealT += dt;
    // leaving
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintThinker = null; ui.thinking = false; return; }
    if (ui.summary) { tableSummary(tap); return; }
    if (state.show) {
      state.show.t += dt;
      if (state.show.t > (state.set.calm ? 0.8 : HOLD) + 0.4) {
        state.show = null;
        if (H.phase === 'done') { if (sc === 'daily') dailyDone(); else finishHand(); } else ui.delay = Math.max(ui.delay, dly(0.25));
      }
      return;
    }
    if (ui.wait > 0) { ui.wait -= dt; if (ui.wait <= 0 && H.phase === 'redeal') { state.match.dealer = nextSeat(state.match.dealer); state.match.hands -= 1; if (config.demo) { state.demoHands -= 1; } nextHand(); } return; }
    if (H.phase === 'lessondone') { if (tap && inRect(OVERLAY_BTN, tap.x, tap.y)) nextLesson(); return; }
    if (H.phase === 'redeal' || H.phase === 'done') return;
    if (sc === 'lesson' && state.lesson.done && H.phase === 'play' && false) return;
    // buttons (hint, undo)
    if (hintThinker) { stepHint(); return; }
    if (tap && human() && !state.show) {
      if (inRect(BTN.hint, tap.x, tap.y)) { askHint(); return; }
      if (inRect(BTN.undo, tap.x, tap.y)) { if (sc === 'daily') { if (state.daily.wrong || H.tricks > 8 - dailyPuzzle.tricks) dailyReset(); else say('Nothing to take back.'); } else takeBack(); return; }
    } else if (tap && inRect(BTN.undo, tap.x, tap.y) && sc === 'daily' && state.daily.wrong) { dailyReset(); return; }
    if (sc === 'lesson' && state.lesson.done && !(H.phase === 'play' && H.trick.length > 0 && H.turn !== 0)) { if (tap && inRect(OVERLAY_BTN, tap.x, tap.y)) nextLesson(); return; }
    if (sc === 'daily' && state.daily.wrong) { if (tap && inRect(OVERLAY_BTN, tap.x, tap.y)) dailyReset(); return; }
    if (sc === 'lesson') lessonGuard();
    if (!human()) { ui.drag = null; if (sc === 'daily') { if (ui.delay > 0) ui.delay -= dt; else dailyAi(); } else aiTurn(dt); return; }
    // my turn
    if (ui.delay > 0) { ui.delay -= dt; return; }
    const pointer = input.pointer;
    // panel taps
    if (tap) for (const b of state.panel) if (inRect(b.r, tap.x, tap.y)) { panelTap(b); return; }
    // drag
    if (pointer.pressed && H.phase === 'play') { const c = cardAt(pointer.x, pointer.y); if (c >= 0) ui.drag = { card: c, sx: pointer.x, sy: pointer.y, x: pointer.x, y: pointer.y, moved: false }; }
    else if (ui.drag && pointer.down) { ui.drag.x = pointer.x; ui.drag.y = pointer.y; if (Math.abs(pointer.y - ui.drag.sy) > 26) ui.drag.moved = true; }
    if (ui.drag && (pointer.released || !pointer.down) && !pointer.pressed) {
      const d = ui.drag; ui.drag = null;
      if (d.moved && d.sy - d.y > 90) tryCard(d.card, true);
      else if (!d.moved || Math.abs(d.y - d.sy) <= 26) tryCard(d.card, false);
    }
  }
  function panelTap(b) {
    const H = state.H;
    if (b.kind === 'bid') { if (state.mode === 'lesson') { lessonBid(b.a); return; } doBid(b.a, 0); ui.delay = dly(0.7); }
    else if (b.kind === 'dbl') { doDouble(b.raise); ui.delay = dly(0.6); }
    else if (b.kind === 'decl') doDeclare();
    else if (b.kind === 'declno') { ui.declAsked = true; say('Kept hidden. Declarations cannot be made after your first card.', 3); if (state.mode === 'lesson') say('TAP Declare to continue the lesson.', 4); }
    void H;
  }
  function tableSummary(tap) {
    const S = ui.summary;
    if (!tap || !inRect(OVERLAY_BTN, tap.x, tap.y)) return;
    if (S.lesson) { ui.summary = null; nextLesson(); return; }
    if (S.daily) { ui.summary = null; if (S.failed) dailyReset(); else state.scene = 'title'; return; }
    if (S.matchWinner >= 0) { ui.summary = null; state.scene = 'over'; return; }
    ui.summary = null; nextHand();
  }
  function nextLesson() { const i = state.lesson.i; if (i + 1 < LESSONS.length) startLesson(i + 1); else { state.scene = 'lessons'; } }

  function updatePos(dt) {
    const H = state.H; if (!H) return;
    const k = 1 - Math.exp(-dt * (state.set.calm ? 18 : 11));
    const put = (card, tx, ty, ts) => {
      let p = state.pos[card];
      if (!p) p = state.pos[card] = { x: DECK.x - CW / 2, y: DECK.y - 100, sc: 0.35, born: state.t + 0.05 * Object.keys(state.pos).length };
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.sc += (ts - p.sc) * k;
    };
    const hand = H.hands[0], n = hand.length;
    hand.forEach((c, i) => {
      const s = handSlot(i, n); let ty = s.y - (ui.sel === c ? LIFT : 0), tx = s.x;
      if (ui.drag && ui.drag.card === c && ui.drag.moved) { tx = ui.drag.x - CW / 2; ty = ui.drag.y - 100; }
      put(c, tx, ty, 1);
    });
    const tt = state.show ? state.show.plays : H.trick;
    for (const pl of tt) {
      let tx = TRICK[pl.seat].x - CW * 0.757 / 2, ty = TRICK[pl.seat].y - 208 * 0.757 / 2, ts = 0.757;
      if (state.show && state.show.t > (state.set.calm ? 0.8 : HOLD)) { const w = SEAT[state.show.winner]; tx = w.x - CW * 0.2; ty = w.y - 40; ts = 0.25; }
      put(pl.card, tx, ty, ts);
    }
    // opponents' backs "deal" in one by one
    for (let s = 1; s < 4; s++) {
      const want = H.hands[s].length;
      if (state.shown[s] > want) state.shown[s] = want;
      else if (state.shown[s] < want) { state.shown[s] = Math.min(want, state.shown[s] + dt * (state.set.calm ? 40 : 14)); if (Math.floor(state.shown[s]) !== Math.floor(state.shown[s] - dt * 14) && state.set.sound && Math.floor(state.shown[s] * 4) % 3 === 0) tick(); }
    }
    // drop positions of cards no longer on show
    const live = new Set([...hand, ...tt.map((p) => p.card)]);
    for (const key of Object.keys(state.pos)) if (!live.has(+key)) delete state.pos[key];
  }

  // ---- keyboard: arrows move over the hand / buttons, Enter or Space taps, Escape is Menu, H hint, U undo ---------
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene; if (input.pointer.pressed) return null;
    if (!k.size) return null;
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return { key: 'start' }; return null; }
    if (sc === 'over' || sc === 'demo-limit') { if (k.has('Enter') || k.has('Space')) return { x: OVERLAY_BTN.x + 5, y: OVERLAY_BTN.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'daily') { if (k.has('Escape')) return { x: BACK.x + 5, y: BACK.y + 5 }; return null; }
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (k.has('KeyH')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
    if (k.has('KeyU')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 };
    const H = state.H; if (!H) return null;
    if (ui.summary) { if (k.has('Enter') || k.has('Space')) return { x: OVERLAY_BTN.x + 5, y: OVERLAY_BTN.y + 5 }; return null; }
    const P = state.panel;
    if (P.length) {
      if (k.has('ArrowLeft') || k.has('ArrowUp')) ui.cursor = (ui.cursor + P.length - 1) % P.length; else if (k.has('ArrowRight') || k.has('ArrowDown')) ui.cursor = (ui.cursor + 1) % P.length;
      ui.cursor = Math.min(ui.cursor, P.length - 1); ui.kb = true;
      if (k.has('Enter') || k.has('Space')) { const r = P[ui.cursor].r; return { x: r.x + 5, y: r.y + 5 }; }
      return null;
    }
    const hand = H.hands[0]; if (!hand.length) return null;
    if (k.has('ArrowLeft')) { ui.cursor = Math.max(0, Math.min(hand.length - 1, ui.cursor) - 1); ui.kb = true; }
    else if (k.has('ArrowRight')) { ui.cursor = Math.min(hand.length - 1, ui.cursor + 1); ui.kb = true; }
    ui.cursor = Math.min(ui.cursor, hand.length - 1);
    if (k.has('Enter') || k.has('Space')) { ui.kb = true; const s = handSlot(ui.cursor, hand.length); return { x: s.x + 14, y: HAND_Y + 60, key: 'card' }; }
    return null;
  }

  function settingsRows() { return ['sound', 'calm', 'big', 'four'].map((key, i) => ({ key, r: { x: 60, y: 300 + i * 150, w: 600, h: 116 } })); }
  function lessonRow(i) { return { x: 40, y: 200 + i * 116, w: 640, h: 100 }; }

  return {
    update(dt, input) {
      state.t += dt;
      const p = input.pointer, kbd = keyboard(input);
      let tap = p.pressed ? { x: p.x, y: p.y } : kbd && kbd.x !== undefined ? kbd : null;
      const sc = state.scene;
      if (kbd && kbd.key === 'start' && sc === 'title') tap = { x: titleRows(!!state.saved).play.x + 5, y: titleRows(!!state.saved).play.y + 5 };
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'lessons') updateLessons(tap);
      else if (sc === 'about' || sc === 'how') updateSimple(tap);
      else if (sc === 'play' || sc === 'lesson' || sc === 'daily') {
        if (sc === 'daily' && state.daily.status === 'making') {
          if (!maker) maker = createDailyMaker(state.daily.day);
          if (tap && inRect(BTN.menu, tap.x, tap.y)) state.scene = 'title';
          const r = maker.step(); state.daily.made += 1; if (r.puzzle) { dailyPuzzle = r.puzzle; startDaily(); }
        } else {
          updateTable(dt, tap, input);
          if (state.H) { buildPanel(); if (kbd && kbd.key === 'card' && tap) { const c = cardAt(tap.x, tap.y); if (c >= 0) tryCard(c, false); } updatePos(dt); }
        }
      } else if (sc === 'over') {
        if (tap && inRect(OVERLAY_BTN, tap.x, tap.y)) { state.scene = 'title'; }
        if (tap && inRect({ x: 160, y: 1176, w: 400, h: 90 }, tap.x, tap.y)) startMatch();
      } else if (sc === 'demo-limit') { if (tap && inRect(OVERLAY_BTN, tap.x, tap.y)) state.scene = 'title'; }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
