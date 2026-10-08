// Text content: About, How to Play, the exhaustive Rules (every number here is the number in sim.js / consts.js), lessons and the quiz.
// A section may carry `art`: the key of a diagram drawn by menus.js with the game's own geometry and physics.
import { GOAL_HW, BAR_H, TILTS, VMAX, CURL_A, RUN_Q, BEATS, EARLY_MAX, CONTACT_LATE, AIM_MAX, SHOOTOUT_KICKS } from './consts.js';

const deg = (r) => Math.round(r * 180 / Math.PI);

export const ABOUT = [
  { title: 'Rugby Conversion', p: [
    'A try has been scored. The ball is on the tee. The conversion is yours alone: read the wind, judge the angle, set the ball, find the rhythm of your run-up and strike it between the posts and over the bar.',
    'Everything is a decision you can see: the flag on the posts, the wind dial, the distance and the angle. The ball is flown with real drag, gravity, wind and spin in a true 3D stadium, with a lifelike kicker.',
  ] },
  { title: 'Ways to play', p: [
    'Challenge Ladder: 24 conversions from six grounds, from a calm training paddock to a windy night stadium. Three kicks each; make two to move on, make all three for three stars.',
    `Rivals' Shootout: ${SHOOTOUT_KICKS} kicks each against a computer kicker in the same wind. Draws go to sudden death.`,
    'Free Practice: pick the spot and the wind yourself. Learn: five short lessons and a quiz. Watch & Learn: a computer kicker plays and explains the wind and the angle before every kick.',
  ] },
  { title: 'Heritage', p: [
    'Goal-kicking from the try line is part of rugby as played in New Zealand, South Africa, Wales and many other countries. This game is an original, simplified take on that craft. It carries no club, union, league or tournament marks.',
  ] },
  { title: 'Full game', p: [
    'The first minute and a half of real play is free. The full game is a single one-time unlock with no ads and no other purchases. Menus, rules, lessons and Watch & Learn are always free. Settings has Restore Purchases.',
  ] },
];

export const HOWTO = [
  { title: 'Read', p: ['Look at the wind dial and the flag on the posts: the arrow shows where the wind is blowing. A cross-wind pushes the ball sideways, a head-wind shortens it, a tail-wind lengthens it. The card on the right gives the distance and how wide the posts look from here.'] },
  { title: 'Aim', p: ['Drag across the picture, or use the AIM slider and its arrows, to move the aim marker along the line of the posts. Aim into the wind: if it blows to the right, aim left of the middle.'] },
  { title: 'Set the ball', p: ['Choose the tilt: Upright (highest, farthest, most drift), Leaning (balanced) or Flat (low, least drift). Set the power with the lever. The readout tells you the carry and how high the ball clears the bar in still air.'] },
  { title: 'Run up', p: ['Press KICK. The kicker steps up in three beats and a ring closes on the ball.'] },
  { title: 'Strike', p: ['Flick up (or tap) exactly as the ring closes. Early pulls the ball left and late pushes it right; both cost power. Flick with a bend to the left or right to curl the ball.'] },
  { title: 'Think', p: ['Stuck? Press Think for the coach: the wind, the angle, the aim, the tilt and the power. Watch & Learn plays whole sessions for you with the reasons.'] },
];

