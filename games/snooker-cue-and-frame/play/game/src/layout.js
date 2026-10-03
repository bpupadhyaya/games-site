// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait. Nothing important is painted in the outer 14 px (tall phones letterbox).
// The play screen has three parts that all follow the player's text size (100-300%): a scoreboard at the top, the table
// in the middle and a control bar at the bottom. The table region shrinks to make room, so text is never clipped.
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
    const h = Math.round(100 * s);
    return { stacked: false, x: 0, y: 34, w: W, h, bottom: 34 + h, fs: Math.round(24 * s) };
  }
  const fs = Math.round(24 * s), row = Math.round(fs * 1.38);
  // From 250% the scoreboard keeps two rows (names and scores, what is on) so the table keeps its size.
  const rows = s >= 2.25 ? 2 : 3;
  const h = 12 + row * rows + 8;
  return { stacked: true, rows, x: 0, y: 34, w: W, h, bottom: 34 + h, fs, row };
}

// The control bar has one fixed height per text size so the table never shifts between phases.
// kind: 'aim' | 'roll' | 'verdict' | 'watch' | 'place'
export function playLayout(sc, kind = 'aim') {
  const sc0 = sc;
  const s = Math.min(sc, 3);
  const hud = hudBox(sc);
  const fs = Math.round(26 * s), g = 8;
  const small = s < 1.5;
  const ph = small ? 84 : Math.max(84, Math.round(fs * 1.45));
  const bh = Math.max(64, Math.round(fs * 1.5));
  const big = s >= 2.25;          // 250% and 300%: power strip plus ONE row of three buttons (the magnifier gives way to table room)
  // Other phases (rolling, verdict, Watch & Learn) need more room for text and buttons: at big sizes their bar slides up over the table
  // (the table itself never moves or resizes).
  const tall = big && kind !== 'aim';
  let row2, top;
  if (tall) {
    row2 = Math.max(206, 3 * bh + 2 * g);
    top = H - (8 + ph + g + row2 + 14);
  } else if (big) {
    row2 = bh;
    top = H - (8 + ph + g + row2 + 14);
  } else if (small) {
    row2 = 190;
    top = H - (10 + ph + g + row2 + 12);
  } else {
    row2 = Math.max(206, 3 * bh + 2 * g);
    top = H - (8 + ph + g + row2 + 14);
  }
  const y1 = top + (small ? 10 : 8), y2 = y1 + ph + g;
  const c = { top, fs, bh, ph, row2, small, big, power: rc(14, y1, W - 28, ph), y2 };
  if (big && !tall) {
    const bw3 = (W - 28 - 2 * g) / 3;
    c.inset = null; c.guide = null;
    c.shot = rc(14, y2, bw3, row2); c.think = rc(14 + bw3 + g, y2, bw3, row2); c.menu = rc(14 + 2 * (bw3 + g), y2, bw3, row2);
  } else if (small && !tall) {
    const S = 172;
    c.spin = rc(14, y2 + (row2 - S) / 2, S, S);
    c.inset = rc(14 + S + g, y2, 190, row2);
    const bx = c.inset.x + c.inset.w + g, bw = W - 14 - bx, b3 = (row2 - 2 * g) / 3;
    c.think = rc(bx, y2, bw, b3); c.guide = rc(bx, y2 + b3 + g, bw, b3); c.menu = rc(bx, y2 + 2 * (b3 + g), bw, b3);
  } else if (!big) {
    const iw = 206;
    c.inset = rc(14, y2, iw, row2);
    const bx = 14 + iw + g, bw = W - 14 - bx, b3 = (row2 - 2 * g) / 3;
    c.shot = rc(bx, y2, bw, b3); c.think = rc(bx, y2 + b3 + g, bw, b3); c.menu = rc(bx, y2 + 2 * (b3 + g), bw, b3);
    c.guide = null;
  }
  // other kinds reuse the same box
  const lab = Math.round(fs * 1.1);
  const full = { x: 14, y: top + 8, w: W - 28, h: H - top - 8 - 12 };
  c.full = full;
  if (kind === 'roll') {
    const ph2 = Math.max(64, Math.round(fs * 1.5)), half = (W - 28 - g) / 2;
    c.labelY = top + 10; c.labelH = Math.max(lab, 34);
    c.pause = rc(14, H - 12 - ph2 * 2 - g, half, ph2); c.fast = rc(14 + half + g, H - 12 - ph2 * 2 - g, half, ph2);
    c.stop = rc(14, H - 12 - ph2, W - 28, ph2);
  } else if (kind === 'verdict' || kind === 'place') {
    const ah = Math.max(72, Math.round(fs * 1.6)), half = (W - 28 - g) / 2;
    c.go = rc(14, H - 12 - ah, W - 28, ah);
    c.go2 = rc(14, H - 12 - ah * 2 - g, W - 28, ah);
    c.half1 = rc(14, H - 12 - ah, half, ah); c.half2 = rc(14 + half + g, H - 12 - ah, half, ah);
    c.textTop = top + 8;
  } else if (kind === 'watch') {
    const ah = Math.max(70, Math.round(fs * 1.5)), half = (W - 28 - g) / 2;
    if (small) {
      c.pause = rc(14, H - 12 - ah * 2 - g, W - 28, ah);
      c.dec = rc(14, H - 12 - ah, 150, ah); c.exit = rc(14 + 150 + g, H - 12 - ah, W - 28 - 300 - 2 * g, ah); c.inc = rc(W - 14 - 150, H - 12 - ah, 150, ah);
    } else {
      c.pause = rc(14, H - 12 - ah * 3 - 2 * g, W - 28, ah);
      c.dec = rc(14, H - 12 - ah * 2 - g, half, ah); c.inc = rc(14 + half + g, H - 12 - ah * 2 - g, half, ah);
      c.exit = rc(14, H - 12 - ah, W - 28, ah);
    }
    c.labelY = top + 10; c.labelH = Math.max(lab, 34);
  }
  if (!tall) c.tall = false; else c.tall = true;
  // the table region always comes from the 'aim' bar, so the table is identical in every phase
  return { hud, ctrl: c, regionTop: hud.bottom + 4, regionBottom: (tall ? playLayout(sc0, 'aim').ctrl.top : top) - 4, fs, bh };
}

// The popup panel used by the pause menu and the spin and reason modals.
export const PANEL_X = 30, PANEL_W = 660;
