// Young-dog training: six short lessons on the meadow. Each lesson teaches one command; the check runs every tick inside the simulation.
import { hyp, wrapAng, clamp } from './util.js';

export const LESSONS = [
  { id: 'comebye', title: 'Come bye', cmd: 'comebye', teach: 'Come bye sends the dog clockwise around the sheep, wide, so it does not disturb them.', goal: 'Send the dog clockwise around the flock for most of a full circle without the sheep running.', ring: null },
  { id: 'away', title: 'Away to me', cmd: 'away', teach: 'Away to me sends the dog anticlockwise around the sheep. Together with Come bye it lets you place the dog on either side.', goal: 'Send the dog anticlockwise around the flock for most of a full circle.', ring: null },
  { id: 'walkon', title: 'Walk on', cmd: 'walkon', teach: 'Walk on tells the dog to move straight in towards the sheep. They drift away from the dog, along the line between them.', goal: 'Flank the dog to the far side of the sheep, then Walk on to move the flock into the ring.', ring: { x: 0, z: 14, r: 6.5 } },
  { id: 'lie', title: 'Lie down', cmd: 'lie', teach: 'Lie down drops the dog where it is. The sheep settle, the dog rests and its stamina comes back.', goal: 'Send the dog around the flock and Lie down in the gold sector behind the sheep.', ring: null, sector: true },
  { id: 'stand', title: 'Stand', cmd: 'stand', teach: 'Stand stops the dog on its feet. It keeps the sheep in check without pushing them. Use it to stop a moving flock exactly where you want it.', goal: 'Bring the flock into the ring, then Stand so that it stops inside.', ring: { x: 0, z: 14, r: 7 }, stop: true },
  { id: 'gate', title: 'Your first gate', cmd: 'walkon', teach: 'Put it all together: place the dog behind the flock on the line to the gate, Walk on, and correct the line with a short flank.', goal: 'Bring all three sheep through the gate.', ring: null, gate: true },
];

export function createLesson(i) {
  const idx = clamp(i | 0, 0, LESSONS.length - 1);
  const L = LESSONS[idx];
  const dest = L.ring ? { x: L.ring.x, z: L.ring.z } : L.gate ? { x: 0, z: 18 } : { x: 0, z: 4 };
  return { idx, ...L, dest, done: false, doneT: 0, prog: 0, hold: 0, note: '' };
}

export function checkLesson(s, c, dt) {
  const L = s.lesson; if (!L) return;
  if (L.done) { L.doneT += dt; return; }
  const C = s.cen, dog = s.dog;
  if (L.id === 'comebye') { L.prog = clamp(s.m.cwTravel / 5.2, 0, 1); if (L.prog >= 1 && s.m.alertSec < 3) complete(s, L); else if (L.prog >= 1) { L.note = 'The sheep were disturbed. Try again: leave the dog wide.'; s.m.cwTravel = 0; s.m.alertSec = 0; } }
  else if (L.id === 'away') { L.prog = clamp(s.m.ccwTravel / 5.2, 0, 1); if (L.prog >= 1 && s.m.alertSec < 3) complete(s, L); else if (L.prog >= 1) { L.note = 'The sheep were disturbed. Try again: leave the dog wide.'; s.m.ccwTravel = 0; s.m.alertSec = 0; } }
  else if (L.id === 'walkon') {
    const d = hyp(C.x - L.ring.x, C.z - L.ring.z); L.prog = clamp(1 - (d - L.ring.r) / 26, 0, 1);
    if (d < L.ring.r) complete(s, L);
  } else if (L.id === 'lie') {
    const dC = hyp(dog.x - C.x, dog.z - C.z), a = Math.atan2(dog.z - C.z, dog.x - C.x);
    const ok = Math.abs(wrapAng(a - s.bal.ang)) < 0.55 && dC < s.rho + 36;
    L.prog = dog.cmd === 'lie' ? (ok ? 1 : 0.5) : 0.2;
    if (dog.cmd === 'lie' && dog.v < 0.3 && ok) { L.hold += dt; if (L.hold > 1) complete(s, L); } else L.hold = 0;
    if (dog.cmd === 'lie' && dog.v < 0.3 && !ok && L.hold === 0) L.note = 'Not in the gold sector. Send the dog around again.';
  } else if (L.id === 'stand') {
    const d = hyp(C.x - L.ring.x, C.z - L.ring.z), sp = s.sheep.reduce((q, a) => q + a.sp, 0) / s.sheep.length;
    L.prog = clamp(1 - (d - L.ring.r) / 26, 0, 1);
    if (d < L.ring.r && sp < 0.35 && dog.cmd === 'stand') { L.hold += dt; if (L.hold > 1.4) complete(s, L); } else L.hold = 0;
  } else if (L.id === 'gate') {
    const g = s.gates[0]; L.prog = clamp(g.through / s.sheep.length, 0, 1);
    if (g.resolved && g.passed) complete(s, L);
    else if (g.resolved) { L.note = 'Some sheep missed the gate. Bring them back and try again.'; for (const a of s.sheep) { a.through.fetch = 0; } g.resolved = false; g.through = 0; g.around = 0; }
  }
}
function complete(s, L) { L.done = true; L.prog = 1; s.events.push({ id: ++s.evId, type: 'lesson', t: s.t }); }
