// Live screen geometry. The whole game is authored in a 720 x 1560 "design column" (W x H in stage.js).
// A FRAME maps that column to the real screen (kit fluid viewport: the short screen side is always 720 units):
//     screen = (ox + x * s,  oy + y * s)
// and tells the scene how much of the design space is visible: FR.x0..x1 (more than 0..720 when the screen is wider than the
// column, less when it is narrower) and FR.y0..y1. Backgrounds fill the visible rectangle, so nothing is letterboxed.
//
//   portrait  the column is fitted to the screen HEIGHT (s = sh / 1560): tall phones show it 1:1, shorter screens (SE, iPad,
//             7in) scale it down and the sky, hall and ground simply continue sideways.
//   landscape worlds are drawn at s = PLAY_S and cropped from the top (bottom anchored): the ground, HUD and action sit in the
//             lower part of the column and the screen is filled sideways by the extended scenery. Menus are re-laid out.
//
// This module is pure (no imports) so every other module may read FR each frame. It is re-pointed by useFrame().
export const DESIGN_W = 720;
export const DESIGN_H = 1560;
export const PLAY_S = 0.85;                 // landscape world scale (physical size about 80 % of portrait)
export const MAX_S = 1.06;                  // tallest phones: crop at most ~18 units per side

// Safe areas and the host's floating back button, in screen units. main.js keeps this current (browsers: all zero).
export const DOC = { w: DESIGN_W };          // reading pages (Rules, Controls): live column width
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// The frame the scene is being drawn in right now.
export const FR = { s: 1, ox: 0, oy: 0, sw: DESIGN_W, sh: DESIGN_H, land: false, x0: 0, x1: DESIGN_W, y0: 0, y1: DESIGN_H, w: DESIGN_W, h: DESIGN_H };

export function makeFrame(sw, sh, s, ox, oy) {
  const f = { s, ox, oy, sw, sh, land: sw > sh };
  f.x0 = -ox / s; f.x1 = (sw - ox) / s; f.y0 = -oy / s; f.y1 = (sh - oy) / s; f.w = f.x1 - f.x0; f.h = f.y1 - f.y0;
  return f;
}
export function useFrame(f) { Object.assign(FR, f); return f; }

// Screen (identity) frame: HUD icons, steppers, the preview chip: always in true screen units.
export const screenFrame = (sw, sh) => makeFrame(sw, sh, 1, 0, 0);
// Portrait: the whole design column fitted to the screen height, centred sideways, bottom anchored.
export function fitFrame(sw, sh) {
  const s = Math.min(MAX_S, sh / DESIGN_H);
  return makeFrame(sw, sh, s, sw / 2 - (DESIGN_W / 2) * s, sh - DESIGN_H * s);
}
// A frame of scale s that puts design point (dx, dy) on screen point (px, py).
export function pinFrame(sw, sh, s, dx, dy, px, py) { return makeFrame(sw, sh, s, px - dx * s, py - dy * s); }

export const toDesign = (f, x, y) => ({ x: (x - f.ox) / f.s, y: (y - f.oy) / f.s });
export const toScreen = (f, x, y) => ({ x: f.ox + x * f.s, y: f.oy + y * f.s });
export function applyFrame(ctx, f) { ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s); }

// HUD anchoring inside a WORLD frame (landscape only; portrait is the identity): a design position near the top, bottom, left or
// right of the 720 x 1560 column is moved to the same place on the visible window, so HUD sits at the screen edges.
// Items are classified by their centre.
export const mode = { hud: false };         // true while a chapter's world is being drawn / updated: HUD helpers anchor to the window
export function hudX(x, w = 0) {
  if (!FR.land) return x;
  const c = x + w / 2;
  if (c < 240) return x + FR.x0 + Math.max(0, host.l / FR.s);
  if (c > 480) return x + (FR.x1 - DESIGN_W) - Math.max(0, host.r / FR.s);
  return x + (FR.x0 + FR.x1 - DESIGN_W) / 2;
}
export function hudY(y, h = 0) {
  if (!FR.land) return y;
  const c = y + h / 2;
  return c < 780 ? y + (FR.y0 - 60) + Math.max(0, host.t / FR.s) : y + (FR.y1 - DESIGN_H) - Math.max(0, host.b / FR.s);
}
