// The handler's advisor. One brain for Watch & Learn (the computer plays), the Think hint in play, and the headless scenario tests.
// It reads the simulation like a person would: where the flock is, where it has to go, where the dog is on the circle around it.
import { hyp, wrapAng, clamp } from './util.js';
import { CMD_NAME } from './sim.js';

const deg = (r) => Math.round((Math.abs(r) * 180) / Math.PI);

export function createBot(S, rng) {
  const s = S.s;
  let side = 0;
  const geom = () => {
    const d = s.dog, C = s.cen, dest = s.dest;
    const bx = C.x - dest.x, bz = C.z - dest.z;
    const angBal = Math.atan2(bz, bx);
    const rel = { x: d.x - C.x, z: d.z - C.z };
    const angDog = Math.atan2(rel.z, rel.x), dC = hyp(rel.x, rel.z);
    return { eps: wrapAng(angDog - angBal), dC, dist: hyp(C.x - dest.x, C.z - dest.z), angBal };
  };
  const avgSp = () => s.sheep.reduce((q, a) => q + a.sp, 0) / s.sheep.length;
  const maxSp = () => s.sheep.reduce((q, a) => Math.max(q, a.sp), 0);
  const dir = (eps) => (eps > 0 ? 'comebye' : 'away');          // eps > 0: the dog is anticlockwise of the balance point, so go clockwise
  const sideName = (cmd) => (cmd === 'comebye' ? 'clockwise (to the dog\'s left)' : 'anticlockwise (to the dog\'s right)');
  const destName = () => {
    if (s.training) return 'the ring';
    switch (s.phase) {
      case 'outrun': case 'lift': return s.gates[0].resolved ? 'the handler' : 'the fetch gate';
      case 'fetch': return s.gates[0].resolved ? 'the handler' : 'the fetch gate';
      case 'drive1': return 'the first drive gate'; case 'drive2': return 'the second drive gate'; default: return 'the pen';
    }
  };

  // the best command for now, with the reason. `cur` is the command the dog is working on.
  function advise() {
    const d = s.dog, G = geom(), Z = s.Z, cur = d.cmd, dest = s.dest;
    const mark = { x: s.bal.x, z: s.bal.z, kind: 'balance' };
    const out = (cmd, title, why, extra = {}) => ({ cmd, title, why, mark, ...extra });
    if (s.over) return out(cur, 'Finished', 'The run is over.');
    // the pen gate
    if (s.pen && s.phase === 'pen') {
      if (!s.pen.open && !s.pen.closed && s.hand.arrived && hyp(s.cen.x - s.pen.cx, s.cen.z - s.pen.z1) < 30 && s.pen.inside < s.sheep.length) return out(cur, 'Open the gate', 'The handler is at the pen gate and the flock is close. Open the gate so the sheep can walk in.', { gate: 'open' });
      if (s.pen.open && s.pen.inside === s.sheep.length) return out(cur, 'Shut the gate', 'All the sheep are in the pen. Shut the gate to finish the run.', { gate: 'shut' });
    }
    // start of the run
    if (s.cmdCount === 0 && !s.training) {
      const c = s.cen.x > 0 ? 'away' : 'comebye';
      return out(c, `Send the dog: ${CMD_NAME[c]}`, `The flock is ${Math.round(hyp(s.cen.x, s.cen.z))} m up the field. ${CMD_NAME[c]} sends the dog ${sideName(c)}, wide of the sheep, to arrive behind them on the line to ${destName()}.`);
    }
    // the dog is tired
    if (d.stamina < 0.2 && cur !== 'lie' && maxSp() < 2.5) return out('lie', 'Lie down', `The dog is tired (${Math.round(d.stamina * 100)}% stamina). Lie down gives it a rest while the sheep settle.`);
    if (cur === 'lie' && d.stamina < 0.62 && maxSp() < 2.2 && s.phase !== 'outrun') return out('lie', 'Keep resting', 'The dog is still getting its breath back. Resting now means more speed later.');
    // sheep running: take the pressure off
    if (maxSp() > 4.4 && G.dC < Z * 1.6 && cur !== 'lie') return out('lie', 'Lie down', 'The sheep are running. Lie down takes the pressure off so they settle and bunch up again.');
    if (cur === 'lie' && maxSp() > 1.8 && s.phase !== 'outrun') return out('lie', 'Wait for them to settle', 'Still running. Wait until they walk before pushing again.');
    // the pen mouth: squeeze in
    // flanks: we must be on the balance point
    const near = d.nearest;
    const offLine = Math.abs(G.eps);
    const flankDir = dir(G.eps);
    if (cur === 'comebye' || cur === 'away') {
      // flanking: stop the dog when it has reached the balance point
      const toGo = Math.abs(G.eps);
      const wrongWay = flankDir !== cur && toGo > 0.5;
      if (wrongWay) return out(flankDir, `${CMD_NAME[flankDir]}`, `The dog has gone past the balance point. ${CMD_NAME[flankDir]} brings it back round the short way.`);
      if (toGo < 0.2 && G.dC < s.rho + Z * 2.4) return out('walkon', 'Walk on', `The dog is on the far side of the flock from ${destName()} (${deg(G.eps)} degrees off). Walk on now pushes the flock along the line.`);
      if (toGo < 0.2) return out('stand', 'Stand', 'The dog is at the balance point, directly behind the flock. Stand holds it there before the lift.');
      return out(cur, `Keep going: ${CMD_NAME[cur]}`, `The dog is still ${deg(G.eps)} degrees from the balance point behind the flock.`);
    }
    // working positions
    if (offLine > 0.5 && (cur === 'walkon' || cur === 'stand')) {
      const c = flankDir;
      if (cur === 'walkon' && near < Z * 1.4) return out('stand', 'Stand', `The flock is drifting off the line (dog ${deg(G.eps)} degrees off the balance point). Stand first so the dog stops pushing, then flank.`);
      return out(c, `${CMD_NAME[c]}`, `The dog is ${deg(G.eps)} degrees off the balance point, so the flock would drift sideways. ${CMD_NAME[c]} moves it round to the right spot ${G.dC < s.rho + Z ? 'close in' : 'wide'}.`);
    }
    if (cur === 'stand' || cur === 'lie') {
      if (G.dist < 7 && !dest.gate && !dest.pen && s.phase !== 'outrun' && !s.training) return out(cur, 'Hold them there', 'The flock is almost at its target. No more pushing.');
      if (s.training && G.dist < 7) return out(cur, 'Hold them there', 'The flock is in place. Keep the dog still.');
      return out('walkon', 'Walk on', `The dog is on the balance point (${deg(G.eps)} degrees off). Walk on moves the flock steadily towards ${destName()}.`);
    }
    // walking on
    if (cur === 'walkon') {
      if (G.dist < 6 && !s.pen && !s.training) return out('stand', 'Stand', 'The flock has arrived. Stand stops the push.');
      if (s.training && G.dist < s.lesson?.ring?.r * 0.8) return out('stand', 'Stand', 'The flock is in the ring. Stand to stop it.');
      if (s.spread > 12 && s.phase !== 'outrun') return out('stand', 'Stand', 'The flock is stretching out. Stand lets the stragglers catch up.');
      if (offLine > 0.3) return out(flankDir, `${CMD_NAME[flankDir]} (small)`, `A little drift: the dog is ${deg(G.eps)} degrees off the line. A short ${CMD_NAME[flankDir]} will put it right.`);
      return out('walkon', 'Keep walking on', `On the line to ${destName()}, ${Math.round(G.dist)} m to go. Steady pressure keeps the flock tight.`);
    }
    return out(cur, 'Keep going', 'All is well.');
  }
  // the next decision in the Watch & Learn loop: returns null while the current command is right
  function next() {
    if (s.over) return null;
    const a = advise();
    const cur = s.dog.cmd;
    if (a.gate) return a;
    if (a.cmd === cur) return null;
    const dwell = (cur === 'lie' && a.cmd !== 'lie') ? 1.5 : 0.9;
    if (s.t - s.lastCmdT < dwell && !(a.cmd === 'lie' || a.cmd === 'stand')) return null;
    return a;
  }
  return { advise, next, geom };
}
