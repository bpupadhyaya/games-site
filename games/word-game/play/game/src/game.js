// GAME CONTRACT (docs/GAME-CONTRACT.md) — every game exports exactly these two things:
//   meta                      virtual resolution the game draws in
//   createGame(env) -> { update(dt, input), render(ctx, view), getState() }
// Rules: no DOM/window access in web/src, no Math.random / Date.now (use env.rng and dt).
//
// WORD GAME: a question is shown at the top; three candidate words drift freely across the screen from right to left.
// The player taps the right one. WHAT is asked (levels, kinds of words, topics, question types), HOW FAST the words move,
// and how long a session lasts are all chosen in a setup layer; the play layer is pure game (combos, streaks, sound).
// The Journey (journey.js) is a campaign of short stages and checkpoint tests played in the same drift.
// Words come from lexicon.js (WordNet relations + ESDB frequency tiers); memory scheduling from srs.js.
import { SCHEMES } from './schemes.js';
import { render, pressLockup, drawBadgeToast } from './render.js';
import {
  W, H, BAND_TOP, SLICE_H, SLICE_MARGIN, slipWidth, inRect, layoutFor, host,
  TEXT_SCALES, THINK_STEPS, REVEAL_SECONDS, wheelInput, rulesMetrics, formMetrics,
} from './layout.js';
import * as lex from './lexicon.js';
import { QTYPES, DEFAULT_CFG, normalizeCfg, applyPreset, SESSION_SECS, QUESTION_COUNTS, SET_SIZES, sessionSeconds, questionCount, paceKey } from './config.js';
import { chooseKind, build, canAsk, kindAvailable } from './quiz.js';
import * as kb from './kb.js';
import * as srs from './srs.js';
import { screenRows, FORM_SCENES, SPEED_OPTS, sumLine } from './screens.js';
import { layoutForm, hitAt } from './forms.js';
import { lookupUrl } from './dict.js';
import { buildBackup, wordsCsv, sessionsCsv, parseBackup } from './exporter.js';
import * as jny from './journey.js';
import { LETTERS, LETTER_NAMES, checkpoints } from './letters.js';
import { ACH, newBadges } from './ach.js';
export { wheelInput, rulesMetrics, formMetrics };

// `meta.width/height` are updated live by the kit on every resize (fluid viewport); every rect comes from layoutFor().
export const meta = { width: W, height: H, fluid: { short: 720 } };

const DEMO_SESSION_LIMIT = 2;      // web preview: a taste only, see docs/GAME-CONTRACT.md "Web preview"
const RECENT_WORDS_MAX = 8;
const SPEED_BASE = 140, SPEED_PER_POINT = 18, SPEED_CAP_BONUS = 260, SPEED_JITTER = 40;   // Classic pace (the original drift)
const KEY_CODES = ['Digit1', 'Digit2', 'Digit3'];
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const MILESTONES = [3, 6, 10, 15, 20, 30];
const lay = () => layoutFor(meta.width, meta.height);
const multOf = (streak) => (streak >= 10 ? 4 : streak >= 6 ? 3 : streak >= 3 ? 2 : 1);
const TAP_SLOP = 16;
const GATED = new Set(['settings', 'data', 'profiles']);          // behind the parent gate in a child profile
const PROFILE_KEYS = ['cfg', 'prefs', 'rec', 'sess', 'study', 'bests', 'journey', 'ach', 'est'];

