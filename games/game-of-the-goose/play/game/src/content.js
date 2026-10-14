// Text for About, How to Play and the Rules book. Every number is read from engine.js (the module the game runs on), so the text cannot drift.
import {
  FINAL, GEESE, BRIDGE, INN, WELL, MAZE, PRISON, SKELETON, OPENING, ROADS, MAX_FEATHERS, TALLY, VARIANT_INFO, FEATHER_VALUE,
} from './engine.js';
import { THINK_CHOICES, REVEAL_SECONDS, DEMO_GAMES, PREVIEW_NOTE, MIN_SEATS, MAX_SEATS } from './rulesdata.js';

const list = (a) => a.join(', ');
const roadsText = ROADS.map((r) => `${r.from} to ${r.to} (${r.name})`);
const opening = Object.entries(OPENING).map(([k, v]) => `${k.replace(',', ' and ')} goes to ${v}`);

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Game of the Goose' },
    { p: 'The Game of the Goose is a race game on a spiral of 63 picture spaces. It is known from the late sixteenth century in Italy, where printed boards of the game were being made and sent as gifts to royal courts, and it soon spread across Europe: the Gioco dell\'Oca in Italy, the Juego de la Oca in Spain, the Jeu de l\'Oie in France, and many other names besides. It is one of the oldest printed commercial board games and the ancestor of a great family of dice-and-track games.' },
    { p: 'Players throw two dice and move along the spiral. Geese carry you on twice as far; a bridge, an inn, a well, a prison, a maze and a skeleton each change your fortunes; and whoever lands exactly on the 63rd space, the Garden of the Goose, wins. Boards were printed with a different picture on every space, so each throw was a small story.' },
    { h: 'About this game' },
    { p: 'This version keeps the classic game as it was played, with all of its geese and hazards, and tells every turn as a short story. The board and all of its pictures are original drawings in the manner of a hand-painted, engraved Renaissance print; none is copied from a historic plate.' },
    { p: 'The classic game is a pure game of chance, so for people who want more to think about this version adds three clearly marked, optional variants (a choice of dice, shortcut roads and feathers). Each one can be switched off, and with all three off the game is exactly the classic. The Rules book explains them in full.' },
    { p: 'Regional board layouts, picture sets and house rules differ a great deal from place to place; this version uses one common set of spaces. Where the historic rules differ (the number of turns lost at the inn, how a player is freed from the well) the choice made here is stated on the Rules pages.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. Text is set in Cinzel and Cormorant Garamond (SIL Open Font License 1.1). Boards, pawns and pictures are drawn in code; no ads, no betting, works offline.' },
    { h: '3D credits' },
    { p: 'The table, the board, the turned pawns, the geese and the dice are modelled in code for this game and drawn with three.js (MIT License, Copyright 2010-2024 three.js authors) through the shared Arcforge 3D layer. That layer also carries the Microsoft Rocketbox avatars (MIT License, Copyright 2020 Microsoft) and motion data from Quaternius (CC0) and the Carnegie Mellon University motion capture database; none of those appear in this game. The full licence texts ship with the game in vendor3d/LICENSES.md.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: `Be the first pawn to land exactly on space ${FINAL}, the Garden of the Goose at the centre of the spiral.` },
    { fig: 'spiral', hh: 330 },
    { h: 'On your turn' },
    { li: 'Tap Roll. Two dice tumble and the narrator tells you what you threw.' },
    { li: 'Your pawn walks the total along the spiral. If it ends on a goose, it walks the same number again, and again for each goose.' },
    { li: 'If it ends on a picture space, that space has its own effect: a bridge, an inn, a well, a prison, a maze or a skeleton.' },
    { li: 'Then it is the next player\'s turn. The narrator at the bottom of the board keeps the story of the game.' },
    { h: 'With the variants on' },
    { li: 'Two dice, one choice: after a throw you may move by the total or by either die alone. Tap the one you want.' },
    { li: 'Shortcut roads: when you stop on a signpost you may take the dotted road to the space it points at.' },
    { li: 'Feathers: each goose gives a feather (up to three). Spend one to roll again, or to slip past a hazard you are about to land on.' },
    { h: 'Help' },
    { li: 'The lightbulb button gives a hint: it marks the move the computer would choose and says how many turns it expects to need.' },
    { li: 'Watch and Learn plays a whole game for you: it thinks, shows its options, then acts. Pause it whenever you like.' },
    { h: 'On a keyboard' },
    { p: 'Space or Enter rolls and takes the first choice. 1, 2 and 3 pick the choice buttons. H gives a hint. P or Escape pauses.' },
  ],
};

