// The word data: a validation lexicon (is this a real English word?) and the study/quiz pack (meaning, synonyms, antonyms, level).
// Pure and synchronous. The files are fetched by web/main.js after the first frame and handed over with install*(); until then
// (and in headless tests) a small built-in pack made from the original word notebook is used, so the game always plays.
import { WORDS } from './words.js';

export const BANDS = ['elementary', 'middle', 'high', 'undergraduate', 'graduate', 'professional'];
export const BAND_LABELS = ['Elementary', 'Middle school', 'High school', 'Undergraduate', 'Graduate', 'Professional'];
export const ATTR = { HF: 1, SCI: 2, ACAD: 4, EVD: 8, LRN: 16, KID: 32, CLASSIC: 64, FIRST: 128 };
export const ATTR_LIST = [
  { k: 'HF', label: 'High frequency', bit: 1 }, { k: 'SCI', label: 'Scientific', bit: 2 }, { k: 'ACAD', label: 'Academic', bit: 4 },
  { k: 'EVD', label: 'Everyday', bit: 8 }, { k: 'LRN', label: 'English learner', bit: 16 }, { k: 'CLASSIC', label: 'Original notebook', bit: 64 },
];
// WordNet lexicographer file number -> topic pack
export const TOPICS = [
  { k: 'animals', label: 'Animals', lex: [5] }, { k: 'plants', label: 'Plants', lex: [20] }, { k: 'body', label: 'Body and health', lex: [8, 29] },
  { k: 'food', label: 'Food', lex: [13, 34] }, { k: 'feelings', label: 'Feelings', lex: [12, 37] }, { k: 'people', label: 'People', lex: [18] },
  { k: 'places', label: 'Places', lex: [15] }, { k: 'time', label: 'Time', lex: [28] }, { k: 'things', label: 'Things people make', lex: [6] },
  { k: 'nature', label: 'Nature and matter', lex: [17, 19, 27, 43] }, { k: 'mind', label: 'Thinking and words', lex: [9, 10, 31, 32] },
  { k: 'action', label: 'Action and movement', lex: [4, 33, 35, 36, 38] },
];
const TOPIC_OF = new Map(); for (const t of TOPICS) for (const n of t.lex) TOPIC_OF.set(n, t.k);
export const topicOf = (lex) => TOPIC_OF.get(lex) ?? '';

// ---- subject and topic packs (web/data/kb/packs.json, built from WordNet by data-build/topics.mjs). A pack id in cfg.topics is written 'pk:<id>'.
const PK = { list: [], sets: new Map(), compounds: [] };
export function installPacks(json) {
  PK.list = (json?.packs ?? []).filter((p) => p && p.id && Array.isArray(p.words)).map((p) => ({ id: p.id, group: p.g, name: p.name, words: p.words }));
  PK.sets = new Map(PK.list.map((p) => [p.id, new Set(p.words)]));
  PK.compounds = Array.isArray(json?.compounds) ? json.compounds : [];
  S.version++; S.cache = new Map();
}
export const packList = (group) => (group ? PK.list.filter((p) => p.group === group) : PK.list);
export const packById = (id) => PK.list.find((p) => p.id === id);
export const compoundList = () => PK.compounds;
export const PACK_GROUPS = [{ k: 'topic', label: 'Topic packs' }, { k: 'subject', label: 'School subjects' }, { k: 'track', label: 'Word tracks' }];

const S = { kid: false, custom: new Map(), arr: [], entries: [], by: new Map(), valid: null, pack: false, full: false, version: 0, cache: new Map(), pools: null };
const POS_NAME = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
export const posName = (p) => POS_NAME[p] ?? '';

const list = (s) => (s ? s.split(',') : []);
function addEntry(e) { e.rank = S.entries.length; e.len = e.w.length; S.entries.push(e); S.by.set(e.w, e); }

