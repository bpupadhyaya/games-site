// The relations knowledge base at run time: read-only typed arrays compiled by data-build/kb.mjs. Everything is synchronous once a
// shard has been installed; web/platform.js fetches the shards lazily after the first frame. A pack row is a word's position in
// pack.txt (entry.rank); the ids inside relations are lexicon ids (lexicon.wordOf / idOf).
import * as lex from './lexicon.js';

const K = { man: null, rel: {}, cols: null, spell: null, rowIds: null, text: {}, ver: 0, byId: null, phr: null, conf: null, vari: null };
export const version = () => K.ver;
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
