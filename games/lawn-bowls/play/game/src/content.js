// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (green, bias, weights, ditch, bounds, touchers), match.js (jack, order, scoring, ends), game.js (flow, ladder).
// Distances are in metres. A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

import { RINK, WEIGHTS } from './sim.js';
// distances and speeds are read from the engine so the text can never disagree with it
const M = (v) => String(+v.toFixed(1));

export const ABOUT = [
  { title: 'Lawn bowls', art: 'bowls', p: [
    'Lawn bowls is a quiet, clever sport played on mown greens in clubs and parks across the United Kingdom, Australia, New Zealand and South Africa, and wherever people have taken the game since. Players roll heavy, lopsided bowls toward a small white target ball, the jack, and the bowl that finishes closest wins the shot.',
    'The bowls are not round on one side: they are biased, so each one curves as it slows. Reading that curve, and choosing which way to let it bend, is the whole art of the game.',
  ] },
  { title: 'A game for everyone', p: [
    'Bowls is played by all ages, side by side, and is one of the few sports where a patient beginner can beat an old hand on a good day. A well-bowled shot is gentle, and the cleverest players win by thinking, not by throwing hard.',
  ] },
  { title: 'The green is part of the game', p: [
    'Every green plays differently. A fast green lets a bowl run on and bend a long way; a heavy green needs a firmer push; a cross-slope pulls everything to one side. In this version you meet a village green, a fast tournament green, a seaside green with a lean, a heavy damp green, and a new daily green.',
  ] },
  { title: 'This version', p: [
    'Lawn Bowls simulates every bowl, bend and bump on a green seen from above. You play singles against one of six club rivals, against a friend on the same phone, up a five-rung club ladder, or sit back and watch two rivals in Watch & Learn.',
    'The game is a respectful, simplified picture of the sport: no real clubs, players or brands appear.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'bowls', p: [
    'Each side has four bowls, black or ivory. Roll them so they finish closer to the little white jack than any of the other side\'s bowls. After all eight bowls of an end, the nearer side scores one shot for every bowl that is closer than the other side\'s nearest.',
  ] },
  { title: 'Place the ring', art: 'ring', p: [
    'Press and drag on the green: a gold ring follows just ahead of your finger. Put it where you want the bowl to finish. The dotted line is the path the bowl will take, and the ghost bowl is where it comes to rest.',
    'The shaded oval is how far a slightly shaky hand might miss. It grows with the distance and with a draw weight.',
  ] },
  { title: 'Choose the hand', art: 'bias', p: [
    'Every bowl bends toward its small-ring side. Tap Curve left or Curve right to choose which way yours leans. Use it to go round a bowl that is in the way, or to swing in beside the jack.',
  ] },
  { title: 'Choose the weight', art: 'weights', p: [
    'Draw: the bowl dies at the ring. The normal way to place a bowl.',
    'Firm: it arrives at the ring with some pace, enough to trail the jack along or nudge a bowl.',
    'Drive: it arrives hard, to fire a bowl or the jack out of the head.',
  ] },
  { title: 'Roll', p: [
    'Press Roll. The camera follows the bowl down the rink and settles on the head. Hold a finger on the green while it rolls to fast-forward.',
    `The first bowl of an end is the jack: drag along the rink to choose how far it runs (at least ${M(RINK.minJack)} m), then Roll.`,
  ] },
  { title: 'Who bowls next', art: 'order', p: [
    'Bowls alternate, four each. The side that won the last end rolls the jack and bowls first.',
  ] },
  { title: 'Scoring', art: 'score', p: [
    'After the last bowl the head is measured and the distances shown. A side scores one shot for each of its bowls nearer the jack than the other side\'s nearest bowl. A match is 6 or 10 ends; most shots wins.',
  ] },
  { title: 'Hint, guide and Watch & Learn', p: [
    'Hint suggests a good shot and sets the ring, hand and weight for you. In Settings the guide line can be the whole path, only its first part, or off for experts.',
    'Watch & Learn plays a whole match between two rivals. They think first, then show the shot they chose, then bowl it. You can pause at any moment and change how long they think.',
  ] },
];

