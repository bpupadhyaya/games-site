// The Learn path: short hands-on lessons in the real yard (the same physics and rules as a match) and three quick questions.
// A lesson sets a position, runs normally and reports when its goal is met or missed. `active` lists the computer players that
// move in the lesson; everyone else stands still. Pure data plus small checks; game.js runs them.
import { createWorld, taya, slipOf, canUp, runTimes, CAN, LINE_Z } from './sim.js';

function placeCanDown(w, x, z, dir = 0.6) {
  const c = w.can;
  Object.assign(c, { mode: 'rest', x, z, y: 0, px: x, pz: z, py: 0, tilt: 1, ptilt: 1, dir, vx: 0, vz: 0, vy: 0 });
}
function placeSlip(w, id, x, z) {
  const a = w.agents.find((q) => q.id === id), s = slipOf(w, id);
  a.hasSlip = false;
  Object.assign(s, { mode: 'rest', x, z, y: 0.03, px: x, py: 0.03, pz: z, vx: 0, vy: 0, vz: 0, held: 0, yaw: 0.7, pyaw: 0.7, pitch: 0, ppitch: 0 });
}
function setAgent(w, id, x, z) { const a = w.agents.find((q) => q.id === id); Object.assign(a, { x, z, px: x, pz: z, vx: 0, vz: 0 }); return a; }