// ---- the full pack: web/data/pack.txt (first line "#WGP1<TAB>count", then one TAB-separated row per word)
export function installPack(text) {
  S.entries = []; S.by = new Map(); S.cache = new Map(); S.pools = null;
  const rows = text.split('\n');
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const f = r.split('\t');
    addEntry({ w: f[0], pos: f[1][0], band: Number(f[1][1]), attrs: parseInt(f[1].slice(2), 36), lex: Number(f[2]), gloss: f[3] || '', gloss2: f[4] || '', ex: f[5] || '', syn: list(f[6]), ant: list(f[7]) });
  }
  S.pack = true; S.full = true; S.version++;
  return S.entries.length;
}
// ---- authored word text (web/data/kb/wordtext.txt): row \t example \t plain meaning \t memory hook. The example replaces the WordNet one
// (it is written for, and checked against, the study meaning). Rows without text keep what they had.
export function applyWordText(text) {
  let n = 0;
  for (const ln of text.split('\n')) {
    if (!ln) continue;
    const f = ln.split('\t'), e = S.entries[Number(f[0])]; if (!e) continue;
    if (f[1]) e.ex = f[1]; if (f[2]) e.plain = f[2]; if (f[3]) e.mn = f[3]; n += 1;
  }
  S.version++;
  return n;
}
// ---- the validation lexicon: web/data/lex.fc, front coded (one hex digit = shared prefix length, then the rest of the word)
export function installLexicon(text) {
  const set = new Set(), arr = []; let prev = '';
  for (const ln of text.split('\n')) { if (!ln) continue; const w = prev.slice(0, parseInt(ln[0], 16)) + ln.slice(1); set.add(w); arr.push(w); prev = w; }
  S.valid = set; S.arr = arr; S.version++;
  return set.size;
}
// ---- built-in fallback: the original notebook rows (graduate band), used until the data files have loaded
export function installFallback() {
  S.entries = []; S.by = new Map(); S.cache = new Map(); S.pools = null;
  for (const r of WORDS) addEntry({ w: r[0], pos: 'a', band: 4, attrs: ATTR.CLASSIC | ATTR.ACAD, lex: 0, gloss: r[5], gloss2: '', ex: '', syn: r[1] ? [r[1]] : [], ant: r[2] ? [r[2]] : [], extraDistractors: [r[3], r[4]] });
  S.pack = false; S.full = false; S.version++;
}
installFallback();

let CREDITS = '';
export const setCredits = (t) => { CREDITS = t; S.version++; };
export const credits = () => CREDITS;
// word id = position in the sorted validation lexicon (the relation packs refer to words by these ids)
export const wordOf = (id) => S.arr[id];
export const idOf = (w) => { let lo = 0, hi = S.arr.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1, v = S.arr[m]; if (v === w) return m; if (v < w) lo = m + 1; else hi = m - 1; } return -1; };
export const isFull = () => S.full;
// kid-safe mode: wrong answers, journey words and every pool only use words flagged KID (set by game.js from the adaptive plan)
export function setKidMode(on) { on = Boolean(on); if (S.kid !== on) { S.kid = on; S.pools = null; S.version++; } }
export const kidMode = () => S.kid && S.full;
export const kidOk = (e) => !kidMode() || Boolean(e.attrs & ATTR.KID) || Boolean(e.custom);
export const lexiconReady = () => !!S.valid;
export const version = () => S.version;
export const isWord = (w) => (S.valid ? S.valid.has(w) : S.by.has(w));
export const entry = (w) => S.by.get(w) ?? S.custom.get(w);
// the player's own word lists: words that are not study entries still get a meaning (and a level) so the quizzes can use them
export function setCustom(lists) {
  const had = S.custom.size; S.custom = new Map();
  for (const L of lists) for (const w of L.words) if (!S.by.has(w)) S.custom.set(w, { w, pos: 'n', band: 3, attrs: 0, lex: 0, gloss: L.defs?.[w] ?? '', gloss2: '', ex: '', syn: [], ant: [], rank: undefined, len: w.length, custom: true });
  if (had || S.custom.size) S.version++;
}
export const all = () => S.entries;
export const size = () => S.entries.length;

