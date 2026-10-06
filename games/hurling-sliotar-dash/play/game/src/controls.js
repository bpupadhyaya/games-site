// Touch + keyboard controls for the real-time play screen. The shell hands the game every finger at once (see web/main.js);
// each finger is bound to the control it started on (floating stick, one of four round buttons, Pause, Think), so a stray
// extra finger can never move the stick or press another button. Without multi-touch (headless runs, a mouse) the kit's single
// pointer is used the same way.
import { hudLayout, inRect, inCircle } from './layout.js';

// Screen direction (right, up) -> court direction (x, z). Portrait: the camera looks down the pitch (right = +x, up = +z). Landscape: the camera is on the
// near sideline looking across it, own goal on the left (right = +z, up = -x), so the stick and arrow keys turn with the picture.
const toWorld = (right, up, side) => (side ? [-up, right] : [right, up]);

export function createControls() {
  const st = { binds: new Map(), stick: null, down: false, pending: { pass: false, rise: false, hook: false, burst: false, pause: false, think: false }, prevKeys: new Set() };

  function classify(t, lay) {
    if (inCircle(lay.strike, t.x, t.y)) return { kind: 'strike' };
    for (const k of ['pass', 'rise', 'hook']) if (inCircle(lay[k], t.x, t.y)) return { kind: k };
    if (inRect(lay.util.pause, t.x, t.y)) return { kind: 'pause' };
    if (inRect(lay.util.think, t.x, t.y)) return { kind: 'think' };
    if (!st.stick && inRect(lay.stick.zone, t.x, t.y)) return { kind: 'stick' };
    return { kind: 'ignore' };
  }

  // touches: [{ id, x, y }] currently down (virtual coordinates). keys: Set of codes currently held; pressedKeys: codes pressed this tick.
  function update(touches, lay, keys, pressedKeys, side = false) {
    const live = new Set(touches.map((t) => t.id));
    for (const [id, b] of [...st.binds]) {
      if (!live.has(id)) {
        if (b.kind === 'stick') st.stick = null;
        if (b.kind === 'strike') st.strikeId = null;
        st.binds.delete(id);
      }
    }
    for (const t of touches) {
      let b = st.binds.get(t.id);
      if (!b) {
        b = classify(t, lay); st.binds.set(t.id, b);
        if (b.kind === 'stick') st.stick = { id: t.id, ox: t.x, oy: t.y, x: t.x, y: t.y };
        else if (b.kind === 'strike') st.strikeId = t.id;
        else if (st.pending[b.kind] !== undefined) st.pending[b.kind] = true;
      }
      if (b.kind === 'stick' && st.stick && st.stick.id === t.id) {
        st.stick.x = t.x; st.stick.y = t.y;
        const dx = t.x - st.stick.ox, dy = t.y - st.stick.oy, d = Math.hypot(dx, dy), R = lay.stick.r;
        if (d > R * 1.25) { const k = (d - R * 1.25) / d; st.stick.ox += dx * k; st.stick.oy += dy * k; }
      }
    }
    // stick vector
    let mx = 0, mz = 0;
    if (st.stick) {
      const dx = st.stick.x - st.stick.ox, dy = st.stick.y - st.stick.oy, R = lay.stick.r;
      const m = Math.min(1, Math.hypot(dx, dy) / R);
      if (m > 0.08) { const a = Math.atan2(dy, dx); [mx, mz] = toWorld(Math.cos(a) * m, -Math.sin(a) * m, side); }
    }
    // keyboard
    const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    const kz = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
    if (kx || kz) { const l = Math.hypot(kx, kz); [mx, mz] = toWorld(kx / l, kz / l, side); }
    const strikeDown = st.strikeId != null || keys.has('Space');
    const out = {
      mx, mz, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), down: strikeDown,
      pass: st.pending.pass || pressedKeys.has('KeyJ'), rise: st.pending.rise || pressedKeys.has('KeyK'), hook: st.pending.hook || pressedKeys.has('KeyL'),
      burst: pressedKeys.has('KeyB'),
    };
    const ui = { pause: st.pending.pause || pressedKeys.has('KeyP') || pressedKeys.has('Escape'), think: st.pending.think || pressedKeys.has('KeyT') };
    for (const k of Object.keys(st.pending)) st.pending[k] = false;
    const held = { strike: strikeDown, pass: [...st.binds.values()].some((b) => b.kind === 'pass'), rise: [...st.binds.values()].some((b) => b.kind === 'rise'), hook: [...st.binds.values()].some((b) => b.kind === 'hook') };
    return { input: out, ui, stick: st.stick ? { ...st.stick } : null, held };
  }
  const beginPlay = (touches) => { st.binds.clear(); st.stick = null; st.strikeId = null; for (const k of Object.keys(st.pending)) st.pending[k] = false; for (const t of touches) st.binds.set(t.id, { kind: 'ignore' }); };
  const reset = () => { st.binds.clear(); st.stick = null; st.strikeId = null; for (const k of Object.keys(st.pending)) st.pending[k] = false; };
  return { update, reset, beginPlay, state: st };
}
