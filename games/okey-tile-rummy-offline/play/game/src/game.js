// Okey Offline: state and flow. Drawing lives in view.js, the rule book in rules.js, the computer players in ai.js.
// This is the only file that mutates `S` (the state).
//
// How a turn goes for the player: TAP the stack or the glowing pile on the left to draw, arrange the rack by DRAGGING
// tiles, then DRAG one tile onto your own pile (or tap it, then tap Discard) to end the turn. Computer players take
// their turns with short, human-sized pauses. Watch & Learn plays a whole deal with the computer at your seat:
// THINK (a timer) -> REVEAL (the options and the chosen move) -> ACT, with a real Pause that freezes everything.
import {
  W, H, ZOOM, use, RACK, slotRect, slotCenter, slotAt, TILE_S, STACK_C, INDICATOR_C, PILE_C, SEAT_POS, pileRect, stackRect, HUD_MENU, BTN, DISCARD_BTN, PAUSE, RESULT,
  DEMO, THINK_STEPS, titleRows, SET_BACK, setBtnRect, stepRect, LIMIT_BTN, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, REF_PANEL, TEXT_SCALES, inRect,
} from './layout.js';
import {
  newDeal, drawStack, takePile, discard, finishingDiscards, dealScores, solveHand, isWild, prevSeat, rackChunks, sortRack, smartRack,
  moveOnRack, syncRack, emptyRack, solveValue, unseenCounts, RACK_SLOTS,
} from './rules.js';
import { planDraw, planDiscard, hintFor, SEAT_NAMES, SEAT_NAMES_TR, thinkTime } from './ai.js';
import { L, tileLabel } from './text.js';
import { render } from './view.js';
import { PRESS } from './art.js';

// Fluid viewport (kit 1.7.x): the kit keeps meta.width/height at the live screen size (short side 720); layout.js lays everything out from it.
// Mouse wheel / trackpad scrolling for the reference readers (main.js adds to dy, in virtual units).
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
const DEMO_DEALS = 2; // the public web demo plays this many real deals, then stops
const MATCH_LENS = [1, 3, 5];
const SEAT_ROT = [0, Math.PI / 2, 0, Math.PI / 2];

