// All reader text (About, How to Play, Rules). Numbers come from consts.js so the Rules page always matches the engine.
import { PACES, PTS, LIFT_T, STRIKE_T, LIFT_X, STRIKE_X, PERFECT_FRAC, RUNS_PER_ROUND, ROUNDS, STARS_AT, CHALLENGE_LIVES, DROP, REACH, LANE_LEN, MAX_ROUND, SWAYS, AIM_MAX } from './consts.js';

const ms = (t) => `${Math.round(t * 1000)} milliseconds`;
const cm = (m) => `${Math.round(m * 100)} cm`;

export const ABOUT = [
  { title: 'Tent pegging (neza bazi)', p: [
    'Tent pegging is a mounted skill sport of South Asia, played in Pakistan and India and, today, in many other countries including Oman and Australia. A rider gallops down a lane and uses a lance to pierce or lift a small wooden peg set in the ground.',
    'Neza bazi means "lance play". It is practised at village fairs, festivals and in tournaments, where the same lane is ridden again and again and the lance, the horse and the timing have to come together in a fraction of a second.',
  ] },
  { title: 'About this version', p: [
    'This is a friendly, simplified one-player version. You see the lane through the rider\'s eyes. The horse and the peg come to no harm: the horse only gallops, the peg is a small block of wood and the rival is a score to beat.',
    'The real sport has teams, judges, several pegs and its own rules in each country. The Rules page lists each simplification.',
  ] },
  { title: 'Made with', p: [
    'Tent Pegging is part of Arcforge, a collection of games from heritage traditions around the world. The horse, the riders, the stands and the sky are lit 3D scenes drawn by the game (their credits are listed below), and all sounds are made by the game.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [
    `Ride down the lane and lift the peg with your lance. A round is ${RUNS_PER_ROUND} runs. Your points are compared with the rival's for the same round, and the best total wins.`,
  ] },
  { title: 'Before a run', p: [
    'Tap Canter, Gallop or Full gallop to set off. A faster pace is worth more points but the horse rocks more and the world rushes by.',
  ] },
  { title: 'Aim', p: [
    'Put a thumb anywhere on the field and slide it left or right. The ring on the ground ahead is where the lance point will land. Slide until the ring lines up with the peg. The horse rocks from side to side, so keep adjusting.',
  ] },
  { title: 'Strike', p: [
    'Lift your thumb to strike. The lance takes a moment to come down, and the ring already includes that moment: let go when the ring reaches the peg. The ring turns green when a lift is on, and yellow for a touch (Guided setting).',
  ] },
  { title: 'Scoring', p: [
    `Lift: ${PTS.lift}. Touch: ${PTS.strike}. Perfect lift: +${PTS.perfect}. Lift at full gallop: +${PTS.fast}. Consecutive lifts add +1, +2, +${PTS.streakMax} for the run of lifts so far. A run is worth up to ${PTS.lift + PTS.perfect + PTS.fast + PTS.streakMax}.`,
  ] },
  { title: 'Think', p: [
    'Tap Think during a run for a hint: the run waits while the game shows you where the peg is, how far across to slide, and when to let go. A run that used the hint cannot score the perfect bonus.',
  ] },
  { title: 'Keyboard', p: [
    'Left and Right slide the lance. Space strikes. 1, 2 and 3 choose the pace before a run. T is Think and P pauses.',
  ] },
  { title: 'Other ways to play', p: [
    `Tournament Cup: ${ROUNDS.length} rounds, each against a rival. Gallop Challenge: keep going until you have missed ${CHALLENGE_LIVES} times. Practice: ride freely. Learn: three short drills. Watch & Learn: the computer rides a round and explains each decision.`,
  ] },
];

