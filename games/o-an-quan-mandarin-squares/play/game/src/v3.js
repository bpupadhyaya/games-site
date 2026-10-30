// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art
// is the fallback for no WebGL and for a lost context).
export const v3 = {
  on: false,
  geo: null,        // (x, y, w) -> board geometry like art.boardGeo, but projected from the tilted 3D board (set by the presenter)
  req: null,        // what the 2D layer wants the camera fitted to this frame: { mode: 'play'|'title'|'env', rect, trays }
  stones: [],       // stones the 2D layer wants drawn this frame (board units): { kind, x, y, lift, scale, seed, cell?, k? }
  marks: [],        // glowing outlines and fills of squares: { cell, col, a, fill, grow }
  hand: null,       // { x, y, n, lift }
  scrim: 0,
  theme: 'lacquer',
};
// The two capture trays that lie above and below the board in the 3D scene (board units; the board is 696 x 374).
export const TRAY = { h: 104, gap: 16, bw: 696, bh: 374 };
export const trayCy = (who) => (who === 2 ? -(TRAY.gap + TRAY.h / 2) : TRAY.bh + TRAY.gap + TRAY.h / 2);
const fr = (v) => v - Math.floor(v);
// Where the k-th captured stone of a player lies in its tray: [x, y, layer]. Mandarins sit at the left end.
export function traySlot(who, k, quan) {
  const cy = trayCy(who);
  if (quan) return [66 + k * 80, cy, 0];
  const per = 39, layer = Math.floor(k / per), r = k % per, row = r % 3, col = Math.floor(r / 3);
  return [160 + col * 39.5 + (row % 2) * 13 + (fr(k * 0.618) - 0.5) * 6, cy + (row - 1) * 33 + (fr(k * 0.7548) - 0.5) * 5, layer];
}
