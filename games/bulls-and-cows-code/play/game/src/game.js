// Bulls and Cows: state and flow. Engine = engine.js, drawing = view.js + art.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, newLayout, statsLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { GRADES, newSolver, addClue, solverFrom, pickGuess, coachFacts, analyze, contradicts, scoreA, randomCode, dailyCode, validCode, fbB, fbC, mkFb } from './engine.js';
import { render, metrics, SETTINGS, newCards } from './view.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 3;
const DAILY_GRADE = [3, 1, 2, 2, 3, 4, 5];   // by weekday, 0 = Sunday
const AUTO_GAP = 0.5;
const DEFAULT_PREFS = { look: 'baize', hand: 'right', coach: 'warn', autoScore: false, timer: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1, grade: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEY_DIGIT = (code) => { const m = /^(?:Digit|Numpad)([0-9])$/.exec(code); return m ? Number(m[1]) : -1; };
const KEY_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
export const weekday = (day) => (((day + 4) % 7) + 7) % 7;
export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS }, P: null, sel: 0, marksOn: false, hint: null, paused: false, warn: -1,
    auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, text: '', g: null, fact: null, trivial: false },
    fx: { pop: new Array(8).fill(99), shake: 99, lid: 0, lock: 99 }, sparks: [], winT: 0, winDelay: 0, sfx: [],
    msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null, newRole: 'break',
    stats: { played: [0, 0, 0, 0, 0, 0], won: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0], setPlayed: [0, 0, 0, 0, 0, 0], setWon: [0, 0, 0, 0, 0, 0], days: [], bestStreak: 0 },
    saved: null, daily: { day: config.day ?? 0 }, streak: 0, dailyDone: false, dailyGrade: 1, dailyInfo: '', demoCount: 0, saveAcc: 0, dev: config.dev === true,
  };
  let saveRaw = null, sv = null;

  // ---- persistence -----------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveStats = () => storage.set('stats', S.stats);
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'baize'; } applyPrefs(); });
  storage.get('stats', null).then((v) => { if (v) { S.stats = { ...S.stats, ...v }; } refreshDaily(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.P && S.scene === 'title' && !S.P) { saveRaw = v; S.saved = { gid: v.P.gid, role: v.P.role, kind: v.P.kind, t: v.P.t, n: v.P.rows.length }; } });
  applyPrefs();

  function refreshDaily() {
    const day = S.daily.day, set = new Set(S.stats.days);
    let streak = 0, d = set.has(day) ? day : day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(day); S.dailyGrade = DAILY_GRADE[weekday(day)];
    S.dailyInfo = S.dailyDone ? `${GRADES[S.dailyGrade].name}  ·  done today` : `${GRADES[S.dailyGrade].name}  ·  ${streak ? streak + ' day streak' : 'new every day'}`;
  }
  refreshDaily();
  function persistSession() {
    const P = S.P;
    if (!P || P.done || P.role === 'auto') return;
    saveRaw = { P: JSON.parse(JSON.stringify(P)) };
    S.saved = { gid: P.gid, role: P.role, kind: P.kind, t: P.t, n: P.rows.length };
    storage.set('save', saveRaw);
  }
  const clearSave = () => { saveRaw = null; S.saved = null; storage.remove('save'); };

  // ---- sound -----------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    place: (d) => tone({ freq: 360 + d * 38, to: 300 + d * 30, dur: 0.08, type: 'sine', vol: 0.11 }),
    del: () => tone({ freq: 300, to: 200, dur: 0.07, type: 'triangle', vol: 0.07 }),
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    lock: () => tone({ freq: 210, to: 150, dur: 0.1, type: 'triangle', vol: 0.12 }),
    bull: (i) => later(0.3 + i * 0.11, { freq: 880 + i * 60, to: 900 + i * 60, dur: 0.14, type: 'triangle', vol: 0.09 }),
    cow: (i) => later(0.3 + i * 0.11, { freq: 520, to: 500, dur: 0.12, type: 'sine', vol: 0.07 }),
    err: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.09 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.09 })); },
    lose: () => { [392, 330, 262].forEach((f, i) => later(i * 0.16, { freq: f, to: f * 0.97, dur: 0.3, type: 'triangle', vol: 0.08 })); },
  };

  // ---- helpers ----------------------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.6) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; wheelInput.dy = 0; S.msg = null; gesture = null; }
  const G = () => GRADES[S.P.gid];
  const triesOf = (P) => (P.role === 'set' ? GRADES[P.gid].ctries : GRADES[P.gid].tries);
  const curIdx = (P) => clamp(P.role === 'set' ? (P.phase === 'score' ? P.rows.length - 1 : P.rows.length) : P.rows.length, 0, triesOf(P) - 1);
  function modeOf() {
    const P = S.P;
    if (P.role === 'auto') return 'auto';
    if (S.hint) return 'coach';
    if (P.role === 'set') return P.phase === 'secret' ? 'secret' : P.phase === 'score' ? 'score' : 'wait';
    return 'break';
  }
  const L = () => { const P = S.P; return playLayout(meta.width, meta.height, { tries: triesOf(P), len: G().len, cur: curIdx(P), mode: modeOf(), hand: S.prefs.hand, scale: TEXT_SCALES[S.prefs.textIdx] }); };
  function resetFx() { S.fx = { pop: new Array(8).fill(99), shake: 99, lid: 0, lock: 99 }; S.sparks = []; S.winT = 0; S.winDelay = 0; S.sfx = []; }
  function spark(cx, cy, n, color) {
    if (S.prefs.calm) n = Math.ceil(n / 4);
    for (let i = 0; i < n; i++) { const a = rng.next() * Math.PI * 2, v = 80 + rng.next() * 260; S.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: 0.7 + rng.next() * 0.6, r: 3 + rng.next() * 4, c: color }); }
    if (S.sparks.length > 160) S.sparks.splice(0, S.sparks.length - 160);
  }
  const solver = () => {
    const P = S.P, rows = P.rows.filter((r) => r.fb >= 0);
    if (!sv || sv.grade !== G() || sv.rows.length !== rows.length || sv.sid !== P.sid) { sv = solverFrom(G(), rows); sv.sid = P.sid; }
    return sv;
  };
  let sidCounter = 0;
  function newSession({ role, gid, kind = 'free', day = 0, secret = null }) {
    const g = GRADES[gid];
    sidCounter += 1;
    return { sid: sidCounter, role, gid, kind, day, secret, rows: [], cur: new Array(g.len).fill(-1), phase: role === 'set' ? 'secret' : 'guess', t: 0, hints: 0, errs: 0, helped: false, told: [], marks: new Array(10).fill(0), done: false, won: false, think: 0, score: { b: 0, c: 0 }, left: -1, out: [], autoT: 0, ended: false };
  }
  function begin(P, extra = {}) {
    S.P = P; sv = null; S.sel = 0; S.marksOn = false; S.hint = null; S.paused = false; S.warn = -1; S.msg = null;
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, text: '', g: null, fact: null, trivial: false, ...extra };
    resetFx(); S.result = null; S.saveAcc = 0; go('play');
    if (P.role !== 'auto') refreshCoach();
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_GAMES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  function startBreak(gid) {
    if (demoBlocked()) return;
    S.prefs.grade = gid; savePrefs();
    begin(newSession({ role: 'break', gid, secret: randomCode(rng, GRADES[gid]) }));
    persistSession();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const gid = DAILY_GRADE[weekday(S.daily.day)];
    begin(newSession({ role: 'break', gid, kind: 'daily', day: S.daily.day, secret: dailyCode(S.daily.day, GRADES[gid]) }));
    persistSession();
  }
  function startSet(gid) {
    if (demoBlocked()) return;
    S.prefs.grade = gid; savePrefs();
    begin(newSession({ role: 'set', gid }));
    persistSession();
  }
  function startAuto() {
    const gid = clamp(S.prefs.grade, 1, 5);
    begin(newSession({ role: 'auto', gid, kind: 'auto', secret: randomCode(rng, GRADES[gid]) }), { on: true });
    say('Watch the computer crack a hidden code and explain each step.', 2.4);
  }
  function resumeSaved() {
    const v = saveRaw;
    if (!v) return;
    const P = v.P;
    P.sid = ++sidCounter;
    begin(P);
    S.sel = Math.max(0, P.cur.indexOf(-1));
    say('Welcome back.', 1.6);
  }
  function refreshCoach() {
    const P = S.P;
    if (!P || P.role !== 'break') return;
    const A = analyze(solver());
    P.left = A.n; P.out = A.inNone.filter((d) => P.rows.some((r) => r.g.includes(d)));
  }

  // ---- hints (break mode) ------------------------------------------------------------------------------------------------------------------------
  function askHint() {
    const P = S.P;
    if (P.role !== 'break' || P.done) return;
    const rows = P.rows.filter((r) => r.fb >= 0);
    let fact;
    if (!rows.length) {
      const g = pickGuess(solver(), rng);
      fact = { key: 'open', suggest: g, rows: [], digits: [...new Set(g)], pos: -1, look: 'Nothing is known yet.', why: `Open with a guess of different digits, for example ${g.join(' ')}. Every clue then tells you about several digits at once. Tap Use guess to place it.` };
    } else fact = coachFacts(solver(), P.told, rng);
    P.hints += 1; P.told.push(fact.key);
    S.hint = { ...fact, stage: 'look' }; sfx.hint();
  }
  function hintGo() {
    const h = S.hint, P = S.P;
    if (!h) return;
    if (h.stage === 'look') { h.stage = 'explain'; sfx.tap(); return; }
    if (h.suggest) { P.cur = h.suggest.slice(); S.sel = P.cur.length - 1; h.suggest.forEach((d, k) => { S.fx.pop[k] = -k * 0.07; }); sfx.place(h.suggest[0]); }
    S.hint = null; persistSession();
  }

  // ---- entering a code ------------------------------------------------------------------------------------------------------------------------------
  const entering = () => { const P = S.P; return P && !P.done && !S.paused && !S.auto.on && ((P.role === 'break' && P.phase === 'guess') || (P.role === 'set' && P.phase === 'secret')); };
  const canUse = (d) => { const P = S.P; return G().rep || !P.cur.includes(d) || P.cur[S.sel] === d; };
  function press(d) {
    const P = S.P;
    if (S.marksOn && P.role !== 'set') { P.marks[d] = (P.marks[d] + 1) % 4; sfx.tap(); persistSession(); return; }
    if (!canUse(d)) { say(`${d} is already in this row. All digits differ in this grade.`, 1.8); S.fx.shake = 0; sfx.err(); return; }
    S.hint = null;
    P.cur[S.sel] = d; S.fx.pop[S.sel] = 0; sfx.place(d);
    const nx = P.cur.findIndex((v, i) => v < 0 && i >= S.sel);
    S.sel = nx >= 0 ? nx : P.cur.findIndex((v) => v < 0) >= 0 ? P.cur.findIndex((v) => v < 0) : S.sel;
    persistSession();
  }
  function doDelete() {
    const P = S.P;
    if (P.cur[S.sel] >= 0) { P.cur[S.sel] = -1; sfx.del(); }
    else { let k = -1; for (let i = P.cur.length - 1; i >= 0; i--) if (P.cur[i] >= 0) { k = i; break; } if (k < 0) return; P.cur[k] = -1; S.sel = k; sfx.del(); }
    S.hint = null; persistSession();
  }
  const full = () => S.P.cur.every((d) => d >= 0);
  function moveSel(dx) { S.sel = clamp(S.sel + dx, 0, G().len - 1); }

  // ---- break: submit a guess ------------------------------------------------------------------------------------------------------------------
  function submitGuess() {
    const P = S.P, g = G();
    if (!full()) { say('Fill every slot first.', 1.6); S.fx.shake = 0; sfx.err(); return; }
    if (!validCode(P.cur, g)) { say('All digits must differ in this grade.', 1.8); S.fx.shake = 0; sfx.err(); return; }
    const guess = P.cur.slice(), fb = scoreA(P.secret, guess);
    addClue(solver(), guess, fb);
    P.rows.push({ g: guess, fb, t: 0 });
    P.cur = new Array(g.len).fill(-1); S.sel = 0; S.hint = null; S.fx.lock = 0; sfx.lock();
    for (let i = 0; i < fbB(fb); i++) sfx.bull(i);
    for (let i = 0; i < fbC(fb); i++) sfx.cow(fbB(fb) + i);
    refreshCoach();
    if (fbB(fb) === g.len) return finish(true);
    if (P.rows.length >= g.tries) return finish(false);
    persistSession();
  }

  // ---- set: the computer guesses ---------------------------------------------------------------------------------------------------------------
  function lockSecret() {
    const P = S.P, g = G();
    if (!full()) { say('Fill every slot to set your code.', 1.8); S.fx.shake = 0; sfx.err(); return; }
    if (!validCode(P.cur, g)) { say('All digits must differ in this grade.', 1.8); sfx.err(); return; }
    P.secret = P.cur.slice(); P.cur = new Array(g.len).fill(-1); P.phase = 'think'; P.think = 0.9 + rng.next() * 0.9; S.sel = 0; sfx.lock(); persistSession();
  }
  function randomSecret() { const P = S.P; P.cur = randomCode(rng, G()); P.cur.forEach((d, k) => { S.fx.pop[k] = -k * 0.07; }); S.sel = P.cur.length - 1; sfx.place(P.cur[0]); }
  function computerGuess() {
    const P = S.P, g = pickGuess(solver(), rng);
    P.rows.push({ g, fb: -1, t: 0 });
    g.forEach((d, k) => { S.fx.pop[k] = -k * 0.1; }); sfx.place(g[0]);
    P.phase = 'score'; P.score = { b: 0, c: 0 }; P.show = false; P.autoT = S.prefs.autoScore ? 1.0 : 0;
  }
  function submitScore() {
    const P = S.P, g = G(), row = P.rows[P.rows.length - 1], fb = scoreA(P.secret, row.g), tb = fbB(fb), tc = fbC(fb);
    if (P.score.b !== tb || P.score.c !== tc) {
      P.errs += 1; S.fx.shake = 0; sfx.err();
      if (P.score.b !== tb) say('Not quite. Count the bulls again: digits that sit in exactly the same place in your code.', 3.4);
      else say('The bulls are right. Count the cows again: right digits in the wrong place.', 3.4);
      return;
    }
    addClue(solver(), row.g, fb);
    row.fb = fb; row.t = 0; S.fx.lock = 0; sfx.lock(); for (let i = 0; i < tb; i++) sfx.bull(i); for (let i = 0; i < tc; i++) sfx.cow(tb + i);
    if (tb === g.len) return finish(false);
    if (P.rows.length >= g.ctries) return finish(true);
    P.phase = 'think'; P.think = 0.9 + rng.next() * 0.9; persistSession();
  }
  function showMe() {
    const P = S.P, fb = scoreA(P.secret, P.rows[P.rows.length - 1].g);
    P.score = { b: fbB(fb), c: fbC(fb) }; P.show = true; P.helped = true; sfx.hint(); say('Gold: right digit, right place. Teal: right digit, other place. Now tap Score.', 3.4);
  }

  // ---- finishing -----------------------------------------------------------------------------------------------------------------------------------
  function finish(won) {
    const P = S.P, g = G();
    P.done = true; P.won = won; P.phase = 'done'; S.hint = null; S.winT = won ? 3.2 : 0; S.winDelay = won ? 2.1 : 1.9;
    if (P.role === 'auto') { S.auto.done = true; S.auto.phase = null; S.auto.text = `Cracked in ${P.rows.length} guess${P.rows.length === 1 ? '' : 'es'}.`; if (won) sfx.win(); return; }
    const n = P.rows.length, breaking = P.role === 'break';
    let stars = 0;
    if (breaking) { if (won) stars = n <= g.par ? (P.hints > 2 ? 2 : 3) : n <= g.par + 2 ? 2 : 1; } else stars = won ? 3 : n >= g.ctries ? 2 : 1;
    let newBest = false;
    if (breaking) { S.stats.played[P.gid] += 1; if (won) { S.stats.won[P.gid] += 1; if (!S.stats.best[P.gid] || n < S.stats.best[P.gid]) { newBest = S.stats.best[P.gid] > 0 || S.stats.won[P.gid] === 1; S.stats.best[P.gid] = n; } } }
    else { S.stats.setPlayed[P.gid] += 1; if (won) S.stats.setWon[P.gid] += 1; }
    let streak = S.streak;
    if (breaking && won && P.kind === 'daily' && P.day === S.daily.day && !S.stats.days.includes(P.day)) { S.stats.days.push(P.day); S.stats.days = S.stats.days.slice(-200); refreshDaily(); streak = S.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, streak); }
    saveStats(); clearSave();
    if (breaking && won && P.kind === 'daily') storage.set('daily', { day: P.day, streak });
    monetization.track('round_end', { grade: P.gid, role: P.role, won, guesses: n });
    S.result = { role: P.role, gid: P.gid, won, guesses: n, par: g.par, ctries: g.ctries, tries: g.tries, hints: P.hints, errs: P.errs, helped: P.helped, time: P.t, stars, kind: P.kind, streak, newBest, secret: P.secret.slice(), rows: P.rows.map((r) => ({ g: r.g.slice(), fb: r.fb })) };
    if (won) { const b = L().board; spark(b.rect.x + b.rect.w / 2, b.secretMid, 50, '#ffd45a'); sfx.win(); } else if (breaking) sfx.lose();
    else sfx.lose();
  }

  // ---- Watch and Learn ----------------------------------------------------------------------------------------------------------------------------
  const wordCount = (t) => t.split(' ').length;
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      a.text = a.why; a.phase = 'reveal'; P.cur = a.g.slice(); P.cur.forEach((_, k) => { S.fx.pop[k] = -k * 0.14; }); sfx.place(a.g[0]);
      a.timer = a.trivial ? 1.6 + wordCount(a.text) * 0.1 : clamp(2.2 + wordCount(a.text) * 0.2, 2.4, 9);
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const fb = scoreA(P.secret, a.g);
      addClue(solver(), a.g, fb);
      P.rows.push({ g: a.g.slice(), fb, t: 0 }); P.cur = new Array(G().len).fill(-1); S.fx.lock = 0; sfx.lock();
      for (let i = 0; i < fbB(fb); i++) sfx.bull(i);
      for (let i = 0; i < fbC(fb); i++) sfx.cow(fbB(fb) + i);
      a.phase = 'gap'; a.timer = AUTO_GAP;
      if (fbB(fb) === G().len) finish(true); else if (P.rows.length >= 20) { a.done = true; }
      return;
    }
    const s = solver(), n = s.cands.length;
    let fact = null, g;
    if (!P.rows.length) { g = pickGuess(s, rng); fact = { look: 'First guess. Nothing is known yet.', why: `Open with different digits: ${g.join(' ')}. Whatever the clue says, it tells about several digits at once.` }; }
    else {
      fact = coachFacts(s, P.told, rng); P.told.push(fact.key);
      g = fact.suggest ?? pickGuess(s, rng);
      if (!fact.suggest) fact = { ...fact, why: `${fact.why} It plays ${g.join(' ')}: still possible, and it splits the ${n} remaining codes well.` };
    }
    a.g = g; a.why = fact.why; a.text = fact.look; a.n += 1; a.phase = 'think'; a.trivial = n <= 2;
    S.hint = null; a.fact = { rows: fact.rows ?? [], digits: fact.digits ?? [], pos: fact.pos ?? -1 };
    a.timer = a.trivial ? Math.max(0.9, THINK_STEPS[S.prefs.thinkIdx] * 0.3) : THINK_STEPS[S.prefs.thinkIdx];
  }

  // ---- input ----------------------------------------------------------------------------------------------------------------------------------------
  let gesture = null;
  function getTap(p, scrollRect) {
    if (!scrollRect) { gesture = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) gesture = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(scrollRect, p.x, p.y) };
    let tap = null;
    if (gesture) {
      if (p.down && gesture.inBody) {
        const dy = p.y - gesture.y0;
        if (Math.abs(dy) > 12) gesture.moved = true;
        if (gesture.moved) S.scrollY = clamp(gesture.s0 - dy, 0, metrics.max);
      }
      if (p.released || !p.down) { if (!gesture.moved) tap = { x: gesture.x0, y: gesture.y0 }; gesture = null; }
    }
    return tap;
  }
  function hitBtn(id, r, tap) { const gx = Math.max(0, (88 - r.w) / 2), gy = Math.max(0, (88 - r.h) / 2); if (inRect({ x: r.x - gx, y: r.y - gy, w: r.w + 2 * gx, h: r.h + 2 * gy }, tap.x, tap.y)) { flash(id); return true; } return false; }

  function updatePlay(dt, tap, input) {
    const P = S.P, l = L(), mode = modeOf();
    if (!S.paused && !P.done && !S.auto.on && S.winT <= 0) { P.t += dt; S.saveAcc += dt; if (S.saveAcc > 6) { S.saveAcc = 0; persistSession(); } }
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    // the computer's turn in Set the Code
    if (P.role === 'set' && !P.done && !S.paused) {
      if (P.phase === 'think') { P.think -= dt; if (P.think <= 0) computerGuess(); }
      else if (P.phase === 'score' && P.autoT > 0) { P.autoT -= dt; if (P.autoT <= 0.35 && !P.show) showMe(); if (P.autoT <= 0) { P.autoT = 0; submitScore(); } }
    }
    S.warn = -1;
    if (P.role === 'break' && !P.done && S.prefs.coach !== 'off' && full()) S.warn = contradicts(P.rows, P.cur);
    const k = input.keys.pressed;
    if (entering()) {
      for (const code of k) { const d = KEY_DIGIT(code); if (d >= 0) press(d); }
      if (k.has('ArrowLeft')) moveSel(-1); if (k.has('ArrowRight')) moveSel(1);
      if (k.has('Backspace') || k.has('Delete')) doDelete();
      if (k.has('Enter')) { if (P.role === 'break') submitGuess(); else lockSecret(); }
      if (k.has('KeyH') && P.role === 'break') { if (S.hint) hintGo(); else askHint(); }
      if (k.has('KeyM') && P.role === 'break') S.marksOn = !S.marksOn;
    } else if (P.role === 'set' && P.phase === 'score' && !S.paused) {
      if (k.has('Enter')) submitScore();
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persistSession(); } }
    if (!tap) return;
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height, l.board);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { const gid = P.gid, role = P.role; if (P.kind === 'daily') startDaily(); else if (role === 'set') startSet(gid); else startBreak(gid); }
      else if (hitBtn('psettings', pl.settings, tap)) { S.back = 'play'; go('settings'); }
      else if (hitBtn('pmenu', pl.menu, tap)) { persistSession(); S.paused = false; go('title'); }
      return;
    }
    if (S.auto.on) {
      if (hitBtn('aexit', l.rail.exit, tap)) { S.auto.on = false; S.hint = null; S.P = null; go('title'); }
      else if (hitBtn('apause', l.rail.pause, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', l.rail.dec, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; savePrefs(); } }
      else if (hitBtn('ainc', l.rail.inc, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; savePrefs(); } }
      return;
    }
    if (P.done) return;
    if (hitBtn('pause', l.hud.pause, tap)) { S.paused = true; persistSession(); return; }
    if (S.hint) {
      if (hitBtn('close', l.coachBtns.close, tap)) S.hint = null;
      else if (hitBtn('go', l.coachBtns.go, tap)) hintGo();
      return;
    }
    if (mode === 'score') {
      const sc = l.score, step = (key, dv) => { P.score[key] = clamp(P.score[key] + dv, 0, G().len); P.show = false; sfx.tap(); };
      if (hitBtn('bdec', sc.bulls.dec, tap)) step('b', -1); else if (hitBtn('binc', sc.bulls.inc, tap)) step('b', 1);
      else if (hitBtn('cdec', sc.cows.dec, tap)) step('c', -1); else if (hitBtn('cinc', sc.cows.inc, tap)) step('c', 1);
      else if (hitBtn('go', sc.go, tap)) submitScore(); else if (hitBtn('show', sc.show, tap)) showMe();
      return;
    }
    if (mode !== 'break' && mode !== 'secret') return;
    const slot = mode === 'secret' ? l.board.secretSlotAt(tap.x, tap.y) : l.board.slotAt(curIdx(P), tap.x, tap.y);
    if (slot >= 0) { if (S.sel === slot && P.cur[slot] >= 0) { P.cur[slot] = -1; sfx.del(); } else { S.sel = slot; sfx.tap(); } return; }
    for (let i = 0; i < 10; i++) if (hitBtn('k' + KEY_ORDER[i], l.keys[i], tap)) { press(KEY_ORDER[i]); return; }
    const T = l.tools;
    if (hitBtn('del', T.del, tap)) doDelete();
    else if (hitBtn('marks', T.marks, tap)) { if (mode === 'secret') randomSecret(); else { S.marksOn = !S.marksOn; sfx.tap(); } }
    else if (hitBtn('hint', T.hint, tap)) { if (mode === 'break') askHint(); }
    else if (hitBtn('guess', T.guess, tap)) { if (mode === 'break') submitGuess(); else lockSecret(); }
  }

  function changeSetting(i, k) {
    const id = SETTINGS[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'hand': p.hand = k === 1 ? 'left' : 'right'; break;
      case 'coach': p.coach = ['off', 'warn', 'full'][k]; break;
      case 'autoScore': p.autoScore = k === 1; break;
      case 'timer': p.timer = k === 0; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': monetization.restore().then(() => say('Purchases restored.', 2)).catch(() => {}); return;
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['new', 'doc', 'settings', 'stats', 'over'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, tap, input);
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) startBreak(S.prefs.grade); return; }
      const T = titleLayout(w, h, !!S.saved), B = T.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'continue') resumeSaved();
        else if (id === 'break' || id === 'set') { S.newRole = id; go('new'); }
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'stats') go('stats');
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - T.brand.x) < 260 && Math.abs(tap.y - T.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'new') {
      const cards = newCards(S.newRole), NL = newLayout(w, h, cards.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', NL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', NL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', NL.textInc, tap)) return textScale(1);
      if (inRect(NL.body, tap.x, tap.y)) {
        cards.forEach((id, i) => { const r = { ...NL.cards[i], y: NL.cards[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.tap(); if (id === 'daily') startDaily(); else if (S.newRole === 'set') startSet(id); else startBreak(id); } });
      }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S.doc.kind].pages.length;
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hitBtn('back', DL.menu, tap)) go('title');
      else if (hitBtn('prev', DL.prev, tap) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (hitBtn('next', DL.next, tap) && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hitBtn('tdec', DL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], SETTINGS.length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        SETTINGS.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let k = 0; k < n; k++) { const r = { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + k); changeSetting(i, k); } }
        });
      }
      return;
    }
    if (sc === 'stats') {
      const SL = statsLayout(w, h);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) go('title');
      else if (hitBtn('tdec', SL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', SL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'over') {
      const O = overLayout(w, h, TEXT_SCALES[S.prefs.textIdx]);
      if (!tap) return;
      const R0 = S.result;
      if (!R0) { go('title'); return; }
      if (hitBtn('next', O.btns.next, tap)) { if (R0.kind === 'daily') go('title'); else if (R0.role === 'set') startSet(R0.gid); else startBreak(R0.gid); }
      else if (hitBtn('menu', O.btns.menu, tap)) { if (R0.kind === 'daily') { S.newRole = 'break'; go('new'); } else go('title'); }
      else if (hitBtn('share', O.btns.share, tap)) {
        const gn = GRADES[R0.gid].name;
        env.share(R0.role === 'set' ? `Bulls and Cows, Set the Code (${gn}): ${R0.won ? 'the computer failed to crack my code' : `the computer cracked my code in ${R0.guesses} guesses`}.` : `Bulls and Cows ${R0.kind === 'daily' ? 'Daily Code' : gn}: ${R0.won ? `cracked in ${R0.guesses} guesses, ${R0.stars} star${R0.stars === 1 ? '' : 's'}` : 'out of tries'}${R0.kind === 'daily' ? '. Streak ' + R0.streak : ''}.`);
      }
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        const f = S.fx;
        for (let i = 0; i < f.pop.length; i++) if (f.pop[i] < 90) { f.pop[i] += dt; if (f.pop[i] > 1.5) f.pop[i] = 99; }
        if (f.shake < 90) { f.shake += dt; if (f.shake > 0.5) f.shake = 99; }
        if (f.lock < 90) { f.lock += dt; if (f.lock > 1.2) f.lock = 99; }
        if (S.P) { for (const r of S.P.rows) if (r.t < 90) { r.t += dt; if (r.t > 3) r.t = 99; } if (S.P.done && f.lid < 1) f.lid = Math.min(1, f.lid + dt / 0.9); }
        for (const sp of S.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 600 * dt; }
        S.sparks = S.sparks.filter((sp) => sp.t < sp.life);
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      // the kit's preview pill sits top centre; in the wide layout it moves into the side panel so it never covers the board
      if (S.scene === 'play' && S.P) { const l = L(); meta.previewBadge = l.wide ? { x: l.hud.pause.x + l.hud.pause.w, y: l.hud.pause.y + l.hud.pause.h + 8, align: 'right' } : { x: l.hud.pause.x - 14, y: l.hud.pause.y + 26, align: 'right' }; } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live round in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      start: (gid, role = 'break') => { if (role === 'set') startSet(gid); else startBreak(gid); }, daily: () => startDaily(), auto: () => startAuto(),
      hint: () => askHint(), hintGo: () => hintGo(), doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      // play n sensible guesses so a screenshot shows a mid-game board
      progress: (n) => { const P = S.P; for (let i = 0; i < n && !P.done; i++) { const g = pickGuess(solver(), rng); P.cur = g; submitGuess(); S.fx.lock = 99; P.rows.forEach((r) => { r.t = 99; }); } },
      fill: (digits) => { S.P.cur = digits.slice(); S.sel = Math.max(0, S.P.cur.indexOf(-1)); },
      lockSecret: (digits) => { S.P.cur = digits.slice(); lockSecret(); }, computerNow: () => { S.P.think = 0; },
      layout: () => { const l = L(); return { wide: l.wide, keys: l.keys, tools: l.tools, score: l.score, board: l.board.rect, rowH: l.board.rowH, d: l.board.d, w: meta.width, h: meta.height }; },
      setRounds: (n) => { const P = S.P; for (let i = 0; i < n && !P.done; i++) { P.think = 0; if (P.phase === 'think') computerGuess(); const fb = scoreA(P.secret, P.rows[P.rows.length - 1].g); P.score = { b: fbB(fb), c: fbC(fb) }; submitScore(); P.rows.forEach((r) => { r.t = 99; }); S.fx.lock = 99; } if (!P.done) { computerGuess(); } },
      solveNow: () => { const P = S.P; P.cur = P.secret.slice(); submitGuess(); }, skipOver: () => { S.winDelay = 0.01; },
    },
  };
}