// ---- selecting the words a player asked for -------------------------------------------------------------------------
// cfg: { contexts:[0..5 | 'first'], attrs:['HF',...], topics:['animals',...], combine:'any'|'narrow', minLen, maxLen, kid }
export function sigOf(cfg) { return JSON.stringify([cfg.contexts, cfg.attrs, cfg.topics, cfg.combine, cfg.minLen, cfg.maxLen, cfg.kid ? 1 : 0, cfg.pos ?? [], S.version]); }
export function select(cfg) {
  if (!S.full) return S.entries;                      // built-in notebook list only: no levels to filter by yet
  const key = sigOf(cfg), hit = S.cache.get(key); if (hit) return hit;
  const ctx = (cfg.contexts ?? []), at = (cfg.attrs ?? []).map((k) => ATTR[k]).filter(Boolean), allTp = cfg.topics ?? [], tp = new Set(allTp.filter((t) => !t.startsWith('pk:')));
  const pk = allTp.filter((t) => t.startsWith('pk:') && PK.sets.has(t.slice(3))).map((t) => PK.sets.get(t.slice(3))), posSet = new Set(cfg.pos ?? []);
  const inCtx = (e) => ctx.some((c) => (c === 'first' ? (e.attrs & ATTR.FIRST) !== 0 : e.band === c));
  const inAttr = (e) => at.some((b) => (e.attrs & b) !== 0);
  const inTopic = (e) => tp.has(topicOf(e.lex));
  const none = !ctx.length && !at.length && !tp.size && !pk.length;
  const out = [];
  for (const e of S.entries) {
    if (e.len < (cfg.minLen ?? 3) || e.len > (cfg.maxLen ?? 15)) continue;
    if (cfg.kid && !(e.attrs & ATTR.KID) && S.full) continue;
    if (posSet.size && !posSet.has(e.pos)) continue;                                                            // part of speech filter (J2)
    if (pk.length && !(pk.some((st) => st.has(e.w)) && (!ctx.length || inCtx(e)))) continue;                     // a pack always stays inside the player's level window
    let ok;
    if (none) ok = true;
    else if (cfg.combine === 'narrow') ok = (!ctx.length || inCtx(e)) && at.every((b) => (e.attrs & b) !== 0) && (!tp.size || inTopic(e));
    else ok = (ctx.length && inCtx(e)) || (at.length && inAttr(e)) || (tp.size && inTopic(e));
    if (ok) out.push(e);
  }
  S.cache.set(key, out); if (S.cache.size > 30) S.cache.delete(S.cache.keys().next().value);
  return out;
}

// ---- distractor pool: words of a similar level and the same part of speech but a different meaning area
function pools() {
  if (S.pools) return S.pools;
  const p = {}; for (const e of S.entries) { if (!kidOk(e)) continue; const k = `${e.band}${e.pos}`; (p[k] ??= []).push(e); }
  S.pools = p; return p;
}
export function distractors(e, n, rng, avoid) {
  const out = [], P = pools(); const bands = [e.band, e.band - 1, e.band + 1].filter((b) => b >= 0 && b <= 5);
  let guard = 0;
  while (out.length < n && guard++ < 60) {
    const pool = P[`${rng.pick([bands[0], bands[0], ...bands.slice(1)])}${e.pos}`] ?? S.entries.filter(kidOk); if (!pool.length) break;
    const d = pool[rng.int(pool.length)];
    if (d === e || out.includes(d) || avoid.has(d.w) || d.lex === e.lex || e.syn.includes(d.w) || e.ant.includes(d.w) || d.syn.includes(e.w) || d.ant.includes(e.w)) continue;
    if (S.full === false && !d.syn.length) continue;
    out.push(d);
  }
  return out.map((d) => d.w);
}
// notebook rows carry their own hand-picked distractors (fallback mode)
export const extraDistractors = (e) => e.extraDistractors ?? null;
