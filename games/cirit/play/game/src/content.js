// All reader text (About, How to Play, Rules) and the Learn lessons. Everything here is cross-checked against consts.js and sim.js.
import { LEVELS, HORSES, PTS, JAV_N, Z_END, LONG_RANGE, PASS_MAX, REACH_MAX, LEAN_SAFE, LEAN_T, HIT_R, BULL_R, SOLID_R } from './consts.js';

export const ABOUT = [
  { title: 'Cirit, the horseback javelin game', p: [
    'Cirit (also called jereed) is a traditional mounted game of Turkey and neighbouring lands. Riders on swift horses chase one another across a long field, throw blunt wooden sticks at the rider in front, and wheel away before the answer comes back.',
    'It is a display of horsemanship, speed and aim, played at village festivals and in regional leagues, especially across Anatolia, and it is a living part of the region\'s heritage.',
  ] },
  { title: 'About this version', p: [
    'This is a friendly, simplified game for one player against the computer. The sticks are blunt and are thrown at a round target standard carried on the rider\'s back; points are for aim, style and dodging, never for harm. The horses are never touched.',
    'Real teams ride many horses at once and play by local rules. Here a team of three sends out one rider at a time, which keeps every chase easy to read on a phone. The rules page lists each simplification.',
  ] },
  { title: 'Made with', p: [
    'Cirit is part of Arcforge, a collection of heritage games from around the world. The horses and riders are stylised 3D figures with their own walking, cantering and galloping gaits.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [
    'Two teams of three riders. Each bout pairs one rider from each team on a long field. In the first pass one rider chases and throws; in the second you swap and the other one chases. Points decide the match.',
  ] },
  { title: 'Riding', p: [
    'Slide the pace bar on the left (up is faster). A canter is safe; a full gallop scores style points but shakes your aim and tires the horse.',
    'Your horse changes lane for you while you chase. When you are the one fleeing, swipe up or down on the right half to change lane.',
  ] },
  { title: 'Chasing and throwing', p: [
    'Close up to within a few lengths of the runner. A ring on the ground shows where your javelin will pass the runner\'s target. Drag it ahead of him to lead the throw, up or down to pick the lane, and let go to throw.',
    'The javelin takes about half a second to arrive, so aim where the runner WILL be. The dotted arc shows the flight. Short throws are steadier; long throws earn extra points.',
  ] },
  { title: 'Fleeing and dodging', p: [
    'When the rival winds up, a red ring shows where his javelin is heading. Leave that spot: change lane, change pace, or tap LEAN to hang off the side of the saddle for a moment.',
  ] },
  { title: 'Scoring', p: [
    `Bullseye ${PTS.bull}, solid hit ${PTS.solid}, glancing hit ${PTS.glance}. Extra for a throw at full gallop (+${PTS.fast}), a long throw (+${PTS.long}) and a streak of hits. Every javelin you dodge scores ${PTS.dodge}, and ${PTS.leanDodge} more if you lean away.`,
  ] },
  { title: 'Keyboard', p: [
    'W / S (or Shift / Ctrl) set the pace. Up and Down change lane or move the ring between lanes; Left and Right move the ring ahead or back. Space throws or leans. T asks for a hint, P pauses.',
  ] },
  { title: 'Other ways to play', p: [
    'Festival Cup: three matches against stronger riders. Friendly match: choose the rival and the length. Practice: chase or flee with no score. Learn: four short drills. Watch & Learn: the computer plays both teams and explains every throw.',
  ] },
];

