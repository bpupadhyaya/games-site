// "Look up a word": turn whatever the player typed into a word the built-in dictionary (WordNet meanings) knows. Pure and deterministic.
// 1. the word itself, 2. an irregular form (mice -> mouse, went -> go), 3. a regular ending taken off (walked -> walk, studies -> study,
// bigger -> big), 4. a plain "no built-in meaning". The caller supplies `has(w)` (true when the word has a meaning in the pack).
const IRREG = {
  mice: 'mouse', lice: 'louse', geese: 'goose', teeth: 'tooth', feet: 'foot', men: 'man', women: 'woman', children: 'child', people: 'person', oxen: 'ox',
  knives: 'knife', wives: 'wife', lives: 'life', leaves: 'leaf', wolves: 'wolf', shelves: 'shelf', halves: 'half', loaves: 'loaf', thieves: 'thief', calves: 'calf',
  was: 'be', were: 'be', been: 'be', being: 'be', am: 'be', is: 'be', are: 'be', has: 'have', had: 'have', having: 'have', does: 'do', did: 'do', done: 'do', doing: 'do',
  went: 'go', gone: 'go', going: 'go', goes: 'go', came: 'come', coming: 'come', saw: 'see', seen: 'see', took: 'take', taken: 'take', gave: 'give', given: 'give',
  made: 'make', said: 'say', ran: 'run', ate: 'eat', eaten: 'eat', wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak', broke: 'break', broken: 'break',
  chose: 'choose', chosen: 'choose', drove: 'drive', driven: 'drive', fell: 'fall', fallen: 'fall', flew: 'fly', flown: 'fly', forgot: 'forget', forgotten: 'forget',
  got: 'get', gotten: 'get', grew: 'grow', grown: 'grow', hid: 'hide', hidden: 'hide', knew: 'know', known: 'know', rode: 'ride', ridden: 'ride', rose: 'rise', risen: 'rise',
  sang: 'sing', sung: 'sing', sank: 'sink', sunk: 'sink', sat: 'sit', slept: 'sleep', stole: 'steal', stolen: 'steal', swam: 'swim', swum: 'swim', threw: 'throw', thrown: 'throw',
  woke: 'wake', woken: 'wake', wore: 'wear', worn: 'wear', won: 'win', bought: 'buy', brought: 'bring', caught: 'catch', taught: 'teach', thought: 'think', told: 'tell',
  found: 'find', felt: 'feel', kept: 'keep', left: 'leave', lost: 'lose', met: 'meet', paid: 'pay', sold: 'sell', sent: 'send', spent: 'spend', stood: 'stand', understood: 'understand',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', more: 'many', most: 'many', less: 'little', least: 'little',
};
export const normalise = (raw) => String(raw ?? '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' -]/g, '').trim().replace(/\s+/g, ' ').replace(/^'+|'+$/g, '').slice(0, 30);

function candidates(w) {
  const out = [];
  const add = (b) => { if (b && b.length >= 2 && b !== w && !out.includes(b)) out.push(b); };
  if (IRREG[w]) add(IRREG[w]);
  if (w.endsWith("'s")) add(w.slice(0, -2));
  const dbl = (b) => { if (b.length >= 3 && b[b.length - 1] === b[b.length - 2]) add(b.slice(0, -1)); };
  for (const [suf, rep] of [['ies', 'y'], ['ied', 'y'], ['ier', 'y'], ['iest', 'y'], ['ves', 'f'], ['ves', 'fe'], ['ing', ''], ['ing', 'e'], ['ed', ''], ['ed', 'e'], ['es', ''], ['s', ''], ['er', ''], ['er', 'e'], ['est', ''], ['est', 'e'], ['ly', ''], ['ily', 'y'], ['ness', ''], ['ment', '']]) {
    if (w.endsWith(suf) && w.length - suf.length >= 2) { const b = w.slice(0, w.length - suf.length) + rep; add(b); if (!rep) dbl(b); }
  }
  return out;
}
// -> { w: the word to show, from: what the player typed (when different), kind: 'exact' | 'form' | 'none' }
export function resolveWord(raw, has) {
  const w = normalise(raw);
  if (!w) return { w: '', from: '', kind: 'none' };
  if (has(w)) return { w, from: '', kind: 'exact' };
  for (const b of candidates(w)) if (has(b)) return { w: b, from: w, kind: 'form' };
  return { w, from: '', kind: 'none' };
}
