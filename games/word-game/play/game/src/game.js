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
  W, H, BAND_TOP, lanes, laneSlice, slipWidth, inRect, layoutFor, host, homeOpts,
  TEXT_SCALES, THINK_STEPS, REVEAL_SECONDS, wheelInput, rulesMetrics, formMetrics,
  hearRect,
} from './layout.js';
import * as lex from './lexicon.js';
import * as adapt from './adapt.js';
import { QTYPES, DEFAULT_CFG, normalizeCfg, applyPreset, SESSION_SECS, QUESTION_COUNTS, SET_SIZES, sessionSeconds, questionCount, paceKey } from './config.js';
import { chooseKind, build, canAsk, kindAvailable, extras, extraWrong, REL_QUIZ_KINDS } from './quiz.js';
import { ART_WORDS } from './art.js';
import * as kb from './kb.js';
import * as deck from './deck.js';
import { PRACTICE_SCENES, deckItems, pagesPer, trickyPool } from './practice.js';
import * as srs from './srs.js';
import * as facets from './facets.js';
import { screenRows, FORM_SCENES, SPEED_OPTS, sumLine, SLIP_ADVICE } from './screens.js';
import { layoutForm, hitAt } from './forms.js';
import { lookupUrl, DICTS, dictLabel, onlineUrl, ONLINE_THES } from './dict.js';
import { resolveWord, normalise } from './findword.js';
import { buildBackup, wordsCsv, sessionsCsv, parseBackup } from './exporter.js';
import * as jny from './journey.js';
import { LETTERS, LETTER_NAMES, checkpoints, letterEntry, TRACE_STYLES } from './letters.js';
import * as alpha from './alpha.js';
import { cardExtras, tierOf, TIERS3 } from './study.js';
import { ACH, newBadges } from './ach.js';
import { createExtras } from './game7.js';
import { RULES } from './content.js';
import * as LK from './lookup.js';
import { drawLookup, geom as lookupGeom, SUGG_MAX } from './lookupui.js';
export { wheelInput, rulesMetrics, formMetrics };

// `meta.width/height` are updated live by the kit on every resize (fluid viewport); every rect comes from layoutFor().
export const meta = { width: W, height: H, fluid: { short: 720 } };

const DEMO_SESSION_LIMIT = 2;      // web preview: a taste only, see docs/GAME-CONTRACT.md "Web preview"
const RECENT_WORDS_MAX = 8;
const SPEED_BASE = 140, SPEED_PER_POINT = 18, SPEED_CAP_BONUS = 260, SPEED_JITTER = 40;   // Classic pace (the original drift)
const KEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const MILESTONES = [3, 6, 10, 15, 20, 30];
const lay = () => layoutFor(meta.width, meta.height);
const multOf = (streak) => (streak >= 10 ? 4 : streak >= 6 ? 3 : streak >= 3 ? 2 : 1);
const TAP_SLOP = 16;
const AUDIO_KINDS = new Set(['listening', 'letter-hear', 'hearmeaning', 'hearspell', 'pron']);   // questions that need the phone voice
const GATED = new Set(['settings', 'data', 'profiles', 'together', 'reports', 'caregiver']);          // behind the parent gate in a child profile
const PROFILE_KEYS = ['cfg', 'prefs', 'rec', 'sess', 'study', 'bests', 'journey', 'ach', 'est', 'lists', 'facets'];

