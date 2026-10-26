// Alphabet and pre-reader helpers (hub audit wave 3): letter-sound-picture table, the original chant, the phonics sound chart,
// the on-screen keyboard, the letter hunt grid and the grown-up guidance text. Pure data and small builders: randomness only through the rng passed in.
import { LETTERS, LETTER_NAMES } from './letters.js';

// One picture word per letter (every word has a code-drawn picture in art.js). x is at the END of box, so it is left out of "starts with" games.
export const EX = {
  a: 'apple', b: 'ball', c: 'cat', d: 'dog', e: 'egg', f: 'fish', g: 'grape', h: 'hat', i: 'igloo', j: 'jar', k: 'key', l: 'leaf', m: 'moon',
  n: 'nest', o: 'orange', p: 'pig', q: 'quilt', r: 'rabbit', s: 'sun', t: 'tree', u: 'umbrella', v: 'van', w: 'water', x: 'box', y: 'yellow', z: 'zip',
};
export const exWord = (c) => EX[c];
export const STARTS = LETTERS.filter((c) => c !== 'x');         // letters that start their example word
// How the phone voice says the main sound of each letter (an approximation: voices differ, so the example word is the surest cue).
export const SOUND_SAY = {
  a: 'a, as in apple', b: 'buh', c: 'kuh', d: 'duh', e: 'eh', f: 'fff', g: 'guh', h: 'huh', i: 'ih', j: 'juh', k: 'kuh', l: 'lll', m: 'mmm', n: 'nnn', o: 'ah', p: 'puh',
  q: 'kwuh', r: 'rrr', s: 'sss', t: 'tuh', u: 'uh', v: 'vvv', w: 'wuh', x: 'ks', y: 'yuh', z: 'zzz',
};
export const SOUND_SHOW = {
  a: 'a as in apple', b: 'b as in ball', c: 'c as in cat', d: 'd as in dog', e: 'e as in egg', f: 'f as in fish', g: 'g as in grape', h: 'h as in hat', i: 'i as in igloo', j: 'j as in jar',
  k: 'k as in key', l: 'l as in leaf', m: 'm as in moon', n: 'n as in nest', o: 'o as in orange', p: 'p as in pig', q: 'q as in quilt', r: 'r as in rabbit', s: 's as in sun',
  t: 't as in tree', u: 'u as in umbrella', v: 'v as in van', w: 'w as in water', x: 'x as in box (at the end)', y: 'y as in yellow', z: 'z as in zip',
};
export const letterSay = (c, mode) => (mode === 'sound' ? (c === 'a' ? 'ah, as in apple' : `${SOUND_SAY[c]}, as in ${exWord(c)}`) : `${LETTER_NAMES[c]}. ${c.toUpperCase()} is for ${exWord(c)}`);

// ---- R3: an original chant (no borrowed tune or words). One short line per letter; the word being spoken lights up.
export const chantWords = () => {
  const out = [];
  for (const c of LETTERS) out.push(c.toUpperCase(), 'is', 'for', `${exWord(c)}${c === 'z' ? '.' : ','}`);
  out.push('Now', 'I', 'know', 'my', 'letters,', 'A', 'to', 'Z.', 'Say', 'them', 'with', 'me!');
  return out.join(' ').split(' ');
};

