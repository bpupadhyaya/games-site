// Phone controls for the one player the user runs: a floating stick on the left, three round buttons on the right. Several fingers can be
// down at once (stick + button): main.js hands over every touch by id. A stray extra finger never becomes a second stick or moves a button.
// Keyboard (web): WASD or arrows move, Space/J = action 1, K = action 2, Shift = sprint, P/Escape pause, T think.
import { inRect, inCircle, hudLayout } from './layout.js';
import { clamp, hyp } from './util.js';

export function createControls() {
  const st = { stick: null, a1: null, a2: null, spr: null, mx: 0, mz: 0, sx: 0, sy: 0, ids: new Map() };
  // touches: [{ id, x, y, down, pressed, released }] for this tick
  function read(touches, keys, lay, enabled) {
    const out = { mx: 0, mz: 0, sprint: false, a1: false, a2: false, think: false, pause: false, taps: [] };
    for (const t of touches) {
      if (t.pressed) {
        let role = null;
        if (enabled) {
          if (inCircle(lay.a1, t.x, t.y) && !st.a1) role = 'a1';
          else if (inCircle(lay.a2, t.x, t.y) && !st.a2) role = 'a2';
          else if (inCircle(lay.spr, t.x, t.y) && !st.spr) role = 'spr';
          else if (inRect(lay.stick, t.x, t.y) && !st.stick) role = 'stick';
        }
        if (role === 'stick') { st.stick = { id: t.id, ox: t.x, oy: t.y }; st.sx = t.x; st.sy = t.y; }
        else if (role) { st[role] = { id: t.id }; if (role === 'a1') out.a1 = true; if (role === 'a2') out.a2 = true; }
        else out.taps.push({ x: t.x, y: t.y });          // a plain tap (HUD buttons)
      }
      if (st.stick && st.stick.id === t.id) {
        st.sx = t.x; st.sy = t.y;
        if (t.released || !t.down) st.stick = null;
      }
      for (const k of ['a1', 'a2', 'spr']) if (st[k] && st[k].id === t.id && (t.released || !t.down)) st[k] = null;
    }
    // a touch that vanished without a release (cancelled) frees whatever it held
    const live = new Set(touches.filter((t) => t.down || t.pressed).map((t) => t.id));
    if (st.stick && !live.has(st.stick.id)) st.stick = null;
    for (const k of ['a1', 'a2', 'spr']) if (st[k] && !live.has(st[k].id)) st[k] = null;
    // stick vector (virtual px -> -1..1): screen right is world -x, screen up is world +z
    let vx = 0, vy = 0;
    if (st.stick) {
      let dx = st.sx - st.stick.ox, dy = st.sy - st.stick.oy; const d = hyp(dx, dy), R = 78;
      if (d > R) { st.stick.ox += dx / d * (d - R); st.stick.oy += dy / d * (d - R); dx = st.sx - st.stick.ox; dy = st.sy - st.stick.oy; }
      const m = clamp(hyp(dx, dy) / R, 0, 1), dz = 0.12;
      const k = m < dz ? 0 : ((m - dz) / (1 - dz));
      const l = hyp(dx, dy) || 1; vx = dx / l * k; vy = dy / l * k;
    }
    let kx = 0, ky = 0;
    const kd = keys.down;
    if (kd.has('ArrowLeft') || kd.has('KeyA')) kx -= 1;
    if (kd.has('ArrowRight') || kd.has('KeyD')) kx += 1;
    if (kd.has('ArrowUp') || kd.has('KeyW')) ky -= 1;
    if (kd.has('ArrowDown') || kd.has('KeyS')) ky += 1;
    if (kx || ky) { const l = hyp(kx, ky); vx = kx / l; vy = ky / l; }
    out.mx = -vx; out.mz = -vy; out.sx = vx; out.sy = vy;
    out.sprint = !!st.spr || kd.has('ShiftLeft') || kd.has('ShiftRight');
    if (enabled) {
      if (keys.pressed.has('Space') || keys.pressed.has('KeyJ')) out.a1 = true;
      if (keys.pressed.has('KeyK') || keys.pressed.has('KeyL')) out.a2 = true;
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) out.pause = true;
    if (keys.pressed.has('KeyT')) out.think = true;
    out.down = { a1: !!st.a1, a2: !!st.a2, spr: !!st.spr, stick: st.stick ? { ox: st.stick.ox, oy: st.stick.oy, x: st.sx, y: st.sy } : null };
    return out;
  }
  const reset = () => { st.stick = st.a1 = st.a2 = st.spr = null; };
  return { read, reset, state: st, hudLayout };
}
