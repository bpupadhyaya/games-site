// Turns the thumb (or the keyboard) into the jump's inputs.
//   run-up and plant: a tap anywhere (a press edge, or Space)
//   pole: HOLD the screen (or Space / Up arrow) to climb; the five LET GO buttons (or keys 1-5, or Enter with the chosen lean) let go
// The let-go buttons are HUD rects handled by game.js; this file only decides about the playfield thumb and the keyboard.
export function createControls() {
  const c = { held: false, tap: false, lean: 2, letgo: undefined, keyboard: false };
  c.reset = () => { c.held = false; c.tap = false; c.letgo = undefined; };
  // startedOnField: whether the press that began this touch was on the playfield (not on a button)
  c.update = (input, startedOnField) => {
    const p = input.pointer, k = input.keys;
    if (p.pressed) c.held = !!startedOnField;
    if (!p.down) c.held = false;
    const space = k.down.has('Space') || k.down.has('ArrowUp');
    c.tap = (!!p.pressed && !!startedOnField) || k.pressed.has('Space');
    if (k.pressed.size) c.keyboard = true;
    let letgo;
    for (let i = 0; i < 5; i++) if (k.pressed.has(`Digit${i + 1}`) || k.pressed.has(`Numpad${i + 1}`)) { c.lean = i; letgo = i; }
    if (k.pressed.has('ArrowLeft')) c.lean = Math.max(0, c.lean - 1);
    if (k.pressed.has('ArrowRight')) c.lean = Math.min(4, c.lean + 1);
    if (k.pressed.has('Enter') || k.pressed.has('ArrowDown') || k.pressed.has('KeyJ')) letgo = c.lean;
    c.letgo = letgo;
    return { down: c.held || space, pressed: c.tap, letgo, lean: c.lean };
  };
  return c;
}