// ---- R12: phonics sound chart. g = spelling, k = group, say = how the phone voice should voice it, ex = example words, tip = how the mouth makes it.
export const SOUND_GROUPS = [{ k: 'cons', label: 'Consonants' }, { k: 'dig', label: 'Letter pairs' }, { k: 'short', label: 'Short vowels' }, { k: 'long', label: 'Long vowels' }, { k: 'other', label: 'Other vowel sounds' }];
export const SOUNDS = [
  { g: 'b', k: 'cons', say: 'buh', ex: ['bat', 'baby', 'web'], tip: 'Lips together, then pop them open. Your voice is on.' },
  { g: 'c / k', k: 'cons', say: 'kuh', ex: ['cat', 'kite', 'back'], tip: 'The back of the tongue touches the roof of the mouth, then lets go. No voice.' },
  { g: 'd', k: 'cons', say: 'duh', ex: ['dog', 'dad', 'bed'], tip: 'The tongue tip taps behind the top teeth. Voice on.' },
  { g: 'f', k: 'cons', say: 'fff', ex: ['fish', 'leaf', 'phone'], tip: 'Top teeth on the bottom lip, blow. No voice.' },
  { g: 'g', k: 'cons', say: 'guh', ex: ['go', 'bag', 'gift'], tip: 'Like k, but with your voice on.' },
  { g: 'h', k: 'cons', say: 'huh', ex: ['hat', 'hand', 'happy'], tip: 'Just a breath, like fogging a mirror.' },
  { g: 'j / g', k: 'cons', say: 'juh', ex: ['jam', 'jump', 'giant'], tip: 'Like ch, with your voice on.' },
  { g: 'l', k: 'cons', say: 'lll', ex: ['leg', 'ball', 'light'], tip: 'The tongue tip touches behind the top teeth and the sound flows round it.' },
  { g: 'm', k: 'cons', say: 'mmm', ex: ['man', 'swim', 'moon'], tip: 'Lips together, the sound hums through your nose.' },
  { g: 'n', k: 'cons', say: 'nnn', ex: ['net', 'sun', 'nine'], tip: 'The tongue tip behind the top teeth, the sound hums through your nose.' },
  { g: 'p', k: 'cons', say: 'puh', ex: ['pig', 'cup', 'happy'], tip: 'Like b, but with no voice, only a puff of air.' },
  { g: 'r', k: 'cons', say: 'rrr', ex: ['red', 'rabbit', 'run'], tip: 'The tongue pulls back and does not touch the roof of the mouth.' },
  { g: 's', k: 'cons', say: 'sss', ex: ['sun', 'bus', 'city'], tip: 'A hiss: tongue near the top teeth, no voice.' },
  { g: 't', k: 'cons', say: 'tuh', ex: ['top', 'cat', 'tree'], tip: 'Like d, but with no voice.' },
  { g: 'v', k: 'cons', say: 'vvv', ex: ['van', 'five', 'very'], tip: 'Like f, but with your voice on. Feel the buzz on your lip.' },
  { g: 'w', k: 'cons', say: 'wuh', ex: ['water', 'wet', 'window'], tip: 'Round your lips like for oo, then open them quickly.' },
  { g: 'y', k: 'cons', say: 'yuh', ex: ['yes', 'yellow', 'yard'], tip: 'The middle of the tongue lifts toward the roof of the mouth.' },
  { g: 'z', k: 'cons', say: 'zzz', ex: ['zip', 'zoo', 'buzz'], tip: 'Like s, but with your voice on.' },
  { g: 'ch', k: 'dig', say: 'chuh', ex: ['chair', 'cheese', 'lunch'], tip: 'A t and an sh joined together, no voice.' },
  { g: 'sh', k: 'dig', say: 'shh', ex: ['ship', 'fish', 'shoe'], tip: 'Lips a little round, a long quiet hush.' },
  { g: 'th (thin)', k: 'dig', say: 'th, as in thin', ex: ['thin', 'bath', 'three'], tip: 'The tongue tip just between the teeth, blow softly. No voice.' },
  { g: 'th (this)', k: 'dig', say: 'th, as in this', ex: ['this', 'mother', 'the'], tip: 'The same tongue place as thin, but with your voice on.' },
  { g: 'wh', k: 'dig', say: 'wuh', ex: ['whale', 'wheel', 'white'], tip: 'Most speakers say it just like w.' },
  { g: 'ng', k: 'dig', say: 'ng, as in sing', ex: ['sing', 'ring', 'long'], tip: 'The back of the tongue lifts and the sound hums through the nose.' },
  { g: 'qu', k: 'dig', say: 'kw', ex: ['queen', 'quick', 'quilt'], tip: 'A k and a w said together.' },
  { g: 'ck', k: 'dig', say: 'kuh', ex: ['duck', 'clock', 'sock'], tip: 'The same sound as k, found at the end after a short vowel.' },
  { g: 'a', k: 'short', say: 'a, as in apple', ex: ['apple', 'cat', 'hat'], tip: 'Mouth open wide, the tongue low and forward.' },
  { g: 'e', k: 'short', say: 'eh', ex: ['egg', 'bed', 'red'], tip: 'Mouth half open, a short sound.' },
  { g: 'i', k: 'short', say: 'ih', ex: ['igloo', 'pig', 'sit'], tip: 'A short, relaxed sound, with the lips spread a little.' },
  { g: 'o', k: 'short', say: 'ah', ex: ['orange', 'dog', 'hot'], tip: 'Mouth open and round, a short sound.' },
  { g: 'u', k: 'short', say: 'uh', ex: ['umbrella', 'sun', 'cup'], tip: 'A short sound from the middle of the mouth.' },
  { g: 'a_e / ai / ay', k: 'long', say: 'ay, as in cake', ex: ['cake', 'rain', 'play'], tip: 'The vowel says its own name: ay.' },
  { g: 'ee / ea', k: 'long', say: 'ee, as in tree', ex: ['tree', 'sea', 'happy'], tip: 'Lips spread wide, the tongue high.' },
  { g: 'i_e / igh / y', k: 'long', say: 'eye, as in kite', ex: ['kite', 'night', 'fly'], tip: 'The vowel says its own name: eye.' },
  { g: 'o_e / oa / ow', k: 'long', say: 'oh, as in boat', ex: ['boat', 'home', 'snow'], tip: 'Lips round, the vowel says its own name: oh.' },
  { g: 'u_e / ue / ew', k: 'long', say: 'yoo, as in cube', ex: ['cube', 'blue', 'new'], tip: 'Often a y sound and then oo.' },
  { g: 'oo (moon)', k: 'other', say: 'oo, as in moon', ex: ['moon', 'food', 'spoon'], tip: 'Lips round and pushed forward, a long sound.' },
  { g: 'oo (book)', k: 'other', say: 'oo, as in book', ex: ['book', 'foot', 'good'], tip: 'The same round lips, but short.' },
  { g: 'ow / ou', k: 'other', say: 'ow, as in cow', ex: ['cow', 'house', 'cloud'], tip: 'Starts wide, then the lips round: ow.' },
  { g: 'oi / oy', k: 'other', say: 'oy, as in boy', ex: ['boy', 'coin', 'toy'], tip: 'Starts round, then the mouth spreads: oy.' },
  { g: 'ar', k: 'other', say: 'ar, as in car', ex: ['car', 'star', 'farm'], tip: 'Mouth open, then the tongue pulls back for r.' },
  { g: 'or / aw / au', k: 'other', say: 'or, as in horse', ex: ['horse', 'saw', 'sauce'], tip: 'Lips round, a long open sound.' },
  { g: 'er / ir / ur', k: 'other', say: 'er, as in bird', ex: ['bird', 'her', 'turn'], tip: 'The same sound for three spellings. Tongue pulled back.' },
  { g: 'air / are', k: 'other', say: 'air, as in chair', ex: ['chair', 'bear', 'share'], tip: 'Starts like eh and glides to r.' },
  { g: 'ear / eer', k: 'other', say: 'ear, as in near', ex: ['ear', 'deer', 'near'], tip: 'Starts like ih and glides to r.' },
  { g: 'schwa (the quiet vowel)', k: 'other', say: 'uh', ex: ['about', 'banana', 'the'], tip: 'The most common English vowel sound: short, quiet, in unstressed parts of words.' },
];
export const soundSpeech = (s) => `${s.say}. ${s.ex.join(', ')}`;

