// Text and diagrams: the Rules reference, How to Play, About and the lessons. Every rule statement is cross-checked against rules.js and ai.js.
// Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram spec: { type: 'row' | 'faces' | 'fist', open: [fist indexes shown open], ring: fist | -1 (shown on that open fist), exprs: { player: {kind, side} } }
import { STARES, seekScore } from './rules.js';

const D = (spec, h = 250) => ({ k: 'd', spec, h });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });

export const RULES = [
  { title: 'Where the game comes from', items: [
    P('Mheibes, the ring-hunting game, is a favourite hand-guessing game of Iraq and the Gulf. Two teams sit facing each other. One side passes a ring along behind their backs, then every player holds out two closed fists. The ring is in just one of them. The other side’s captain studies the faces and the fists and tries to find it.'),
    P('This version keeps the heart of it, reading faces and deciding which fists to open, and turns the two teams into you and a computer team. Counters are only a score for a friendly contest.'),
  ] },
  { title: 'The players and their fists', items: [
    P('Five players sit in a circle, two fists each: ten fists in all, and the ring is in exactly one. Fists are numbered by player and hand; “left” and “right” are always as you see them on the screen.'),
    D({ type: 'row', open: [], ring: -1, exprs: {} }),
    P('Every player has a personality, which stays the same for the whole match. Watch how they sit and fidget while you play, and use the Stare to learn what each face means. After every round the game shows who was who.'),
  ] },
  { title: 'A match', items: [
    P('A match is six rounds (you can change it to four or eight in Settings). You are the seeker in the first round, then the hider, and so on. The side with the most counters when the rounds are over wins; equal counters is a draw.'),
    P('There is no money and no staking: counters only keep score.'),
  ] },
  { title: 'Seeking: Stare, Bat, Bas', items: [
    P(`You have ${STARES} Stares in each round. Tap a face to stare at that player: the face shows a tell for a moment and the game remembers it under the player’s name.`),
    D({ type: 'faces' }, 220),
    P('Bat: tap a fist and press Bat to ask the player to open it. If it is empty it is out for the rest of the round, and the player reacts, which is a free look at that face. If it holds the ring, the round ends at once and the hiders score 1.'),
    D({ type: 'row', open: [0, 4, 7], ring: -1, exprs: { 1: { kind: 'tense', side: 1 } } }),
    P('Bas: tap a fist and press Bas to name it as the answer. If you are right the round ends and you score, as below. If you are wrong the ring is shown and the hiders score 1.'),
    D({ type: 'row', open: [3], ring: 3, exprs: {} }),
  ] },
  { title: 'Scoring a round', items: [
    P(`Right answer: ${seekScore(0)} counters, plus 1 more for every 2 empty fists you opened first (at most ${seekScore(6)}).`),
    P('Opening more fists makes your answer safer and worth more, but every Bat on a fist that holds the ring ends the round for 1 counter to the hiders. Staring is free: use all of your Stares before you decide.'),
    P('Hider counters: 1 when the seeker answers wrongly or opens the ring fist. A round has no other score.'),
  ] },
  { title: 'Hiding', items: [
    P('When you hide, the fists are your team’s. Tap the fist that will hold the ring (only you see it, shown with a gold ring). Then tap a teammate to be your performer, or pass. The performer acts tense and glances at his fists, even when it holds nothing, to draw the seeker’s eye.'),
    P('Choose carefully: the computer team remembers where you like to hide the ring from round to round, and it reads faces too. A calm player is a safer holder than an open one. Do not hide in the same place every time.'),
  ] },
  { title: 'The four kinds of player', items: [
    P('Open: shows it. Tense, or glancing at the fist that holds the ring, is very likely the real thing.'),
    P('Steady: gives almost nothing away, so when a steady player does look tense or glances at a fist, believe it.'),
    P('Jittery: twitches and glances all the time, so the tells hardly matter. Look elsewhere.'),
    P('Showman: puts on a show when the fists are empty and relaxes when the ring is there. A big tense face or a glance can mean the ring is somewhere else.'),
    P('After each round the game shows who was who, so you can read them better in the next. A glance goes to the fist that holds the ring most of the time for open and steady players, only half of the time for jittery ones and rarely for a showman.'),
  ] },
  { title: 'The computer', items: [
    P('Three levels. Friendly guesses on feel, does not learn your habits and hides the ring at random. Sharp learns which players are reliable, notices where you hide, and hides in quiet places. Master reads and hides best and rarely wastes a look.'),
    P('The computer sees only what a human would see: the faces and the opened fists. It never sees the ring when it seeks.'),
  ] },
  { title: 'Simplifications', items: [
    P('The real game is played by two teams of many players, with call-outs and gestures by the captain. Here you play one captain against a computer team, with Stare, Bat and Bas standing in for the gestures, and a six-round match.'),
  ] },
];

export const HOWTO = [
  { title: 'Seeker', items: [
    P('Tap a face to Stare. You have four per round, and each shows what that player’s face does.'),
    P('Tap a fist, then Bat to open it (empty is out, the ring ends the round) or Bas to name it as the answer.'),
    P('Hint shows the move the computer would make, and why. Open more fists before you answer to score more, but each open is a small risk.'),
  ] },
  { title: 'Hider', items: [
    P('Tap the fist that will hold the ring, then pick a performer to act the part, or skip. Then watch the computer try to find it.'),
  ] },
  { title: 'Everything else', items: [
    P('Two players: pass the phone; the hider picks in secret and a cover screen hides the board.'),
    P('Auto Play shows the computer playing a whole match, one move at a time, with a real Pause. Learn teaches the four moves in four short steps.'),
    P('A- and A+ on the Rules, How to Play, About and Settings screens grow the text up to 300%.'),
  ] },
];

export const ABOUT = [
  { title: 'About Mheibes', items: [
    P('Mheibes is a traditional ring-hunting game of Iraq and the Gulf, played in living rooms and majlis gatherings by two teams. This version is made with respect for the tradition and its places: a quick, friendly game of faces, fists and nerve.'),
    P('Credits and the rules of the original game are described on the Rules screen, which also lists what is simplified here. Works offline.'),
  ] },
];

export const LESSONS = [
  { name: 'Stare', goal: { type: 'stare' }, text: 'Tap Nawaf’s face to stare at him. Watch what his face does.', hint: 'Tap the face of any player.' },
  { name: 'Bat an empty fist', goal: { type: 'bat' }, text: 'Now tap a fist, then press Bat. Empty fists are safe and each one makes your answer worth more.', hint: 'Pick a fist and press Bat. (This one is safe.)' },
  { name: 'Name the ring', goal: { type: 'bas' }, text: 'Stare at Nawaf (tap his face). A tense face points to the ring. Then tap his right fist and press Bas.', hint: 'Tap Nawaf’s right fist (the tense player), then press Bas.' },
  { name: 'Now you hide', goal: { type: 'hide' }, text: 'Tap any fist to hold the ring, then tap a teammate to be your performer.', hint: 'Tap a fist, then a teammate.' },
];
