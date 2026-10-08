// All reading text. Every number comes from consts.js / courses.js so the Rules page can never drift from the engine.
import { TIMING, POINTS, TEJO_R, AIM_RANGE, COUNT_BEATS, AIR, LEVELS, GAME_LENGTHS, DEMO_MATCH_CAP, THINK_STEPS } from './consts.js';
import { COURSES, COURSE_LIST, RULE_TEXT } from './courses.js';

const ms = (x) => `${Math.round(x * 1000)} ms`;
const cm = (x) => `${Math.round(x * 100)} cm`;
const S = TIMING.standard, R = TIMING.relaxed;

export const ABOUT = [
  { title: 'Rayuela', p: [
    'Rayuela is the chalk-and-pavement hopping game that children play in courtyards, streets and school yards across Latin America and Spain. You draw a numbered course on the ground, toss a small marker onto a square, hop through the course, and bend down to pick the marker up on the way back.',
    'Its name changes from place to place: rayuela in Argentina, Uruguay, Spain and Peru, avion in Mexico, golosa in Colombia, luche in Chile, and many more. The marker is often called a tejo. Every neighbourhood has its own course, rhymes and rules.',
  ] },
  { title: 'About this version', p: [
    'Toss the tejo onto the next number, then hop the whole course in time with the drum: one foot on single squares, two feet on doubles, a rest in the Sky square, and the same way back. Never step on a chalk line.',
    'Play against the computer in four levels, play with a friend on the same device, practise, follow six short lessons, or watch two computers play and see why each hop works. There are three courses: Classic, Snail and Rainbow.',
    'The game is played with real people in a real courtyard: keep the beat, breathe, and enjoy the hop.',
  ] },
  { title: 'Credit', p: ['Thanks to the many families and children who have drawn these courses on the ground and passed the game on.'] },
];

export const HOWTO = [
  { title: 'The goal', p: ['Finish every number on the course before the other player. Each clean run (toss, hop out, rest in the Sky, hop back, pick up the tejo, hop out) moves you up one number. A foul ends your turn.'] },
  { title: '1. Toss', p: [
    'A reticle slides sideways over the square you must hit. Tap TOSS to lock it. Then it slides up and down: tap again to throw. The tejo must land completely inside the square, not on a line.',
  ] },
  { title: '2. Hop to the beat', p: [
    'After four drum beats the hopping starts. A ring closes on the next square. Tap on the beat.',
    'One square: ONE foot (LEFT or RIGHT). A double square (two side by side): TWO FEET. The square that holds your tejo is jumped over. If your tejo is in half of a double, hop on the other half with one foot, the one on that side.',
  ] },
  { title: '3. Sky and back', p: ['The last square is the Sky: land with TWO FEET and turn. Then hop back the same way. Just before your tejo, stop and tap PICK UP on the beat, then carry on.'] },
  { title: 'Lines and fouls', p: ['Tap too early or too late and your foot lands on a chalk line. Tap the wrong button, or miss a beat, and you stumble. Any foul ends the turn.'] },
  { title: 'Think, Learn and Watch', p: ['Think pauses and tells you what comes next. Learn has six short lessons. Practice has no score. Watch & Learn plays two computers and explains each turn.'] },
];

const courseRule = (id) => {
  const c = COURSES[id];
  return `${c.name} (${c.local}): ${c.blurb} Numbered squares: ${c.N}. Tempo ${c.bpm} rising to ${c.bpmTo} beats per minute as the numbers go up. Rule: ${RULE_TEXT[c.rule]}`;
};