// ---- R14: keyboard familiarity
export const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
export const KEY_WORDS = ['cat', 'dog', 'sun', 'pig', 'hat', 'cow', 'bus', 'egg', 'key', 'jar', 'box', 'van', 'bed', 'cup', 'fish', 'moon', 'tree', 'ball', 'book', 'door', 'milk', 'rain', 'farm', 'star'];
export function keyboardRows(shift, wrongKey, rightKey) {
  return KEY_ROWS.map((r, ri) => r.split('').map((ch) => ({ v: ch, label: shift ? ch.toUpperCase() : ch, on: ch === rightKey, off: false, bad: ch === wrongKey, ri })));
}

// ---- R4: letter hunt: a grid of letters with some of one letter hidden among look-alikes and others
export function huntGrid(target, rng, cols = 6, rowsN = 4) {
  const n = cols * rowsN, hits = 5 + rng.int(3);
  const look = [...new Set(['bdpq', 'mnh', 'uvw', 'ij', 'ceo', 'gqy', 'fkt', 'ls', 'rn'].filter((s) => s.includes(target)).join('').split(''))].filter((x) => x !== target);
  const pool = rng.shuffle(LETTERS.filter((x) => x !== target));
  const cells = [];
  for (let i = 0; i < hits; i += 1) cells.push(target);
  while (cells.length < n) cells.push(rng.chance(0.55) && look.length ? rng.pick(look) : pool[cells.length % pool.length]);
  const shuffled = rng.shuffle(cells);
  return { target, cols, cells: shuffled, hits, found: shuffled.map(() => false), wrong: 0 };
}

// ---- R8: alphabetical order: a handful of letters in a mixed order
export function orderSet(rng, n = 5) {
  const start = rng.int(26 - n * 2), picks = rng.shuffle(LETTERS.slice(start, start + n * 2)).slice(0, n).sort();
  return picks;
}

// ---- R15: guidance for the grown-up
export const GUIDE = [
  { h: 'Sit together', p: 'The best time with this game is time you spend side by side. Hold the phone where you both can see it, and let the child touch the screen.' },
  { h: 'Talk about what you see', p: 'When a picture appears, ask: What do you see? What colour is it? Where have you seen one? Talking about the word makes it stick far better than tapping alone.' },
  { h: 'Say it, then let them say it', p: 'Say the word or letter sound clearly, then wait. Let the child try it in their own time. Praise the trying, not only the right answer. If the answer is wrong, simply say the right one together.' },
  { h: 'Keep it short', p: 'Five to ten minutes is plenty for a young child. Stop while it is still fun. The Settings screen has a play-time limit and a break reminder that you can set.' },
  { h: 'Connect it to the day', p: 'After a game, look for the same letters and words around you: on a cereal box, a sign, a book. The letter on the screen becomes a letter in the world.' },
  { h: 'Use your own language too', p: 'A child learns best when words are linked to words they already know. Say the word in your home language as well, then in English.' },
  { h: 'You decide what is on the screen', p: 'The grown-up area (Settings, data, players) asks a simple sum before it opens when a child profile is in use. There are no links to other sites and no purchases inside the games on this page.' },
];
export const GUIDE_NOTE = 'This is general advice for sharing a game with a young child, not medical or teaching advice. Follow the guidance of your own clinic or school about screen time for very young children.';
export const BEDTIME_MINS = [0, 5, 10, 15, 20];