export const RULES = [
  { title: 'The sport', p: [
    'A rider gallops a horse down a straight lane carrying a long lance. A small wooden peg stands in the ground. The aim is to lift the peg on the point of the lance and carry it. Tent pegging is ridden at festivals and in tournaments across South Asia and beyond.',
  ] },
  { title: 'The lane', p: [
    `The lane is ${LANE_LEN} metres long. The start line is at the near end and the peg stands between 50 and 68 metres out, at a different distance each run. A chalk mat and a gate of two posts mark where the peg stands. White boards give the distance every 10 metres.`,
    'You see everything from the saddle: the horse\'s neck, ears and mane in front of you, your left hand holding the reins and your right hand on the lance coming in from the lower right. The peg is a block of wood about 11 centimetres across. After a strike a short replay shows the rider from the side; the Settings page can switch that off.',
  ], art: 'lane' },
  { title: 'Pace', p: [
    `Before each run you pick a pace: ${PACES.map((p) => `${p.name} (${p.v.toFixed(1)} metres a second)`).join(', ')}. The faster the pace, the more the horse rocks from side to side. A lift at ${PACES[2].name} scores a bonus.`,
    `The slowest pace allowed in each Tournament round: ${ROUNDS.map((r) => `${r.name}, ${PACES[r.minPace].name}`).join('; ')}.`,
  ] },
  { title: 'Aiming the lance', p: [
    `Touch the field with your thumb and slide it left or right. The lance moves across the lane by the same amount (up to ${AIM_MAX} metres either way, at a limited speed). Where you first touch does not matter: only the slide counts.`,
    'The ring on the ground is where the lance point will land if you let go now. It already takes the rocking of the horse and the time the lance needs to come down into account.',
  ] },
  { title: 'The strike', p: [
    `Lift your thumb to strike. The lance comes down in ${DROP.toFixed(2)} seconds and its point touches the ground ${REACH} metres in front of the rider. If the point meets the peg you score. The picture slows down for the moment of contact.`,
    'A tap with no slide strikes at the current position of the ring. If the peg goes by and the lance is still up, the run is a miss.',
  ] },
  { title: 'How close is close enough', p: [
    `A lift needs the point within ${ms(LIFT_T)} of the peg along the lane and within ${cm(LIFT_X)} of it across (before the round factor below). A touch needs ${ms(STRIKE_T)} and ${cm(STRIKE_X)}. A perfect lift is inside ${Math.round(PERFECT_FRAC * 100)}% of the lift window in both directions.`,
    'Each round multiplies the windows by its own factor: Village Green 1.2 (wider), the Grand Final 0.8 (narrower). The windows are given in time, so a faster pace does not make them shorter in seconds, but you cover more ground in the same time.',
  ], art: 'timing' },
  { title: 'Scoring a run', p: [
    `Lift: ${PTS.lift}. Touch (the peg is knocked away): ${PTS.strike}. Miss: 0.`,
    `Bonuses on a lift: Perfect +${PTS.perfect}; Full gallop +${PTS.fast}; streak of consecutive lifts +1 for the second, +2 for the third and +${PTS.streakMax} from the fourth.`,
    `A round of ${RUNS_PER_ROUND} runs can reach ${MAX_ROUND} points without streaks.`,
  ] },
  { title: 'Tournament Cup', p: [
    `The Cup has ${ROUNDS.length} rounds: ${ROUNDS.map((r) => r.name).join(', ')}. In each you ride ${RUNS_PER_ROUND} runs and the rival rides ${RUNS_PER_ROUND}. After each of your runs you see what the rival scored in the same run.`,
    `Stars: one for beating the rival, two for ${STARS_AT[1]} points or more and three for ${STARS_AT[2]} or more. A round opens when you have at least one star in the one before. The rival gets stronger each round and the lane gets livelier (more rocking, the peg further from the line).`,
  ] },
  { title: 'Gallop Challenge', p: [
    `An endless ride. The Challenge ends when you have missed ${CHALLENGE_LIVES} times. Every three runs the rocking grows, the peg stands further off the line and the windows narrow a little. Your best score is saved.`,
  ] },
  { title: 'Practice and Learn', p: [
    `Practice has no scoring pressure and unlimited runs: choose the pace and the rocking (${SWAYS.map((s) => s.name).join(', ')}).`,
    'Learn has three short drills (Aim, Timing, Lift and score) with a goal for each. The guide is always on in the drills.',
  ] },
  { title: 'Watch & Learn', p: [
    'The computer rides a round and explains. Before each strike it stops and goes through three stages: Think (it measures where the peg is, how far across it stands and when the lance must come down), Reveal (the ring and the peg are highlighted and the plan is shown) and Act (the run goes on). The thinking time is set in Settings (2 to 10 seconds). Pause stops everything and resumes exactly where it was.',
  ] },
  { title: 'Think hint', p: [
    'During your own run you can tap Think. The run waits, the peg and the ring are highlighted and a note tells you how far to slide and when to let go. Close the note to carry on. A hinted run cannot score the Perfect bonus.',
  ] },
  { title: 'Aim guide setting', p: [
    'Guided: the ring changes colour (green for a lift, yellow for a touch, white otherwise) if you let go now. Ring only: the ring stays white. Off: no ring; you judge by the lance and the peg alone.',
  ] },
  { title: 'Replay camera setting', p: [
    'On: for about a second after a strike the camera moves to the side of the lane and shows the rider and horse with the lance and the peg, then returns to the saddle. Off: the camera stays in the saddle.',
  ] },
  { title: 'Differences from the real sport', p: [
    'In the real sport a rider usually rides several runs at a peg, teams are scored together, and the lance is carried to the end of the lane with the peg on it. Here every run is a single attempt, the peg always comes up if it is hit cleanly, and the carry is shown automatically.',
    'There are no injuries, no falls and no contact with animals. No gambling: points are only for fun.',
  ] },
  { title: 'Text size and controls', p: [
    'Every text screen can be enlarged from 100% to 300% with A+ and A-. Keyboard: Left and Right slide, Space strikes, 1 2 3 pace, T hint, P or Escape pause, plus and minus change the text size on menus.',
  ] },
];

// Drill goals use the same words as consts.LESSONS; kept here so the Learn screens read from one place.
export const THINK_NOTES = [
  'The peg is {d} metres ahead.',
  'It stands {x} to the {side} of where the lance points now.',
  'Slide {slide}, then let go when the ring touches the peg.',
];
