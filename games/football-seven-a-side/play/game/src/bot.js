// A simple scripted player used for the store screenshots (?shot=1) and in tests: it plays the human's role through the same abstract
// input the touch controls produce, so the HUD shows real button labels and charge rings.
import { HL, GOAL_HW } from './consts.js';

const btn = () => ({ down: false, pressed: false, released: false });
export function makeBot() {
  let hold = 0, dive = 0;
  return (X) => {
    const s = X.s, B = s.ball, h = s.players[s.human];
    const inp = { mx: 0, mz: 0, mag: 0, spr: false, b: [btn(), btn(), btn(), btn()], dive: null, curve: 0 };
    if (!h || (s.phase !== 'play' && s.phase !== 'setpiece')) return inp;
    const gz = (h.team === 0 ? 1 : -1) * HL;
    if (h.role === 'GK') {
      // stay on the line, dive when a shot comes
      const sg = h.team === 0 ? 1 : -1, g0 = h.team === 0 ? -HL : HL;
      const tx = Math.max(-GOAL_HW, Math.min(GOAL_HW, B.x * 0.3)), dx = tx - h.x;
      inp.mx = Math.abs(dx) > 0.25 ? Math.sign(dx) : 0; inp.mag = inp.mx ? 1 : 0;
      const toward = B.vz * sg < -4 && Math.abs(B.z - g0) < 9;
      if (toward && !h.act && dive <= 0) { const side = (B.x + B.vx * 0.3 - h.x); inp.dive = { dx: Math.sign(side || 1), dz: 0, up: false }; dive = 1.5; }
      dive -= 1 / 60;
      return inp;
    }
    const has = B.owner === h.id;
    if (has) {
      const dx = 0 - h.x, dz = gz - h.z, d = Math.hypot(dx, dz) || 1;
      inp.mx = dx / d; inp.mz = dz / d; inp.mag = 1; inp.spr = d > 10;
      if (d < 11) { hold += 1 / 60; inp.b[0].down = true; if (hold >= 0.35) { inp.b[0].down = false; inp.b[0].released = true; hold = 0; } } else hold = 0;
    } else {
      hold = 0;
      const dx = B.x - h.x, dz = B.z - h.z, d = Math.hypot(dx, dz) || 1;
      inp.mx = dx / d; inp.mz = dz / d; inp.mag = d > 0.6 ? 1 : 0; inp.spr = d > 5;
      if (d < 1.4 && B.owner >= 0 && s.players[B.owner].team !== h.team && s.tick % 40 === 0) { inp.b[0].pressed = true; inp.b[0].down = true; }
    }
    return inp;
  };
}
