// Learn-to-play content as data, plus the helpers that turn a step into tiles on screen.
// Hands are written like "234m 567p 123s 99s 3z": m Characters, s Bamboo, p Dots, z honours (1-4 winds E S W N, 5-7 Red Green White).
// Step types: info | tap | pick | discard | claim | win | score | play. See game.js (`lessonTap` etc.) for how each is judged.
// Everything is judged with the real rules (rules.js), so a lesson can never teach something the game does not do.
import { kindOf, kindName, newHand, claimOptions, selfWin, sortTiles, SUIT_NAME } from './rules.js';

export function parse(str) {
  const out = [];
  for (const g of str.trim().split(/\s+/)) {
    if (!g) continue;
    const suit = g[g.length - 1], base = suit === 'm' ? 0 : suit === 's' ? 9 : suit === 'p' ? 18 : suit === 'z' ? 27 : suit === 'f' ? 34 : 38;
    for (const d of g.slice(0, -1)) out.push(base + Number(d) - 1);
  }
  return out;
}
const R = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
export const idFor = (kind, n = 0) => (kind < 27 ? kind * 4 + n : kind < 31 ? 108 + (kind - 27) * 4 + n : kind < 34 ? 124 + (kind - 31) * 4 + n : 136 + (kind - 34));

// A rules state with seat 0 holding the given kinds: lets lessons ask the real rules what is possible.
export function fakeState(kinds, { melds = [], flowers = [], wind = 0 } = {}) {
  const used = {}, ids = kinds.map((k) => { const n = used[k] = (used[k] ?? -1) + 1; return idFor(k, Math.min(n, 3)); });
  const rngStub = { shuffle: (a) => a.slice() };
  const s = newHand(rngStub, { dealer: 0, wind, minFan: 1 });
  s.hands = [sortTiles(ids.slice()), [], [], []]; s.melds = [melds, [], [], []]; s.flowers = [flowers.map((k) => idFor(k)), [], [], []]; s.rivers = [[], [], [], []];
  s.front = 0; s.back = 144; s.drawn = -1; s.turn = 0; s.phase = 'discard';
  return s;
}
export function withDraw(s, kind) { const t = idFor(kind, 3); s.drawn = t; return t; }

// A few lesson lines teach the native tile glyphs directly (e.g. "the red 萬 means ten thousand"). Those steps give
// `text`/`wrong` as a function of the current tile language ('zh' | 'en') instead of a plain string, so the copy
// always matches what the tile itself is drawing. Everything else (menus, most lesson prose) is plain English text
// that never changes with the tile-language choice.
export const textOf = (v, lang) => (typeof v === 'function' ? v(lang) : v);

