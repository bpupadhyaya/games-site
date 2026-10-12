// The offline dictionary: turn what the player typed into a word card (meaning, sound, examples, relatives, level). Pure and deterministic.
// Used by the sheet in lookupui.js and by game.js (lookupWord). Everything here reads the word data that is already in the app
// (WordNet meanings, the relations packs, the pronunciation counts); nothing is fetched and nothing is spoken.
import * as lex from './lexicon.js';
import { BAND_LABELS } from './lexicon.js';
import * as kb from './kb.js';
import { resolveWord, normalise } from './findword.js';
import { breaksOf, tierOf, tierLine, familyOf } from './study.js';
import { CEFR } from './screens.js';
import { ONLINE_MEANING, ONLINE_THES } from './dict.js';
import { originFor } from './origins.js';

export const MAX_RECENT = 8;
const usableEntry = (e) => Boolean(e && e.rank !== undefined && lex.kidOk(e));
const has = (w) => usableEntry(lex.entry(w));

// -> { typed, w, from, kind: 'exact'|'form'|'none', status: 'ok'|'nomeaning'|'unknown'|'kid'|'empty' }
export function resolve(raw, kid = false) {
  const typed = normalise(raw), r = resolveWord(raw, has);
  if (!r.w) return { typed: '', w: '', from: '', kind: 'none', status: 'empty' };
  if (r.kind !== 'none') return { typed, w: r.w, from: r.from, kind: r.kind, status: 'ok' };
  if (kid || lex.kidMode()) return { typed, w: r.w, from: '', kind: 'none', status: 'kid' };
  return { typed, w: r.w, from: '', kind: 'none', status: lex.isWord(r.w) ? 'nomeaning' : 'unknown' };
}

// Words that start with what has been typed, most common first (the pack is in frequency order); the exact word comes first.
export function suggest(raw, n = 6) {
  const p = normalise(raw); if (!p) return [];
  const out = [], ex = lex.entry(p);
  if (usableEntry(ex)) out.push(p);
  for (const e of lex.all()) {
    if (out.length >= n) break;
    if (e.w !== p && e.rank !== undefined && e.w.startsWith(p) && lex.kidOk(e)) out.push(e.w);
  }
  return out;
}
// "Did you mean": the longest start of the typed word that has some words under it
export function didYouMean(raw, n = 6) {
  const p = normalise(raw);
  for (let k = p.length; k >= 2; k -= 1) { const s = suggest(p.slice(0, k), n); if (s.length) return s; }
  return [];
}

const uniq = (a) => [...new Set(a)];
const chips = (rows, id, label, list, w, max = 12) => {
  const l = uniq(list).filter((x) => x && x !== w && has(x)).slice(0, max);
  if (l.length) rows.push({ k: 'chips', id, label, opts: l.map((x) => ({ v: x, label: x, on: false })) });
};

// While the lazy word-data shards (kb.ensure) are still loading, the sheet says so; if they failed it says so and offers Retry. Never "0 / none recorded".
const pendingNote = (st) => (st === 'error'
  ? [{ k: 'p', t: 'The word data could not be loaded.' }, { k: 'btn', id: 'dretry', label: 'Retry' }]
  : [{ k: 'p', t: 'Loading…' }]);

