// Turns the one finger (or the keyboard) into the jump's inputs: hold = crouch, lift or tap = jump / land, drag = the flight stick.
//   phase 'ground' (ready, in-run): down = finger or Space / Down arrow.  phase 'air': Space edges and the finger edges count, arrows steer.
export const STICK_R = 120;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createControls() {
  let prevSpace = false, prevDown = false, ptrDown = false, origin = null;
  const c = { down: false, pressed: false, released: false, sx: 0, sy: 0, origin: null, drag: false, R: STICK_R, keyboard: false };
  c.reset = () => { origin = null; c.origin = null; c.drag = false; c.sx = 0; c.sy = 0; c.down = false; prevSpace = false; prevDown = false; };
  c.update = (input, phase) => {
    const p = input.pointer, k = input.keys;
    const space = k.down.has('Space'), arrowDown = k.down.has('ArrowDown');
    const keyHold = phase === 'ground' ? space || arrowDown : space;
    const kPressed = keyHold && !prevDown, kReleased = !keyHold && prevDown;
    prevDown = keyHold; prevSpace = space;
    const edgeP = !!p.pressed || kPressed, edgeR = !!p.released || kReleased;
    if (k.pressed.size || (k.down.has('ArrowUp') || k.down.has('ArrowDown') || k.down.has('ArrowLeft') || k.down.has('ArrowRight'))) c.keyboard = c.keyboard || k.down.has('Space') || k.down.has('ArrowUp');
    c.down = !!p.down || keyHold;
    c.pressed = edgeP; c.released = edgeR;
    // flight stick: relative to where the finger first touched
    if (p.pressed) origin = { x: p.x, y: p.y };
    if (!p.down) origin = null;
    let sx = 0, sy = 0;
    if (origin && p.down) { sx = clamp((p.x - origin.x) / STICK_R, -1, 1); sy = clamp(-(p.y - origin.y) / STICK_R, -1, 1); }
    if (phase === 'air') {
      if (k.down.has('ArrowUp')) sy = 1; else if (k.down.has('ArrowDown')) sy = -1;
      if (k.down.has('ArrowLeft')) sx = -1; else if (k.down.has('ArrowRight')) sx = 1;
    }
    c.sx = sx; c.sy = sy; c.origin = origin; c.drag = !!(origin && p.down);
    return { down: c.down, pressed: c.pressed, released: c.released, sx: c.sx, sy: c.sy };
  };
  return c;
}
