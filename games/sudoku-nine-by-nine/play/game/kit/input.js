// Unified touch/mouse/keyboard input. update(dt, input) receives a per-tick snapshot:
//   input.pointer = { x, y, down, pressed, released }   (x/y in the game's virtual resolution)
//   input.keys    = { down: Set<code>, pressed: Set<code> }
//   input.wheel   = { dx, dy }  wheel/trackpad delta accumulated since the previous tick (kit 1.8.1; reset every tick)
//   input.onWheel = subscribe function, same as createInput().onWheel (kit 1.8.1)
// "pressed"/"released" are true for exactly one tick. Tests drive the same API via inject().
export function createInput() {
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  const keys = { down: new Set(), pressed: new Set() };
  const queue = [];
  const wheelHandlers = new Set();
  let wheelAcc = { dx: 0, dy: 0 };
  let wheelPolled = false; // set once a game reads snapshot.wheel, so the browser wheel is claimed (preventDefault)
  const subscribeWheel = (handler) => {
    wheelHandlers.add(handler);
    return () => wheelHandlers.delete(handler);
  };
  const deliverWheel = (d, domEvent) => {
    wheelAcc.dx += d.dx;
    wheelAcc.dy += d.dy;
    wheelHandlers.forEach((fn) => fn(d, domEvent));
  };

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
    } else if (ev.type === 'wheel') {
      deliverWheel({ dx: ev.dx || 0, dy: ev.dy || 0 }, null);
    } else if (ev.type === 'key') {
      if (ev.down) {
        if (!keys.down.has(ev.code)) keys.pressed.add(ev.code);
        keys.down.add(ev.code);
      } else keys.down.delete(ev.code);
    }
  };

  return {
    inject: (ev) => queue.push(ev),
    // Optional (kit 1.8.0): mouse-wheel / trackpad scroll, delivered immediately as { dx, dy } in virtual units
    // (browser wheel pixels divided by css px per virtual unit; line/page deltas are converted to pixels first).
    // Returns an unsubscribe function. Does not touch the per-tick snapshot, so existing behaviour is unchanged.
    onWheel: subscribeWheel,
    // Call once at the start of every tick; returns the snapshot to hand to game.update.
    snapshot() {
      pointer.pressed = false;
      pointer.released = false;
      keys.pressed.clear();
      for (const ev of queue.splice(0)) apply(ev);
      // wheel = delta since the previous snapshot (DOM wheel events arrive between ticks; injected ones are applied above).
      const wheel = wheelAcc;
      wheelAcc = { dx: 0, dy: 0 };
      return { pointer, keys, onWheel: subscribeWheel, get wheel() { wheelPolled = true; return wheel; } };
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
      canvas.addEventListener('wheel', (e) => {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (canvas.clientHeight || 800) : 1;
        const k = view.cssPerUnit || 1;
        const d = { dx: (e.deltaX * unit) / k, dy: (e.deltaY * unit) / k };
        const claimed = wheelHandlers.size > 0 || wheelPolled;
        deliverWheel(d, e);
        if (claimed) e.preventDefault();
      }, { passive: false });
      globalThis.addEventListener('keydown', (e) => queue.push({ type: 'key', code: e.code, down: true }));
      globalThis.addEventListener('keyup', (e) => queue.push({ type: 'key', code: e.code, down: false }));
    },
  };
}
