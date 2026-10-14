// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { BOARDS, BEACHES, RIDES_PER_SESSION, PADDLE, TUBE_D, AIR_Y, FOAM_D, E0, KV, MAX_D } from './sim.js';

export const ABOUT = [
  { title: 'Wave Riding', art: 'wave', p: [
    'Riding waves on a board is one of the oldest ocean traditions. It grew among the peoples of the Pacific, who rode the swells on wooden boards long before it became a sport and a pastime on coasts all over the world.',
    'It is a tradition shared by communities in many places: a rider drops into a swell, stands, and carves across the face of the wave, staying ahead of the foam as it breaks along the wall.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You paddle into a wave, pop up, and steer up and down the face with one finger while the wave breaks behind you. The ride follows a simple model of how a rider gains speed by carving: every carve pumps speed into the board, and the foam is always catching up.',
    'The beaches, boards and riders are invented for the game. Simplifications: the wave is a single long wall that breaks in one direction, the rider never falls off by balance alone, and the wave is read from the side.',
  ] },
  { title: 'Pictures and credits', p: [
    'All art and sound are drawn and synthesised in the game. Wave Riding is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'wave', p: [
    'Ride a wave from the moment it lifts you to the end of the wall. Stay just ahead of the foam, follow the glints, and chase style: tubes, air and a long combo. A session is three waves.',
  ] },
  { title: 'Paddle and pop up', art: 'paddle', p: [
    'Before every wave, pick a board and tap Paddle out. Tap a few times to paddle, then tap again when the ring turns green to pop up. A good pop-up gives you a head start on the foam.',
  ] },
  { title: 'Steer with one finger', art: 'steer', p: [
    'Touch anywhere on the sea and drag up or down: the rider climbs or drops on the face of the wave. You do not have to be exact, the rider follows your finger smoothly. Let go and the rider trims back to the middle.',
  ] },
  { title: 'Follow the glints', art: 'line', p: [
    'The dotted line shows how a good rider pumps: down the face, up, down again. Pass close to a glint for points and to grow the combo multiplier. Carving also builds speed, and speed keeps the foam off you.',
  ] },
  { title: 'Watch the foam meter', art: 'meter', p: [
    'The bar at the bottom shows how far you are ahead of the foam. Red means the foam is about to catch you: carve harder. Green is the pocket where the wave pushes best. Teal is the tube.',
  ] },
  { title: 'Tubes, bursts and air', art: 'tube', p: [
    'In a hollow stretch of wave, let the foam come close and sit low: you ride inside the tube and score fast. A burst of foam on the face must be climbed over or ducked under. A glint at the very top is a lip: reach it for an air, then flick sideways to spin and land clean.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think shows the line a good rider would take and a hint for what to do next. A session where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole session for you. It scouts each wave first, shows its plan, then paddles out and rides. You can pause at any time.',
  ] },
];

const boardLines = BOARDS.map((b) => `${b.name}: turns at up to ${b.turn.toFixed(2)} faces a second, pump ${b.pump.toFixed(2)}, drag ${b.drag.toFixed(3)}, gates count within ${Math.round(b.tol * 100)} percent of the face height.${b.need ? ` Unlocked by a single ride of ${b.need} points.` : ' Always available.'}`);
const beachLines = BEACHES.map((b) => `${b.name} (${b.time}): ${b.len} m long, foam speed ${b.vF0} to ${b.vF1} m/s. ${b.blurb}${b.need ? ` Unlocked by a single ride of ${b.need} points.` : ' Always open.'}`);

