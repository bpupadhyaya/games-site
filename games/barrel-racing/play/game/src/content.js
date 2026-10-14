// All reader text (About, How to Play, Rules). Numbers come from consts.js so the Rules page always matches the engine.
import {
  ROUNDS, HORSES, KNOCK_S, RUNS_PER_ROUND, CHALLENGE_LIVES, BURST_T, BURST_V, BURST_A, WIND_DONE, HINT_COST, TIME_LIMIT, STAR_GOLD, STAR_PLAT, ARENA, BRAKE, GROUNDS,
} from './consts.js';

const deg = (r) => `${Math.round(r * 180 / Math.PI)} degrees`;

export const ABOUT = [
  { title: 'Barrel racing', p: [
    'Barrel racing is a rodeo and horse-show event of the United States and Canada. One rider and one horse race the clock around three barrels set in a triangle, the cloverleaf pattern, and gallop home across the timing line.',
    'It is judged by the clock alone: the fastest clean run wins. A barrel tipped over adds seconds, so the best riders ride close, turn early and keep their speed.',
  ] },
  { title: 'About this version', p: [
    'This is a friendly, simplified one-player version. You see the arena from above and behind, with the camera closing in on your rider, and guide the horse with one thumb. Horses and riders come to no harm: a knocked barrel is only a time penalty.',
    'Real events have judges, several classes, hundreds of entries and several kinds of arena surface. The Rules page lists each simplification.',
  ] },
  { title: 'Made with', p: [
    'Barrel Racing is part of Arcforge, a collection of games from heritage traditions around the world. The riders are 3D athletes from the shared Arcforge sports toolkit; the horses, barrels, arena and crowd are built by the game itself, and all sounds are made by the game.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [
    'Ride the cloverleaf as fast as you can: around one of the two near barrels, around the other, around the far barrel and home across the line. The clock runs from the moment you cross the line.',
  ] },
  { title: 'Before a run', p: [
    `Choose your horse to set off: ${HORSES.map((h) => `${h.name} (${h.blurb.toLowerCase()})`).join(', ')}. You wait behind the line until you tap.`,
  ] },
  { title: 'Steer', p: [
    'Put a thumb anywhere on the screen and slide it left or right. The horse turns the way you slide, and the further you slide the harder it turns. Let go and it runs straight.',
  ] },
  { title: 'Slow down', p: [
    'Slide your thumb down to pull the reins back and the horse slows. A fast horse can only turn in a wide circle, so slow down before a barrel, then let it out again on the way to the next.',
  ] },
  { title: 'Burst', p: [
    `Once in every run you can use Burst for a short surge (${BURST_T.toFixed(1)} seconds). Flick your steering thumb quickly upwards without lifting it, or tap the Burst button with another finger. It is worth the most on a straight, such as the run home.`,
  ] },
  { title: 'The barrels', p: [
    `Ride around the right-hand barrel to the right and the left-hand barrel to the left, in either order, then the far barrel the same way as the second one, then home. Touch a barrel and it goes over: +${KNOCK_S} seconds. The ring on each barrel fills as you turn around it.`,
  ] },
  { title: 'Think', p: [
    `Tap Think during a run for a hint: the run waits while the game draws a good line from where you are and says what to do. A run that used the hint costs ${HINT_COST} second.`,
  ] },
  { title: 'Keyboard', p: [
    'Left and Right steer. Down slows. B is Burst. Space or Enter sets off. T is Think and P pauses.',
  ] },
  { title: 'Other ways to play', p: [
    `Rodeo Cup: ${ROUNDS.length} rounds of ${RUNS_PER_ROUND} runs against a rival's times. Time Trial: beat a target time on every run; ${CHALLENGE_LIVES} over the target ends it. Practice: ride freely. Learn: three short drills. Watch & Learn: the computer rides a round and explains each decision.`,
  ] },
];

