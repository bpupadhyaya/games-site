// Shared hand-off between the 2D UI (view.js, ui.js, stones.js, figures.js) and the optional 3D presenter (view3d/presenter.js).
// The simulation never reads this. `on` is flipped by the presenter only while a WebGL context is alive; with it off every
// screen draws exactly as it did before (the flat 2D fallback). While on, the 2D layer records what the scene must show
// (board, stones, gauges, plaques, buttons) in virtual units and only draws text, icons and hit areas on top.
export const v3 = {
  on: false,
  ready: false,        // stone sprites built
  board: null,         // { b (layout board), hero, n, pan, M } the board to light this frame (null = none)
  cells: [],           // per cell { k lit strength 0..1, sel, hover, hint, mistake, wrong, win }
  stones: [],          // { v, kind, where: 'cell'|'tray'|'drag'|'ghost', cell, x, y, r, glow, tint, alpha, held, lift, pop, shake }
  gauges: [],          // { id, x, y, r, sum, M, filled, state: 'part'|'ok'|'over', pulse, hot }
  panels: [],          // { r, radius, tint, clip, z }
  buttons: [],         // { r, radius, kind, active, disabled, flash, clip, z }
  clip: null,          // scroll body rect while a scrolling screen draws (plaques are clipped to it)
  dy: 0,               // scroll offset applied to recorded rects
  z: 0,                // plaque layer: 0 = base page, 1 = cards over the board
  scene: 'title',
  pressed: null,       // { x, y } while the pointer is down
  sprites: { stone: null, given: null, look: '' },   // pre-rendered 3D stone bodies for 2D contexts (journey, rules figures)
  proj: null,          // (vx, vy) -> { x, y, k } layout point on the board frame -> projected screen point (and local scale)
  pick: null,          // (x, y) -> cell index or -1 (ray through the 3D board)
  reset() { this.cells.length = 0; this.stones.length = 0; this.gauges.length = 0; this.panels.length = 0; this.buttons.length = 0; this.clip = null; this.dy = 0; this.z = 0; },
};