const DEFAULT_PREFS = {
  sound: true, voice: 1, calm: false, goal: 20, reviewCap: 20,
  dict: { choice: 'oxford', mode: 'ask', custom: '', noticed: false },
  streak: { last: 0, n: 0 }, today: { day: 0, n: 0 },
  font: 'std', cb: false, reduce: false, lefty: false, senior: false, captions: false, deaf: false, remind: { on: false, hour: 19 },
  stats: { exports: 0, lookups: 0, studySets: 0, traced: 0, bestStreak: 0 },
};
const freshPrefs = () => JSON.parse(JSON.stringify(DEFAULT_PREFS));
const mergePrefs = (p) => ({
  ...DEFAULT_PREFS, ...p, dict: { ...DEFAULT_PREFS.dict, ...(p.dict ?? {}) }, streak: { ...DEFAULT_PREFS.streak, ...(p.streak ?? {}) },
  today: { ...DEFAULT_PREFS.today, ...(p.today ?? {}) }, remind: { ...DEFAULT_PREFS.remind, ...(p.remind ?? {}) }, stats: { ...DEFAULT_PREFS.stats, ...(p.stats ?? {}) },
});
const QTYPES_OFF = () => QTYPES.filter((q) => !kindAvailable(q.k)).map((q) => q.k);
const freshJourney = () => ({ stars: {}, checks: {}, placed: 0 });
const pkey = (id, k) => (id === 'p0' ? k : `${id}.${k}`);

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const wg = env.wg ?? {};                         // optional device services from web/main.js (speech, file export, links, database)
  const store = wg.store ?? storage;
  const demo = Boolean(config?.demo);
  const day = () => config?.day ?? 20000;

  const state = {
    scene: 'title',
    profiles: [], profile: 'p0',
    cfg: normalizeCfg(DEFAULT_CFG),
    prefs: freshPrefs(),
    records: {}, sessions: [], study: { words: [], day: 0 },
    journey: freshJourney(), ach: {}, est: null,
    loaded: false,                                  // saved progress has been read; nothing is saved before this
    msg: '', confirmDel: false, confirmProfile: '', pending: '',
    back: [], cardIdx: 0, cardFlip: false,
    // session
    kind: 'play',                                   // 'play' | 'review' | 'stage' | 'check' | 'place'
    run: null, runResult: null, newBadges: [],
    live: { hints: true, lives: 0 },
    score: 0, streak: 0, bestStreak: 0, answered: 0, right: 0, lives: 0, hintUsed: false, paused: false, reason: 'time',
    timeLeft: 90, total: 90, byQuestions: false, ms: 0,
    bestScores: {}, bestKey: '', newBest: false, sessionsCompleted: 0,
    history: [], reviewPage: 0, sessionNew: 0,
    rulesScroll: 0, formScroll: 0, mapScroll: 0, textScaleIdx: 0, scheme: 0,
    sel: null, tr: null, gate: null, parentUntil: 0, gateNext: '',
    demo, demoSessions: 0, demoLimitReached: false,
    autoPlay: false, autoPaused: false, autoThinkIdx: 1, autoPhase: 'think', autoPhaseT: 0,
    t: 0, sceneT: 1, press: null, fx: null, toast: null, banner: null, caption: null, badgeToast: null, shake: 0, flash: 0, parts: [],
    round: null, empty: false, dataVersion: 0,
  };

  let recentWords = [];
  let session = null;                               // { pool, bag, bagIdx, bagMode, kinds, source, dueSome, cfg }
  let dirtyRec = false, answersSinceSave = 0;
  let rev = 1;                                      // bumps whenever a form screen's content may have changed
  const touch = () => { rev += 1; };
  const curType = () => state.profiles.find((p) => p.id === state.profile)?.type ?? 'adult';
  const isChild = () => curType() === 'child';
  const effects = () => !(state.prefs.calm || state.prefs.reduce || state.prefs.senior);
  const setScene = (scene) => { state.scene = scene; state.sceneT = 0; state.fx = null; state.formScroll = 0; if (scene !== 'data' && scene !== 'profiles') state.msg = scene === 'title' ? state.msg : ''; touch(); };
  const go = (scene) => { state.back.push(state.scene); if (state.back.length > 8) state.back.shift(); setScene(scene); };
  const goBack = () => { setScene(state.back.pop() ?? 'title'); };
  const pressed = (id) => { state.press = { id, t: 0 }; };
  const playTone = (opts) => {
    if (state.autoPlay || !state.prefs.sound) return;
    audio.tone(state.prefs.calm || state.prefs.senior ? { ...opts, vol: (opts.vol ?? 0.2) * 0.6 } : opts);
  };
  const buzz = (k) => { if (!state.autoPlay && effects()) wg.haptic?.(k); };
  const canSpeak = () => Boolean(wg.canSpeak?.()) && !state.prefs.deaf;
  const caption = (text) => { if (state.prefs.captions) state.caption = { text, t: 0 }; };
  // The settings the current session really uses: later-life mode removes the clock and lives; a child profile only sees vetted words.
  const eff = () => {
    const c = { ...state.cfg };
    if (isChild()) c.kid = true;
    if (state.prefs.senior) { c.endBy = 'questions'; c.qIdx = 0; c.secs = Math.max(30, c.secs || 30); c.lives = 0; }
    return c;
  };

  // ---------------------------------------------------------------- saved data (per profile)
  const put = (k, v) => { if (state.loaded) store.set(pkey(state.profile, k), v); };
  const save = {
    cfg: () => put('cfg', state.cfg), prefs: () => put('prefs', state.prefs),
    rec: () => { put('rec', state.records); dirtyRec = false; answersSinceSave = 0; },
    sess: () => put('sess', state.sessions), study: () => put('study', state.study), best: () => put('bests', state.bestScores),
    journey: () => put('journey', state.journey), ach: () => put('ach', state.ach), est: () => put('est', state.est),
    profiles: () => { store.set('profiles', state.profiles); store.set('active', state.profile); },
  };
  const applyLoaded = (v) => {
    const [cfg, prefs, rec, sess, study, bests, journey, ach, est] = v;
    state.cfg = cfg ? normalizeCfg(cfg) : normalizeCfg(DEFAULT_CFG);
    state.prefs = prefs ? mergePrefs(prefs) : freshPrefs();
    state.records = rec && typeof rec === 'object' ? rec : {};
    state.sessions = Array.isArray(sess) ? sess : [];
    state.study = study && Array.isArray(study.words) ? study : { words: [], day: 0 };
    state.bestScores = bests && typeof bests === 'object' ? bests : {};
    state.journey = journey && journey.stars ? { ...freshJourney(), ...journey } : freshJourney();
    state.ach = ach && typeof ach === 'object' ? ach : {};
    state.est = est ?? null;
    audio.setMuted?.(!state.prefs.sound);
    state.loaded = true; touch();
  };
  const loadProfile = (id) => Promise.all(PROFILE_KEYS.map((k) => store.get(pkey(id, k), null))).then(applyLoaded).catch(() => { state.loaded = true; });
  Promise.all([store.get('profiles', null), store.get('active', 'p0')]).then(async ([pl, act]) => {
    if (Array.isArray(pl) && pl.length) { state.profiles = pl; state.profile = pl.some((p) => p.id === act) ? act : pl[0].id; await loadProfile(state.profile); return; }
    const rec = await store.get('rec', null);
    if (rec && Object.keys(rec).length) {                 // someone who played before profiles existed: an adult profile, silently
      state.profiles = [{ id: 'p0', name: 'Player 1', type: 'adult' }]; state.profile = 'p0'; store.set('profiles', state.profiles); await loadProfile('p0'); return;
    }
    state.loaded = true; state.scene = 'age'; touch();     // first run: the neutral "who is playing" screen
  }).catch(() => { state.loaded = true; });
  storage.get('scheme', 0).then((v) => { state.scheme = SCHEMES[v] ? v : 0; });
  storage.get('textScaleIdx', 0).then((v) => { state.textScaleIdx = Math.min(Math.max(v ?? 0, 0), TEXT_SCALES.length - 1); });
  storage.get('autoThinkIdx', 1).then((v) => { state.autoThinkIdx = Math.min(Math.max(v ?? 1, 0), THINK_STEPS.length - 1); });
  if (demo) storage.get('demoSessions', 0).then((v) => { state.demoSessions = v; if (v >= DEMO_SESSION_LIMIT) state.demoLimitReached = true; });
  const cycleScheme = () => { state.scheme = (state.scheme + 1) % SCHEMES.length; storage.set('scheme', state.scheme); touch(); };

  const addProfile = (type, senior = false) => {
    const n = state.profiles.length + 1, id = `p${Math.max(-1, ...state.profiles.map((p) => Number(p.id.slice(1)))) + 1}`;
    state.profiles.push({ id, name: `Player ${n}`, type });
    state.profile = id; state.loaded = false; save.profiles();
    const prefs = freshPrefs(); if (senior) { prefs.senior = true; prefs.calm = true; }
    const cfg = normalizeCfg(type === 'child' ? { ...DEFAULT_CFG, contexts: [0, 1], qtypes: ['definition', 'synonym', 'spelling'] } : DEFAULT_CFG);
    applyLoaded([cfg, prefs, null, null, null, null, null, null, null]);
    save.cfg(); save.prefs();
    if (senior && state.textScaleIdx < 2) { state.textScaleIdx = 2; storage.set('textScaleIdx', 2); }
    state.back = []; setScene(state.profiles.length === 1 ? 'title' : 'title');
  };
  const switchProfile = async (id) => {
    if (id === state.profile) return;
    if (dirtyRec) save.rec();
    state.profile = id; state.loaded = false; save.profiles();
    await loadProfile(id); state.back = []; state.parentUntil = 0; setScene('title');
  };

  // ---------------------------------------------------------------- achievements
  const statsNow = (extra = {}) => {
    const rec = state.records; let met = 0, know = 0;
    for (const w in rec) { const r = rec[w]; if (r[6] > 0) met += 1; if (r[8] || r[0] >= 3) know += 1; }
    const checks = Object.values(state.journey.checks).filter((v) => v >= 70).length, S = state.prefs.stats;
    return {
      sessions: state.sessions.length, bestStreak: Math.max(S.bestStreak, state.bestStreak), perfect: false, met, know, streakDays: state.prefs.streak.n,
      goalHit: state.prefs.today.day === day() && state.prefs.today.n >= state.prefs.goal, stars: jny.totalStars(state.journey), checks,
      lettersDone: (state.journey.checks['0'] ?? 0) >= 70, traced: S.traced, placed: Boolean(state.est), studySets: S.studySets, lookups: S.lookups, exports: S.exports, ...extra,
    };
  };
  const checkAch = (extra) => {
    const got = newBadges(statsNow(extra), state.ach);
    if (!got.length) return;
    for (const id of got) state.ach[id] = day();
    state.newBadges.push(...got); save.ach(); touch();
    state.badgeToast = { text: `Badge: ${ACH.find((a) => a.id === got[0]).name}${got.length > 1 ? ` +${got.length - 1}` : ''}`, t: 0 };
  };

  // ---------------------------------------------------------------- word pools
  const entriesOf = (words) => words.map((w) => lex.entry(w)).filter(Boolean);
  const dueWords = () => srs.dueList(state.records, day(), state.prefs.reviewCap);
  const weakWords = () => srs.weakList(state.records);
  const poolFor = (source) => {
    const cfg = eff();
    if (source === 'study') return entriesOf(state.study.words);
    if (source === 'due') return entriesOf(dueWords());
    if (source === 'weak') return entriesOf(weakWords());
    const p = lex.select(cfg);
    return cfg.skipKnown ? p.filter((e) => !srs.isKnown(state.records, e.w)) : p;
  };
  const makeStudySet = () => {
    const cfg = eff();
    const pool = lex.select(cfg).filter((e) => !srs.isKnown(state.records, e.w));
    if (!pool.length) return false;
    const fresh = pool.filter((e) => !state.records[e.w]), seen = pool.filter((e) => state.records[e.w]);
    seen.sort((a, b) => state.records[a.w][0] - state.records[b.w][0] || a.rank - b.rank);
    const pick = rng.shuffle(fresh).slice(0, cfg.setSize);
    if (pick.length < cfg.setSize) pick.push(...seen.slice(0, cfg.setSize - pick.length));
    pick.sort((a, b) => a.rank - b.rank);
    state.study = { words: pick.map((e) => e.w), day: day() };
    state.prefs.stats.studySets += 1; save.study(); save.prefs(); touch(); checkAch();
    return true;
  };

  // ---------------------------------------------------------------- rounds
  const pickEntry = () => {
    const S = session, pool = S.pool;
    let e;
    if (S.bagMode) {
      if (S.bagIdx >= S.bag.length) { S.bag = S.ordered ? S.bag : rng.shuffle(pool); S.bagIdx = 0; }
      e = S.bag[S.bagIdx++];
    } else {
      let guard = 0;
      do { e = pool[rng.int(pool.length)]; guard += 1; } while (recentWords.includes(e.w) && recentWords.length < pool.length && guard < 50);
      if (S.dueSome.length && rng.chance(0.25)) e = S.dueSome[rng.int(S.dueSome.length)];   // sometimes bring back a word that is due
    }
    recentWords.push(e.w);
    if (recentWords.length > RECENT_WORDS_MAX) recentWords.shift();
    return e;
  };
  const avoidOf = (e) => new Set([e.w, ...e.syn, ...e.ant]);
  const nextQuestion = () => {
    const S = session, ctx = { canSpeak: canSpeak() && !state.autoPlay };
    for (let i = 0; i < 40; i += 1) {
      const e = pickEntry();
      const kind = chooseKind(e, S.kinds, rng, ctx);
      if (!kind) continue;
      const q = build(kind, e, rng, avoidOf(e));
      if (q) return { ...q, band: e.band };
    }
    for (let i = 0; i < 40; i += 1) {                  // nothing matched the chosen types: any question the word can answer
      const e = pickEntry(), kind = chooseKind(e, ['letter-case', 'definition', 'synonym', 'antonym', 'spelling'], rng, ctx);
      const q = kind && build(kind, e, rng, avoidOf(e));
      if (q) return { ...q, band: e.band };
    }
    return null;
  };

  const spawnRound = () => {
    const q = nextQuestion();
    if (!q) { state.round = null; state.empty = true; return; }
    const cfg = session.cfg;
    const classic = cfg.secs === 0 || state.autoPlay;
    const speed = SPEED_BASE + Math.min(SPEED_CAP_BONUS, state.right * SPEED_PER_POINT);
    state.round = {
      kind: q.kind, label: q.label, note: q.note ?? '', targetWord: q.prompt, word: q.word, art: q.art ?? '', letter: Boolean(q.letter), band: q.band, age: 0, meaning: q.meaning, speak: q.speak ?? '', hinted: -1,
      words: q.options.map((o, slot) => {
        const sliceTop = BAND_TOP + slot * SLICE_H + SLICE_MARGIN;
        const sliceBottom = BAND_TOP + (slot + 1) * SLICE_H - SLICE_MARGIN;
        const driftX = rng.range(0, 140);                // always drawn, so the rng sequence never depends on the pace
        const w = slipWidth(o.text), start = W + w / 2 + driftX * 0.15;
        return {
          text: o.text, correct: o.correct, slot, w,
          x: state.autoPlay ? W / 2 : classic ? W + 20 + driftX : start,
          y: rng.range(sliceTop, sliceBottom), vy: rng.range(-30, 30), sliceTop, sliceBottom,
          speed: classic ? speed + rng.range(0, SPEED_JITTER) : ((start + w / 2) / cfg.secs) * (1 + rng.range(0, 0.08)),
        };
      }),
    };
    if (q.speak && !state.autoPlay) { wg.speak?.(q.speak, state.prefs.voice); caption(`[voice] ${q.speak}`); }
  };

  // ---------------------------------------------------------------- sessions
  // opts: source, auto, run {type, world, stage, label}, pool (entries), kinds, over {secs,questions,lives,hints,endBy}, ordered
  const beginSession = (opts = {}) => {
    const source = opts.source ?? state.cfg.source;
    let pool = opts.pool ?? poolFor(source), src = opts.pool ? 'run' : source;
    if (!pool.length && source !== 'whole') { src = 'whole'; pool = poolFor('whole'); }
    if (!pool.length) { state.msg = 'No words match your choices. Pick more levels or kinds of words.'; touch(); return false; }
    const cfg = { ...eff(), ...(opts.over ?? {}) };
    state.run = opts.run ?? null; state.runResult = null; state.newBadges = [];
    state.kind = state.run ? state.run.type : src === 'due' ? 'review' : 'play';
    state.autoPlay = Boolean(opts.auto);
    state.autoPaused = false; state.paused = false;
    state.byQuestions = !state.autoPlay && (cfg.endBy === 'questions' || Boolean(opts.over?.questions));
    state.total = state.autoPlay ? 90 : state.byQuestions ? (opts.over?.questions ?? questionCount(cfg)) : sessionSeconds(cfg);
    state.timeLeft = state.total;
    state.history = []; state.reviewPage = 0; state.score = 0; state.streak = 0; state.bestStreak = 0; state.answered = 0; state.right = 0;
    state.lives = state.autoPlay ? 0 : cfg.lives; state.hintUsed = false; state.newBest = false; state.ms = 0; state.sessionNew = 0;
    state.live = { hints: cfg.hints !== false && !state.autoPlay, lives: state.lives };
    state.toast = null; state.banner = null; state.parts = []; state.empty = false; state.msg = '';
    state.bestKey = `${cfg.preset === 'classic' ? 'c' : paceKey(cfg)}|${state.kind}`;
    recentWords = [];
    let kinds = (opts.kinds ?? cfg.qtypes).filter((k) => !(state.autoPlay && (k === 'listening' || k === 'letter-hear')) && !(state.prefs.deaf && (k === 'listening' || k === 'letter-hear')));
    if (!kinds.length) kinds = ['synonym'];
    const ordered = Boolean(opts.ordered);
    if (!opts.pool && !state.autoPlay) {                   // only words that can answer one of the chosen question types (the relation types are rarer)
      const ca = { canSpeak: canSpeak() }, f = pool.filter((e) => kinds.some((k) => canAsk(e, k, ca)));
      if (f.length >= 6) pool = f;
    }
    session = {
      pool, kinds, cfg, ordered, bagMode: ordered || src !== 'whole' || pool.length <= 300, bag: ordered ? pool.slice() : rng.shuffle(pool), bagIdx: 0, source: src,
      dueSome: src === 'whole' && !state.autoPlay ? entriesOf(dueWords()).slice(0, 12) : [],
    };
    state.autoPhase = 'think'; state.autoPhaseT = 0;
    spawnRound();
    if (state.empty) { state.autoPlay = false; state.run = null; state.msg = 'Could not make questions from these words. Try other question types or levels.'; setScene('title'); return false; }
    setScene(state.autoPlay ? 'autoplay' : 'playing');
    return true;
  };
  const startSession = (opts = {}) => {
    if (demo && !opts.auto && !opts.run) {
      if (state.demoLimitReached) { setScene('demo-limit'); return; }
      if (beginSession(opts)) { state.demoSessions += 1; storage.set('demoSessions', state.demoSessions); if (state.demoSessions >= DEMO_SESSION_LIMIT) state.demoLimitReached = true; }
      return;
    }
    beginSession(opts);
  };
  const exitAutoplay = () => { state.autoPlay = false; state.autoPaused = false; state.round = null; setScene('title'); };

  // ---- Journey runs
  const kindsFor = (w) => {
    const W_ = jny.WORLDS[w];
    if (W_.k === 'letters') return ['letter-hear', 'letter-case', 'letter-next'];
    if (W_.k === 'first') return ['picture', 'definition', 'synonym', 'spelling'];
    return W_.band >= 3 ? ['synonym', 'definition', 'antonym', 'spelling', 'odd'] : ['synonym', 'definition', 'spelling', 'antonym'];
  };
  const startRun = (type, w, s) => {
    const W_ = jny.WORLDS[w];
    if (type === 'stage') {
      const pool = jny.stageWords(w, s);
      if (!pool.length) { state.msg = 'This part of the journey needs the full word list to finish loading.'; touch(); return; }
      startSession({ pool, kinds: kindsFor(w), run: { type, world: w, stage: s, label: `${W_.name} ${jny.stageTitle(w, s)}` }, over: { secs: W_.secs, questions: jny.STAGE_QUESTIONS, endBy: 'questions', lives: 0, hints: true } });
    } else if (type === 'check') {
      const pool = jny.worldWords(w);
      if (!pool.length) return;
      startSession({ pool, kinds: kindsFor(w), run: { type, world: w, stage: -1, label: `${W_.name} checkpoint` }, over: { secs: Math.max(6, W_.secs - 2), questions: jny.CHECK_QUESTIONS, endBy: 'questions', lives: 3, hints: false } });
    } else {
      const items = jny.placementEntries();
      if (items.length < 6) { state.msg = 'The placement check needs the full word list to finish loading.'; touch(); return; }
      startSession({ pool: items.map((x) => x.e), kinds: ['definition'], ordered: true, run: { type: 'place', world: -1, stage: -1, label: 'Placement check' }, over: { secs: 25, questions: items.length, endBy: 'questions', lives: 0, hints: false } });
    }
  };
  const finishRun = () => {
    const run = state.run, n = state.answered, right = state.right, J = state.journey;
    const res = { type: run.type, world: run.world, stage: run.stage, right, n, pass: false, stars: 0, prevStars: 0, next: '' };
    if (run.type === 'stage') {
      const id = jny.stageId(run.world, run.stage);
      res.prevStars = J.stars[id] ?? 0;
      res.stars = state.reason === 'stop' ? 0 : jny.starsFor(right, n);
      res.pass = res.stars >= 1;
      if (res.stars > res.prevStars) J.stars[id] = res.stars;
      res.next = res.pass ? (run.stage + 1 < jny.stageCount(run.world) ? 'stage' : 'check') : '';
    } else if (run.type === 'check') {
      const pct = n ? Math.round((100 * right) / n) : 0;
      res.pct = pct; res.pass = state.reason !== 'lives' && state.reason !== 'stop' && pct >= jny.PASS_CHECK * 100;
      if (res.pass && pct > (J.checks[run.world] ?? 0)) J.checks[run.world] = pct;
      res.next = res.pass && run.world + 1 < jny.WORLDS.length ? 'world' : '';
    } else {
      const per = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
      for (const h of state.history) if (h.band >= 0 && h.band <= 5) { per[h.band][1] += 1; if (h.correct) per[h.band][0] += 1; }
      const e = jny.estimateVocab(per), pw = jny.placedWorld(per);
      state.est = { day: day(), per, ...e, world: pw }; J.placed = Math.max(J.placed ?? 0, pw);
      save.est();
    }
    state.runResult = res; save.journey();
  };

  const saveSessionRecord = () => {
    const n = state.answered; if (!n) return;
    const d = day();
    const rec = { day: d, kind: state.kind, preset: state.run ? state.run.type : state.cfg.preset, n, right: state.right, score: state.score, streak: state.bestStreak, secs: state.byQuestions ? 0 : Math.round(state.total - state.timeLeft), ms: Math.round(state.ms / n), nw: state.sessionNew, types: (session?.kinds ?? state.cfg.qtypes).slice() };
    state.sessions.push(rec); if (state.sessions.length > 500) state.sessions.shift();
    const P = state.prefs;
    if (n >= 5 && P.streak.last !== d) {
      if (P.streak.last > 0 && d - P.streak.last <= 2) P.streak = { last: d, n: P.streak.n + 1 };   // one missed day is forgiven
      else P.streak = { last: d, n: 1 };
    }
    P.stats.bestStreak = Math.max(P.stats.bestStreak, state.bestStreak);
    save.sess(); save.prefs();
  };
  const endSession = (reason) => {
    state.round = null; state.reviewPage = 0; state.paused = false; state.reason = reason ?? 'time';
    if (!state.autoPlay) {
      if (state.run) finishRun();
      else {
        const key = state.bestKey, prev = state.bestScores[key] ?? 0;
        if (state.score > prev) { state.bestScores[key] = state.score; state.newBest = prev > 0; save.best(); }
      }
      state.sessionsCompleted += 1;
      monetization.track('session_end', { preset: state.cfg.preset, score: state.score });
      saveSessionRecord(); save.rec();
      checkAch({ perfect: state.answered >= 10 && state.right === state.answered });
    }
    if (state.run && state.run.type === 'place' && !state.autoPlay) setScene('placeresult'); else setScene('gameover');
    playTone({ freq: 560, to: 300, dur: 0.32, type: 'sine', vol: 0.22 });
    if (state.runResult?.pass && !state.autoPlay) playTone({ freq: 784, to: 1046, dur: 0.4, type: 'triangle', vol: 0.16 });
  };

  // ---------------------------------------------------------------- answering
  const addParts = (x, y, color, n) => {
    for (let k = 0; k < n; k += 1) {
      const a = rng.range(0, Math.PI * 2), v = rng.range(120, 460);
      state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: rng.range(0.45, 0.9), age: 0, r: rng.range(4, 9), c: color });
    }
    if (state.parts.length > 160) state.parts.splice(0, state.parts.length - 160);
  };
  const resolveRound = (picked) => {
    const round = state.round;
    const shown = round.words.find((w) => w.text === picked) ?? round.words.find((w) => w.correct);
    const answer = round.words.find((w) => w.correct).text;
    const hit = picked !== null && picked === answer;
    const ms = Math.round(round.age * 1000);
    state.history.push({ word: round.word, kind: round.kind, meaning: round.meaning, answer, picked, correct: hit, prompt: round.targetWord, band: round.band, letter: round.letter });
    state.answered += 1; state.ms += ms;
    const L = lay();
    const fxX = picked === null ? 0 : Math.max(shown.w / 2 + 12, Math.min(W - shown.w / 2 - 12, shown.x));
    const sx = picked === null ? L.play.band.x : L.wordX(fxX), sy = L.wordY(shown.slot, shown.y);
    state.fx = { kind: hit ? 'right' : picked === null ? 'miss' : 'wrong', x: fxX, y: shown.y, slot: shown.slot, w: shown.w, text: shown.text, t: 0, pts: 0, mult: 1 };
    const nowDay = day();
    if (!state.autoPlay) {
      if (!round.letter) {
        const before = srs.stageOf(state.records[round.word]);
        srs.applyAnswer(state.records, round.word, hit, ms, nowDay);
        if (before === 'new' && hit) state.sessionNew += 1;
        dirtyRec = true; answersSinceSave += 1;
      }
      const P = state.prefs; if (P.today.day !== nowDay) P.today = { day: nowDay, n: 0 };
      P.today.n += 1;
      if (answersSinceSave >= 10) { save.rec(); save.prefs(); }
    }
    if (hit) {
      state.streak += 1; state.right += 1; state.bestStreak = Math.max(state.bestStreak, state.streak);
      const mult = multOf(state.streak), pts = 10 * mult;
      state.score += pts; state.fx.pts = pts; state.fx.mult = mult;
      const f = NOTES[Math.min(state.streak - 1, NOTES.length - 1)];
      playTone({ freq: f, to: f * 1.04, dur: 0.14, type: 'triangle', vol: 0.22 });
      if (state.streak >= 3) playTone({ freq: f * 1.5, to: f * 1.5, dur: 0.18, type: 'sine', vol: 0.1 });
      caption('[chime] right');
      if (MILESTONES.includes(state.streak)) {
        playTone({ freq: f * 2, to: f * 2.02, dur: 0.32, type: 'sine', vol: 0.12 });
        state.banner = { text: state.streak >= 10 ? `${state.streak} IN A ROW!` : `COMBO x${mult}!`, t: 0 };
        caption('[fanfare] combo');
      }
      if (effects()) { state.flash = 1; addParts(sx, sy, '#5eea9a', 12 + Math.min(14, state.streak)); }
      buzz('good');
      state.toast = { good: true, text: round.letter ? round.meaning : round.word, sub: round.note || (round.letter || ['definition', 'spelling', 'listening', 'picture'].includes(round.kind) ? '' : round.meaning), t: 0 };
    } else {
      state.streak = 0;
      playTone({ freq: 220, to: 140, dur: 0.16, type: 'sawtooth', vol: 0.18 });
      buzz('bad'); caption('[low tone] not quite');
      if (effects()) state.shake = 1;
      const lead = round.kind === 'odd' ? 'Odd one out' : round.kind === 'antonym' ? 'Opposite' : round.kind === 'synonym' ? 'Same meaning' : 'Answer';
      state.toast = { good: false, text: `${lead}: ${answer}`, sub: round.note || round.meaning, t: 0 };
      if (state.lives > 0) { state.lives -= 1; if (state.lives === 0 && !state.autoPlay) { endSession('lives'); return; } }
    }
    if (state.byQuestions && state.answered >= state.total) { endSession('questions'); return; }
    spawnRound();
    if (state.empty) endSession('empty');
  };

  // ---------------------------------------------------------------- form screens (generic reader)
  let formCache = null, drag = null;
  const weekly = () => {
    const d = day(), rows = state.sessions.filter((s) => s.day > d - 7);
    const days = new Set(rows.map((s) => s.day)), n = rows.reduce((a, s) => a + s.n, 0), right = rows.reduce((a, s) => a + s.right, 0), nw = rows.reduce((a, s) => a + (s.nw ?? 0), 0);
    return { days: days.size, n, right, nw, sessions: rows.length };
  };
  const snapshot = () => {
    const sm = state.records, d = day();
    const bandSize = [0, 0, 0, 0, 0, 0], bandKnown = [0, 0, 0, 0, 0, 0];
    for (const e of lex.all()) { if (e.band < 0) continue; bandSize[e.band] += 1; const r = sm[e.w]; if (r && (r[8] || r[0] >= 3)) bandKnown[e.band] += 1; }
    const weak = weakWords(), child = isChild();
    return {
      cfg: state.cfg, prefs: { ...state.prefs, scheme: state.scheme }, records: sm, study: state.study.words, day: d,
      dueN: srs.dueCount(sm, d), weakN: weak.length, weak, leeches: Object.keys(sm).filter((w) => srs.isLeech(sm[w])),
      canSpeak: canSpeak(), canAsk: Boolean(wg.askText), msg: state.msg, confirmDel: state.confirmDel, pending: state.pending,
      lookupOn: !child && state.prefs.dict.mode !== 'never' && Boolean(wg.openLink || env.openLink), version: env.manifest?.version ?? '',
      credits: lex.credits(), loadingData: !lex.isFull() && Boolean(wg.loading), sessions: state.sessions, bandSize, bandKnown,
      todayN: state.prefs.today.day === d ? state.prefs.today.n : 0, streakN: state.prefs.streak.last >= d - 1 ? state.prefs.streak.n : 0,
      profiles: state.profiles, profile: state.profile, child, confirmProfile: state.confirmProfile, journey: state.journey, ach: state.ach, est: state.est,
      sel: state.sel, week: weekly(), run: state.run, runResult: state.runResult, gate: state.gate, textLarge: state.textScaleIdx, full: lex.isFull(),
      kindOff: QTYPES_OFF(),
      stageWords: state.sel && state.sel.kind === 'stage' ? jny.stageWords(state.sel.world, state.sel.stage) : [],
    };
  };
  const getForm = () => {
    const Q = lay().rules, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const key = `${state.scene}|${rev}|${scale}|${Math.round(Q.viewport.w)}|${lex.version()}|${state.prefs.font}`;
    if (formCache && formCache.key === key) return formCache;
    const def = screenRows(state.scene, snapshot());
    const width = Q.viewport.w - 2 * Q.padX;
    formCache = { key, def, layout: layoutForm(def.rows, width, scale, state.prefs.font === 'dys' ? 1.2 : 1), width };
    return formCache;
  };
  const setFormScroll = (v) => { state.formScroll = Math.max(0, Math.min(v, formMetrics.max)); };

  const openLink = (url) => { if (wg.openLink) wg.openLink(url); else env.openLink?.(url); };
  const doLookup = (w) => {
    const url = lookupUrl(state.prefs.dict, w);
    if (!url) { state.msg = 'Set a dictionary address first (Settings).'; touch(); return; }
    srs.noteChecked(state.records, w, day()); state.prefs.stats.lookups += 1; save.rec(); save.prefs(); touch(); checkAch();
    openLink(url);
  };
  const requestLookup = (w) => {
    const D = state.prefs.dict;
    if (isChild() || D.mode === 'never') return;
    if (D.mode === 'ask' && !D.noticed) { state.pending = w; go('notice'); return; }
    doLookup(w);
  };
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const setCfg = (patch, pace) => {
    state.cfg = normalizeCfg({ ...state.cfg, ...patch, ...(pace ? { preset: 'custom' } : {}) });
    save.cfg(); touch();
  };
  const setPref = (k, v) => { state.prefs[k] = v; save.prefs(); touch(); };
  const exportNow = async (name, mime, text) => {
    let res = null;
    try { res = wg.exportFile ? await wg.exportFile(name, mime, text) : await env.share?.(text); } catch { res = null; }
    const ok = Boolean(res && (res.ok || res.shared));
    state.msg = ok ? `Exported ${name}.` : 'Could not export on this device. Your data is unchanged.';
    if (ok) { state.prefs.stats.exports += 1; save.prefs(); checkAch(); }
    touch();
  };
  const backupText = () => buildBackup({ cfg: state.cfg, prefs: { ...state.prefs, scheme: state.scheme, textScaleIdx: state.textScaleIdx }, records: state.records, sessions: state.sessions, study: state.study, day: day(), journey: state.journey, ach: state.ach, est: state.est });
  const importNow = async () => {
    let text = null;
    try { text = wg.importText ? await wg.importText() : null; } catch { text = null; }
    if (!text) { state.msg = wg.importText ? 'Nothing was imported.' : 'Importing is not available on this device yet.'; touch(); return; }
    const res = parseBackup(text);
    if (!res.ok) { state.msg = res.error; touch(); return; }
    const d = res.data;
    state.records = d.records; state.sessions = d.sessions;
    if (d.cfg) state.cfg = normalizeCfg(d.cfg);
    if (d.study && Array.isArray(d.study.words)) state.study = d.study;
    if (d.journey && d.journey.stars) state.journey = { ...freshJourney(), ...d.journey };
    if (d.ach && typeof d.ach === 'object') state.ach = d.ach;
    if (d.est) state.est = d.est;
    if (d.prefs) {
      state.prefs = mergePrefs(d.prefs);
      if (SCHEMES[d.prefs.scheme]) { state.scheme = d.prefs.scheme; storage.set('scheme', state.scheme); }
    }
    for (const k of ['cfg', 'prefs', 'rec', 'sess', 'study', 'journey', 'ach', 'est']) save[k]();
    state.msg = `Imported ${Object.keys(state.records).length} words and ${state.sessions.length} sessions.`; touch();
  };
  const deleteAll = () => {
    state.records = {}; state.sessions = []; state.study = { words: [], day: 0 }; state.bestScores = {}; state.journey = freshJourney(); state.ach = {}; state.est = null;
    state.cfg = normalizeCfg(DEFAULT_CFG); state.prefs = freshPrefs(); state.confirmDel = false;
    for (const k of ['cfg', 'prefs', 'rec', 'sess', 'study', 'best', 'journey', 'ach', 'est']) save[k]();
    state.msg = 'Everything was deleted from this profile.'; touch();
  };
  // A grown-up question before a child profile can change settings, data or profiles.
  const needGate = (next) => {
    if (!isChild() || state.parentUntil > state.t) return false;
    const a = 6 + rng.int(8), b = 4 + rng.int(7), ans = a + b;
    const opts = new Set([ans]); while (opts.size < 4) opts.add(ans + rng.int(9) - 4 || ans + 5);
    state.gate = { a, b, ans, opts: rng.shuffle([...opts]), wrong: false }; state.gateNext = next; go('gate'); return true;
  };
  const openNext = (scene) => { if (GATED.has(scene) && needGate(scene)) return; go(scene); };

  // One tap on a form row.
  const onFormTap = (id) => {
    const parts = id.split(':'), a = parts[0], b = parts[1];
    const cfg = state.cfg;
    const step = (b === 'inc' ? 1 : -1);
    switch (a) {
      case 'preset': if (b !== 'custom') { state.cfg = normalizeCfg(applyPreset(cfg, b)); save.cfg(); touch(); } return;
      case 'ctx': setCfg({ contexts: toggle(cfg.contexts, b === 'first' ? 'first' : Number(b)) }); return;
      case 'attr': setCfg({ attrs: toggle(cfg.attrs, b) }); return;
      case 'topic': setCfg({ topics: toggle(cfg.topics, b) }); return;
      case 'combine': setCfg({ combine: b }); return;
      case 'minLen': setCfg({ minLen: cfg.minLen + step, maxLen: Math.max(cfg.maxLen, cfg.minLen + step) }); return;
      case 'maxLen': setCfg({ maxLen: cfg.maxLen + step }); return;
      case 'setSize': setCfg({ setSize: SET_SIZES[Math.max(0, Math.min(SET_SIZES.length - 1, SET_SIZES.indexOf(cfg.setSize) + step))] }); return;
      case 'source': setCfg({ source: b }); return;
      case 'qt': { const next = toggle(cfg.qtypes, b); if (next.length) setCfg({ qtypes: next }); return; }
      case 'secs': setCfg({ secs: SPEED_OPTS[Math.max(0, Math.min(SPEED_OPTS.length - 1, SPEED_OPTS.indexOf(cfg.secs) + step))] }, true); return;
      case 'endBy': setCfg({ endBy: b }, true); return;
      case 'sess':
        if (cfg.endBy === 'time') setCfg({ secsIdx: Math.max(0, Math.min(SESSION_SECS.length - 1, cfg.secsIdx + step)) }, true);
        else setCfg({ qIdx: Math.max(0, Math.min(QUESTION_COUNTS.length - 1, cfg.qIdx + step)) }, true);
        return;
      case 'lives': setCfg({ lives: Number(b) }, true); return;
      case 'opts': if (b === 'hints') setCfg({ hints: !cfg.hints }, true); else setCfg({ skipKnown: !cfg.skipKnown }); return;
      case 'play': if (state.scene === 'stageinfo') startRun(state.sel.kind, state.sel.world, state.sel.stage); else startSession(); return;
      case 'study': if (!state.study.words.length) makeStudySet(); go('studylist'); return;
      case 'newset': if (makeStudySet() && state.scene !== 'studylist') go('studylist'); return;
      case 'cards': state.cardIdx = 0; state.cardFlip = false; go('cards'); return;
      case 'quizset': setCfg({ source: 'study' }); startSession({ source: 'study' }); return;
      case 'practiseweak': startSession({ source: 'weak' }); return;
      case 'go': if (b === 'trace') { openTrace(0); return; } if (b === 'place') { startRun('place'); return; } openNext(b); return;
      case 'look': requestLookup(b); return;
      case 'known': srs.setKnown(state.records, b, !srs.isKnown(state.records, b), day()); save.rec(); touch(); return;
      case 'notice':
        if (b === 'cancel') { goBack(); return; }
        if (b === 'always') state.prefs.dict.mode = 'always';
        state.prefs.dict.noticed = true; save.prefs(); doLookup(state.pending); goBack(); return;
      case 'scheme': state.scheme = Number(b); storage.set('scheme', state.scheme); touch(); return;
      case 'sound': state.prefs.sound = b === 'on'; audio.setMuted?.(!state.prefs.sound); save.prefs(); touch(); return;
      case 'voice': setPref('voice', Number(b)); return;
      case 'motion': setPref('calm', b === 'calm'); return;
      case 'acc': {
        const k = b;
        if (k === 'font') setPref('font', state.prefs.font === 'dys' ? 'std' : 'dys');
        else if (k === 'senior') {
          const on = !state.prefs.senior; state.prefs.senior = on; if (on) { state.prefs.calm = true; if (state.textScaleIdx < 2) { state.textScaleIdx = 2; storage.set('textScaleIdx', 2); } } save.prefs(); touch();
        } else setPref(k, !state.prefs[k]);
        return;
      }
      case 'rem': {
        const R = state.prefs.remind;
        if (b === 'on') R.on = !R.on; else R.hour = Number(b.slice(1));
        save.prefs(); touch(); wg.scheduleReminder?.(R.on, R.hour); return;
      }
      case 'goal': state.prefs.goal = Math.max(10, Math.min(100, state.prefs.goal + 10 * step)); save.prefs(); touch(); return;
      case 'dmode': state.prefs.dict.mode = b; save.prefs(); touch(); return;
      case 'dict': state.prefs.dict.choice = b; save.prefs(); touch(); return;
      case 'dcustom': Promise.resolve(wg.askText?.('Dictionary address with {word} in it, starting with https://', state.prefs.dict.custom)).then((v) => { if (typeof v === 'string') { state.prefs.dict.custom = v.trim(); save.prefs(); touch(); } }); return;
      case 'exp':
        if (b === 'json') exportNow('word-game-backup.json', 'application/json', backupText());
        else if (b === 'words') exportNow('word-game-words.csv', 'text/csv', wordsCsv(state.records));
        else exportNow('word-game-sessions.csv', 'text/csv', sessionsCsv(state.sessions));
        return;
      case 'imp': importNow(); return;
      case 'del': if (b === 'ask') { state.confirmDel = true; touch(); } else if (b === 'yes') deleteAll(); else { state.confirmDel = false; touch(); } return;
      // ---- profiles, age screen, parent gate
      case 'age': addProfile(b === 'child' ? 'child' : 'adult'); return;
      case 'padd': addProfile(b === 'child' ? 'child' : 'adult', b === 'senior'); return;
      case 'pswitch': switchProfile(b); return;
      case 'pdel':
        if (state.confirmProfile !== b) { state.confirmProfile = b; touch(); return; }
        state.profiles = state.profiles.filter((p) => p.id !== b); state.confirmProfile = '';
        for (const k of PROFILE_KEYS) store.remove(pkey(b, k));
        if (!state.profiles.length) { store.set('profiles', []); state.scene = 'age'; touch(); return; }
        if (state.profile === b) switchProfile(state.profiles[0].id); else { save.profiles(); touch(); }
        return;
      case 'prename': Promise.resolve(wg.askText?.('Name for this player', state.profiles.find((p) => p.id === b)?.name)).then((v) => { if (typeof v === 'string' && v.trim()) { const p = state.profiles.find((x) => x.id === b); if (p) { p.name = v.trim().slice(0, 16); save.profiles(); touch(); } } }); return;
      case 'gate':
        if (Number(b) === state.gate.ans) { state.parentUntil = state.t + 300; const next = state.gateNext; state.gate = null; state.back.pop(); go(next); } else { state.gate.wrong = true; state.gate.opts = rng.shuffle(state.gate.opts); touch(); }
        return;
      // ---- journey
      case 'jgo': if (b === 'place') startRun('place'); else if (b === 'map') { state.back = ['title']; setScene('journey'); } else if (b === 'next' && state.runResult) { const r = state.runResult; startRun(r.next === 'check' ? 'check' : 'stage', r.world, r.next === 'check' ? -1 : r.stage + 1); } return;
      default: return;
    }
  };

  const updateForm = (input) => {
    const Q = lay().rules, p = input.pointer, keys = input.keys.pressed;
    const F = getForm(), vp = Q.viewport;
    formMetrics.content = F.layout.height; formMetrics.view = vp.h; formMetrics.max = Math.max(0, F.layout.height - vp.h);
    if (wheelInput.dy) { setFormScroll(state.formScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setFormScroll(state.formScroll + 70);
    if (keys.has('ArrowUp')) setFormScroll(state.formScroll - 70);
    if (keys.has('PageDown') || keys.has('Space')) setFormScroll(state.formScroll + vp.h * 0.9);
    if (keys.has('PageUp')) setFormScroll(state.formScroll - vp.h * 0.9);
    if (keys.has('Home')) setFormScroll(0);
    if (keys.has('End')) setFormScroll(formMetrics.max);
    state.formScroll = Math.max(0, Math.min(state.formScroll, formMetrics.max));
    if (p.pressed) {
      const noBack = state.scene === 'age';
      if (!noBack && inRect(p.x, p.y, Q.back)) { drag = null; goBack(); return; }
      if (F.def.primary && !F.def.primary.disabled && inRect(p.x, p.y, Q.next)) { drag = null; pressed('formNext'); onFormTap(F.def.primary.id); return; }
      if (inRect(p.x, p.y, Q.dec) && state.textScaleIdx > 0) { state.textScaleIdx -= 1; storage.set('textScaleIdx', state.textScaleIdx); state.formScroll = 0; pressed('textDec'); touch(); return; }
      if (inRect(p.x, p.y, Q.inc) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx += 1; storage.set('textScaleIdx', state.textScaleIdx); state.formScroll = 0; pressed('textInc'); touch(); return; }
      if (inRect(p.x, p.y, Q.scrollbar) && formMetrics.max > 0) drag = { bar: true };
      else if (inRect(p.x, p.y, vp)) drag = { x0: p.x, y0: p.y, s0: state.formScroll, moved: false };
      else drag = null;
    }
    if (drag) {
      if (drag.bar) {
        if (p.down) setFormScroll(((p.y - Q.scrollbar.y) / Q.scrollbar.h) * (formMetrics.max + formMetrics.view) - formMetrics.view / 2);
        else drag = null;
      } else {
        if (p.down && (drag.moved || Math.abs(p.y - drag.y0) > TAP_SLOP)) { drag.moved = true; setFormScroll(drag.s0 - (p.y - drag.y0)); }
        if (!p.down || p.released) {
          const d = drag; drag = null;
          if (!d.moved) {
            const h = hitAt(F.layout, d.x0 - vp.x - Q.padX, d.y0 - vp.y + state.formScroll);
            if (h && !h.disabled) { pressed(h.id); onFormTap(h.id); }
          }
        }
      }
    }
  };

  // ---------------------------------------------------------------- journey map (a scrolling world map)
  let mapCache = null;
  const getMap = () => { const Q = lay().rules, w = Q.viewport.w; if (!mapCache || mapCache.w !== w || mapCache.v !== lex.version()) mapCache = { w, v: lex.version(), m: jny.mapLayout(w) }; return mapCache.m; };
  const setMapScroll = (v, max) => { state.mapScroll = Math.max(0, Math.min(v, max)); };
  const updateMap = (input) => {
    const Q = lay().rules, p = input.pointer, keys = input.keys.pressed, vp = Q.viewport, M = getMap();
    const max = Math.max(0, M.height - vp.h); formMetrics.content = M.height; formMetrics.view = vp.h; formMetrics.max = max;
    if (wheelInput.dy) { setMapScroll(state.mapScroll + wheelInput.dy, max); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setMapScroll(state.mapScroll + 90, max);
    if (keys.has('ArrowUp')) setMapScroll(state.mapScroll - 90, max);
    if (keys.has('PageDown')) setMapScroll(state.mapScroll + vp.h * 0.9, max);
    if (keys.has('PageUp')) setMapScroll(state.mapScroll - vp.h * 0.9, max);
    if (p.pressed) {
      if (inRect(p.x, p.y, Q.back)) { drag = null; goBack(); return; }
      if (inRect(p.x, p.y, Q.next)) { drag = null; pressed('place'); startRun('place'); return; }
      drag = inRect(p.x, p.y, vp) ? { x0: p.x, y0: p.y, s0: state.mapScroll, moved: false } : null;
    }
    if (drag) {
      if (p.down && (drag.moved || Math.abs(p.y - drag.y0) > TAP_SLOP)) { drag.moved = true; setMapScroll(drag.s0 - (p.y - drag.y0), max); }
      if (!p.down || p.released) {
        const d = drag; drag = null;
        if (!d.moved) {
          const cx = d.x0 - vp.x, cy = d.y0 - vp.y + state.mapScroll;
          const node = M.items.find((n) => n.type === 'node' && Math.hypot(n.x - cx, n.y - cy) <= n.r + 10);
          if (node) { state.sel = { kind: node.kind === 'check' ? 'check' : 'stage', world: node.world, stage: node.stage }; pressed('node'); go('stageinfo'); }
        }
      }
    }
  };

  // ---------------------------------------------------------------- tracing letters
  const openTrace = (i) => { state.tr = { i, idx: 0, done: false, cps: checkpoints(LETTERS[i]), t: 0 }; go('trace'); };
  const updateTrace = (input) => {
    const L = lay(), Q = L.rules, T = L.trace, p = input.pointer, tr = state.tr;
    if (!tr) { goBack(); return; }
    tr.t += 1 / 60;
    if (p.pressed) {
      if (inRect(p.x, p.y, Q.back)) { goBack(); return; }
      if (inRect(p.x, p.y, Q.next)) { const n = (tr.i + 1) % 26; state.tr = { i: n, idx: 0, done: false, cps: checkpoints(LETTERS[n]), t: 0 }; pressed('traceNext'); return; }
      if (inRect(p.x, p.y, L.traceHear)) { wg.speak?.(LETTER_NAMES[LETTERS[tr.i]], state.prefs.voice); caption(`[voice] ${LETTER_NAMES[LETTERS[tr.i]]}`); }
    }
    if (p.down && !tr.done) {
      const ux = (p.x - T.x) / T.w, uy = (p.y - T.y) / T.h;
      let guard = 0;
      while (tr.idx < tr.cps.length && guard++ < 6) {
        const c = tr.cps[tr.idx];
        if (Math.hypot(ux - c.x, uy - c.y) < (c.s ? 0.12 : 0.16)) tr.idx += 1; else break;
      }
      if (tr.idx >= tr.cps.length) {
        tr.done = true; state.prefs.stats.traced += 1; save.prefs(); playTone({ freq: 784, to: 1175, dur: 0.3, type: 'triangle', vol: 0.18 }); caption('[chime] well done');
        if (effects()) addParts(T.x + T.w / 2, T.y + T.h / 2, '#ffd166', 28);
        checkAch();
      }
    }
  };

  // ---------------------------------------------------------------- scenes
  const updateTitle = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer, T = lay().title;
    if (inRect(x, y, T.lockHit)) { pressLockup(); env.openArcforgeHome?.(); }
    else if (inRect(x, y, T.play)) startSession();
    else if (inRect(x, y, T.journey)) { pressed('journey'); go('journey'); }
    else if (inRect(x, y, T.setup) || inRect(x, y, T.sum)) { pressed('setup'); go('setup'); }
    else if (inRect(x, y, T.study)) { pressed('study'); if (!state.study.words.length) makeStudySet(); go('studylist'); }
    else if (inRect(x, y, T.review)) { if (srs.dueCount(state.records, day()) > 0) { pressed('review'); startSession({ source: 'due' }); } }
    else if (inRect(x, y, T.prog)) { pressed('prog'); go('progress'); }
    else if (inRect(x, y, T.more)) { pressed('more'); go('more'); }
    else if (inRect(x, y, T.auto)) { pressed('autoplay'); startSession({ auto: true }); }
  };

  const updateRules = (input) => {
    const Q = lay().rules, p = input.pointer, keys = input.keys.pressed;
    const setScroll = (v) => { state.rulesScroll = Math.max(0, Math.min(v, rulesMetrics.max)); };
    if (wheelInput.dy) { setScroll(state.rulesScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setScroll(state.rulesScroll + 70);
    if (keys.has('ArrowUp')) setScroll(state.rulesScroll - 70);
    if (keys.has('PageDown') || keys.has('Space')) setScroll(state.rulesScroll + rulesMetrics.view * 0.9);
    if (keys.has('PageUp')) setScroll(state.rulesScroll - rulesMetrics.view * 0.9);
    if (keys.has('Home')) setScroll(0);
    if (keys.has('End')) setScroll(rulesMetrics.max);
    if (p.pressed) {
      if (inRect(p.x, p.y, Q.scrollbar)) drag = { bar: true };
      else if (inRect(p.x, p.y, Q.viewport)) drag = { y0: p.y, s0: state.rulesScroll };
    }
    if (drag) {
      if (!p.down) drag = null;
      else if (drag.bar) setScroll(((p.y - Q.scrollbar.y) / Q.scrollbar.h) * (rulesMetrics.max + rulesMetrics.view) - rulesMetrics.view / 2);
      else setScroll(drag.s0 - (p.y - drag.y0));
    }
    state.rulesScroll = Math.max(0, Math.min(state.rulesScroll, rulesMetrics.max));
    if (!p.pressed) return;
    const { x, y } = p;
    if (inRect(x, y, Q.back)) { drag = null; goBack(); }
    else if (inRect(x, y, Q.next)) {
      if (state.rulesScroll >= rulesMetrics.max - 1) goBack();
      else setScroll(state.rulesScroll + rulesMetrics.view * 0.85);
      pressed('rulesNext');
    } else if (inRect(x, y, Q.dec) && state.textScaleIdx > 0) {
      state.textScaleIdx -= 1; state.rulesScroll = 0; storage.set('textScaleIdx', state.textScaleIdx); pressed('textDec');
    } else if (inRect(x, y, Q.inc) && state.textScaleIdx < TEXT_SCALES.length - 1) {
      state.textScaleIdx += 1; state.rulesScroll = 0; storage.set('textScaleIdx', state.textScaleIdx); pressed('textInc');
    }
  };

  const updateCards = (input) => {
    const p = input.pointer, L = lay(), Q = L.rules, C = L.cards;
    const words = state.study.words;
    if (input.keys.pressed.has('ArrowRight')) { state.cardIdx = Math.min(words.length - 1, state.cardIdx + 1); state.cardFlip = false; }
    if (input.keys.pressed.has('ArrowLeft')) { state.cardIdx = Math.max(0, state.cardIdx - 1); state.cardFlip = false; }
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Enter')) state.cardFlip = !state.cardFlip;
    if (!p.pressed) return;
    const { x, y } = p;
    if (inRect(x, y, Q.dec) && state.textScaleIdx > 0) { state.textScaleIdx -= 1; storage.set('textScaleIdx', state.textScaleIdx); return; }
    if (inRect(x, y, Q.inc) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx += 1; storage.set('textScaleIdx', state.textScaleIdx); return; }
    if (inRect(x, y, Q.back)) { goBack(); return; }
    if (inRect(x, y, Q.next)) { if (state.cardIdx >= words.length - 1) goBack(); else { state.cardIdx += 1; state.cardFlip = false; } pressed('cardNext'); return; }
    const w = words[state.cardIdx]; if (!w) return;
    const advance = () => { if (state.cardIdx < words.length - 1) { state.cardIdx += 1; state.cardFlip = false; } };
    if (inRect(x, y, C.know)) { srs.setKnown(state.records, w, true, day()); save.rec(); pressed('know'); advance(); return; }
    if (inRect(x, y, C.learn)) { srs.noteSeen(state.records, w, day()); srs.setKnown(state.records, w, false, day()); save.rec(); pressed('learn'); advance(); return; }
    if (inRect(x, y, C.body)) {
      if (state.cardFlip && !isChild() && state.prefs.dict.mode !== 'never' && y > C.body.y + C.body.h - 70) requestLookup(w);
      else {
        state.cardFlip = !state.cardFlip;
        if (state.cardFlip) { srs.noteSeen(state.records, w, day()); dirtyRec = true; }
        if (canSpeak()) wg.speak?.(w, state.prefs.voice);
      }
    }
  };

  const hintNow = () => {
    const r = state.round; if (!r || r.hinted >= 0 || !state.live.hints) return;
    const wrong = r.words.filter((w) => !w.correct); if (!wrong.length) return;
    r.hinted = wrong[rng.int(wrong.length)].slot;
    state.score = Math.max(0, state.score - 5); state.streak = 0; state.hintUsed = true;
    playTone({ freq: 330, to: 300, dur: 0.1, type: 'sine', vol: 0.12 });
  };

  const updatePlaying = (dt, input) => {
    const L = lay(), P = L.play, p = input.pointer, keys = input.keys.pressed;
    if (p.pressed && inRect(p.x, p.y, P.pause)) { state.paused = !state.paused; pressed('pause'); return; }
    if (keys.has('KeyP')) { state.paused = !state.paused; return; }
    if (state.paused) { if (p.pressed && inRect(p.x, p.y, P.stop)) endSession('stop'); return; }
    if (!state.byQuestions) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) { state.timeLeft = 0; endSession('time'); return; }
    }
    const round = state.round;
    if (!round) return;
    round.age += dt;
    for (const w of round.words) {
      w.x -= w.speed * dt;
      w.y += w.vy * dt;
      if (w.y < w.sliceTop || w.y > w.sliceBottom) { w.vy *= -1; w.y = Math.min(w.sliceBottom, Math.max(w.sliceTop, w.y)); }
    }
    // At most one action per tick against this same `round` reference: resolveRound() spawns a fresh round synchronously.
    if (p.pressed) {
      if (inRect(p.x, p.y, P.stop)) { endSession('stop'); return; }
      if (inRect(p.x, p.y, P.hint)) { hintNow(); pressed('hint'); return; }
      if (round.speak && inRect(p.x, p.y, P.plaque)) { wg.speak?.(round.speak, state.prefs.voice); return; }
      const hit = round.words.find((w) => w.slot !== round.hinted && Math.abs(p.x - L.wordX(w.x)) <= L.slipW(w.text) / 2 + 6 && Math.abs(p.y - L.wordY(w.slot, w.y)) <= L.chipH / 2 + 8 && inRect(p.x, p.y, P.band));
      if (hit) { resolveRound(hit.text); return; }
    }
    if (keys.has('KeyH')) { hintNow(); return; }
    for (const code of KEY_CODES) {
      if (keys.has(code)) {
        const w = round.words.find((rw) => rw.slot === KEY_CODES.indexOf(code));
        if (w && w.slot !== round.hinted) { resolveRound(w.text); return; }
      }
    }
    const correctWord = round.words.find((w) => w.correct);
    if (correctWord && correctWord.x + correctWord.w / 2 < 0) resolveRound(null);
  };

  // Auto Play's THINK -> REVEAL -> ACT loop. Pause is checked FIRST so it registers at any instant.
  const updateAutoplay = (dt, input) => {
    const P = lay().play, p = input.pointer;
    if (p.pressed) {
      if (inRect(p.x, p.y, P.apause)) { state.autoPaused = !state.autoPaused; pressed('autoPause'); return; }
      if (inRect(p.x, p.y, P.aexit)) { exitAutoplay(); return; }
    }
    if (state.autoPaused) return;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) { state.timeLeft = 0; endSession('time'); return; }
    if (p.pressed) {
      if (inRect(p.x, p.y, P.acolour)) { cycleScheme(); pressed('colour'); return; }
      if (inRect(p.x, p.y, P.dec) && state.autoThinkIdx > 0) { state.autoThinkIdx -= 1; storage.set('autoThinkIdx', state.autoThinkIdx); pressed('thinkDec'); return; }
      if (inRect(p.x, p.y, P.inc) && state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx += 1; storage.set('autoThinkIdx', state.autoThinkIdx); pressed('thinkInc'); return; }
    }
    const round = state.round;
    if (!round) return;
    state.autoPhaseT += dt;
    if (state.autoPhase === 'think') {
      if (state.autoPhaseT >= THINK_STEPS[state.autoThinkIdx]) { state.autoPhase = 'reveal'; state.autoPhaseT = 0; }
    } else if (state.autoPhase === 'reveal' && state.autoPhaseT >= REVEAL_SECONDS) {
      const answer = round.words.find((w) => w.correct);
      state.autoPhase = 'think'; state.autoPhaseT = 0;
      if (answer) resolveRound(answer.text);
    }
  };

  const reviewRows = () => state.history.filter((x) => !x.correct).concat(state.history.filter((x) => x.correct));
  const reviewPages = () => Math.max(1, Math.ceil(state.history.length / lay().over.perPage));
  const updateGameover = (input) => {
    state.reviewPage = Math.min(state.reviewPage, reviewPages() - 1);
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer, O = lay().over;
    if (inRect(x, y, O.prev)) { state.reviewPage = Math.max(0, state.reviewPage - 1); pressed('prev'); return; }
    if (inRect(x, y, O.next)) { state.reviewPage = Math.min(reviewPages() - 1, state.reviewPage + 1); pressed('next'); return; }
    if (!state.autoPlay && !isChild() && state.prefs.dict.mode !== 'never' && (wg.openLink || env.openLink)) {
      const rows = reviewRows(), allRight = rows.length && rows.every((r) => r.correct), top = allRight ? O.rowsTop + 28 : O.rowsTop;
      const slice = rows.slice(state.reviewPage * O.perPage, (state.reviewPage + 1) * O.perPage);
      for (let i = 0; i < slice.length; i += 1) if (!slice[i].letter && inRect(x, y, O.lookRect(i, top))) { requestLookup(slice[i].word); return; }
    }
    if (state.autoPlay) {
      if (inRect(x, y, O.again)) startSession({ auto: true });
      else if (inRect(x, y, O.change)) exitAutoplay();
      return;
    }
    const R = state.runResult;
    if (R && state.run) {
      if (inRect(x, y, O.again)) {
        if (R.pass && R.next === 'stage') startRun('stage', R.world, R.stage + 1);
        else if (R.pass && R.next === 'check') startRun('check', R.world, -1);
        else if (R.pass) { state.back = ['title']; setScene('journey'); }
        else startRun(R.type, R.world, R.stage);
      } else if (inRect(x, y, O.change)) { state.back = ['title']; setScene('journey'); }
      return;
    }
    if (inRect(x, y, O.again)) startSession(state.kind === 'review' ? { source: 'due' } : {});
    else if (inRect(x, y, O.change)) { state.back = ['title']; setScene('setup'); }
  };

  // particles and presentation clocks advance with the fixed step
  const stepFx = (dt) => {
    for (const q of state.parts) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; }
    if (state.parts.length) state.parts = state.parts.filter((q) => q.age < q.life);
    if (state.toast && (state.toast.t += dt) > 2.4) state.toast = null;
    if (state.banner && (state.banner.t += dt) > 1.1) state.banner = null;
    if (state.caption && (state.caption.t += dt) > 1.6) state.caption = null;
    if (state.badgeToast && (state.badgeToast.t += dt) > 2.4) state.badgeToast = null;
    state.shake = Math.max(0, state.shake - dt * 3.2);
    state.flash = Math.max(0, state.flash - dt * 3.5);
  };

  return {
    update(dt, input) {
      host.lefty = Boolean(state.prefs.lefty);
      const frozen = (state.scene === 'autoplay' && state.autoPaused) || (state.scene === 'playing' && state.paused);
      if (!frozen) {
        state.t += dt; state.sceneT += dt;
        if (state.press && (state.press.t += dt) > 0.6) state.press = null;
        if (state.fx && (state.fx.t += dt) > 0.8) state.fx = null;
        stepFx(dt);
      }
      if (lex.version() !== state.dataVersion) { state.dataVersion = lex.version(); touch(); }
      const sc = state.scene;
      if (sc === 'title') updateTitle(input);
      else if (sc === 'playing') updatePlaying(dt, input);
      else if (sc === 'autoplay') updateAutoplay(dt, input);
      else if (sc === 'gameover') updateGameover(input);
      else if (sc === 'rules') updateRules(input);
      else if (sc === 'cards') updateCards(input);
      else if (sc === 'journey') updateMap(input);
      else if (sc === 'trace') updateTrace(input);
      else if (FORM_SCENES.has(sc)) updateForm(input);
      if (state.scene !== 'rules' && state.scene !== 'journey' && !FORM_SCENES.has(state.scene)) wheelInput.dy = 0;
      if (dirtyRec && state.scene === 'title') save.rec();
      // 'demo-limit': input is a deliberate no-op — see design/GDD.md "Demo cut".
    },

    render(ctx) {
      const form = FORM_SCENES.has(state.scene) ? getForm() : null;
      const dueN = srs.dueCount(state.records, day());
      const me = state.profiles.find((p) => p.id === state.profile);
      const Lc = layoutFor(meta.width, meta.height);
      render(ctx, state, env.manifest.title, DEMO_SESSION_LIMIT, Lc, env, {
        form, entry: lex.entry, posName: lex.posName, sumLine: sumLine(state.cfg, state.profiles.length > 1 ? me?.name : ''), dueN, canSpeak: canSpeak(),
        lookupOn: !isChild() && state.prefs.dict.mode !== 'never' && Boolean(wg.openLink || env.openLink),
        best: state.bestScores[`${state.cfg.preset === 'classic' ? 'c' : paceKey(state.cfg)}|play`] ?? 0, studyN: state.study.words.length, goal: state.prefs.goal,
        todayN: state.prefs.today.day === day() ? state.prefs.today.n : 0, streakN: state.prefs.streak.last >= day() - 1 ? state.prefs.streak.n : 0,
        map: state.scene === 'journey' ? getMap() : null, journey: state.journey, jny, stars: jny.totalStars(state.journey), prefs: state.prefs, senior: state.prefs.senior,
        trace: state.scene === 'trace' ? state.tr : null, LETTERS, STROKES_OK: true,
      });
      if (state.badgeToast) drawBadgeToast(ctx, Lc, state.badgeToast);
    },

    getState() { return state; },

    // Centre of a control on the current form screen (scrolls it into view first). Used by the scripted tests and screenshot driver.
    hitCenter(id) {
      if (!FORM_SCENES.has(state.scene)) return null;
      const F = getForm(), Q = lay().rules, vp = Q.viewport;
      for (const it of F.layout.items) for (const h of it.hits) {
        if (h.id !== id) continue;
        const maxS = Math.max(0, F.layout.height - vp.h);
        const cy = it.y + h.y + h.h / 2;
        if (cy - state.formScroll < 40 || cy - state.formScroll > vp.h - 40) state.formScroll = Math.max(0, Math.min(maxS, cy - vp.h / 2));
        return { x: vp.x + Q.padX + h.x + h.w / 2, y: vp.y + cy - state.formScroll };
      }
      return null;
    },
    // Centre of a Journey map node (scrolls it into view). Used by tests and the screenshot driver.
    nodeCenter(world, stage) {
      const M = getMap(), Q = lay().rules, vp = Q.viewport, n = M.items.find((x) => x.type === 'node' && x.world === world && x.stage === stage);
      if (!n) return null;
      const max = Math.max(0, M.height - vp.h);
      if (n.y - state.mapScroll < 60 || n.y - state.mapScroll > vp.h - 60) state.mapScroll = Math.max(0, Math.min(max, n.y - vp.h / 2));
      return { x: vp.x + n.x, y: vp.y + n.y - state.mapScroll };
    },

    // kit 1.6.1: exempts everything except real play from the free-preview timer.
    isPreviewExempt() { return !(state.scene === 'playing' && !state.autoPlay); },
  };
}