export const RULES = [
  { title: 'The event', p: [
    'A rider and one horse ride a cloverleaf pattern as fast as they can. The clock starts when the horse crosses the timing line, stops when it crosses the line again after the third barrel, and the barrels must be left standing.',
  ] },
  { title: 'The arena', p: [
    `The arena is a fenced rectangle ${ARENA.x1 - ARENA.x0} metres wide and ${ARENA.y1 - ARENA.y0} metres long. The timing line runs across the near end. The two near barrels stand to the left and right of the middle and the far barrel stands in the middle. Each round uses a larger pattern than the one before.`,
    'Riding into the fence slows the horse but costs no penalty. The fence keeps the horse in the arena.',
  ], art: 'pattern' },
  { title: 'The pattern', p: [
    'You may begin with either near barrel. The right-hand barrel is turned to the right (clockwise seen from above) and the left-hand barrel to the left. After the second near barrel you ride to the far barrel and turn it the same way you turned the second one, then ride home.',
    `A barrel counts as turned when you have gone about ${WIND_DONE.toFixed(1)} radians (${deg(WIND_DONE)}) around it in the right direction while within 12 metres of it. The yellow ring on the ground fills as you turn. Barrels must be taken in this order: going round the far barrel first does not count.`,
  ] },
  { title: 'Steering and speed', p: [
    'The slide of your thumb sets how hard the horse turns. The faster the horse, the wider its tightest circle. A turn also costs speed: the harder the turn, the more speed is lost. So a tight line is shorter but slower and an open line is longer but faster, and you decide.',
    `Pulling the reins back slows the horse by up to ${BRAKE} metres a second every second. A horse can accelerate again on a straight line.`,
  ] },
  { title: 'Horses', p: [
    `${HORSES.map((h) => `${h.name}: top speed ${h.vTop} metres a second`).join('. ')}. Slower horses hold a tighter circle; faster horses need more room.`,
    `Each round has its own ground and it changes how much grip the horse has: ${ROUNDS.map((r) => `${r.name} (${r.ground.toLowerCase()})`).join(', ')}. In Practice you can choose Firm, Sandy or Heavy ground.`,
  ] },
  { title: 'Burst', p: [
    `Once in a run you can use Burst (tap the button, or flick the steering thumb quickly upwards). For ${BURST_T.toFixed(1)} seconds the horse accelerates ${BURST_A} times as fast and its top speed is ${Math.round((BURST_V - 1) * 100)}% higher. It cannot be used twice.`,
  ] },
  { title: 'Penalties', p: [
    `Each barrel knocked over adds ${KNOCK_S} seconds to the time of the run. A run that used the Think hint adds ${HINT_COST} second. A run that lasts longer than ${TIME_LIMIT} seconds is stopped and counted as ${TIME_LIMIT} seconds plus its penalties.`,
    'The time shown at the end of a run is the net time: the ridden time plus the penalties.',
  ] },
  { title: 'Rodeo Cup', p: [
    `The Cup has ${ROUNDS.length} rounds: ${ROUNDS.map((r) => r.name).join(', ')}. In each you ride ${RUNS_PER_ROUND} runs and the rival rides ${RUNS_PER_ROUND}. After each of your runs you see the rival's time for the same run, and a ghost rider follows the rival's line.`,
    `A round is won when your total net time is lower than the rival's. Stars: one for winning, two for a total within ${Math.round((STAR_GOLD - 1) * 100)}% of the best the computer rider can do on that arena, and three within ${Math.round((STAR_PLAT - 1) * 100)}%. A round opens when you have at least one star in the one before.`,
  ] },
  { title: 'Time Trial', p: [
    `A single run is ridden on a pattern that changes every run. Each run has a target time. Finish within it and the next run starts with a smaller target; finish over it and you have a strike. ${CHALLENGE_LIVES} strikes end the Time Trial. Your score is 20 points per run and 10 points per second under the target. Your best score is saved.`,
  ] },
  { title: 'Practice and Learn', p: [
    `Practice has unlimited runs on a pattern you choose: the horse and the ground (${GROUNDS.map((g) => g.name).join(', ')}). Learn has three short drills (Steering, The line, Burst) with a goal for each. The guide line is always on in the drills.`,
  ] },
  { title: 'Watch & Learn', p: [
    'The computer rides a round and explains. Before each barrel, and before the run home, it stops and goes through three stages: Think (it works out the line and the speed), Reveal (the planned line is drawn on the ground and the plan is shown) and Act (the run goes on). The thinking time is set in Settings (2 to 10 seconds). Pause stops everything and resumes exactly where it was.',
  ] },
  { title: 'Think hint', p: [
    `During your own run you can tap Think. The run waits and a gold line shows a good line from where you are, with a short note about the next barrel. Close the note to carry on. A hinted run adds ${HINT_COST} second.`,
  ] },
  { title: 'Guide setting', p: [
    'Guided: a white dashed line shows a good line around the pattern and each barrel you must still turn has a ring and an arrow. Marks only: the rings and arrows but no line. Off: nothing; you judge by the barrels alone.',
  ] },
  { title: 'Differences from the real event', p: [
    'In the real event each rider rides one run, the pattern is one size, the surface is chosen by the arena and a rider may take the barrels either way round. Here you ride several short runs, the pattern grows and you always turn each barrel in the traditional direction.',
    'There are no falls, no injuries and no contact with animals. No gambling: times are only for fun.',
  ] },
  { title: 'Text size and controls', p: [
    'Every text screen can be enlarged from 100% to 300% with A+ and A-. Keyboard: Left and Right steer, Down slows, B burst, Space or Enter sets off, T hint, P or Escape pause, plus and minus change the text size on menus.',
  ] },
];
