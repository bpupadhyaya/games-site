// Touch and keyboard controls for the controlled player: a floating thumb stick, four context buttons, a sprint button and swipes.
// The kit hands the game ONE pointer; main.js adds a multi-touch hub (env.touches) so the stick and a button can be held together. Without the
// hub (headless tests, plain mouse) the single pointer is used. Every touch is assigned to one control when it starts and keeps it until it ends,
// so a stray second finger can never grab the stick or press a button that another finger is using.
import { inCircle, inRect, hudLayout } from './layout.js';

export function createControls() {
  const C = {
    touches: new Map(),               // id -> { id, role, x0, y0, x, y, t }
    stick: { on: false, ox: 0, oy: 0, x: 0, y: 0, mag: 0 },
    btn: [{ down: false, pressed: false, released: false, id: null, t: 0, dx: 0 }, { down: false, pressed: false, released: false, id: null, t: 0, dx: 0 }, { down: false, pressed: false, released: false, id: null, t: 0, dx: 0 }, { down: false, pressed: false, released: false, id: null, t: 0, dx: 0 }],
    sprintT: false, swipe: null, ui: [], keyPrev: new Set(), mt: false,
  };
  C.reset = () => {
    C.touches.clear(); C.stick = { on: false, ox: 0, oy: 0, x: 0, y: 0, mag: 0 };
    for (const b of C.btn) { b.down = b.pressed = b.released = false; b.id = null; b.t = 0; b.dx = 0; }
    C.sprintT = false; C.swipe = null; C.ui = []; C.keyPrev.clear();
  };
  // list: [{ id, x, y, down, pressed, released }] in virtual coordinates. lay: hudLayout. wantSwipe: the keeper role.
  C.feed = (list, lay, dt) => {
    C.ui = []; C.swipe = null;
    for (const b of C.btn) { b.pressed = false; b.released = false; }
    for (const t of list) {
      let tr = C.touches.get(t.id);
      if (t.pressed && !tr) {
        tr = { id: t.id, role: 'none', x0: t.x, y0: t.y, x: t.x, y: t.y, t: 0 };
        C.touches.set(t.id, tr);
        // what did this finger land on?
        let hit = false;
        for (const b of lay.btns) if (!hit && inCircle({ x: b.x, y: b.y, r: b.r + 12 }, t.x, t.y) && !C.btn[b.i].down) { tr.role = `b${b.i}`; C.btn[b.i].down = true; C.btn[b.i].pressed = true; C.btn[b.i].id = t.id; C.btn[b.i].t = 0; C.btn[b.i].dx = 0; hit = true; }
        if (!hit && inCircle({ x: lay.sprint.x, y: lay.sprint.y, r: lay.sprint.r + 12 }, t.x, t.y)) { tr.role = 'sprint'; C.sprintT = true; hit = true; }
        if (!hit && inRect(lay.pause, t.x, t.y)) { tr.role = 'ui'; C.ui.push({ id: 'pause', x: t.x, y: t.y }); hit = true; }
        if (!hit && inRect(lay.think, t.x, t.y)) { tr.role = 'ui'; C.ui.push({ id: 'think', x: t.x, y: t.y }); hit = true; }
        if (!hit && !C.stick.on && inRect(lay.zone, t.x, t.y)) { tr.role = 'stick'; C.stick.on = true; C.stick.ox = t.x; C.stick.oy = t.y; C.stick.x = 0; C.stick.y = 0; C.stick.mag = 0; C.stick.id = t.id; hit = true; }
        if (!hit) { tr.role = 'pitch'; C.ui.push({ id: 'pitch', x: t.x, y: t.y }); }
      }
      if (!tr) continue;
      tr.x = t.x; tr.y = t.y; tr.t += dt;
      if (tr.role === 'stick') {
        const R = 80; let dx = (t.x - C.stick.ox), dy = (t.y - C.stick.oy); const l = Math.hypot(dx, dy);
        // the base follows the finger when it is dragged far, so the thumb never runs off the pad
        if (l > R * 1.4) { C.stick.ox += dx / l * (l - R * 1.4); C.stick.oy += dy / l * (l - R * 1.4); dx = t.x - C.stick.ox; dy = t.y - C.stick.oy; }
        const m = Math.min(1, Math.hypot(dx, dy) / R); const l2 = Math.hypot(dx, dy) || 1;
        C.stick.x = dx / l2 * m; C.stick.y = dy / l2 * m; C.stick.mag = m;
      } else if (tr.role.startsWith('b')) { const b = C.btn[+tr.role[1]]; b.dx = t.x - tr.x0; }
      else if (tr.role === 'pitch' && t.down && !tr.swiped) { const d = Math.hypot(t.x - tr.x0, t.y - tr.y0); if (d > 46) { C.swipe = { dx: t.x - tr.x0, dy: t.y - tr.y0 }; tr.swiped = true; } }
      if (t.released || !t.down) {
        if (tr.role === 'stick') { C.stick.on = false; C.stick.x = C.stick.y = C.stick.mag = 0; }
        else if (tr.role.startsWith('b')) { const b = C.btn[+tr.role[1]]; b.down = false; b.released = true; b.id = null; }
        else if (tr.role === 'sprint') C.sprintT = false;
        else if (tr.role === 'pitch' && !tr.swiped && tr.t < 0.3 && Math.hypot(t.x - tr.x0, t.y - tr.y0) < 20) C.ui.push({ id: 'tap', x: t.x, y: t.y });
        C.touches.delete(t.id);
      }
    }
    // a touch that vanished without a release event (lost pointer): free its control
    const seen = new Set(list.map((t) => t.id));
    for (const [id, tr] of [...C.touches]) if (!seen.has(id) && tr.t >= 0 && !list.length) {
      if (tr.role === 'stick') { C.stick.on = false; C.stick.x = C.stick.y = C.stick.mag = 0; } else if (tr.role.startsWith('b')) { const b = C.btn[+tr.role[1]]; b.down = false; b.released = true; } else if (tr.role === 'sprint') C.sprintT = false;
      C.touches.delete(id);
    }
    for (const b of C.btn) if (b.down) b.t += dt;
  };
  // keyboard: WASD / arrows move, Shift sprints, J K L I (or Z X C V) are the four buttons
  C.keys = (keys) => {
    const k = keys.down;
    let kx = 0, ky = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) kx -= 1; if (k.has('ArrowRight') || k.has('KeyD')) kx += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) ky -= 1; if (k.has('ArrowDown') || k.has('KeyS')) ky += 1;
    const out = { x: 0, y: 0, mag: 0, sprint: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Space') };
    if (kx || ky) { const l = Math.hypot(kx, ky); out.x = kx / l; out.y = ky / l; out.mag = 1; }
    const map = [['KeyJ', 'KeyZ'], ['KeyK', 'KeyX'], ['KeyL', 'KeyC'], ['KeyI', 'KeyV']];
    const kb = map.map((ks) => ({ down: k.has(ks[0]) || k.has(ks[1]), pressed: keys.pressed.has(ks[0]) || keys.pressed.has(ks[1]) }));
    out.btn = kb;
    return out;
  };
  // the abstract input the simulation reads
  C.snapshot = (kb, wantSwipe) => {
    const stick = C.stick.mag > 0.12 ? C.stick : kb && kb.mag ? kb : { x: 0, y: 0, mag: 0 };
    const sprint = C.sprintT || (kb && kb.sprint) || C.stick.mag > 0.94;
    const b = C.btn.map((x, i) => {
      const k = kb && kb.btn[i];
      return { down: x.down || (k && k.down) || false, pressed: x.pressed || (k && k.pressed) || false, released: x.released || (k && !k.down && C.keyPrev.has(i)) || false };
    });
    C.keyPrev = new Set(kb ? kb.btn.map((x, i) => (x.down ? i : -1)).filter((i) => i >= 0) : []);
    let dive = null;
    if (wantSwipe && C.swipe) { const l = Math.hypot(C.swipe.dx, C.swipe.dy) || 1; dive = { dx: -C.swipe.dx / l, dz: -C.swipe.dy / l * 0.6, up: C.swipe.dy / l < -0.75 && Math.abs(C.swipe.dx) < 40 }; }
    const bt0 = C.btn[0];
    // screen right = world -x, screen up = world +z
    return { mx: -stick.x, mz: -stick.y, mag: stick.mag, spr: sprint, b, dive, curve: bt0.down || bt0.released ? -Math.max(-1, Math.min(1, bt0.dx / 60)) : 0 };
  };
  return C;
}
