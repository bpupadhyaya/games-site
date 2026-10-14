// The chase camera of the play screen: a presentation-only, smoothed sideways follow of the action (the runner, the ball in the air, the fielder
// holding it) so the picture can stay close on a phone. It reads the game state and never feeds anything back into the simulation.
import { K } from './sim.js';

export const camState = { x: 0, v: 0, yaw: 0 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function resetCam() { camState.x = 0; camState.v = 0; }

// Critically damped follow (w rad/s). dt is the game's frame time.
export function stepCam(dt, state) {
  let want = 0;
  const m = state.m;
  if (state.scene === 'play' && m && m.T && m.ph === 'play') {
    const T = m.T, r = T.runner, b = T.ball;
    if (T.ph === 'play') {
      const running = r.st === 'toFar' || r.st === 'back' || r.st === 'atFar';
      const ballLive = b.st === 'air' || b.st === 'roll' || b.st === 'thrown';
      if (running && ballLive) want = 0.5 * r.x + 0.5 * b.x;
      else if (running) want = r.x;
      else if (ballLive) want = b.x;
      else if (b.st === 'held' && T.holder >= 0 && T.fielders[T.holder]) want = T.fielders[T.holder].x;
      want *= 0.62;
    }
  }
  want = clamp(want, -7.5, 7.5);
  const w = 3.2, d = Math.min(0.05, dt);
  const a = -2 * w * camState.v - w * w * (camState.x - want);
  camState.v += a * d; camState.x += camState.v * d;
  if (!(Math.abs(camState.x) < 50)) { camState.x = 0; camState.v = 0; }
}
void K;
