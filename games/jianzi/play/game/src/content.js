// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { TRICKS, KINDS, REACH, CIRCLE_SESSION, PARTNERS } from './sim.js';

export const ABOUT = [
  { title: 'Jianzi', art: 'shuttle', p: [
    'Jianzi is a kicking game from China: a small feathered shuttle on a weighted base is kept in the air with the feet, heels and knees. It is played in parks and courtyards by all ages, alone for a streak or in a circle where friends pass it around.',
    'Related games are played across East and Southeast Asia, for example jegichagi in Korea and da cau in Vietnam. Records and carvings show shuttle kicking in China for many centuries, and the exact beginning is not known.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. The shuttle follows simple physics: it shoots up, tumbles at the top and floats down on its feathers while the wind pushes it sideways.',
    'The players are lifelike 3D figures and the courtyards are layered paper scenery. The circle partners, their names and the courtyards are invented for the game.',
    'Simplifications: there is no net and no opponent team, one shuttle is used, and a gentle wind is added so every kick is a small decision.',
  ] },
  { title: 'Pictures and credits', p: [
    'All art and sound are drawn and synthesised in the game. Jianzi is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'overview', p: [
    'Keep the shuttle in the air. Each good kick adds one to your streak. When it touches the ground the run is over.',
  ] },
  { title: 'Time the kick', art: 'gauge', p: [
    'The shuttle shoots up, tumbles and floats down. When it falls into the glowing band beside your leg, tap one of the three pads at the bottom. Tapping close to the marked height is a Perfect kick.',
    'You can also tap the courtyard itself: left, middle or right third, same as the pads (Solo and Daily).',
  ] },
  { title: 'Steer with the pads', art: 'pads', p: [
    'Solo: the left pad nudges the shuttle left, the middle pad sends it straight up, the right pad nudges it right. Watch the wind flag and the ring on the ground where the shuttle will land, and kick against the wind.',
    'Park Circle: each pad passes to a friend. Pass to the one who has waited longest for a Fair Pass bonus.',
  ] },
  { title: 'Vary your kicks', art: 'kinds', p: [
    'Where the shuttle is when you tap decides the kick: low is a toe scoop, middle is the inside foot (or the outside foot with a side pad) and high is the knee. Using different kicks raises your style multiplier, and named combos pay a bonus.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows time for a moment and lights up the pad a good player would press, with the reason. A run where you used Think is practice: it is not saved as a best.',
    'Watch & Learn plays a whole circle for you. It stops to think, shows its options, then acts. You can pause at any time.',
  ] },
];

const trickLines = TRICKS.map((t) => `${t.name}: ${t.how}. +${t.pts} points.`);
export const RULES = [
  { title: 'Goal', p: [
    'Keep one shuttle in the air for as long as possible. Your streak is the number of kicks in a row. Points are scored on top of the streak for style.',
    'The run ends when the shuttle touches the ground: it is not struck in time, it is out of reach, or (in the circle) a friend cannot reach a pass.',
  ] },
  { title: 'The shuttle', art: 'shuttle', p: [
    'A kick sends the shuttle up fast. It tumbles at the top of its flight, then falls slowly, feathers up, at no more than about 2.2 metres per second.',
    'Wind pushes it sideways. The wind flag on screen shows the direction and strength and a short forecast. The wind grows with your streak and arrives in gusts.',
  ] },
  { title: 'The strike band', art: 'gauge', p: [
    `You can kick only while the shuttle is falling and below ${'0.88'} metres. Inside that band the height decides the kick:`,
    `Below 0.16 m: Toe scoop (${KINDS.scoop.base} base points). Low loft, hard to control.`,
    `0.16 to 0.48 m: Inside foot (${KINDS.inside.base} points) with the middle pad, or Outside foot (${KINDS.outside.base} points) with a side pad. Best height 0.30 m.`,
    `0.48 to 0.88 m: Knee (${KINDS.knee.base} points). Best height 0.66 m. A knee kick sends the shuttle lower, so the next kick comes sooner.`,
  ] },
  { title: 'Quality and Perfect', p: [
    'The closer you strike to the best height of the kick, the better the quality. Quality sets how high the shuttle goes and how accurate it is. A kick within 7.5 cm of the best height is Perfect and scores 1.5 times the base points; other kicks score 70 to 100 percent.',
  ] },
  { title: 'The pads (Solo and Daily)', art: 'pads', p: [
    'Left pad: the shuttle leaves leftwards. Middle pad: straight up. Right pad: rightwards. A side pad at foot height is an Outside kick and pushes hardest; at knee height it is a gentler push.',
    `You can step about ${REACH.toFixed(1)} metres either way to reach the shuttle. If it comes down farther away than that you cannot reach it.`,
  ] },
  { title: 'Style multiplier', p: [
    'Your last four kicks are compared. One kind of kick gives x1, two kinds x1.5, three kinds x2, and all four kinds (toe scoop, inside, outside, knee) among the last four give x3. Repeating the same kick lets the multiplier fall again.',
  ] },
  { title: 'Combos', art: 'combos', p: [
    'Finish one of these patterns with your latest kicks to land a combo. The longest pattern that matches is paid, and the pattern counter starts again. Repeating one kick never makes a combo.',
    ...trickLines,
  ] },
  { title: 'Park Circle', art: 'circle', p: [
    `You stand with three friends in a ring: ${PARTNERS[1].name} on the left, ${PARTNERS[2].name} at the far side and ${PARTNERS[3].name} on the right. Each pad passes to that friend. Your pass lands where you aimed, plus a scatter that grows as your kick quality falls.`,
    `Friends return the shuttle to someone else, and often to you. A friend can step about ${(0.55 + 0.5 * PARTNERS[2].skill).toFixed(1)} metres to reach a pass; they have different skill, so give ${PARTNERS[3].name} cleaner passes.`,
    'Fair Pass: passing to a friend who has not touched the shuttle for four or more kicks adds 10 points.',
    'The chain counts every kick by everyone. The circle also gets windier and lower the longer it lasts.',
  ] },
  { title: 'Daily Streak', p: [
    'Everyone gets the same wind pattern on the same day. Your best of the day is kept.',
  ] },
  { title: 'Watch & Learn', p: [
    `A full circle of ${CIRCLE_SESSION} kicks is played for you. Before each kick the game stops to think for the time you chose in Settings (2, 5, 8 or 10 seconds), then shows the options and the chosen pad for two seconds, then kicks. Pause freezes everything exactly where it is.`,
  ] },
  { title: 'Think hint', p: [
    'Think slows the game to a third for about two and a half seconds and lights the pad that a good player would choose, with the reason. A run where you used Think is not saved as a best streak.',
  ] },
  { title: 'Collection', p: [
    'Shuttles and courtyards are unlocked by playing: a streak of 10 for Rooster Red, a circle chain of 20 for Peacock Teal, 5 combos for Ginkgo Gold, a daily streak of 10 for Ink Black and 100 perfect kicks for Festival Mix. Courtyards unlock at streaks of 15, 30 and 50.',
  ] },
  { title: 'Free to play', p: [
    'Free to play with short ads; go ad-free once.',
  ] },
];
