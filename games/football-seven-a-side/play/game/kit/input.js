// Unified touch/mouse/keyboard input. update(dt, input) receives a per-tick snapshot:
//   input.pointer = { x, y, down, pressed, released }   (x/y in the game's virtual resolution)
//   input.keys    = { down: Set<code>, pressed: Set<code> }
// "pressed"/"released" are true for exactly one tick. Tests drive the same API via inject().
export function createInput() {
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  const keys = { down: new Set(), pressed: new Set() };
  const queue = [];

  const apply = (ev) => {
    if (ev.type === 'down') {
      pointer.x = ev.x;
      pointer.y = ev.y;
      if (!pointer.down) pointer.pressed = true;
      pointer.down = true;
    } else if (ev.type === 'move') {
      pointer.x = ev.x;
      pointer.y = ev.y;
    } else if (ev.type === 'up') {
      if (ev.x !== undefined) {
        pointer.x = ev.x;
        pointer.y = ev.y;
      }
      if (pointer.down) pointer.released = true;
      pointer.down = false;
    } else if (ev.type === 'key') {
      if (ev.down) {
        if (!keys.down.has(ev.code)) keys.pressed.add(ev.code);
        keys.down.add(ev.code);
      } else keys.down.delete(ev.code);
    }
  };

  return {
    inject: (ev) => queue.push(ev),
    // Call once at the start of every tick; returns the snapshot to hand to game.update.
    snapshot() {
      pointer.pressed = false;
      pointer.released = false;
      keys.pressed.clear();
      for (const ev of queue.splice(0)) apply(ev);
      return { pointer, keys };
    },
    // Browser only: wire DOM events. `view.toVirtual` maps client coords to virtual coords.
    attach(canvas, view) {
      const at = (e) => view.toVirtual(e.clientX, e.clientY);
      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture?.(e.pointerId);
        queue.push({ type: 'down', ...at(e) });
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', (e) => queue.push({ type: 'move', ...at(e) }));
      const up = (e) => queue.push({ type: 'up', ...at(e) });
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      globalThis.addEventListener('keydown', (e) => queue.push({ type: 'key', code: e.code, down: true }));
      globalThis.addEventListener('keyup', (e) => queue.push({ type: 'key', code: e.code, down: false }));
    },
  };
}
