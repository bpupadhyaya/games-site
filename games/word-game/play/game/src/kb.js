// The relations knowledge base at run time: read-only typed arrays compiled by data-build/kb.mjs. Everything is synchronous once a
// shard has been installed; web/platform.js fetches the shards lazily after the first frame. A pack row is a word's position in
// pack.txt (entry.rank); the ids inside relations are lexicon ids (lexicon.wordOf / idOf).
import * as lex from './lexicon.js';

const K = { man: null, rel: {}, cols: null, spell: null, rowIds: null, text: {}, ver: 0, byId: null, phr: null, conf: null, vari: null };
export const version = () => K.ver;
// ---- lazy loading state. platform.js registers the loader; the dictionary sheet awaits ensure() and shows Loading / error + Retry from dataState().
// With no loader (headless tests, the demo) the data is simply "ready" as installed.
let LOADER = null, LP = null, LST = 'ready';
export function setLoader(fn) { if (fn === LOADER) return; LOADER = fn; LP = null; LST = fn ? 'idle' : 'ready'; K.ver++; }
export const dataState = () => (LST === 'idle' ? 'loading' : LST);   // 'ready' | 'loading' | 'error'
export function ensure() {
  if (!LOADER || LST === 'ready') return Promise.resolve(true);
  if (LP) return LP;
  LST = 'loading'; K.ver++;
  LP = new Promise((res) => res(LOADER())).then(() => { LST = 'ready'; K.ver++; return true; }, () => { LST = 'error'; LP = null; K.ver++; return false; });
  return LP;
}
export function installManifest(m) { K.man = m; K.ver++; }
export function installRel(name, buf) {
  const h = new Uint32Array(buf, 0, 2), n = h[0], m = h[1], counts = new Uint8Array(buf, 8, n), pad = (4 - (n % 4)) % 4;
  const off = new Uint32Array(n + 1); for (let i = 0; i < n; i += 1) off[i + 1] = off[i] + counts[i];
  const valStart = 8 + n + pad, vals = new Uint32Array(buf, valStart, m);
  const attrStart = valStart + m * 4, attr = buf.byteLength >= attrStart + m && m > 0 && K.man?.sizes?.[name]?.attr ? new Uint8Array(buf, attrStart, m) : null;
  K.rel[name] = { n, m, off, vals, attr }; K.ver++;
}
export function installBytes(name, buf) {
  if (name === 'cols') K.cols = new Uint8Array(buf); else if (name === 'spell') K.spell = new Uint16Array(buf); else if (name === 'rows') { K.rowIds = new Uint32Array(buf); K.byId = null; }
  K.ver++;
}
export const hasText = (name) => Boolean(K.text[name]);
export const getText = (name) => K.text[name] ?? '';
export function installText(name, text) { K.text[name] = text; K.phr = K.vari = K.plain = null; K.ver++; }
export const has = (name) => Boolean(K.rel[name]);
export const manifest = () => K.man;
export const ready = () => Boolean(K.man && K.rel.syn && K.rel.ant);

// relation list for a row: [{ id, w, attr }]
export function list(name, row) {
  const r = K.rel[name]; if (!r || row < 0 || row >= r.n) return [];
  const out = [];
  for (let i = r.off[row]; i < r.off[row + 1]; i += 1) out.push({ id: r.vals[i], w: name === 'phrase' ? '' : lex.wordOf(r.vals[i]), attr: r.attr ? r.attr[i] : 0 });
  return out;
}
export const words = (name, row) => list(name, row).map((x) => x.w);
export const count = (name, row) => { const r = K.rel[name]; return r && row >= 0 && row < r.n ? r.off[row + 1] - r.off[row] : 0; };
// pack row of a lexicon id / word (only words that are study entries have rows)
export function rowOfWord(w) { const e = lex.entry(w); return e ? e.rank : -1; }
export function rowOfId(id) {
  if (!K.rowIds) return -1;
  if (!K.byId) { K.byId = new Map(); for (let i = 0; i < K.rowIds.length; i += 1) K.byId.set(K.rowIds[i], i); }
  return K.byId.get(id) ?? -1;
}
// typed synonyms: strength 0 same synset, 1 similar cluster, 2 also see; sense 0-2
export function synonyms(row, maxStrength = 0, maxSense = 2) {
  return list('syn', row).map((x) => ({ w: x.w, strength: x.attr & 3, sense: (x.attr >> 2) & 3 })).filter((x) => x.strength <= maxStrength && x.sense <= maxSense);
}
export const ANT_TYPES = ['gradable', 'complementary', 'relational', 'prefix negation'];
export function antonyms(row, directOnly = true) {
  return list('ant', row).map((x) => ({ w: x.w, type: x.attr & 3, sense: (x.attr >> 2) & 3, indirect: Boolean(x.attr & 16) })).filter((x) => !directOnly || !x.indirect);
}
export const related = (row) => new Set([...list('syn', row), ...list('ant', row), ...list('hyper', row), ...list('hypo', row), ...list('fam', row)].map((x) => x.w));
export const col = (row, i) => (K.cols ? K.cols[row * 8 + i] : 0);
export const syllables = (row) => col(row, 0);
export const spellFlags = (row) => (K.spell ? K.spell[row] : 0);
export function phrases(row) { // [{ text, gloss }]
  if (!K.text.phrases) return [];
  if (!K.phr) K.phr = K.text.phrases.split('\n').map((l) => { const t = l.indexOf('\t'); return { text: l.slice(0, t), gloss: l.slice(t + 1) }; });
  return list('phrase', row).map((x) => K.phr[x.id]).filter(Boolean);
}
export function plainGloss(row) {
  if (!K.text.plain || !col(row, 6)) return '';
  if (!K.plain) { K.plain = new Map(); for (const l of K.text.plain.split('\n')) { const t = l.indexOf('\t'); if (t > 0) K.plain.set(Number(l.slice(0, t)), l.slice(t + 1)); } }
  return K.plain.get(row) ?? '';
}
export function confusables() { return K.man?.confusables ?? []; }
export function variants() {
  if (!K.vari && K.text.variants) K.vari = K.text.variants.split('\n').filter(Boolean).map((l) => l.split('\t'));
  return K.vari ?? [];
}
export const parts = (row) => { const m = K.man; if (!m || !K.cols) return null; const p = col(row, 3), s = col(row, 4), r = col(row, 5); return (p || s || r) ? { prefix: p ? m.prefixes[p - 1] : null, suffix: s ? m.suffixes[s - 1] : null, root: r ? m.roots[r - 1] : null } : null; };

