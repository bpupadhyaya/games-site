// Text pages: How to Play, About and Rules. Every number comes from sim.js so the pages cannot drift from the engine.
import { K, LEVELS, RIVALS } from './sim.js';

const P = K.PTS;

export const HOWTO = [
  { title: 'Aim and swing', art: 'aim', text: [
    'Your team-mate tosses the ball high over your bat. Press and drag on the green to aim: the dotted arrow shows where the ball will go. A gap between fielders is the goal.',
    'Release your finger, or tap Swing, as the ring around the ball closes. Early swings loft the ball and pull it left, late swings flatten it and push it right; a swing in the middle hits hardest.',
  ] },
  { title: 'Run, or stay home', art: 'run', text: [
    `Once the ball is in play tap Run! to sprint to the far line (${K.D} m away) for ${P.far} point. Wait until the ball is far from every fielder; a fielder who picks it up will throw at you while you are out in the open.`,
    `At the far line you are safe. Tap Come back to run home for ${P.home} more points, or just stay: the play ends when the ball is back with the server.`,
  ] },
  { title: 'Dodge the throw', art: 'dodge', text: [
    'You are out if a thrown ball hits you or a fielder catches your hit before it bounces. When you see a fielder wind up, tap Dodge (or tap the field to the left or right of your runner) to sidestep.',
    `A dodge needs a moment to recharge, so do not spend it too early. Three outs end your innings, or ${K.TURNS} batters, whichever comes first. Tap Think for a tested suggestion, or use Watch & Learn to see a champion explain every choice, with a real Pause.`,
  ] },
];

export const ABOUT = [
  { title: 'About this game', art: 'field', text: [
    'Lapta is an old Russian bat-and-ball game, played on village greens and in school yards for centuries. Wooden finds from Novgorod show it was known by the 14th century, and it has national championships today.',
    'Two sides play: one bats and runs, the other fields. A batter strikes the ball with a short flat bat, runs to the far line and back, and tries not to be hit by the ball on the way. It is the ancestor of the bat-and-ball family, but it plays differently from baseball: you are put out by being hit.',
    'Here the green, the farmhouses and the birches are drawn for this game. Nothing in it stands for any country, party or brand.',
  ] },
  { title: 'This version', text: [
    'Lapta is part of the Arcforge collection of world heritage games. It has no betting and no stakes, works offline and saves your records on your device.',
    'The rules page lists every number the engine uses. Text size can be set up to 300% in Settings and on every reading page.',
    'Four kit colours (poppy red, cornflower, birch green and sunflower) unlock as your career points grow: 250, 700 and 1400 points.',
  ] },
];

