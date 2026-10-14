// Text screens: About, How to Play and the paged Rules reference. Numbers come from engine.js so the text cannot drift from the engine.
// Blocks: { h } heading, { p } paragraph, { li } bullet, { fig: name, hh: height } a figure drawn with the game's own art, { sp } gap.
import { VENUES, STANCE, CATCH_CD, WIND_FAST, WIND_LOB, HOLD_MAX, THINK_TIMES } from './engine.js';

const mm = (s) => (s % 60 === 0 ? `${s / 60} minutes` : `${Math.floor(s / 60)} min ${s % 60} s`);
const venueLines = VENUES.map((v) => (v.kind === 'court'
  ? `${v.name} (${v.place}, ${v.local}): ${v.per} against ${v.per}, ${v.balls} ball${v.balls > 1 ? 's' : ''}, ${mm(v.time)}${v.drag < 1 ? ', heavy sand slows everyone' : ''}.`
  : `${v.name} (${v.place}, ${v.local}): ${v.dodgers} dodgers inside, ${v.ring} on the ring, ${v.balls} ball${v.balls > 1 ? 's' : ''}, ${mm(v.time)}.`));

export const ABOUT = [
  { h: 'Circle Dodgeball' },
  { p: 'Throw a soft ball, burn the other side, and catch what they send back. Games like this are played in school yards, gyms and squares all over the world, and the version in this app takes its three best-known forms: Queimada in Brazil (the word means "burned"), Volkerball in Germany and Palla avvelenata ("poisoned ball") in Italy.' },
  { p: 'Queimada is played by two teams on either side of a line, where a hit player is "burned" and waits behind the other team, but can still throw from there. In Volkerball and Palla avvelenata a ring of throwers stands round the dodgers in the middle, and every dodger who is hit joins the ring.' },
  { h: 'This version' },
  { li: 'Four places: a school patio in Brazil, a gym in Germany, an old piazza in Italy and a Brazilian beach.' },
  { li: 'You run one player of your team. Tap to run, tap a player to throw, and press Catch at the last moment to burn the thrower.' },
  { li: 'Fast throws are quick but easy to catch if the target is ready; lobs arc over the others and drop in a small area.' },
  { li: 'Ring places can be played as a dodger inside the circle or as a thrower on the ring.' },
  { li: 'Watch and Learn plays a whole game for you with time to think before each move, and you can pause it. A Hint button works in the real game too.' },
  { li: 'A full Rules page and text size up to 300%. Sound is made on your device. No ads, works offline. Points only: there are no stakes, chips or money.' },
  { sp: 1 },
  { p: 'Simplifications: the many local rule sets differ in the number of players, whether a ball that hits the floor first counts, and how a catch revives players. This game uses one clear set, written on the Rules page. The people are invented and carry no real names.' },
  { sp: 1 },
  { p: 'Made by Arcforge. One game in a growing collection of the world\'s heritage games.' },
];

export const HOWTO = [
  { h: 'The quick version' },
  { li: 'Tap the ground to run there. Drag to steer. Your player has a gold ring.' },
  { li: 'Run over a loose ball on your side to pick it up. With the ball, tap an opponent to throw at them.' },
  { li: 'Tap a teammate (or a cemetery or ring player) to pass the ball to them instead.' },
  { li: 'Rings under the opponents: green means they cannot catch for a moment, red means a catch is coming.' },
  { li: `The Fast / Lob button picks the throw. Fast arrives in under a second. A lob arcs high and drops: it can fly over a player in the way.` },
  { h: 'Defence' },
  { li: 'A red ring on the ground shows where a ball will land and how long you have.' },
  { li: `Run sideways out of its line, or press Catch just before it arrives. The catch stance lasts ${STANCE} seconds and then needs about ${CATCH_CD} seconds to recover, so do not spam it.` },
  { li: 'A catch burns the thrower and brings a teammate back into play.' },
  { h: 'Winning' },
  { li: 'Queimada: burn everyone on the other side, or have more players left when time runs out.' },
  { li: 'Ring games: dodgers win by lasting until time runs out; the ring wins by burning every dodger.' },
  { li: 'Hint shows what a good player would do now and why. Watch and Learn plays whole games for you.' },
  { sp: 1 },
  { p: 'Keyboard: arrow keys or WASD run, Space throws at the best target, C catches, L switches fast and lob, H hint, Esc pause.' },
];

