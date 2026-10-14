// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { TOUCHES, COMBOS, TEMPOS, WIN, SCORE, ROUND_TOUCHES, ROUNDS, SESSION, WATCH_TOUCHES, N } from './sim.js';

let aboutCache = { text: null, list: null };
export const aboutPages = (licenseText = '') => {
  if (aboutCache.list && aboutCache.text === licenseText) return aboutCache.list;
  const list = [
    { title: 'Chinlone', art: 'circle', p: [
      'Chinlone is the traditional team game of Myanmar. A circle of six players keeps a woven rattan ball in the air using their feet, knees, heels, shoulders and neck, passing it from one to another in graceful, dance-like movements. Nobody wins or loses: the aim is to keep the ball moving and to make it look beautiful.',
      'The game has been played in villages and towns for many centuries and is regarded as the national game of Myanmar. It is a cooperative game: the players look after one another, and a clever touch is applauded rather than scored against anyone.',
    ] },
    { title: 'About this version', p: [
      'This is a video game made for phones and tablets. You lead the circle: each pass has a named touch, and you tap it as the ring closes around the dancer who plays it. Good timing keeps the dance flowing, and the touches you chain together form named patterns.',
      'The dancers, their clothes and the plaza are invented for the game. The patterns have made-up names. The game is a simplified tribute to the real thing: real players choose their own touches and keep the circle moving by feel.',
      'Simplifications: one ball and six dancers, a beat that does not change within a round, and touches chosen for you by the dance.',
    ] },
    { title: 'Pictures and credits', p: [
      'All art and sound are drawn and synthesised in the game. The people are 3D figures built on the shared Arcforge person layer. Chinlone is part of the Arcforge collection of heritage games.',
    ] },
  ];
  if (licenseText) {
    const paras = licenseText.split(/\n\s*\n/)
      .map((s) => s.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').replace(/\(?https?:\/\/\S+\)?/g, '').replace(/\s+/g, ' ').trim())
      .filter((s) => s && !/fetch\(|Games that ship|^Credits and licences/.test(s));
    list.push({ title: 'Open-source credits', p: paras.slice(0, 40) });
  }
  aboutCache = { text: licenseText, list };
  return list;
};

export const HOWTO = [
  { title: 'The idea', art: 'circle', p: [
    'Six dancers stand in a ring and keep one cane ball in the air. You lead the dance: the ball flies from dancer to dancer, and each dancer needs one named touch from you.',
  ] },
  { title: 'Tap as the ring closes', art: 'timing', p: [
    'A ring closes around the dancer who is about to touch the ball. Tap the matching pad just before it closes. Tapping close to the moment is Perfect; a little early or late is Good or OK.',
    'The name of the touch floats above the dancer and sits first in the strip at the top of the screen.',
  ] },
  { title: 'Five touches', art: 'touches', p: [
    'Foot: the inside of the foot, low. Knee: a lifted knee, in front. Heel: a spin and a back-heel flick. Neck: a bow, the ball rolls over the back of the neck. Shoulder: a lean, the ball rolls over the shoulder.',
    'The pads at the bottom are in that order. You can also use the keys 1 to 5.',
  ] },
  { title: 'Read ahead', art: 'cues', p: [
    'The strip shows what is coming. Gentle shows four touches, Steady three and Lively two, so Lively is for dancers who have learned to read the arcs.',
  ] },
  { title: 'Flow and patterns', art: 'flow', p: [
    'Each good touch fills the flow bar and raises your score multiplier. A wrong touch or a dropped ball empties it. Land the touches of a named pattern in a row for a bonus.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think slows time for a moment and lights the pad for the next touch, with the reason. A dance where you used Think is practice and is not saved as a best.',
    'Watch & Learn dances a short circle for you. It stops to think, shows its choice, then acts. You can pause at any time.',
  ] },
];

const patLines = COMBOS.map((c) => `${c.name}: ${c.seq.map((k) => TOUCHES[k].name).join(', then ')}. +${c.pts} points.`);
export const RULES = [
  { title: 'Goal', art: 'circle', p: [
    `Dance a full session of ${SESSION} touches (${ROUNDS} rounds of ${ROUND_TOUCHES}) with all six dancers. There is no opponent. Your score is the style of the dance and your harmony is how closely you kept time.`,
    'The ball never ends the dance by touching the ground: a dropped ball is picked up with the foot and the dance goes on, but it costs flow and harmony.',
  ] },
  { title: 'The beat', p: [
    `Each pass takes one beat: ${TEMPOS.map((t) => `${t.name} ${t.beat.toFixed(2)} s`).join(', ')}. Every round the beat is 4 percent quicker.`,
    'The ball travels in an arc from one dancer’s touch to the next dancer’s touch. The height of the arc varies; the time does not.',
  ] },
  { title: 'The ring and timing', art: 'timing', p: [
    `The ideal moment to tap is ${Math.round(WIN.lead * 1000)} milliseconds before the dancer touches the ball (the moment the ring closes onto the bright inner circle). A tap earlier than ${Math.round(WIN.early * 1000)} milliseconds before that moment is ignored.`,
    `Within ${Math.round(WIN.perfect * 1000)} ms of the ideal moment: Perfect (${SCORE.perfect} points). Within ${Math.round(WIN.good * 1000)} ms: Good (${SCORE.good}). Otherwise: OK (${SCORE.ok}).`,
    'You get one tap per pass. If your first tap was the wrong touch you can still correct it in time.',
  ] },
  { title: 'The five touches', art: 'touches', p: TOUCHES.map((t) => `${t.name}: the ball meets the dancer ${t.where}. Base ${t.base} points.`) },
  { title: 'Wrong touch and dropped ball', p: [
    `A wrong touch is an off-step: the dancer still plays the ball, so the dance continues, but it scores only ${SCORE.off} points, empties part of the flow bar and breaks any pattern.`,
    'If you do not tap at all, nobody plays the ball. It falls, bounces, and after a short rest the nearest dancer scoops it back up with a foot. Dropped balls do not count towards the session.',
  ] },
  { title: 'Flow', art: 'flow', p: [
    'Flow runs from 0 to 100 percent. Perfect adds 9 percent, Good 6, OK 2.5; an off-step takes 22 and a dropped ball 35 (never below 10).',
    'The score multiplier is 1.0 plus 0.5 for every quarter of the bar, up to 3.0. A touch scores its points times the multiplier times its base value divided by 100.',
  ] },
  { title: 'Patterns', art: 'combos', p: [
    'Land the touches of a pattern in a row, every one in time and none an off-step, to be paid its bonus times your multiplier. The longest pattern that matches is paid and the counter starts again.',
    ...patLines,
    'The dance weaves a pattern into the cues about every eight touches, and the strip tells you one is coming.',
  ] },
  { title: 'Harmony and stars', p: [
    'Harmony is the average over all passes: Perfect counts 1, Good 0.7, OK 0.4, off-step and dropped ball 0. Five stars need 90 percent, four 78, three 62 and two 42.',
    'Stars unlock courtyards: Golden Hour at 3 stars, Lantern Night at 4 stars.',
  ] },
  { title: 'Tempos and the cue strip', art: 'cues', p: TEMPOS.map((t) => `${t.name}: ${t.blurb}`) },
  { title: 'Daily Dance', p: [
    `Everyone gets the same dance on the same day, at Steady tempo, ${SESSION} touches. Your best of the day is kept.`,
  ] },
  { title: 'Watch & Learn', p: [
    `A short circle of ${WATCH_TOUCHES} touches is danced for you. Before each touch the game stops to think for the time you chose in Settings (2, 5, 8 or 10 seconds), then shows the touch it chose for two seconds, then plays it. Pause freezes everything exactly where it is.`,
  ] },
  { title: 'Think hint', p: [
    'Think slows time to a third for about two and a half seconds and lights the pad for the next touch, with the reason. A dance where you used Think is not saved as a best.',
  ] },
  { title: 'Free preview', p: [
    'The first 90 seconds of real play are free. Menus, Watch & Learn, the Moves journal and paused play do not count. The full game is a one-time unlock; Restore Purchases is in Settings.',
  ] },
];
export const HOWTO_N = N;