export function createGame(env) {
  const { rng, storage, audio, config } = env;
  use(meta.width, meta.height, false);
  const S = {
    scene: 'title', t: 0, page: 0, pageCount: 1, scroll: 0, scrollMax: 0, scrollKey: '',
    prefs: { sound: true, level: 1, matchLen: 3, assist: true, terms: 'en', textScaleIdx: 0, thinkIdx: 1 },
    stats: { deals: 0, wins: 0, matches: 0, matchWins: 0, best: 0 },
    match: { deal: 1, total: 3, scores: [0, 0, 0, 0], starter: 0 },
    d: null, rack: emptyRack(), sel: -1, drag: null, newTile: -1, cursor: -1,
    ui: 'ready', seq: null, fly: [], flyHide: [], flyHideSeat: [0, 0, 0, 0], parts: [], toast: null, banner: null,
    status: { text: '', kind: 'info' }, hold: null, hint: null, over: null, overDelay: 0, pendingOver: null, paused: false,
    dealShow: [15, 15, 15, 15], dealT: 0,
    demo: { phase: 'think', timer: 0, speed: 1, paused: false, finished: false, plan: null },
    demoReveal: null, demoCap: null, demoDeals: 0, save: null, coachSeen: false,
  };
  // visual-only helpers; never part of the game state
  const V = { disp: {}, chunks: [], finishIds: null, rackSig: '', validSig: '', handSig: '' };
  const sfxQ = [];

  // ---- persistence -------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    const q = S.prefs;
    q.sound = p.sound !== false; q.level = Math.min(2, Math.max(0, p.level ?? 1)); q.matchLen = MATCH_LENS.includes(p.matchLen) ? p.matchLen : 3;
    q.assist = p.assist !== false; q.terms = p.terms === 'tr' ? 'tr' : 'en';
    q.textScaleIdx = Math.min(TEXT_SCALES.length - 1, Math.max(0, p.textScaleIdx | 0)); q.thinkIdx = Math.min(THINK_STEPS.length - 1, Math.max(0, p.thinkIdx ?? 1));
    audio.setMuted(!q.sound);
  });
  storage.get('stats', null).then((s) => { if (s) S.stats = { deals: s.deals | 0, wins: s.wins | 0, matches: s.matches | 0, matchWins: s.matchWins | 0, best: s.best | 0 }; });
  // a deal in progress is saved at every change of turn, so closing the app never loses it
  storage.get('save', null).then((v) => {
    const ok = v && v.d && Array.isArray(v.d.hands) && v.d.hands.length === 4 && Array.isArray(v.rack) && v.match && v.d.phase !== 'over';
    if (ok && !S.d) S.save = v;
  });
  const persistSave = () => {
    if (S.scene !== 'play' || !S.d || S.d.phase === 'over') return;
    S.save = { d: S.d, rack: S.rack, match: S.match };
    storage.set('save', S.save);
  };
  const clearSave = () => { if (S.save) { S.save = null; storage.remove('save'); } };
  storage.get('coach', false).then((c) => { S.coachSeen = !!c; });
  storage.get('demoDeals', 0).then((n) => { S.demoDeals = Math.max(S.demoDeals, n | 0); });

  // ---- small helpers -----------------------------------------------------------------------------------------
  const syncLayout = () => use(meta.width, meta.height, S.scene === 'demo');
  const tr = () => S.prefs.terms === 'tr';
  const names = () => (tr() ? SEAT_NAMES_TR : SEAT_NAMES);
  const say = (text, kind = 'info', secs = 4) => { S.hold = { text, kind, left: secs }; };
  const toast = (text, secs = 1.6) => { S.toast = { text, t: 0, max: secs }; };
  const myTurn = () => S.scene === 'play' && !!S.d && S.d.turn === 0 && S.d.phase !== 'over' && !S.over && !S.paused;
  const canAct = () => myTurn() && S.ui === 'ready';
  const tone = (o) => { if (S.prefs.sound && !(S.scene === 'demo' && S.demo.speed > 2)) audio.tone(o); };
  const later = (delay, o) => sfxQ.push({ at: S.t + delay, o });
  const sound = (name) => {
    if (name === 'click') tone({ freq: 240, to: 130, dur: 0.06, type: 'triangle', vol: 0.3 });
    else if (name === 'slide') tone({ freq: 330, to: 200, dur: 0.07, type: 'triangle', vol: 0.18 });
    else if (name === 'draw') { tone({ freq: 420, to: 300, dur: 0.09, type: 'triangle', vol: 0.25 }); later(0.07, { freq: 260, to: 180, dur: 0.07, type: 'triangle', vol: 0.18 }); }
    else if (name === 'discard') { tone({ freq: 200, to: 90, dur: 0.1, type: 'triangle', vol: 0.34 }); later(0.04, { freq: 520, to: 300, dur: 0.06, type: 'square', vol: 0.05 }); }
    else if (name === 'ok') tone({ freq: 640, to: 880, dur: 0.1, type: 'sine', vol: 0.14 });
    else if (name === 'meld') { tone({ freq: 700, dur: 0.1, type: 'sine', vol: 0.12 }); later(0.09, { freq: 940, dur: 0.16, type: 'sine', vol: 0.12 }); }
    else if (name === 'no') tone({ freq: 150, to: 110, dur: 0.14, type: 'sine', vol: 0.2 });
    else if (name === 'win') [523, 659, 784, 1046, 1318].forEach((f, k) => later(k * 0.13, { freq: f, dur: 0.34, type: 'sine', vol: 0.18 }));
    else if (name === 'lose') [392, 330, 262].forEach((f, k) => later(k * 0.18, { freq: f, dur: 0.34, type: 'triangle', vol: 0.18 }));
    else if (name === 'deal') for (let k = 0; k < 8; k++) later(k * 0.11, { freq: 300 + (k % 3) * 40, to: 180, dur: 0.05, type: 'triangle', vol: 0.12 });
  };
  const sparks = (x, y, n, colors) => {
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2), v = rng.range(40, 220);
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, max: rng.range(0.4, 0.9), s: rng.range(2, 4.5), c: colors[k % colors.length], shape: 'spark', rot: 0, spin: 0 });
    }
  };
  const confetti = (n) => {
    const cols = ['#ffd24a', '#ff6b5a', '#5ac8ff', '#7dffb0', '#ffffff', '#c28bff'];
    for (let k = 0; k < n; k++) S.parts.push({ x: rng.range(40, W - 40), y: rng.range(-60, 200), vx: rng.range(-60, 60), vy: rng.range(80, 320), t: 0, max: rng.range(1.6, 3), s: rng.range(4, 8), c: cols[k % cols.length], shape: 'conf', rot: rng.range(0, 6), spin: rng.range(-6, 6) });
  };

  // ---- flights (tiles in motion) -----------------------------------------------------------------------------
  const addFly = (o) => {
    const f = { id: o.id ?? -1, face: !!o.face, flip: !!o.flip, x0: o.from.x, y0: o.from.y, w0: o.from.w, h0: o.from.h, r0: o.from.r ?? 0, x1: o.to.x, y1: o.to.y, w1: o.to.w, h1: o.to.h, r1: o.to.r ?? 0, t: -(o.delay ?? 0), dur: o.dur ?? 0.42, hide: o.hide, hideSeat: o.hideSeat, then: o.then ?? null, data: o.data ?? null };
    S.fly.push(f);
    if (f.hide !== undefined) S.flyHide.push(f.hide);
    if (f.hideSeat !== undefined) S.flyHideSeat[f.hideSeat]++;
  };
  const landed = (f) => {
    if (f.hide !== undefined) { const i = S.flyHide.indexOf(f.hide); if (i >= 0) S.flyHide.splice(i, 1); }
    if (f.hideSeat !== undefined) S.flyHideSeat[f.hideSeat] = Math.max(0, S.flyHideSeat[f.hideSeat] - 1);
    if (f.then) onLand(f.then, f.data);
  };
  const tableFrom = (c) => ({ x: c.x, y: c.y, w: TILE_S.w, h: TILE_S.h });
  const seatFrom = (seat) => ({ x: SEAT_POS[seat].x, y: SEAT_POS[seat].y, w: 34, h: 48, r: SEAT_ROT[seat] });

  // ---- the rack ----------------------------------------------------------------------------------------------
  const syncMyRack = () => { S.rack = syncRack(S.rack, S.d.hands[0], S.d.okey); };
  const arrange = (mode) => {
    const hand = S.d.hands[0];
    if (mode === 'smart') S.rack = smartRack(hand, S.d.okey, (ids, ok) => solveValue(ids, ok, unseenCounts(S.d, 0)));
    else S.rack = sortRack(hand, S.d.okey, mode);
  };

  // ---- starting things ---------------------------------------------------------------------------------------
  const resetTable = () => {
    Object.assign(S, { sel: -1, drag: null, newTile: -1, seq: null, fly: [], flyHide: [], flyHideSeat: [0, 0, 0, 0], parts: [], toast: null, banner: null, hint: null, hold: null, over: null, overDelay: 0, pendingOver: null, paused: false, demoReveal: null });
    V.disp = {}; V.rackSig = ''; V.validSig = ''; V.handSig = ''; V.finishIds = null;
  };
  const startMatch = (mode) => {
    if (mode === 'play' && config.demo && S.demoDeals >= DEMO_DEALS) { S.scene = 'limit'; return; }
    S.scene = mode; syncLayout();
    const total = mode === 'demo' ? 1 : S.prefs.matchLen;
    S.match = { deal: 1, total, scores: [0, 0, 0, 0], starter: mode === 'demo' ? rng.int(4) : 0 };
    S.demo = { phase: 'think', timer: 0, speed: 1, paused: false, finished: false, plan: null };
    startDeal();
  };
  const startDeal = () => {
    if (S.scene === 'play' && config.demo && S.demoDeals >= DEMO_DEALS) { S.scene = 'limit'; return; }
    resetTable();
    const d = newDeal(rng, S.match.starter);
    S.d = d;
    if (S.scene === 'play' && config.demo) { S.demoDeals++; storage.set('demoDeals', S.demoDeals); }
    S.rack = S.scene === 'demo' ? smartRack(d.hands[0], d.okey, (ids, ok) => solveValue(ids, ok, null)) : sortRack(d.hands[0], d.okey, 'color');
    S.ui = 'dealing'; S.dealT = 0; S.dealShow = [0, 0, 0, 0];
    // the player's tiles fly from the stack into the rack, one after another
    S.rack.forEach((id, s) => {
      if (id < 0) return;
      addFly({ id, face: false, flip: S.scene === 'play', from: tableFrom(STACK_C), to: { ...slotCenter(s), w: RACK.tw, h: RACK.th }, delay: 0.25 + s * 0.04, dur: 0.45, hide: id, then: 'dealLand', data: { id } });
    });
    sound('deal');
    S.demo.phase = 'think'; S.demo.finished = false;
    say(S.scene === 'demo' ? L(S, 'watching') : (d.starter === 0 ? L(S, 'yourFirst') : `${names()[d.starter]} ${L(S, 'starts')}`), 'info', 3);
  };
  const resumeMatch = () => {
    const sv = S.save;
    if (!sv) return;
    resetTable();
    S.scene = 'play'; syncLayout(); S.match = sv.match; S.d = sv.d;
    S.rack = syncRack(sv.rack, sv.d.hands[0], sv.d.okey);
    S.dealShow = [14, 14, 14, 14]; S.ui = 'busy';
    say(L(S, 'resumed'), 'info', 3);
    nextAction();
  };
  const toTitle = () => {
    resetTable(); S.scene = 'title'; S.page = 0; S.d = null; S.demo.paused = false; S.demo.finished = false;
  };

  // ---- the turn machine --------------------------------------------------------------------------------------
  const nextAction = () => {
    const d = S.d;
    if (!d) return;
    if (d.phase === 'over') { endDeal(); return; }
    const seat = d.turn;
    S.hint = null;
    persistSave();
    if (S.scene === 'play' && seat === 0) {
      S.ui = 'ready';
      if (!S.coachSeen) { S.coachSeen = true; storage.set('coach', true); say(L(S, 'coach'), 'good', 9); }
      return;
    }
    S.ui = 'busy';
    if (S.scene === 'demo' && seat === 0) { demoBegin(); return; }
    // the decision is worked out now, while nothing is moving, and played after the "thinking" pause
    const lv = S.scene === 'demo' ? 2 : S.prefs.level;
    const plan = d.phase === 'draw' ? planDraw(d, seat, lv, rng) : planDiscard(d, seat, lv, rng);
    S.seq = { kind: d.phase === 'draw' ? 'aiDraw' : 'aiDiscard', t: thinkTime(seat, rng), plan };
  };

  function onLand(tag, data) {
    if (tag === 'dealLand') { sound('click'); return; }
    if (tag === 'humanDraw') {
      syncMyRack();
      V.disp[data.id] = slotRect(S.rack.indexOf(data.id));
      sound('click');
      if (S.scene === 'demo') { arrange('smart'); nextAction(); } else { S.newTile = data.id; S.ui = 'ready'; }
      return;
    }
    if (tag === 'aiDrawLand') { sound('click'); nextAction(); return; }
    if (tag === 'discardLand') {
      sound('discard');
      sparks(data.pos.x, data.pos.y, 8, ['#ffe28a', '#fff']);
      if (S.d.phase === 'over') endDeal(); else nextAction();
    }
  }

  const draw = (seat, src) => {
    const d = S.d;
    const from = prevSeat(seat);
    let id = null, fromPos, face = false;
    if (src === 'pile' && d.piles[from].length) {
      fromPos = tableFrom(PILE_C[from]); id = takePile(d, seat); face = true;
      if (id !== null && seat !== 0) toast(`${names()[seat]} ${tr() ? 'aldı:' : 'took'} ${tileLabel(S, id)}`, 1.7);
    } else { fromPos = tableFrom(STACK_C); id = drawStack(d, seat); }
    if (id === null) return null;
    sound('draw');
    S.ui = 'busy';
    if (seat === 0) {
      syncMyRack();
      const slot = S.rack.indexOf(id);
      addFly({ id, face: true, from: fromPos, to: { ...slotCenter(slot), w: RACK.tw, h: RACK.th }, dur: 0.4, hide: id, then: 'humanDraw', data: { id } });
    } else addFly({ id, face, from: fromPos, to: seatFrom(seat), dur: 0.42, hideSeat: seat, then: 'aiDrawLand', data: { seat } });
    return id;
  };

  const doDiscard = (seat, id, fromPos) => {
    const d = S.d;
    const r = discard(d, seat, id);
    if (!r) return false;
    if (seat === 0) syncMyRack();
    const pos = r.won ? { x: INDICATOR_C.x, y: INDICATOR_C.y - 100 } : PILE_C[seat];
    S.ui = 'busy';
    addFly({ id, face: true, from: fromPos, to: { x: pos.x, y: pos.y, w: TILE_S.w, h: TILE_S.h, r: r.won ? 0 : ((id % 7) - 3) * 0.03 }, dur: 0.42, hide: id, then: 'discardLand', data: { pos } });
    return true;
  };

  // ---- Watch & Learn -----------------------------------------------------------------------------------------
  function demoBegin() {
    const d = S.d, dm = S.demo;
    dm.phase = 'think'; dm.timer = THINK_STEPS[S.prefs.thinkIdx];
    dm.plan = d.phase === 'draw' ? planDraw(d, 0, 2, rng) : planDiscard(d, 0, 2, rng);
    S.demoReveal = null;
    say(d.phase === 'draw' ? L(S, 'dThinkDraw') : L(S, 'dThinkDiscard'), 'info', 99);
  }
  function demoStep(dt) {
    const dm = S.demo, d = S.d;
    if (d.phase === 'over' || d.turn !== 0 || S.seq !== null || S.fly.length || S.ui !== 'busy' || (dm.phase !== 'think' && dm.phase !== 'reveal')) return;
    dm.timer -= dt;
    if (dm.timer > 0) return;
    const plan = dm.plan;
    if (dm.phase === 'think') {
      dm.phase = 'reveal'; dm.timer = 2;
      S.demoReveal = d.phase === 'draw' ? { phase: 'draw', src: plan.src, hasPile: d.piles[prevSeat(0)].length > 0 } : { phase: 'discard', discard: plan.id };
      say(plan.why, 'good', 99);
      sound('ok');
      return;
    }
    dm.phase = 'act'; S.demoReveal = null;
    if (d.phase === 'draw') draw(0, plan.src);
    else doDiscard(0, plan.id, { x: slotCenter(S.rack.indexOf(plan.id)).x, y: slotCenter(S.rack.indexOf(plan.id)).y, w: RACK.tw, h: RACK.th });
  }

  // ---- hints -------------------------------------------------------------------------------------------------
  const useHint = () => {
    if (!canAct()) { if (S.scene === 'play' && S.d && S.d.turn !== 0 && !S.over) say(`${names()[S.d.turn]} ${L(S, 'thinking')}`, 'info', 1.5); return; }
    S.hint = hintFor(S.d, 0, rng);
    say(S.hint.why, 'good', 14);
    sound('ok');
  };

  // ---- end of a deal / match -----------------------------------------------------------------------------------
  const rankOf = (scores) => scores.map((s) => 1 + scores.filter((x) => x > s).length);
  function pairsOf(hand, okey) {
    const keyOfTile = (id) => (isWild(id, okey) ? 'w' : id >= 104 ? 'f' : String(id % 52));
    const used = new Set(), pairs = [];
    for (const a of hand) {
      if (used.has(a)) continue;
      used.add(a);
      const b = hand.find((x) => !used.has(x) && keyOfTile(x) === keyOfTile(a)) ?? hand.find((x) => !used.has(x) && isWild(x, okey));
      if (b !== undefined) { used.add(b); pairs.push([a, b]); } else pairs.push([a]);
    }
    return pairs;
  }
  function endDeal() {
    const d = S.d, res = d.result;
    if (S.over || S.pendingOver) return;
    const delta = dealScores(res);
    clearSave();
    for (let i = 0; i < 4; i++) S.match.scores[i] += delta[i];
    const human = S.scene === 'play';
    if (human) { S.stats.deals++; if (res.winner === 0) S.stats.wins++; saveStats(); }
    let title, sub, melds = null;
    const nm = names();
    if (res.winner < 0) { title = L(S, 'drawnDeal'); sub = tr() ? 'Deste bitti. Kimse puan almadı.' : 'The stack ran out. Nobody scores.'; }
    else {
      title = res.winner === 0 && human ? L(S, 'youWin') : `${nm[res.winner]}${tr() ? ' bitirdi!' : ' finishes!'}`;
      const tags = [];
      if (res.pairs) tags.push(tr() ? 'Çift' : 'Seven pairs');
      if (res.okeyDiscard) tags.push(tr() ? 'Okey ile' : 'Okey discard');
      sub = tags.length ? `${tags.join(' + ')}  x${res.mult}` : (tr() ? 'Normal bitiş' : 'Normal finish');
      const hand = d.hands[res.winner];
      if (res.pairs) melds = pairsOf(hand, d.okey);
      else { const sol = solveHand(hand, d.okey); melds = sol.melds.map((m) => m.ids).concat(sol.lone.length ? [sol.lone] : []); }
    }
    const finalDeal = S.match.deal >= S.match.total;
    let mine = null;
    if (human && res.winner !== 0) {
      const sol = solveHand(d.hands[0], d.okey);
      const sets = sol.melds.filter((m) => m.type === 'run' || m.type === 'group' || m.type === 'wilds');
      mine = { melds: sets.map((m) => m.ids), lone: sol.lone, inSets: sets.reduce((a, m) => a + m.ids.length, 0), total: d.hands[0].length };
    }
    if (res.winner === 0 && human) { sound('win'); confetti(90); S.banner = { text: tr() ? 'BİTTİ!' : 'FINISH!', t: 0, max: 1.4 }; }
    else if (res.winner > 0) { sound('lose'); S.banner = { text: tr() ? 'Bitti' : 'Finished', t: 0, max: 1.2 }; }
    else sound('ok');
    S.pendingOver = { kind: finalDeal ? 'match' : 'deal', title, sub, delta, melds, highlight: res.winner, primary: '', secondary: L(S, 'toMenu'), note: '', mine };
    S.overDelay = res.winner >= 0 ? 1.5 : 0.5;
  }
  const showOver = () => {
    const over = S.pendingOver; S.pendingOver = null;
    const human = S.scene === 'play';
    if (over.kind === 'match') {
      over.ranks = rankOf(S.match.scores);
      if (S.match.total > 1) {
        const best = Math.max(...S.match.scores);
        const winners = [0, 1, 2, 3].filter((s) => S.match.scores[s] === best);
        if (human) { S.stats.matches++; if (winners.includes(0)) S.stats.matchWins++; S.stats.best = Math.max(S.stats.best, S.match.scores[0]); saveStats(); }
        over.title = winners.includes(0) && human ? L(S, 'youWinMatch') : `${names()[winners[0]]}${tr() ? ' maçı kazandı!' : ' wins the match!'}`;
        over.sub = L(S, 'matchOver'); over.melds = null; over.delta = null; over.highlight = winners[0]; over.primary = L(S, 'playAgain');
      } else {
        if (human) { S.stats.matches++; if (S.d.result.winner === 0) S.stats.matchWins++; S.stats.best = Math.max(S.stats.best, S.match.scores[0]); saveStats(); }
        over.primary = S.scene === 'demo' ? (tr() ? 'Tekrar izle' : 'Watch again') : L(S, 'playAgain');
        over.ranks = null;
      }
    } else over.primary = L(S, 'nextDeal');
    S.over = over;
  };

  // ---- the player's actions --------------------------------------------------------------------------------------
  const humanDraw = (src) => {
    if (!canAct() || S.d.phase !== 'draw') return false;
    if (src === 'pile' && S.d.piles[prevSeat(0)].length === 0) { say(tr() ? 'Soldaki yığın boş.' : 'The pile on your left is empty.', 'warn', 2); sound('no'); return false; }
    S.hint = null; S.hold = null;
    return draw(0, src) !== null;
  };
  const humanDiscard = (id, fromPos) => {
    if (!canAct() || S.d.phase !== 'discard' || !S.d.hands[0].includes(id)) return false;
    const q = fromPos ?? slotRect(S.rack.indexOf(id));
    const from = { x: q.x + RACK.tw / 2, y: q.y + RACK.th / 2, w: RACK.tw, h: RACK.th };
    S.hint = null; S.hold = null; S.sel = -1; S.newTile = -1;
    return doDiscard(0, id, from);
  };

  // ---- pointer handling on the table -------------------------------------------------------------------------------
  const tileAt = (x, y) => {
    for (let s = RACK_SLOTS - 1; s >= 0; s--) {
      const id = S.rack[s];
      if (id < 0 || S.flyHide.includes(id)) continue;
      const q = slotRect(s);
      const lift = S.sel === id ? -16 : 0;
      if (x >= q.x - 2 && x <= q.x + q.w + 2 && y >= q.y + lift - 2 && y <= q.y + q.h + 2) return { id, slot: s };
    }
    return null;
  };
  const overPile = (x, y) => { const r = pileRect(0); return x >= r.x - 34 && x <= r.x + r.w + 34 && y >= r.y - 36 && y <= r.y + r.h + 30; };
  const alreadyDrew = () => { say(tr() ? 'Önce bir taş at.' : 'You already drew. Discard a tile.', 'warn', 2); sound('no'); };

  function tablePointer(p) {
    const d = S.d;
    if (p.pressed) {
      if (inRect(HUD_MENU, p.x, p.y)) { if (S.scene === 'demo') toTitle(); else S.paused = true; sound('click'); return; }
      if (S.scene === 'demo') { demoPointer(p); return; }
      if (inRect(BTN.runs, p.x, p.y)) { arrange('color'); sound('slide'); return; }
      if (inRect(BTN.sets, p.x, p.y)) { arrange('number'); sound('slide'); return; }
      if (inRect(BTN.smart, p.x, p.y)) { arrange('smart'); sound('slide'); return; }
      if (inRect(BTN.hint, p.x, p.y)) { useHint(); return; }
      if (S.sel >= 0 && inRect(DISCARD_BTN, p.x, p.y)) { humanDiscard(S.sel); return; }
      if (inRect(stackRect(), p.x, p.y)) {
        if (!canAct()) { if (S.d.turn !== 0 && !S.over) say(`${names()[d.turn]} ${L(S, 'thinking')}`, 'info', 1.2); return; }
        if (d.phase === 'draw') humanDraw('stack'); else alreadyDrew();
        return;
      }
      if (inRect(pileRect(prevSeat(0)), p.x, p.y)) {
        if (!canAct()) return;
        if (d.phase === 'draw') humanDraw('pile'); else alreadyDrew();
        return;
      }
      if (inRect(pileRect(0), p.x, p.y) && S.sel >= 0 && canAct() && d.phase === 'discard') { humanDiscard(S.sel); return; }
      const hit = tileAt(p.x, p.y);
      if (hit) S.drag = { id: hit.id, slot: hit.slot, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
      else S.sel = -1;
    }
    if (S.drag && p.down) {
      const dr = S.drag; dr.x = p.x; dr.y = p.y;
      if (!dr.moved && Math.hypot(p.x - dr.sx, p.y - dr.sy) > 12) { dr.moved = true; S.sel = -1; sound('click'); }
    }
    if (p.released && S.drag) {
      const dr = S.drag; S.drag = null;
      if (!dr.moved) {
        S.sel = S.sel === dr.id ? -1 : dr.id; sound('click');
        if (S.sel >= 0 && canAct() && d.phase === 'discard') say(tr() ? 'At düğmesine bas ya da yığınına sürükle.' : 'Press Discard, or drag it to your pile.', 'info', 2.5);
        return;
      }
      const tl = { x: dr.x - RACK.tw / 2, y: dr.y - RACK.th / 2 };
      if (overPile(dr.x, dr.y)) {
        if (canAct() && d.phase === 'discard') { V.disp[dr.id] = tl; humanDiscard(dr.id, tl); return; }
        say(myTurn() ? (tr() ? 'Önce bir taş çek.' : 'Draw a tile first, then discard.') : (tr() ? 'Sıra sende değil.' : 'Wait for your turn.'), 'warn', 2);
        V.disp[dr.id] = tl; sound('no'); return;
      }
      V.disp[dr.id] = tl;
      const slot = slotAt(dr.x, dr.y);
      if (slot >= 0) { S.rack = moveOnRack(S.rack, dr.id, slot); sound('slide'); }
    }
    if (!p.down && S.drag) S.drag = null;
  }
  function demoPointer(p) {
    const dm = S.demo;
    if (inRect(DEMO.pause, p.x, p.y)) { dm.paused = !dm.paused; sound('click'); return; }
    if (inRect(DEMO.dec, p.x, p.y)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx--; savePrefs(); sound('click'); if (dm.phase === 'think') dm.timer = Math.min(dm.timer, THINK_STEPS[S.prefs.thinkIdx]); } return; }
    if (inRect(DEMO.inc, p.x, p.y)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx++; savePrefs(); sound('click'); if (dm.phase === 'think') dm.timer += THINK_STEPS[S.prefs.thinkIdx] - THINK_STEPS[S.prefs.thinkIdx - 1]; } return; }
    if (inRect(DEMO.speed, p.x, p.y)) { dm.speed = dm.speed >= 4 ? 1 : dm.speed * 2; sound('click'); }
  }

  // ---- menus -----------------------------------------------------------------------------------------------------------
  const cycle = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];
  function menuPointer(p) {
    const hit = (r) => p.pressed && inRect(r, p.x, p.y);
    switch (S.scene) {
      case 'title': {
        const r = titleRows(!!S.save);
        if (hit(r.lockTap)) { env.openArcforgeHome?.(); break; }
        if (r.cont && hit(r.cont)) { sound('click'); resumeMatch(); }
        else if (hit(r.play)) { sound('click'); clearSave(); startMatch('play'); }
        else if (hit(r.watch)) { sound('click'); startMatch('demo'); }
        else if (hit(r.howto)) { S.scene = 'howto'; S.page = 0; sound('click'); }
        else if (hit(r.rules)) { S.scene = 'rules'; S.page = 0; sound('click'); }
        else if (hit(r.about)) { S.scene = 'about'; S.page = 0; sound('click'); }
        else if (hit(r.settings)) { S.scene = 'settings'; sound('click'); }
        else if (hit(r.sound)) { S.prefs.sound = !S.prefs.sound; audio.setMuted(!S.prefs.sound); savePrefs(); sound('click'); }
        break;
      }
      case 'howto': case 'about': case 'rules': {
        if (hit(REF_BACK)) { toTitle(); sound('click'); }
        else if (hit(REF_NEXT)) { S.scroll = Math.min(S.scrollMax || 0, (S.scroll || 0) + REF_PANEL.h * 0.8); sound('click'); }
        else if (hit(TEXT_DEC) && S.prefs.textScaleIdx > 0) { S.prefs.textScaleIdx--; S.page = 0; savePrefs(); sound('click'); }
        else if (hit(TEXT_INC) && S.prefs.textScaleIdx < TEXT_SCALES.length - 1) { S.prefs.textScaleIdx++; S.page = 0; savePrefs(); sound('click'); }
        break;
      }
      case 'settings': {
        const P = S.prefs;
        const btn = setBtnRect;
        if (hit(btn(0))) { P.sound = !P.sound; audio.setMuted(!P.sound); }
        else if (hit(btn(1))) P.level = (P.level + 1) % 3;
        else if (hit(btn(2))) P.matchLen = cycle(MATCH_LENS, P.matchLen);
        else if (hit(btn(3))) P.assist = !P.assist;
        else if (hit(btn(4))) P.terms = P.terms === 'tr' ? 'en' : 'tr';
        else if (hit(stepRect(5, false))) P.textScaleIdx = Math.max(0, P.textScaleIdx - 1);
        else if (hit(stepRect(5, true))) P.textScaleIdx = Math.min(TEXT_SCALES.length - 1, P.textScaleIdx + 1);
        else if (hit(stepRect(6, false))) P.thinkIdx = Math.max(0, P.thinkIdx - 1);
        else if (hit(stepRect(6, true))) P.thinkIdx = Math.min(THINK_STEPS.length - 1, P.thinkIdx + 1);
        else if (hit(SET_BACK)) { toTitle(); sound('click'); savePrefs(); break; }
        else break;
        savePrefs(); sound('click');
        break;
      }
      case 'limit': if (hit(LIMIT_BTN)) toTitle(); break;
      default: break;
    }
  }

  function overlayPointer(p) {
    if (!p.pressed) return;
    const hit = (r) => inRect(r, p.x, p.y);
    if (S.over) {
      const o = S.over;
      if (hit(RESULT.primary)) {
        sound('click');
        if (o.kind === 'deal') { S.match.deal++; S.match.starter = (S.match.starter + 1) % 4; S.over = null; startDeal(); }
        else startMatch(S.scene === 'demo' ? 'demo' : 'play');
      } else if (hit(RESULT.secondary)) { sound('click'); toTitle(); }
      return;
    }
    if (S.paused) {
      if (hit(PAUSE.resume)) { S.paused = false; sound('click'); }
      else if (hit(PAUSE.sound)) { S.prefs.sound = !S.prefs.sound; audio.setMuted(!S.prefs.sound); savePrefs(); }
      else if (hit(PAUSE.rules)) { toTitle(); S.scene = 'rules'; S.page = 0; }
      else if (hit(PAUSE.quit)) toTitle();
    }
  }

  // ---- update --------------------------------------------------------------------------------------------------------------
  // the reference readers are ONE scrolling document: drag, mouse wheel and keys (Arrows, PageUp/PageDown, Space, Home, End)
  let rdrag = null;
  function readerScroll(p, keys) {
    const max = S.scrollMax || 0, set = (v) => { S.scroll = Math.max(0, Math.min(max, v)); };
    if (wheelInput.dy) { set(S.scroll + wheelInput.dy); wheelInput.dy = 0; }
    if (p.pressed && inRect(REF_PANEL, p.x, p.y)) rdrag = { y: p.y, s0: S.scroll, moved: false };
    if (rdrag && p.down) { const dy = p.y - rdrag.y; if (Math.abs(dy) > 8) rdrag.moved = true; if (rdrag.moved) set(rdrag.s0 - dy); }
    if (!p.down && !p.released) rdrag = null;
    const k = keys.pressed, page = REF_PANEL.h * 0.8;
    if (k.has('ArrowDown')) set(S.scroll + 80); if (k.has('ArrowUp')) set(S.scroll - 80);
    if (k.has('PageDown') || k.has('Space')) set(S.scroll + page); if (k.has('PageUp')) set(S.scroll - page);
    if (k.has('Home')) set(0); if (k.has('End')) set(max);
  }
  function update(dt, input) {
    syncLayout();
    const ip = input.pointer, keys = input.keys;
    const p = ZOOM === 1 ? ip : { x: ip.x / ZOOM, y: ip.y / ZOOM, down: ip.down, pressed: ip.pressed, released: ip.released };
    PRESS.x = p.x; PRESS.y = p.y; PRESS.down = p.down;
    if (S.scene === 'title' || S.scene === 'settings' || S.scene === 'howto' || S.scene === 'about' || S.scene === 'rules' || S.scene === 'limit') {
      S.t += dt;
      if (S.scene === 'howto' || S.scene === 'about' || S.scene === 'rules') readerScroll(p, keys);
      else { rdrag = null; wheelInput.dy = 0; }
      if (!(rdrag && rdrag.moved)) menuPointer(p);
      if (keys.pressed.has('Escape') && S.scene !== 'title') toTitle();
      else if (S.scene === 'title' && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) startMatch('play');
      return;
    }
    if (!S.d) { S.scene = 'title'; return; }

    // input first (so Pause and Resume always work), then everything that animates is skipped while frozen
    if (S.over || S.paused) overlayPointer(p);
    else if (S.scene === 'demo') tablePointer(p);
    else if (S.ui !== 'dealing') tablePointer(p);
    else if (p.pressed && inRect(HUD_MENU, p.x, p.y)) S.paused = true;
    if (keys.pressed.size && S.d) handleKeys(keys.pressed);
    if (!S.d) return;
    if ((S.scene === 'demo' && S.demo.paused) || S.paused) return;
    if (S.scene === 'demo') dt *= S.demo.speed; // Speed x2 / x4 runs everything faster, think timer included

    S.t += dt;
    for (let i = sfxQ.length - 1; i >= 0; i--) if (sfxQ[i].at <= S.t) { tone(sfxQ[i].o); sfxQ.splice(i, 1); }
    if (S.toast) { S.toast.t += dt; if (S.toast.t > S.toast.max) S.toast = null; }
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.max) S.banner = null; }
    if (S.hold) { S.hold.left -= dt; if (S.hold.left <= 0) S.hold = null; }
    for (const q of S.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.shape === 'conf' ? 120 : 380) * dt; }
    S.parts = S.parts.filter((q) => q.t < q.max && q.y < H + 60);

    // flights
    if (S.fly.length) {
      const done = [];
      for (const f of S.fly) { f.t += dt; if (f.t >= f.dur) done.push(f); }
      if (done.length) { S.fly = S.fly.filter((f) => !done.includes(f)); for (const f of done) landed(f); }
    }
    if (!S.d) return;
    // deal animation: opponents' racks fill up, then play begins
    if (S.ui === 'dealing') {
      S.dealT += dt;
      const n = Math.max(0, Math.floor((S.dealT - 0.15) / 0.06));
      S.dealShow = [Math.min(14, n), Math.min(14, n), Math.min(14, n), Math.min(14, n)];
      S.dealShow[S.d.starter] = Math.min(15, n);
      if (S.fly.length === 0 && S.dealT > 1.2) { S.dealShow = [14, 14, 14, 14]; S.dealShow[S.d.starter] = 15; S.ui = 'busy'; nextAction(); }
    }
    // computer players' thinking timers
    if (S.seq && S.fly.length === 0) {
      S.seq.t -= dt;
      if (S.seq.t <= 0) {
        const { kind, plan } = S.seq, seat = S.d.turn; S.seq = null;
        if (kind === 'aiDraw') draw(seat, plan.src);
        else doDiscard(seat, plan.id, seatFrom(seat));
      }
    }
    if (S.scene === 'demo' && S.d) demoStep(dt);
    if (S.overDelay > 0) { S.overDelay -= dt; if (S.overDelay <= 0 && S.pendingOver) showOver(); }
    if (!S.d) return;

    // rack bookkeeping and visual smoothing
    const hand = S.d.hands[0];
    const sig = S.rack.join(',');
    if (sig !== V.rackSig) {
      V.rackSig = sig;
      const chunks = rackChunks(S.rack, S.d.okey);
      const vs = chunks.filter((c) => c.valid).map((c) => c.slots.join('.')).join('|');
      if (vs !== V.validSig) {
        const had = new Set(V.validSig.split('|'));
        for (const c of chunks) if (c.valid && !had.has(c.slots.join('.')) && S.ui !== 'dealing' && !S.drag && S.scene === 'play') {
          const a = slotRect(c.slots[0]), b = slotRect(c.slots[c.slots.length - 1]);
          sparks((a.x + b.x + b.w) / 2, a.y + RACK.th, 10, ['#7dffb0', '#fff7c2']);
          sound('meld');
        }
        V.validSig = vs;
      }
      V.chunks = chunks;
    }
    const hsig = `${hand.join(',')}|${S.d.phase}${S.d.turn}`;
    if (hsig !== V.handSig) {
      V.handSig = hsig;
      V.finishIds = null;
      if (S.prefs.assist && S.scene === 'play' && S.d.turn === 0 && S.d.phase === 'discard' && hand.length === 15) {
        const fin = finishingDiscards(hand, S.d.okey);
        if (fin.length) V.finishIds = new Set(fin.map((f) => f.id));
      }
    }
    const k = 1 - Math.exp(-dt * 22);
    for (let s = 0; s < RACK_SLOTS; s++) {
      const id = S.rack[s];
      if (id < 0) continue;
      if (S.drag && S.drag.moved && S.drag.id === id) continue;
      const q = slotRect(s), cur = V.disp[id];
      if (!cur) V.disp[id] = { x: q.x, y: q.y };
      else { cur.x += (q.x - cur.x) * k; cur.y += (q.y - cur.y) * k; if (Math.abs(q.x - cur.x) < 0.2) cur.x = q.x; if (Math.abs(q.y - cur.y) < 0.2) cur.y = q.y; }
    }
    for (const id of Object.keys(V.disp)) if (!S.rack.includes(Number(id))) delete V.disp[id];

    S.status = computeStatus();
  }

  function computeStatus() {
    const d = S.d;
    if (S.hold) return S.hold;
    if (S.over || S.pendingOver || d.phase === 'over') return { text: '', kind: 'info' };
    if (S.scene === 'demo') return { text: `${names()[d.turn]} ${L(S, 'thinking')}`, kind: 'info' };
    if (d.turn === 0) {
      if (d.phase === 'draw') return { text: L(S, 'yourDraw'), kind: 'info' };
      if (V.finishIds) return { text: tr() ? 'Bitirebilirsin! Parlayan taşı at.' : 'You can finish! Discard the glowing tile.', kind: 'good' };
      return { text: L(S, 'yourDiscard'), kind: 'info' };
    }
    return { text: `${names()[d.turn]} ${L(S, 'thinking')}`, kind: 'info' };
  }

  function handleKeys(keys) {
    if (S.scene === 'demo') { if (keys.has('Escape')) toTitle(); else if (keys.has('Space') && !S.over) S.demo.paused = !S.demo.paused; return; }
    if (S.over) { if (keys.has('Enter') || keys.has('Space')) overlayPointer({ pressed: true, x: RESULT.primary.x + 5, y: RESULT.primary.y + 5 }); return; }
    if (keys.has('Escape')) { S.paused = !S.paused; return; }
    if (S.paused || S.scene !== 'play') return;
    for (const c of keys) {
      if (c === 'KeyD') humanDraw('stack');
      else if (c === 'KeyT') humanDraw('pile');
      else if (c === 'KeyS') { arrange('smart'); sound('slide'); }
      else if (c === 'KeyH') useHint();
      else if (c === 'ArrowLeft' || c === 'ArrowRight') {
        const slots = S.rack.map((id, s) => (id >= 0 ? s : -1)).filter((s) => s >= 0);
        if (!slots.length) continue;
        let i = slots.indexOf(S.cursor);
        i = i < 0 ? 0 : (i + (c === 'ArrowRight' ? 1 : -1) + slots.length) % slots.length;
        S.cursor = slots[i]; S.sel = S.rack[S.cursor];
      } else if (c === 'Space' || c === 'Enter') {
        if (S.sel >= 0) humanDiscard(S.sel); else if (S.d.phase === 'draw') humanDraw('stack');
      }
    }
  }

  return {
    update,
    render(ctx) {
      if (S.scene === 'play' || S.scene === 'demo') { if (!S.d) return; }
      syncLayout();
      if (ZOOM !== 1) { ctx.save(); ctx.scale(ZOOM, ZOOM); render(ctx, S, V); ctx.restore(); } else render(ctx, S, V);
    },
    getState() { return S; },
    // Menus, rules, Watch & Learn, the pause menu and result screens do not use up the free preview; only real play does.
    isPreviewExempt: () => S.scene !== 'play' || S.paused || !!S.over,
  };
}
