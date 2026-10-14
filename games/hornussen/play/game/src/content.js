// Reference text for the How to Play, About and Rules screens. Every number below is built from rules.js (the single source of
// truth), so the pages cannot drift from the engine. `art` names a picture drawn by view.js (drawRulesArt) with the game's own art.
import { RIES, ROWS, COLS, BOARD, MIN_SCORING, MAX_THROWS, TENSION, LEN_STEPS, VENUES, LEVEL_NAMES, levelInfo } from './rules.js';

const n = (v) => String(Math.round(v * 100) / 100);
const secs = (a, b) => `${n(a)} to ${n(b)} seconds`;
const [upA, upB] = [BOARD.upA, levelInfo('normal').upB];
const FIELDERS = ROWS.length * COLS.length;

export const HOW = [
  { h: 'Who you are', art: 'puck', p: [
    'One half of the match you are the STRIKER. You stand beside a wooden ramp, the Bock, with a long bending rod, the Träf. The puck, the Nouss, sits on the ramp: you whip the rod over your shoulder and hit it as far down the meadow as you can.',
    'The other half you are the DEFENDER. The other side strikes, and you tap your fielders to throw their wooden boards, the Schindel, up into the air in front of the flying puck.',
  ] },
  { h: 'A match', art: 'ries', p: [
    `Hornussen is played on a long, narrow meadow called the Ries. One side strikes a small puck, the Nouss, from a wooden ramp, the Bock. The other side stands out in the Ries with wooden boards, the Schindel, and tries to stop the Nouss in the air.`,
    `A match has two halves. In each half one side strikes and the other fields, then you swap. You strike ${LEN_STEPS[1]} times per half in a standard match. The side with more points at the end wins.`,
  ] },
  { h: 'When you strike', art: 'meter', p: [
    'PRESS AND HOLD anywhere on the screen. The Träf (the long, flexible rod) bends back and the tension meter fills, then eases, then fills again.',
    'Slide your finger left or right to move your aim across the Ries. The ring on the meadow shows where the Nouss should land. The longer the tension when you let go, the farther it flies.',
    `RELEASE when the tension is high and rising, in the gold zone of the meter, for a perfect whip: more reach and a tighter flight. Let go too early and it falls short, and a perfect whip at full tension can fly out over the end of the Ries.`,
  ] },
  { h: 'Wind', art: 'wind', p: [
    'The flag shows the wind. Wind pushes the Nouss sideways while it flies. Move your aim against the wind, or turn on the Aim guide in Settings to see the ring already corrected.',
  ] },
  { h: 'When you field', art: 'board', p: [
    `The Nouss comes in from the Bock. Its shadow slides across the Ries and a ring marks where it will pass the line of fielders. TAP the fielder nearest to that ring, a moment before the Nouss arrives: he throws his Schindel up, and if the board is up as the Nouss passes through it, the Nouss is stopped.`,
    `You have ${MAX_THROWS.normal} boards to throw per Nouss (${MAX_THROWS.easy} on Easy). Pick the fielder whose line the Nouss crosses low enough to reach; the ring turns gold when it is time to tap.`,
  ] },
  { h: 'Points', art: 'zones', p: [
    `A Nouss that is not stopped and lands inside the Ries is a Nummer for the striking side: 1 point (landing ${MIN_SCORING} to 104 m away), 2 points (105 to 134 m) or 3 points (135 m or more). Short strikes, strikes that land outside the Ries and stopped strikes score nothing.`,
  ] },
  { h: 'Hint and Auto Play', p: [
    'Hint shows what a good striker or fielder would do right now and why. Auto Play (Watch & Learn) on the menu plays a whole match by itself: the computer thinks, shows its choice, then acts. You can pause it at any time and change its thinking time.',
  ] },
];

export const ABOUT = [
  { h: 'About Hornussen', p: [
    'Hornussen is a traditional field sport of Switzerland, played in clubs across the country. A striker launches a small puck, the Nouss, off a ramp with a long, flexible rod; it screams through the air and the fielding side tries to knock it down with big wooden boards before it lands.',
    'The sport is usually placed in the Swiss countryside of the centuries before modern times, and its exact origins are uncertain. It is still played today in village meadows, with its own words for everything: Nouss, Träf, Bock, Schindel and Ries.',
  ] },
  { h: 'This version', p: [
    'This is a simplified match for your phone, with the real words and the real idea: strike with a bending rod, then defend with timed boards. It is not an official simulation. A real match has bigger sides and more strikes; here a match is a short, quick contest between two sides of twenty fielders each.',
    `Four venues are named after Swiss regions: ${VENUES.map((v) => v.name).join(', ')}. They change the light and the wind. Play against the computer at ${Object.values(LEVEL_NAMES).join(', ')} level, ask for a Hint any time, or watch a whole match with Auto Play.`,
  ] },
  { h: 'Free preview and unlock', p: [
    'Your first 90 seconds of match play are free. A single one-time purchase then unlocks the whole game, with no ads and nothing else to buy. Restore purchase is on the unlock screen. Menus, Settings, the Rules and Auto Play never use up the preview.',
  ] },
  { h: 'Play and wellness', p: [
    'Nothing is staked: you play for the match. Text size can be raised to 300% in Settings and on every reading page, and Reduced motion calms the animation.',
  ] },
  { h: 'Credits', p: [
    'Barlow typeface by Jeremy Tribby, SIL Open Font License 1.1. All art and sound are drawn and synthesized by the game itself.',
  ] },
];

