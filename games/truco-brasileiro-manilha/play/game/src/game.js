// Truco Brasileiro: Manilha. State and flow. Rules live in rules.js, the computer in ai.js, drawing in view.js.
// This is the only file that changes `state` (view.js only caches layout hit-rects and the scroll limit).
//
// Controls: TAP a card to raise it, TAP it again (or DRAG it up) to play it. TAP TRUCO to shout. TAP buttons to answer.
import { W, H as HH, CW, HAND_Y, LIFT, BTN, TRICK, SEAT, DECK, TSC, handSlot, inRect, titleRows, largeTitle, ANS, ACT, SIGPOP, SIGCLOSE, TRUCO_BTN, OVERLAY_BTN, OVERLAY_BTN2, BACK, REF_BACK, REF_NEXT, TEXT_SCALES, TEXT_DEC, TEXT_INC, AUTO_THINK_STEPS, AUTO_REVEAL_SECS, AUTO_DEC, AUTO_INC } from './layout.js';
import { RULES, ABOUT, HOWTO } from './rulesContent.js';
import * as RL from './rules.js';
import { levelOf, makeCtx, turnAction, answerDecision, specialDecision, aiSignalKind } from './ai.js';
import { render } from './view.js';
import { feedPointer } from './art.js';

export const meta = { width: W, height: HH };
const DEMO_HANDS = 5, HINTS_PER_HAND = 3, HOLD = 1.2;
const copy = (o) => JSON.parse(JSON.stringify(o));
const SCROLL_SCENES = new Set(['about', 'how', 'rules', 'settings', 'over']);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const fxRng = rng.fork();
  const state = {
    scene: 'title', t: 0,
    set: { sound: true, calm: false, big: false, four: false },
    variant: 'paulista', n: 4, level: 2,
    textScaleIdx: 0, autoThinkIdx: 1,
    match: { scores: [0, 0], dealer: 0, hands: 0, winner: -1 },
    H: null,
    ui: { sel: -1, msg: null, hint: null, hintsLeft: HINTS_PER_HAND, delay: 0, cursor: 0, kb: false, drag: null, summary: null, refuse: null, sig: false, ranTeam: -1, bluffRun: null, thinking: false },
    pos: {}, show: null, says: [null, null, null, null], vis: [false, false, false, false], shown: [0, 0, 0, 0], fx: [], banner: null, shake: 0, sigQueue: [],
    panel: [], panelText: [], hits: [],
    stats: { played: 0, wins: 0, hands: 0, handsWon: 0, runsFromMe: 0, trucos: 0 },
    model: [{ asked: 0, folded: 0 }, { asked: 0, folded: 0 }],
    saved: null, demoHands: 0, page: 0, aboutPage: 0, howPage: 0,
    scroll: 0, maxScroll: 0, g: null, dealT: 0,
    auto: null, autoMatch: null, dev: config.dev === true,
  };
  const ui = state.ui;
  if (config.dev) globalThis.__truco = { state, start: () => startMatch(), auto: () => startAutoPlay(), deal: (a, b) => { state.scene = 'play'; state.match = { scores: [a, b], dealer: 0, hands: 0, winner: -1 }; nextHand(); } };   // tester hook (dev only)

  // ---- storage -------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.variant = v.variant === 'mineiro' ? 'mineiro' : 'paulista'; state.n = v.n === 2 ? 2 : 4; state.level = Math.min(3, Math.max(1, v.level ?? 2));
    state.set = { ...state.set, ...(v.set || {}) }; audio.setMuted?.(!state.set.sound);
    state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1);
    state.autoThinkIdx = Math.min(Math.max(v.autoThinkIdx ?? 1, 0), AUTO_THINK_STEPS.length - 1);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('demoHands', 0).then((v) => { state.demoHands = Math.max(state.demoHands, v); });
  storage.get('save', null).then((v) => { if (v && v.match && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { variant: state.variant, n: state.n, level: state.level, set: state.set, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };
  const saveGame = () => {
    if (state.scene !== 'play' || !state.H || state.H.phase === 'done' || state.show || ui.summary) return;
    state.saved = { H: copy(state.H), match: copy(state.match), variant: state.variant, n: state.n, level: state.level, model: copy(state.model) };
    storage.set('save', state.saved);
  };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  // ---- helpers -------------------------------------------------------------------------------------------------
  const isAuto = () => state.scene === 'auto';
  const human = (seat) => !isAuto() && seat === 0;
  const NAMES4 = ['You', 'Right', 'Partner', 'Left'];
  const seatName = (s) => (state.H && state.H.n === 2 ? (s === 0 ? 'You' : 'Opponent') : NAMES4[s]);
  const teamName = (t) => (t === 0 ? 'Your team' : 'The other team');
  const say = (text, hold = 3.6) => { ui.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.set.sound && state.scene !== 'auto') audio.tone(o); };
  const slap = () => tone({ freq: 240, to: 90, dur: 0.07, type: 'triangle', vol: 0.13 });
  const tick = () => tone({ freq: 700, to: 500, dur: 0.03, type: 'sine', vol: 0.05 });
  const chime = (up = true) => { tone({ freq: up ? 520 : 330, to: up ? 880 : 240, dur: 0.35, type: 'triangle', vol: 0.09 }); if (up) tone({ freq: 780, to: 1180, dur: 0.3, type: 'sine', vol: 0.05 }); };
  const buzz = () => tone({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.05 });
  const shoutSfx = (lvl) => { tone({ freq: 160 + lvl * 40, to: 420 + lvl * 90, dur: 0.28, type: 'sawtooth', vol: 0.12 }); tone({ freq: 90, to: 60, dur: 0.3, type: 'square', vol: 0.06 }); };
  const dly = (d) => (state.set.calm ? d * 0.6 : d);
  const posIdx = (seat) => RL.posOf(state.H.n, seat);
  const modelFor = (team) => (isAuto() ? state.autoMatch.model[team] : state.model[team]);

  function burst(x, y, col, n = 18, spread = 260) {
    if (state.set.calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) { const a = fxRng.range(0, Math.PI * 2), sp = fxRng.range(spread * 0.3, spread); state.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: fxRng.range(0.6, 1.2), max: 1.2, size: fxRng.range(4, 9), col, g: 520 }); }
    if (state.fx.length > 240) state.fx.splice(0, state.fx.length - 240);
  }
  function banner(text, sub, col = '#ffd23f', dur = 1.5) { state.banner = { text, sub, col, t: 0, dur }; }
  function speak(seat, text) { state.says[seat] = { text, t: 0 }; }

  // ---- hand flow -------------------------------------------------------------------------------------------------
  function beginHand(H) {
    state.H = H; state.pos = {}; state.show = null; state.says = [null, null, null, null]; state.vis = [false, false, false, false]; state.shown = [0, 0, 0, 0];
    ui.sel = -1; ui.hint = null; ui.hintsLeft = HINTS_PER_HAND; ui.summary = null; ui.drag = null; ui.sig = false; ui.ranTeam = -1; ui.bluffRun = null; ui.thinking = false;
    ui.delay = dly(1.4); state.dealT = 0; state.banner = null; state.scroll = 0;
    state.sigQueue = H.n === 4 && H.special !== 'iron' ? [2, 1, 3, ...(isAuto() ? [0] : [])] : [];
    if (H.special === 'iron') banner('MÃO DE FERRO', 'Blind hand: nobody may look', '#ff9a3c', 2.2);
    else if (H.special === 'eleven') banner(RL.VARIANTS[H.variant].specialName.toUpperCase(), `${teamName(H.specialTeam)} decides`, '#ffd23f', 2);
  }
  function startMatch() {
    if (config.demo && state.demoHands >= DEMO_HANDS) { state.scene = 'demo-limit'; return; }
    state.match = { scores: [0, 0], dealer: rng.int(state.n), hands: 0, winner: -1 };
    state.model = [{ asked: 0, folded: 0 }, { asked: 0, folded: 0 }];
    clearSave(); state.scene = 'play'; nextHand();
    monetization.track('match_start', { variant: state.variant, n: state.n, level: state.level });
  }
  function nextHand() {
    if (config.demo && state.demoHands >= DEMO_HANDS) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoHands += 1; storage.set('demoHands', state.demoHands); }
    const M = state.match; M.hands += 1;
    beginHand(RL.newHand(rng, { variant: state.variant, n: state.n, scores: M.scores.slice(), dealer: M.dealer }));
    const first = state.H.lead0;
    say(`${seatName(M.dealer)} dealt. ${first === 0 ? 'You lead.' : seatName(first) + ' leads.'}`, 3);
  }
  function resumeMatch() {
    const v = state.saved; state.match = copy(v.match); state.variant = v.variant; state.n = v.n; state.level = v.level; state.model = v.model || state.model;
    state.scene = 'play';
    if (v.H) { beginHand(copy(v.H)); ui.delay = 0.5; state.sigQueue = []; say('Match restored.'); } else nextHand();
  }

  // who answers a pending shout (the human answers for the human team)
  function respSeat(H, P) {
    const t = 1 - P.team;
    if (t === 0 && !isAuto()) return 0;
    let s = (P.seat + 1) % H.n, g = 0;
    while (H.teamOf[s] !== t && g++ < 8) s = (s + 1) % H.n;
    return s;
  }

  function doSignal(seat, kind) {
    const H = state.H;
    H.signals[seat] = kind; H.signalled[seat] = true;
    const team = H.teamOf[seat], hs = isAuto() ? -1 : 0;
    for (let o = 0; o < H.n; o++) if (H.teamOf[o] !== team && o !== hs && rng.chance(levelOf(state.level).catchP)) H.noticed[seat].push(o);
    const visible = isAuto() || seat === 0 || team === 0 || fxRng.chance(0.3);
    if (visible) { state.vis[seat] = true; state.says[seat] = { gesture: kind, text: RL.signalLabel(kind), t: 0 }; }
    if (!isAuto() && team === 1 && visible) say(`You catch ${seatName(seat)} signalling: ${RL.signalLabel(kind)}.`, 4);
    tone({ freq: 520, to: 700, dur: 0.1, type: 'triangle', vol: 0.06 });
  }
  function doPlay(c) {
    const H = state.H, seat = H.turn, pi = posIdx(seat);
    if (!state.pos[c]) state.pos[c] = { x: SEAT[pi].x - CW * 0.37, y: SEAT[pi].y - CW * 0.5, sc: 0.5, born: state.t };
    slap();
    const r = RL.playCard(H, c); ui.sel = -1; ui.hint = null; ui.sig = false;
    if (r && r.trick) {
      const last = H.tricks[H.tricks.length - 1];
      state.show = { plays: last.plays.map((p) => ({ ...p })), winner: last.winSeat, team: last.winTeam, t: 0, done: r.done };
      ui.delay = 0;
    }
  }
  function doRaise(seat, bluff) {
    const H = state.H, idx = RL.callRaise(H, seat);
    H.answerSeat = respSeat(H, H.pending); if (bluff) H.bluffs[idx] = true;
    const word = RL.shoutName(H, idx), val = RL.VARIANTS[H.variant].vals[idx];
    speak(seat, word + '!'); banner(word.toUpperCase() + '!', `${seatName(seat)} ${seat === 0 && !isAuto() ? 'call' : 'calls'} it: worth ${val}`, idx >= 3 ? '#ff5a3c' : '#ffd23f', 1.4);
    state.shake = 11 + idx * 3; shoutSfx(idx); burst(W / 2, 760, idx >= 3 ? '#ff7a4c' : '#ffd23f', 22 + idx * 6);
    ui.delay = dly(1.1); ui.hint = null; ui.sig = false;
    if (seat === 0 && !isAuto()) state.stats.trucos += 1;
  }
  function doAnswer(kind, seat) {
    const H = state.H, P = H.pending, t = 1 - P.team, m = modelFor(t);
    m.asked += 1; if (kind === 'fold') m.folded += 1;
    ui.hint = null;
    if (kind === 'accept') {
      RL.answerRaise(H, 'accept'); speak(seat, 'Accept'); chime(); banner('ACCEPTED', `Hand worth ${RL.value(H)}`, '#7be07b', 1.0); ui.delay = dly(0.8);
    } else if (kind === 'fold') {
      ui.ranTeam = t; speak(seat, 'Run!'); buzz(); ui.bluffRun = H.bluffs[P.idx] ? { team: P.team, idx: P.idx, seat: P.seat, hands: H.hands.map((h) => h.slice()) } : null;
      RL.answerRaise(H, 'fold'); ui.delay = dly(1.3);
      if (P.team === 0 && !isAuto()) state.stats.runsFromMe += 1;
    } else {
      H.answerSeat = seat; const res = RL.answerRaise(H, 'raise'); H.answerSeat = respSeat(H, H.pending);
      const word = RL.shoutName(H, res.idx), val = RL.VARIANTS[H.variant].vals[res.idx];
      speak(seat, word + '!'); banner(word.toUpperCase() + '!', `${seatName(seat)} ${seat === 0 && !isAuto() ? 'raise' : 'raises'}: worth ${val}`, res.idx >= 3 ? '#ff5a3c' : '#ffd23f', 1.4);
      state.shake = 12 + res.idx * 3; shoutSfx(res.idx); burst(W / 2, 760, '#ff7a4c', 28); ui.delay = dly(1.1);
    }
  }
  function doSpecial(play, seat) {
    const H = state.H, V = RL.VARIANTS[H.variant];
    RL.answerSpecial(H, play); ui.hint = null;
    if (play) { speak(seat, 'Play!'); chime(); banner('PLAY!', `Hand worth ${V.specialVal}, no shouting`, '#7be07b', 1.1); ui.delay = dly(0.9); }
    else { ui.ranTeam = H.specialTeam; speak(seat, 'Run!'); buzz(); ui.delay = dly(1.1); }
  }

  function finishHand() {
    const H = state.H, r = H.result, M = isAuto() ? state.autoMatch : state.match;
    const before = M.scores.slice();
    M.scores = RL.applyResult(M.scores, r);
    const mw = RL.matchWinner(M.scores);
    M.dealer = (M.dealer + 1) % H.n;
    if (!isAuto()) { state.stats.hands += 1; if (r.winner === 0) state.stats.handsWon += 1; }
    const bl = r.why === 'run' && ui.bluffRun ? ui.bluffRun : null;
    ui.summary = { result: copy(r), before, after: M.scores.slice(), mw, ranTeam: ui.ranTeam, bluff: bl, value: r.points, auto: isAuto() };
    ui.bluffRun = null; state.scroll = 0;
    const mine = r.winner === 0;
    if (r.winner >= 0) { chime(mine); burst(W / 2, 900, mine ? '#ffd23f' : '#ff7a6a', 36, 360); }
    if (mw >= 0) {
      M.winner = mw;
      if (!isAuto()) { state.stats.played += 1; if (mw === 0) state.stats.wins += 1; saveStats(); clearSave(); monetization.track('match_end', { winner: mw, variant: state.variant, n: state.n, level: state.level, hands: M.hands }); }
    } else if (!isAuto()) { state.saved = { H: null, match: copy(state.match), variant: state.variant, n: state.n, level: state.level, model: copy(state.model), between: true }; storage.set('save', state.saved); }
  }

  // ---- the computer's decisions: one plan per decision (used by real play and by Auto Play) -------------------
  function actor() {
    const H = state.H;
    if (H.phase === 'special') return { kind: 'special', seat: [...Array(H.n).keys()].find((s) => H.teamOf[s] === H.specialTeam) };
    if (H.phase === 'raise') return { kind: 'answer', seat: H.answerSeat };
    if (H.phase === 'play') return { kind: 'turn', seat: H.turn };
    return null;
  }
  function makePlan(a) {
    const H = state.H, seat = a.seat, ctx = makeCtx(H, seat, { model: modelFor(1 - H.teamOf[seat]), level: state.level });
    if (a.kind === 'special') { const d = specialDecision(H, seat, rng, state.level, ctx); return { ...a, play: d.play, p: d.p }; }
    if (a.kind === 'answer') { const d = answerDecision(H, seat, rng, state.level, ctx); return { ...a, action: d.action, p: d.p }; }
    const t = turnAction(H, seat, rng, state.level, ctx);
    return { ...a, ...t };
  }
  function applyPlan(p) {
    if (p.kind === 'special') doSpecial(p.play, p.seat);
    else if (p.kind === 'answer') doAnswer(p.action, p.seat);
    else if (p.type === 'raise') doRaise(p.seat, p.bluff);
    else { doPlay(p.card); if (!state.show) ui.delay = dly(0.5); }
  }

  // ---- hints -----------------------------------------------------------------------------------------------------
  function askHint() {
    const H = state.H;
    if (!H || H.phase === 'done' || state.show || ui.delay > 0 || ui.summary) return;
    const a = actor(); if (!a || a.seat !== 0) return;
    if (H.special === 'iron') { say('Blind hand: there is nothing to see. Just pick a card.', 4); return; }
    if (ui.hintsLeft <= 0) { say('No hints left in this hand.'); return; }
    ui.hintsLeft -= 1;
    const ctx = makeCtx(H, 0, { model: modelFor(1), level: 3 });
    if (a.kind === 'special') { const d = specialDecision(H, 0, rng, 3, ctx, { hint: true }); ui.hint = { kind: 'special', play: d.play, t: 0 }; say(`Hint: ${d.play ? 'Play' : 'Run'}. ${d.why}`, 8); return; }
    if (a.kind === 'answer') {
      const d = answerDecision(H, 0, rng, 3, ctx, { hint: true }); ui.hint = { kind: 'answer', action: d.action, t: 0 };
      say(`Hint: ${d.action === 'accept' ? 'Accept' : d.action === 'fold' ? 'Run' : 'Raise'}. ${d.why}`, 8); return;
    }
    const t = turnAction(H, 0, rng, 3, ctx, { hint: true });
    if (t.type === 'raise') { ui.hint = { kind: 'truco', t: 0 }; say(`Hint: shout ${RL.shoutName(H, H.stakeIdx + 1)}! About ${Math.round((t.p ?? 0.5) * 100)}% to win the hand.`, 8); }
    else { ui.hint = { kind: 'card', card: t.card, t: 0 }; say(`Hint: ${RL.cardName(H, t.card)}. ${t.why}`, 9); }
  }

  // ---- Auto Play (Watch & Learn) -------------------------------------------------------------------------------------
  // The computer plays EVERY seat through THINK -> REVEAL -> ACT for each decision, using the same plans and the same
  // execution functions as real play. It keeps its own match (never state.match), its own opponent model, and never calls
  // saveGame/clearSave/saveStats/monetization.track, so it cannot touch the player's save or stats. Silent by construction.
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  function startAutoPlay() {
    state.scene = 'auto';
    state.autoMatch = { scores: [0, 0], dealer: rng.int(state.n), hands: 0, winner: -1, model: [{ asked: 0, folded: 0 }, { asked: 0, folded: 0 }] };
    autoNextHand();
  }
  function autoNextHand() {
    const M = state.autoMatch; M.hands += 1;
    beginHand(RL.newHand(rng, { variant: state.variant, n: state.n, scores: M.scores.slice(), dealer: M.dealer }));
    state.auto = { phase: 'think', timer: 0, plan: null, paused: false };
    say(`Auto Play: ${seatName(M.dealer)} dealt.`, 3);
  }
  function teardownAuto() { state.auto = null; state.autoMatch = null; ui.hint = null; state.panel = []; ui.summary = null; state.show = null; state.H = null; state.banner = null; state.fx = []; }
  function updateAuto(dt, tap) {
    const A = state.auto; if (!A) return;
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { teardownAuto(); state.scene = 'title'; state.scroll = 0; return; }
    if (tap && inRect(AUTO_DEC, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx -= 1; savePrefs(); tick(); } return; }
    if (tap && inRect(AUTO_INC, tap.x, tap.y)) { if (state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx += 1; savePrefs(); tick(); } return; }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) { if (A.phase === 'think') A.timer = autoThinkSecs(); else if (A.phase === 'reveal') A.timer = AUTO_REVEAL_SECS; else if (A.phase === 'summary') A.timer = 999; return; }
    if (tap && inRect(BTN.sig, tap.x, tap.y)) { A.paused = !A.paused; return; }
    if (A.phase === 'ended') {
      if (tap && inRect(OVERLAY_BTN, tap.x, tap.y)) startAutoPlay();
      else if (tap && inRect(OVERLAY_BTN2, tap.x, tap.y)) { teardownAuto(); state.scene = 'title'; }
      return;
    }
    if (A.paused) return;   // nothing below runs while paused: timers, searches, animations and particles all freeze
    const H = state.H; if (!H) return;
    tickWorld(dt);
    if (state.show) { updateShow(dt); if (!state.show) { if (H.phase === 'done') { finishHand(); A.phase = 'summary'; A.timer = 0; } else { A.phase = 'think'; A.timer = 0; } } return; }
    if (A.phase === 'summary') {
      A.timer += dt;
      if (A.timer > 3.2) { if (ui.summary.mw >= 0) A.phase = 'ended'; else { ui.summary = null; autoNextHand(); } }
      return;
    }
    if (ui.delay > 0) { ui.delay -= dt; return; }
    if (H.phase === 'done') { finishHand(); A.phase = 'summary'; A.timer = 0; return; }
    if (state.sigQueue.length && H.phase === 'play') { const s = state.sigQueue.shift(), k = aiSignalKind(H, s, rng, state.level); if (k) { doSignal(s, k); ui.delay = 0.6; } return; }
    if (A.phase === 'think') { A.timer += dt; if (A.timer >= autoThinkSecs()) { A.plan = makePlan(actor()); startReveal(A.plan); A.phase = 'reveal'; A.timer = 0; } return; }
    if (A.phase === 'reveal') { A.timer += dt; if (A.timer >= AUTO_REVEAL_SECS) { A.phase = 'act'; A.timer = 0; } return; }
    if (A.phase === 'act') { const p = A.plan; A.plan = null; ui.hint = null; applyPlan(p); A.phase = 'think'; A.timer = 0; }
  }
  function startReveal(p) {
    // The reveal highlights the exact options on offer and the chosen one, reusing the hint glow machinery.
    if (p.kind === 'special') ui.hint = { kind: 'special', play: p.play, t: 0 };
    else if (p.kind === 'answer') ui.hint = { kind: 'answer', action: p.action, t: 0 };
    else if (p.type === 'raise') ui.hint = { kind: 'truco', t: 0 };
    else ui.hint = { kind: 'card', card: p.card, t: 0 };
  }

  // ---- shared per-frame world updates ---------------------------------------------------------------------------------
  function tickWorld(dt) {
    if (ui.msg) { ui.msg.t += dt; if (ui.msg.t > ui.msg.hold) ui.msg = null; }
    for (let s = 0; s < 4; s++) if (state.says[s]) { state.says[s].t += dt; if (state.says[s].t > 3.4) state.says[s] = null; }
    if (ui.refuse) { ui.refuse.t += dt; if (ui.refuse.t > 0.6) ui.refuse = null; }
    if (ui.hint) ui.hint.t += dt;
    state.dealT += dt;
    for (const f of state.fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += f.g * dt; }
    state.fx = state.fx.filter((f) => f.life > 0);
    if (state.banner) { state.banner.t += dt; if (state.banner.t > state.banner.dur) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 40);
  }
  function updateShow(dt) {
    state.show.t += dt;
    if (state.show.t > (state.set.calm ? 0.8 : HOLD) + 0.4) { state.show = null; ui.delay = Math.max(ui.delay, dly(0.25)); }
  }

  // ---- title and pages -----------------------------------------------------------------------------------------------------
  const scale = () => TEXT_SCALES[state.textScaleIdx] ?? 1;
  function stepText(d) {
    const i = Math.min(Math.max(state.textScaleIdx + d, 0), TEXT_SCALES.length - 1);
    if (i !== state.textScaleIdx) { state.textScaleIdx = i; state.scroll = 0; savePrefs(); tick(); }
  }
  function stepTextTap(tap) {
    if (inRect(TEXT_DEC, tap.x, tap.y)) { stepText(-1); return true; }
    if (inRect(TEXT_INC, tap.x, tap.y)) { stepText(1); return true; }
    return false;
  }
  function updateTitle(tap) {
    if (!tap) return;
    if (stepTextTap(tap)) return;
    const act = (id) => {
      if (id === 'resume') resumeMatch();
      else if (id === 'play') startMatch();
      else if (id === 'how') { state.scene = 'how'; state.howPage = 0; state.scroll = 0; }
      else if (id === 'rules') { state.scene = 'rules'; state.page = 0; state.scroll = 0; }
      else if (id === 'about') { state.scene = 'about'; state.aboutPage = 0; state.scroll = 0; }
      else if (id === 'settings') { state.scene = 'settings'; state.scroll = 0; }
      else if (id === 'auto') startAutoPlay();
      else if (id === 'variant') { state.variant = state.variant === 'paulista' ? 'mineiro' : 'paulista'; savePrefs(); tick(); }
      else if (id === 'players') { state.n = state.n === 4 ? 2 : 4; savePrefs(); tick(); }
      else if (id === 'level') { state.level = state.level % 3 + 1; savePrefs(); tick(); }
    };
    if (state.textScaleIdx > 0) {
      const L = largeTitle(scale(), !!state.saved);
      for (const [id, r] of Object.entries(L.rows)) if (inRect({ ...r, y: r.y - state.scroll }, tap.x, tap.y)) { act(id); return; }
      return;
    }
    const R = titleRows(!!state.saved), hit = (r) => r && inRect(r, tap.x, tap.y);
    const setv = (v) => { if (state.variant !== v) { state.variant = v; savePrefs(); tick(); } };
    const setn = (n) => { if (state.n !== n) { state.n = n; savePrefs(); tick(); } };
    const setl = (l) => { if (state.level !== l) { state.level = l; savePrefs(); tick(); } };
    if (hit(R.resume)) act('resume'); else if (hit(R.play)) act('play');
    else if (hit(R.variant[0])) setv('paulista'); else if (hit(R.variant[1])) setv('mineiro');
    else if (hit(R.players[0])) setn(2); else if (hit(R.players[1])) setn(4);
    else if (hit(R.level[0])) setl(1); else if (hit(R.level[1])) setl(2); else if (hit(R.level[2])) setl(3);
    else if (hit(R.how)) act('how'); else if (hit(R.rules)) act('rules'); else if (hit(R.about)) act('about'); else if (hit(R.settings)) act('settings'); else if (hit(R.auto)) act('auto');
  }
  // Back steps to the previous page (or leaves from page 1); Next steps forward and reads Done on the last page.
  function updateRef(tap, list, key) {
    if (!tap) return;
    if (stepTextTap(tap)) return;
    if (inRect(REF_BACK, tap.x, tap.y)) { if (state[key] > 0) { state[key] -= 1; state.scroll = 0; } else { state.scene = 'title'; state.scroll = 0; } return; }
    if (inRect(REF_NEXT, tap.x, tap.y)) { if (state[key] >= list.length - 1) { state.scene = 'title'; state[key] = 0; state.scroll = 0; } else { state[key] += 1; state.scroll = 0; tick(); } }
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; state.scroll = 0; return; }
    for (const h of state.hits) if (inRect(h.r, tap.x, tap.y)) {
      if (h.key === 'dec') stepText(-1); else if (h.key === 'inc') stepText(1);
      else { state.set[h.key] = !state.set[h.key]; if (h.key === 'sound') audio.setMuted?.(!state.set.sound); savePrefs(); tick(); }
      return;
    }
  }
  function updateOver(tap) {
    if (!tap) return;
    if (stepTextTap(tap)) return;
    if (inRect(OVERLAY_BTN2, tap.x, tap.y)) startMatch();
    else if (inRect(OVERLAY_BTN, tap.x, tap.y)) { state.scene = 'title'; state.scroll = 0; }
  }

  // ---- the table ----------------------------------------------------------------------------------------------------------
  function cardAt(px, py) {
    const H = state.H; if (!H || H.phase !== 'play') return -1;
    const hand = H.hands[0], n = hand.length; if (!n) return -1;
    const s = handSlot(0, n), step = s.step;
    if (py < HAND_Y - LIFT - 4 || py > HAND_Y + 214) return -1;
    if (px < s.x || px > s.x + CW + step * (n - 1)) return -1;
    let i = step ? Math.min(n - 1, Math.floor((px - s.x) / step)) : 0;
    if (ui.sel >= 0) { const j = hand.indexOf(ui.sel); if (j >= 0) { const sx = handSlot(j, n).x; if (px >= sx && px <= sx + CW && py < HAND_Y + 30) i = j; } }
    return hand[i];
  }
  function tryCard(c, viaDrag) {
    const H = state.H;
    if (H.turn !== 0 || H.phase !== 'play' || state.show || ui.delay > 0 || ui.summary) return;
    if (ui.sig) ui.sig = false;
    if (ui.sel !== c && !viaDrag) { ui.sel = c; tick(); return; }
    doPlay(c);
  }
  function buildPanel() {
    const H = state.H, P = []; state.panelText = [];
    if (!H || state.show || ui.summary || isAuto()) { state.panel = []; return; }
    const V = RL.VARIANTS[H.variant];
    if (H.phase === 'special' && H.specialTeam === 0 && ui.delay <= 0) {
      P.push({ r: ACT.a, kind: 'special', play: true, label: `Play for ${V.specialVal}`, sub: 'no shouting', primary: true });
      P.push({ r: ACT.b, kind: 'special', play: false, label: 'Run', sub: `they score ${V.specialRun}` });
      state.panelText = [`${V.specialName}: you are on ${H.scoresAtDeal[0]}.`, H.n === 4 ? "You can see your partner's cards." : 'Look at your cards, then decide.'];
    } else if (H.phase === 'raise' && H.answerSeat === 0 && ui.delay <= 0) {
      const Pd = H.pending, up = Pd.idx < 4;
      P.push({ r: ANS[0], kind: 'answer', action: 'accept', label: 'Accept', sub: `worth ${V.vals[Pd.idx]}`, primary: true });
      P.push({ r: ANS[1], kind: 'answer', action: 'fold', label: 'Run', sub: `they score ${V.vals[Pd.idx - 1]}` });
      if (up) P.push({ r: ANS[2], kind: 'answer', action: 'raise', label: V.shouts[Pd.idx + 1] + '!', sub: `worth ${V.vals[Pd.idx + 1]}`, danger: true });
      state.panelText = [`${seatName(Pd.seat)} calls ${V.shouts[Pd.idx].toUpperCase()}: the hand is worth ${V.vals[Pd.idx]}.`];
    } else if (ui.sig && H.phase === 'play' && !H.signalled[0]) {
      RL.SIGNALS.forEach((s, i) => P.push({ r: SIGPOP[i], kind: 'signal', id: s.id, label: s.label, sub: s.sub, gesture: s.id }));
      P.push({ r: SIGCLOSE, kind: 'sigclose', label: 'Close', small: true });
      state.panelText = ['Tell your partner your best card:'];
    }
    state.panel = P;
  }
  function panelTap(b) {
    if (b.kind === 'special') doSpecial(b.play, 0);
    else if (b.kind === 'answer') doAnswer(b.action, 0);
    else if (b.kind === 'signal') { ui.sig = false; doSignal(0, b.id); const pt = RL.partnerOf(state.H.n, 0); if (pt >= 0 && fxRng.chance(0.8)) speak(pt, 'Ok!'); }
    else if (b.kind === 'sigclose') ui.sig = false;
  }
  const trucoAllowed = () => { const H = state.H; return !!H && !isAuto() && RL.canRaise(H, 0) && !state.show && ui.delay <= 0 && !ui.summary; };
  function updateTable(dt, tap, input) {
    const H = state.H;
    tickWorld(dt);
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; state.scroll = 0; return; }
    if (ui.summary) { tableSummary(tap); return; }
    if (state.show) { updateShow(dt); if (!state.show && H.phase === 'done') finishHand(); return; }
    if (ui.delay > 0) { ui.delay -= dt; return; }
    if (H.phase === 'done') { finishHand(); return; }
    if (state.sigQueue.length && H.phase === 'play') {   // the computer's gestures come before the first play
      const s = state.sigQueue.shift(), k = aiSignalKind(H, s, rng, state.level);
      if (k) { doSignal(s, k); ui.delay = dly(0.75); }
      return;
    }
    const a = actor(); if (!a) return;
    if (!human(a.seat)) { ui.thinking = true; applyPlan(makePlan(a)); ui.thinking = false; return; }
    // ---- the human acts
    if (tap) for (const b of state.panel) if (inRect(b.r, tap.x, tap.y)) { panelTap(b); return; }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) { askHint(); return; }
    if (tap && inRect(BTN.sig, tap.x, tap.y) && H.n === 4 && H.phase === 'play' && !H.signalled[0]) { ui.sig = !ui.sig; ui.sel = -1; return; }
    if (H.phase !== 'play') return;
    if (tap && trucoAllowed() && inRect(TRUCO_BTN, tap.x, tap.y)) { doRaise(0, false); return; }
    const pointer = input.pointer;
    if (pointer.pressed && !ui.sig) { const c = cardAt(pointer.x, pointer.y); if (c >= 0) ui.drag = { card: c, sx: pointer.x, sy: pointer.y, x: pointer.x, y: pointer.y, moved: false }; }
    else if (ui.drag && pointer.down) { ui.drag.x = pointer.x; ui.drag.y = pointer.y; if (Math.abs(pointer.y - ui.drag.sy) > 26) ui.drag.moved = true; }
    if (ui.drag && (pointer.released || !pointer.down) && !pointer.pressed) {
      const d = ui.drag; ui.drag = null;
      if (d.moved && d.sy - d.y > 90) tryCard(d.card, true);
      else if (!d.moved || Math.abs(d.y - d.sy) <= 26) tryCard(d.card, false);
    }
  }
  function tableSummary(tap) {
    const S = ui.summary;
    if (!tap) return;
    if (stepTextTap(tap)) return;
    if (!inRect(OVERLAY_BTN, tap.x, tap.y)) return;
    ui.summary = null; state.scroll = 0;
    if (S.mw >= 0) { state.scene = 'over'; return; }
    nextHand();
  }

  function updatePos(dt) {
    const H = state.H; if (!H) return;
    const k = 1 - Math.exp(-dt * (state.set.calm ? 18 : 11));
    const put = (c, tx, ty, ts) => {
      let p = state.pos[c];
      if (!p) p = state.pos[c] = { x: DECK.x - CW / 2, y: DECK.y - 100, sc: 0.35, born: state.t + 0.07 * Object.keys(state.pos).length };
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.sc += (ts - p.sc) * k;
    };
    const hand = H.hands[0], n = hand.length;
    hand.forEach((c, i) => {
      const s = handSlot(i, n); let ty = s.y - (ui.sel === c ? LIFT : 0), tx = s.x;
      if (ui.drag && ui.drag.card === c && ui.drag.moved) { tx = ui.drag.x - CW / 2; ty = ui.drag.y - 100; }
      put(c, tx, ty, 1);
    });
    const tt = state.show ? state.show.plays : H.plays;
    for (const pl of tt) {
      const pi = posIdx(pl.seat);
      let tx = TRICK[pi].x - CW * TSC / 2, ty = TRICK[pi].y - 210 * TSC / 2, ts = TSC;
      if (state.show && state.show.t > (state.set.calm ? 0.8 : HOLD)) {
        if (state.show.winner >= 0) { const w = SEAT[posIdx(state.show.winner)]; tx = w.x - CW * 0.2; ty = w.y - 40; } else { tx = DECK.x - CW * 0.1; ty = DECK.y + 300; }
        ts = 0.25;
      }
      put(pl.card, tx, ty, ts);
    }
    for (let s = 1; s < H.n; s++) {
      const want = H.hands[s].length;
      if (state.shown[s] > want) state.shown[s] = want;
      else if (state.shown[s] < want) state.shown[s] = Math.min(want, state.shown[s] + dt * (state.set.calm ? 40 : 6));
    }
    const live = new Set([...hand, ...tt.map((p) => p.card)]);
    for (const key of Object.keys(state.pos)) if (!live.has(+key)) delete state.pos[key];
  }

  // ---- keyboard: arrows move over the hand / buttons, Enter or Space taps, Escape is Menu, H hint, S signal, T truco --
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene; if (input.pointer.pressed || !k.size) return null;
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return { key: 'start' }; return null; }
    if (sc === 'over' || sc === 'demo-limit') { if (k.has('Enter') || k.has('Space')) return { x: OVERLAY_BTN.x + 5, y: OVERLAY_BTN.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'auto') {
      if (k.has('Escape')) return { x: (sc === 'settings' ? BACK.x : REF_BACK.x) + 5, y: (sc === 'settings' ? BACK.y : REF_BACK.y) + 5 };
      if ((sc === 'about' || sc === 'how' || sc === 'rules') && (k.has('Enter') || k.has('Space') || k.has('ArrowRight'))) return { x: REF_NEXT.x + 5, y: REF_NEXT.y + 5 };
      return null;
    }
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (sc === 'auto') { if (k.has('Space')) return { x: BTN.sig.x + 5, y: BTN.sig.y + 5 }; return null; }
    if (k.has('KeyH')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
    if (k.has('KeyS')) return { x: BTN.sig.x + 5, y: BTN.sig.y + 5 };
    if (k.has('KeyT')) return { x: TRUCO_BTN.x + 5, y: TRUCO_BTN.y + 5 };
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

  // Pointer gestures for scrolling scenes: a drag scrolls, a still release is a tap at the press position.
  function gestureTap(input, scrollable) {
    const p = input.pointer;
    if (!scrollable) { state.g = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    let tap = null;
    if (p.pressed) state.g = { x: p.x, y: p.y, s0: state.scroll, moved: false };
    else if (state.g && p.down) {
      const dy = p.y - state.g.y; if (Math.abs(dy) > 14) state.g.moved = true;
      if (state.g.moved) state.scroll = Math.max(0, Math.min(state.maxScroll, state.g.s0 - dy));
    }
    if (state.g && p.released) { if (!state.g.moved) tap = { x: state.g.x, y: state.g.y }; state.g = null; }
    return tap;
  }

  return {
    update(dt, input) {
      feedPointer(input.pointer, dt);
      const sc = state.scene, paused = sc === 'auto' && state.auto?.paused;
      state.t += paused ? 0 : dt;
      const scrollable = SCROLL_SCENES.has(sc) || (sc === 'title' && state.textScaleIdx > 0) || !!ui.summary;
      const kbd = keyboard(input);
      let tap = gestureTap(input, scrollable);
      if (!tap && kbd && kbd.x !== undefined) tap = kbd;
      if (kbd && kbd.key === 'start' && sc === 'title') { const r = titleRows(!!state.saved); tap = state.textScaleIdx > 0 ? { x: 60, y: largeTitle(scale(), !!state.saved).rows.play.y - state.scroll + 5 } : { x: r.play.x + 5, y: r.play.y + 5 }; }
      if (state.maxScroll < state.scroll) state.scroll = state.maxScroll;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'about') updateRef(tap, ABOUT, 'aboutPage');
      else if (sc === 'how') updateRef(tap, HOWTO, 'howPage');
      else if (sc === 'rules') updateRef(tap, RULES, 'page');
      else if (sc === 'play') {
        updateTable(dt, tap, input);
        if (state.H) { buildPanel(); if (kbd && kbd.key === 'card' && tap) { const c = cardAt(tap.x, tap.y); if (c >= 0) tryCard(c, false); } updatePos(dt); }
      } else if (sc === 'over') updateOver(tap);
      else if (sc === 'demo-limit') { if (tap && inRect(OVERLAY_BTN, tap.x, tap.y)) { state.scene = 'title'; state.scroll = 0; } }
      else if (sc === 'auto') {
        updateAuto(dt, tap);
        if (state.H) updatePos(state.auto && state.auto.paused ? 0 : dt);   // paused: cards hold exactly where they were
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
    // Only real play spends the paid-preview time (kit/preview.js). Title, menus, Settings, About, How to Play, Rules,
    // Auto Play (Watch & Learn), result and demo-limit screens are all free.
    isPreviewExempt: () => state.scene !== 'play',
  };
}
