// Two-thumb controls: the balance pad (drag) and the action button (tap / hold). The shell hands over every finger once per tick; each finger belongs to the
// control it started on. Keyboard: arrows or WASD steer, Space is the button.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function createControls() {
  let padId = null, btnId = null, btnWas = false, kbBtn = false;
  const inCircle = (c, x, y, k) => Math.hypot(x - c.x, y - c.y) <= c.r * k;
  return {
    reset() { padId = null; btnId = null; btnWas = false; },
    beginPlay(list) { padId = null; btnId = null; for (const t of list || []) { t.claimed = true; } btnWas = false; },
    // returns { pad: {f,l,x,y}, act: {pressed, down, released}, ui: {pause, think, replay, next} }
    update(list, lay, down, pressed, land) {
      const ids = new Set(list.map((t) => t.id));
      if (padId !== null && !ids.has(padId)) padId = null;
      if (btnId !== null && !ids.has(btnId)) btnId = null;
      const ui = {};
      for (const t of list) {
        if (t.id === padId || t.id === btnId) continue;
        if (!t.fresh && t.claimed) continue;
        if (btnId === null && inCircle(lay.btn, t.x, t.y, 1.35)) { btnId = t.id; continue; }
        if (padId === null && (inCircle(lay.pad, t.x, t.y, 1.5) || (t.x < lay.pad.x + lay.pad.r * 1.6 && t.y > lay.pad.y - lay.pad.r * 1.6))) { padId = t.id; continue; }
      }
      let px = 0, py = 0;
      const pt = list.find((t) => t.id === padId);
      if (pt) { px = clamp((pt.x - lay.pad.x) / lay.pad.r, -1, 1); py = clamp((pt.y - lay.pad.y) / lay.pad.r, -1, 1); const m = Math.hypot(px, py); if (m > 1) { px /= m; py /= m; } }
      const kx = (down.has('ArrowRight') || down.has('KeyD') ? 1 : 0) - (down.has('ArrowLeft') || down.has('KeyA') ? 1 : 0);
      const ky = (down.has('ArrowDown') || down.has('KeyS') ? 1 : 0) - (down.has('ArrowUp') || down.has('KeyW') ? 1 : 0);
      if (kx || ky) { px = kx; py = ky; }
      const pad = land ? { f: px, l: -py } : { f: -py, l: -px };
      pad.x = px; pad.y = py;
      const kb = down.has('Space') || down.has('Enter');
      const bdown = btnId !== null || kb;
      const act = { down: bdown, pressed: bdown && !btnWas, released: !bdown && btnWas };
      btnWas = bdown;
      return { pad, act, ui, padActive: padId !== null || !!(kx || ky) };
    },
  };
}