const lvl = LEVELS.map((l) => `${l.name}`).join(', ');
export const RULES = [
  { title: 'The field and the teams', art: 'field', p: [
    'The field is a long strip with three lanes side by side (on a phone held upright the field runs up the screen). Each team has three riders on three different horses; you choose the order they go out in. A match is two to five bouts (three by default); bout 1 uses your first rider, bout 2 your second, and so on.',
    `A pass runs about ${Z_END + 40} m. The chaser starts behind the runner and both ride towards the far end line.`,
  ] },
  { title: 'A bout and the wheel', p: [
    'Every bout is two passes. In pass 1 one rider chases and the other is the runner. At the end of the pass both riders wheel away in a wide turn and the roles swap: the old runner now chases, the old chaser flees. Pass 2 runs back the other way; then the pair rides off and the next riders come out.',
    `A pass also ends if it has run ${PASS_MAX} seconds, or if the chaser draws level with the runner. The team that chases first alternates from bout to bout.`,
  ] },
  { title: 'Pace and stamina', p: [
    'The bar sets the pace from a canter to a full gallop (the top of the bar). The horse speeds up or slows down smoothly; each horse has its own top speed and acceleration.',
    'Riding above 86% of the bar counts as a full gallop. It earns style points, but your aim is shakier and it drains stamina. When stamina is empty the horse loses about one seventh of its top speed until it has eased off to recover.',
  ] },
  { title: 'Lanes', p: [
    'The runner may change lane at any time. A lane change takes about a second and depends on the horse\'s agility. A chaser who is controlled by you follows the runner\'s lane automatically so that you can concentrate on the aim; computer chasers do the same.',
  ] },
  { title: 'Throwing', art: 'lead', p: [
    `Each chaser carries ${JAV_N} blunt javelins per pass. A throw has a short wind-up (a fifth of a second) and then the javelin leaves the hand. You can throw when the runner is between 1.5 and ${REACH_MAX} m ahead of you.`,
    'The ring marks where the javelin will cross the runner\'s lane. Its position is worked out for the moment of release, and the flight takes between 0.3 and 0.7 seconds depending on distance. Your own speed adds to the throw.',
    'Every throw lands a little off the ring. The error grows with distance and with your pace, and a steady horse shrinks it.',
  ] },
  { title: 'Hits', p: [
    `The target is a round standard on a staff at the back of the saddle. A javelin that passes within ${HIT_R} m of its centre is a hit. Within ${BULL_R} m it is a bullseye (${PTS.bull}), within ${SOLID_R} m a solid hit (${PTS.solid}), otherwise a glancing hit (${PTS.glance}). The javelin then drops harmlessly.`,
    `Style: a throw made at full gallop adds ${PTS.fast}; a throw from ${LONG_RANGE} m or further adds ${PTS.long}; each consecutive hit after the first adds 1, up to ${PTS.streakMax}. A dodge by the other team breaks your streak.`,
  ] },
  { title: 'Dodging and leaning', art: 'dodge', p: [
    `While a javelin is coming you may change lane, change pace or lean. A javelin that passes within about three metres without a hit is a dodge: ${PTS.dodge} points to the rider who avoided it.`,
    `A lean lasts ${LEAN_T} seconds. You are covered from ${LEAN_SAFE[0]} to ${LEAN_SAFE[1]} seconds after tapping, so tap about half a second before the javelin arrives. A javelin that would have hit you counts as a dodge worth ${PTS.leanDodge} more. After a lean the horse needs a short rest before the next one (its agility sets how long).`,
  ] },
  { title: 'The horses', p: HORSES.map((h) => `${h.name} (${h.title}): top speed ${h.vmax.toFixed(1)} m/s, acceleration ${h.acc.toFixed(1)}, lane change ${h.lat.toFixed(1)} m/s, aim shake x${h.shake}, lean rest ${h.leanCool.toFixed(1)} s. ${h.blurb}`) },
  { title: 'The computer riders', p: [
    `Five levels: ${lvl}. Higher levels judge the lead better, react faster to your throws, weave between lanes more and ride faster. The Festival Cup goes Quarter-final (level 2), Semi-final (3) and Final (4).`,
  ] },
  { title: 'Winning', p: [
    'Points from all bouts are added up; the higher total wins the match. A tie is a draw. In the Cup you must win each match to go on; three wins make you the festival champion.',
  ] },
  { title: 'Simplifications', p: [
    'Real cirit has many riders at once, long runs of different lengths and local rules. Here one pair rides at a time, javelins are blunt and thrown at a standard, there are no injuries or falls, and the horses are never hit.',
  ] },
];

// ---- Learn lessons (drills run on the practice engine) ---------------------------------------------------------------------------------
export const LESSONS = [
  { id: 'pace', title: 'Find your pace', goal: 'Hold a gallop for 6 seconds', need: 6, n: 6, mode: 'attack', lvl: 1,
    intro: ['Slide the pace bar on the left. Keep the gallop band (shown in green on the bar) for six seconds in total.', 'A canter is steady and a full gallop is risky: the middle is where a thrower rides.'] },
  { id: 'lead', title: 'Lead the throw', goal: 'Hit the runner 3 times in 6 throws', need: 3, n: 6, mode: 'attack', lvl: 1,
    intro: ['The runner keeps a steady pace in one lane. Drag the ring ahead of him and let go.', 'The javelin takes time to arrive, so aim at where the target will be, not where it is.'] },
  { id: 'lanes', title: 'Read the lanes', goal: 'Hit the weaving runner 3 times in 6 throws', need: 3, n: 6, mode: 'attack', lvl: 3,
    intro: ['This runner changes lane. Watch which way he drifts and drag the ring to the lane he will be in.'] },
  { id: 'dodge', title: 'Dodge', goal: 'Avoid 3 of 6 javelins', need: 3, n: 6, mode: 'defend', lvl: 2,
    intro: ['Now you flee. A red ring shows where each javelin is heading: leave that spot by changing lane or pace, or tap LEAN as it arrives.'] },
];

export const THINK_TIPS = {
  close: 'Close up on the runner first. A throw from 6 to 14 m is steadier than one from 20 m.',
  throw: 'Throw now: the ring is on his lane and ahead of him.',
  flee: 'The rival is winding up. Leave the ring: change lane or pace, or lean as it arrives.',
};
