// Shut the Box: state and flow. Rules and the solver are rules.js, drawing is view.js / art.js, geometry is layout.js.
// Pure and deterministic: dice are a function of (box seed, roll number); the only randomness is env.rng picking base seeds.
//
// A box: roll -> dice tumble -> the player lifts tiles that add up to the total (auto-confirm on the exact sum) -> tiles flip ->
// roll again, until the box is shut or stuck. Modes: classic (1-9), tall (1-12), duel (5 rounds vs the Innkeeper, same dice for both),
// daily (same dice for everyone), and Auto Play ("Watch & Learn": the solver plays whole boxes, Think -> Reveal -> Act, with Pause).
import { MODES, hash32, rollDice, fullMask, bit, tilesOf, sumMask, singleAllowed, legalSubs, viableTiles, labelOf, rankedMoves, greedyMove,
  expectedScore, shutChance, bestSingle, playableChance, countBits } from './rules.js';
import { DOCS, DUEL_ROUNDS, LEVELS } from './content.js';
import { BOX_KEYS, TILE_KEYS } from './art.js';
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { render, docMetrics } from './view.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PLAYS = 3, REVEAL_SECS = 2, TAU = 6.2832;
const clone = (v) => JSON.parse(JSON.stringify(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { storage, audio, monetization, config } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const S = {
    scene: 'title', t: 0, sceneT: 1, g: null, saved: null,
    sound: true, calm: false, boxKey: 'oak', tileKey: 'bone', single: true, level: 1, textScaleIdx: 0, autoThinkIdx: 1,
    progress: { best: {}, played: 0, shut: 0, duelWins: 0, duelPlayed: 0 }, daily: { day: config.day ?? 0, doneDay: -1, score: null, streak: 0 },
    demoPlays: 0, dev: config.dev === true,
    docId: 'rules', docPage: 0, docScroll: 0, confirmReset: false,
    flip: new Array(12).fill(0), delay: new Array(12).fill(0), dAnim: null, hint: null, shake: null, fx: [], msg: null, sndq: [], banner: null,
    autoMode: false, autoTimer: 0, autoPaused: false, actT: 0, plan: null, odds: null, hero: { shut: [], timer: 1 }, gameShake: 0,
  };
  const syncZoom = () => { config.textScale = TEXT_SCALES[S.textScaleIdx]; };   // the kit's unlock overlay follows it
  let lastScene = S.scene, sdrag = null;

  // ---- persistence ---------------------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (!v) return;
    S.sound = v.sound ?? true; S.calm = v.calm ?? false; S.single = v.single ?? true; S.level = clamp(v.level ?? 1, 0, LEVELS.length - 1);
    if (BOX_KEYS.includes(v.boxKey)) S.boxKey = v.boxKey; if (TILE_KEYS.includes(v.tileKey)) S.tileKey = v.tileKey;
    S.textScaleIdx = clamp(v.textScaleIdx ?? 0, 0, TEXT_SCALES.length - 1); S.autoThinkIdx = clamp(v.autoThinkIdx ?? 1, 0, THINK_STEPS.length - 1); syncZoom(); audio.setMuted?.(!S.sound);
  });
  storage.get('progress', null).then((v) => { if (v) S.progress = { ...S.progress, ...v, best: { ...(v.best || {}), ...S.progress.best }, played: Math.max(v.played ?? 0, S.progress.played) }; });
  storage.get('daily', null).then((v) => { if (v) { S.daily.doneDay = v.doneDay ?? -1; S.daily.score = v.score ?? null; S.daily.streak = v.streak ?? 0; } });
  storage.get('demoPlays', 0).then((v) => { S.demoPlays = Math.max(S.demoPlays, v); });
  storage.get('save', null).then((v) => { if (v && v.g && S.scene === 'title') S.saved = v; });
  const savePrefs = () => { syncZoom(); storage.set('prefs', { sound: S.sound, calm: S.calm, single: S.single, level: S.level, boxKey: S.boxKey, tileKey: S.tileKey, textScaleIdx: S.textScaleIdx, autoThinkIdx: S.autoThinkIdx }); };
  const saveProgress = () => storage.set('progress', S.progress);
  // Only a human box at a stable moment is saved; on restore it is waiting for the roll (a half-done roll is simply rolled again: same dice).
  const saveGame = () => {
    const g = S.g; if (!g || S.autoMode || g.watched || g.phase !== 'play' || g.box.player === 1 || g.box.open === 0) return;
    const c = clone(g);
    if (c.box.phase === 'pick' || c.box.phase === 'rolling') c.box.rollN = Math.max(0, c.box.rollN - 1);
    c.box.phase = 'roll'; c.box.sel = 0; c.box.legal = []; c.box.dice = null; c.box.viable = 0;
    S.saved = { g: c }; storage.set('save', S.saved);
  };
  const clearSave = () => { S.saved = null; storage.remove('save'); };

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.sound) audio.tone(o); };
  const later = (delay, o) => S.sndq.push({ t: delay, o });
  const sTap = () => tone({ freq: 700, to: 560, dur: 0.05, type: 'sine', vol: 0.07 });
  const sLift = () => tone({ freq: 520, to: 780, dur: 0.07, type: 'sine', vol: 0.08 });
  const sNo = () => tone({ freq: 190, to: 130, dur: 0.14, type: 'triangle', vol: 0.08 });
  const sRattle = (seed) => { for (let k = 0; k < 9; k++) later(k * 0.085, { freq: 260 + (hash32(seed, k) % 380), to: 120, dur: 0.05, type: 'square', vol: 0.035 }); };
  const sClack = (i) => { later(i * 0.12, { freq: 330, to: 110, dur: 0.09, type: 'triangle', vol: 0.17 }); later(i * 0.12 + 0.015, { freq: 1500, to: 900, dur: 0.05, type: 'sine', vol: 0.05 }); };
  const sStuck = () => { tone({ freq: 150, to: 70, dur: 0.35, type: 'triangle', vol: 0.18 }); later(0.2, { freq: 110, to: 60, dur: 0.3, type: 'sine', vol: 0.1 }); };
  const sShut = () => [392, 494, 587, 784, 988].forEach((f, k) => later(k * 0.1, { freq: f, to: f * 1.004, dur: 0.4, type: 'triangle', vol: 0.1 }));
  const sEnd = () => { tone({ freq: 392, to: 330, dur: 0.3, type: 'triangle', vol: 0.08 }); later(0.2, { freq: 330, to: 262, dur: 0.4, type: 'triangle', vol: 0.07 }); };
  const say = (text, hold = 5) => { S.msg = { text, t: 0, hold }; };

  // ---- boxes ---------------------------------------------------------------------------------------------------------------------------
  const mkBox = (g, player, seed) => ({ open: fullMask(g.n), seed, rollN: 0, dice: null, total: 0, single: false, phase: 'roll', sel: 0, legal: [], viable: 0, hist: [], score: 0, player });
  function boxSeed(g, player) {
    if (g.mode === 'duel') return hash32(g.seed, g.duel.round);
    if (g.mode === 'daily') return hash32(g.seed, 4242 + g.boxNo);
    return hash32(g.seed, g.boxNo * 2 + 1 + (player ? 1 : 0));
  }
  function setBox(g, player = 0) {
    g.box = mkBox(g, player, boxSeed(g, player));
    S.flip.fill(0); S.delay.fill(0); S.dAnim = null; S.hint = null; S.plan = null; S.fx = []; S.banner = null; S.shake = null; S.odds = null;
    S.actT = player || S.autoMode ? 0.9 : 0;
  }
  function gate() {
    if (config.demo && S.demoPlays >= DEMO_PLAYS) { S.scene = 'demo-limit'; return false; }
    if (config.demo) { S.demoPlays += 1; storage.set('demoPlays', S.demoPlays); }
    return true;
  }
  function mkGame(mode, extra = {}) {
    const n = MODES[mode === 'tall' ? 'tall' : 'classic'].n;
    return { mode, n, seed: env.rng.int(0x7fffffff), boxNo: 0, phase: 'play', box: null, single: S.single, hints: 0, watched: false, res: null, duel: null, ...extra };
  }
  function begin(g) {
    S.g = g; S.scene = 'play'; S.autoMode = !!g.auto; S.autoPaused = false; S.msg = null;
    setBox(g, 0);
  }
  function startMode(mode) {
    if (!gate()) return;
    let g;
    if (mode === 'duel') g = mkGame('duel', { duel: { round: 1, turn: 0, totals: [0, 0], scores: [[], []], level: S.level } });
    else if (mode === 'daily') { g = mkGame('daily'); g.seed = hash32(S.daily.day, 0xda11); }
    else g = mkGame(mode);
    begin(g);
    say(mode === 'duel' ? `Duel with the Innkeeper (${LEVELS[S.level].name}). Round 1 of ${DUEL_ROUNDS}: you roll first. Tap the dice.` : mode === 'daily' ? "Today's box: the same dice for everyone. Tap the dice." : 'Tap the dice to roll. Then tap tiles that add up to the total.', 7);
    monetization.track('box_start', { mode });
  }
  function startAuto() {
    begin(mkGame('classic', { watched: true, auto: true }));
    say('Watch & Learn: the solver plays whole boxes. Think, then Reveal, then Act. You can pause any time.', 8);
  }
  function resume() {
    const v = S.saved; if (!v) return; const g = clone(v.g), box = g.box;
    begin(g); g.box = box; S.flip.fill(0); tilesOf(fullMask(g.n) & ~box.open).forEach((k) => (S.flip[k - 1] = 1));
    say('Game restored. Tap the dice.', 4);
  }
  function exitToTitle() { saveGame(); S.autoMode = false; S.autoPaused = false; S.hint = null; S.msg = null; S.plan = null; S.scene = 'title'; }

  // ---- rolling -------------------------------------------------------------------------------------------------------------------------
  const isActor = () => S.autoMode || (S.g && S.g.box.player === 1);
  const level = () => (S.g.duel ? LEVELS[S.g.duel.level].id : 'sharp');
  function wantsSingle(g, bx) {
    if (!singleAllowed(bx.open)) return false;
    if (!isActor()) return g.single;
    return level() === 'friendly' ? true : bestSingle(g.n, bx.open);
  }
  function doRoll() {
    const g = S.g, bx = g.box; if (bx.phase !== 'roll' || g.phase !== 'play') return;
    bx.rollN += 1; bx.single = wantsSingle(g, bx); bx.dice = rollDice(bx.seed, bx.rollN); bx.total = bx.single ? bx.dice[0] : bx.dice[0] + bx.dice[1];
    bx.phase = 'rolling'; bx.sel = 0; S.hint = null; S.plan = null; S.dAnim = { t: 0, dur: S.calm ? 0.45 : 1.0 };
    sRattle(bx.seed + bx.rollN);
  }
  function finishRoll() {
    const g = S.g, bx = g.box; bx.legal = legalSubs(bx.open, bx.total); bx.viable = viableTiles(bx.open, bx.total, 0);
    if (!bx.legal.length) { bx.phase = 'stuck'; S.actT = S.calm ? 1.0 : 1.6; sStuck(); say(`No open tiles add up to ${bx.total}. The box is stuck.`, 4); return; }
    bx.phase = 'pick';
    if (isActor()) makePlan();
    else { say(`You rolled ${bx.total}. Tap open tiles that add up to ${bx.total}.`, 6); saveGame(); }
  }

  // ---- choosing tiles ------------------------------------------------------------------------------------------------------------------
  function tapTile(k) {
    const g = S.g, bx = g.box;
    if (bx.phase !== 'pick' || isActor() || !(bx.open & bit(k))) return;
    const b = bit(k);
    if (bx.sel & b) { bx.sel &= ~b; bx.viable = viableTiles(bx.open, bx.total, bx.sel); S.hint = null; sTap(); return; }
    if (!(bx.viable & b)) { S.shake = { k, t: 0 }; sNo(); say(bx.sel ? `${k} cannot be part of ${bx.total} with the tiles you lifted. Put one back or pick another.` : `${k} cannot help make ${bx.total} now.`, 4); return; }
    bx.sel |= b; sLift(); S.hint = null;
    if (bx.legal.includes(bx.sel)) commit(bx.sel);
    else { bx.viable = viableTiles(bx.open, bx.total, bx.sel); say(`${sumMask(bx.sel)} of ${bx.total}. ${bx.total - sumMask(bx.sel)} to go.`, 3); }
  }
  function clearSel() { const bx = S.g.box; if (bx.phase === 'pick' && bx.sel) { bx.sel = 0; bx.viable = viableTiles(bx.open, bx.total, 0); S.hint = null; sTap(); } }
  function commit(sub) {
    const g = S.g, bx = g.box, L = lay().board(g.n), ks = tilesOf(sub);
    bx.open &= ~sub; bx.hist.push({ total: bx.total, sub }); bx.sel = 0; bx.phase = 'flipping'; S.hint = null; S.plan = null;
    ks.forEach((k, i) => { S.delay[k - 1] = i * 0.12; sClack(i); const r = L.tiles[k - 1]; burst(r.x + r.w / 2, r.y + r.h * 0.4, 10 + 4 * ks.length); });
    S.actT = 0.35 + 0.12 * ks.length + (S.calm ? 0 : 0.25);
    S.gameShake = S.calm ? 0 : 0.18;
  }
  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i, sp = 60 + (i % 5) * 36, gold = i % 3 === 0;
      S.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, life: 0.6 + (i % 4) * 0.12, max: 0.6 + (i % 4) * 0.12, r: gold ? 3.2 : 2.4, c: gold ? '#ffdf7a' : '#a9743c' });
    }
    if (S.fx.length > 140) S.fx.splice(0, S.fx.length - 140);
  }
  function afterFlip() {
    const bx = S.g.box;
    if (bx.open === 0) { shutCelebrate(); endBox(); return; }
    bx.phase = 'roll'; S.actT = isActor() ? 0.8 : 0;
    if (!isActor()) { say('Roll again.', 3); saveGame(); }
  }
  function shutCelebrate() {
    S.banner = { text: 'SHUT THE BOX!', t: 0, hold: 2.6 }; sShut();
    const B = lay().board(S.g.n).box; for (let k = 0; k < 4; k++) burst(B.x + B.w * (0.2 + 0.2 * k), B.y + B.h * 0.4, 22);
    S.gameShake = S.calm ? 0 : 0.5;
  }

  // ---- hints and the solver as a teacher -------------------------------------------------------------------------------------------------
  function explain(g, bx) {
    const ranked = rankedMoves(g.n, bx.open, bx.total), best = ranked[0], gm = greedyMove(bx.open, bx.total);
    const rest = bx.open ^ best.sub;
    let text = rest === 0 ? `Shut ${labelOf(best.sub)}: that closes the box.` : `Best: shut ${labelOf(best.sub)}. Expected final score about ${best.e.toFixed(1)}`;
    if (rest !== 0 && gm && gm !== best.sub) text += ` (shutting ${labelOf(gm)} first averages ${ranked.find((m) => m.sub === gm).e.toFixed(1)}).`;
    else if (rest !== 0) text += '.';
    return { best, text, ranked };
  }
  function askHint() {
    const g = S.g, bx = g.box; if (g.phase !== 'play' || isActor()) return;
    if (bx.phase === 'pick') { const x = explain(g, bx); S.hint = { mask: x.best.sub }; g.hints += 1; bx.sel = 0; bx.viable = viableTiles(bx.open, bx.total, 0); say(x.text, 9); sTap(); }
    else if (bx.phase === 'roll') { const single = g.single && singleAllowed(bx.open); say(`Chance your next roll can be played: ${Math.round(playableChance(g.n, bx.open, single) * 100)}%. Best chance to shut the box from here: ${(shutChance(g.n, bx.open) * 100).toFixed(1)}%. Expected final score ${expectedScore(g.n, bx.open).toFixed(1)}.`, 9); sTap(); }
  }
  // the actor's plan: the move, the tiles in the order they are lifted, and the teacher's note
  function makePlan() {
    const g = S.g, bx = g.box, x = explain(g, bx), lv = level();
    let sub = x.best.sub;
    if (bx.player === 1) {
      const h = hash32(bx.seed, bx.rollN + 777) % 100;
      if (lv === 'friendly') sub = h < 70 ? greedyMove(bx.open, bx.total) : bx.legal[h % bx.legal.length];
      else if (lv === 'regular' && h < 18 && x.ranked.length > 1) sub = x.ranked[1].sub;
    }
    S.plan = { sub, order: tilesOf(sub).reverse(), lifted: 0, text: x.text, phase: 'think', timer: S.autoMode ? THINK_STEPS[S.autoThinkIdx] : 0.55 + (hash32(bx.seed, bx.rollN) % 90) / 100 };
    if (S.autoMode) say(`Thinking... rolled ${bx.total}.`, S.plan.timer + 1);
  }
  function actorTick(dt) {
    const bx = S.g.box;
    if (bx.phase === 'roll') { S.actT -= dt; if (S.actT <= 0) doRoll(); return; }
    if (bx.phase === 'pick' && S.plan) {
      const p = S.plan; p.timer -= dt; if (p.timer > 0) return;
      if (p.phase === 'think') {
        if (S.autoMode) { p.phase = 'reveal'; p.timer = REVEAL_SECS; S.hint = { mask: p.sub, all: bx.viable }; say(p.text, REVEAL_SECS + 1); }
        else { p.phase = 'act'; p.timer = 0.01; }
        return;
      }
      if (p.phase === 'reveal') { p.phase = 'act'; p.timer = 0.01; S.hint = null; return; }
      if (p.phase === 'act') {
        if (p.lifted < p.order.length) { bx.sel |= bit(p.order[p.lifted]); p.lifted += 1; sLift(); p.timer = S.calm ? 0.12 : 0.3; if (p.lifted === p.order.length) p.phase = 'commit'; }
        return;
      }
      if (p.phase === 'commit') commit(p.sub);
    }
  }

  // ---- end of a box ---------------------------------------------------------------------------------------------------------------------
  function endBox() {
    const g = S.g, bx = g.box, score = sumMask(bx.open), shut = bx.open === 0;
    bx.score = score; bx.phase = 'done'; S.actT = 0;
    if (g.mode === 'duel') return endDuelBox(score, shut);
    const r = { kind: 'solo', score, shut, mode: g.mode, newBest: false, best: null, streak: null, first: true };
    if (!g.watched) {
      if (g.mode === 'classic' || g.mode === 'tall') {
        const b = S.progress.best[g.mode];
        if (b === undefined || score < b) { S.progress.best[g.mode] = score; r.newBest = b !== undefined; }
        r.best = S.progress.best[g.mode];
      } else if (g.mode === 'daily' && S.daily.doneDay !== S.daily.day) {
        S.daily.streak = S.daily.doneDay === S.daily.day - 1 ? S.daily.streak + 1 : 1; S.daily.doneDay = S.daily.day; S.daily.score = score;
        storage.set('daily', { doneDay: S.daily.doneDay, score, streak: S.daily.streak }); r.streak = S.daily.streak;
      } else if (g.mode === 'daily') { r.streak = S.daily.streak; r.first = false; r.best = S.daily.score; }
      S.progress.played += 1; if (shut) S.progress.shut += 1; saveProgress(); clearSave();
      monetization.track('box_end', { mode: g.mode, score, shut });
    }
    g.res = r; g.phase = 'boxover'; S.sceneT = 0;
    if (g.watched) { S.autoTimer = shut ? 3.2 : 2.6; say(shut ? 'The solver shut the box!' : `The solver finished with ${score} open. Next box in a moment.`, 3); }
    if (!shut) sEnd();
  }
  function endDuelBox(score, shut) {
    const g = S.g, d = g.duel, who = g.box.player;
    d.scores[who].push(score); d.totals[who] += score; g.phase = 'boxover'; S.sceneT = 0;
    if (!shut) sEnd();
    if (who === 0) { g.res = { kind: 'turn', score, shut, round: d.round }; return; }
    const mine = d.scores[0][d.round - 1];
    if (d.round >= DUEL_ROUNDS) {
      const you = d.totals[0], inn = d.totals[1], win = you < inn ? 'you' : you > inn ? 'inn' : 'draw';
      g.res = { kind: 'match', you, inn, win, mine, theirs: score, round: d.round }; g.phase = 'over';
      S.progress.duelPlayed += 1; if (win === 'you') S.progress.duelWins += 1; S.progress.played += 1; saveProgress(); clearSave();
      monetization.track('duel_end', { win, you, inn, level: LEVELS[d.level].id });
      if (win === 'you') sShut();
    } else g.res = { kind: 'round', mine, theirs: score, round: d.round, you: d.totals[0], inn: d.totals[1] };
  }
  function nextAfterResult() {
    const g = S.g; if (!g) return;
    if (g.mode === 'duel') {
      const d = g.duel;
      if (g.res.kind === 'turn') { d.turn = 1; g.phase = 'play'; g.res = null; setBox(g, 1); say('The Innkeeper takes the same dice. Watch the box.', 4); return; }
      d.round += 1; d.turn = 0; g.phase = 'play'; g.res = null; setBox(g, 0); say(`Round ${d.round} of ${DUEL_ROUNDS}: your box. Tap the dice.`, 5); return;
    }
    g.boxNo += 1; g.phase = 'play'; g.res = null; g.practice = g.mode === 'daily';
    setBox(g, 0); say(g.mode === 'daily' ? 'Practice box: the daily result is already saved.' : 'New box. Tap the dice.', 4);
  }
  function overTap(tap) {
    const g = S.g; if (!tap || S.sceneT < 0.45) return;
    const C = lay().result, hit = (r) => inRect(r, tap.x, tap.y);
    if (g.watched) return;
    if (hit(C.primary)) { if (g.res.kind === 'match') { S.scene = 'title'; startMode('duel'); } else nextAfterResult(); }
    else if (hit(C.second)) { if (g.res.kind === 'solo' || g.res.kind === 'match') shareResult(); }
    else if (hit(C.menu)) { clearSave(); S.scene = 'title'; }
  }
  function shareResult() {
    const g = S.g, r = g.res;
    if (r.kind === 'match') env.share(`Shut the Box duel: ${r.you} to ${r.inn} against the Innkeeper (${LEVELS[g.duel.level].name}).`);
    else if (g.mode === 'daily') env.share(`Shut the Box daily: ${r.score === 0 ? 'shut the box!' : `${r.score} left open`}. Streak ${S.daily.streak}.`);
    else env.share(`Shut the Box ${MODES[g.mode]?.short ?? ''}: ${r.score === 0 ? 'I shut the box!' : `${r.score} left open`}.`);
  }

  // ---- scenes ---------------------------------------------------------------------------------------------------------------------------
  function openDoc(id) { S.docId = id; S.docPage = 0; S.docScroll = 0; S.scene = 'doc'; sdrag = null; }
  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title(!!S.saved), R = T.rows, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.lockupHit)) env.openArcforgeHome?.();
    else if (R.resume && hit(R.resume)) resume();
    else if (hit(R.chip)) { S.level = (S.level + 1) % LEVELS.length; savePrefs(); sTap(); }
    else if (hit(R.classic)) startMode('classic');
    else if (hit(R.tall)) startMode('tall');
    else if (hit(R.duel)) startMode('duel');
    else if (hit(R.daily)) startMode('daily');
    else if (hit(R.auto)) startAuto();
    else if (hit(R.howto)) openDoc('howto');
    else if (hit(R.rules)) openDoc('rules');
    else if (hit(R.about)) openDoc('about');
    else if (hit(R.settings)) { S.scene = 'settings'; S.confirmReset = false; }
  }
  function updateHero(dt) {
    const h = S.hero; if (!h.f) h.f = new Array(9).fill(0);
    if (S.calm) h.shut = [2, 5, 7];
    else { h.timer -= dt; if (h.timer <= 0) { h.timer = 0.9; if (h.shut.length >= 5) h.shut = []; else { const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => !h.shut.includes(k)); h.shut.push(pool[hash32(Math.floor(S.t * 10), h.shut.length) % pool.length]); } } }
    for (let k = 0; k < 9; k++) { const tg = h.shut.includes(k + 1) ? 1 : 0; h.f[k] = h.f[k] < tg ? Math.min(tg, h.f[k] + dt * 3) : Math.max(tg, h.f[k] - dt * 5); }
  }
  function updateDoc(tap, input) {
    const D = lay().doc, p = input.pointer, keys = input.keys.pressed, max = docMetrics.max;
    const set = (v) => { S.docScroll = clamp(v, 0, docMetrics.max); };
    if (wheelInput.dy) { set(S.docScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) set(S.docScroll + 70); if (keys.has('ArrowUp')) set(S.docScroll - 70);
    if (keys.has('PageDown')) set(S.docScroll + docMetrics.view * 0.9); if (keys.has('PageUp')) set(S.docScroll - docMetrics.view * 0.9);
    if (p.pressed && max > 0) { if (inRect(D.scrollbar, p.x, p.y)) sdrag = { bar: true }; else if (inRect(D.viewport, p.x, p.y)) sdrag = { y0: p.y, s0: S.docScroll }; }
    if (sdrag) { if (!p.down) sdrag = null; else if (sdrag.bar) set(((p.y - D.scrollbar.y) / D.scrollbar.h) * max); else set(sdrag.s0 - (p.y - sdrag.y0)); }
    S.docScroll = clamp(S.docScroll, 0, docMetrics.max);
    if (!tap) return;
    const pages = DOCS[S.docId].pages.length;
    if (inRect(D.nav.back, tap.x, tap.y)) { S.scene = 'title'; sdrag = null; sTap(); }
    else if (inRect(D.nav.prev, tap.x, tap.y)) { if (S.docPage > 0) { S.docPage--; S.docScroll = 0; sTap(); } }
    else if (inRect(D.nav.next, tap.x, tap.y)) { if (S.docPage < pages - 1) { S.docPage++; S.docScroll = 0; sTap(); } else { S.scene = 'title'; sTap(); } }
    else if (inRect(D.header.dec, tap.x, tap.y) && S.textScaleIdx > 0) { S.textScaleIdx--; S.docScroll = 0; savePrefs(); sTap(); }
    else if (inRect(D.header.inc, tap.x, tap.y) && S.textScaleIdx < TEXT_SCALES.length - 1) { S.textScaleIdx++; S.docScroll = 0; savePrefs(); sTap(); }
  }
  function updateSettings(tap) {
    if (!tap) return;
    const C = lay().settings, hit = (r) => inRect(r, tap.x, tap.y), R = C.rows;
    if (hit(C.back)) { S.scene = 'title'; S.confirmReset = false; sTap(); return; }
    if (!hit(R.reset)) S.confirmReset = false;
    if (hit(R.sound)) { S.sound = !S.sound; audio.setMuted?.(!S.sound); sTap(); }
    else if (hit(R.calm)) { S.calm = !S.calm; sTap(); }
    else if (hit(R.box)) { S.boxKey = BOX_KEYS[(BOX_KEYS.indexOf(S.boxKey) + 1) % BOX_KEYS.length]; sTap(); }
    else if (hit(R.tiles)) { S.tileKey = TILE_KEYS[(TILE_KEYS.indexOf(S.tileKey) + 1) % TILE_KEYS.length]; sTap(); }
    else if (hit(R.single)) { S.single = !S.single; sTap(); }
    else if (hit(R.level)) { S.level = (S.level + 1) % LEVELS.length; sTap(); }
    else if (hit(R.text)) { S.textScaleIdx = (S.textScaleIdx + 1) % TEXT_SCALES.length; sTap(); }
    else if (hit(R.reset)) {
      if (S.confirmReset) { S.progress = { best: {}, played: 0, shut: 0, duelWins: 0, duelPlayed: 0 }; S.daily.doneDay = -1; S.daily.score = null; S.daily.streak = 0; saveProgress(); storage.set('daily', { doneDay: -1, score: null, streak: 0 }); clearSave(); S.confirmReset = false; }
      else S.confirmReset = true;
    }
    savePrefs();
  }
  function tileAt(x, y) {
    const L = lay().board(S.g.n);
    for (let k = 1; k <= S.g.n; k++) if (inRect(L.tiles[k - 1], x, y)) return k;
    return 0;
  }
  function updatePlay(dt, input, tap) {
    const g = S.g, P = lay().play, bx = g.box, hit = (r) => tap && inRect(r, tap.x, tap.y);
    if (S.autoMode) {
      if (hit(P.autoBtn.exit)) { exitToTitle(); return; }
      if (hit(P.autoBtn.pause)) { S.autoPaused = !S.autoPaused; sTap(); return; }
      if (hit(P.autoBtn.dec)) { if (S.autoThinkIdx > 0) { S.autoThinkIdx--; savePrefs(); } return; }
      if (hit(P.autoBtn.inc)) { if (S.autoThinkIdx < THINK_STEPS.length - 1) { S.autoThinkIdx++; savePrefs(); } return; }
      return;
    }
    if (g.phase !== 'play') { overTap(tap); return; }
    if (!tap) return;
    if (hit(P.btn.menu)) { exitToTitle(); return; }
    if (hit(P.btn.hint)) { askHint(); return; }
    if (hit(P.btn.clear)) { clearSel(); return; }
    if (hit(P.btn.dice)) {
      if (singleAllowed(bx.open) && !isActor() && bx.phase === 'roll') { g.single = !g.single; S.single = g.single; savePrefs(); say(g.single ? 'One die per roll.' : 'Two dice per roll.', 3); sTap(); }
      return;
    }
    if (hit(P.tray) && bx.phase === 'roll' && !isActor()) { doRoll(); return; }
    const k = tileAt(tap.x, tap.y); if (k) tapTile(k);
  }
  function keyboard(input) {
    const k = input.keys.pressed, sc = S.scene;
    if (input.pointer.pressed) return null;
    if (sc !== 'play') {
      if (k.has('Escape') && sc !== 'title') { const L = lay(); const r = sc === 'doc' ? L.doc.nav.back : sc === 'settings' ? L.settings.back : L.simple.back; return { x: r.x + 5, y: r.y + 5 }; }
      return null;
    }
    const g = S.g; if (!g) return null;
    const P = lay().play;
    if (k.has('Escape')) return { x: P.btn.menu.x + 5, y: P.btn.menu.y + 5 };
    if (S.autoMode) return null;
    if (g.phase !== 'play') { if (k.has('Enter') || k.has('Space')) return { x: lay().result.primary.x + 5, y: lay().result.primary.y + 5 }; return null; }
    if (k.has('KeyH')) return { x: P.btn.hint.x + 5, y: P.btn.hint.y + 5 };
    if (k.has('KeyC')) return { x: P.btn.clear.x + 5, y: P.btn.clear.y + 5 };
    if (k.has('KeyD')) return { x: P.btn.dice.x + 5, y: P.btn.dice.y + 5 };
    if (k.has('Enter') || k.has('Space')) return { x: P.tray.x + 5, y: P.tray.y + 5 };
    const codes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
    for (let i = 0; i < codes.length; i++) if (k.has(codes[i]) || k.has(codes[i].replace('Digit', 'Numpad'))) { const r = lay().board(g.n).tiles[i]; if (r) return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    return null;
  }

  // ---- simulation ----------------------------------------------------------------------------------------------------------------------
  function simulate(dt) {
    if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.hold) S.banner = null; }
    for (const q of S.sndq) q.t -= dt;
    while (S.sndq.length && S.sndq[0].t <= 0) tone(S.sndq.shift().o);
    for (const f of S.fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; }
    for (let i = S.fx.length - 1; i >= 0; i--) if (S.fx[i].life <= 0) S.fx.splice(i, 1);
    if (S.gameShake > 0) S.gameShake = Math.max(0, S.gameShake - dt);
    if (S.shake) { S.shake.t += dt; if (S.shake.t > 0.35) S.shake = null; }
    const speed = S.calm ? 7 : 3.4, g = S.g;
    for (let k = 0; k < 12; k++) {
      if (S.delay[k] > 0) { S.delay[k] -= dt; continue; }
      const target = g && g.box && k < g.n && !(g.box.open & bit(k + 1)) ? 1 : 0;
      if (S.flip[k] < target) S.flip[k] = Math.min(target, S.flip[k] + dt * speed); else if (S.flip[k] > target) S.flip[k] = Math.max(target, S.flip[k] - dt * speed * 2);
    }
  }
  function updateOdds() {
    const g = S.g, b = g.box, single = b.player === 0 && g.single && singleAllowed(b.open), key = `${g.n}:${b.open}:${single}`;
    if (!S.odds || S.odds.key !== key) S.odds = { key, playable: playableChance(g.n, b.open, single), shut: shutChance(g.n, b.open), e: expectedScore(g.n, b.open) };
  }
  function updateGame(dt) {
    const g = S.g, bx = g.box;
    if (S.dAnim) { S.dAnim.t += dt; if (S.dAnim.t >= S.dAnim.dur) { S.dAnim = null; if (bx.phase === 'rolling') finishRoll(); } }
    if (bx.phase === 'flipping') { S.actT -= dt; if (S.actT <= 0) afterFlip(); }
    else if (bx.phase === 'stuck') { S.actT -= dt; if (S.actT <= 0) endBox(); }
    if (g.phase === 'play' && isActor()) actorTick(dt);
    if (g.phase === 'boxover' && S.autoMode) { S.autoTimer -= dt; if (S.autoTimer <= 0) { g.boxNo += 1; g.phase = 'play'; g.res = null; setBox(g, 0); } }
    updateOdds();
  }

  // Scripted states for the verification matrix and the store screenshots (dev / ?shot=1 only; never used in play).
  function debugScript(name, n = 4) {
    const g = S.g; if (!g) return; const bx = g.box;
    const settle = () => { S.dAnim = null; if (bx.phase === 'rolling') finishRoll(); };
    const sync = () => { S.delay.fill(0); for (let k = 0; k < 12; k++) S.flip[k] = k < g.n && !(bx.open & bit(k + 1)) ? 1 : 0; };
    const playN = (cnt, mode = 'best') => {
      for (let i = 0; i < cnt && g.phase === 'play'; i++) {
        if (bx.phase === 'roll') doRoll(); settle();
        if (bx.phase === 'stuck') { endBox(); return; }
        if (bx.phase === 'pick') { commit(mode === 'best' ? rankedMoves(g.n, bx.open, bx.total)[0].sub : bx.legal[(i * 5) % bx.legal.length]); sync(); afterFlip(); }
      }
    };
    if (name === 'mid') { playN(n); S.fx = []; S.msg = null; }
    else if (name === 'rolled') { playN(n); if (bx.phase === 'roll') doRoll(); settle(); S.fx = []; }
    else if (name === 'lift') { playN(n); if (bx.phase === 'roll') doRoll(); settle(); const t = bx.legal.find((s) => countBits(s) > 1); if (t) { bx.sel = bit(tilesOf(t)[0]); bx.viable = viableTiles(bx.open, bx.total, bx.sel); } S.fx = []; }
    else if (name === 'hint') { playN(n); if (bx.phase === 'roll') doRoll(); settle(); askHint(); S.fx = []; }
    else if (name === 'over') { for (let i = 0; i < 60 && g.phase === 'play'; i++) playN(1, 'worst'); S.fx = []; }
    else if (name === 'shut') { bx.open = 0; sync(); bx.phase = 'flipping'; shutCelebrate(); S.banner = { text: 'SHUT THE BOX!', t: 0.4, hold: 600 }; say('Every tile is down: a perfect score of 0.', 600); }
    S.dAnim = null; sync(); updateOdds();
  }

  return {
    update(dt, input) {
      S.t += dt;
      if (S.scene !== lastScene) { lastScene = S.scene; S.sceneT = 0; } else S.sceneT += dt;
      if (S.scene !== 'doc') wheelInput.dy = 0;
      const frozen = S.autoMode && S.autoPaused && S.scene === 'play';
      if (!frozen) {
        if (S.scene === 'play' && S.g) { simulate(dt); updateGame(dt); }
        else { for (const q of S.sndq) q.t -= dt; while (S.sndq.length && S.sndq[0].t <= 0) tone(S.sndq.shift().o); }
        if (S.scene === 'title') updateHero(dt);
      }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      switch (S.scene) {
        case 'title': updateTitle(tap); break;
        case 'doc': updateDoc(tap, input); break;
        case 'settings': updateSettings(tap); break;
        case 'play': updatePlay(dt, input, tap); break;
        case 'demo-limit': if (tap && inRect(lay().simple.back, tap.x, tap.y)) S.scene = 'title'; break;
        default: break;
      }
    },
    render(ctx, view) {
      const w = view?.width ?? meta.width, h = view?.height ?? meta.height, L = layoutFor(w, h);
      meta.previewBadge = { x: L.ins.l + (L.backBox.w ? L.backBox.w + 10 : 16), y: L.ins.t + 12, align: 'left' };   // beside the host back button, clear of titles
      render(ctx, S, L);
    },
    getState: () => S,
    // Free preview counts real play only: a live box in Classic, Tall, Duel or Daily. Menus, Rules, Settings, Auto Play, results and the demo-limit screen are exempt.
    isPreviewExempt() { return !(S.scene === 'play' && !S.autoMode && S.g && S.g.phase === 'play'); },
    // dev / verification hook (main.js, only with ?dev=1 or ?shot=1)
    debug: { layout: () => lay(), startMode, startAuto, openDoc, S, script: (name, n = 4) => debugScript(name, n), tapTile, doRoll },
  };
}