export const RULES = [
  { title: 'Goal', p: [
    'Ride the wave to its end without letting the foam catch you, and score as many style points as you can on the way. Gates, tubes and airs add to your score; a wipeout ends the ride at once but keeps what you have scored.',
    `A session is ${RIDES_PER_SESSION} waves. Your result is the total of the three rides. Your best single ride and the longest ride are kept as records.`,
  ] },
  { title: 'The wave and the foam', art: 'wave', p: [
    'The wave is a long wall that breaks from one end to the other. The curl, where the lip falls and the foam begins, travels along the wall at a speed set by the beach. You are always some distance ahead of it.',
    `If the foam gets within ${FOAM_D} metres of you, you wipe out. The distance to the foam is shown as the foam meter, from 0 up to ${MAX_D} metres.`,
  ] },
  { title: 'Speed and energy', p: [
    'Your board has an energy level from 0 to 1. Carving down the face adds energy, carving back up adds a little less, and drag takes energy away all the time. Riding at the very top of the face costs extra energy.',
    `Your speed along the wall is the speed of the foam plus ${KV} metres a second for every unit of energy above ${E0}. More energy than that and you pull away from the foam; less and it catches up. Standing still never works: you need to keep carving.`,
  ] },
  { title: 'The pocket', art: 'meter', p: [
    'The steepest, fastest part of the wave is just ahead of the curl. Carves there give their full energy. Far ahead of the foam, out on the open shoulder, the wave is weak and your carves give less.',
    'Gates are worth half as much again when you take them within 22 metres of the foam, and less when you are more than 40 metres ahead of it. Staying close pays; staying too close is dangerous.',
  ] },
  { title: 'Steering', art: 'steer', p: [
    'You steer by the height on the face: 0 is the bottom of the wave and 1 is the lip. Touch and drag and the rider follows your finger, up or down, as fast as the board can turn. Released, the rider returns slowly to the middle of the face. On a keyboard use the up and down arrow keys.',
  ] },
  { title: 'Gates, combo and multiplier', art: 'line', p: [
    'Gates are glints placed every 15 metres or so along a good carving line. Passing within the board\'s tolerance of the glint scores it. Each scored gate in a row adds to your combo; every 4 in a row raises the multiplier by 1, up to x5.',
    'Missing a gate, hitting a foam burst or landing badly after an air resets the combo and the multiplier.',
  ] },
  { title: 'Tubes', art: 'tube', p: [
    `In a hollow stretch of the wave the lip throws forward. If you are between ${TUBE_D[0]} and ${TUBE_D[1]} metres ahead of the foam and low on the face you are in the tube: drag falls to about a third and you score points every second, multiplied by your combo.`,
    'Leaving a tube after at least 1.4 seconds scores a barrel bonus that grows with the time you spent inside.',
  ] },
  { title: 'Foam bursts', art: 'burst', p: [
    'Some stretches of the wave break all at once. A burst low on the face is a column of whitewater you must climb over; a lip crash high on the face must be ducked under. A warning of spray shows ahead of each one.',
    'Hitting a burst bogs you down: you lose energy, drop back toward the foam and lose your combo, and you cannot be hit again for a moment. While airborne you pass over everything.',
  ] },
  { title: 'Lips and air', art: 'air', p: [
    `A big gate at the very top of the face is a lip. If you reach it above ${Math.round(AIR_Y * 100)} percent of the face height with some energy, you launch into the air.`,
    'In the air, tap or flick sideways to turn the board by a half turn, up to three times. The board turns smoothly, so flick early. At the landing the angle must be close to a whole half turn: an even number of half turns lands forward, an odd number lands backwards for less.',
    'A clean landing scores by the number of turns and your multiplier, and gives energy back. A rough one scores a little. A sloppy one costs energy and your combo.',
  ] },
  { title: 'Paddle and pop-up', art: 'paddle', p: [
    `Every ride starts with a catch of about ${PADDLE.dur} seconds. Tap to paddle: each stroke builds paddle power, which fades if you stop. A ring closes in on its target; tap while it is green to pop up. The better the timing and the more paddle power, the more energy and the bigger head start you have on the foam.`,
    'If you wait too long the rider pops up on its own, late.',
  ] },
  { title: 'Boards', art: 'boards', p: boardLines },
  { title: 'Beaches', art: 'beaches', p: beachLines },
  { title: 'Scoring', p: [
    'Each gate scores 14 points times the multiplier (times 1.5 inside the pocket, 0.6 when far ahead). Time in the tube scores 32 points a second times the multiplier. A barrel bonus scores 90 plus 55 for every second in the tube. A clean air scores 160 for no turn, 300, 520 or 800 for one, two or three half turns, times the multiplier. Finishing the wave scores 150 plus 2 for every gate you hit.',
    'Ranks are given for the total of a session: Paddler from 1,500, Cruiser from 3,500, Wave Rider from 6,000, Barrel Hunter from 9,000 and Wave Master from 12,000.',
  ] },
  { title: 'Modes', p: [
    'Surf Session: three waves at your chosen beach, best total kept per beach. Daily Break: the same three waves for everybody today, one best per day. Free Ride: unlimited waves with no score kept. Watch & Learn: the game scouts, plans and rides a whole session while you watch, with a real Pause.',
    'Think shows the good line and a tip. A session in which you used Think is practice and is not saved as a best.',
  ] },
  { title: 'Controls', p: [
    'Touch: drag up and down anywhere on the sea to steer, tap to paddle and pop up, flick sideways or tap in the air to spin. Keyboard (web demo): up and down arrows or W and S to steer, Space to paddle, pop up and spin, 1 to 4 to choose a board, Enter to go on, H for a hint, P to pause.',
  ] },
];