export const RULES = [
  { title: '1. The rink', art: 'rink', p: [
    `The rink is ${M(RINK.half * 2)} m wide, marked by white strings along both sides; neighbouring rinks lie either side on the same green. The mat is at the near end. The ditch begins about ${M(RINK.ditch)} m from the mat, and the bank rises beyond it.`,
    `Real greens are a little longer or shorter; this one is a fixed ${M(RINK.ditch)} m so every rink plays alike.`,
  ] },
  { title: '2. Bowls and jack', art: 'bowls', p: [
    'Singles: each side has four bowls (black with a red decal, ivory with a blue decal) and there is one white jack. The bowls are shown slightly larger than real size so they stay readable. The jack is light, so a bowl that hits it sends it far.',
  ] },
  { title: '3. The bias', art: 'bias', p: [
    'A bowl turns toward its small-ring side. It runs nearly straight while it is fast and bends more and more as it slows, so most of the curve comes at the end of its run. Choosing Curve left or Curve right chooses the side.',
    'Greens differ in pace and in how much a bowl bends; a fast green bends more, a heavy green less. A lean on the green pulls every moving bowl steadily to one side.',
  ] },
  { title: '4. Weights', art: 'weights', p: [
    `Draw: the bowl comes to rest at the ring. Firm: it reaches the ring at about ${M(WEIGHTS[1].arrive)} m per second. Drive: it reaches the ring at about ${M(WEIGHTS[2].arrive)} m per second.`,
    'The game turns your ring, hand and weight into a heading and a speed that put the bowl there. A real bowler is never perfectly steady, so your hand adds a small random shake to heading and speed, and the oval shows its size. Rivals are shakier or steadier according to their skill.',
  ] },
  { title: '5. Rolling the jack', art: 'jack', p: [
    `The side that leads the end rolls the jack down the centre of the rink. It must run at least ${M(RINK.minJack)} m, stay inside the strings and stay out of the ditch. Otherwise it is rolled again by the same player. After three bad rolls the jack is set at ${M(RINK.centreSpot)} m.`,
    'A fair jack is then centred on the middle line of the rink before the first bowl.',
  ] },
  { title: '6. Order of play', art: 'order', p: [
    'The lead bowls first and the sides then alternate until all eight bowls are played. The winner of an end leads the next one. If an end is not scored or is replayed, the same side leads again.',
  ] },
  { title: '7. Bumps and kisses', p: [
    'A moving bowl that meets another bowl or the jack moves it, and loses some of its own pace. A bowl moves a jack much further than it moves another bowl. Anything can be moved until the end is finished, so a late Firm or Drive can change the whole head.',
  ] },
  { title: '8. Dead bowls and touchers', art: 'dead', p: [
    'A bowl that crosses a side string is dead and is taken off the green. A bowl that runs into the ditch is also dead, unless it touched the jack while still on its own run: that bowl is a toucher, is marked with a chalk T, and stays alive in the ditch.',
    'A toucher stays a toucher for the rest of the end, even if another bowl later moves it.',
  ] },
  { title: '9. The jack out of position', p: [
    'A jack that is driven into the ditch is still alive: only touchers count in that end. A jack that is driven across a side string is dead; the end is a dead end and is replayed by the same lead without a score.',
  ] },
  { title: '10. Scoring', art: 'score', p: [
    'When all eight bowls are played, distances are measured from the jack. The side with the nearest live bowl scores one shot for every one of its bowls that is nearer than the other side\'s nearest. If the two nearest bowls are exactly equal there is no score and the same side leads again.',
  ] },
  { title: '11. The match', p: [
    'A match is a fixed number of ends: 6 for a quick game, 10 for a full game. The side with more shots wins. If the match is level after the last end, extra ends are played until one side leads.',
  ] },
  { title: '12. Greens', p: [
    'Village: medium pace, no lean. Tournament: fast, bends a lot. Seaside: a cross-slope, its side chosen at random each match. Heavy: damp and slow, needs more weight. Daily: a new seeded mix of pace, bend and lean each day.',
  ] },
  { title: '13. Modes', p: [
    'Play vs Computer: choose a rival, a green and the number of ends. Two Players: both of you bowl on the same device. Club Ladder: five matches of six ends on five different greens against rising rivals; win to climb, lose and you try the rung again. Watch & Learn: two rivals play; Pause freezes everything and you can change how long they think.',
  ] },
  { title: '14. What is simplified', p: [
    'There are no foot faults, no measuring disputes, no marker or umpire, one rink size and one fixed ditch length, and bowls are bigger than life on screen. A bowl that strays across the side string is dead at once rather than when it comes to rest. Pace and bias are simplified models, tuned to feel like a club green.',
  ] },
];