export function rulesPages() {
  const wd = Math.round((AIM_RANGE.x * 2) * 100), tol = Math.round((0.23 - TEJO_R) * 100);
  return [
    { title: 'The game', p: [
      'Rayuela is a street game for two players who take turns. Each player works up a numbered chalk course: toss a marker (the tejo) onto the next number, hop through the whole course, rest in the Sky square, hop back, pick up the tejo and hop out.',
      'In this game you play the computer, a friend on the same device, or watch two computers play.',
    ] },
    { title: 'The courses', p: [...COURSE_LIST.map(courseRule),
      'Squares are 46 cm wide. A double is two squares side by side; its two halves have two different numbers. The Sky square is the big square at the end and has no number.'] },
    { title: 'A turn', p: [
      'Every turn has the same parts: TOSS, a four-beat COUNT-IN, HOP OUT, SKY, HOP BACK with a PICK UP, and the hop out of the course.',
      'You play the number after your last finished one. A clean run finishes the number. A foul at any point ends your turn; the number stays unfinished and you try the same number next turn.',
    ] },
    { title: 'The toss', p: [
      `A reticle slides across the target square from side to side over a range of ${wd} cm. TAP locks it. Then the reticle slides forward and back: TAP again to throw. The tejo is a flat disc about ${cm(TEJO_R * 2)} across.`,
      `The tejo must land completely inside the target square: it may not touch a line. A square is 46 cm wide, so the tejo's centre must land within about ${tol} cm of the middle in each direction.`,
      'If it lands on a line, in a different square or off the course, the toss fails and your turn ends. The sweeps get faster as the numbers go up. A tiny random wobble means even a perfect tap can land a little off.',
      'The better your toss, the more it scores: a toss near the middle scores more than one that only just fits.',
    ] },
    { title: 'The count-in and the beat', p: [
      `After a good toss the drum counts ${COUNT_BEATS} beats. Then every landing is on a beat. The tempo depends on the course and rises with the number you are playing.`,
      `A ring closes on the next square. It reaches the square exactly on the beat, and the hopper lands exactly on the beat after a hop of ${ms(AIR)} in the air. Tap on the beat.`,
    ] },
    { title: 'Singles, doubles and the tejo', p: [
      'A single square needs ONE foot: tap LEFT FOOT or RIGHT FOOT. Tapping TWO FEET on a single square is a foul.',
      'A double needs TWO FEET: tap the TWO FEET button. One foot on a double is a foul.',
      'The square that holds your tejo is jumped over: it is not a landing. If your tejo is in one half of a double, you land on the OTHER half with ONE foot, the foot on that side (the left half is on your left). Tapping the other foot is a foul.',
    ] },
    { title: 'The Sky square', p: [
      'The last square is the Sky (Cielo), a rest square. Land with TWO FEET. The hopper takes a second beat to turn round (no tap), then you hop back.',
      'On the Snail and Rainbow courses the Sky is the only place where you may change your foot rule.',
    ] },
    { title: 'Coming back and the pick-up', p: [
      'Hop back over the same squares in the opposite order, with the same rules. The square that held your tejo is now free: you land in it like any other.',
      'Just before the tejo, on the square after it, the hopper stops and a PICK UP beat comes: tap PICK UP on the beat. The hopper bends, takes the tejo and straightens (two beats). If your tejo was on the last numbered square, you pick it up in the Sky square.',
      'Tapping any other button on the PICK UP beat, or PICK UP on any other beat, is a foul.',
      'After the pick-up, hop through the rest of the course and out over the start line with TWO FEET.',
    ] },
    { title: 'Timing windows', p: [
      `Standard: PERFECT within ${ms(S.perfect)} of the beat, GOOD within ${ms(S.good)}, OK within ${ms(S.ok)}. Taps earlier than ${ms(S.early)} before the beat are ignored.`,
      `Relaxed: PERFECT within ${ms(R.perfect)}, GOOD within ${ms(R.good)}, OK within ${ms(R.ok)}; taps earlier than ${ms(R.early)} are ignored.`,
      'Outside the OK window (but inside the early limit) your foot lands on a chalk line and you stumble: a foul. The grade only changes your points. The Sync adjustment in Settings shifts your taps earlier or later to match your device.',
    ] },
    { title: 'Fouls', p: [
      'A foul ends your turn at once. The fouls are:',
      'Stepped on a line: the tap was too early or too late. Missed the beat: no tap came in time. Wrong feet: two feet on a single, one foot on a double, the wrong foot beside your tejo, or a wrong button on the pick-up. Wrong foot order: breaking the course rule below. A failed toss also ends the turn.',
      'The tejo stays on the ground until your next turn, when you toss again.',
    ] },
    { title: 'Foot rules by course', p: [
      `Classic: ${RULE_TEXT.free}`,
      `Snail: ${RULE_TEXT.same} The first single you hop sets your foot for that leg. Breaking it is a foul (wrong foot order).`,
      `Rainbow: ${RULE_TEXT.alternate} Hopping the same foot twice in a row is a foul (wrong foot order). The tejo-half rule beside a double sets the foot for that hop, and then the next single must be the other foot.`,
    ] },
    { title: 'Points', p: [
      `Each landing scores PERFECT ${POINTS.perfect}, GOOD ${POINTS.good}, OK ${POINTS.ok}. A PICK UP scores one and a half times that. A toss near the middle of the square scores ${POINTS.toss}, any other good toss ${Math.round(POINTS.toss * 0.4)}. A clean run adds ${POINTS.clean}.`,
      'Points only break ties. The game is won by finishing the course numbers.',
    ] },
    { title: 'Winning', p: [
      `Choose a ${GAME_LENGTHS[0].name} (numbers 1 to ${GAME_LENGTHS[0].numbers}) or the whole course. Players take turns, one run each. The first player to finish the last number wins, but the other player always gets the same number of turns. If both finish in the same round, the player with more points wins; equal points are a draw.`,
      'This game uses one house rule to keep things moving: after a clean run the turn passes to the other player (in the street game you may keep going until you foul).',
    ] },
    { title: 'The computer levels', p: LEVELS.map((l) => `Level ${l.id}, ${l.name}: ${l.blurb}`).concat([
      'The computer taps and hops with the same timing rules as you. Higher levels are steadier on the beat and rarely miss a toss. Nobody is perfect: even the champion sometimes steps on a line.',
    ]) },
    { title: 'Two players', p: ['Choose Two players on the setup screen. Player 1 and Player 2 take turns on the same device; the screen says whose turn it is. Each player has a tejo of their own colour.'] },
    { title: 'Think, Learn, Practice, Watch & Learn', p: [
      'Think pauses the game and explains the next thing to do: where to aim, or the next squares with the right button for each.',
      'Learn: six short lessons on the toss, one foot, two feet, a tejo in a double, the pick-up and a full run.',
      'Practice: toss and hop with no match; a foul simply starts the next try.',
      `Watch & Learn: two computers play. Before each toss and before each run you see what they plan (THINK, ${THINK_STEPS.join(', ')} seconds are available in Settings), then it is played. Pause freezes everything.`,
    ] },
    { title: 'Saving, the free demo and settings', p: [
      'A match is saved at the start of every turn. Continue on the title screen resumes it.',
      `The free web demo has the Classic course, the first two computer levels and ${DEMO_MATCH_CAP} short games.`,
      'Settings: sound, drum volume, text size (100% to 300%), timing (Standard or Relaxed), a sync adjustment for your device, thinking time for Watch & Learn, and the look of your player.',
    ] },
  ];
}