export const LESSONS = [
  { title: 'The three suits', blurb: 'Dots, Bamboo and Characters', steps: [
    { type: 'info', text: 'Mahjong uses 144 tiles. Most belong to three suits, each numbered 1 to 9: Dots, Bamboo and Characters. Let us meet them.', show: [22, 4, 12] },
    { type: 'tap', text: 'TAP the 5 of Dots: five circles.', stage: [{ label: 'Dots', kinds: R(18, 26) }, { label: 'Bamboo', kinds: R(9, 17) }, { label: 'Characters', kinds: R(0, 8) }], want: [22], wrong: 'Not that one. Dots show circles: count five of them.' },
    { type: 'tap', text: 'TAP the 3 of Bamboo: three green sticks. (The 1 of Bamboo is a little bird.)', stage: [{ label: 'Dots', kinds: R(18, 26) }, { label: 'Bamboo', kinds: R(9, 17) }, { label: 'Characters', kinds: R(0, 8) }], want: [11], wrong: 'Bamboo tiles show sticks. Find the one with three.' },
    { type: 'tap', text: (lang) => (lang === 'en' ? 'TAP the 8 of Characters. It is printed as a number over the suit letter C: "8C".' : 'TAP the 8 of Characters. The top glyph is the number (八 is eight); the red 萬 means "ten thousand".'), stage: [{ label: 'Dots', kinds: R(18, 26) }, { label: 'Bamboo', kinds: R(9, 17) }, { label: 'Characters', kinds: R(0, 8) }], want: [7], wrong: (lang) => (lang === 'en' ? 'Characters tiles are marked with a number over the letter C.' : 'Characters tiles have a red 萬 at the bottom. The number is the black glyph above it.') },
  ] },
  { title: 'Winds and dragons', blurb: 'The seven honour tiles', steps: [
    { type: 'info', text: 'Four winds (East, South, West, North) and three dragons (Red, Green, White) are the honour tiles. They have no numbers, so they never make a chow, only pungs and pairs.', show: [27, 28, 31, 32] },
    { type: 'tap', text: (lang) => (lang === 'en' ? 'TAP the East wind, marked E.' : 'TAP the East wind, 東.'), stage: [{ label: 'Winds', kinds: R(27, 30) }, { label: 'Dragons', kinds: R(31, 33) }], want: [27], wrong: (lang) => (lang === 'en' ? 'The winds are the four marked tiles: E East, S South, W West, N North.' : 'The winds are the four black glyphs: 東 East, 南 South, 西 West, 北 North.') },
    { type: 'tap', text: (lang) => (lang === 'en' ? 'TAP the Red Dragon, marked R.' : 'TAP the Red Dragon, 中.'), stage: [{ label: 'Winds', kinds: R(27, 30) }, { label: 'Dragons', kinds: R(31, 33) }], want: [31], wrong: (lang) => (lang === 'en' ? 'The dragons are R (red), G (green) and the blank frame.' : 'The dragons are 中 (red), 發 (green) and the blank frame.') },
    { type: 'tap', text: 'TAP the White Dragon: the blank blue frame.', stage: [{ label: 'Winds', kinds: R(27, 30) }, { label: 'Dragons', kinds: R(31, 33) }], want: [33], wrong: 'The White Dragon has no writing at all, just a frame.' },
  ] },
  { title: 'Flowers and seasons', blurb: 'The bonus tiles', steps: [
    { type: 'info', text: 'Eight bonus tiles complete the set: four flowers and four seasons. You never keep them in your hand. When you draw one, it is set aside and you draw a replacement.', show: [34, 38] },
    { type: 'tap', text: (lang) => (lang === 'en' ? 'TAP the Plum flower, marked "Pl" and numbered 1.' : 'TAP the Plum flower, marked 梅 and numbered 1.'), stage: [{ label: 'Flowers', kinds: R(34, 37) }, { label: 'Seasons', kinds: R(38, 41) }], want: [34], wrong: 'Flowers are the painted blossoms. Plum is number 1.' },
    { type: 'tap', text: (lang) => (lang === 'en' ? 'TAP the Winter season, marked "Wi". Bonus tiles score a fan when their number matches your seat: East is 1, South 2, West 3, North 4.' : 'TAP the Winter season, 冬. Bonus tiles score a fan when their number matches your seat: East is 1, South 2, West 3, North 4.'), stage: [{ label: 'Flowers', kinds: R(34, 37) }, { label: 'Seasons', kinds: R(38, 41) }], want: [41], wrong: (lang) => (lang === 'en' ? 'Seasons show a coloured disc marked with a two-letter season code: Sp Spring, Su Summer, Au Autumn, Wi Winter.' : 'Seasons show a coloured disc with one character: 春 Spring, 夏 Summer, 秋 Autumn, 冬 Winter.') },
  ] },
  { title: 'Chow, pung and kong', blurb: 'The sets you build', steps: [
    { type: 'pick', need: 'chow', text: 'A CHOW is three in a row from one suit. TAP three tiles that make a chow, then they lock in.', stage: [{ kinds: parse('3p 8s 4p 8s 5p 2m 8s 9m 7m') }], wrong: 'A chow is three consecutive numbers in the same suit, like 3-4-5 of Dots.' },
    { type: 'pick', need: 'pung', text: 'A PUNG is three identical tiles. TAP the three that make a pung.', stage: [{ kinds: parse('6m 2s 6m 7p 6m 3s 4z 4p 9p') }], wrong: 'A pung is three of exactly the same tile. Find the three alike.' },
    { type: 'pick', need: 'kong', text: 'A KONG is four identical tiles. TAP all four. (A kong is worth drawing a replacement tile for.)', stage: [{ kinds: parse('1z 5s 1z 1z 2p 1z 9m') }], wrong: 'A kong needs all four of the same tile. There is one tile that appears four times.' },
  ] },
  { title: 'The winning shape', blurb: 'Four sets and a pair', steps: [
    { type: 'info', text: 'A complete hand is FOUR sets and ONE pair: 14 tiles. Here is one: three chows, a pung of Red Dragons, and a pair of 9 of Bamboo.', show: parse('234m 567p 123s 555z'), pairShow: parse('99s'), grouped: true },
    { type: 'pick', need: 'pair', text: 'TAP the two tiles that form the pair.', stage: [{ kinds: parse('234m 567p 123s 555z 99s') }], wrong: 'The pair is just two identical tiles. Find them at the end of the row.' },
  ] },
  { title: 'Draw and discard', blurb: 'Keep what fits, throw what does not', steps: [
    { type: 'info', text: 'You hold 13 tiles. On your turn you DRAW one, then DISCARD one, always aiming to make sets. Keep tiles that already work together; let go of the loose ones.', show: [] },
    { type: 'discard', text: 'You drew the 8 of Characters. It sits next to your 7. TAP a tile to lift it, then TAP it again (or DRAG it up) to discard the tile that fits nowhere.', hand: parse('234m 567p 123s 99s 7m 3z'), draw: 7, want: [29], wrong: (lang) => ({ 6: 'The 7-8 of Characters could become a chow. Keep them.', 7: 'The 7-8 of Characters could become a chow. Keep them.', default: lang === 'en' ? 'That tile is part of a set or a pair. Discard the lone West wind: it fits nothing.' : 'That tile is part of a set or a pair. Discard the lone West wind (西): it fits nothing.' }) },
    { type: 'discard', text: 'A second chance. You drew a lone 1 of Dots. Which tile is the loose one now?', hand: parse('345m 456p 678s 22s 9p 4z'), draw: 18, want: [18, 30], wrong: { default: 'Keep your sets and your pair. The tiles that connect to nothing are the 1 of Dots, the 9 of Dots and the North wind.' }, wantAny: [18, 26, 30] },
  ] },
  { title: 'Claiming a pung', blurb: 'Taking a discard', steps: [
    { type: 'claim', text: 'Mei discarded the 4 of Bamboo, and you hold a pair of them. Claim buttons appear: TAP Pung to take it.', hand: parse('44s 234m 567p 12p 99m 8s'), river: { kind: 12, from: 1 }, want: 'pung', wrong: 'Tap the gold-edged Pung button: you hold two 4s, and the discard makes three.' },
    { type: 'discard', text: 'Your pung is shown face up. Now you must discard. TAP the lone 8 of Bamboo, then TAP it again.', hand: parse('234m 567p 12p 99m 8s'), draw: -1, melds: [{ type: 'pung', kind: 12 }], want: [16], wrong: { default: 'Discard the tile that fits nowhere: the 8 of Bamboo.' } },
    { type: 'info', text: 'A KONG works the same way: claim a discard that matches three tiles in your hand and you draw an extra tile from the back of the wall. Win! beats Pung and Kong, and those beat Chow.', show: [] },
  ] },
  { title: 'Claiming a chow', blurb: 'Only from the player before you', steps: [
    { type: 'claim', text: 'Jun (on your left, the player before you) discarded the 6 of Characters. You hold 4-5. TAP Chow.', hand: parse('45m 222p 789s 33p 5z 9s 1z'), river: { kind: 5, from: 3 }, want: 'chow', wrong: 'Jun sits before you, so you may take a chow. Tap Chow.' },
    { type: 'claim', text: 'Now Mei (on your right) discards a 6 of Characters. You could use it, but a chow may only come from the player before you, so no Chow button appears. TAP Pass.', hand: parse('45m 222p 789s 33p 5z 9s 1z'), river: { kind: 5, from: 1 }, want: 'pass', wrong: 'Nothing to claim here: tap Pass and play on.' },
  ] },
  { title: 'Winning', blurb: 'Declare your hand', steps: [
    { type: 'win', text: 'You hold 234m 567p 123s 99s and 5-6 of Characters, and you just drew the 7 of Characters: 5-6-7 completes your fourth set. TAP Win!.', hand: parse('234m 567p 123s 99s 56m'), draw: 6, wrong: 'Your hand is complete. Tap the gold Win! button.' },
    { type: 'claim', text: 'You can also win on someone else\'s discard. Lin discards the 4 of Characters, which completes 4-5-6. TAP Win!.', hand: parse('234m 567p 123s 99s 56m'), river: { kind: 3, from: 2 }, want: 'win', wrong: 'That tile completes your hand: tap Win!.' },
  ] },
  { title: 'Scoring', blurb: 'Fan and points', steps: [
    { type: 'score', text: 'A win scores FAN for its patterns. Here, a pung of Red Dragons is 1 fan, and drawing the last tile with no claimed sets is 3 more. 4 fan is 8 points.', hand: parse('234m 567p 123s 555z 99s'), self: true },
    { type: 'info', text: 'Fan to points: 1 fan = 1, 2 = 2, 3 = 4, 4 = 8, 5 = 16, 6 = 24, 7 = 32, 8 = 48, 9 = 64. A hand needs at least 1 fan to win (you can change this in Settings). When someone wins on a discard, the discarder pays double.', show: [] },
  ] },
  { title: 'Your first hand', blurb: 'A friendly full game', steps: [
    { type: 'play', text: 'Play a whole hand against three beginners. Tap Why? whenever you want advice.' },
  ] },
];