export const RULES = [
  { h: 'The sides and the Ries', art: 'ries', p: [
    `Two sides play. In each half one side is the striking side and the other is the fielding side. Both always have the same shape: ${FIELDERS} fielders stand in the Ries in ${ROWS.length} lines of ${COLS.length}.`,
    `The Ries is ${RIES.len} m long and ${RIES.half * 2} m wide, measured from the Bock. The lines of fielders stand ${ROWS.join(', ')} m from the Bock; the columns stand ${COLS.join(', ')} m from the centre line.`,
  ] },
  { h: 'The Bock and the Träf', art: 'meter', p: [
    'The Nouss rests on the Bock, a wooden ramp. The striker hits it with the Träf, a rod of about three metres that flexes strongly and whips the Nouss away.',
    `Your hold on the screen builds tension. The meter climbs from empty to full in ${n(TENSION.rise)} seconds, eases back in ${n(TENSION.fall)} seconds, and repeats for as long as you hold. The gold zone sits between ${Math.round(TENSION.perfectA * 100)}% and ${Math.round(TENSION.perfectB * 100)}% of full tension while it is rising.`,
  ] },
  { h: 'Distance and aim', art: 'zones', p: [
    'The tension you release at sets the distance. A perfect whip adds 7% to the distance and tightens the scatter. Even a perfect strike has a small random scatter sideways and in depth; a strike that is not released in the gold zone scatters about twice as much.',
    `A strike from a computer striker scatters according to its level. The wind pushes the Nouss sideways in proportion to how long it flies; the venue sets the strongest wind (${VENUES.map((v) => `${v.name} ${n(v.wind)} m/s`).join(', ')}) and the wind changes a little before every strike.`,
  ] },
  { h: 'The flight', art: 'flight', p: [
    'The Nouss flies on a smooth arc: it climbs, hangs and sinks. A far strike flies longer and higher. Its shadow runs along the ground so you can see where it is going; a ring in the air shows where it will pass the next line of fielders.',
    'A strike that lands in front of the first fielding line is dead: it cannot be stopped, and it cannot score.',
  ] },
  { h: 'The Schindel', art: 'board', p: [
    `A fielder throws his Schindel straight up when you tap him. The board is a blocking board from ${n(upA)} seconds after the throw until ${n(upB)} seconds after it (Steady and Sharp; Easy keeps it up until ${n(levelInfo('easy').upB)} seconds). The best moment is ${n(BOARD.peak)} seconds after the tap.`,
    `A board stops the Nouss if, at the moment the Nouss passes through the line of that fielder, the board is up, the Nouss is no higher than ${BOARD.reach} m and no farther sideways than ${n(BOARD.half + BOARD.lat)} m from him. The fielder steps sideways to meet it, so each column covers its own part of the Ries; only a thin sliver halfway between two columns is out of reach.`,
    `You may throw up to ${MAX_THROWS.normal} boards per Nouss (${MAX_THROWS.easy} on Easy). A Nouss that lands in front of a fielder's line never passes through it, and one that passes high above a line has to be met by a line farther out.`,
  ] },
  { h: 'Scoring', art: 'zones', p: [
    `A Nouss that is not stopped and lands inside the Ries is a Nummer for the striking side. Landing ${MIN_SCORING} to 104 m away scores 1, 105 to 134 m scores 2, and 135 m or more scores 3.`,
    'A stopped Nouss scores nothing for the striking side. A Nouss that lands outside the side lines, or beyond the end of the Ries, scores nothing either.',
    'Simplification: real matches count Nummern per striker over many strikes and have their own scoring tables. This game uses the zone points above so that a long, risky strike is worth more than a short, safe one.',
  ] },
  { h: 'The match', art: 'flow', p: [
    `A match is two halves. In each half the striking side makes ${LEN_STEPS[0]}, ${LEN_STEPS[1]} or ${LEN_STEPS[2]} strikes (Short, Standard or Long); each striker takes two. Then the sides swap. You choose whether to strike first in the setup.`,
    'After the second half the side with more points wins. If the points are level, the match is a draw.',
  ] },
  { h: 'The computer', p: [
    `The computer sees the whole flight, but it is not perfect. Its fielders only react to ${Math.round(levelInfo('easy').att * 100)}% (Easy), ${Math.round(levelInfo('normal').att * 100)}% (Steady) or ${Math.round(levelInfo('hard').att * 100)}% (Sharp) of the strikes they could reach, and their timing is off by a few tenths of a second. A computer striker picks one of the best targets for the level: Easy chooses among its six best targets, Steady among three, Sharp always takes the best one, and each aims with the level's own scatter.`,
  ] },
  { h: 'Hint, Auto Play and the free preview', p: [
    'Hint names the fielder to tap and the moment (fielding), or the target and tension to aim for (striking). Auto Play plays a whole match between two computer sides: it thinks (2, 5, 8 or 10 seconds), shows its choice for 2 seconds, then plays it. Pause freezes everything.',
    'Match play uses the 90-second free preview; menus, Rules, Settings and Auto Play do not. After that one purchase unlocks the whole game.',
  ] },
];
