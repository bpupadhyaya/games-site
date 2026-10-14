// Two-thumb guard. The kit's input has ONE pointer, and this game is played by alternating thumbs, so a second finger often
// lands before the first has fully lifted. main.js feeds every pointer event on the canvas through this guard BEFORE the kit
// sees it: the newest finger always wins (its press is passed on at once), and the release of an older finger that was
// replaced is dropped so it cannot cancel the newer press.
export function createPointerGuard() {
  let active = null;
  // type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel'; returns true when the kit may see the event.
  return function allow(type, pointerId) {
    if (type === 'pointerdown') { active = pointerId; return true; }
    if (type === 'pointermove') return active === null || active === pointerId;
    if (active === null) return true;
    if (active === pointerId) { active = null; return true; }
    return false;
  };
}