// ------------------------------------------------------------------------------------------------- stage geometry
export function stageTiles(step) {
  const out = [];
  if (!step.stage) return out;
  const nr = step.stage.length; let y = nr === 1 ? 720 : nr === 2 ? 620 : 560, idx = 0;
  for (const row of step.stage) {
    const n = row.kinds.length, pitch = Math.min(80, 690 / n), w = Math.min(66, pitch - 6);
    row.kinds.forEach((k, i) => out.push({ kind: k, x: 360 - ((n - 1) * pitch) / 2 + i * pitch, y, w, idx: idx++, label: row.label }));
    row.y = y; y += nr === 3 ? 200 : 230;
  }
  return out;
}

export function tapName(kind) { return kindName(kind); }

// Classify three or four chosen kinds as a set.
export function classify(kinds) {
  const k = [...kinds].sort((a, b) => a - b);
  if (k.length === 2) return k[0] === k[1] ? 'pair' : null;
  if (k.length === 3) {
    if (k[0] === k[1] && k[1] === k[2]) return 'pung';
    if (k[0] < 27 && k[1] === k[0] + 1 && k[2] === k[0] + 2 && Math.floor(k[0] / 9) === Math.floor(k[2] / 9)) return 'chow';
  }
  if (k.length === 4 && k.every((x) => x === k[0])) return 'kong';
  return null;
}
export const NEED_COUNT = { chow: 3, pung: 3, kong: 4, pair: 2 };
export { SUIT_NAME };