export const LESSONS = [
  {
    id: 'throw', kind: 'play', role: 'thrower', title: 'Throw at the can', blurb: 'Aim, throw, knock it down', active: [],
    goal: 'Knock the can down with a lob.', how: 'Drag on the yard to put the target ring on the can, then press Throw. The dotted line is where the slipper will fly.',
    setup(w) { w.limit = 1e9; },
    check(w, you) {
      const s = slipOf(w, you.id);
      if (w.stats[you.id].hits >= 1) return { ok: true, msg: 'Down it goes. A thrower scores for every hit.' };
      if (s.mode === 'rest' && !you.hasSlip) return { ok: false, msg: 'The slipper missed. Put the target ring on the middle of the can: the edges miss easily.' };
      return null;
    },
  },
  {
    id: 'skim', kind: 'play', role: 'thrower', title: 'Lob or skim', blurb: 'A low throw sends the can far', active: [],
    goal: 'Choose Skim and knock the can at least 3 m from its circle.', how: 'Press Skim, aim at the middle of the can and throw. A fast, flat slipper sends the can much further than a lob.',
    setup(w) { w.limit = 1e9; },
    check(w, you) {
      const c = w.can, s = slipOf(w, you.id);
      if (w.stats[you.id].hits >= 1 && c.mode === 'rest') {
        const d = Math.hypot(c.x, c.z - CAN.z);
        return d >= 3 ? { ok: true, msg: `The can rolled ${(Math.round(d * 10) / 10).toFixed(1)} m. That is a long fetch for the guard, and time for your friends to run.` }
          : { ok: false, msg: `The can only rolled ${(Math.round(d * 10) / 10).toFixed(1)} m. A lob drops softly; use Skim for a harder, flatter throw.` };
      }
      if (s.mode === 'rest' && !you.hasSlip && w.stats[you.id].hits === 0) return { ok: false, msg: 'Missed. A skim is quick and twitchy: aim at the middle of the can.' };
      return null;
    },
  },
  {
    id: 'race', kind: 'quiz', title: 'Run or wait?', blurb: 'Read the race', q: 'Pia threw and missed. Her slipper lies on the field, the can is standing and the guard is close to it. Should Pia run for the slipper now?',
    options: ['Run now', 'Wait'],
    scene(w) { const T = setAgent(w, 0, 0.8, 3.4); void T; placeSlip(w, 1, -0.5, 2.7); setAgent(w, 1, -1.9, -0.55); return { focus: 1 }; },
    answer(w) { const rt = runTimes(w, w.agents[1]); return rt.slack > 0 ? 'Run now' : 'Wait'; },
    explain(w) {
      const rt = runTimes(w, w.agents[1]), f = (v) => (Math.round(v * 10) / 10).toFixed(1);
      return `Pia needs about ${f(rt.tMe)} s to fetch the slipper and get home. The guard, standing by the standing can, needs only about ${f(rt.tTaya)} s to reach it. Pia would lose the race, so she waits for a friend to knock the can down.`;
    },
  },
  {
    id: 'run', kind: 'play', role: 'thrower', title: 'Fetch it and get home', blurb: 'Dash for your slipper', active: [0],
    goal: 'Fetch your slipper and get back behind the toe line before you are tagged.', how: 'The can is down and the guard has to fetch it first. Press Fetch slipper (or touch the yard to steer yourself) and run: behind the toe line you are safe.',
    setup(w) {
      w.limit = 1e9;
      placeCanDown(w, -2.2, 7.0); const T = setAgent(w, 0, 1.0, 5.2); T.speed = 2.6;
      placeSlip(w, 2, 1.5, 2.4);
    },
    check(w, you) {
      if (w.stats[you.id].safes >= 1) return { ok: true, msg: 'Safe. While the can is down the guard cannot tag anyone, so that is the moment to run.' };
      if (w.over && w.over.kind === 'tag') return { ok: false, msg: 'Tagged! Once the can stands again the guard can tag you. Use Think to see how much time you have.' };
      return null;
    },
  },
  {
    id: 'safe', kind: 'quiz', title: 'Where is safe?', blurb: 'The toe line', q: 'The can is standing and the guard is right beside Rey. Rey is standing just behind the toe line. Can the guard tag him?',
    options: ['Yes, the guard is close enough', 'No, behind the toe line is safe'],
    scene(w) { setAgent(w, 0, 0.1, 0.9); setAgent(w, 2, 0, -0.5); return { focus: 2 }; },
    answer() { return 'No, behind the toe line is safe'; },
    explain() { return 'Home, the area behind the toe line, is safe. A thrower can only be tagged while out in the yard, in front of the line.'; },
  },
  {
    id: 'fix', kind: 'play', role: 'taya', title: 'Guard: stand the can up', blurb: 'Fetch it, carry it, set it', active: [],
    goal: 'Fetch the fallen can, carry it into the chalk circle and stand it up.', how: 'Press Fix can, or steer by touching the yard. Pick up the can by touching it, carry it into the circle and hold still for a moment.',
    setup(w) { w.limit = 1e9; placeCanDown(w, -2.4, 7.2); setAgent(w, 0, 0.5, 3.2); },
    check(w) { if (canUp(w)) return { ok: true, msg: 'The can stands. Only now may you tag anyone. A fast guard fixes the can before the runners get home.' }; return null; },
  },
  {
    id: 'tag', kind: 'play', role: 'taya', title: 'Guard: tag a runner', blurb: 'Catch the one out in the yard', active: [1],
    goal: 'Tag the runner before they get back behind the toe line.', how: 'The can is standing. Press Chase or steer yourself towards the runner: touch them while they are in front of the line. Cut them off from their slipper.',
    setup(w) { w.limit = 40; setAgent(w, 0, 0.2, 3.9); placeSlip(w, 1, -0.9, 2.0); setAgent(w, 1, -1.9, -0.55); },
    check(w) {
      if (w.over && w.over.kind === 'tag') return { ok: true, msg: 'Tagged! A guard who stays between the runner and their slipper usually wins the race.' };
      if (w.stats[1].safes >= 1 || (w.over && w.over.kind === 'timeout')) return { ok: false, msg: 'The runner got home. Go for the slipper first: the runner has to come to you.' };
      return null;
    },
  },
  {
    id: 'canup', kind: 'quiz', title: 'When can the guard tag?', blurb: 'The can must stand', q: 'A hit has knocked the can over. A thrower is running for a slipper out in the yard and the guard touches them. Does it count as a tag?',
    options: ['Yes, they are out in the yard', 'No, the can is down'],
    scene(w) { placeCanDown(w, -1.5, 6.8); setAgent(w, 0, 0.9, 3.0); setAgent(w, 1, 0.6, 2.7); return { focus: 1 }; },
    answer() { return 'No, the can is down'; },
    explain() { return 'The guard may only tag while the can stands in its circle. With the can down, the guard has to fetch it and stand it up first; that is the runners\' chance.'; },
  },
];
export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export const lessonIndex = (id) => LESSONS.findIndex((l) => l.id === id);
export function quizWorld(def) { const w = createWorld(); w.go = 0; const r = def.scene(w); w.focus = r ? r.focus : -1; return w; }
export { taya, LINE_Z };