export const LESSONS = [
  { id: 'toss', title: '1. The toss', goal: 'Land the tejo in square 1, three tosses out of five', course: 'learn-singles', need: 3, kind: 'toss',
    lesson: { tossOnly: true, attempts: 5, need: 3, number: 1 },
    intro: ['Tap TOSS to lock the sideways sweep when it crosses the middle of the square. Then tap again to throw.', 'The tejo must land inside the square without touching a line.'] },
  { id: 'one', title: '2. One foot', goal: 'Hop the strip cleanly, two runs out of three', course: 'learn-singles', need: 2, kind: 'run',
    lesson: { noMarker: true, attempts: 3, need: 2 },
    intro: ['Follow the drum. A ring closes on the next square: tap LEFT FOOT or RIGHT FOOT on the beat.', 'In the Sky square tap TWO FEET, then hop back and out with TWO FEET at the end.'] },
  { id: 'two', title: '3. Two feet', goal: 'Hop a strip with doubles, two runs out of three', course: 'learn-doubles', need: 2, kind: 'run',
    lesson: { noMarker: true, attempts: 3, need: 2 },
    intro: ['Doubles are two squares side by side. Land with TWO FEET: tap the TWO FEET button.', 'Singles still need one foot.'] },
  { id: 'half', title: '4. The tejo in a double', goal: 'Hop past a tejo in a double, two runs out of three', course: 'learn-marker', need: 2, kind: 'run',
    lesson: { marker: 2, attempts: 3, need: 2 },
    intro: ['The tejo lies in the LEFT half of the double. You cannot land there, so land on the right half with ONE foot: tap RIGHT FOOT.', 'On the way back you pick the tejo up.'] },
  { id: 'pick', title: '5. The pick-up', goal: 'Pick up the tejo cleanly, two runs out of three', course: 'learn-singles', need: 2, kind: 'run',
    lesson: { marker: 2, attempts: 3, need: 2 },
    intro: ['The tejo lies in square 2. You leap over it on the way out.', 'On the way back stop on square 3 and tap PICK UP on the beat, then hop on.'] },
  { id: 'full', title: '6. A full run', goal: 'Toss and finish square 4 of the Classic course', course: 'classic', need: 1, kind: 'run',
    lesson: { number: 4, attempts: 3, need: 1 },
    intro: ['A real turn on the Classic course: toss to square 4, count in, hop out, rest, hop back, pick up, hop out.', 'You have three tries.'] },
];