export const RULES = [
  { title: '1. The goal', art: 'field', text: [
    `An innings is up to ${K.TURNS} batters and ends sooner after ${K.OUTS} outs. Each batter has one serve. Points come from running to the far line and back; your innings total is the sum of every batter.`,
    `You bat against the fielding side you choose (${LEVELS.map((l) => l.name).join(', ')}). In the two-side modes both sides bat an innings against the same fielders and the same serves, and the higher total wins.`,
  ] },
  { title: '2. The green', art: 'field', text: [
    `The green is ${2 * K.W} m wide. The home line is where you bat; the far line is ${K.D} m away. Six fielders stand on the green, the server stands ${K.THROW_Y} m in front of the batter and is on your side: the ball cannot be caught by the server and the server never throws at you.`,
    `A fence runs round the green at ${K.FENCE_X} m to either side and ${K.FENCE_Y} m up the field. A ball that reaches it bounces back.`,
  ] },
  { title: '3. The serve and the swing', art: 'serve', text: [
    `The server tosses the ball so that it passes bat height after about ${(1.15).toFixed(1)} to ${(1.45).toFixed(1)} seconds; the ring on the green closes on the bat zone at that moment.`,
    `You hit the ball when your swing is within ${K.WIN} s of that moment. Outside the window the swing misses and the batter's turn is spent; no out is charged. Quality falls smoothly from a perfect swing at the centre to a weak tap at the edges.`,
    `Power runs from 8 to 22 metres per second. An early swing lifts the ball up to about 24 degrees and pulls it up to 13 degrees to the left; a late swing keeps it nearly flat and pushes it up to 13 degrees to the right.`,
  ] },
  { title: '4. Aiming', art: 'aim', text: [
    `Your aim is the direction of the dotted arrow, from ${K.AIM_MAX} degrees left to ${K.AIM_MAX} degrees right of straight up the green. Drag to set it; the swing happens when you release. Keys: left and right arrows aim, Space swings.`,
    'The ball flies on the aim you set plus the pull or push from your timing, then bounces and rolls. Fielders judge where it will come down and run to meet it; a ball hit into a gap lets you run.',
  ] },
  { title: '5. Running', art: 'run', text: [
    `After the hit you may run at any time while the ball is in play. The runner takes about ${(K.D / K.RUN_V).toFixed(1)} seconds to reach the far line. Reaching it banks ${P.far} point. From the far line, running home safely banks ${P.home} more, so a round trip is worth ${P.far + P.home}.`,
    'The home line and the far line are safe: a runner standing on either cannot be hit. A runner who never runs scores nothing but is never out by a throw.',
    'The play is over when a fielder carries the ball back to the server and nobody is running, when the runner is home, or when the runner is out.',
  ] },
  { title: '6. Fielders and throws', art: 'dodge', text: [
    `Two fielders chase each ball; the rest hold their places and lean toward it. A fielder who picks up the ball while you are in the open winds up (${LEVELS.map((l) => `${l.windup.toFixed(2)} s`).join(', ')}) and throws at where you will be. Throw speeds are ${LEVELS.map((l) => `${l.throwV} m/s`).join(', ')} on the three sides, with errors that grow with distance.`,
    `A thrown ball that passes within ${K.HIT_R} m of the runner while the runner is between the lines puts the runner out. A fielder who gets within 1 m tags the runner at once.`,
    'If a throw misses, the ball keeps going and the nearest fielder picks it up and throws again.',
  ] },
  { title: '7. Dodging', art: 'dodge', text: [
    `A dodge jumps the runner about ${(K.DODGE_V * K.DODGE_T).toFixed(1)} m sideways in a fraction of a second and slows the run for a moment. It needs ${K.DODGE_CD.toFixed(1)} seconds to recharge, shown as a fill on the button and a ring round the runner.`,
    'Tap Dodge < or Dodge >, press the arrow keys, or tap the field to the left or right of your runner. A dodge usually clears a throw that has not yet reached you; it cannot help against a throw that is already past.',
  ] },
  { title: '8. Outs', art: 'outs', text: [
    `You are out when a fielder catches your hit before it has bounced (a fly catch), or when a thrown ball hits you in the open. A catch that drops is not an out. Points banked before a throw hit you on the way home stay yours; a caught ball scores nothing.`,
    `Three outs end the innings. Misses and runs you decline are not outs.`,
  ] },
  { title: '9. Score and stars', art: 'score', text: [
    `Stars are earned by innings total: ${K.STARS.map((s, i) => `${i + 1} star${i ? 's' : ''} at ${s}`).join(', ')}. The best possible innings is ${K.TURNS * (P.far + P.home)}.`,
  ] },
  { title: '10. The rival side', art: 'rival', text: [
    `${RIVALS.map((r) => `${r.name}: ${r.note.toLowerCase()}`).join('. ')}. They differ in how steady their swing is, how well they choose a gap and how quickly they dodge.`,
    'Think and the rival test a plan on simulated copies of the serve; the copies reseed the fielders, so a test is a good guide and never a promise.',
  ] },
  { title: '11. Simplifications', text: [
    'Real lapta is played by teams of about ten, with several runners on the field at once, a batter who may keep the bat after three serves, and changes of sides as soon as any runner is out. This version keeps the bat, the far line and being hit by the ball, and compresses an innings into a few minutes.',
    'Distances are in metres on a flat green. The ball, the fielders and the runner follow the simple rules written on these pages; nothing is random once the serve has started except the fielders\' own aim and catches, which are seeded and the same for every side.',
  ] },
];
