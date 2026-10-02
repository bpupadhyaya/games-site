// The Learn path: short, hands-on lessons (a set-up board, one delivery, a plain verdict) and three quick questions.
// Every board is a real position on the real physics; the model answer of each lesson is the shot "Show me" plays.
import { toButton, inHouse, inGuardZone, FOUR_R, HOUSE_R, scoreEnd, createWorld, addStone } from './sim.js';

// A lesson: { id, title, kind: 'shot'|'quiz', blurb, goal, stones: [[team,x,y]], weights, fixed?, model, check(ctx) -> {ok, msg} }.
// ctx = { stone, w, before, removed (stones of team 1 that left play) }
const m1 = (v) => `${v.toFixed(1)} m`;

export const LESSONS = [
  {
    id: 'draw', title: 'Draw to the button', kind: 'shot',
    blurb: 'A draw is a shot that slides in and stops where you want it.',
    goal: 'Stop your stone inside the red circle (the four-foot).',
    how: 'Drag on the ice to put the broom where the stone should stop. Keep Draw selected, then press Throw. The dotted line shows the path.',
    stones: [], weights: [0], model: { x: 0, y: 0, w: 0, turn: 1, kind: 'draw' },
    check: ({ stone }) => {
      if (!stone || stone.mode !== 'play') return { ok: false, msg: 'The stone left the ice. Place the broom nearer the middle of the house.' };
      const d = toButton(stone);
      if (d <= FOUR_R) return { ok: true, msg: `A fine draw: your stone is ${m1(d)} from the button.` };
      return { ok: false, msg: stone.y < 0 ? `Light: the stone stopped ${m1(Math.abs(stone.y))} short of the button. Try the broom nearer to the button.` : `Heavy: the stone slid ${m1(d)} past. Try the broom nearer to the button.` };
    },
  },
  {
    id: 'guard', title: 'Place a guard', kind: 'shot',
    blurb: 'A guard is a stone left in front of the house to protect what comes next.',
    goal: 'Stop your stone in front of the house, near the centre line.',
    how: 'The free guard zone lies between the hog line and the tee line, outside the rings. Put the broom about halfway between them.',
    stones: [], weights: [0], model: { x: 0, y: -3.7, w: 0, turn: 1, kind: 'guard' },
    check: ({ stone }) => {
      if (!stone || stone.mode !== 'play') return { ok: false, msg: 'The stone did not reach the far hog line, so it was removed. Use more weight: place the broom further up the ice.' };
      if (inGuardZone(stone) && Math.abs(stone.x) < 0.8) return { ok: true, msg: `A guard, ${m1(Math.abs(stone.y))} short of the tee line. Stones in this zone have special protection early in an end.` };
      if (inHouse(stone)) return { ok: false, msg: 'That went into the house. A guard stays in front of the rings: place the broom nearer the hog line.' };
      return { ok: false, msg: 'Not quite in the guard zone. It sits between the red hog line and the rings.' };
    },
  },
  {
    id: 'curl', title: 'Curl around a guard', kind: 'shot',
    blurb: 'Stones curl. An in-turn bends one way, an out-turn the other.',
    goal: 'Get past the yellow guard and stop in the red circle.',
    how: 'Set the broom on the button. Look at the dotted line: if it touches the guard, switch between In-turn and Out-turn so it bends around.',
    stones: [[1, -0.15, -3.6]], weights: [0], model: { x: 0, y: 0, w: 0, turn: -1, kind: 'draw' },
    check: ({ stone, w }) => {
      const g = w.stones.find((s) => s.team === 1);
      if (g && (g.mode !== 'play' || Math.hypot(g.x + 0.15, g.y + 3.6) > 0.02)) return { ok: false, msg: 'You hit the guard. Try the other turn: it makes the stone start on the other side and curl around.' };
      if (!stone || stone.mode !== 'play') return { ok: false, msg: 'The stone left play.' };
      const d = toButton(stone);
      if (d <= FOUR_R) return { ok: true, msg: `Round the guard and ${m1(d)} from the button. That is how a draw behind a guard works.` };
      return { ok: false, msg: `You missed the guard, but the stone stopped ${m1(d)} from the button. Aim for the red circle.` };
    },
  },
  {
    id: 'sweep', title: 'Sweep to reach', kind: 'sweep',
    blurb: 'Sweeping warms the ice in front of the stone: it slides further and curls less.',
    goal: 'This stone is light. Sweep it into the red circle.',
    how: 'When the stone is moving, rub the ice side to side, as fast as you can. The Sweep meter shows your effort. Too little and it stops short; too much and it slides past.',
    stones: [], weights: [0], fixed: { stopY: -1.7, x: 0.05, turn: 1 }, model: null,
    check: ({ stone }) => {
      if (!stone || stone.mode !== 'play') return { ok: false, msg: 'The stone slid out of the back. A little less sweeping next time.' };
      const d = toButton(stone);
      if (d <= FOUR_R) return { ok: true, msg: `You carried it to ${m1(d)} from the button. Without sweeping it would have stopped about 1.7 m short.` };
      return { ok: false, msg: stone.y < -0.5 ? `Still ${m1(Math.abs(stone.y))} short. Start sweeping earlier and keep it up.` : `It slid ${m1(stone.y)} past the button. Ease off once it is close.` };
    },
  },
  {
    id: 'takeout', title: 'Take one out', kind: 'shot',
    blurb: 'A takeout is thrown hard to knock a stone out of play.',
    goal: 'Remove the yellow stone from the button.',
    how: 'Put the broom on the yellow stone and choose Takeout. The extra weight is added for you: you still sweep or not as you like.',
    stones: [[1, 0, 0]], weights: [2, 3], model: { x: 0, y: 0, w: 2, turn: 1, kind: 'takeout' },
    check: ({ removed, w }) => {
      if (removed >= 1) return { ok: true, msg: 'Out it goes. A takeout is the answer when the other side lies shot.' };
      const y = w.stones.find((s) => s.team === 1 && s.mode === 'play');
      return { ok: false, msg: y ? 'The yellow stone is still in play. Put the broom right on it and choose Takeout or Peel.' : 'No luck.' };
    },
  },
  {
    id: 'stay', title: 'Take out and stay', kind: 'shot',
    blurb: 'The best takeout also leaves your own stone in the house.',
    goal: 'Remove the yellow stone and stay in the rings.',
    how: 'Choose Takeout, not Peel: a lighter hit gives up less speed to the other stone, so yours stays near.',
    stones: [[1, 0.1, 0.1]], weights: [1, 2, 3], model: { x: 0.1, y: 0.1, w: 2, turn: 1, kind: 'takeout' },
    check: ({ removed, stone }) => {
      if (removed < 1) return { ok: false, msg: 'The yellow stone is still there. Put the broom right on it.' };
      if (stone && stone.mode === 'play' && inHouse(stone)) return { ok: true, msg: `Removed, and your stone stayed ${m1(toButton(stone))} from the button. Now you lie shot.` };
      return { ok: false, msg: 'You took it out, but your stone rolled out of the house too. Try Takeout rather than Peel.' };
    },
  },
  {
    id: 'count', title: 'Count the points', kind: 'quiz',
    blurb: 'Only one side scores in an end.',
    stones: [[0, 0.12, 0.05], [0, -0.35, -0.2], [1, 0.45, -0.1], [0, 0.2, 0.9], [1, -0.9, 0.3]],
    q: 'How many points does Red score in this end?',
    options: ['0', '1', '2', '3'],
    answer: () => String(scoreEnd(quizWorld(LESSONS[6])).pts),
    explain: 'The side with the stone nearest the button scores, and gets one point for every stone of theirs that is closer than the other side\'s nearest stone. Yellow\'s nearest stone is the third closest, so only the two red stones inside it count.',
  },
  {
    id: 'fgz', title: 'The free guard rule', kind: 'quiz',
    blurb: 'Early in an end a guard is protected.',
    q: 'Second stone of the end: Yellow knocks Red\'s guard out of the free guard zone and out of play. What happens?',
    options: ['Yellow\'s stone is removed and Red\'s guard goes back', 'Red\'s guard stays out, Yellow\'s stone stays'],
    answer: () => 'Yellow\'s stone is removed and Red\'s guard goes back',
    explain: 'During the first stones of an end a guard in the free guard zone cannot be knocked out of play. If it is, the stone that did it is removed and everything is put back. Later in the end the guard is fair game.',
  },
  {
    id: 'last', title: 'The last stone', kind: 'quiz',
    blurb: 'The last stone of an end is worth a lot.',
    q: 'Red scores 2 points this end. Who throws the last stone in the next end?',
    options: ['Red', 'Yellow'],
    answer: () => 'Yellow',
    explain: 'The side that scores gives up the last stone. If nobody scores (a blank end), the side that had it keeps it, which is why holding the last stone is sometimes a reason to blank an end rather than take a single point.',
  },
];

export function quizWorld(def) {
  const w = createWorld();
  for (const [t, x, y] of def.stones ?? []) addStone(w, t, x, y);
  return w;
}
export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export const lessonIndex = (id) => LESSONS.findIndex((l) => l.id === id);
void HOUSE_R;