// ---- Rules: exhaustive, cross-checked against sim.js / consts.js ---------------------------------------------------------
export const RULES = [
  { title: 'The conversion', art: 'overview', p: [
    'After a try the scoring side takes one free kick at goal, called a conversion. A successful conversion scores 2 points.',
    'The kick is taken from the ground (the ball sits on a tee) from a spot on the line running straight back from where the try was grounded. In this game the spot is set for you: a distance in metres and how far to the left or right of the middle of the posts the try point is.',
  ] },
  { title: 'The posts and what counts', art: 'posts', p: [
    `The H-posts are two uprights ${GOAL_HW * 2} m apart joined by a crossbar ${BAR_H} m above the ground. The uprights reach up past the top of the picture.`,
    'A kick scores when the ball, at the moment it crosses the line of the posts, has its centre between the two uprights and above the crossbar. How high above does not matter.',
    'A ball that brushes an upright or the bar and still has its centre inside and above counts. A ball that brushes one with its centre outside or below does not, and it bounces back.',
    'Not a goal: Wide (centre outside the uprights, left or right), Short (it came down before the line, or crossed below the bar), Off the bar (it hit the bar and stayed out).',
  ] },
  { title: 'The spot and the angle', art: 'angle', p: [
    'Each kick has a distance from the line of the posts (14 to 48 m on the ladder) and a side offset. The nearer to the middle and the closer in, the wider the target looks.',
    'The window card shows the angle the posts make from the spot in degrees. A kick from the touchline side and far back may have a window of only five or six degrees, which leaves very little room for error.',
  ] },
  { title: 'The wind', art: 'wind', p: [
    'The wind has a speed in metres per second and a direction, shown on the dial: the arrow points where the wind is blowing. Up the screen is toward the posts (a tail-wind), down is a head-wind, left and right are cross-winds.',
    'Wind acts on the ball the whole time it flies. A cross-wind of 6 m/s will carry a normal kick about 2 to 3 m sideways over 40 m. A head-wind shortens the kick and a tail-wind lengthens it.',
    'On the harder grounds the wind gusts: its speed and direction swell and fade every few seconds. The dial shows it live. The wind at the instant of the strike is the one that starts the flight, and the wind keeps changing while the ball is in the air.',
  ] },
  { title: 'Aim', p: [
    `The aim marker is the point on the line of the posts the kicker aims at. It slides up to ${AIM_MAX} m either side of the middle. It is not where the ball will land: the wind will move the ball away from the line you aim along.`,
    'Drag across the picture, drag the AIM handle, or press the arrow buttons (0.25 m each). You can change everything until you press KICK.',
  ] },
  { title: 'Ball tilt and power', art: 'tilt', p: [
    `Tilt sets the launch angle: ${TILTS.map((t) => `${t.name} ${deg(t.elev)} degrees`).join(', ')}.`,
    'Upright climbs highest and carries farthest for the same power, but it hangs in the air, so the wind pushes it the most. Flat is lowest and drifts the least but needs more power for the same distance, and from close range it can pass under the bar.',
    `Power sets the launch speed, from 30 percent to 100 percent of ${VMAX} m/s. The readout below the lever shows, for still air and a perfect strike, the carry (how far the ball goes before it falls back through bar height) and by how much it clears the bar at the posts. Wind, a head-wind most of all, takes away from that.`,
    'More power also means a slightly bigger swing, so a little more random error: use the least power that clears the bar with room to spare.',
  ] },
  { title: 'Run-up and the strike', art: 'rhythm', p: [
    `Press KICK to start the run-up. The kicker takes three steps: you hear and see a beat at ${BEATS.map((b) => b.toFixed(1)).join(', ')} seconds. A ring closes on the ball and reaches it at ${RUN_Q.toFixed(1)} seconds. That is the cue.`,
    `Tap or flick up anywhere on the picture as the ring closes. A press counts from ${EARLY_MAX} s before the cue up to ${CONTACT_LATE} s after it (the foot meets the ball ${CONTACT_LATE} s after the cue). A press earlier than that is ignored and you can try again. If you do not press in time the kicker mishits.`,
    'Timing: how far from the cue you were, in seconds, divided by the ground\'s timing window (the easy grounds are more forgiving). An early strike pulls the ball to the left, a late one pushes it to the right, by 0.16 radians for every second of error. Power is also lost, up to 40 percent. Strikes are called Perfect, Good, Scuffed or Mistimed.',
  ] },
  { title: 'Curl', p: [
    `A flick that bends sideways curls the ball while it flies, with a sideways acceleration of up to ${CURL_A} m/s squared at full bend. A bend to the right curls the ball to the right and a bend to the left curls it to the left. The bend is read when the foot meets the ball. A plain tap gives no curl.`,
    'Use it to bring a wind-blown ball back toward the middle, or to hold it against the wind. It is an advanced skill: a big curl on a short kick is easy to overdo.',
  ] },
  { title: 'Challenge Ladder', p: [
    'Twenty-four levels on six grounds, four levels each: Training Paddock, Village Green, Coastal Ground, Highland Park, City Arena and Night Stadium. Each level is a spot and a wind, and you take 3 kicks.',
    'Make 2 of 3 to pass and open the next level. You earn one star for every goal, so a passed level is worth 2 or 3 stars. Later levels are farther, wider, windier and have a tighter timing margin. Progress is saved.',
  ] },
  { title: "Rivals' Shootout", p: [
    `Five computer rivals from Rookie Boot to Big Match Boot. You and the rival each take ${SHOOTOUT_KICKS} kicks, taking turns, each pair from the same spot in the same wind. Each goal scores 2 points.`,
    'If the score is level after the five kicks you go to sudden death: one kick each at a time until one scores and the other misses. A rival reads the wind with an error that shrinks with its level and strikes with its own timing error.',
  ] },
  { title: 'Practice, Learn and Watch & Learn', p: [
    'Free Practice: choose the distance, the side offset and the wind and kick as long as you like.',
    'Learn: five short lessons (wind, angle, tilt and power, rhythm, curl) played on the real pitch, each with a pass mark, and a quiz.',
    'Watch & Learn: the computer kicker plays a session. Before each kick it thinks (2, 5, 8 or 10 seconds, your choice), then shows its chosen aim, tilt and power for 2 seconds, then kicks. You can Pause and Resume at any moment, and make the thinking time longer or shorter.',
    'Think: during your own kick, press Think for the coach\'s advice. It never kicks for you.',
  ] },
  { title: 'Text size and the free preview', p: [
    'A- and A+ change the text size from 100 to 300 percent on every text screen.',
    'The first minute and a half of real play (ladder, shootout and practice) is free. Menus, Rules, About, lessons, Watch & Learn, Think and pause never count against it.',
  ] },
];

