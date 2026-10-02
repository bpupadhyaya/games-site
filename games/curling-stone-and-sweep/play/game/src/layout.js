// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait. Nothing important is painted in the outer 24 px (tall phones letterbox).
// The play screen is built from three parts that all follow the player's text size (100-300%): a scoreboard at the top,
// the ice in the middle, and a control bar at the bottom. The ice region shrinks to make room, so text is never clipped.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = {
  start: { x: 30, y: 1156, w: 440, h: 96 },
  back: { x: 486, y: 1156, w: 204, h: 96 },
};

const rc = (x, y, w, h) => ({ x, y, w, h });

export function hudBox(sc) {
  const s = Math.min(sc, 3);
  if (s <= 1.25) {
    const h = Math.round(98 * s);
    return { stacked: false, x: 0, y: 10, w: W, h, bottom: 10 + h, fs: Math.round(24 * s) };
  }
  const fs = Math.round(24 * s), row = Math.round(fs * 1.38);
  const h = 12 + row * 3 + 8;
  return { stacked: true, x: 0, y: 10, w: W, h, bottom: 10 + h, fs, row };
}

// kind: 'aim' | 'fly' | 'score' | 'watch'
export function playLayout(sc, kind) {
  const s = Math.min(sc, 3);
  const hud = hudBox(sc);
  const fs = Math.round(26 * s), bh = Math.max(64, Math.round(fs * 1.6));
  const g = 8;
  let c;
  if (kind === 'aim') {
    if (s < 1.5) {
      const ch = Math.max(60, Math.round(fs * 1.55));
      const cw = (W - 28 - 3 * g) / 4;
      const chips = [0, 1, 2, 3].map((i) => rc(14 + i * (cw + g), 0, cw, ch));
      const th = Math.max(56, Math.round(fs * 1.5));
      const turn = [rc(14, 0, (W - 28 - g) / 2, th), rc(14 + (W - 28 - g) / 2 + g, 0, (W - 28 - g) / 2, th)];
      const ah = Math.max(76, Math.round(fs * 1.7));
      const think = rc(14, 0, 190, ah), thr = rc(14 + 190 + g, 0, 300, ah), menu = rc(14 + 190 + g + 300 + g, 0, W - 28 - 190 - 300 - 2 * g, ah);
      const total = 10 + ch + g + th + g + ah + 14;
      const top = H - total;
      chips.forEach((r) => { r.y = top + 10; });
      turn.forEach((r) => { r.y = top + 10 + ch + g; });
      [think, thr, menu].forEach((r) => { r.y = top + 10 + ch + g + th + g; });
      c = { top, inline: true, chips, turn, think, throw: thr, menu };
    } else {
      const capH = Math.round(fs * 1.05);
      const half = (W - 28 - g) / 2;
      const total = 8 + capH + g + bh + g + bh + 14;
      const top = H - total;
      const y1 = top + 8 + capH + g, y2 = y1 + bh + g;
      c = { top, inline: false, capH, capY: top + 8, shot: rc(14, y1, half, bh), think: rc(14 + half + g, y1, half, bh), throw: rc(14, y2, half, bh), menu: rc(14 + half + g, y2, half, bh) };
    }
  } else if (kind === 'fly') {
    const lab = Math.round(fs * 1.15), mh = Math.max(40, Math.round(fs * 0.9)), ph = Math.max(64, Math.round(fs * 1.5));
    const half = (W - 28 - g) / 2;
    const total = 8 + lab + mh + g + ph + 14;
    const top = H - total;
    c = { top, labelY: top + 8, labelH: lab, meter: rc(20, top + 8 + lab, W - 40, mh), pause: rc(14, top + 8 + lab + mh + g, half, ph), fast: rc(14 + half + g, top + 8 + lab + mh + g, half, ph) };
  } else if (kind === 'score') {
    const th = Math.round(fs * 1.4), sh = Math.round(fs * 1.1), ah = Math.max(76, Math.round(fs * 1.7));
    const total = 10 + th + sh + g + ah + 14;
    const top = H - total;
    c = { top, titleY: top + 10, titleH: th, subY: top + 10 + th, subH: sh, go: rc(14, top + 10 + th + sh + g, W - 28, ah) };
  } else {   // watch
    const lab = Math.round(fs * 1.1);
    if (s < 1.5) {
      const ah = Math.max(76, Math.round(fs * 1.6));
      const total = 8 + lab + ah + g + Math.round(ah * 0.8) + 14;
      const top = H - total;
      const y1 = top + 8 + lab;
      c = { top, labelY: top + 8, labelH: lab, dec: rc(14, y1, 150, ah), pause: rc(14 + 150 + g, y1, W - 28 - 300 - 2 * g, ah), inc: rc(W - 14 - 150, y1, 150, ah), exit: rc(14, y1 + ah + g, W - 28, Math.round(ah * 0.8)) };
    } else {
      const ah = Math.max(76, Math.round(fs * 1.6)), half = (W - 28 - g) / 2;
      const total = 8 + lab + ah + g + ah + g + ah + 14;
      const top = H - total;
      const y1 = top + 8 + lab, y2 = y1 + ah + g, y3 = y2 + ah + g;
      c = { top, labelY: top + 8, labelH: lab, pause: rc(14, y1, W - 28, ah), dec: rc(14, y2, half, ah), inc: rc(14 + half + g, y2, half, ah), exit: rc(14, y3, W - 28, ah) };
    }
  }
  return { hud, ctrl: c, regionTop: hud.bottom + 4, regionBottom: c.top - 4, fs, bh };
}

// The popup panel used by Shot options (large text) and the pause menu.
export const PANEL_X = 30, PANEL_W = 660;
