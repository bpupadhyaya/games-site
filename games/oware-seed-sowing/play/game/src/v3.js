// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The rules never read this.
// `on` is true only while a WebGL scene is alive; with it off every screen draws exactly as before (the flat 2D art is the fallback for
// no WebGL, a lost context, ?flat=1 and the headless tests). Positions are in the flat game's canonical board units (layout.js: pits at
// pitPos(i), trays at trayPos(p)); the presenter does the projection and hands back `toScreen` / `pitNear` so taps and labels follow the picture.
export const v3 = {
  on: false,
  frame: null,      // set by the screen being drawn: { mode: 'play' | 'title', rect: {x,y,w,h} in virtual units } (null: a text page, flat backdrop)
  wood: 'iroko',    // board wood
  seedSet: 'nuts',  // 'nuts' | 'cowries' | 'glass'
  pits: new Array(12).fill(0), store: [0, 0],   // the counts on show (state.shown)
  hidePit: -1,      // a pit whose seeds are flying to the tray this frame (drawn in `free`)
  free: [],         // loose seeds { x, y, h, v, rot, s }: canonical ground position, lift in canonical units
  marks: [],        // { pit, kind: 'legal'|'hint'|'cap'|'ref'|'kb', a }
  t: 0,
  toScreen: null,   // (cx, cy, h = 0) canonical board point, h canonical units above the board -> virtual screen units
  pitNear: null,    // (x, y) virtual screen units -> nearest pit index or -1 (through the 3D view)
};