export const RULES = [
  { title: 'The idea', blocks: [
    { h: 'What you are playing' },
    { p: 'Two sides, a painted circle and a soft ball. A player who is hit by a ball in the air is burned and leaves play. A player who catches a ball in the air burns the thrower and brings a teammate back. The side with players still in play when the other has none, or when time is up, wins.' },
    { fig: 'court', hh: 250 },
    { p: 'You always play the orange team. Your player has a gold ring and the others on your team are played by the game.' },
    { h: 'Two formats' },
    { li: 'Court (Queimada): each team keeps to its own half. A burned player goes to the cemetery on the rim behind the other team.' },
    { li: 'Ring (Volkerball, Palla avvelenata): dodgers move inside the circle, the ring throws from outside it. A burned dodger joins the ring.' },
  ] },
  { title: 'Court rules', blocks: [
    { h: 'The court' },
    { p: 'A circle split in two by the centre line. You may not cross the line. Balls start on the line; the nearest player on each side runs for them.' },
    { h: 'Picking up balls' },
    { li: 'A ball that is lying or rolling slowly can be picked up by a player who runs over it, if it is on that player\'s side of the line (or within a step of it).' },
    { li: `A ball can be held for at most ${HOLD_MAX} seconds: after that it is taken and dropped.` },
    { h: 'Burning' },
    { li: 'A ball thrown by the other side that touches a player before it touches the floor or the fence burns that player.' },
    { li: 'A ball that touched the floor or the fence is dead: it hurts nobody until it is picked up and thrown again.' },
    { li: 'A burned player walks to the cemetery on the rim behind the other team. From there he can pick up balls that roll to him and throw them at the players still in the court. A ball thrown from the cemetery burns exactly like any other.' },
    { fig: 'cemetery', hh: 230 },
  ] },
  { title: 'Ring rules', blocks: [
    { h: 'The ring' },
    { p: 'The ring stands on the line round the circle and may only walk along it. Ring players never come inside. The dodgers stay inside the circle.' },
    { li: 'Only the ring throws. A ball that comes to rest among the dodgers is sent back to a free ring player.' },
    { li: 'Ring players may pass the ball to each other to find a better angle: tap a teammate.' },
    { h: 'Dodgers' },
    { li: 'A dodger hit by a live ball is out of the circle and joins the ring, and throws at the dodgers who are left.' },
    { li: 'A dodger who catches a ball sends it back to the ring, makes the thrower kneel for four seconds, and brings back the dodger who has been waiting longest.' },
    { fig: 'ring', hh: 250 },
    { h: 'Winning' },
    { li: 'The dodgers win when time runs out with at least one dodger still inside.' },
    { li: 'The ring wins by burning every dodger before time runs out.' },
  ] },
  { title: 'Throwing', blocks: [
    { h: 'Aim and release' },
    { p: 'Tap an opponent. Your player turns, winds up and releases. The throw aims a little ahead of a moving target, so the player who keeps moving is harder to hit. Aim at someone who is standing still, who is busy, or who has just used the catch.' },
    { h: 'The rings under the opponents' },
    { p: 'While you hold the ball a ring appears under every opponent. Red: the hands are open now, a catch is coming. Yellow: a catch is possible. Green: the hands are recovering and cannot catch for a moment, so that is the one to aim at.' },
    { h: 'Fast and lob' },
    { li: `Fast: flat and quick. Wind-up ${WIND_FAST} s. The target has very little time and will usually need to catch it.` },
    { li: `Lob: slow and high. Wind-up ${WIND_LOB} s. It passes over players on the way and comes down on one spot, so it is hard to catch but easy to step away from.` },
    { fig: 'lob', hh: 250 },
    { h: 'Passing' },
    { p: 'Tap a teammate who is not holding a ball: the ball goes to them in a soft pass. A pass cannot burn anyone and can be caught by any teammate.' },
  ] },
  { title: 'Catching', blocks: [
    { h: 'The catch stance' },
    { p: `Press Catch. Your player opens both hands for ${STANCE} seconds. A live ball that reaches you while the hands are open is caught, even a fast one. Then the hands need ${CATCH_CD} seconds in total before they can open again, and nobody can catch while holding a ball.` },
    { li: 'A caught ball burns its thrower (court) or makes the thrower kneel for four seconds (ring).' },
    { li: 'A caught ball also brings back the player who has been out longest.' },
    { li: 'Catching while moving is slow: you move at less than half speed while the hands are open.' },
    { fig: 'catch', hh: 240 },
    { h: 'Warnings' },
    { p: 'For every live ball that is heading for your player the game draws a red ring on the ground where it will arrive, and a count of how many tenths of a second you have. It is a help, not a promise: another player can still move in the way.' },
  ] },
  { title: 'Places', blocks: [
    { h: 'The four places' },
    ...venueLines.map((l) => ({ li: l })),
    { h: 'Opponents' },
    { p: 'Each place has its own level of play: how soon the other players react, how well they aim, how often they try a catch. They plan the same way you can see in Watch and Learn.' },
  ] },
  { title: 'Scoring', blocks: [
    { h: 'Points' },
    { li: '100 for each player you burn.' },
    { li: '150 for each catch, and 50 for each teammate brought back.' },
    { li: '300 for winning, and 3 for each second left on the clock. 20 off for each time you are hit.' },
    { h: 'Stars' },
    { li: 'One star for a win.' },
    { li: 'Court and dodger games: a second star if at least half of your side is still in play, and a third for at least one catch.' },
    { li: 'Ring games as the ring: a second star for winning with more than 30 percent of the time left, and a third for burning two or more dodgers yourself.' },
    { p: 'Your best result in each place and role is saved on this device.' },
  ] },
  { title: 'Hints and Watch and Learn', blocks: [
    { h: 'Hint' },
    { p: 'The Hint button shows what a good player would do right now: the ball to catch, the line to step out of, the opponent to aim at, the teammate to pass to. A ring marks the place and a few lines say why.' },
    { h: 'Watch and Learn' },
    { p: `The game plays a whole match on the patio. Before every move it stops the court and thinks (${THINK_TIMES.join(', ')} seconds, your choice in Settings, never more than 10), then shows its choice for two seconds, then plays that move for real. You can pause it at any moment and the whole court freezes, including the balls in the air.` },
    { h: 'Settings' },
    { li: 'Sound on or off, think time, reduced motion (fewer sparks and no screen shake), text size from 100% to 300% on every text screen.' },
  ] },
  { title: 'Simplifications', blocks: [
    { h: 'What this game leaves out' },
    { li: 'Many school rule sets let a ball that bounced first count as a hit, or burn a player for stepping over the line. Here only a ball in the air burns.' },
    { li: 'Some rule sets give a burned player a second life after a number of hits or a "poisoned" ball that cannot be revived. Here a catch brings back the player who waited longest.' },
    { li: 'The number of players per side differs from place to place; the sizes in this game are 3, 4, 5 and 5.' },
    { h: 'Credit' },
    { p: 'The tradition belongs to the schools, streets and beaches where it is played: Brazil, Germany and Italy among many others. Every person in this game is invented.' },
  ] },
];

// The credits of the 3D layer (web/vendor3d/LICENSES.md, fetched by the presenter): shown under About, as the licence asks.
export function licenseBlocks(text) {
  if (!text) return [];
  const out = [{ sp: 1 }, { h: 'Credits and licences' }];
  const paras = String(text).split(/\n\s*\n/).map((q) => q.trim()).filter((q) => q && !/must show this text|^# /.test(q));
  for (const q of paras) {
    const one = q.replace(/\s*\n\s*/g, ' ');
    if (/^## /.test(one)) { out.push({ h: one.replace(/^## /, '') }); continue; }
    if (/^\* /.test(q)) { for (const item of q.split(/\n(?=\* )/)) out.push({ li: item.replace(/^\* /, '').replace(/\s*\n\s*/g, ' ') }); continue; }
    out.push({ p: one });
  }
  return out;
}
