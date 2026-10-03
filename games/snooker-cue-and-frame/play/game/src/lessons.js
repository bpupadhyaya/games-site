// The Learn path: short hands-on lessons on the real table plus a few quick questions. Each shot lesson sets up a small position, states a
// goal and checks the real result of the shot through the same physics and rules as a match. `model` is the "Show me" shot.
import { createWorld, addBall, ballById, CUE, BLACK, BLUE, PINK, VALUE, TW, TL, MID_X, BAULK_Y, R } from './sim.js';
import { newFrame, canHitDirect } from './rules.js';

const dist = (a, x, y) => Math.hypot(a.x - x, a.y - y);

export const LESSONS = [
  {
    id: 'pot', kind: 'shot', title: 'Aim and pot', blurb: 'Line up the white, the red and the pocket',
    goal: 'Pot the red into any pocket.', how: 'Drag on the table so the dotted line ends at the red; the gold line shows where the red will go. Pull the cue back to shoot.',
    balls: [[1, 0.5, 2.85], [CUE, 1.1, 1.5]], on: 'red', aim: undefined,
    model: { angle: 1.9763, power: 0.34, a: 0, b: 0 },
    check: ({ res }) => (res.potted.some((id) => id >= 1 && id <= 15) && !res.foul ? { ok: true, msg: 'Potted. The white, the red and the pocket were in one line.' } : { ok: false, msg: res.foul ? 'That was a foul. Aim the white at the red first.' : 'The red missed the pocket. Use the magnifier to aim a little finer, then try again.' }),
  },
  {
    id: 'cut', kind: 'shot', title: 'Cut a ball in', blurb: 'Hit the red thinly so it heads for the pocket',
    goal: 'Pot the red. The white must hit it off-centre.', how: 'The ghost white shows where the white will be at the moment of contact. Put it so the red points at a pocket.',
    balls: [[1, 1.25, 2.2], [CUE, 0.45, 1.2]], on: 'red', model: { angle: 0.8675, power: 0.37, a: 0, b: 0 },
    check: ({ res }) => (res.potted.some((id) => id >= 1 && id <= 15) && !res.foul ? { ok: true, msg: 'Potted. A thinner contact sends the red more sideways.' } : { ok: false, msg: 'Not in. A cut shot sends the red along the line from the ghost white through the red: aim the ghost white there.' }),
  },
  {
    id: 'power', kind: 'shot', title: 'Control the power', blurb: 'Stop the white inside the ring',
    goal: 'Roll the white so it stops inside the ring.', how: 'Pull the cue back only a little. Gentle shots go a long way on this cloth.',
    balls: [[CUE, MID_X, 0.6]], on: 'red', aim: Math.PI / 2, target: { x: MID_X, y: 2.3, r: 0.3 }, model: { angle: Math.PI / 2, power: 0.265, a: 0, b: 0 },
    check: ({ cue }) => (cue && cue.on && dist(cue, MID_X, 2.3) < 0.3 ? { ok: true, msg: 'In the ring. Learning how far each pull travels is half of position play.' } : { ok: false, msg: cue && cue.on ? `The white stopped ${dist(cue, MID_X, 2.3) < 0.7 ? 'close' : 'a long way'} from the ring. Try a ${cue.y < 2.3 ? 'firmer' : 'softer'} pull.` : 'The white was potted.' }),
  },
  {
    id: 'draw', kind: 'shot', title: 'Back spin (draw)', blurb: 'Pot the red and bring the white back',
    goal: 'Pot the red and make the white come back towards the ring.', how: 'Tap the lower half of the spin circle (or Spin, then the lower half). Back spin pulls the white back after it hits the red.',
    balls: [[1, 0.5, 1.784], [CUE, 1.3, 1.784]], on: 'red', aim: Math.PI, target: { x: 1.05, y: 1.784, r: 0.3 }, model: { angle: 3.13, power: 0.55, a: 0, b: -0.8 },
    check: ({ res, cue }) => (res.potted.some((id) => id >= 1 && id <= 15) && cue && cue.on && cue.x > 0.75 ? { ok: true, msg: 'Potted, and the white came back. Back spin turns against the white\'s motion, so it reverses after contact.' } : { ok: false, msg: res.potted.length && cue && cue.on ? 'The red went in, but the white followed it. Aim the tip lower on the white for more back spin.' : 'Pot the red first, with the tip low on the white.' }),
  },
  {
    id: 'position', kind: 'shot', title: 'Position for the black', blurb: 'Pot the red, then see the black',
    goal: 'Pot the red and leave the white with a clear view of the black.', how: 'After a red, a colour is on. Think about where the white stops, not only about the pot.',
    balls: [[1, 0.5, 2.85], [BLACK, MID_X, TL - 0.324], [CUE, 1.1, 1.5]], on: 'red', model: { angle: 1.9775, power: 0.4, a: 0, b: 0.55 },
    check: ({ res, cue, w }) => {
      const potted = res.potted.some((id) => id >= 1 && id <= 15);
      if (!potted) return { ok: false, msg: 'The red stayed on the table. Pot it first.' };
      if (!cue || !cue.on) return { ok: false, msg: 'The white went in as well.' };
      const see = canHitDirect(w, BLACK, [BLACK]);
      return see ? { ok: true, msg: 'Potted, and the black is in view: you could carry the break on.' } : { ok: false, msg: 'The red went in, but the white has no clear line to the black. Change the pace or the spin so it finishes elsewhere.' };
    },
  },
  {
    id: 'safe', kind: 'shot', title: 'Play safe', blurb: 'Hit a red and leave the white far away',
    goal: 'Hit a red without potting anything and finish with the white in the baulk area (behind the line).', how: 'Hit the front red thinly and softly, with a little back spin, so the white comes back.',
    balls: [[1, 0.8, 2.75], [2, 0.95, 2.88], [3, 1.0, 2.62], [CUE, 0.9, 1.3]], on: 'red', model: { angle: 1.57, power: 0.6, a: 0, b: -0.9 },
    check: ({ res, cue }) => (!res.foul && res.potted.length === 0 && cue && cue.on && cue.y < BAULK_Y ? { ok: true, msg: 'Safe: the white is back in baulk and the opponent has a hard shot.' } : { ok: false, msg: res.foul ? 'That was a foul: the white must hit a red, then something must reach a cushion.' : res.potted.length ? 'Something was potted: the aim here is a safe shot.' : 'The white did not get back far enough. Try more back spin or a firmer thin contact.' }),
  },
  {
    id: 'fouls', kind: 'quiz', title: 'Quiz: fouls', blurb: 'What does a foul cost?',
    q: 'A red is on and the white hits the blue first. How many points go to the opponent?',
    options: ['4', '5', '1', '7'], answer: () => String(Math.max(4, VALUE(BLUE))),
    explain: 'A foul is worth the value of the ball involved, at least 4, at most 7. The blue is worth 5, so 5 points.',
    stones: [[1, 0.9, 2.8], [BLUE, MID_X, TL / 2], [CUE, 0.9, 0.8]],
  },
  {
    id: 'order', kind: 'quiz', title: 'Quiz: after the reds', blurb: 'The order of the colours',
    q: 'All the reds are gone. Which colour must be hit first?',
    options: ['Yellow (2)', 'Black (7)', 'Pink (6)', 'Any colour'], answer: () => 'Yellow (2)',
    explain: 'Once the reds are gone the colours are played in order of value: yellow, green, brown, blue, pink, black. They stay down when potted.',
  },
  {
    id: 'free', kind: 'quiz', title: 'Quiz: the free ball', blurb: 'When you may play any ball',
    q: 'After a foul, you cannot see any ball on because another ball blocks the way. What do you get?',
    options: ['A free ball', 'Nothing', 'The frame', 'Two shots'], answer: () => 'A free ball',
    explain: 'If the white is snookered after a foul, the next player may play any ball as if it were the ball on. Potting it scores as the ball on, and it is put back on the table.',
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id) ?? null;
export const lessonIndex = (id) => LESSONS.findIndex((l) => l.id === id);

export function lessonWorld(def) {
  const w = createWorld();
  for (const [id, x, y] of def.balls) addBall(w, id, x, y);
  const f = newFrame({ format: 'six', breaker: 0, names: ['You', 'Opponent'] });
  f.inHand = false; f.turn = 0; f.on = def.on ?? 'red'; f.redsLeft = w.b.filter((q) => q.id >= 1 && q.id <= 15).length;
  return { w, f };
}
void PINK; void TW; void R;