const DEFAULT_PREFS = {
  sound: true, voice: 1, accent: 'us', typoOk: false, conf: { n: 0, sureRight: 0, sureWrong: 0, unsureRight: 0 }, calm: false, goal: 20, reviewCap: 20,
  dict: { choice: 'oxford', mode: 'ask', custom: '', noticed: false },
  streak: { last: 0, n: 0 }, today: { day: 0, n: 0, secs: 0 },
  kindStats: {}, breakMin: 0, limitMin: 0, flags: [], dailyDone: 0, dailies: 0, mocks: 0, mock: { kinds: ['synonym', 'definition', 'spelling', 'cloze'], n: 20, secs: 20, band: 3, bandPinned: false },
  notes: {}, confused: [], rateEach: false, oneHand: false, ageGroup: null, level: null, ageSenior: false, font: 'std', cb: false, reduce: false, lefty: false, senior: false, captions: false, deaf: false, remind: { on: false, hour: 19 },
  stats: { exports: 0, lookups: 0, studySets: 0, traced: 0, bestStreak: 0 },
  recent: [], explored: [], autoCollect: false, alsoChip: true, traceStyle: 'upper', bed: { on: false, mins: 10, secs: 0, day: 0 },
  strands: {}, journal: [], era: { decades: [] }, vsize: null, vhist: [], voiceFirst: false, voiceFirstReset: true,
};
const freshPrefs = () => JSON.parse(JSON.stringify(DEFAULT_PREFS));
const mergePrefs = (p) => dropOld({
  ...DEFAULT_PREFS, ...p, dict: { ...DEFAULT_PREFS.dict, ...(p.dict ?? {}) }, streak: { ...DEFAULT_PREFS.streak, ...(p.streak ?? {}) },
  today: { ...DEFAULT_PREFS.today, ...(p.today ?? {}) }, mock: { ...DEFAULT_PREFS.mock, ...(p.mock ?? {}) }, kindStats: { ...(p.kindStats ?? {}) }, flags: Array.isArray(p.flags) ? p.flags : [], remind: { ...DEFAULT_PREFS.remind, ...(p.remind ?? {}) }, bed: { ...DEFAULT_PREFS.bed, ...(p.bed ?? {}) }, stats: { ...DEFAULT_PREFS.stats, ...(p.stats ?? {}) }, conf: { ...DEFAULT_PREFS.conf, ...(p.conf ?? {}) },
  strands: p.strands && typeof p.strands === 'object' ? { ...p.strands } : {}, journal: Array.isArray(p.journal) ? p.journal.filter((j) => j && typeof j.text === 'string').slice(-300) : [],
  era: { decades: Array.isArray(p.era?.decades) ? p.era.decades.filter((d) => typeof d === 'string').slice(0, 12) : [] }, vsize: p.vsize && typeof p.vsize === 'object' ? p.vsize : null, vhist: Array.isArray(p.vhist) ? p.vhist.slice(-12) : [], voiceFirst: Boolean(p.voiceFirst),
  explored: Array.isArray(p.explored) ? p.explored.filter((x) => typeof x === 'string').slice(-5000) : [], autoCollect: Boolean(p.autoCollect), alsoChip: p.alsoChip !== false,
  notes: p.notes && typeof p.notes === 'object' ? { ...p.notes } : {}, confused: Array.isArray(p.confused) ? p.confused.filter((c) => c && typeof c.a === 'string' && typeof c.b === 'string').slice(0, 80) : [],
}, p);
// old saves may carry the removed 'read words aloud automatically' key: it is ignored and dropped.
// Voice-first play (the game talks and listens by itself) from an old save is switched off once; players can turn it on again in Settings.
const dropOld = (o, saved) => { delete o.autoRead; delete o.narrate; if (!saved.voiceFirstReset) { o.voiceFirst = false; o.voiceFirstReset = true; } return o; };
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
    records: Object.create(null), facets: facets.newFacets(), sessions: [], study: { words: [], day: 0 },
    journey: freshJourney(), ach: {}, est: null, lists: [], write: null, adapt: 1,
    loaded: false,                                  // saved progress has been read; nothing is saved before this
    msg: '', confirmDel: false, confirmProfile: '', pending: '',
    back: [], cardIdx: 0, cardFlip: false,
    pr: { deck: '', page: 0, text: null, hl: -1, speaking: false, gotBoundary: false, hlT: 0, tiles: null, say: null, paste: null, memWord: '', conf: null, listening: false, tricky: 0, src: 'level', alpha: null, snd: null, keys: null, hunt: null, co: null, coMode: 'pic', web: null },
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
    an: { len: 5, secs: 0 }, trail: [], listSel: '', pendingAdd: [], addTarget: '', pick: [], pickMode: false, playSet: { words: [], kind: 'mixed', len: 10, secs: 0, label: '' }, textFind: { chars: 0, tokens: 0, found: [] }, t: 0, sceneT: 1, press: null, fx: null, toast: null, banner: null, caption: null, badgeToast: null, shake: 0, flash: 0, parts: [],
    round: null, empty: false, dataVersion: 0, breakShown: false, explore: '', cmp: null, reading: null,
    lk: null,                                       // the dictionary sheet: { view: 'search' | 'word', q, stack: [resolved words], scroll, hl, searchFirst, confirm }
  };

  let recentWords = [];
  let session = null;                               // { pool, bag, bagIdx, bagMode, kinds, source, dueSome, cfg }
  let dirtyRec = false, answersSinceSave = 0;
  let rev = 1;                                      // bumps whenever a form screen's content may have changed
  const touch = () => { rev += 1; };
  const curType = () => state.profiles.find((p) => p.id === state.profile)?.type ?? 'adult';
  const isChild = () => curType() === 'child';
  const bedOn = () => Boolean(state.prefs.bed?.on);
  const effects = () => !(state.prefs.calm || state.prefs.reduce || state.prefs.senior || bedOn());
  const setScene = (scene) => { if (scene !== state.scene && scene !== 'playchoose' && state.scene !== 'playchoose') { state.pick = []; state.pickMode = false; } if (state.pr.speaking && scene !== 'storyread') stopSpeech(); state.scene = scene; state.sceneT = 0; state.fx = null; state.formScroll = 0; if (scene === 'journey') focusMap(); if (scene !== 'data' && scene !== 'profiles') state.msg = scene === 'title' ? state.msg : ''; touch(); };
  const go = (scene) => { state.back.push(state.scene); if (state.back.length > 8) state.back.shift(); setScene(scene); };
  const goBack = () => { setScene(state.back.pop() ?? 'title'); };
  // The Journey opens at the world that matches the player's level (never past the worlds they have unlocked; the campaign order is unchanged).
  let mapFocused = false;
  const focusWorld = () => { const w = adapt.journeyWorld(planNow()); if (w === null) return null; let hi = 1; for (let i = 2; i < jny.WORLDS.length; i += 1) if (jny.isWorldUnlocked(state.journey, i)) hi = i; return Math.min(w, hi); };
  const focusMap = () => {
    if (mapFocused) return; mapFocused = true;
    const w = focusWorld(); if (w === null) return;
    const Q = lay().rules, M = getMap(), it = M.items.find((x) => x.type === 'world' && x.world === w);
    if (it) state.mapScroll = Math.max(0, Math.min(Math.max(0, M.height - Q.viewport.h), it.y - 10));
  };
  const pressed = (id) => { state.press = { id, t: 0 }; };
  const playTone = (opts) => {
    if (state.autoPlay || !state.prefs.sound) return;
    audio.tone(bedOn() ? { ...opts, vol: (opts.vol ?? 0.2) * 0.35 } : state.prefs.calm || state.prefs.senior ? { ...opts, vol: (opts.vol ?? 0.2) * 0.6 } : opts);
  };
  const buzz = (k) => { if (!state.autoPlay && effects()) wg.haptic?.(k); };
  const canSpeak = () => Boolean(wg.canSpeak?.()) && !state.prefs.deaf;
  // ONE RULE: speech is only ever started by the player tapping a speaker / Hear / Listen / Play control. Nothing speaks on its own.
  const caption = (text) => { if (state.prefs.captions) state.caption = { text, t: 0 }; };
  // The settings the current session really uses: later-life mode removes the clock and lives; a child profile only sees vetted words.
  // Adaptive vocabulary (adapt.js is the single source of truth): the level window and kid-safety come from the plan, never from cfg.contexts.
  const planNow = () => adapt.plan(state.prefs, isChild());
  const kidMode = () => isChild() || state.prefs.ageGroup === 'child';
  const syncKid = () => { const p = planNow(); lex.setKidMode(p.kid); deck.setPlan(p); return p; };
  const eff = () => {
    const c = adapt.effCfg(state.cfg, syncKid());
    if (state.prefs.senior || bedOn() || x7.voiceOn()) { c.endBy = 'questions'; c.qIdx = 0; c.secs = Math.max(30, c.secs || 30); c.lives = 0; }
    return c;
  };

  // ---------------------------------------------------------------- saved data (per profile)
  const put = (k, v) => { if (state.loaded) store.set(pkey(state.profile, k), v); };
  const save = {
    cfg: () => put('cfg', state.cfg), prefs: () => put('prefs', state.prefs),
    rec: () => { put('rec', state.records); put('facets', state.facets); dirtyRec = false; answersSinceSave = 0; },
    sess: () => put('sess', state.sessions), study: () => put('study', state.study), best: () => put('bests', state.bestScores),
    journey: () => put('journey', state.journey), ach: () => put('ach', state.ach), est: () => put('est', state.est), lists: () => put('lists', state.lists), facets: () => put('facets', state.facets),
    profiles: () => { store.set('profiles', state.profiles); store.set('active', state.profile); },
  };
  const applyLoaded = (v) => {
    const [cfg, prefs, rec, sess, study, bests, journey, ach, est, lists, fct] = v;
    state.cfg = cfg ? normalizeCfg(cfg) : normalizeCfg(DEFAULT_CFG);
    state.prefs = prefs ? mergePrefs(prefs) : freshPrefs();
    state.records = Object.assign(Object.create(null), rec && typeof rec === 'object' ? rec : {});     // no prototype: the word "constructor" must not find Object's own property
    state.facets = facets.clean(fct);                  // saved before facets existed: none yet, they build up from the old records (facets.js)
    state.sessions = Array.isArray(sess) ? sess : [];
    state.study = study && Array.isArray(study.words) ? study : { words: [], day: 0 };
    state.bestScores = bests && typeof bests === 'object' ? bests : {};
    state.journey = journey && journey.stars ? { ...freshJourney(), ...journey } : freshJourney();
    state.ach = ach && typeof ach === 'object' ? ach : {};
    state.est = est ?? null;
    state.lists = Array.isArray(lists) ? lists : []; for (const l of state.lists) if (l.id === 'looked') l.name = 'My words'; lex.setCustom(state.lists); syncHome();
    audio.setMuted?.(!state.prefs.sound);
    state.loaded = true; mapFocused = false; touch();
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

  // Age group: decides presentation and safety (never an explicit level). Leaving Later life undoes only what it switched on.
  const bumpText = (idx) => { if (state.textScaleIdx < idx) { state.textScaleIdx = idx; storage.set('textScaleIdx', idx); } };
  const applyAge = (k, quiet = false) => {
    const P = state.prefs;
    if (P.ageSenior && k !== 'later') { P.senior = false; P.calm = false; P.ageSenior = false; }
    P.ageGroup = k;
    const pr = adapt.presentation(k);
    if (pr) {
      if (k === 'later' && !P.senior) { P.senior = true; P.calm = true; P.ageSenior = true; }
      if (pr.cfg.preset) state.cfg = normalizeCfg({ ...state.cfg, ...pr.cfg });
      bumpText(pr.textIdx);
    }
    mapFocused = false; syncKid(); save.prefs(); save.cfg(); touch();
    if (!quiet) toastWords();
  };
  const toastWords = () => { state.badgeToast = { text: `Words now match: ${planNow().name}`, t: 0 }; };
  const setAge = (k) => { applyAge(adapt.validAge(k)); };
  const setLevel = (v, quiet = false) => {
    state.prefs.level = adapt.validLevel(v); mapFocused = false; if (!state.prefs.ageGroup) bumpText(adapt.levelTextIdx(state.prefs.level));   // Elementary starts at larger text unless an Age group already chose
    syncKid(); save.prefs(); touch(); if (!quiet) toastWords();
  };
  const addProfile = (type, senior = false, age = null) => {
    const n = state.profiles.length + 1, id = `p${Math.max(-1, ...state.profiles.map((p) => Number(p.id.slice(1)))) + 1}`;
    state.profiles.push({ id, name: `Player ${n}`, type });
    state.profile = id; state.loaded = false; save.profiles();
    const prefs = freshPrefs(); if (senior) { prefs.senior = true; prefs.calm = true; }
    const cfg = normalizeCfg(type === 'child' ? { ...DEFAULT_CFG, contexts: [0, 1], qtypes: ['definition', 'synonym', 'spelling'] } : DEFAULT_CFG);
    applyLoaded([cfg, prefs, null, null, null, null, null, null, null, null, null]);
    if (age) applyAge(adapt.validAge(age), true);
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
      explored: (state.prefs.explored ?? []).length, sessions: state.sessions.length, bestStreak: Math.max(S.bestStreak, state.bestStreak), perfect: false, met, know, streakDays: state.prefs.streak.n,
      goalHit: state.prefs.today.day === day() && state.prefs.today.n >= state.prefs.goal, stars: jny.totalStars(state.journey), checks,
      lettersDone: (state.journey.checks['0'] ?? 0) >= 70, traced: S.traced, dailies: state.prefs.dailies, mocks: state.prefs.mocks, lists: state.lists.length, stickers: ART_WORDS.filter((w) => rec[w] && (rec[w][2] >= 2 || rec[w][8])).length, formats: Object.values(state.prefs.kindStats).filter((x) => x[0] + x[1] > 0).length, placed: Boolean(state.est), studySets: S.studySets, lookups: S.lookups, exports: S.exports, ...extra,
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
  const dueWords = () => {                            // words due overall, plus words with one facet (recognise, recall, spell, listen...) due on its own
    const cap = state.prefs.reviewCap, a = srs.dueList(state.records, day(), cap);
    if (a.length >= cap) return a;
    const have = new Set(a), extra = facets.dueWords(state.facets, state.records, day(), cap).filter((w) => !have.has(w) && state.records[w]);
    return [...a, ...extra].slice(0, cap);
  };
  const dueCountAll = () => { const a = srs.dueList(state.records, day(), 1e9), have = new Set(a); return a.length + facets.dueWords(state.facets, state.records, day(), 1e9).filter((w) => !have.has(w) && state.records[w]).length; };
  // Record one answer on one facet of a word (before the overall record moves, so an old record can seed it).
  const FACET_CTX = { rec: 'meaning', rcl: 'meaning', spl: 'form', lis: 'sound', use: 'sentence', wri: 'own' };
  // X3: four strands of balanced learning. Counted per day for the last two weeks: in = meaning-focused input (reading, listening),
  // out = meaning-focused output (writing, speaking, typing), study = language-focused study (questions on words, decks), flu = fluency practice.
  const bumpStrand = (k, n = 1) => {
    if (state.autoPlay) return;
    const i = ['in', 'out', 'study', 'flu'].indexOf(k); if (i < 0) return;
    const L = (state.prefs.strands ??= {}), d = day(); (L[d] ??= [0, 0, 0, 0])[i] += n;
    for (const key of Object.keys(L)) if (Number(key) < d - 13) delete L[key];
  };
  const recFacet = (word, facet, correct, ms, ctx) => { if (state.autoPlay || !facet) return; facets.applyFacet(state.facets, word, facet, correct, ms, day(), state.records[word], ctx ?? FACET_CTX[facet]); };
  const weakWords = () => srs.weakList(state.records);
  const selectWords = (cfg = eff()) => adapt.pick(cfg, planNow()).pool;
  const safe = (list) => list.filter(lex.kidOk);                     // kid-safe mode: review, study and set words are filtered too
  const poolFor = (source) => {
    const cfg = eff();
    if (source === 'study') return safe(entriesOf(state.study.words));
    if (source === 'due') return safe(entriesOf(dueWords()));
    if (source === 'weak') return safe(entriesOf(weakWords()));
    if (source.startsWith('pack:')) return packEntries(source.slice(5));
    if (source.startsWith('set:')) return safe(entriesOf((extras()?.sets ?? []).find((s) => s.id === source.slice(4))?.words ?? []));
    if (source.startsWith('list:')) return entriesOf(state.lists.find((l) => l.id === source.slice(5))?.words ?? []);
    const p = selectWords(cfg);
    return cfg.skipKnown ? p.filter((e) => !srs.isKnown(state.records, e.w)) : p;
  };
  const makeStudySet = () => {
    const cfg = eff();
    const pool = selectWords(cfg).filter((e) => !srs.isKnown(state.records, e.w));
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
  // L6: show 2 to 6 words at once. 3 is the standard shape; other counts drop a wrong option or add more wrong ones taken from other words' answers.
  const FIT_LESS = new Set(['odd', 'ladder', 'inflect', 'build', 'general']), FIT_MORE = new Set(['letter-case', 'letter-hear', 'picture', 'definition', 'spelling', 'listening', 'cloze', 'sense']);
  const fitLanes = (q, e) => {
    const n = session?.cfg?.lanes ?? state.cfg.lanes ?? 3;
    if (n === 3 || state.autoPlay || session?.run) return q;
    if (n === 2) {
      if (FIT_LESS.has(q.kind) || q.options.length !== 3) return q;
      const wrong = q.options.map((o, i) => (o.correct ? -1 : i)).filter((i) => i >= 0);
      const drop = wrong[rng.int ? rng.int(wrong.length) : 0];
      return { ...q, options: q.options.filter((_, i) => i !== drop) };
    }
    if (q.kind === 'synonym' || q.kind === 'antonym') { const more = extraWrong(e, q, n - q.options.length, rng); return { ...q, options: rng.shuffle([...q.options, ...more.map((text) => ({ text, correct: false }))]) }; }
    if (!FIT_MORE.has(q.kind)) return q;
    const have = new Set(q.options.map((o) => o.text.toLowerCase())), opts = [...q.options];
    for (let i = 0; i < 40 && opts.length < n; i += 1) {
      const e2 = pickEntry(), q2 = e2 && e2.w !== e.w ? build(q.kind, e2, rng, avoidOf(e2)) : null;
      const t = q2?.options?.find((o) => o.correct)?.text;
      if (t && !have.has(t.toLowerCase()) && t.toLowerCase() !== (q.word ?? e.w).toLowerCase()) { have.add(t.toLowerCase()); opts.push({ text: t, correct: false }); }
    }
    return { ...q, options: rng.shuffle(opts) };
  };

  const LEECH_KINDS = ['cloze', 'definition', 'sense', 'breakword', 'build'];
  const nextQuestion = () => {
    const S = session, ctx = { canSpeak: canSpeak() && !state.autoPlay };
    for (let i = 0; i < 40; i += 1) {
      const e = pickEntry();
      const leech = !state.autoPlay && srs.isLeech(state.records[e.w]);            // a word that keeps slipping is taught another way: in a sentence, by parts, with its memory hook
      const dueF = !state.autoPlay && !leech ? facets.dueFacets(state.facets, e.w, day()) : [];             // a facet that is due on its own is asked in its own way
      const dueKinds = dueF.length ? S.kinds.filter((k) => dueF.includes(facets.facetOfKind(k))) : [];
      const kind = (leech && chooseKind(e, LEECH_KINDS, rng, ctx)) || (dueKinds.length && chooseKind(e, dueKinds, rng, ctx)) || chooseKind(e, S.kinds, rng, ctx);
      if (!kind) continue;
      const q = build(kind, e, rng, avoidOf(e));
      if (q) return { ...fitLanes(q, e), label: adapt.plainLabel(q.kind, q.label, session.cfg), band: e.band, ...(leech && e.mn ? { note: `${q.note ? `${q.note}. ` : ''}Memory hook: ${e.mn}` } : {}) };
    }
    for (let i = 0; i < 40; i += 1) {                  // nothing matched the chosen types: any question the word can answer
      const e = pickEntry(), kind = chooseKind(e, ['letter-case', 'definition', 'synonym', 'antonym', 'spelling'], rng, ctx);
      const q = kind && build(kind, e, rng, avoidOf(e));
      if (q) return { ...fitLanes(q, e), label: adapt.plainLabel(q.kind, q.label, session.cfg), band: e.band };
    }
    return null;
  };

  const spawnRound = () => {
    const q = nextQuestion();
    if (!q) { state.round = null; state.empty = true; return; }
    const cfg = session.cfg;
    const classic = cfg.secs === 0 || state.autoPlay;
    const speed = SPEED_BASE + Math.min(SPEED_CAP_BONUS, state.right * SPEED_PER_POINT);
    lanes.n = Math.max(2, Math.min(6, q.options.length));
    const SLICE_H = laneSlice(), SLICE_MARGIN = SLICE_H * 0.205;
    state.round = {
      kind: q.kind, label: q.label, hintLabel: q.hintLabel ?? '', noRec: Boolean(q.noRec), note: q.note ?? '', targetWord: q.prompt, word: q.word, art: q.art ?? '', letter: Boolean(q.letter), band: q.band, age: 0, meaning: q.meaning, speak: q.speak ?? '', hearable: canSpeak() && !state.autoPlay && (Boolean(q.speak) || x7.voiceOn()), hinted: -1,
      words: q.options.map((o, slot) => {
        const sliceTop = BAND_TOP + slot * SLICE_H + SLICE_MARGIN;
        const sliceBottom = BAND_TOP + (slot + 1) * SLICE_H - SLICE_MARGIN;
        const driftX = rng.range(0, 140);                // always drawn, so the rng sequence never depends on the pace
        const w = slipWidth(o.text), start = W + w / 2 + driftX * 0.15;
        return {
          text: o.text, correct: o.correct, slot, w,
          x: state.autoPlay || x7.voiceOn() ? W / 2 : classic ? W + 20 + driftX : start,
          y: rng.range(sliceTop, sliceBottom), vy: rng.range(-30, 30), sliceTop, sliceBottom,
          speed: classic ? (speed + rng.range(0, SPEED_JITTER)) / (cfg.pace || 1) : ((start + w / 2) / (cfg.secs * state.adapt)) * (1 + rng.range(0, 0.08)),
        };
      }),
    };
    if (!state.autoPlay) wg.announce?.(`${q.label}. ${q.prompt}. Choices: ${q.options.map((o) => o.text).join(', ')}.`);
    x7.onRound(state.round);
  };

  // ---------------------------------------------------------------- sessions
  // opts: source, auto, run {type, world, stage, label}, pool (entries), kinds, over {secs,questions,lives,hints,endBy}, ordered
  const beginSession = (opts = {}) => {
    const source = opts.source ?? state.cfg.source;
    let pool = opts.pool ?? poolFor(source), src = opts.pool ? 'run' : source;
    if (!pool.length && source !== 'whole') { src = 'whole'; pool = poolFor('whole'); }
    if (!pool.length) { state.msg = 'No words match your choices. Pick another Learning level or fewer kinds of words.'; touch(); return false; }
    const cfg = { ...eff(), ...(opts.over ?? {}) };
    if (opts.over?.secs && opts.run?.type !== 'place' && opts.run?.type !== 'mock' && cfg.pace && cfg.pace !== 1) cfg.secs = Math.round(opts.over.secs * cfg.pace * 10) / 10;   // fixed-pace sessions (Journey, Daily, decks) follow the difficulty tier too; the placement check and mock tests stay as set
    state.run = opts.run ?? null; state.runResult = null; state.newBadges = [];
    state.kind = state.run ? state.run.type : opts.kindLabel ?? (src === 'due' ? 'review' : 'play');
    state.adapt = 1;
    state.autoPlay = Boolean(opts.auto);
    state.autoPaused = false; state.paused = false;
    state.byQuestions = !state.autoPlay && (cfg.endBy === 'questions' || Boolean(opts.over?.questions));
    state.total = state.autoPlay ? 90 : state.byQuestions ? (opts.over?.questions ?? questionCount(cfg)) : sessionSeconds(cfg);
    state.timeLeft = state.total;
    state.history = []; state.reviewPage = 0; state.score = 0; state.streak = 0; state.bestStreak = 0; state.answered = 0; state.right = 0;
    state.lives = state.autoPlay ? 0 : cfg.lives; state.hintUsed = false; state.newBest = false; state.ms = 0; state.sessionNew = 0;
    state.live = { hints: cfg.hints !== false && !state.autoPlay, lives: state.lives, hintCost: cfg.hintCost ?? 5 };
    state.toast = null; state.banner = null; state.parts = []; state.empty = false; state.msg = '';
    state.bestKey = `${cfg.preset === 'classic' ? 'c' : paceKey(cfg)}|${state.kind}`;
    recentWords = [];
    let kinds = (opts.kinds ?? cfg.qtypes).filter((k) => !(state.autoPlay && AUDIO_KINDS.has(k)) && !(state.prefs.deaf && AUDIO_KINDS.has(k)));
    if (!kinds.length) kinds = ['synonym'];
    const ordered = Boolean(opts.ordered);
    if (!opts.pool && !state.autoPlay) {                   // only words that can answer one of the chosen question types (the relation types are rarer)
      const ca = { canSpeak: canSpeak() }, f = pool.filter((e) => kinds.some((k) => canAsk(e, k, ca)));
      if (f.length >= 6) pool = f;
    }
    session = {
      pool, kinds, cfg, ordered, bagMode: ordered || src !== 'whole' || pool.length <= 300, bag: ordered ? pool.slice() : rng.shuffle(pool), bagIdx: 0, source: src,
      dueSome: src === 'whole' && !state.autoPlay ? safe(entriesOf(dueWords())).slice(0, 12) : [],
    };
    state.autoPhase = 'think'; state.autoPhaseT = 0;
    spawnRound();
    if (state.empty) { state.autoPlay = false; state.run = null; state.msg = 'Could not make questions from these words. Try other question types or levels.'; setScene('title'); return false; }
    setScene(state.autoPlay ? 'autoplay' : 'playing');
    return true;
  };
  const breakDue = () => state.prefs.breakMin > 0 && state.prefs.today.day === day() && state.prefs.today.secs >= state.prefs.breakMin * 60;
  const limitHit = () => isChild() && state.prefs.limitMin > 0 && state.prefs.today.day === day() && state.prefs.today.secs >= state.prefs.limitMin * 60 && state.parentUntil <= state.t;
  const bedRoll = () => { const B = state.prefs.bed; if (B.day && B.day !== day()) { B.day = day(); B.secs = 0; } return B; };
  const bedDone = () => { const B = bedRoll(); return B.on && B.mins > 0 && B.secs >= B.mins * 60; };
  const startSession = (opts = {}) => {
    if (!opts.auto && bedDone()) { state.msg = 'It is time to rest. Sleep well. A grown-up can turn off Bedtime mode.'; setScene('title'); return; }
    if (!opts.auto && limitHit()) { state.msg = 'That is enough play for today. Come back tomorrow, or ask a grown-up.'; setScene('title'); return; }
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
    if (W_.k === 'letters') return ['letter-hear', 'letter-case', 'letter-next', 'letter-vowel', 'letter-find', 'letter-order', 'letter-pic', 'letter-look'];
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
    } else if (run.type === 'mock') {
      const M = run.mock, per = {};
      for (const h of state.history) { const p = (per[h.kind] ??= [0, 0]); p[1] += 1; if (h.correct) p[0] += 1; }
      const acc = n ? right / n : 0, avgMs = n ? Math.round(state.ms / n) : 0;
      const ready = acc >= 0.8 && avgMs <= M.secs * 1000 ? 'ready' : acc >= 0.65 ? 'nearly ready' : 'keep practising';
      const weak = Object.entries(per).filter(([, [r, c]]) => c >= 3).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1])[0];
      const advice = ready === 'ready' ? 'Good result. Try a harder level or a shorter time per question next.' : weak ? `Weakest section: ${weak[0]}. ${SLIP_ADVICE[weak[0]] ?? 'Study those words, then try again.'}` : 'Study a set at this level, then try again.';
      res.pass = ready === 'ready'; res.mock = { right, n, acc, avgMs, secs: M.secs, band: M.band, per, ready, advice };
      state.prefs.mocks += 1; save.prefs();
    } else {
      const per = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
      for (const h of state.history) if (h.band >= 0 && h.band <= 5) { per[h.band][1] += 1; if (h.correct) per[h.band][0] += 1; }
      const e = jny.estimateVocab(per), pw = jny.placedWorld(per);
      state.est = { day: day(), per, ...e, world: pw }; J.placed = Math.max(J.placed ?? 0, pw);
      state.est.setLevel = false;
      if (adapt.validLevel(state.prefs.level) === null && !state.autoPlay) { state.est.setLevel = true; setLevel(adapt.levelFromPlacement(per), true); }   // no Learning level chosen yet: the placement result becomes it
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
    if (P.today.day !== d) P.today = { day: d, n: 0, secs: 0 };
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
        if (state.kind === 'fluency' && state.answered >= 10) { const avg = Math.round(state.ms / state.answered), pa = state.bestScores.fluencyAvg; if (!pa || avg < pa) { state.bestScores.fluencyAvg = avg; save.best(); } }
      }
      state.sessionsCompleted += 1;
      if (state.prefs.autoCollect) for (const h of state.history) if (!h.correct && !h.letter && lex.entry(h.word)?.rank !== undefined) myWordsSet(h.word, true, true);   // quiet: missed words feed My words and spaced review
      monetization.track('session_end', { preset: state.cfg.preset, score: state.score });
      saveSessionRecord(); save.rec();
      checkAch({ perfect: state.answered >= 10 && state.right === state.answered });
    }
    if (state.run && state.run.type === 'place' && !state.autoPlay) setScene('placeresult'); else if (state.run && state.run.type === 'mock' && !state.autoPlay) setScene('mockresult'); else setScene('gameover');
    if (state.kind === 'daily' && !state.autoPlay && state.answered >= 5 && state.prefs.dailyDone !== day()) { state.prefs.dailyDone = day(); state.prefs.dailies += 1; save.prefs(); checkAch(); }
    if (!state.autoPlay && breakDue() && !state.breakShown) { state.breakShown = true; state.badgeToast = { text: 'Time for a short break?', t: 0 }; }
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
  // I4: an optional tap after an answer. A right answer that was a guess does not move the word up its memory boxes; a wrong
  // answer the player was sure about is a surprise, so the word comes back tomorrow.
  const applyRate = () => {
    const tt = state.toast, T = tt?.rate; if (!T || tt.rated) return;
    tt.rated = true; const C = state.prefs.conf, r = state.records[T.word];
    if (r) {
      const fk = facets.facetOfKind(T.kind), fr = state.facets[T.word]?.[fk];
      if (fr) { if (T.hit) facets.holdFacet(state.facets, T.word, fk, day()); else { fr[0] = 0; fr[1] = day() + 1; } }
      if (T.hit) { r[0] = T.before[0]; r[1] = day() + 1; C.sureRight = Math.max(0, C.sureRight - 1); C.unsureRight += 1; tt.sub = 'Noted. A guess does not move the word up; it comes back tomorrow.'; }
      else { r[0] = 0; r[1] = day() + 1; C.n += 1; C.sureWrong += 1; tt.sub = 'A surprise sticks. This word comes back tomorrow.'; }
      dirtyRec = true; save.rec(); save.prefs();
    }
    tt.t = Math.min(tt.t, 0.5); touch();
  };
  // N2: the words you confuse. Remember which wrong word was picked for which right one (single words only), most often first.
  const noteConfusion = (answer, picked, round) => {
    if (state.autoPlay || round.letter || round.noRec || state.run?.type === 'place') return;
    if (!/^[a-z]{3,15}$/.test(answer) || !/^[a-z]{3,15}$/.test(picked) || answer === picked) return;
    const L = state.prefs.confused, [a, b] = answer < picked ? [answer, picked] : [picked, answer];
    const hitp = L.find((c) => c.a === a && c.b === b);
    if (hitp) { hitp.n += 1; hitp.day = day(); } else { L.push({ a, b, n: 1, day: day() }); if (L.length > 80) { L.sort((x, y) => y.n - x.n || y.day - x.day); L.length = 60; } }
  };
  const resolveRound = (picked) => {
    const round = state.round;
    const shown = round.words.find((w) => w.text === picked) ?? round.words.find((w) => w.correct);
    const answer = round.words.find((w) => w.correct).text;
    const hit = picked !== null && picked === answer;
    const ms = Math.round(round.age * 1000);
    state.history.push({ word: round.word, kind: round.kind, meaning: round.meaning, answer, picked, correct: hit, prompt: round.targetWord, band: round.band, letter: round.letter });
    state.answered += 1; state.ms += ms;
    if (!state.autoPlay) wg.announce?.(hit ? 'Right.' : picked === null ? `Missed. The answer was ${answer}.` : `Not quite. The answer was ${answer}.`);
    const L = lay();
    const fxX = picked === null ? 0 : Math.max(shown.w / 2 + 12, Math.min(W - shown.w / 2 - 12, shown.x));
    const sx = picked === null ? L.play.band.x : L.wordX(fxX), sy = L.wordY(shown.slot, shown.y);
    state.fx = { kind: hit ? 'right' : picked === null ? 'miss' : 'wrong', x: fxX, y: shown.y, slot: shown.slot, w: shown.w, text: shown.text, t: 0, pts: 0, mult: 1 };
    const nowDay = day();
    let rateBefore = null, rateable = false;
    if (!state.autoPlay) {
      if (!round.letter && !round.noRec) {
        const before = srs.stageOf(state.records[round.word]);
        recFacet(round.word, facets.facetOfKind(round.kind), hit, ms, facets.contextOfKind(round.kind));
        rateBefore = state.records[round.word] ? state.records[round.word].slice() : srs.blank();
        srs.applyAnswer(state.records, round.word, hit, ms, nowDay);
        rateable = !state.run || state.run.type === 'stage';
        if (before === 'new' && hit) state.sessionNew += 1;
        dirtyRec = true; answersSinceSave += 1;
      }
      const P = state.prefs; if (P.today.day !== nowDay) P.today = { day: nowDay, n: 0, secs: 0 };
      P.today.n += 1; bumpStrand(state.kind === 'fluency' ? 'flu' : 'study', 1);
      const ks = (P.kindStats[round.kind] ??= [0, 0]); ks[hit ? 0 : 1] += 1;
      if (session.cfg.adaptive && session.cfg.secs > 0) state.adapt = hit ? (state.streak >= 3 ? Math.max(0.7, state.adapt * 0.96) : state.adapt) : Math.min(1.4, state.adapt * 1.12);
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
      state.toast = { good: true, text: round.letter ? round.meaning : round.noRec ? answer : round.word, sub: round.note || (round.letter || ['definition', 'spelling', 'listening', 'picture'].includes(round.kind) ? '' : round.meaning), t: 0, look: round.letter ? null : round.word, lookRel: REL_QUIZ_KINDS.has(round.kind) };
      if (state.prefs.alsoChip && !state.autoPlay && !round.letter && !state.toast.sub && (session.cfg.secs >= 15 || state.prefs.senior)) {   // one quiet pointer onward, never in a fast or timed round
        const e0 = lex.entry(round.word), ex = (e0?.syn ?? []).find((x) => lex.entry(x)?.rank !== undefined && lex.kidOk(lex.entry(x)) && x !== round.word) ?? (e0 ? LK.linkedWords(e0, 3)[0] : null);
        if (ex) state.toast.also = ex;
      }
      if (rateable && state.prefs.rateEach) { state.prefs.conf.n += 1; state.prefs.conf.sureRight += 1; state.toast.rate = { word: round.word, hit: true, before: rateBefore, kind: round.kind }; }
    } else {
      state.streak = 0;
      playTone({ freq: 330, to: 262, dur: 0.18, type: 'sine', vol: 0.12 });
      buzz('bad'); caption('[low tone] not quite');
      if (effects()) state.shake = 1;
      const lead = round.kind === 'odd' ? 'Odd one out' : round.kind === 'antonym' ? 'Opposite' : round.kind === 'synonym' ? 'Same meaning' : 'Answer';
      state.toast = { good: false, text: `${lead}: ${answer}`, sub: round.note || round.meaning, t: 0, look: round.letter ? null : round.word, lookRel: REL_QUIZ_KINDS.has(round.kind) };
      if (rateable && state.prefs.rateEach) state.toast.rate = { word: round.word, hit: false, before: rateBefore, kind: round.kind };
      if (picked !== null) noteConfusion(answer, picked, round);
      if (state.lives > 0) { state.lives -= 1; if (state.lives === 0 && !state.autoPlay) { endSession('lives'); return; } }
    }
    if (state.byQuestions && state.answered >= state.total) { endSession('questions'); return; }
    spawnRound();
    if (state.toast?.also && state.round && state.toast.also === state.round.word) delete state.toast.also;   // never hint at the question now on screen
    if (state.empty) endSession('empty');
  };

  // ---------------------------------------------------------------- form screens (generic reader)
  let formCache = null, drag = null;
  const weekly = () => {
    const d = day(), rows = state.sessions.filter((s) => s.day > d - 7);
    const days = new Set(rows.map((s) => s.day)), n = rows.reduce((a, s) => a + s.n, 0), right = rows.reduce((a, s) => a + s.right, 0), nw = rows.reduce((a, s) => a + (s.nw ?? 0), 0);
    return { days: days.size, n, right, nw, sessions: rows.length };
  };
  const mixups = () => [...state.prefs.confused].sort((x, y) => y.n - x.n || y.day - x.day).slice(0, 8);
  const mixWords = () => [...new Set(mixups().flatMap((m) => [m.a, m.b]))];
  const snapshot = () => {
    const sm = state.records, d = day();
    const bandSize = [0, 0, 0, 0, 0, 0], bandKnown = [0, 0, 0, 0, 0, 0];
    for (const e of lex.all()) { if (e.band < 0) continue; bandSize[e.band] += 1; const r = sm[e.w]; if (r && (r[8] || r[0] >= 3)) bandKnown[e.band] += 1; }
    const weak = weakWords(), child = isChild(), plan = syncKid(), pk = adapt.pick(eff(), plan), topicKnown = {}, topicSize = {};
    const tierSize = {}, tierKnown = {};
    for (const e of lex.all()) { if (e.band < 0) continue; const t = tierOf(e).id; tierSize[t] = (tierSize[t] ?? 0) + 1; const r = sm[e.w]; if (r && (r[8] || r[0] >= 3)) tierKnown[t] = (tierKnown[t] ?? 0) + 1; }
    for (const e of lex.all()) { const t = lex.topicOf(e.lex); if (!t) continue; topicSize[t] = (topicSize[t] ?? 0) + 1; const r = sm[e.w]; if (r && (r[8] || r[0] >= 3)) topicKnown[t] = (topicKnown[t] ?? 0) + 1; }
    return {
      plan, widened: pk.widened, poolN: pk.pool.length, mockBand: mockBand(), cfg: state.cfg, prefs: { ...state.prefs, scheme: state.scheme }, records: sm, study: state.study.words, day: d,
      dueN: dueCountAll(), weakN: weak.length, weak, leeches: Object.keys(sm).filter((w) => srs.isLeech(sm[w])),
      canSpeak: canSpeak(), canAsk: Boolean(wg.askText), exploreNote: state.exploreNote, msg: state.msg, confirmDel: state.confirmDel, pending: state.pending,
      lookupOn: !kidMode() && state.prefs.dict.mode !== 'never' && Boolean(wg.openLink || env.openLink), version: env.manifest?.version ?? '',
      an: state.an, anN: state.scene === 'analogy' ? analogyCount() : 0, anReady: kindAvailable('analogy'),
      credits: lex.credits(), loadingData: !lex.isFull() && Boolean(wg.loading), sessions: state.sessions, bandSize, bandKnown,
      todayN: state.prefs.today.day === d ? state.prefs.today.n : 0, streakN: state.prefs.streak.last >= d - 1 ? state.prefs.streak.n : 0,
      profiles: state.profiles, profile: state.profile, child, confirmProfile: state.confirmProfile, journey: state.journey, ach: state.ach, est: state.est,
      sel: state.sel, week: weekly(), run: state.run, runResult: state.runResult, gate: state.gate, textLarge: state.textScaleIdx, full: lex.isFull(),
      kindOff: QTYPES_OFF(), facets: state.facets, x: x7.snap(),
      pr: { ...state.pr, accent: state.prefs.accent, rate: state.prefs.voice, memWord: state.pr.memWord }, accents: wg.accents ? wg.accents() : ['us'], canRecognize: Boolean(wg.canRecognize?.()),
      memList: state.scene === 'mem' ? memList() : [], conf: state.prefs.conf,
      explore: state.explore, cmp: state.cmp, reading: state.reading, readDone: state.prefs.readDone ?? {},
      sets: extras()?.sets ?? [], lists: state.lists, listSel: state.listSel, pendingAdd: state.pendingAdd, pick: state.pick, pickMode: state.pickMode, pickWords: pickWordsNow(), playSet: state.playSet, textFind: state.textFind, mine: myWords(), mineDue: state.scene === 'mywords' ? srs.dueList(state.records, day(), 1e9).filter((w) => lkInList(w)).length : 0, canImport: Boolean(wg.importText), write: state.write, heat: heatCells(), slips: slips(),
      topicKnown, topicSize, tierKnown, tierSize, mixups: mixups(),
      stageWords: state.sel && state.sel.kind === 'stage' ? jny.stageWords(state.sel.world, state.sel.stage) : [],
    };
  };
  const getForm = () => {
    const Q = formRules(), base = TEXT_SCALES[state.textScaleIdx] ?? 1, fitScene = state.scene === 'age' || state.scene === 'firstlevel';
    const key = `${state.scene}|${rev}|${base}|${Math.round(Q.viewport.w)}x${Math.round(Q.viewport.h)}|${lex.version()}|${state.prefs.font}`;
    if (formCache && formCache.key === key) return formCache;
    const def = screenRows(state.scene, snapshot());
    const width = Q.viewport.w - 2 * Q.padX, cw = state.prefs.font === 'dys' ? 1.2 : 1;
    const lo = { twoCol: fitScene && lay().wide };
    let scale = base, layout = layoutForm(def.rows, width, scale, cw, lo);
    // The welcome screens have no Back button and should show every option at once when that is possible: shrink a little (never below 75%) before falling back to scrolling.
    if (fitScene && base === 1) for (let s = 0.95; layout.height > Q.viewport.h && s >= 0.75; s -= 0.05) { scale = s; layout = layoutForm(def.rows, width, scale, cw, lo); }
    if (layout.height > Q.viewport.h) { scale = base; layout = layoutForm(def.rows, width, scale, cw, lo); }
    formCache = { key, def, layout, width, scale };
    return formCache;
  };
  const setFormScroll = (v) => { state.formScroll = Math.max(0, Math.min(v, formMetrics.max)); };

  // External dictionaries open in an in-app sheet (about 85% of the screen with a Done button) where the shell supports it; otherwise the browser.
  const openLink = (url, word, label, title = 'Dictionary') => { if (wg.openLink) wg.openLink(url, { sheet: true, heightPct: 85, title, word, label }); else env.openLink?.(url); };
  const doLookup = (w) => {
    const url = lookupUrl(state.prefs.dict, w);
    if (!url) { state.msg = 'Set a dictionary address first (Settings).'; touch(); return; }
    srs.noteChecked(state.records, w, day()); state.prefs.stats.lookups += 1; save.rec(); save.prefs(); touch(); checkAch();
    openLink(url, w, dictLabel(state.prefs.dict));
  };
  const openOnlineKey = (w, key) => {
    const o = onlineUrl(key, w); if (!o) return;
    srs.noteChecked(state.records, w, day()); state.prefs.stats.lookups += 1; save.rec(); save.prefs(); touch(); checkAch();
    openLink(o.url, w, o.label, ONLINE_THES.some((t) => t.k === key) ? 'Thesaurus' : 'Dictionary');
  };
  const requestLookup = (w) => {
    const D = state.prefs.dict;
    if (kidMode() || D.mode === 'never') return;
    if (D.mode === 'ask' || !D.noticed) { state.pending = w; go('notice'); return; }          // Z4: the warning shows before every look-up when asking, and before the first one in any mode
    doLookup(w);
  };

  // ---------------------------------------------------------------- the offline dictionary sheet (lookup.js, lookupui.js)
  // ONE shared entry point: lookupWord(word, { from }) opens the sheet on a word from anywhere (home, lists, flashcards, quiz review, reading,
  // the Explorer). The sheet is a modal overlay: closing it returns to exactly the page underneath, which is never changed while it is open.
  let lkCache = null, lkDrag = null;
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const sheetHook = (open) => { try { env.sheetHook?.(open); } catch { /* the sheet works without the host */ } };
  const noteRecent = (w) => { const r = (state.prefs.recent ?? []).filter((x) => x !== w); r.unshift(w); state.prefs.recent = r.slice(0, LK.MAX_RECENT); save.prefs(); };
  const lkNew = (view, from, tab) => ({ view, tab: tab === 'thes' ? 'thes' : 'meaning', q: '', stack: [], from: from ?? state.scene, scroll: 0, hl: -1, searchFirst: false, confirm: null });
  const openSearch = (o = {}) => { const was = Boolean(state.lk); state.lk = lkNew('search', o.from, o.tab); if (!was) sheetHook(true); touch(); };
  // Curiosity, not pressure: every new word looked at is quietly counted ("New word explored" on its card, a toast only at milestones).
  const EXPLORE_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500];
  const noteExplored = (r) => {
    const ex = state.prefs.explored; if (ex.includes(r.w)) return;
    ex.push(r.w); if (ex.length > 5000) ex.shift(); r.fresh = true; save.prefs();
    if (EXPLORE_MILESTONES.includes(ex.length)) state.badgeToast = { text: `${ex.length} words explored`, t: 0 };
    checkAch();
  };
  const noteTrail = (w) => { const t = state.trail.filter((x) => x !== w); t.push(w); state.trail = t.slice(-40); };
  const trailSaved = () => state.trail.length > 0 && state.trail.every((w) => lkInList(w));
  const linkPool = (e) => [e, ...LK.linkedWords(e, 9).map((x) => lex.entry(x))].filter((x) => x && x.rank !== undefined && lex.kidOk(x));
  const playKindsFor = (e) => { const ctx = { canSpeak: canSpeak() }, pool = linkPool(e); return LK.PLAY_KINDS.map(([k]) => k).filter((k) => pool.some((x) => canAsk(x, k, ctx))); };
  // A 1-tap round of questions seeded with a word (and the words linked to it). Calm by default: no lives, hints free to look at, a slow drift.
  const KIND_SETS = { test: ['definition', 'synonym', 'antonym', 'cloze', 'usage', 'sense', 'spelling', 'analogy'], fun: ['synonym', 'antonym', 'odd', 'spelling', 'definition', 'usage', 'anagram', 'cloze', 'analogy'], analogy: ['analogy'], mixed: ['definition', 'synonym', 'spelling', 'usage', 'antonym'], definition: ['definition'], spelling: ['spelling'], rel: ['synonym', 'antonym'], usage: ['usage'] };
  const playWords = (kind, entries, label = 'word play', len = 8, secs = 0) => {
    const ctx = { canSpeak: canSpeak() }, kinds = kind && KIND_SETS[kind] ? KIND_SETS[kind] : kind ? [kind] : ['definition', 'synonym', 'spelling'];
    const pool = safe(entries.filter((x) => x && kinds.some((k) => canAsk(x, k, ctx))));
    if (!pool.length) { state.badgeToast = { text: 'That kind of round needs another word', t: 0 }; touch(); return false; }
    state.lastWordPlay = { kind, words: pool.map((x) => x.w), label };
    closeLookup();
    startSession({ pool, kinds, ordered: true, kindLabel: label, over: { secs: secs || 40, questions: len === 'all' ? Math.min(60, pool.length) : len === 8 ? Math.max(1, Math.min(8, pool.length)) : len, endBy: 'questions', lives: 0, hints: true } });
    return true;
  };
  // Analogy puzzles (A : B :: C : ?): words of the player's level window that open at least one puzzle; calm by default (no lives, no timer, hints free to look at).
  const analogyPool = () => safe(poolFor('whole').filter((e) => canAsk(e, 'analogy', {})));
  const analogyCount = () => (kindAvailable('analogy') ? new Set(analogyPool().map((e) => e.w)).size : 0);
  const startAnalogy = (auto = false) => {
    const pool = analogyPool();
    if (!kindAvailable('analogy') || pool.length < 3) { state.badgeToast = { text: kindAvailable('analogy') ? 'No analogy puzzles at this level yet' : 'Analogy puzzles are still loading', t: 0 }; touch(); return false; }
    const A = state.an, secs = A.secs || 40;
    if (auto) { state.autoOpts = { pool, kinds: ['analogy'], kindLabel: 'analogy' }; return startSession({ auto: true, ...state.autoOpts }); }
    state.autoOpts = null;
    return startSession({ pool, kinds: ['analogy'], kindLabel: 'analogy', over: { secs, questions: A.len, endBy: 'questions', lives: 0, hints: true } });
  };
  // ---- collecting words (reading, study sets, My words, pasted text) -> My words / named lists -> a calm session of exactly those words
  const metWord = (w) => Boolean(state.records[w] && state.records[w][6] > 0);
  const unfamiliar = (w) => !srs.isKnown(state.records, w) && !metWord(w);
  const entryWords = (list) => [...new Set(list)].filter((w) => lex.entry(w)?.rank !== undefined && lex.kidOk(lex.entry(w)));
  const passageWords = () => {
    const P_ = (extras()?.passages ?? []).find((x) => x.id === state.reading?.id); if (!P_) return [];
    return entryWords(P_.text.split(/[^A-Za-z]+/).map((x) => x.toLowerCase()).filter((x) => x.length >= 4 && lex.entry(x)?.gloss));
  };
  const pickWordsNow = () => state.scene === 'mywords' ? myWords() : state.scene === 'studylist' ? state.study.words : state.scene === 'reading' ? passageWords() : state.scene === 'textwords' ? state.textFind.found : state.scene === 'listview' ? (state.lists.find((l) => l.id === state.listSel)?.words ?? []).filter((w) => lex.entry(w)) : [];
  const pickToggle = (w) => { state.pick = state.pick.includes(w) ? state.pick.filter((x) => x !== w) : [...state.pick, w]; touch(); };
  const openChooser = (words, label = '', purpose = 'general') => {
    const ws = entryWords(words); if (!ws.length) { state.badgeToast = { text: 'No words to play yet', t: 0 }; touch(); return; }
    state.playSet = { words: ws, kind: purpose === 'test' ? 'test' : purpose === 'fun' ? 'fun' : 'mixed', len: purpose === 'test' ? 'all' : 10, secs: purpose === 'fun' ? 20 : 0, label }; go('playchoose');
  };
  const LISTP = { test: { name: 'Test prep' }, general: { name: 'General practice' }, interest: { name: 'Just for interest' }, fun: { name: 'Just for fun' }, custom: { name: 'My list' } };
  const removeFromList = (id, words) => { if (id === 'looked') { for (const w of words) myWordsSet(w, false, true); return; } const l = state.lists.find((x) => x.id === id); if (l) { l.words = l.words.filter((w) => !words.includes(w)); lex.setCustom(state.lists); save.lists(); touch(); } };
  const addToList = (id, words) => {
    if (id === 'looked') { for (const w of words) myWordsSet(w, true, true); return; }
    const l = state.lists.find((x) => x.id === id); if (!l) return;
    for (const w of words) if (!l.words.includes(w)) l.words.push(w);
    lex.setCustom(state.lists); save.lists(); touch();
  };
  // Paste a text: every distinct word with an entry that the player has not met or does not know, hardest first. Offline; the text is kept only in memory.
  const analysePaste = (text) => {
    const toks = String(text).toLowerCase().split(/[^a-z']+/).map((x) => x.replace(/^'+|'+$/g, '')).filter((x) => x.length >= 4);
    const seen = new Set(), found = []; let n = 0;
    for (const t of toks) {
      n += 1; if (seen.has(t)) continue; seen.add(t); if (seen.size > 4000) break;
      const r = LK.resolve(t, kidMode()); if (r.status !== 'ok' || !lex.entry(r.w)?.gloss) continue;
      if (unfamiliar(r.w) && !found.includes(r.w)) found.push(r.w);
    }
    const band = (w) => lex.entry(w)?.band ?? 0;
    found.sort((a, b) => band(b) - band(a) || (lex.entry(b).rank ?? 0) - (lex.entry(a).rank ?? 0));
    const adv = found.filter((w) => band(w) >= 1);
    state.textFind = { chars: String(text).length, tokens: n, found: (adv.length >= 5 ? adv : found).slice(0, 80) };
    state.pick = []; touch();
  };
  // "Surprise me": a related word the player has not explored yet, inside their level window, kid-safe in a child profile.
  const wanderPick = (w) => {
    const e = lex.entry(w); if (!e) return null;
    const p = planNow(), seen = new Set(state.prefs.explored), prev = new Set(state.trail.slice(-4));
    const rel = LK.linkedWords(e, 60).filter((x) => !prev.has(x) && lex.kidOk(lex.entry(x) ?? {}));
    const inWin = (x) => { const b = lex.entry(x)?.band; return b === undefined || b < 0 || p.source === 'default' || adapt.fits(p, b); };
    const tiers = [rel.filter((x) => !seen.has(x) && inWin(x)), rel.filter((x) => !seen.has(x)), rel.filter(inWin), rel];
    for (const t of tiers) if (t.length) return t[rng.int(t.length)];
    const pool = adapt.pick({ attrs: [], topics: [], combine: 'any', minLen: 4, maxLen: 12 }, p, 40).pool.filter((x) => !x.custom && !seen.has(x.w) && x.w !== w && lex.kidOk(x));
    return pool.length ? pool[rng.int(pool.length)].w : null;
  };
  const lookupWord = (raw, o = {}) => {
    syncKid();
    const r = LK.resolve(raw, kidMode()); if (r.status === 'empty') return false;
    const was = Boolean(state.lk);
    if (!state.lk) state.lk = lkNew('word', o.from, o.tab);
    const k = state.lk; if (o.tab) k.tab = o.tab === 'thes' ? 'thes' : 'meaning'; if (k.view === 'search') k.searchFirst = true;
    k.view = 'word'; k.confirm = null; k.scroll = 0; k.stack.push(r); if (k.stack.length > 12) k.stack.shift();
    if (r.status === 'ok') { noteRecent(r.w); if (o.wander) r.wander = true; noteExplored(r); noteTrail(r.w); }
    if (!was) sheetHook(true);
    if (kb.dataState() !== 'ready') ensureKbData();   // the sheet shows Loading and redraws by itself when the relation shards arrive
    touch(); return true;
  };
  const ensureKbData = () => { const p = kb.ensure(); touch(); p.then(() => touch(), () => touch()); };
  const closeLookup = () => { if (!state.lk) return false; state.lk = null; state.addTarget = ''; wg.stopSpeaking?.(); sheetHook(false); touch(); return true; };
  const lkCanBack = () => Boolean(state.lk && state.lk.view === 'word' && (state.lk.stack.length > 1 || state.lk.searchFirst));
  const lkBack = () => {
    const k = state.lk; if (!k) return false;
    if (k.confirm || k.listPick) { k.confirm = null; k.listPick = false; k.moKey = null; touch(); return true; }
    if (k.view === 'word' && k.stack.length > 1) { k.stack.pop(); k.scroll = 0; touch(); return true; }
    if (k.view === 'word' && k.searchFirst) { k.view = 'search'; k.stack = []; k.hl = -1; touch(); return true; }
    return closeLookup();
  };
  const lkSetQ = (q) => { const k = state.lk; k.q = q.slice(0, 30); k.hl = -1; touch(); };
  // "My words": ONE saved list (id 'looked', shown everywhere as "My words"). Every Add button (dictionary sheet, thesaurus, reading) saves here.
  const myWords = () => state.lists.find((l) => l.id === 'looked')?.words ?? [];
  const syncHome = () => { homeOpts.mine = myWords().length > 0 || state.lists.length > 1; };
  const lkInList = (w) => myWords().includes(w);
  const myWordsSet = (w, on, quiet = false) => {
    let l = state.lists.find((x) => x.id === 'looked');
    if (!l) { l = { id: 'looked', name: 'My words', words: [], defs: {} }; state.lists.push(l); }
    l.name = 'My words';
    const has = l.words.includes(w);
    if (on && !has) l.words.push(w); else if (!on && has) l.words = l.words.filter((x) => x !== w);
    state.lists = state.lists.filter((x) => x.id !== 'looked' || x.words.length);
    lex.setCustom(state.lists); save.lists(); syncHome();
    if (on && !has && !quiet) state.badgeToast = { text: `Saved. Find it in My words (${myWords().length}) on the home screen`, t: 0 };
    touch();
  };
  const lkToggleList = (w) => myWordsSet(w, !lkInList(w));
  // Word of the day: ONE word per day and per effective vocabulary window (adapt.js plan), kid-safe for child profiles. Widens by one band when the window has no suitable word.
  const wotdCache = new Map();
  const wordOfDay = (dd) => {
    const p = planNow(), d = dd ?? day(), key = `${d}|${adapt.windowKey(p)}|${lex.version()}`;
    if (wotdCache.has(key)) return wotdCache.get(key);
    const ok = (e) => e.gloss && e.gloss.length <= 90 && e.w.length >= 4 && e.w.length <= 12 && /^[a-z]+$/.test(e.w) && (!p.kid || lex.kidOk(e)) && !e.custom;
    let pool = [], v = null;
    for (const min of [40, 400, 4000, 40000]) { pool = adapt.pick({ attrs: [], topics: [], combine: 'any', minLen: 4, maxLen: 12 }, p, min).pool.filter(ok); if (pool.length) break; }
    if (pool.length) { const seed = ((Math.imul(d, 2654435761) ^ adapt.windowKey(p)) >>> 0) || 1, i = Math.floor((((Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296) * pool.length), e = pool[i]; v = { w: e.w, gloss: e.gloss, band: e.band }; }
    if (wotdCache.size > 6) wotdCache.clear();
    wotdCache.set(key, v); return v;
  };
  const lkOnlineOk = () => !kidMode() && state.prefs.dict.mode !== 'never' && Boolean(wg.openLink || env.openLink);
  const lkCur = () => state.lk?.stack[state.lk.stack.length - 1] ?? null;
  const getLookup = () => {
    const k = state.lk, L_ = lay(), scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const key = `${rev}|${scale}|${L_.key}|${lex.version()}|${kb.version()}|${kb.dataState()}|${k.view}|${k.tab}|${k.stack.length}|${JSON.stringify(lkCur()?.more ?? '')}|${k.confirm ?? ''}|${k.listPick ? 1 : 0}|${state.lists.length}|${state.addTarget}|${k.q}|${k.hl}|${state.prefs.font}|${state.trail.length}|${trailSaved()}|${lkInList(lkCur()?.w ?? '')}`;
    if (lkCache && lkCache.key === key) return lkCache.K;
    const G = lookupGeom(L_, k.view);
    const K = { G, lk: k, view: k.view, tab: k.tab, canBack: lkCanBack() || Boolean(k.confirm) || Boolean(k.listPick), title: 'Look up any word', hearOk: false, layout: null, list: [], listLabel: '', listIsSugg: false, emptyNote: '', rows: [] };
    if (k.view === 'search') {
      const recents = (state.prefs.recent ?? []).filter((w) => { const e = lex.entry(w); return e && lex.kidOk(e); }).slice(0, LK.MAX_RECENT);
      if (k.q.trim()) { K.list = LK.suggest(k.q, SUGG_MAX); K.listLabel = K.list.length ? 'Suggestions' : 'No suggestions'; K.listIsSugg = true; K.emptyNote = 'No built-in word starts like that. Tap Look up to try it anyway.'; }
      else { K.list = recents; K.listLabel = recents.length ? 'Recent searches' : 'Recent searches appear here'; K.emptyNote = 'Type a word, or tap the keys.'; }
    } else {
      const r = lkCur(); let rows;
      if (k.listPick && r && r.status === 'ok') { K.title = 'Add to a list'; rows = LK.listPickRows(r.w, [{ id: 'looked', name: 'My words', words: myWords() }, ...state.lists.filter((l) => l.id !== 'looked')]); }
      else if (k.confirm) { K.title = k.confirm; rows = LK.confirmRows(k.confirm, dictLabel(state.prefs.dict)); }
      else if (r && r.status === 'ok') {
        const e = lex.entry(r.w); K.title = r.w; K.hearOk = canSpeak();
        const ex = { fresh: Boolean(r.fresh), wander: Boolean(r.wander), playKinds: kb.dataState() === 'ready' || k.tab === 'meaning' ? playKindsFor(e) : [], trail: state.trail, trailSaved: trailSaved(), target: (() => { const t = state.addTarget && state.lists.find((l) => l.id === state.addTarget); return t ? { id: t.id, name: t.name, has: t.words.includes(r.w) } : null; })() };
        const crumbs = k.stack.length > 1 ? [{ k: 'p', t: `Path: ${k.stack.map((x) => x.w || x.typed).join(' > ')}`, small: true }] : [];
        if (k.tab === 'thes') rows = [...crumbs, ...LK.thesaurusRows(e, { note: r.kind === 'form' ? `“${r.from}” is a form of “${r.w}”. Here is the thesaurus entry for “${r.w}”.` : '', lookupOn: lkOnlineOk(), inList: lkInList(r.w), canPractise: LK.practiceWords(e).length >= 3, more: r.more, ...ex })];
        else rows = [...crumbs, ...LK.cardRows(e, { note: r.kind === 'form' ? `“${r.from}” is a form of “${r.w}”. Here is the meaning of “${r.w}”.` : '', canSpeak: canSpeak(), lookupOn: lkOnlineOk(), inList: lkInList(r.w), ...ex })];
      } else { K.title = r?.typed || 'Look up'; rows = LK.noCardRows(r ?? { status: 'unknown', typed: '', w: '' }, { lookupOn: lkOnlineOk() }); }
      K.rows = rows; K.layout = layoutForm(rows, G.vp.w, scale, state.prefs.font === 'dys' ? 1.2 : 1);
    }
    lkCache = { key, K }; return K;
  };
  // doing what one control does (shared by taps, the keyboard and the screen-reader layer)
  const lkPress = (id) => {
    const k = state.lk; if (!k) return;
    const K = getLookup(), parts = id.split(':'), a = parts[0], b = parts.slice(1).join(':');
    switch (a) {
      case 'done': closeLookup(); return;
      case 'back': lkBack(); return;
      case 'tab': { const t = b === 'thes' ? 'thes' : 'meaning'; if (k.tab !== t) { k.tab = t; k.scroll = 0; k.confirm = null; touch(); } return; }
      case 'dpractise': { const r = lkCur(); if (!r || r.status !== 'ok') return; const l = LK.practiceWords(lex.entry(r.w)).map((x) => lex.entry(x)).filter(Boolean); if (l.length < 3) return; closeLookup(); startSession({ pool: l, kindLabel: 'review' }); return; }
      case 'hear': { const r = lkCur(); if (r && r.status === 'ok' && canSpeak()) sayWord(r.w); return; }
      case 'dec': if (state.textScaleIdx > 0) { state.textScaleIdx -= 1; storage.set('textScaleIdx', state.textScaleIdx); k.scroll = 0; touch(); } return;
      case 'inc': if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx += 1; storage.set('textScaleIdx', state.textScaleIdx); k.scroll = 0; touch(); } return;
      case 'clear': lkSetQ(''); return;
      case 'go': { const pick = k.hl >= 0 ? K.list[k.hl] : k.q; if (pick && String(pick).trim()) lookupWord(pick); return; }
      case 'sug': { const wd = K.list[Number(b)]; if (wd) lookupWord(wd); return; }
      case 'k': {
        if (k.view !== 'search') return;
        if (b === 'back') lkSetQ(k.q.slice(0, -1)); else if (b === 'space') { if (k.q && !k.q.endsWith(' ')) lkSetQ(`${k.q} `); } else if (b === 'go') lkPress('go'); else lkSetQ(k.q + b);
        return;
      }
      case 'dretry': ensureKbData(); return;
      case 'dlist': if (state.lk) { state.lk.listPick = true; state.lk.scroll = 0; touch(); } return;
      case 'dlistadd': { const r = lkCur(); const w = r?.w; if (!w) return; const nm = b === 'looked' ? 'My words' : state.lists.find((l) => l.id === b)?.name; addToList(b, [w]); if (state.lk) state.lk.listPick = false; state.badgeToast = { text: `Added to ${nm ?? 'the list'}`, t: 0 }; touch(); return; }
      case 'dlistnew': { const w = lkCur()?.w; state.pendingAdd = w ? [w] : []; closeLookup(); go('newlist'); return; }

      case 'dplay': { const r = lkCur(); if (r && r.status === 'ok') playWords(b, linkPool(lex.entry(r.w)), 'word play'); return; }
      case 'dwander': { const r = lkCur(); const w = r && r.status === 'ok' ? wanderPick(r.w) : null; if (w) lookupWord(w, { wander: true }); else { state.badgeToast = { text: 'No new related word right now', t: 0 }; touch(); } return; }
      case 'dtrailsave': { for (const w of state.trail) if (!lkInList(w) && lex.entry(w)) myWordsSet(w, true, true); state.badgeToast = { text: `Trail saved to My words (${state.trail.length} words)`, t: 0 }; touch(); return; }
      case 'dtrailplay': playWords(null, state.trail.map((w) => lex.entry(w)), 'trail'); return;
      case 'dmore': { const r = lkCur(); if (r) { r.more = { ...(r.more ?? {}), [b]: true }; touch(); } return; }
      case 'dw': lookupWord(b); return;
      case 'dadd': { const r = lkCur(); if (r && r.status === 'ok') lkToggleList(r.w); return; }
      case 'dexplore': { const r = lkCur(); if (r && r.status === 'ok') { closeLookup(); state.explore = r.w; state.exploreNote = ''; state.formScroll = 0; if (state.scene === 'explore') touch(); else go('explore'); } return; }
      case 'mo': { const w = lkCur()?.w; if (!w || !lkOnlineOk()) return; k.moKey = b; const D = state.prefs.dict; if (D.mode === 'ask' || !D.noticed) { k.confirm = w; k.scroll = 0; touch(); } else { k.moKey = null; openOnlineKey(w, b); } return; }
      case 'donline': { const w = b || lkCur()?.w; if (!w || !lkOnlineOk()) return; const D = state.prefs.dict; if (D.mode === 'ask' || !D.noticed) { k.confirm = w; k.scroll = 0; touch(); } else doLookup(w); return; }
      case 'dopen': case 'dalways': {
        const w = k.confirm; if (!w) return; if (a === 'dalways') state.prefs.dict.mode = 'always'; state.prefs.dict.noticed = true; save.prefs(); k.confirm = null; touch(); if (k.moKey) { const mk = k.moKey; k.moKey = null; openOnlineKey(w, mk); } else doLookup(w); return;
      }
      case 'dcancel': k.moKey = null; k.confirm = null; k.listPick = false; touch(); return;
      default: return;
    }
  };
  const updateLookup = (input) => {
    const k = state.lk, p = input.pointer, keys = input.keys.pressed;
    if (keys.has('Escape')) { closeLookup(); return; }
    let K = getLookup();
    if (k.view === 'search') {
      for (const c of keys) {
        if (/^Key[A-Z]$/.test(c)) lkSetQ(k.q + c[3].toLowerCase());
        else if (c === 'Backspace') lkSetQ(k.q.slice(0, -1));
        else if (c === 'Space') { if (k.q && !k.q.endsWith(' ')) lkSetQ(`${k.q} `); }
        else if (c === 'Minus') lkSetQ(`${k.q}-`);
        else if (c === 'Quote') lkSetQ(`${k.q}'`);
        else if (c === 'ArrowDown') { k.hl = Math.min(K.list.length - 1, k.hl + 1); touch(); }
        else if (c === 'ArrowUp') { k.hl = Math.max(-1, k.hl - 1); touch(); }
        else if (c === 'Enter' || c === 'NumpadEnter') { lkPress('go'); return; }
      }
      K = getLookup();
    } else {
      const vp = K.G.vp, max = Math.max(0, K.layout.height - vp.h);
      if (wheelInput.dy) { k.scroll = clampN(k.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
      if (keys.has('ArrowDown')) k.scroll = clampN(k.scroll + 70, 0, max);
      if (keys.has('ArrowUp')) k.scroll = clampN(k.scroll - 70, 0, max);
      if (keys.has('PageDown') || keys.has('Space')) k.scroll = clampN(k.scroll + vp.h * 0.9, 0, max);
      if (keys.has('PageUp')) k.scroll = clampN(k.scroll - vp.h * 0.9, 0, max);
      if (keys.has('Backspace')) { lkBack(); return; }
    }
    wheelInput.dy = 0;
    if (p.pressed) {
      const G = K.G;
      if (!inRect(p.x, p.y, G.sheet)) { lkDrag = null; closeLookup(); return; }          // a tap outside the sheet closes it
      if (inRect(p.x, p.y, G.done)) { pressed('lkdone'); closeLookup(); return; }
      if (K.canBack && inRect(p.x, p.y, G.back)) { pressed('lkback'); lkBack(); return; }
      if (inRect(p.x, p.y, G.tabM)) { lkPress('tab:meaning'); return; }
      if (inRect(p.x, p.y, G.tabT)) { lkPress('tab:thes'); return; }
      if (k.view === 'search') {
        if (inRect(p.x, p.y, G.go)) { lkPress('go'); return; }
        if (k.q && inRect(p.x, p.y, G.clear)) { lkPress('clear'); return; }
        for (const key of G.keys) if (inRect(p.x, p.y, key.r)) { lkPress(key.id); return; }
        K.list.forEach((wd, i) => { if (inRect(p.x, p.y, G.rowRect(i))) lkPress(`sug:${i}`); });
        return;
      }
      if (inRect(p.x, p.y, G.hear)) { lkPress('hear'); return; }
      if (inRect(p.x, p.y, G.dec)) { lkPress('dec'); return; }
      if (inRect(p.x, p.y, G.inc)) { lkPress('inc'); return; }
      if (inRect(p.x, p.y, G.sb) && K.layout.height > G.vp.h) lkDrag = { bar: true };
      else if (inRect(p.x, p.y, G.vp)) lkDrag = { x0: p.x, y0: p.y, s0: k.scroll, moved: false };
      else lkDrag = null;
    }
    if (lkDrag && k.view === 'word') {
      const G = K.G, max = Math.max(0, K.layout.height - G.vp.h);
      if (lkDrag.bar) { if (p.down) k.scroll = clampN(((p.y - G.sb.y) / G.sb.h) * (max + G.vp.h) - G.vp.h / 2, 0, max); else lkDrag = null; }
      else {
        if (p.down && (lkDrag.moved || Math.abs(p.y - lkDrag.y0) > TAP_SLOP)) { lkDrag.moved = true; k.scroll = clampN(lkDrag.s0 - (p.y - lkDrag.y0), 0, max); }
        if (!p.down || p.released) {
          const d = lkDrag; lkDrag = null;
          if (!d.moved) { const h = hitAt(K.layout, d.x0 - G.vp.x, d.y0 - G.vp.y + k.scroll); if (h && !h.disabled) { pressed(h.id); lkPress(h.id); } }
        }
      }
    }
  };

  // J20 compare view: the same word opened in two dictionaries, one after the other, plus a private note on which meaning you prefer.
  const openCompare = (w) => {
    const cur = DICTS.some((d) => d.k === state.prefs.dict.choice) ? state.prefs.dict.choice : DICTS[0].k;
    state.cmp = { w, a: cur, b: (DICTS.find((d) => d.k !== cur) ?? DICTS[1]).k, opened: { a: false, b: false } }; go('compare');
  };
  const cmpOpen = (which) => {
    const C = state.cmp; if (!C || kidMode()) return;
    const url = lookupUrl({ choice: C[which], custom: '' }, C.w); if (!url) return;
    C.opened[which] = true; srs.noteChecked(state.records, C.w, day()); state.prefs.stats.lookups += 1; save.rec(); save.prefs(); touch(); checkAch();
    openLink(url, C.w, dictLabel({ choice: C[which], custom: '' }));
  };
  const setNote = (w, text) => {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (t) state.prefs.notes[w] = t; else delete state.prefs.notes[w];
    save.prefs(); touch();
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
  const backupText = () => buildBackup({ cfg: state.cfg, prefs: { ...state.prefs, scheme: state.scheme, textScaleIdx: state.textScaleIdx }, records: state.records, sessions: state.sessions, study: state.study, day: day(), journey: state.journey, ach: state.ach, est: state.est, lists: state.lists, facets: state.facets });
  const importNow = async () => {
    let text = null;
    try { text = wg.importText ? await wg.importText() : null; } catch { text = null; }
    if (!text) { state.msg = wg.importText ? 'Nothing was imported.' : 'Importing is not available on this device yet.'; touch(); return; }
    const res = parseBackup(text);
    if (!res.ok) { state.msg = res.error; touch(); return; }
    const d = res.data;
    state.records = Object.assign(Object.create(null), d.records); state.sessions = d.sessions; state.facets = d.facets ?? facets.newFacets();
    if (d.cfg) state.cfg = normalizeCfg(d.cfg);
    if (d.study && Array.isArray(d.study.words)) state.study = d.study;
    if (d.journey && d.journey.stars) state.journey = { ...freshJourney(), ...d.journey };
    if (d.ach && typeof d.ach === 'object') state.ach = d.ach;
    if (d.est) state.est = d.est;
    if (d.lists?.length) { state.lists = d.lists; lex.setCustom(state.lists); save.lists(); }
    if (d.prefs) {
      state.prefs = mergePrefs(d.prefs);
      if (SCHEMES[d.prefs.scheme]) { state.scheme = d.prefs.scheme; storage.set('scheme', state.scheme); }
    }
    for (const k of ['cfg', 'prefs', 'rec', 'sess', 'study', 'journey', 'ach', 'est', 'facets']) save[k]();
    state.msg = `Imported ${Object.keys(state.records).length} words and ${state.sessions.length} sessions.`; touch();
  };
  const deleteAll = () => {
    state.records = Object.create(null); state.facets = facets.newFacets(); state.sessions = []; state.study = { words: [], day: 0 }; state.bestScores = {}; state.journey = freshJourney(); state.ach = {}; state.est = null;
    state.cfg = normalizeCfg(DEFAULT_CFG); state.prefs = freshPrefs(); state.confirmDel = false;
    for (const k of ['cfg', 'prefs', 'rec', 'sess', 'study', 'best', 'journey', 'ach', 'est', 'facets']) save[k]();
    state.msg = 'Everything was deleted from this profile.'; touch();
  };
  // A grown-up question before a child profile can change settings, data or profiles.
  const needGate = (next) => {
    if (state.parentUntil > state.t) return false;
    if (state.pin && isChild()) return x7.openPinGate(next);          // K12: a parent PIN replaces the sum when one is set
    if (!isChild()) return false;
    const a = 6 + rng.int(8), b = 4 + rng.int(7), ans = a + b;
    const opts = new Set([ans]); while (opts.size < 4) opts.add(ans + rng.int(9) - 4 || ans + 5);
    state.gate = { a, b, ans, opts: rng.shuffle([...opts]), wrong: false }; state.gateNext = next; go('gate'); return true;
  };
  const openNext = (scene) => { if (GATED.has(scene) && needGate(scene)) return; go(scene); };

  // ---------------------------------------------------------------- daily set, word sets, own lists, mock test, writing
  const askable = (e) => ['synonym', 'definition', 'spelling', 'cloze', 'antonym', 'sense'].some((k) => canAsk(e, k, { canSpeak: false }));
  const dailyEntries = () => {                         // the same 10 words for everyone on the same day (and the same list), no randomness from the game
    const p = syncKid(), pool = adapt.pick({ attrs: [], topics: [], combine: 'any', minLen: 4, maxLen: 12 }, p).pool.filter(askable);
    let s = ((Math.imul(day(), 2654435761) ^ adapt.windowKey(p)) >>> 0) || 1, pick = new Set(), out = [];      // per day AND level window
    while (out.length < 10 && pool.length >= 10) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const i = Math.floor((s / 4294967296) * pool.length); if (!pick.has(i)) { pick.add(i); out.push(pool[i]); } }
    return out;
  };
  const startDaily = () => {
    const pool = dailyEntries();
    if (!pool.length) { state.msg = 'The daily set needs the full word list to finish loading.'; touch(); return; }
    startSession({ pool, kinds: ['synonym', 'definition', 'spelling', 'cloze', 'antonym', 'sense'], kindLabel: 'daily', over: { questions: 10, endBy: 'questions', secs: 30, lives: 0, hints: true } });
  };
  const mockBand = () => (state.prefs.mock.bandPinned ? state.prefs.mock.band : planNow().top);
  const startMock = () => {
    const M = state.prefs.mock, kinds = M.kinds.filter(kindAvailable);
    const band = mockBand(), pool = lex.select({ contexts: [band], attrs: [], topics: [], combine: 'any', minLen: 3, maxLen: 15, kid: syncKid().kid });
    if (!kinds.length || pool.length < 20) { state.msg = 'The mock test needs the full word list to finish loading.'; touch(); return; }
    startSession({ pool, kinds, run: { type: 'mock', label: 'Mock test', mock: { ...M, band, kinds } }, over: { questions: M.n, endBy: 'questions', secs: M.secs, lives: 0, hints: false } });
  };
  const parseList = (text) => {
    const words = [], defs = {}; let name = '';
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      if (line.startsWith('#')) { if (!name) name = line.replace(/^#+\s*/, '').slice(0, 40); continue; }
      const m = line.match(/^"?([A-Za-z]{2,20})"?\s*(?:[,\t;]\s*(.*))?$/); if (!m) continue;
      const w = m[1].toLowerCase(); if (words.includes(w)) continue; words.push(w); const d = (m[2] ?? '').replace(/^"|"$/g, '').trim(); if (d) defs[w] = d.slice(0, 90);
      if (words.length >= 500) break;
    }
    return { words, defs, name };
  };
  const importList = async () => {
    let text = null;
    try { text = wg.importText ? await wg.importText() : null; } catch { text = null; }
    const L = text ? parseList(text) : null;
    if (!L || L.words.length < 3) { state.msg = text ? 'No word list was found in that file. Use one word per line, or word,meaning.' : 'Nothing was imported.'; touch(); return; }
    const id = `l${Date.now ? 0 : 0}${state.lists.length + 1}${L.words.length}`;
    state.lists.push({ id, name: L.name || `List ${state.lists.length + 1}`, words: L.words, defs: L.defs });
    lex.setCustom(state.lists); save.lists();
    state.msg = `Imported ${L.words.length} words.`; touch(); checkAch();
  };
  const openWrite = (mode) => {
    const src = state.study.words.length ? entriesOf(state.study.words) : selectWords().slice(0, 4000);
    const pool = src.filter((e) => e.gloss && e.gloss.length <= 90);
    if (!pool.length) { state.write = { mode, words: [], done: false }; return; }
    const words = rng.shuffle(pool).slice(0, mode === 'story' ? 3 : 1).map((e) => e.w);
    state.write = { mode, words, done: false };
  };
  const heatCells = () => {
    const d = day(), by = new Map(); for (const s of state.sessions) by.set(s.day, (by.get(s.day) ?? 0) + s.n);
    return Array.from({ length: 84 }, (_, i) => by.get(d - 83 + i) ?? 0);
  };
  const slips = () => {
    const out = [];
    for (const [k, [r, w_]] of Object.entries(state.prefs.kindStats)) { const n = r + w_; if (n >= 8 && r / n < 0.8) out.push({ label: QTYPES.find((q) => q.k === k)?.label ?? k, acc: r / n, n, advice: SLIP_ADVICE[k] ?? '' }); }
    return out.sort((a, b) => a.acc - b.acc).slice(0, 4);
  };
  // Subject and topic packs (J4, J8, Y2): the pack's words at the player's level and age (adapt.fitPackWords)
  const packEntries = (id) => { const p = lex.packById(id); return p ? safe(adapt.fitPackWords(p.words, planNow(), lex.entry)) : []; };
  const packStudy = (id) => { const es = packEntries(id).filter((e) => e.gloss).sort((a, b) => a.rank - b.rank).slice(0, state.cfg.setSize); if (es.length) setStudy(es.map((e) => e.w)); };
  const packPlay = (id) => { if (packEntries(id).length >= 4) startSession({ source: `pack:${id}`, kindLabel: 'pack' }); };
  // C10: build a word web. Eight words that belong to a pack are hidden among eight that do not; right taps grow the web.
  const startWeb = (id) => {
    const pk = lex.packById(id); if (!pk) return;
    const plan = planNow(), mine = new Set(pk.words), good = (e) => e.gloss && /^[a-z]{3,10}$/.test(e.w);
    const pool = packEntries(id).filter(good); if (pool.length < 8) { state.msg = 'That pack has too few words at your level for a web yet.'; touch(); return; }
    const right = rng.shuffle(pool.slice()).slice(0, 8), others = rng.shuffle(lex.packList().filter((p) => p.id !== id && p.group !== 'track').map((p) => p.words).flat().filter((w) => !mine.has(w)));
    const wrong = adapt.fitPackWords(others.slice(0, 600), plan, lex.entry).filter((e) => good(e) && !mine.has(e.w)).slice(0, 8);
    if (wrong.length < 4) { state.msg = 'Could not build that web yet.'; touch(); return; }
    state.pr.web = { id, name: pk.name, cells: rng.shuffle([...right.map((e) => ({ w: e.w, right: true, got: false, bad: false })), ...wrong.map((e) => ({ w: e.w, right: false, got: false, bad: false }))]), wrong: 0, done: false };
    state.msg = ''; touch();
  };
  const webPick = (i) => {
    const W = state.pr.web, c = W?.cells[i]; if (!W || !c || c.got || c.bad || W.done) return;
    if (c.right) { c.got = true; buzz('good'); playTone({ freq: 620, to: 740, dur: 0.1, type: 'triangle', vol: 0.15 }); } else { c.bad = true; W.wrong += 1; buzz('bad'); }
    W.done = W.cells.every((x) => !x.right || x.got); touch();
  };
  const setPlay = (id) => { const st = (extras()?.sets ?? []).find((s) => s.id === id); if (st) startSession({ source: `set:${id}`, kindLabel: 'set' }); };
  const setStudy = (words) => { state.study = { words: words.slice(), day: day() }; save.study(); touch(); go('studylist'); };


  // ---------------------------------------------------------------- Learn more: practice library, read-along, tiles, say it, memory
  const near1 = (a, b) => {                              // one typo apart: a missing, extra or wrong letter, or two letters swapped
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    return s.slice(i) === l.slice(i + 1);
  };
  // B12: tile, keyboard and recall practice can draw on the player's own study set instead of the level's words
  const studyPool = () => safe(entriesOf(state.study.words)).filter((e) => e.gloss && e.w.length >= 3 && e.w.length <= 12 && /^[a-z]+$/.test(e.w) && !e.gloss.toLowerCase().includes(e.w));
  const wordPool = () => (state.pr.src === 'study' && studyPool().length >= 3 ? studyPool() : null) ?? selectWords().filter((e) => e.band <= Math.max(3, planNow().top) && e.w.length >= 4 && e.w.length <= 9 && e.gloss && e.gloss.length <= 84 && !e.gloss.toLowerCase().includes(e.w) && /^[a-z]+$/.test(e.w));
  const stopSpeech = () => { wg.stopSpeaking?.(); state.pr.speaking = false; state.pr.hl = -1; };
  const SPEAKER_KINDS = new Set(['listening', 'letter-hear', 'hearmeaning', 'hearspell', 'pron']);
  const hearRound = (round) => { if (x7.voiceOn()) x7.voiceAsk(round); else if (round.speak) { wg.speak?.(round.speak, state.prefs.voice, state.prefs.accent); caption(`[voice] ${round.speak}`); } };
  const sayWord = (text) => { if (canSpeak()) { wg.speak?.(text, state.prefs.voice, state.prefs.accent); caption(`[voice] ${text}`); } };
  const textOf = (title, author, words, extra = {}) => {
    const offs = []; let o = 0; for (const w of words) { offs.push(o); o += w.length + 1; }
    return { title, author: author ?? '', words, offs, big: false, hard: [], ...extra };
  };
  const openText = (deckId, id) => {
    const it = deck.get(deckId).find((x) => x.id === id); if (!it) return;
    stopSpeech();
    state.pr.text = textOf(it.title, it.author ? `${it.author}${it.year ? `, ${it.year}` : ''}` : '', it.lines.join(' ').split(/\s+/).filter(Boolean), { big: deckId !== 'poems' });
    state.pr.hl = -1; state.msg = ''; go('storyread');
  };
  const speakText = () => {
    const T = state.pr.text; if (!T || !canSpeak()) return;
    const P = state.pr; P.speaking = true; P.gotBoundary = false; P.hlT = 0; P.hl = 0;
    wg.speak?.(T.words.join(' '), state.prefs.voice, state.prefs.accent, (ci) => {
      P.gotBoundary = true; let i = 0; while (i + 1 < T.offs.length && T.offs[i + 1] <= ci) i += 1; P.hl = i; touch();
    }, () => { P.speaking = false; P.hl = -1; touch(); });
    touch();
  };
  // H3: strength scales (cold ... hot). Find the words that belong on one scale, then put them in order from mildest to strongest.
  const ladderFor = () => {
    const plan = planNow(), L = (extras()?.ladders ?? []).filter((l) => l.length >= 5 && l.every((w) => { const e = lex.entry(w); return !e || lex.kidOk(e); }));
    if (!L.length) return null;
    const avg = (l) => { let n = 0, t = 0; for (const w of l) { const b = lex.entry(w)?.band; if (b !== undefined && b >= 0) { n += 1; t += b; } } return n ? t / n : 2; };
    const ranked = L.slice().sort((a, b) => adapt.fitScore(plan, avg(a)) - adapt.fitScore(plan, avg(b)));
    return rng.pick(ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2))));
  };
  const startTiles = (mode, carry = null) => {
    let T;
    if (mode === 'find' || mode === 'rank') {
      const lad = carry?.ladder ?? ladderFor(); if (!lad) { state.msg = 'The strength scales are still loading.'; touch(); return; }
      const five = carry?.five ?? (() => { const i0 = rng.int(lad.length - 4); return lad.slice(i0, i0 + 5); })();
      if (mode === 'rank') {
        let tiles = rng.shuffle(five.slice()); if (tiles.join(' ') === five.join(' ')) tiles = tiles.reverse();
        T = { mode, target: five.join(' '), word: '', tiles, built: [], ladder: lad, five, clue: 'Put the five words in order, the least first and the most last (for example the mildest first and the strongest last).', result: null };
      } else {
        const t = planNow().tier.id, nDecoy = t === 'gentle' ? 2 : t === 'stretch' ? 4 : 3;       // fewer wrong choices for a gentle tier, more for a stretch tier
        const rest = (extras()?.ladders ?? []).filter((l) => l !== lad).flat().filter((w) => !lad.includes(w) && lex.isWord(w));
        const decoys = rng.shuffle([...new Set(rest)]).slice(0, nDecoy);
        T = { mode, target: [...five].sort().join(' '), word: '', tiles: rng.shuffle([...five, ...decoys]), built: [], ladder: lad, five, clue: `These words sit on one scale, from ${lad[0]} to ${lad[lad.length - 1]}. Tap the five that belong on it.`, result: null };
      }
      state.pr.tiles = T; touch(); return;
    }
    if (mode === 'alpha') {
      const set = alpha.orderSet(rng, 5); let tiles = rng.shuffle(set.slice()); if (tiles.join('') === set.join('')) tiles = tiles.reverse();
      state.pr.tiles = { mode, target: set.join(''), word: '', tiles, built: [], clue: 'Put the letters in alphabet order, from A towards Z.', result: null }; touch(); return;
    }
    if (mode === 'typed' || mode === 'recall') {
      const pool = wordPool(); if (!pool.length) { state.msg = 'The word list is still loading.'; touch(); return; }
      const e = rng.pick(pool);
      T = mode === 'typed'
        ? { mode, target: e.w, word: e.w, typed: '', clue: `${canSpeak() ? 'Hear the word, then type it. ' : 'Type the word. '}Meaning: ${e.gloss}`, result: null }
        : { mode, target: e.w, word: e.w, typed: '', hints: 0, clue: `Think of the word that means: ${e.gloss}`, result: null };
      state.pr.tiles = T; touch(); return;
    }
    if (mode === 'sentence') {
      const items = deck.get('sentences'); if (!items.length) { state.msg = 'The sentences are still loading.'; touch(); return; }
      const target = rng.pick(items), words = target.split(' ');
      let tiles = rng.shuffle(words.slice()); if (tiles.join(' ') === target) tiles = tiles.reverse();
      T = { mode, target, word: '', tiles, built: [], clue: 'Tap the words in the right order to make a sentence.', result: null };
    } else {
      const pool = wordPool(); if (!pool.length) { state.msg = 'The word list is still loading.'; touch(); return; }
      const e = rng.pick(pool), letters = e.w.split('');
      let tiles = letters.slice();
      if (mode !== 'scramble') { const extra = 'etaoinsrhl'.split('').filter((c) => !letters.includes(c)); tiles.push(...rng.shuffle(extra).slice(0, 2)); }
      tiles = rng.shuffle(tiles); if (mode === 'scramble' && tiles.join('') === e.w) tiles = tiles.reverse();
      const hearOnly = mode === 'dictate' && canSpeak();
      T = { mode, target: e.w, word: e.w, tiles, built: [], clue: mode === 'scramble' ? `Meaning: ${e.gloss}` : hearOnly ? 'Listen, then build the word. Tap Hear the word to hear it again.' : `${canSpeak() ? 'Hear the word, then build it. ' : ''}Meaning: ${e.gloss}`, result: null };
    }
    const prev = state.pr.tiles;
    if (mode === 'bee') Object.assign(T, { you: prev?.mode === 'bee' && !prev.final ? prev.you : 0, cpu: prev?.mode === 'bee' && !prev.final ? prev.cpu : 0, round: prev?.mode === 'bee' && !prev.final ? prev.round : 0 });
    state.pr.tiles = T; touch();
  };
  const checkTiles = () => {
    const T = state.pr.tiles; if (!T || T.result) return;
    const typedMode = T.mode === 'typed' || T.mode === 'recall', wordsMode = T.mode === 'sentence' || T.mode === 'rank';
    if (T.mode === 'find') {
      const got = T.built.map((i) => T.tiles[i]).sort().join(' '), hitF = got === T.target;
      T.result = { hit: hitF, msg: hitF ? `Right, those five belong together: ${T.five.join(', ')}.` : `Not quite. The five are: ${T.five.join(', ')}.`, next: true };
      if (hitF) { playTone({ freq: 660, to: 700, dur: 0.14, type: 'triangle', vol: 0.2 }); buzz('good'); } else { playTone({ freq: 220, to: 150, dur: 0.16, type: 'sawtooth', vol: 0.16 }); buzz('bad'); }
      wg.announce?.(T.result.msg); touch(); return;
    }
    const built = typedMode ? T.typed.toLowerCase() : T.built.map((i) => T.tiles[i]).join(wordsMode ? ' ' : '');
    const hit = built === T.target, almost = !hit && !wordsMode && near1(built, T.target);
    const ok = hit || (almost && state.prefs.typoOk);
    T.result = { hit: ok, msg: hit ? 'Right! Well done.' : almost && state.prefs.typoOk ? `Close enough. Watch the spelling: ${T.target}.` : almost ? `Almost there. It is spelled ${T.target}.` : wordsMode ? (T.mode === 'rank' ? `Not quite. Least to most: ${T.target.split(' ').join(' < ')}.` : `Not quite. It reads: ${T.target}`) : `Not quite. The word is ${T.target}.` };
    if (T.mode === 'rank' && hit) T.result.msg = `Right! ${T.target.split(' ').join(' < ')}.`;
    if (T.word && !state.autoPlay) { recFacet(T.word, facets.facetOfMode(T.mode), ok && !(T.hints > 0), 0); srs.applyAnswer(state.records, T.word, ok && !(T.hints > 0), 0, day()); dirtyRec = true; answersSinceSave += 1; save.rec(); bumpStrand('out', 1); }
    if (ok && T.hints > 0) T.result.msg += ` (${T.hints} hint${T.hints === 1 ? '' : 's'} used, so it comes back for another try.)`;
    if (T.mode === 'bee') { T.round += 1; if (ok) T.you += 1; if (rng.chance(0.65)) T.cpu += 1; if (T.round >= 5) { T.final = true; T.result.msg += ` Final: you ${T.you}, computer ${T.cpu}. ${T.you > T.cpu ? 'You win!' : T.you === T.cpu ? 'A tie.' : 'The computer wins this time.'}`; } }
    if (ok) { playTone({ freq: 660, to: 700, dur: 0.14, type: 'triangle', vol: 0.2 }); buzz('good'); } else { playTone({ freq: 220, to: 150, dur: 0.16, type: 'sawtooth', vol: 0.16 }); buzz('bad'); }
    wg.announce?.(T.result.msg); touch();
  };
  const startSay = () => {
    const pool = wordPool(); if (!pool.length) { state.msg = 'The word list is still loading.'; touch(); return; }
    const e = rng.pick(pool); state.pr.say = { word: e.w, gloss: e.gloss, msg: '' }; state.pr.listening = false; touch();
  };
  const listenSay = async () => {
    const P = state.pr, T = P.say; if (!T || P.listening || !wg.recognize) return;
    P.listening = true; T.msg = ''; touch();
    let r = null; try { r = await wg.recognize(state.prefs.accent); } catch { r = null; }
    P.listening = false;
    if (!r || !r.transcript) T.msg = 'I could not hear anything. Try again a little closer.';
    else {
      const toks = r.transcript.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/).filter(Boolean);
      const ok = toks.some((t) => t === T.word), close = !ok && toks.some((t) => near1(t, T.word));
      T.msg = ok ? `Heard "${r.transcript}". That was clear.` : close ? `Heard "${r.transcript}". Very close. Try once more.` : `Heard "${r.transcript}". Try again, slowly.`;
      if (ok) { playTone({ freq: 660, to: 700, dur: 0.14, type: 'triangle', vol: 0.2 }); buzz('good'); }
    }
    wg.announce?.(T.msg); touch();
  };
  const lemma = (w) => {
    const tries = [w, w.replace(/'s$/, ''), w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ly$/, ''), w.replace(/ies$/, 'y'), w.replace(/ier$/, 'y')];
    for (const t of tries) { const e = t.length >= 3 ? lex.entry(t) : null; if (e && e.rank !== undefined) return e; }
    return null;
  };
  const analyzeText = (raw) => {
    const toks = (raw.toLowerCase().match(/[a-z']+/g) ?? []).map((t) => t.replace(/^'+|'+$/g, '')).filter(Boolean).slice(0, 20000);
    const freq = new Map(); for (const t of toks) freq.set(t, (freq.get(t) ?? 0) + 1);
    let easy = 0, unknown = 0; const hard = [];
    for (const [t, n] of freq) {
      const e = lemma(t);
      if (e) { if (e.band <= 1 || srs.isKnown(state.records, e.w)) easy += n; else if (e.band >= 3 && e.gloss) hard.push([e.w, n]); else easy += n; } else if (!lex.isWord(t) && t.length > 2) unknown += 1; else easy += n;
    }
    hard.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return { total: toks.length, distinct: freq.size, easy: toks.length ? easy / toks.length : 0, unknown, hard: [...new Set(hard.map((h) => h[0]))].slice(0, 30), raw };
  };
  const loadPaste = async (how) => {
    let text = null;
    try { text = how === 'clip' ? await wg.readClipboard?.() : await wg.importText?.(); } catch { text = null; }
    if (!text || typeof text !== 'string' || !text.trim()) { state.msg = how === 'clip' ? 'There is no text on the clipboard. Copy a text, then try Paste again.' : 'No text was opened.'; touch(); return; }
    state.pr.paste = analyzeText(text.slice(0, 200000)); state.msg = ''; touch();
  };
  const addHard = (words) => {
    const have = new Set(state.study.words), add = words.filter((w) => !have.has(w));
    state.study = { words: [...state.study.words, ...add].slice(0, 200), day: day() }; save.study();
    state.msg = add.length ? `Added ${add.length} words to your study set.` : 'Those words are already in your study set.'; touch();
  };
  const recallOf = (r, d) => { const iv = Math.max(1, srs.INTERVALS[r[0]] || 1), el = Math.max(0, day() - r[5]); return 0.9 ** ((el + d) / iv); };
  const memList = () => {
    const out = [];
    for (const w in state.records) {
      const r = state.records[w]; if (!(r[6] > 0) || r[8]) continue;
      const el = Math.max(0, day() - r[5]);
      out.push({ w, p: recallOf(r, 0), curve: (d) => recallOf(r, d), note: `Box ${r[0]} of 7, last met ${el === 0 ? 'today' : `${el} days ago`}, ${r[2]} right and ${r[3]} wrong` });
    }
    out.sort((a, b) => a.p - b.p || (a.w < b.w ? -1 : 1)); return out.slice(0, 40);
  };
  const pickConf = () => {
    const cand = [...dueWords(), ...state.study.words, ...Object.keys(state.records).filter((w) => state.records[w][6] > 0 && !state.records[w][8])].filter((w) => { const e = lex.entry(w); return e && e.gloss; });
    state.pr.conf = cand.length ? { w: rng.pick(cand), step: 0, rating: 0, msg: '' } : null; touch();
  };
  const rateConf = (n) => { const T = state.pr.conf; if (T && T.step === 0) { T.rating = n; T.step = 1; touch(); } };
  const knewConf = (hit) => {
    const T = state.pr.conf; if (!T || T.step !== 1) return;
    recFacet(T.w, 'rcl', hit, 0); srs.applyAnswer(state.records, T.w, hit, 0, day()); if (T.rating === 3 && !hit) { const r = state.records[T.w]; r[0] = 0; r[1] = day() + 1; }
    const C = state.prefs.conf; C.n += 1; if (T.rating === 3 && hit) C.sureRight += 1; if (T.rating === 3 && !hit) C.sureWrong += 1; if (T.rating < 3 && hit) C.unsureRight += 1;
    T.msg = T.rating === 3 && !hit ? 'A surprise! Surprises stick, so this word comes back tomorrow.' : hit && T.rating === 3 ? 'Right, and you knew it.' : hit ? 'Right. You knew more than you thought.' : 'Now you have seen it. It will come back soon.';
    T.step = 2; save.rec(); save.prefs(); wg.announce?.(T.msg); touch();
  };
  // X9: fluency on words already known - the same quick questions, answered faster. Only words marked known or well up their memory boxes.
  const knownEntries = () => safe(entriesOf(Object.keys(state.records).filter((w) => { const r = state.records[w]; return r[8] || r[0] >= 4; }))).filter((e) => e.gloss);
  const startFluency = () => {
    const pool = knownEntries();
    if (pool.length < 8) { state.msg = 'The speed round uses words you already know. Play and study a little more, or tap "I know it" on words you are sure of, then come back.'; touch(); return false; }
    return startSession({ pool, kinds: ['synonym', 'definition', 'spelling', 'antonym', 'cloze'], kindLabel: 'fluency', over: { secs: 5, questions: 20, endBy: 'questions', lives: 0, hints: false } }) !== false;
  };
  const letterPool = (kind) => LETTERS.filter((c) => (kind === 'letter-look' ? 'bdpqmnuvwhlrfkt'.includes(c) : kind === 'letter-pic' ? c !== 'x' : true)).map(letterEntry);
  const startDeckQuiz = (kind) => startSession({ kinds: [kind], ...(kind.startsWith('letter-') ? { pool: letterPool(kind) } : {}), ...(kind === 'beginsound' || kind === 'endsound' ? { pool: lex.all().filter((e) => e.band <= 1 && e.w.length >= 3 && e.w.length <= 7) } : {}), kindLabel: 'deck', over: { questions: 15, endBy: 'questions', secs: 20, lives: 0, hints: true } });
  // ---- alphabet reader, keyboard practice, letter hunt (R1 R2 R4 R14)
  const startKeys = () => {
    const K = state.pr.keys ?? { mode: 'letter', shift: false, score: 0 };
    const target = rng.pick(LETTERS), word = rng.pick(alpha.KEY_WORDS);
    state.pr.keys = { ...K, target, word, typed: '', msg: '' }; touch();
  };
  const keyTap = (ch) => {
    const K = state.pr.keys; if (!K) return;
    if (K.mode === 'letter') {
      if (ch === K.target) { K.score += 1; playTone({ freq: 660, to: 700, dur: 0.12, type: 'triangle', vol: 0.18 }); const prev = K.target; startKeys(); state.pr.keys.msg = `Yes, that was ${prev.toUpperCase()}. Find the next one.`; }
      else { K.msg = `That is ${ch.toUpperCase()}. Look for ${K.target.toUpperCase()}.`; playTone({ freq: 240, to: 200, dur: 0.1, type: 'sine', vol: 0.12 }); }
    } else {
      if (ch === K.word[K.typed.length]) {
        K.typed += ch;
        if (K.typed === K.word) { K.score += 1; playTone({ freq: 660, to: 760, dur: 0.14, type: 'triangle', vol: 0.18 }); const w = K.word; startKeys(); state.pr.keys.msg = `You typed ${w}. Here is another.`; }
        else K.msg = '';
      } else K.msg = `Next letter: ${K.word[K.typed.length].toUpperCase()}.`;
    }
    touch();
  };
  const startHunt = () => { state.pr.hunt = alpha.huntGrid(rng.pick(alpha.STARTS), rng); touch(); };
  const huntTap = (i) => {
    const H = state.pr.hunt; if (!H || H.found[i] || H.found.filter(Boolean).length >= H.hits) return;
    if (H.cells[i] === H.target) { H.found[i] = true; playTone({ freq: 620, to: 700, dur: 0.1, type: 'triangle', vol: 0.16 }); if (H.found.filter(Boolean).length >= H.hits) { playTone({ freq: 784, to: 1175, dur: 0.3, type: 'triangle', vol: 0.18 }); if (effects()) buzz('good'); } }
    else { H.wrong += 1; playTone({ freq: 240, to: 200, dur: 0.1, type: 'sine', vol: 0.1 }); }
    touch();
  };
  // ---- A10: play together. Grown-up and child take turns on one screen; no links, no look-ups, no records written.
  const coKinds = (mode) => (mode === 'abc' ? ['letter-pic', 'letter-find', 'letter-look'] : mode === 'both' ? ['picture', 'letter-pic', 'picture', 'letter-find'] : ['picture']);
  const coNext = () => {
    const C = state.pr.co; if (!C) return;
    if (C.n >= C.total) { C.done = true; touch(); return; }
    const kinds = coKinds(C.mode);
    for (let tries = 0; tries < 30; tries += 1) {
      const kind = kinds[(C.n + tries) % kinds.length], isLetter = kind.startsWith('letter-');
      const e = isLetter ? letterEntry(rng.pick(LETTERS.filter((c) => c !== 'x'))) : lex.entry(rng.pick(ART_WORDS));
      if (!e || (!isLetter && !e.gloss) || !canAsk(e, kind, { canSpeak: false })) continue;
      const q = build(kind, e, rng, new Set());
      if (q) { C.q = q; C.pick = -1; C.right = false; C.turn = C.n % 2; touch(); return; }
    }
    C.done = true; touch();
  };
  const startCo = () => {
    state.pr.co = { mode: state.pr.coMode ?? 'pic', names: ['Grown-up', 'Child'], scores: [0, 0], n: 0, total: 10, turn: 0, q: null, pick: -1, right: false, done: false };
    coNext();
  };
  const coAnswer = (i) => {
    const C = state.pr.co; if (!C || !C.q || C.pick >= 0) return;
    C.pick = i; C.right = Boolean(C.q.options[i]?.correct);
    if (C.right) { C.scores[C.turn] += 1; playTone({ freq: 660, to: 760, dur: 0.14, type: 'triangle', vol: 0.18 }); } else playTone({ freq: 300, to: 260, dur: 0.1, type: 'sine', vol: 0.1 });
    C.n += 1; touch();
  };
  const prTap = (parts) => {
    const P = state.pr, a = parts[1], b = parts[2], c = parts[3];
    switch (a) {
      case 'pages': P.deck = b; P.page = 0; go('deckpage'); return;
      case 'quiz': startDeckQuiz(b); return;
      case 'sets': go('sets'); return;
      case 'analogy': go('analogy'); return;
      case 'packs': go('packs'); return;
      case 'pack': packStudy(b); return;
      case 'packstudy': packStudy(b); return;
      case 'packplay': packPlay(b); return;
      case 'webbuild': P.web = null; go('webbuild'); return;
      case 'webnew': P.web = null; touch(); return;
      case 'read': P.deck = b; go('readlist'); return;
      case 'open': openText(b, c); return;
      case 'pg': { const n = Math.max(1, Math.ceil(deckItems(P.deck).length / pagesPer(P.deck))); P.page = Math.max(0, Math.min(n - 1, P.page + (b === 'next' ? 1 : -1))); state.formScroll = 0; touch(); return; }
      case 'speak': speakText(); return;
      case 'stop': stopSpeech(); touch(); return;
      case 'rewind': stopSpeech(); speakText(); touch(); return;
      case 'addhard': addHard((P.text?.hard?.length ? P.text.hard : P.paste?.hard) ?? []); return;
      case 'tiles': startTiles(b); go('tiles'); return;
      case 'study': P.src = 'study'; startTiles(b); go('tiles'); return;
      case 'tile': { const T = P.tiles; if (T && !T.result && !T.built.includes(Number(b)) && !(T.mode === 'find' && T.built.length >= 5)) { T.built.push(Number(b)); buzz('good'); touch(); } return; }
      case 'undo': { const T = P.tiles; if (T && !T.result) { if (T.typed !== undefined) T.typed = T.typed.slice(0, -1); else T.built.pop(); touch(); } return; }
      case 'typein': { const T = P.tiles; if (!T || T.result || T.typed === undefined || !wg.askText) return; Promise.resolve(wg.askText('Type the word', T.typed)).then((v) => { if (typeof v === 'string' && P.tiles === T && !T.result) { T.typed = v.toLowerCase().replace(/[^a-z]/g, '').slice(0, 15); touch(); } }); return; }
      case 'hint': { const T = P.tiles; if (T && !T.result && T.mode === 'recall' && T.hints < T.target.length - 1) { T.hints += 1; touch(); } return; }
      case 'giveup': { const T = P.tiles; if (T && !T.result && T.mode === 'recall') { T.result = { hit: false, msg: `The word is ${T.target}. It will come back soon.` }; if (!state.autoPlay) { recFacet(T.word, 'rcl', false, 0); srs.applyAnswer(state.records, T.word, false, 0, day()); dirtyRec = true; save.rec(); } touch(); } return; }
      case 'check': checkTiles(); return;
      case 'hear': if (P.tiles?.word && state.scene === 'tiles') sayWord(P.tiles.word); else if (P.say) sayWord(P.say.word); return;
      case 'next':
        if (state.scene === 'tiles') { if (P.tiles?.final) { P.tiles = null; state.back.pop(); setScene('library'); return; } const m = P.tiles.mode; if (m === 'find') startTiles('rank', P.tiles); else if (m === 'rank') startTiles('find'); else startTiles(m); }
        else if (state.scene === 'sayit') startSay();
        else if (state.scene === 'conf') pickConf();
        return;
      case 'say': startSay(); go('sayit'); return;
      case 'sayrec': listenSay(); return;
      case 'selfok': if (P.say) { P.say.msg = 'Nice. Say it again a few times, then try another.'; touch(); } return;
      case 'paste': go('paste'); return;
      case 'clip': loadPaste('clip'); return;
      case 'file': loadPaste('file'); return;
      case 'readpass': { const pp = (extras()?.passages ?? []).find((x) => x.id === state.reading?.id); if (!pp) return; stopSpeech(); P.text = textOf(pp.title, '', pp.text.split(/\s+/).filter(Boolean), { big: adapt.bigText(planNow(), pp.level) }); P.hl = -1; go('storyread'); return; }
      case 'readpaste': { const T = P.paste; if (!T) return; stopSpeech(); P.text = textOf('Your text', '', T.raw.split(/\s+/).filter(Boolean).slice(0, 600), { hard: T.hard.slice(0, 12) }); P.hl = -1; go('storyread'); return; }
      case 'tricky': P.tricky = P.tricky ?? 0; go('tricky'); return;
      case 'alpha': P.alpha = P.alpha ?? { i: 0, mode: 'name' }; go('alpha'); return;
      case 'alsay': { const A = P.alpha ?? { i: 0, mode: 'name' }, ch = LETTERS[A.i]; if (b === 'pic') sayWord(alpha.letterSay(ch, 'name')); else sayWord(alpha.letterSay(ch, b)); return; }
      case 'alstep': { const A = P.alpha ?? (P.alpha = { i: 0, mode: 'name' }); A.i = Math.max(0, Math.min(25, A.i + (b === 'next' ? 1 : -1))); touch(); return; }
      case 'tracex': openTrace(Math.max(0, Math.min(25, Number(b) || 0))); return;
      case 'trace': openTrace(0); return;
      case 'chant': { stopSpeech(); P.text = textOf('Alphabet chant', 'an original chant', alpha.chantWords(), { big: true }); P.hl = -1; state.msg = ''; go('storyread'); return; }
      case 'sounds': P.snd = P.snd ?? { i: 0, g: 'cons' }; go('sounds'); return;
      case 'sndsay': { const Z = P.snd ?? { i: 0, g: 'cons' }, list = alpha.SOUNDS.filter((s) => s.k === Z.g), s = list[Math.min(Z.i, list.length - 1)]; if (s) sayWord(alpha.soundSpeech(s)); return; }
      case 'keys': startKeys(); go('keys'); return;
      case 'hunt': startHunt(); go('hunt'); return;
      case 'huntnext': startHunt(); return;
      case 'guide': go('guide'); return;
      case 'bedtime': go('bedtime'); return;
      case 'readbed': { const it = deck.get('stories')[0]; if (it) openText('stories', it.id); return; }
      case 'together': if (needGate('together')) return; go('together'); return;
      case 'costart': startCo(); return;
      case 'coans': coAnswer(Number(b)); return;
      case 'conext': coNext(); return;
      case 'cohear': if (P.co?.q) sayWord(P.co.q.speak || P.co.q.answer); return;
      case 'coend': P.co = null; goBack(); return;
      case 'trickyquiz': { const l = trickyPool(P.tricky ?? 0, planNow()); if (l.length >= 4) startSession({ pool: l, kinds: ['spelling', 'missing', 'definition'], kindLabel: 'deck', over: { questions: 12, endBy: 'questions', secs: 20, lives: 0, hints: true } }); return; }
      case 'mem': go('mem'); return;
      case 'practise': { const l = memList().slice(0, 15).map((m) => lex.entry(m.w)).filter(Boolean); if (l.length >= 3) startSession({ pool: l, kindLabel: 'review' }); else { state.msg = 'Play a few more rounds first.'; touch(); } return; }
      case 'conf': pickConf(); go('conf'); return;
      case 'rate': rateConf(Number(b)); return;
      case 'knew': knewConf(b === '1'); return;
      default: return;
    }
  };

  // One tap on a form row.
  const onFormTap = (id) => {
    if (x7.tap(id)) return;
    const parts = id.split(':'), a = parts[0], b = parts[1];
    const cfg = state.cfg;
    const step = (b === 'inc' ? 1 : -1);
    switch (a) {
      case 'pr': prTap(parts); return;
      case 'prxal': { const A = state.pr.alpha ?? (state.pr.alpha = { i: 0, mode: 'name' }); A.i = Number(b); touch(); return; }
      case 'prxalm': { const A = state.pr.alpha ?? (state.pr.alpha = { i: 0, mode: 'name' }); A.mode = b; touch(); return; }
      case 'prxsg': state.pr.snd = { i: 0, g: b }; touch(); return;
      case 'prxsn': { const Z = state.pr.snd ?? (state.pr.snd = { i: 0, g: 'cons' }); Z.i = Number(b); touch(); return; }
      case 'prxhear': { const items = deckItems(state.pr.deck), it = items[Number(b)]; if (it) sayWord(it.s ?? it.w?.[0] ?? it.q); return; }
      case 'prxkm': { const K = state.pr.keys ?? {}; state.pr.keys = { ...K, mode: b, score: 0 }; startKeys(); return; }
      case 'prxkc': { const K = state.pr.keys ?? {}; state.pr.keys = { ...K, shift: b === 'big' }; touch(); return; }
      case 'prxkey': keyTap(b); return;
      case 'prxhunt': huntTap(Number(b)); return;
      case 'prxbed': { const B = bedRoll(); B.on = b === 'on'; if (B.on) { B.secs = 0; B.day = day(); } save.prefs(); touch(); return; }
      case 'prxbedm': { const B = bedRoll(); B.mins = Number(b); save.prefs(); touch(); return; }
      case 'prxcom': state.pr.coMode = b; touch(); return;
      case 'pracc': setPref('accent', b); return;
      case 'prtypo': setPref('typoOk', b === 'on'); return;
      case 'prrate': setPref('voice', Number(b)); return;
      case 'prtile': prTap(['pr', 'tile', b]); return;
      case 'prmem': state.pr.memWord = b; touch(); return;
      case 'prsrc': { state.pr.src = b; if (state.pr.tiles) startTiles(state.pr.tiles.mode); touch(); return; }
      case 'prtricky': state.pr.tricky = Number(b); state.formScroll = 0; touch(); return;
      case 'preset': if (b !== 'custom') { state.cfg = normalizeCfg(applyPreset(cfg, b)); save.cfg(); touch(); } return;
      case 'lvl': setLevel(b === 'auto' ? null : Number(b)); return;
      case 'agegrp': setAge(b); return;
      case 'flvl': setLevel(b === 'auto' ? null : Number(b), true); state.back = []; setScene('title'); return;
      case 'attr': setCfg({ attrs: toggle(cfg.attrs, b) }); return;
      case 'topic': setCfg({ topics: toggle(cfg.topics, b) }); return;
      case 'prweb': if (b.startsWith('start-')) startWeb(b.slice(6)); else if (b.startsWith('pick-')) webPick(Number(b.slice(5))); return;
      case 'pktopic': setCfg({ topics: toggle(cfg.topics, `pk:${b}`) }); return;
      case 'poschip': setCfg({ pos: toggle(cfg.pos ?? [], b) }); return;
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
      case 'lanes': setCfg({ lanes: Number(b) }); return;
      case 'opts': if (b === 'hints') setCfg({ hints: !cfg.hints }, true); else if (b === 'adaptive') setCfg({ adaptive: !cfg.adaptive }); else if (b === 'auto') setCfg({ auto: !cfg.auto }); else setCfg({ skipKnown: !cfg.skipKnown }); return;
      case 'play': if (state.scene === 'stageinfo') startRun(state.sel.kind, state.sel.world, state.sel.stage); else startSession(); return;
      case 'study': if (!state.study.words.length) makeStudySet(); go('studylist'); return;
      case 'newset': if (makeStudySet() && state.scene !== 'studylist') go('studylist'); return;
      case 'cards': state.cardIdx = 0; state.cardFlip = false; go('cards'); return;
      case 'quizset': setCfg({ source: 'study' }); startSession({ source: 'study' }); return;
      case 'fluency': startFluency(); return;
      case 'practiseweak': startSession({ source: 'weak' }); return;
      case 'practisemix': { const l = safe(entriesOf(mixWords())); if (l.length >= 3) startSession({ pool: l, kindLabel: 'review' }); else { state.msg = 'Keep playing; pairs you mix up will collect here.'; touch(); } return; }
      case 'go': if (b === 'trace') { openTrace(0); return; } if (b === 'place') { startRun('place'); return; } if (b === 'daily') { startDaily(); return; } if (b === 'write' && !state.write) openWrite('use'); openNext(b); return;
      case 'look': requestLookup(b); return;
      case 'findword': openSearch({ from: state.scene }); return;
      case 'thesword': openSearch({ from: state.scene, tab: 'thes' }); return;
      case 'thes': lookupWord(b, { from: state.scene, tab: 'thes' }); return;
      case 'dict': if (state.scene === 'settings') { state.prefs.dict.choice = b; save.prefs(); touch(); return; } lookupWord(b, { from: state.scene }); return;   // Settings uses the same id for the online dictionary choice
      case 'compare': if (!kidMode() && state.prefs.dict.mode !== 'never') openCompare(b); return;
      case 'cmpa': case 'cmpb': if (state.cmp) { state.cmp[a === 'cmpa' ? 'a' : 'b'] = b; state.cmp.opened = { a: false, b: false }; touch(); } return;
      case 'cmpopen': cmpOpen(b === 'a' ? 'a' : 'b'); return;
      case 'cmppref': {
        const C = state.cmp; if (!C) return;
        const nm = (k) => DICTS.find((d) => d.k === k)?.label ?? k;
        if (b === 'clear') setNote(C.w, ''); else setNote(C.w, b === 'app' ? "I prefer this app's meaning." : `I prefer the ${nm(C[b])} meaning.`);
        return;
      }
      case 'cmpnote': { const C = state.cmp; if (!C) return; Promise.resolve(wg.askText?.(`Your note on "${C.w}"`, state.prefs.notes[C.w] ?? '')).then((v) => { if (typeof v === 'string') setNote(C.w, v); }); return; }
      case 'known': srs.setKnown(state.records, b, !srs.isKnown(state.records, b), day()); save.rec(); touch(); return;
      case 'notice':
        if (b === 'cancel') { goBack(); return; }
        if (b === 'always') state.prefs.dict.mode = 'always';
        state.prefs.dict.noticed = true; save.prefs(); doLookup(state.pending); goBack(); return;
      case 'scheme': state.scheme = Number(b); storage.set('scheme', state.scheme); touch(); return;
      case 'autodiff': setCfg({ auto: b === 'on' }); return;
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
        save.prefs(); touch();
        if (wg.scheduleReminder) wg.scheduleReminder(R.on, R.hour).then((ok) => { state.msg = !R.on ? 'Daily reminder is off.' : ok ? `Daily reminder set for ${R.hour}:00.` : 'Your choice is saved. A reminder needs the phone app to allow notifications; until then nothing is sent.'; touch(); }).catch(() => {});
        else { state.msg = 'Your choice is saved. A reminder needs the phone app to allow notifications; until then nothing is sent.'; touch(); }
        return;
      }
      case 'goal': state.prefs.goal = Math.max(10, Math.min(100, state.prefs.goal + 10 * step)); save.prefs(); touch(); return;
      case 'dmode': state.prefs.dict.mode = b; save.prefs(); touch(); return;
      case 'dict': state.prefs.dict.choice = b; save.prefs(); touch(); return;
      case 'dcustom': Promise.resolve(wg.askText?.('Dictionary address with {word} in it, starting with https://', state.prefs.dict.custom)).then((v) => { if (typeof v === 'string') { state.prefs.dict.custom = v.trim(); save.prefs(); touch(); } }); return;
      case 'exp':
        if (b === 'json') exportNow('word-game-backup.json', 'application/json', backupText());
        else if (b === 'words') exportNow('word-game-words.csv', 'text/csv', wordsCsv(state.records, state.prefs.notes));
        else if (b === 'flags') exportNow('word-game-flagged-words.txt', 'text/plain', `Flagged words (each may be wrong, odd or unsuitable):\n${state.prefs.flags.join('\n')}\n`);
        else exportNow('word-game-sessions.csv', 'text/csv', sessionsCsv(state.sessions));
        return;
      // ---- Phase 3: daily, sets, lists, mock test, writing, small settings
      case 'daily': startDaily(); return;
      case 'setstudy': setStudy((extras()?.sets ?? []).find((s) => s.id === b)?.words ?? []); return;
      case 'setplay': setPlay(b); return;
      case 'listimport': importList(); return;
      case 'liststudy': setStudy(state.lists.find((l) => l.id === b)?.words ?? []); return;
      case 'listplay': startSession({ source: `list:${b}`, kindLabel: 'list' }); return;
      case 'listdel': if (b === 'looked') return; state.lists = state.lists.filter((l) => l.id !== b); lex.setCustom(state.lists); save.lists(); syncHome(); if (state.scene === 'listview') goBack(); touch(); return;
      case 'listshare': { const L = state.lists.find((l) => l.id === b); if (L) exportNow(`${L.name.replace(/[^A-Za-z0-9]+/g, '-')}.csv`, 'text/csv', L.words.map((w) => (L.defs?.[w] ? `${w},"${L.defs[w].replace(/"/g, '""')}"` : w)).join('\n') + '\n'); return; }
      case 'mkind': { const M = state.prefs.mock, next = toggle(M.kinds, b); if (next.length) { M.kinds = next; save.prefs(); touch(); } return; }
      case 'mband': state.prefs.mock.band = Number(b); state.prefs.mock.bandPinned = true; save.prefs(); touch(); return;
      case 'mn': { const M = state.prefs.mock; M.n = Math.max(10, Math.min(50, M.n + 10 * step)); save.prefs(); touch(); return; }
      case 'msec': { const M = state.prefs.mock; M.secs = Math.max(8, Math.min(60, M.secs + (M.secs >= 20 ? 5 : 2) * step)); save.prefs(); touch(); return; }
      case 'mockstart': startMock(); return;
      case 'wmode': openWrite(b); touch(); return;
      case 'wnext': openWrite(state.write?.mode ?? 'use'); touch(); return;
      case 'wdone': if (state.write) { if (!state.write.done && !state.autoPlay) { for (const w of state.write.words) { recFacet(w, 'wri', true, 0); if (state.records[w]) { /* the overall record is untouched: writing is self-checked */ } } bumpStrand('out', 3); save.rec(); } state.write.done = true; touch(); } return;
      case 'explore': case 'xw': state.explore = b; state.exploreNote = ''; if (state.scene === 'explore') { state.formScroll = 0; touch(); } else go('explore'); return;
      case 'readpick': { const P_ = (extras()?.passages ?? []).find((x) => x.id === b); if (P_) { state.reading = { id: b, sel: null, ans: {}, order: Object.fromEntries(P_.qs.map((q, i) => [i, rng.shuffle(q.slice(1).map((_, k) => k))])), t0: state.t, wpm: 0 }; go('reading'); } return; }
      case 'rw': if (state.reading?.collect) { if (passageWords().includes(b)) pickToggle(b); return; } if (state.reading) { state.reading.sel = b; state.reading.selIdx = Number(parts[2]); touch(); lookupWord(b, { from: 'reading' }); } return;
      case 'radd': if (state.reading?.sel && lex.entry(state.reading.sel)?.rank !== undefined && !lkInList(state.reading.sel)) myWordsSet(state.reading.sel, true); return;
      case 'mwrm': if (state.scene === 'listview' && state.listSel !== 'looked') removeFromList(state.listSel, [b]); else myWordsSet(b, false); return;
      case 'pmode': state.pickMode = !state.pickMode; state.pick = []; touch(); return;
      case 'psel': if (pickWordsNow().includes(b)) pickToggle(b); return;
      case 'pselunk': state.pick = pickWordsNow().filter(unfamiliar); touch(); return;
      case 'pall': state.pick = pickWordsNow().slice(0, 150); touch(); return;
      case 'pclr': state.pick = []; touch(); return;
      case 'padd': { if (!state.pick.length) return; const n = state.pick.length, nm = b === 'looked' ? 'My words' : state.lists.find((l) => l.id === b)?.name; addToList(b, state.pick); state.badgeToast = { text: `Added ${n} to ${nm ?? 'the list'}`, t: 0 }; touch(); return; }
      case 'pplay': openChooser(state.pick, `${state.pick.length} selected`); return;
      case 'pcopen': { const L_ = state.lists.find((l) => l.id === b), words = b === 'looked' ? myWords() : (L_?.words ?? []); openChooser(words, b === 'looked' ? 'My words' : L_?.name ?? '', L_?.purpose ?? 'general'); return; }
      case 'listopen': state.listSel = b; state.pickMode = false; state.pick = []; go('listview'); return;
      case 'nlpurpose': { const nm0 = LISTP[b]?.name ?? 'My list'; Promise.resolve(wg.askText ? wg.askText('Name for the new list', nm0) : nm0).then((v) => { const nm = (typeof v === 'string' && v.trim() ? v.trim() : nm0).slice(0, 40); const id = `n${state.lists.length}${rng.int(1000000)}`; state.lists.push({ id, name: nm, purpose: b, words: [...new Set(state.pendingAdd)], defs: {} }); state.pendingAdd = []; lex.setCustom(state.lists); save.lists(); syncHome(); state.listSel = id; state.badgeToast = { text: `List “${nm}” made`, t: 0 }; state.pickMode = false; state.pick = []; goBack(); go('listview'); }); return; }
      case 'laddsearch': state.addTarget = b; openSearch({ from: state.scene }); return;
      case 'laddtext': state.addTarget = b; go('textwords'); return;
      case 'laddread': state.addTarget = b; go('read'); return;
      case 'lrename': { const L_ = state.lists.find((l) => l.id === b); if (!L_ || L_.id === 'looked') return; Promise.resolve(wg.askText?.('New name for the list', L_.name)).then((v) => { if (typeof v === 'string' && v.trim()) { L_.name = v.trim().slice(0, 40); lex.setCustom(state.lists); save.lists(); touch(); } }); return; }
      case 'lmerge': { const from = state.lists.find((l) => l.id === state.listSel), to = state.lists.find((l) => l.id === b); if (!from || !to || from.id === 'looked') return; addToList(to.id, from.words); state.lists = state.lists.filter((l) => l.id !== from.id); lex.setCustom(state.lists); save.lists(); state.listSel = to.id; state.badgeToast = { text: `Merged into ${to.name}`, t: 0 }; syncHome(); touch(); return; }
      case 'pmove': { const n = state.pick.length; if (!n) return; addToList(b, state.pick); removeFromList(state.listSel, state.pick); state.pick = []; state.badgeToast = { text: `Moved ${n} word${n === 1 ? '' : 's'}`, t: 0 }; touch(); return; }
      case 'pdrop': { removeFromList(state.listSel, state.pick); state.pick = []; touch(); return; }
      case 'listmock': { const L_ = state.lists.find((l) => l.id === b); if (L_) playWords('test', L_.words.map((w) => lex.entry(w)), 'mock test', 'all', 20); return; }
      case 'listdue': { const L_ = state.lists.find((l) => l.id === b); if (!L_) return; const due = new Set(srs.dueList(state.records, day(), 1e9)); playWords('mixed', L_.words.filter((w) => due.has(w)).map((w) => lex.entry(w)), 'review', 10); return; }
      case 'anlen': state.an.len = Number(b); touch(); return;
      case 'antime': state.an.secs = Number(b); touch(); return;
      case 'anstart': startAnalogy(false); return;
      case 'anwatch': startAnalogy(true); return;
      case 'pckind': state.playSet.kind = b; touch(); return;
      case 'pclen': state.playSet.len = b === 'all' ? 'all' : Number(b); touch(); return;
      case 'pcstart': playWords(state.playSet.kind, state.playSet.words.map((w) => lex.entry(w)), 'word play', state.playSet.len, state.playSet.secs); return;
      case 'pctime': state.playSet.secs = Number(b); touch(); return;
      case 'newlist': state.pendingAdd = [...state.pick]; go('newlist'); return;
      case 'textin': Promise.resolve(wg.askText?.('Paste your text here (it stays on this device)', '')).then((v) => { if (typeof v === 'string' && v.trim()) analysePaste(v.slice(0, 60000)); }); return;
      case 'rcollect': if (state.reading) { state.reading.collect = !state.reading.collect; state.pick = []; touch(); } return;
      case 'minedue': { const l = safe(entriesOf(srs.dueList(state.records, day(), 1e9).filter((w) => lkInList(w)))); if (l.length) startSession({ pool: l, kindLabel: 'review' }); return; }
      case 'wotd': { const W_ = wordOfDay(); if (W_) lookupWord(W_.w, { from: 'title' }); return; }
      case 'rfin': { const R = state.reading, P_ = (extras()?.passages ?? []).find((x) => x.id === R?.id); if (P_) { const words = P_.text.split(/\s+/).length, mins = Math.max(0.1, (state.t - R.t0) / 60); R.wpm = Math.min(900, Math.round(words / mins)); state.prefs.readDone = { ...(state.prefs.readDone ?? {}), [R.id]: day() }; save.prefs(); touch(); } return; }
      case 'flag': { const F = state.prefs.flags, i = F.indexOf(b); if (i >= 0) F.splice(i, 1); else if (F.length < 200) F.push(b); save.prefs(); touch(); return; }
      case 'brk': setPref('breakMin', Number(b)); return;
      case 'lim': setPref('limitMin', Number(b)); return;
      case 'imp': importNow(); return;
      case 'del': if (b === 'ask') { state.confirmDel = true; touch(); } else if (b === 'yes') deleteAll(); else { state.confirmDel = false; touch(); } return;
      // ---- profiles, age screen, parent gate
      case 'age': addProfile(b === 'child' ? 'child' : 'adult', b === 'later', b); state.back = []; setScene('firstlevel'); return;
      case 'padd': addProfile(b === 'child' ? 'child' : 'adult', b === 'senior', b === 'senior' ? 'later' : b); return;
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
      default:
        if (a.startsWith('rq') && state.reading) { state.reading.ans[Number(a.slice(2))] = Number(b); touch(); }
        return;
    }
  };

  const formRules = (L = lay()) => (state.scene === 'age' || state.scene === 'firstlevel' ? L.rulesFull : L.rules);
  const updateForm = (input) => {
    const Q = formRules(), p = input.pointer, keys = input.keys.pressed;
    const F = getForm(), vp = Q.viewport;
    formMetrics.content = F.layout.height; formMetrics.view = vp.h; formMetrics.max = Math.max(0, F.layout.height - vp.h);
    if (wheelInput.dy) { setFormScroll(state.formScroll + wheelInput.dy); wheelInput.dy = 0; }
    { const T = state.scene === 'tiles' ? state.pr.tiles : null;           // keyboard typing for the type-it and find-the-word practice
      if (T && !T.result && T.typed !== undefined) {
        for (const c of keys) {
          if (/^Key[A-Z]$/.test(c) && T.typed.length < 15) { T.typed += c[3].toLowerCase(); touch(); }
          else if (c === 'Backspace') { T.typed = T.typed.slice(0, -1); touch(); }
          else if (c === 'Enter' && T.typed) { checkTiles(); break; }
        }
      } }
    if (state.scene === 'compose' && keys.size) x7.composeKeys(keys);
    if (keys.has('ArrowDown')) setFormScroll(state.formScroll + 70);
    if (keys.has('ArrowUp')) setFormScroll(state.formScroll - 70);
    if (keys.has('PageDown') || (keys.has('Space') && state.scene !== 'compose')) setFormScroll(state.formScroll + vp.h * 0.9);
    if (keys.has('PageUp')) setFormScroll(state.formScroll - vp.h * 0.9);
    if (keys.has('Home')) setFormScroll(0);
    if (keys.has('End')) setFormScroll(formMetrics.max);
    state.formScroll = Math.max(0, Math.min(state.formScroll, formMetrics.max));
    if (p.pressed) {
      const noBack = state.scene === 'age' || state.scene === 'firstlevel';
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
  const traceStyle = () => (TRACE_STYLES.some((s) => s.k === state.prefs.traceStyle) ? state.prefs.traceStyle : 'upper');
  const mkTrace = (i) => ({ i, idx: 0, done: false, style: traceStyle(), cps: checkpoints(LETTERS[i], traceStyle()), t: 0 });
  const openTrace = (i) => { state.tr = mkTrace(i); go('trace'); };
  const updateTrace = (input) => {
    const L = lay(), Q = L.rules, T = L.trace, p = input.pointer, tr = state.tr;
    if (!tr) { goBack(); return; }
    tr.t += 1 / 60;
    if (p.pressed) {
      if (inRect(p.x, p.y, Q.back)) { goBack(); return; }
      if (inRect(p.x, p.y, Q.next)) { state.tr = mkTrace((tr.i + 1) % 26); pressed('traceNext'); return; }
      if (inRect(p.x, p.y, L.traceStyle)) { const k = TRACE_STYLES.findIndex((s) => s.k === tr.style); state.prefs.traceStyle = TRACE_STYLES[(k + 1) % TRACE_STYLES.length].k; save.prefs(); state.tr = mkTrace(tr.i); caption(`[trace] ${TRACE_STYLES.find((s) => s.k === state.prefs.traceStyle).label}`); return; }
      if (inRect(p.x, p.y, L.traceHear)) { wg.speak?.(LETTER_NAMES[LETTERS[tr.i]], state.prefs.voice, state.prefs.accent); caption(`[voice] ${LETTER_NAMES[LETTERS[tr.i]]}`); }
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
    else if (inRect(x, y, T.search)) { pressed('search'); openSearch({ from: 'title' }); }
    else if (inRect(x, y, T.wotd) && wordOfDay()) {
      const yw = wordOfDay(day() - 1);
      if (yw && yw.w !== wordOfDay().w && inRect(x, y, { x: T.wotd.x + T.wotd.w * 0.45, y: T.wotd.y, w: T.wotd.w * 0.55, h: T.wotd.h * 0.4 })) { pressed('wotd'); lookupWord(yw.w, { from: 'title' }); }
      else { pressed('wotd'); lookupWord(wordOfDay().w, { from: 'title' }); }
    }
    else if (inRect(x, y, T.mine)) { pressed('mine'); go(state.lists.length > 1 ? 'lists' : 'mywords'); }
    else if (inRect(x, y, T.play)) startSession();
    else if (inRect(x, y, T.journey)) { pressed('journey'); go('journey'); }
    else if (inRect(x, y, T.setup) || inRect(x, y, T.sum)) { pressed('setup'); go('setup'); }
    else if (inRect(x, y, T.study)) { pressed('study'); if (!state.study.words.length) makeStudySet(); go('studylist'); }
    else if (inRect(x, y, T.review)) { if (dueCountAll() > 0) { pressed('review'); startSession({ source: 'due' }); } }
    else if (inRect(x, y, T.prog)) { pressed('prog'); go('progress'); }
    else if (inRect(x, y, T.more)) { pressed('more'); go('more'); }
    else if (inRect(x, y, T.auto)) { pressed('autoplay'); state.autoOpts = null; startSession({ auto: true }); }
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
    if (canSpeak() && inRect(x, y, C.hear)) { sayWord(w); pressed('cardHear'); return; }
    if (inRect(x, y, C.dict)) { pressed('cardDict'); lookupWord(w, { from: 'cards' }); return; }
    if (inRect(x, y, C.thes)) { pressed('cardThes'); lookupWord(w, { from: 'cards', tab: 'thes' }); return; }
    if (inRect(x, y, C.body)) {
      if (state.cardFlip && !kidMode() && state.prefs.dict.mode !== 'never' && y > C.body.y + C.body.h - 70) requestLookup(w);
      else {
        state.cardFlip = !state.cardFlip;
        if (state.cardFlip) { srs.noteSeen(state.records, w, day()); dirtyRec = true; }
      }
    }
  };

  const hintNow = () => {
    const r = state.round; if (!r || r.hinted >= 0 || !state.live.hints) return;
    const wrong = r.words.filter((w) => !w.correct); if (!wrong.length) return;
    r.hinted = wrong[rng.int(wrong.length)].slot;
    const cost = state.live.hintCost ?? 5;
    state.score = Math.max(0, state.score - cost); if (cost > 0) state.streak = 0; state.hintUsed = true;
    playTone({ freq: 330, to: 300, dur: 0.1, type: 'sine', vol: 0.12 });
  };

  const updatePlaying = (dt, input) => {
    const L = lay(), P = L.play, p = input.pointer, keys = input.keys.pressed;
    if (p.pressed && inRect(p.x, p.y, P.pause)) { state.paused = !state.paused; pressed('pause'); return; }
    if (keys.has('KeyP')) { state.paused = !state.paused; return; }
    if (state.paused) { if (p.pressed && inRect(p.x, p.y, P.stop)) endSession('stop'); return; }
    { const P_ = state.prefs; if (P_.today.day !== day()) P_.today = { day: day(), n: 0, secs: 0 }; P_.today.secs += dt; }
    if (!state.autoPlay && limitHit()) { state.msg = 'That is enough play for today. Come back tomorrow, or ask a grown-up.'; endSession('limit'); return; }
    if (bedOn() && !state.autoPlay) { const B = bedRoll(); B.secs += dt; if (B.mins > 0 && B.secs >= B.mins * 60) { save.prefs(); state.msg = 'It is time to rest. Sleep well.'; endSession('bedtime'); return; } }
    if (!state.byQuestions) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) { state.timeLeft = 0; endSession('time'); return; }
    }
    const round = state.round;
    if (!round) return;
    const held = x7.hold();                                  // voice-first: the words hold still while the game talks and listens
    if (!held) round.age += dt;
    for (const w of held ? [] : round.words) {
      w.x -= w.speed * dt;
      w.y += w.vy * dt;
      if (w.y < w.sliceTop || w.y > w.sliceBottom) { w.vy *= -1; w.y = Math.min(w.sliceBottom, Math.max(w.sliceTop, w.y)); }
    }
    // At most one action per tick against this same `round` reference: resolveRound() spawns a fresh round synchronously.
    if (p.pressed) {
      if (inRect(p.x, p.y, P.stop)) { endSession('stop'); return; }
      if (state.toast?.rate && !state.toast.rated && inRect(p.x, p.y, P.rate)) { applyRate(); pressed('rate'); return; }
      if (state.toast?.also && !state.autoPlay && !state.toast.rate && inRect(p.x, p.y, { x: L.wide ? P.think.x : P.plaque.x, y: P.think.y + P.think.h * 0.5, w: L.wide ? P.think.w : P.plaque.w, h: P.think.h * 0.5 })) { const tt = state.toast; pressed('toast'); lookupWord(tt.also, { from: state.scene }); return; }
      if (state.toast?.look && !state.autoPlay && inRect(p.x, p.y, L.wide ? P.think : { x: P.plaque.x, y: P.think.y, w: P.plaque.w, h: P.think.h })) { const tt = state.toast; pressed('toast'); lookupWord(tt.look, { from: state.scene, tab: tt.lookRel ? 'thes' : 'meaning' }); return; }
      if (inRect(p.x, p.y, P.hint)) { hintNow(); pressed('hint'); return; }
      if (round.hearable && (SPEAKER_KINDS.has(round.kind) ? inRect(p.x, p.y, P.plaque) : inRect(p.x, p.y, hearRect(P.plaque)))) { hearRound(round); return; }
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
    if (!held && correctWord && correctWord.x + correctWord.w / 2 < 0) resolveRound(null);
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
  // The words of a finished round for the Keep exploring strip: the missed ones when there are any, otherwise every word of the round.
  const overWords = () => {
    const ok = (h) => !h.letter && lex.entry(h.word)?.rank !== undefined, uniq = (l) => [...new Set(l)];
    const missed = uniq(state.history.filter((h) => !h.correct && ok(h)).map((h) => h.word));
    return missed.length ? { missed: true, words: missed } : { missed: false, words: uniq(state.history.filter(ok).map((h) => h.word)) };
  };
  const overInfo = () => { const o = overWords(); return { n: o.words.length, missed: o.missed, kept: o.words.length > 0 && o.words.every((w) => lkInList(w)) }; };
  const keepOverWords = () => { const o = overWords(); for (const w of o.words) myWordsSet(w, true, true); if (o.words.length) { state.badgeToast = { text: `Kept ${o.words.length} in My words`, t: 0 }; touch(); } };
  const reviewPages = () => Math.max(1, Math.ceil(state.history.length / lay().over.perPage));
  const updateGameover = (input) => {
    state.reviewPage = Math.min(state.reviewPage, reviewPages() - 1);
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer, O = lay().over;
    if (inRect(x, y, O.prev)) { state.reviewPage = Math.max(0, state.reviewPage - 1); pressed('prev'); return; }
    if (inRect(x, y, O.next)) { state.reviewPage = Math.min(reviewPages() - 1, state.reviewPage + 1); pressed('next'); return; }
    if (!state.autoPlay && !state.runResult && O.strip && overWords().words.length) {
      if (inRect(x, y, O.stripBtn(0))) { pressed('keepmissed'); keepOverWords(); return; }
      if (inRect(x, y, O.stripBtn(1))) { pressed('playmissed'); playWords(null, overWords().words.map((w) => lex.entry(w)), 'word play'); return; }
      if (inRect(x, y, O.stripBtn(2))) {
        const ws = overWords().words; let pick = null;
        for (let i = 0; i < 6 && !pick; i += 1) pick = wanderPick(ws[rng.int(ws.length)]);
        pressed('overwander'); if (pick) lookupWord(pick, { from: 'gameover', wander: true }); else { state.badgeToast = { text: 'No new related word right now', t: 0 }; touch(); }
        return;
      }
    }
    {
      const rows = reviewRows(), allRight = rows.length && rows.every((r) => r.correct), top = allRight ? O.rowsTop + 28 : O.rowsTop;
      const slice = rows.slice(state.reviewPage * O.perPage, (state.reviewPage + 1) * O.perPage), ext = !state.autoPlay && !kidMode() && state.prefs.dict.mode !== 'never' && (wg.openLink || env.openLink);
      for (let i = 0; i < slice.length; i += 1) {
        if (slice[i].letter) continue;
        if (ext && inRect(x, y, O.lookRect(i, top))) { requestLookup(slice[i].word); return; }
        if (inRect(x, y, O.dictRect(i, top, ext ? 146 : 0))) { pressed('dictrow'); lookupWord(slice[i].word, { from: 'gameover' }); return; }
        if (REL_QUIZ_KINDS.has(slice[i].kind) && inRect(x, y, O.thesRect(i, top, ext ? 146 : 0))) { pressed('thesrow'); lookupWord(slice[i].word, { from: 'gameover', tab: 'thes' }); return; }
      }
      for (let i = 0; i < slice.length; i += 1) if (!slice[i].letter && inRect(x, y, O.rowRect(i, top))) { pressed('dictrow'); lookupWord(slice[i].word, { from: 'gameover' }); return; }   // anywhere on a row opens the word
    }
    if (state.autoPlay) {
      if (inRect(x, y, O.again)) startSession({ auto: true, ...(state.autoOpts ?? {}) });
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
    if (inRect(x, y, O.again)) { if (state.kind === 'fluency') startFluency(); else startSession(state.kind === 'review' ? { source: 'due' } : {}); }
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


  // ---------------------------------------------------------------- K7: screen-reader support (a list of labelled controls the page mirrors as real buttons)
  // a11y() describes what is on screen as plain items { id, role, label, on, disabled, rect }; web/a11y-dom.js turns them into a hidden, focusable layer
  // over the canvas. a11yDo(id) does what a tap on that control does. Nothing here draws anything.
  let pendingTap = null;
  const a11yRect = (r) => (r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null);
  const a11yKey = () => `${state.lk ? `lk${state.lk.view}${state.lk.tab}${state.lk.stack.length}${state.lk.q}${state.lk.scroll}` : ''}|${state.scene}|${rev}|${state.answered}|${state.paused}|${state.cardIdx}|${state.cardFlip}|${Math.round(state.formScroll)}|${state.textScaleIdx}|${state.round ? state.round.word : ''}`;
  const a11y = () => {
    const sc = state.scene, L = lay(), out = [], item = (id, role, label, extra = {}) => { if (label !== undefined && label !== '') out.push({ id, role, label: String(label), ...extra }); };
    const back = (r) => item('back', 'button', 'Back', { rect: a11yRect(r) });
    if (state.lk) {
      const K = getLookup(), G = K.G, k = state.lk;
      item('h', 'heading', K.view === 'search' ? 'Dictionary and thesaurus' : `${k.tab === 'thes' ? 'Thesaurus' : 'Dictionary'}: ${K.title}`, { level: 1 });
      item('lk:tab:meaning', 'button', 'Meaning', { rect: a11yRect(G.tabM), selected: k.tab === 'meaning' }); item('lk:tab:thes', 'button', 'Thesaurus', { rect: a11yRect(G.tabT), selected: k.tab === 'thes' });
      item('lk:done', 'button', 'Done', { rect: a11yRect(G.done) });
      if (K.canBack) item('lk:back', 'button', 'Back', { rect: a11yRect(G.back) });
      if (K.view === 'search') {
        item('lk:q', 'text', k.q ? `Typed: ${k.q}` : 'Type a word with the keys or your keyboard');
        K.list.forEach((wd, i) => item(`lk:sug:${i}`, 'button', wd, { rect: a11yRect(G.rowRect(i)) }));
        item('lk:go', 'button', 'Look up', { rect: a11yRect(G.go), disabled: !k.q });
        for (const key of G.keys) item(`lk:${key.id}`, 'button', key.label === '\u232B' ? 'Delete' : key.label, { rect: a11yRect(key.r) });
      } else {
        item('lk:hear', 'button', 'Hear it', { rect: a11yRect(G.hear), disabled: !K.hearOk });
        item('lk:dec', 'button', 'Smaller text', { disabled: state.textScaleIdx <= 0, rect: a11yRect(G.dec) }); item('lk:inc', 'button', 'Larger text', { disabled: state.textScaleIdx >= TEXT_SCALES.length - 1, rect: a11yRect(G.inc) });
        K.layout.items.forEach((it, n) => {
          const r = it.row;
          if (r.k === 'h' || r.k === 'sub') item(`lk:r${n}`, 'heading', r.t, { level: 2 }); else if (r.k === 'p') item(`lk:r${n}`, 'text', r.t); else if (r.k === 'kv') item(`lk:r${n}`, 'text', `${r.l}: ${r.r}`); else if (r.k === 'chips' && r.label) item(`lk:r${n}`, 'text', r.label);
          for (const h of it.hits) item(`lk:${h.id}`, 'button', h.label, { disabled: Boolean(h.disabled) });
        });
      }
      return out;
    }
    if (sc === 'title') {
      const T = L.title, due = dueCountAll();
      item('h', 'heading', env.manifest.title, { level: 1 });
      item('t:play', 'button', 'Play', { rect: a11yRect(T.play) }); item('t:journey', 'button', 'Journey', { rect: a11yRect(T.journey) });
      item('t:setup', 'button', `Words and pace. ${sumLine(state.cfg, '', planNow())}`, { rect: a11yRect(T.setup) });
      item('t:study', 'button', `Study${state.study.words.length ? `, ${state.study.words.length} words` : ''}`, { rect: a11yRect(T.study) });
      item('t:review', 'button', `Review, ${due} due`, { rect: a11yRect(T.review), disabled: due === 0 });
      item('t:prog', 'button', 'Progress', { rect: a11yRect(T.prog) }); item('t:more', 'button', 'More', { rect: a11yRect(T.more) });
      item('t:auto', 'button', 'Watch and learn', { rect: a11yRect(T.auto) });
      item('t:search', 'button', 'Dictionary and thesaurus. Offline meaning, sound, examples, synonyms and opposites.', { rect: a11yRect(T.search) });
      if (wordOfDay()) item('t:wotd', 'button', `Word of the day: ${wordOfDay().w}. ${wordOfDay().gloss}`, { rect: a11yRect(T.wotd) });
      if (T.mine) item('t:mine', 'button', `My words, ${myWords().length}`, { rect: a11yRect(T.mine) });
      if (state.msg) item('m', 'text', state.msg);
    } else if (sc === 'playing' || sc === 'autoplay') {
      const P = L.play, r = state.round;
      item('h', 'heading', sc === 'autoplay' ? 'Watch and learn' : state.paused ? 'Paused' : 'Question', { level: 1 });
      if (r) {
        item('q', 'text', `${r.label}. ${r.targetWord ?? ''}`);
        const opts = r.words.slice().sort((x, y) => x.slot - y.slot);
        opts.forEach((w, i) => item(`opt:${w.slot}`, 'button', `${i + 1}. ${w.text}`, { disabled: w.slot === r.hinted || sc === 'autoplay' || state.paused, rect: { x: P.band.x, y: P.band.y + i * (P.band.h / opts.length), w: P.band.w, h: P.band.h / opts.length } }));
        if (r.hearable) item('hear', 'button', 'Hear it', { rect: a11yRect(P.plaque) });
      }
      item('score', 'text', `Score ${state.score}. ${state.byQuestions ? `Question ${Math.min(state.answered + 1, state.total)} of ${state.total}` : `${Math.ceil(state.timeLeft)} seconds left`}.`);
      if (sc === 'playing') { item('pause', 'button', state.paused ? 'Resume' : 'Pause', { rect: a11yRect(P.pause) }); item('hint', 'button', 'Hint', { rect: a11yRect(P.hint), disabled: !state.live.hints || (r?.hinted ?? -1) >= 0 || state.paused }); item('stop', 'button', 'Stop', { rect: a11yRect(P.stop) }); }
      else { item('apause', 'button', state.autoPaused ? 'Resume' : 'Pause', { rect: a11yRect(P.apause) }); item('aexit', 'button', 'Exit', { rect: a11yRect(P.aexit) }); }
    } else if (sc === 'gameover') {
      const O = L.over, right = state.history.filter((x) => x.correct).length;
      item('h', 'heading', 'Round complete', { level: 1 }); item('s', 'text', `Score ${state.score}. ${right} of ${state.history.length} right.`);
      for (const x of state.history.filter((y) => !y.correct).slice(0, 12)) item(`w:${x.word}`, 'text', `To practise: ${x.prompt ?? ''}. The answer was ${x.answer}. ${x.meaning ?? ''}`);
      item('o:again', 'button', 'Play again', { rect: a11yRect(O.again) }); item('o:change', 'button', 'Change settings', { rect: a11yRect(O.change) });
      if (O.strip && !state.autoPlay && !state.runResult && overWords().words.length) { item('o:keep', 'button', 'Keep in My words', { rect: a11yRect(O.stripBtn(0)) }); item('o:playw', 'button', 'Play these words', { rect: a11yRect(O.stripBtn(1)) }); item('o:wander', 'button', 'Surprise me', { rect: a11yRect(O.stripBtn(2)) }); }
    } else if (sc === 'cards') {
      const Q = L.rules, C = L.cards, w = state.study.words[state.cardIdx], e = w && lex.entry(w);
      item('h', 'heading', `Flashcard ${state.cardIdx + 1} of ${state.study.words.length}`, { level: 1 });
      if (e) item('card', 'button', state.cardFlip ? `${e.w}: ${e.gloss}. Tap to turn back.` : `${e.w}. Tap to see the meaning.`, { rect: a11yRect(C.body) });
      if (canSpeak()) item('c:hear', 'button', 'Hear the word', { rect: a11yRect(C.hear) });
      item('c:know', 'button', 'I know it', { rect: a11yRect(C.know) }); item('c:learn', 'button', 'Still learning', { rect: a11yRect(C.learn) }); item('c:next', 'button', 'Next card', { rect: a11yRect(Q.next) }); back(Q.back);
    } else if (sc === 'rules') {
      const Q = L.rules; item('h', 'heading', 'Rules', { level: 1 }); back(Q.back);
      RULES.forEach((r, i) => { item(`r${i}h`, 'heading', r.title, { level: 2 }); r.lines.forEach((l, j) => item(`r${i}p${j}`, 'text', l)); });
    } else if (sc === 'journey' || sc === 'trace') {
      item('h', 'heading', sc === 'journey' ? 'Journey map' : 'Trace the letters', { level: 1 });
      item('n', 'text', sc === 'journey' ? 'The Journey map is drawn as a picture. To practise with a screen reader, use Play, Study or Learn more from the More screen.' : 'Tracing needs a finger on the screen. Use Alphabet in More to hear every letter.');
      back(L.rules.back);
    } else if (FORM_SCENES.has(sc)) {
      const F = getForm(), Q = formRules(L), vp = Q.viewport, scroll = state.formScroll;
      const R = (it, h) => { const y = vp.y + it.y + (h ? h.y : 0) - scroll, hh = h ? h.h : it.h, x = vp.x + Q.padX + (h ? h.x : 0); return y + hh < vp.y || y > vp.y + vp.h ? null : { x, y, w: h ? h.w : vp.w - 2 * Q.padX, h: hh }; };
      item('h', 'heading', F.def.title || sc, { level: 1 });
      if (sc !== 'age' && sc !== 'firstlevel') back(Q.back);
      F.layout.items.forEach((it, n) => {
        const r = it.row;
        switch (r.k) {
          case 'h': item(`r${n}`, 'heading', r.t, { level: 2, rect: R(it) }); break;
          case 'sub': item(`r${n}`, 'heading', r.t, { level: 3, rect: R(it) }); break;
          case 'p': case 'pre': item(`r${n}`, 'text', r.t, { rect: R(it) }); break;
          case 'kv': item(`r${n}`, 'text', `${r.l}: ${r.r}`, { rect: R(it) }); break;
          case 'bar': item(`r${n}`, 'text', `${r.label}${r.text ? `. ${r.text}` : ''}`, { rect: R(it) }); break;
          case 'hl': item(`r${n}`, 'text', r.words.join(' '), { rect: R(it) }); break;
          case 'rtext': item(`r${n}`, 'text', r.t, { rect: R(it) }); break;
          case 'big': item(`r${n}`, 'text', [r.t, r.sub, r.cap].filter(Boolean).join('. '), { rect: R(it) }); break;
          case 'word': item(`r${n}`, 'text', `${r.w}. ${r.pos ? `${r.pos}. ` : ''}${r.gloss}. ${(r.lines ?? []).join('. ')}`, { rect: R(it) }); break;
          case 'heat': item(`r${n}`, 'text', `${r.label}. ${r.foot ?? ''}`, { rect: R(it) }); break;
          default: break;
        }
        for (const h of it.hits) {
          if (h.kind === 'tok') continue;
          const lab = r.k === 'chips' || r.k === 'grid' ? `${r.label ? `${r.label}: ` : ''}${h.label}` : h.kind === 'btn' && h.sub ? `${h.label}. ${h.sub}` : h.label;
          const wordChip = r.k === 'word' ? `${h.label} ${r.w}` : lab;
          item(`hit:${h.id}`, h.kind === 'chip' ? 'toggle' : 'button', wordChip, { on: Boolean(h.on), disabled: Boolean(h.disabled), rect: R(it, h) });
        }
      });
      if (F.def.primary) item('primary', 'button', F.def.primary.label ?? 'Continue', { disabled: Boolean(F.def.primary.disabled), rect: a11yRect(Q.next) });
      item('t:dec', 'button', 'Smaller text', { disabled: state.textScaleIdx <= 0, rect: a11yRect(Q.dec) }); item('t:inc', 'button', 'Larger text', { disabled: state.textScaleIdx >= TEXT_SCALES.length - 1, rect: a11yRect(Q.inc) });
    } else item('h', 'heading', 'Word Game', { level: 1 });
    return out;
  };
  const a11yDo = (id) => {
    const sc = state.scene, L = lay();
    if (state.lk) { if (id.startsWith('lk:')) { lkPress(id.slice(3)); return true; } return false; }
    if (id === 'back') { if (sc === 'rules' || sc === 'cards' || sc === 'journey' || sc === 'trace' || FORM_SCENES.has(sc)) { goBack(); return true; } return false; }
    if (sc === 'playing' || sc === 'autoplay') {
      const r = state.round;
      if (id.startsWith('opt:') && r && sc === 'playing' && !state.paused) { const w = r.words.find((x) => x.slot === Number(id.slice(4))); if (w && w.slot !== r.hinted) { resolveRound(w.text); return true; } return false; }
      if (id === 'hear' && r?.hearable) { hearRound(r); return true; }
      const P = L.play, map = { pause: P.pause, hint: P.hint, stop: P.stop, apause: P.apause, aexit: P.aexit };
      if (map[id]) { pendingTap = { x: map[id].x + map[id].w / 2, y: map[id].y + map[id].h / 2 }; return true; }
      return false;
    }
    if (FORM_SCENES.has(sc)) {
      const F = getForm();
      if (id === 'primary' && F.def.primary && !F.def.primary.disabled) { onFormTap(F.def.primary.id); return true; }
      if (id === 't:dec' && state.textScaleIdx > 0) { state.textScaleIdx -= 1; storage.set('textScaleIdx', state.textScaleIdx); state.formScroll = 0; touch(); return true; }
      if (id === 't:inc' && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx += 1; storage.set('textScaleIdx', state.textScaleIdx); state.formScroll = 0; touch(); return true; }
      if (id.startsWith('hit:')) { const hid = id.slice(4); for (const it of F.layout.items) for (const h of it.hits) if (h.id === hid && !h.disabled) { onFormTap(hid); return true; } }
      return false;
    }
    // rect-based screens (title, game over, cards, rules): a tap in the middle of the control's rectangle
    const T = L.title, O = L.over, C = L.cards, Q = L.rules;
    const rects = { 't:play': T.play, 't:journey': T.journey, 't:setup': T.setup, 't:study': T.study, 't:review': T.review, 't:prog': T.prog, 't:more': T.more, 't:auto': T.auto, 't:search': T.search, 't:wotd': T.wotd, 't:mine': T.mine, 'o:again': O.again, 'o:keep': O.stripBtn(0), 'o:playw': O.stripBtn(1), 'o:wander': O.stripBtn(2), 'o:change': O.change, card: C.body, 'c:hear': C.hear, 'c:know': C.know, 'c:learn': C.learn, 'c:next': Q.next };
    const r = rects[id]; if (!r) return false;
    pendingTap = { x: r.x + r.w / 2, y: r.y + r.h / 2 }; return true;
  };

  // ---------------------------------------------------------------- waves 7 and 8 (game7.js): reports, PIN, memories, vocabulary test, facets, voice
  const openStudy = () => { if (!state.study.words.length) makeStudySet(); go('studylist'); };
  const runVoiceTarget = (to) => {
    if (to === 'play') startSession(); else if (to === 'study') openStudy(); else if (to === 'review') { if (dueCountAll() > 0) startSession({ source: 'due' }); else { state.msg = 'Nothing is due for review today.'; touch(); } }
    else if (to === 'progress') go('progress'); else if (to === 'more') go('more'); else if (to === 'journey') go('journey'); else if (to === 'settings') openNext('settings');
  };
  const x7 = createExtras({
    state, wg, rng, lex, adapt, store, day, go, goBack, setScene, touch, save, exportNow, sayWord, canAsk, chooseKind, build, syncKid, bumpStrand, switchProfile, setStudy, startSession, startFluency, openWrite,
    mergePrefs, pkey, resolveRound, hintNow, endSession, needGate, dueCountAll, openStudy, setLevel, checkAch, runVoiceTarget,
    setAge: (k, quiet) => applyAge(adapt.validAge(k), quiet), setTextIdx: (i) => bumpText(i),
  });

  return {
    update(dt, input) {
      syncHome();
      if (pendingTap) { input.pointer.x = pendingTap.x; input.pointer.y = pendingTap.y; input.pointer.pressed = true; pendingTap = null; }
      host.lefty = Boolean(state.prefs.lefty); host.oneHand = Boolean(state.prefs.oneHand);
      const frozen = (state.scene === 'autoplay' && state.autoPaused) || (state.scene === 'playing' && state.paused);
      if (!frozen) {
        state.t += dt; state.sceneT += dt;
        if (state.press && (state.press.t += dt) > 0.6) state.press = null;
        if (state.fx && (state.fx.t += dt) > 0.8) state.fx = null;
        stepFx(dt);
      }
      if (state.pr.speaking && !state.pr.gotBoundary && state.pr.text) {            // no word events from the voice: pace the light by speaking rate
        const P = state.pr; P.hlT += dt; const i = Math.min(P.text.words.length - 1, Math.floor(P.hlT * [1.8, 2.6, 3.4][state.prefs.voice] ?? 2.6));
        if (i !== P.hl) { P.hl = i; touch(); }
        if (P.hlT * ([1.8, 2.6, 3.4][state.prefs.voice] ?? 2.6) > P.text.words.length + 2) { P.speaking = false; P.hl = -1; touch(); }
      }
      const dv = lex.version() + deck.version() * 997;
      if (dv !== state.dataVersion) { state.dataVersion = dv; touch(); }
      if (state.lk) { updateLookup(input); return; }                       // the sheet is modal: nothing underneath reacts while it is open
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
      syncHome();
      const form = FORM_SCENES.has(state.scene) ? getForm() : null;
      const dueN = dueCountAll();
      const me = state.profiles.find((p) => p.id === state.profile);
      const Lc = layoutFor(meta.width, meta.height);
      render(ctx, state, env.manifest.title, DEMO_SESSION_LIMIT, Lc, env, {
        note: breakDue() ? `You have played ${Math.round(state.prefs.today.secs / 60)} minutes today. A short break is good for your eyes.` : '',
        form, entry: lex.entry, posName: lex.posName, cardExtras, sumLine: sumLine(state.cfg, state.profiles.length > 1 ? me?.name : '', planNow()), dueN, canSpeak: canSpeak(),
        lookupOn: !kidMode() && state.prefs.dict.mode !== 'never' && Boolean(wg.openLink || env.openLink),
        best: state.bestScores[`${state.cfg.preset === 'classic' ? 'c' : paceKey(state.cfg)}|play`] ?? 0, studyN: state.study.words.length, mineN: myWords().length, listN: state.lists.length, wotd: wordOfDay(), goal: state.prefs.goal,
        todayN: state.prefs.today.day === day() ? state.prefs.today.n : 0, streakN: state.prefs.streak.last >= day() - 1 ? state.prefs.streak.n : 0,
        map: state.scene === 'journey' ? getMap() : null, jFocus: state.scene === 'journey' ? focusWorld() : null, journey: state.journey, jny, stars: jny.totalStars(state.journey), prefs: state.prefs, senior: state.prefs.senior,
        trace: state.scene === 'trace' ? state.tr : null, LETTERS, STROKES_OK: true, over: state.scene === 'gameover' ? overInfo() : null, yWotd: state.scene === 'title' ? wordOfDay(day() - 1) : null,
      });
      if (state.lk) drawLookup(ctx, state, Lc, getLookup());
      if (bedOn()) { ctx.save(); ctx.fillStyle = 'rgba(28,14,0,0.3)'; ctx.fillRect(0, 0, Lc.w, Lc.h); ctx.restore(); }
      if (state.badgeToast) drawBadgeToast(ctx, Lc, state.badgeToast);
    },

    getState() { return state; },
    // the dictionary sheet: one shared entry point, plus Back for hosts that have a back gesture (true when the sheet used it)
    lookupWord: (w, o) => lookupWord(w, o), openSearch, closeLookup, back: () => closeLookup(),
    a11y, a11yDo, a11yKey,

    // Centre of a control on the current form screen (scrolls it into view first). Used by the scripted tests and screenshot driver.
    hitCenter(id) {
      if (!FORM_SCENES.has(state.scene)) return null;
      const F = getForm(), Q = formRules(), vp = Q.viewport;
      for (const it of F.layout.items) for (const h of it.hits) {
        if (h.id !== id) continue;
        const maxS = Math.max(0, F.layout.height - vp.h);
        const cy = it.y + h.y + h.h / 2;
        if (cy - state.formScroll < 40 || cy - state.formScroll > vp.h - 40) state.formScroll = Math.max(0, Math.min(maxS, cy - vp.h / 2));
        return { x: vp.x + Q.padX + h.x + h.w / 2, y: vp.y + cy - state.formScroll };
      }
      return null;
    },
    // Centre of a control inside the open dictionary sheet's word card (scrolls it into view). Used by the scripted tests.
    lookupHit(id) {
      if (!state.lk || state.lk.view !== 'word') return null;
      const K = getLookup(), vp = K.G.vp, k = state.lk;
      for (const it of K.layout.items) for (const h of it.hits) {
        if (h.id !== id) continue;
        const max = Math.max(0, K.layout.height - vp.h), cy = it.y + h.y + h.h / 2;
        if (cy - k.scroll < 40 || cy - k.scroll > vp.h - 40) k.scroll = Math.max(0, Math.min(max, cy - vp.h / 2));
        return { x: vp.x + h.x + h.w / 2, y: vp.y + cy - k.scroll };
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