export function rulesPages() {
  const geeseList = list(GEESE);
  return [
    {
      title: 'The board and the goal',
      blocks: [
        { h: 'The spiral' },
        { p: `The board is a spiral of ${FINAL} spaces. Space 1 is on the outside and space ${FINAL}, the Garden of the Goose, is at the centre. Pawns start off the board, on the Start flag, and travel inwards in order of the numbers.` },
        { fig: 'spiral', hh: 360 },
        { h: 'The goal' },
        { p: `The first pawn to land exactly on space ${FINAL} wins. Everyone else is ranked by how far they got and the feathers they hold (see Seats and scoring).` },
        { h: 'Players' },
        { p: `${MIN_SEATS} to ${MAX_SEATS} players. Each seat is a human or a computer player. Human seats are played one after another on the same screen.` },
        { h: 'No stakes' },
        { p: 'There are no stakes and no betting in this game. It is a game of scores and stories.' },
      ],
    },
    {
      title: 'A turn',
      blocks: [
        { h: 'Throw and walk' },
        { p: 'On your turn you roll two dice and walk your pawn forward by the total, one space at a time, along the spiral. Other pawns may stand on the same space: pawns never block or capture each other.' },
        { h: 'The opening throw' },
        { p: `On a player's very first throw, a roll of 3 and 6 leaps straight to space ${OPENING['3,6']}, and a roll of 4 and 5 leaps to space ${OPENING['4,5']} (${list(opening)}). This applies only to the first throw of the game for that player, and replaces the move you would have made.` },
        { h: 'What happens when you stop' },
        { p: 'When your walk ends the space you stopped on decides what comes next: nothing, or a goose, or one of the picture spaces on the next pages. Then it is the next player\'s turn.' },
      ],
    },
    {
      title: 'Geese',
      blocks: [
        { h: 'The geese' },
        { p: `There are ${GEESE.length} geese on the spiral: spaces ${geeseList}. They are spaced alternately four and five spaces apart, and the last one is on ${GEESE[GEESE.length - 1]}, just before the finish.` },
        { fig: 'geese', hh: 150 },
        { h: 'Double the move' },
        { p: 'If your move ends on a goose, you walk again the same number of spaces you just walked, in the same direction. If that ends on another goose you walk again, and so on until you stop on a space that is not a goose. For example a throw of 5 from the start ends on the goose at 5, so you walk 5 more and stop on 10.' },
        { p: 'Backwards walks (after bouncing off the Garden, see the finish page) also double in the direction of travel.' },
        { h: 'Feathers' },
        { p: 'In the Feathers variant every goose you land on, including those within a chain, gives you a feather. See the Feathers page.' },
      ],
    },
    {
      title: 'The special spaces',
      blocks: [
        { h: 'Pictures with effects' },
        { fig: 'specials', hh: 520 },
        { li: `Bridge (${BRIDGE.at}): you cross to space ${BRIDGE.to} at once.` },
        { li: `Inn (${INN.at}): you rest. You miss your next turn (${INN.skips} turn).` },
        { li: `Well (${WELL.at}): you fall in and wait there until another player lands on the well (see Well and prison).` },
        { li: `Maze (${MAZE.at}): you lose your way and go back to space ${MAZE.to}.` },
        { li: `Prison (${PRISON.at}): you are shut in and wait there until another player lands on the prison.` },
        { li: `Skeleton (${SKELETON.at}): you start again from the Start flag.` },
        { li: `Garden of the Goose (${FINAL}): the finish. Land on it exactly to win.` },
        { p: 'The skeleton is a plain, old-fashioned "go back to the beginning" space.' },
      ],
    },
    {
      title: 'The finish',
      blocks: [
        { h: 'Exactly 63' },
        { p: `You must land exactly on ${FINAL}. If your move would take you past it, you walk to ${FINAL} and then walk the remaining spaces back again. For example from 60 a roll of 5 takes you to 63, then back 2 spaces, and you stop on 61.` },
        { fig: 'bounce', hh: 150 },
        { p: 'If a bounce ends on a goose, you walk the move again, backwards. If it ends on a hazard, the hazard applies.' },
        { h: 'Seeking the last spaces' },
        { p: 'Spaces near the end are slow with two dice, because only the right total will do. This is the main reason the plain game can last longer than you expect, and why the choice of dice (below) matters so much late in a game.' },
      ],
    },
    {
      title: 'Well and prison',
      blocks: [
        { h: 'Waiting for rescue' },
        { p: `If you stop on the well (${WELL.at}) or the prison (${PRISON.at}) you stay there. You are freed when another player stops on the same space: that player takes your place in the well or prison, and you walk on at your next turn.` },
        { h: 'A way out of your own' },
        { p: `So that no game can stall with every pawn stuck, you may also climb out by yourself: on your turn, if you throw a double (both dice the same), you are freed and walk that total at once. Any other throw leaves you where you are. This is a rule of this version; some historic sets of rules ask you to wait several turns instead.` },
        { h: 'Feathers and rescue' },
        { p: 'With Feathers on, a feather spent on the space you are about to land on lets you slip past the well and the prison altogether.' },
      ],
    },
    {
      title: 'Variant: two dice, one choice',
      blocks: [
        { h: 'Optional variant' },
        { p: `${VARIANT_INFO.choice.name}: ${VARIANT_INFO.choice.short} This is an optional variant that is not part of the historic game. Switch it off in the setup screen to play the classic.` },
        { fig: 'dicechoice', hh: 230 },
        { h: 'How it works' },
        { p: 'After you roll, you may move by the total of both dice, or by either die alone (if both dice show the same number there is just one single-die choice). Tap the move you prefer. Each choice shows where it would end.' },
        { p: 'The opening throws (3 and 6, 4 and 5) are only available as the total.' },
        { h: 'Why it matters' },
        { p: 'A single die lets you land on a goose that the total would miss, avoid a hazard, or finish exactly on the Garden. The computer players weigh every option; the hint button shows what they would choose.' },
      ],
    },
    {
      title: 'Variant: shortcut roads',
      blocks: [
        { h: 'Optional variant' },
        { p: `${VARIANT_INFO.roads.name}: ${VARIANT_INFO.roads.short} This is an optional variant that is not part of the historic game.` },
        { fig: 'roads', hh: 300 },
        { h: 'The four roads' },
        ...ROADS.map((r) => ({ li: `${r.name}: from space ${r.from} to space ${r.to}.` })),
        { p: `When your move ends on a signpost space (${list(ROADS.map((r) => r.from))}) you may take its road at once and stand on the space at the far end. You can decline and stay. A road does not give a second turn and its end space has no effect of its own.` },
        { p: 'Roads are not always the best choice: where you stand decides which geese and hazards are within reach next turn.' },
      ],
    },
    {
      title: 'Variant: feathers',
      blocks: [
        { h: 'Optional variant' },
        { p: `${VARIANT_INFO.feathers.name}: ${VARIANT_INFO.feathers.short} This is an optional variant that is not part of the historic game.` },
        { fig: 'feather', hh: 150 },
        { h: 'Collecting' },
        { p: `Every time you land on a goose (including each goose in a chain) you pick up a feather. You can hold at most ${MAX_FEATHERS}.` },
        { h: 'Spending' },
        { li: 'Roll again: after you roll, spend one feather to throw the dice again, once per turn.' },
        { li: `Slip past a hazard: when your move would end on the inn, the well, the maze, the prison or the skeleton, spend one feather and you simply stay on that space with no effect. The bridge needs no help.` },
        { h: 'Keeping' },
        { p: `Each feather you still hold when the game ends is worth ${TALLY.perFeather} points in the final tally. The computer values a feather at about ${FEATHER_VALUE.toFixed(1)} turns.` },
      ],
    },
    {
      title: 'Seats and scoring',
      blocks: [
        { h: 'Seats' },
        { p: `Choose ${MIN_SEATS} to ${MAX_SEATS} seats on the setup screen; tap a seat to switch it between a human player, a computer player and empty. Human players take turns on the same screen, so you can pass the device around the table.` },
        { h: 'Tally' },
        { p: `When a pawn wins, every pawn gets a tally: the space it reached, plus ${TALLY.perFeather} for each feather held, plus ${TALLY.winner} for the winner. The tally ranks the table. It is only for fun: there are no stakes.` },
        { h: 'Statistics' },
        { p: 'Settings keeps your own record: games played and won, your fastest win in turns and the feathers you have gathered.' },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The computer plays' },
        { p: `Watch and Learn plays a whole game with computer players using the variants you picked. Before each decision it thinks (${list(THINK_CHOICES)} seconds, you choose in Settings, up to ${THINK_CHOICES[THINK_CHOICES.length - 1]}), then reveals the options and its choice for ${REVEAL_SECONDS} seconds, then acts. The pause button freezes the whole show, and resumes it exactly where it stopped.` },
        { h: 'Hints' },
        { p: 'In your own games the lightbulb button shows what the computer would choose and its estimate of the turns still needed.' },
        { h: 'Free preview and demo' },
        { p: `${PREVIEW_NOTE} The web demo plays ${DEMO_GAMES} games. Menus, Rules, About, Watch and Learn, pause and the result screens are always free.` },
      ],
    },
  ];
}