// The rows of a word card, in the form language of forms.js. o: { note, canSpeak, lookupOn, inList }
export function cardRows(e, o = {}) {
  const rows = [], row = e.rank, kbOk = kb.ready() && row !== undefined;
  if (o.note) rows.push({ k: 'p', t: o.note, small: true });
  if (o.wander) rows.push({ k: 'p', t: 'A surprise word, related to the one before. Add it to My words if you like it.', small: true });
  if (o.fresh) rows.push({ k: 'p', t: '✓ New word explored', small: true });
  const meta = [lex.posName(e.pos), row !== undefined && e.band >= 0 ? `${BAND_LABELS[e.band]} level` : ''].filter(Boolean);
  if (meta.length) rows.push({ k: 'p', t: meta.join('  ·  '), small: true });
  if (kb.dataState() !== 'ready') rows.push({ k: 'sub', t: 'More word data' }, ...pendingNote(kb.dataState()));
  // how to say it
  const b = breaksOf(e);
  rows.push({ k: 'sub', t: 'How to say it' });
  if (b && b.parts && b.count > 1) rows.push({ k: 'p', t: `Sounds like: ${b.parts.map((p, i) => (i + 1 === b.stress ? p.toUpperCase() : p)).join('-')}` }, { k: 'p', t: `${b.count} syllables; the loudest part is in capitals. The breaks are a guess from the spelling.`, small: true });
  else if (b && b.count === 1) rows.push({ k: 'p', t: 'Sounds like: one beat, said in one go.' });
  else if (b) rows.push({ k: 'p', t: `${b.count} syllables${b.stress ? `, loudest part is number ${b.stress}` : ''}.` });
  rows.push({ k: 'p', t: o.canSpeak ? 'Tap the speaker to hear it.' : 'This device has no voice, so the speaker is off.', small: true });
  // meanings
  rows.push({ k: 'sub', t: 'Meaning' }, { k: 'p', t: e.gloss || '(meaning not available)' });
  const plain = e.plain || (kbOk && kb.plainGloss(row)) || '';
  if (plain) rows.push({ k: 'p', t: `In plain words: ${plain}`, small: true });
  if (e.gloss2) rows.push({ k: 'p', t: `Another meaning: ${e.gloss2}`, small: true });
  if (e.ex) {
    rows.push({ k: 'sub', t: 'Example' }, { k: 'p', t: `“${e.ex}”` });
    const exw = exampleWords(e); if (exw.length) rows.push({ k: 'chips', id: 'dw', label: 'Words in the example (tap to look up)', opts: exw.map((x) => ({ v: x, label: x, on: false })) });
  }
  if (e.mn) rows.push({ k: 'p', t: `Memory hook: ${e.mn}`, small: true });
  // relatives (tap one to look it up in this sheet)
  chips(rows, 'dw', 'Same meaning (tap to look up)', [...e.syn, ...(kbOk ? kb.synonyms(row, 0, 1).map((x) => x.w) : [])], e.w);
  chips(rows, 'dw', 'Opposite (tap to look up)', [...e.ant, ...(kbOk ? kb.antonyms(row, true).map((x) => x.w) : [])], e.w);
  if (kbOk) {
    chips(rows, 'dw', 'Word family', [...familyOf(e, 12), ...kb.words('fam', row)], e.w);
    chips(rows, 'dw', 'A kind of', kb.words('hyper', row), e.w, 6);
    chips(rows, 'dw', 'Kinds of it', kb.words('hypo', row), e.w, 8);
    chips(rows, 'dw', 'Sounds the same as', kb.words('homo', row), e.w, 6);
    const gw = kb.list('col', row).map((x) => (x.attr === 1 ? `${e.w} ${x.w}` : `${x.w} ${e.w}`)).slice(0, 6);
    if (gw.length) rows.push({ k: 'p', t: `Goes with: ${gw.join(', ')}`, small: true });
    const ph = kb.phrases(row).slice(0, 4);
    if (ph.length) rows.push({ k: 'sub', t: 'Phrases' }, ...ph.map((p) => ({ k: 'p', t: p.gloss ? `${p.text}: ${p.gloss}` : p.text, small: true })));
    const pt = kb.parts(row);
    if (pt) rows.push({ k: 'p', t: `Word parts: ${[pt.prefix && `${pt.prefix[0]}- (${pt.prefix[1]})`, pt.root && `${pt.root[0]} (${pt.root[1]})`, pt.suffix && `-${pt.suffix[0]} (${pt.suffix[1]})`].filter(Boolean).join(' + ')} (a guess from the spelling)`, small: true });
    const sp = kb.spellFlags(row), names = kb.manifest()?.spelling ?? [], sn = names.filter((_, i) => sp & (1 << i));
    if (sn.length) rows.push({ k: 'p', t: `Spelling notes: ${sn.join(', ')}`, small: true });
    const vr = kb.variants().find((v) => v[0] === e.w); if (vr) rows.push({ k: 'p', t: `British spelling: ${vr[1]}`, small: true });
    const conf = kb.confusables().find((p) => p[0] === e.w || p[1] === e.w); if (conf) rows.push({ k: 'p', t: `Easily confused: ${conf[0]} (${conf[2]}) and ${conf[1]} (${conf[3]})`, small: true });
  } else if (row !== undefined) rows.push({ k: 'p', t: 'More about this word (family, opposites, phrases) appears when the relations pack has loaded.', small: true });
  const og = originFor(e.w);
  if (og) rows.push({ k: 'sub', t: 'Where it comes from' }, { k: 'p', t: og });
  // level
  if (row !== undefined && e.band >= 0) rows.push({ k: 'rule' }, { k: 'kv', l: 'Level', r: `${BAND_LABELS[e.band]} (about ${CEFR[e.band]})` }, { k: 'kv', l: 'Kind of word', r: tierLine(e) }, { k: 'p', t: `${tierOf(e).blurb}.`, small: true });
  rows.push({ k: 'rule' }, { k: 'btn2', a: { id: 'dadd', label: o.inList ? 'In my words (remove)' : 'Add to my words', style: o.inList ? undefined : 'primary' }, b: { id: 'dexplore', label: 'Word explorer' } });
  rows.push(...keepExploring(o));
  if (o.lookupOn) rows.push({ k: 'chips', id: 'donline', label: 'Want more? Check an online dictionary', opts: [{ v: e.w, label: 'Open online dictionary', on: false }] });
  if (o.lookupOn) rows.push(onlineRow('meaning'));
  rows.push({ k: 'p', t: 'This dictionary works offline and covers every word it has a meaning for, whatever your learning level. It has no phonetic (IPA) spelling or recorded voices, and origin notes only for the words where the origin is well established.', small: true });
  return rows;
}