// ---- the full thesaurus (data-build/thes.mjs -> data/kb/thes.txt): every sense, every relation WordNet holds for a study word.
// Parsed lazily on first use. thesFor(word) -> { senses: [{ gloss, same, sim1, sim2, also, direct: [{ w, type }], indirect }], der, neg } or null.
let TH = null;
function parseThes(text) {
  const t = { syn: [], idx: new Map() }; if (!text || !text.startsWith('#THES1')) return t;
  const nl = text.indexOf('\n'), cut = text.indexOf('\n#W\n'); if (cut < 0) return t;
  const ids = (s) => (s ? s.split(' ').map((x) => parseInt(x, 36)) : []);
  for (const ln of text.slice(nl + 1, cut).split('\n')) { const f = ln.split('\t'); t.syn.push({ pos: f[0] ? f[0][0] : '', gloss: f[0] ? f[0].slice(1) : '', lem: f[1] ? f[1].split(' ') : [], sim1: ids(f[2]), sim2: ids(f[3]), also: ids(f[4]) }); }
  for (const ln of text.slice(cut + 5).split('\n')) { if (!ln) continue; const f = ln.split('\t'); t.idx.set(f[0], f); }
  return t;
}
export const thesReady = () => Boolean(K.text.thes);
export function thesFor(w) {
  if (!K.text.thes) return null;
  if (!TH || TH.src !== K.text.thes) { TH = parseThes(K.text.thes); TH.src = K.text.thes; }
  const f = TH.idx.get(w); if (!f) return { senses: [], der: [], neg: [] };
  const lem = (ids) => ids.flatMap((i) => TH.syn[i]?.lem ?? []);
  const senses = (f[1] ? f[1].split(';') : []).map((it) => {
    const m = it.match(/^([0-9a-z]+)(?:!([^?]*))?(?:\?(.*))?$/); const rec = TH.syn[parseInt(m[1], 36)];
    return { pos: rec.pos, gloss: rec.gloss, same: rec.lem.filter((x) => x !== w), sim1: lem(rec.sim1), sim2: lem(rec.sim2), also: lem(rec.also), direct: m[2] ? m[2].split(',').map((x) => { const d = x.lastIndexOf('.'); return { w: x.slice(0, d), type: Number(x.slice(d + 1)) }; }) : [], indirect: m[3] ? m[3].split(',') : [] };
  });
  return { senses, der: f[2] ? f[2].split(' ') : [], neg: f[3] ? f[3].split(' ') : [] };
}

// ---- "More ways to say it" (data-build/extra-syn.mjs -> data/kb/thesmore.txt): Roget 1911 and Moby Thesaurus words that WordNet does not list.
// Lazy, optional. thesMoreFor(word) -> { roget: [words], moby: [words] } (empty lists when the file is missing or the word has none).
let TM = null;
function parseMore(text) {
  const t = { tab: [], idx: new Map() }; if (!text || !text.startsWith('#MORE1')) return t;
  const a = text.indexOf('\n#T\n'), b = text.indexOf('\n#L\n'); if (a < 0 || b < 0) return t;
  t.tab = text.slice(a + 4, b).split(' ');
  for (const ln of text.slice(b + 4).split('\n')) { if (ln) { const f = ln.split('\t'); t.idx.set(f[0], f); } }
  return t;
}
export const thesMoreReady = () => Boolean(K.text.thesmore);
export function thesMoreFor(w) {
  const none = { roget: [], moby: [] }; if (!K.text.thesmore) return none;
  if (!TM || TM.src !== K.text.thesmore) { TM = parseMore(K.text.thesmore); TM.src = K.text.thesmore; TM.pos = new Map(TM.tab.map((x, i) => [x, i])); }
  const i = TM.pos.get(w); if (i === undefined) return none;
  const f = TM.idx.get(i.toString(36).padStart(3, '0')); if (!f) return none;
  const dec = (s) => (s ? (s.match(/.{3}/g) ?? []).map((x) => TM.tab[parseInt(x, 36)]).filter(Boolean) : []);
  return { roget: dec(f[1]), moby: dec(f[2]) };
}