// ---- lessons: each is a scripted run of real kicks with a pass mark -------------------------------------------------------
export const LESSONS = [
  { id: 'wind', title: '1. Reading the wind', goal: 'Make 2 of 3 in a cross-wind', need: 2, rule: 'goals',
    intro: ['A cross-wind pushes the ball sideways all the way to the posts. Look at the dial: the arrow shows where the wind is blowing.', 'Aim into the wind. The more wind, the farther you aim from the middle. The ghost arc shows where an aimed-straight ball would end up.'],
    kicks: [{ sx: 0, d: 24, ws: 4, dir: 90, win: 1.6, noise: 0.8 }, { sx: 0, d: 28, ws: 5, dir: -90, win: 1.6, noise: 0.8 }, { sx: 0, d: 30, ws: 6, dir: 90, win: 1.5, noise: 0.8 }], ghost: true },
  { id: 'angle', title: '2. The angle', goal: 'Make 2 of 3 from the side', need: 2, rule: 'goals',
    intro: ['When the try is scored wide, the posts look narrow. The window card shows how many degrees you have.', 'Take your time with the aim: a small slip is a big miss.'],
    kicks: [{ sx: 14, d: 22, ws: 0, dir: 0, win: 1.6, noise: 0.8 }, { sx: -16, d: 26, ws: 0, dir: 0, win: 1.6, noise: 0.8 }, { sx: 18, d: 30, ws: 1, dir: 90, win: 1.5, noise: 0.8 }], ghost: false },
  { id: 'tilt', title: '3. Tilt and power', goal: 'Make 2 of 3 into a head-wind', need: 2, rule: 'goals',
    intro: ['A head-wind steals distance. Use more power, or a higher tilt for more carry. The readout shows the still-air carry; leave room for the wind.', 'A flat tilt drifts less but carries less: pick the tilt that clears the bar with the least fuss.'],
    kicks: [{ sx: 0, d: 26, ws: 5, dir: 180, win: 1.6, noise: 0.8 }, { sx: 4, d: 30, ws: 6, dir: 170, win: 1.5, noise: 0.8 }, { sx: -4, d: 34, ws: 6, dir: 180, win: 1.5, noise: 0.8 }], ghost: true },
  { id: 'rhythm', title: '4. Rhythm', goal: 'Three Good or Perfect strikes in a row', need: 3, rule: 'strikes',
    intro: ['Press KICK and feel the three beats. The ring closes on the ball at the fourth. Flick as it closes.', 'Early pulls left, late pushes right. Aim only for a clean strike, the goal will follow.'],
    kicks: [{ sx: 0, d: 18, ws: 0, dir: 0, win: 1.0, noise: 0.6 }, { sx: 0, d: 18, ws: 0, dir: 0, win: 1.0, noise: 0.6 }, { sx: 0, d: 18, ws: 0, dir: 0, win: 1.0, noise: 0.6 }], ghost: false },
  { id: 'curl', title: '5. Curl', goal: 'Make 2 of 3 in a strong wind', need: 2, rule: 'goals',
    intro: ['Flick with a bend to curl the ball. A bend toward the wind\'s side holds the ball up against it; a bend away from it brings a pushed ball back.', 'Try aiming a little less into the wind and curling the rest.'],
    kicks: [{ sx: 0, d: 32, ws: 8, dir: 90, win: 1.4, noise: 0.9 }, { sx: 0, d: 34, ws: 8, dir: -90, win: 1.4, noise: 0.9 }, { sx: 6, d: 36, ws: 9, dir: 90, win: 1.4, noise: 0.9 }], ghost: true },
  { id: 'quiz', title: '6. Quiz', goal: 'Answer 5 of 6 correctly', need: 5, quiz: true, intro: ['Six questions about wind, angle and rhythm.'], kicks: [] },
];
export const QUIZ = [
  { q: 'The wind is blowing to the right. Where do you aim?', a: ['Left of the middle', 'Right of the middle', 'At the middle'], ok: 0 },
  { q: 'Which tilt drifts the least in the wind?', a: ['Upright', 'Leaning', 'Flat'], ok: 2 },
  { q: 'You strike late. Where does the ball go?', a: ['Pulled left', 'Pushed right', 'Straight'], ok: 1 },
  { q: 'Which makes the posts look narrowest?', a: ['Close and in the middle', 'Far back and near the touchline', 'Close and near the touchline'], ok: 1 },
  { q: 'A head-wind blows into your face. What helps?', a: ['Less power', 'More power or a higher tilt', 'Nothing'], ok: 1 },
  { q: 'When does the strike count?', a: ['As the ring closes on the ball', 'As soon as you press KICK', 'After the ball lands'], ok: 0 },
];
// lessons are written with wind directions in degrees; the sim wants radians
for (const l of LESSONS) l.kicks = l.kicks.map((k) => ({ ...k, dir: (k.dir * Math.PI) / 180 }));