// Small "More online" buttons (adults only): free online dictionaries on the Meaning tab, free online thesauruses on the Thesaurus tab
export const onlineRow = (tab) => ({ k: 'chips', id: 'mo', label: tab === 'thes' ? 'More online: thesauruses (needs a connection)' : 'More online: dictionaries (needs a connection)', opts: (tab === 'thes' ? ONLINE_THES : ONLINE_MEANING).map((d) => ({ v: d.k, label: d.label, on: false })) });


// ---------------------------------------------------------------- "Keep exploring": one lookup leads into play, play leads back to lookup
// Tappable words in an example sentence: content words that have an entry in this app (never the word itself).
const STOP = new Set(['that', 'this', 'with', 'from', 'have', 'were', 'they', 'them', 'then', 'than', 'what', 'when', 'where', 'there', 'their', 'will', 'would', 'could', 'should', 'your', 'about', 'into', 'been', 'being', 'some', 'more', 'most', 'very', 'just', 'also']);
export function exampleWords(e, max = 6) {
  const out = [];
  for (const raw of String(e.ex ?? '').toLowerCase().split(/[^a-z']+/)) {
    const x = raw.replace(/^'+|'+$/g, '');
    if (x.length < 4 || x === e.w || STOP.has(x) || out.includes(x)) continue;
    const r = resolveWord(x, has); const w = r.w && r.kind !== 'none' ? r.w : '';
    if (w && w !== e.w && !out.includes(w)) out.push(w);
    if (out.length >= max) break;
  }
  return out;
}
// The round starters, in the order shown. 'usage' = use it in a sentence.
export const PLAY_KINDS = [['synonym', 'Synonyms'], ['antonym', 'Opposites'], ['spelling', 'Spell it'], ['definition', 'Meaning quiz'], ['usage', 'In a sentence']];
// Words that are linked to this one (same meaning, opposite, nearby ideas), all with entries here. Closest first.
export function linkedWords(e, max = 12) {
  const d = thesData(e), out = [];
  for (const x of [...d.synAll, ...d.antAll, ...d.nearest, ...d.more.roget, ...d.more.moby]) if (x !== e.w && !out.includes(x)) out.push(x);
  return out.slice(0, max);
}
// o: { playKinds: [kind ids that can be asked right now], trail: [words followed this session], trailInList }
export const listPickRows = (w, lists) => [{ k: 'h', t: `Add “${w}” to a list` }, { k: 'p', t: 'Pick a list, or make a new one for a purpose.', small: true },
  ...lists.map((l) => ({ k: 'btn', id: `dlistadd:${l.id}`, label: `${l.name} (${l.words.length})`, sub: l.words.includes(w) ? 'already in this list' : undefined, disabled: l.words.includes(w) })),
  { k: 'btn', id: 'dlistnew', label: 'New list', style: 'primary' }, { k: 'btn', id: 'dcancel', label: 'Cancel' }];
export function keepExploring(o = {}) {
  const rows = [{ k: 'rule' }, o.target ? { k: 'btn', id: `dlistadd:${o.target.id}`, label: `Add to “${o.target.name}”`, style: 'primary', disabled: Boolean(o.target.has) } : { k: 'btn', id: 'dlist', label: 'Add to a list' }, { k: 'sub', t: 'Keep exploring' }];
  const kinds = PLAY_KINDS.filter(([k]) => (o.playKinds ?? []).includes(k));
  if (kinds.length) rows.push({ k: 'chips', id: 'dplay', label: 'Play a short round with this word and its linked words', opts: kinds.map(([k, l]) => ({ v: k, label: l, on: false })) });
  rows.push({ k: 'btn', id: 'dwander', label: 'Surprise me: a related word' });
  const tr = o.trail ?? [];
  if (tr.length >= 2) {
    rows.push({ k: 'chips', id: 'dw', label: `Your trail (${tr.length} words)`, opts: tr.slice(-12).map((x) => ({ v: x, label: x, on: false })) });
    rows.push({ k: 'btn2', a: { id: 'dtrailsave', label: o.trailSaved ? 'Trail is in My words' : 'Save trail to My words', disabled: Boolean(o.trailSaved) }, b: { id: 'dtrailplay', label: 'Play this trail' } });
  }
  return rows;
}

// A word with no card: not in the children's list, a real word without a built-in meaning, or not found
export function noCardRows(r, o = {}) {
  const rows = [];
  if (r.status === 'kid') rows.push({ k: 'h', t: r.typed }, { k: 'p', t: 'That word is not in the children’s list. Ask a grown-up to look it up with you.' });
  else if (r.status === 'nomeaning') rows.push({ k: 'h', t: r.typed }, { k: 'p', t: `“${r.typed}” is a real English word, but this offline dictionary has no meaning written for it.` });
  else rows.push({ k: 'h', t: r.typed }, { k: 'p', t: `“${r.typed}” was not found in this dictionary. Check the spelling.` });
  if (r.status !== 'kid') {
    const dm = didYouMean(r.typed);
    if (dm.length) rows.push({ k: 'chips', id: 'dw', label: 'Did you mean', opts: dm.map((x) => ({ v: x, label: x, on: false })) });
    if (o.lookupOn) rows.push({ k: 'p', t: 'You can look for it in an online dictionary instead.', small: true }, { k: 'chips', id: 'donline', label: '', opts: [{ v: r.w, label: 'Open online dictionary', on: false }] });
    else rows.push({ k: 'p', t: 'Online dictionaries are switched off. They can be turned on in Settings (not in a child profile).', small: true });
  }
  return rows;
}

// The warning before an online dictionary opens (same words as the Look it up screen)
export function confirmRows(w, label) {
  return [
    { k: 'h', t: `Look up “${w}” online?` },
    { k: 'p', t: `This opens a free website about the word in a panel inside this app, and only the word is sent. A button there can open ${label} or other sites in your phone’s browser, which leaves this app.` },
    { k: 'p', t: 'Warning: that website is not part of this app and is not checked by us. It can show adult or offensive words, pictures or advertising. The words in this app are chosen to be suitable for learners; a dictionary website may not be.', small: true },
    { k: 'btn', id: 'dopen', label: 'Open it', style: 'primary' },
    { k: 'btn', id: 'dalways', label: 'Open it, and do not ask again' },
    { k: 'btn', id: 'dcancel', label: 'Cancel' },
  ];
}

// ---------------------------------------------------------------- the offline thesaurus (same sheet, "Thesaurus" tab)
// Reads only relations that are already in the app: synonym strength and meaning number (kb syn), typed antonyms (kb ant), broader and narrower
// words (hyper/hypo), family, part-of, partner words and phrases, plus each word's register and level. Nothing is invented: a group is shown
// only when the data has entries for it.
export const SYN_TIERS = [
  { label: 'Closest: same meaning', bar: '■■■' },
  { label: 'Close: similar meaning', bar: '■■□' },
  { label: 'Looser: related, see also', bar: '■□□' },
];
export const ANT_LABELS = ['Opposite ends of a scale', 'Either one or the other', 'Two sides of a relationship', 'Made with a prefix (un-, in-, non-)'];
const REG_NAMES = ['informal', 'slang', 'formal', 'literary', 'old-fashioned', 'regional', 'offensive'];
const regOf = (w) => { const row = kb.rowOfWord(w); const m = row >= 0 && kb.ready() ? kb.col(row, 2) : 0; return REG_NAMES.filter((_, i) => m & (1 << i)); };
const rankOf = (w) => lex.entry(w)?.rank ?? 1e9;
const byCommon = (a, b) => rankOf(a) - rankOf(b);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);
const thesChip = (rows, label, list, max, tag = true) => {
  const l = uniq(list).filter((x) => x && has(x)).slice(0, max);
  if (!l.length) return 0;
  rows.push({ k: 'chips', id: 'dw', label, opts: l.map((x) => { const r = tag ? regOf(x).filter((t) => t !== 'offensive').slice(0, 1) : []; return { v: x, label: r.length ? `${x} (${r[0]})` : x, on: false }; }) });
  return l.length;
};

// What the thesaurus knows about a word. Pure. Reads the full WordNet relations (kb.thesFor: every sense, same-synset lemmas, similar-to clusters,
// also-see, derived forms, typed antonyms, indirect antonyms, prefix negations) and adds anything the hot packs hold that it does not.
// -> { senses: [{ n, gloss, syn: [same, similar, looser, see-also], ant: [scale, either-or, relationship, extended, prefix] }], der, synAll, antAll, nearest, full }
// A word is listed once (in its closest sense); words that are not study entries (or not kid-safe in a child profile) are dropped.
export const SYN_GROUPS = ['Same meaning', 'Similar meaning', 'Looser: related meaning', 'See also'];
export const ANT_GROUPS = ['Opposite ends of a scale', 'Either one or the other', 'Two sides of a relationship', 'Opposite by extension (through a similar word)', 'Made with a prefix (un-, in-, non-)'];
const MORE_DROP = ['old-fashioned', 'regional', 'offensive'];
const POSW = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
export function thesData(e) {
  const row = e.rank, ok = kb.ready() && row !== undefined, full = kb.thesFor(e.w), seen = new Set([e.w]);
  const take = (list) => { const out = []; for (const x of list ?? []) if (x && !seen.has(x) && has(x)) { seen.add(x); out.push(x); } return out.sort(byCommon); };
  const senses = [];
  if (full) {
    const ord = [...full.senses].sort((a, b) => (b.pos === e.pos) - (a.pos === e.pos));   // the word's own part of speech first, otherwise most common meaning first
    ord.forEach((s, i) => {
      const g = { n: i + 1, pos: s.pos, gloss: s.pos !== e.pos ? `(${POSW[s.pos] ?? ''}) ${s.gloss}` : s.gloss, syn: [take(s.same), take(s.sim1), take(s.sim2), take(s.also)], ant: [[], [], [], [], []] };
      for (const d of s.direct) if (!seen.has(d.w) && has(d.w)) { seen.add(d.w); g.ant[Math.min(2, d.type)].push(d.w); }
      g.ant[3] = take(s.indirect); g.ant.forEach((t) => t.sort(byCommon));
      senses.push(g);
    });
  }
  // anything in the hot packs or the entry's own lists that the full data did not have
  const extraSyn = [...(ok ? kb.synonyms(row, 2, 3).map((x) => [x.w, x.strength]) : []), ...(e.syn ?? []).map((x) => [x, 0])];
  const extraAnt = [...(ok ? kb.antonyms(row, false).map((x) => [x.w, x.indirect ? 3 : x.type]) : []), ...(e.ant ?? []).map((x) => [x, 0])];
  if (extraSyn.some(([x]) => !seen.has(x) && has(x)) || extraAnt.some(([x]) => !seen.has(x) && has(x)) || !senses.length) {
    const g = senses[0] ?? (senses.push({ n: 1, gloss: e.gloss ? clip(e.gloss, 54) : '', syn: [[], [], [], []], ant: [[], [], [], [], []] }), senses[0]);
    for (const [x, t] of extraSyn) if (!seen.has(x) && has(x)) { seen.add(x); g.syn[Math.min(2, t)].push(x); }
    for (const [x, t] of extraAnt) if (!seen.has(x) && has(x)) { seen.add(x); g.ant[Math.min(3, t)].push(x); }
    g.syn.forEach((t) => t.sort(byCommon)); g.ant.forEach((t) => t.sort(byCommon));
  }
  // prefix negations: from the full data and from the antonym pack's own type 3
  const negList = take([...(full?.neg ?? [])]);
  const keep = senses.filter((g) => g.syn.flat().length || g.ant.flat().length);
  const prefixOnly = negList.filter((x) => !keep.some((g) => g.ant.flat().includes(x)));
  if (prefixOnly.length) { if (!keep.length) keep.push({ n: 1, gloss: '', syn: [[], [], [], []], ant: [[], [], [], [], []] }); keep[0].ant[4] = [...keep[0].ant[4], ...prefixOnly]; }
  // the prefix group collects type-3 antonyms too (one place, labelled)
  for (const g of keep) { const pre = g.ant.slice(0, 4).flat().filter((x) => isPrefixNeg(e.w, x)); if (pre.length) { for (let i = 0; i < 4; i += 1) g.ant[i] = g.ant[i].filter((x) => !pre.includes(x)); g.ant[4] = [...new Set([...g.ant[4], ...pre])]; } }
  const der = take(full?.der);
  const synAll = uniq([...keep.flatMap((g) => g.syn.flat()), ...der]), antAll = uniq(keep.flatMap((g) => g.ant.flat()));
  const near = [];
  if (kbOkRow(e)) {
    const r = e.rank; near.push(...kb.words('hyper', r), ...kb.words('hypo', r), ...kb.words('fam', r), ...kb.words('holo', r), ...kb.words('mero', r));
    for (const h of kb.words('hyper', r).slice(0, 2)) { const hr = kb.rowOfWord(h); if (hr >= 0) near.push(...kb.words('hypo', hr)); }
  }
  const nearest = uniq(near).filter((x) => x !== e.w && has(x) && !synAll.includes(x) && !antAll.includes(x)).slice(0, 12);
  // "More ways to say it": public-domain Roget (1911) and Moby words that the WordNet groups above do not hold. Own group, never mixed into them.
  // Archaic, regional and offensive-tagged words are dropped; has() already limits child profiles to kid-safe study entries.
  const mRaw = kb.thesMoreFor(e.w), shown = new Set([e.w, ...synAll, ...antAll]);
  const pickMore = (list) => { const out = []; for (const x of list) if (!shown.has(x) && has(x) && !regOf(x).some((t) => MORE_DROP.includes(t))) { shown.add(x); out.push(x); } return out; };
  const moreRoget = pickMore(mRaw.roget), moreMoby = pickMore(mRaw.moby);
  return { senses: keep, der, synAll, antAll, nearest, full: Boolean(full), more: { roget: moreRoget, moby: moreMoby } };
}
const kbOkRow = (e) => kb.ready() && e.rank !== undefined;
const PREFIXES = ['un', 'in', 'im', 'il', 'ir', 'non', 'dis', 'a', 'mis'];
const isPrefixNeg = (x, y) => PREFIXES.some((p) => (y === p + x && x.length >= 3) || (x === p + y && y.length >= 3));
export const thesaurusCount = (e) => { const d = thesData(e); return d.synAll.length + d.antAll.length; };

// o: { note, inList, canPractise }
export function thesaurusRows(e, o = {}) {
  const rows = [], row = e.rank, kbOk = kb.ready() && row !== undefined;
  if (o.note) rows.push({ k: 'p', t: o.note, small: true });
  if (o.wander) rows.push({ k: 'p', t: 'A surprise word, related to the one before. Add it to My words if you like it.', small: true });
  if (o.fresh) rows.push({ k: 'p', t: '✓ New word explored', small: true });
  rows.push({ k: 'p', t: [lex.posName(e.pos), row !== undefined && e.band >= 0 ? `${BAND_LABELS[e.band]} level` : '', ...regOf(e.w).filter((t) => t !== 'offensive')].filter(Boolean).join('  ·  '), small: true });
  if (kb.dataState() !== 'ready') {
    const st = kb.dataState();
    rows.push({ k: 'sub', t: 'Synonyms' }, ...pendingNote(st), { k: 'sub', t: 'Antonyms' }, { k: 'p', t: st === 'error' ? 'Not loaded.' : 'Loading…' });
    rows.push({ k: 'rule' }, { k: 'btn2', a: { id: 'dadd', label: o.inList ? 'In my words (remove)' : 'Add to my words', style: o.inList ? undefined : 'primary' }, b: { id: 'dpractise', label: 'Practise these words', disabled: true } });
    return rows;
  }
  const data = thesData(e), seenAll = data.synAll.concat(data.antAll), more = o.more ?? {}, LIM = 12;
  // SYNONYMS, then ANTONYMS: always the first two sections, with counts; grouped by meaning (closest first); "Show all N" past a dozen words
  const section = (id, title, total, groups, none) => {
    rows.push({ k: 'sub', t: `${title} (${total})` });
    if (!total) { rows.push({ k: 'p', t: none }); return; }
    let budget = more[id] ? Infinity : LIM;
    for (const g of groups) {
      if (budget <= 0) break;
      const words = g.words.slice(0, budget); budget -= words.length;
      if (g.head) rows.push({ k: 'p', t: g.head });
      thesChip(rows, g.label, words, Infinity);
    }
    if (!more[id] && total > LIM) rows.push({ k: 'btn', id: `dmore:${id}`, label: `Show all ${total}` });
  };
  const multiS = data.senses.length > 1, headOf = (g) => (multiS ? `${g.n}. ${g.gloss || 'another meaning'}` : g.gloss ? `Meaning: ${g.gloss}` : '');
  const sg = [], ag = [];
  for (const g of data.senses) {
    g.syn.forEach((list, i) => { if (list.length) sg.push({ head: headOf(g), label: SYN_GROUPS[i], words: list }); });
    g.ant.forEach((list, i) => { if (list.length) ag.push({ head: headOf(g), label: ANT_GROUPS[i], words: list }); });
  }
  if (data.der.length) sg.push({ head: '', label: 'Related forms (same root)', words: data.der });
  // the sense heading is shown once per run of groups
  for (const gs of [sg, ag]) { let last = null; for (const x of gs) { if (x.head === last) x.head = ''; else last = x.head; } }
  const near = data.nearest.length ? (() => { const t = []; thesChip(t, 'Nearest related words', data.nearest, 12, false); return t; })() : [];
  const nonePhrase = `none recorded for this word${kbOk ? '' : ' (the word data may still be loading)'}`;
  section('syn', 'Synonyms', data.synAll.length, sg, nonePhrase);
  const moreN = data.more.roget.length + data.more.moby.length;
  if (moreN) {
    rows.push({ k: 'sub', t: `More ways to say it (${moreN})` }, { k: 'p', t: 'Looser than the groups above, and not every one fits every meaning: check them in your sentence. Sources: Roget’s Thesaurus (1911) and Moby Thesaurus, both public domain.', small: true });
    let budget = more.more ? Infinity : LIM;
    for (const [label, list] of [['From Roget’s Thesaurus', data.more.roget], ['From Moby Thesaurus', data.more.moby]]) { const w = list.slice(0, budget); budget -= w.length; if (w.length) thesChip(rows, label, w, Infinity); }
    if (!more.more && moreN > LIM) rows.push({ k: 'btn', id: 'dmore:more', label: `Show all ${moreN}` });
  }
  if (!data.synAll.length) rows.push(...near);
  section('ant', 'Antonyms', data.antAll.length, ag, nonePhrase);
  if (!data.antAll.length && data.synAll.length) rows.push(...near);
  // broader, narrower and related
  if (kbOk) {
    const n0 = rows.length;
    thesChip(rows, 'Broader: a kind of', kb.words('hyper', row), 6, false);
    thesChip(rows, 'Narrower: kinds of it', kb.words('hypo', row), 10, false);
    thesChip(rows, 'Part of', kb.words('holo', row), 5, false);
    thesChip(rows, 'Has parts', kb.words('mero', row), 6, false);
    thesChip(rows, 'Word family', [...familyOf(e, 12), ...kb.words('fam', row)], 10, false);
    if (rows.length > n0) rows.splice(n0, 0, { k: 'rule' }, { k: 'sub', t: 'Broader, narrower and related' });
    const gw = kb.list('col', row).map((x) => (x.attr === 1 ? `${e.w} ${x.w}` : `${x.w} ${e.w}`)).slice(0, 8);
    const ph = kb.phrases(row).slice(0, 4);
    if (gw.length || ph.length) rows.push({ k: 'rule' }, { k: 'sub', t: 'Partner words and phrases' });
    if (gw.length) rows.push({ k: 'p', t: `Goes with: ${gw.join(', ')}` });
    for (const p of ph) rows.push({ k: 'p', t: p.gloss ? `${p.text}: ${p.gloss}` : p.text, small: true });
  }
  // which word fits: only from register tags and levels that the data holds
  const fit = [], all = uniq(seenAll), mine = regOf(e.w).filter((t) => t !== 'offensive');
  if (mine.length) fit.push(`“${e.w}” is ${mine.join(' and ')}.`);
  for (const t of REG_NAMES.slice(0, 6)) { const l = all.filter((x) => regOf(x).includes(t)).slice(0, 5); if (l.length) fit.push(`${t[0].toUpperCase()}${t.slice(1)}: ${l.join(', ')}.`); }
  if (row !== undefined && e.band >= 0) {
    const easy = all.filter((x) => { const b = lex.entry(x)?.band; return b !== undefined && b >= 0 && b < e.band; }).slice(0, 5), hard = all.filter((x) => { const b = lex.entry(x)?.band; return b !== undefined && b > e.band; }).slice(0, 5);
    if (easy.length) fit.push(`Easier words: ${easy.join(', ')}.`);
    if (hard.length) fit.push(`More advanced words: ${hard.join(', ')}.`);
  }
  if (fit.length) rows.push({ k: 'rule' }, { k: 'sub', t: 'Which word fits?' }, ...fit.map((t) => ({ k: 'p', t, small: true })), { k: 'p', t: 'Words under Same meaning can usually replace the word; the looser groups change the meaning a little, so check the sentence.', small: true });
  rows.push({ k: 'rule' }, { k: 'btn2', a: { id: 'dadd', label: o.inList ? 'In my words (remove)' : 'Add to my words', style: o.inList ? undefined : 'primary' }, b: { id: 'dpractise', label: 'Practise these words', disabled: !o.canPractise } });
  rows.push(...keepExploring(o));
  if (o.lookupOn) rows.push(onlineRow('thes'));
  rows.push({ k: 'p', t: 'This thesaurus works offline. Synonyms and antonyms come from WordNet, for every meaning of the word: words with the same meaning, similar and looser meanings, related forms, opposites by type, and words made with a prefix such as un- or non-. Only words that have an entry in this app are listed, and the “easier / more advanced” hints follow the app’s own levels. “More ways to say it” adds words from Roget’s Thesaurus (1911) and Moby Thesaurus, both public domain.', small: true });
  return rows;
}

// Words to practise with: the word and its closest synonyms (kid-safe by construction)
export function practiceWords(e, max = 6) {
  const g = thesData(e), flat = [e.w, ...g.senses.flatMap((x) => x.syn.flat())];
  return uniq(flat).filter((w) => usableEntry(lex.entry(w))).slice(0, max);
}
