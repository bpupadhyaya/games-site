// Second-finger guard. The kit's input has ONE pointer, so a second finger touching and lifting during a pull would
// move it and release the flick at the wrong spot. main.js feeds every pointer event on the canvas through this guard
// BEFORE the kit sees it: only the finger that started the gesture (the primary pointer, tracked by its pointerId) is
// passed on; events from any other finger are dropped. game.js keeps a second line of defence (STRAY_JUMP).
export function createPointerGuard() {
  let active = null;
  // type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'; returns true when the kit may see the event.
  return function allow(type, pointerId, isPrimary) {
    if (type === 'pointerdown') {
      if (isPrimary) { active = pointerId; return true; }
      return active === pointerId;
    }
    if (type === 'pointermove') return active === null || active === pointerId;
    if (active === null) return true;
    if (active === pointerId) { active = null; return true; }
    return false;
  };
}
