// Touch / mouse / keyboard control for the match.
//   Hold a finger anywhere on the playfield: the paddle slides under it (left-right).
//   Flick the finger UP the screen = a forward stroke; hard = drive, medium = loop (topspin), soft = touch.
//   Flick DOWN = push (soft) or chop (hard, backspin). The angle of the flick aims; a curved flick adds sidespin.
//   Keyboard (web demo): Left/Right move, Up = loop, Space = drive, Down = push, Shift+Down = chop, A/D aim, Q/E sidespin.
import { paddleXFromScreen } from './cam.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WIN = 6;                              // ticks (0.1 s) the gesture is measured over
const MIN_MOVE = 34;                        // virtual units of vertical travel inside the window that count as a flick

export function createControl() {
  const c = { samples: [], active: false, lockout: 0, keyX: 0, lastX: null, flickShown: null };
  c.reset = () => { c.samples.length = 0; c.active = false; c.lockout = 0; c.flickShown = null; };

  // pointer: kit pointer; cam: current camera (or null); area: playfield rect or null (null = nothing accepts paddle input);
  // returns { x: metres|null, flick: {...}|null, held: bool }
  c.update = (dt, pointer, keys, cam, area, startedOnPlayfield) => {
    const out = { x: null, flick: null, held: false };
    c.lockout = Math.max(0, c.lockout - dt);
    const down = pointer.down && startedOnPlayfield;
    if (down && cam) {
      out.held = true;
      c.samples.push({ x: pointer.x, y: pointer.y });
      if (c.samples.length > 12) c.samples.shift();
      const n = c.samples.length;
      const cur = c.samples[n - 1];
      out.x = clamp(paddleXFromScreen(cam, cur.x), -1.2, 1.2);
      if (n > 3 && c.lockout <= 0) {
        const old = c.samples[Math.max(0, n - 1 - WIN)];
        const dy = cur.y - old.y, dx = cur.x - old.x;
        const span = Math.min(WIN, n - 1) / 60;
        if (Math.abs(dy) >= MIN_MOVE && Math.abs(dy) >= 0.55 * Math.abs(dx)) {
          const speed = Math.abs(dy) / span;                      // units per second
          const f = clamp((speed - 360) / 1500, 0, 1);
          // curvature: first half vs second half of the window
          const mid = c.samples[Math.max(0, n - 1 - Math.floor(WIN / 2))];
          const a1 = Math.atan2(mid.x - old.x, -(mid.y - old.y)), a2 = Math.atan2(cur.x - mid.x, -(cur.y - mid.y));
          let curve = clamp((a2 - a1) / 0.8, -1, 1); if (Math.abs(curve) < 0.3) curve = 0;
          let aim = clamp((dx / Math.max(1, Math.abs(dy))) / 0.9, -1, 1); if (Math.abs(aim) < 0.14) aim = 0;
          if (dy > 0) aim = clamp(aim, -1, 1);
          const x0 = clamp(paddleXFromScreen(cam, old.x), -1.2, 1.2);
          out.flick = { dir: dy < 0 ? 'up' : 'down', f: dy < 0 ? f : clamp(f * 1.1, 0, 1), aim, curve, x: x0 };
          c.lockout = 0.32; c.samples.length = 0;
          c.flickShown = out.flick;
        }
      }
    } else if (!pointer.down) { c.samples.length = 0; }
    // keyboard
    if (keys) {
      const kd = keys.down, kp = keys.pressed;
      const mv = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0);
      if (mv) { c.keyX = clamp((c.keyX ?? 0) + mv * dt * 2.6, -1.2, 1.2); out.x = c.keyX; out.held = true; }
      const aim = (kd.has('KeyD') ? 0.8 : 0) - (kd.has('KeyA') ? 0.8 : 0);
      const curve = (kd.has('KeyE') ? 0.8 : 0) - (kd.has('KeyQ') ? 0.8 : 0);
      const fl = (dir, f) => { out.flick = { dir, f, aim, curve, x: out.x ?? c.keyX ?? 0 }; c.flickShown = out.flick; };
      if (kp.has('Space')) fl('up', 0.8);
      else if (kp.has('ArrowUp') || kp.has('KeyW')) fl('up', 0.45);
      else if (kp.has('ArrowDown') || kp.has('KeyS')) fl('down', kd.has('ShiftLeft') || kd.has('ShiftRight') ? 0.75 : 0.3);
    }
    return out;
  };
  c.setKeyX = (x) => { c.keyX = x; };
  return c;
}
