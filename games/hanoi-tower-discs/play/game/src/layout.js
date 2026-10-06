// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side grows).
// `layoutFor()` reads `meta.width/height` (the kit keeps them current), is cached by size + safe-area key, and returns every rect.
//   tall    portrait phone (h >= 1360): the approved phone look (720 x 1560 positions are unchanged).
//   compact portrait, shorter (tablets, small phones): tighter header, shorter toolbar, same pieces.
//   wide    landscape: the scene on the left, a control panel on the right (Back / Pause, stats, Undo / Think / Restart).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas + the host's floating back button in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();
export function layoutFor(w = meta.width, h = meta.height) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const land = w > h, mode = land ? 'wide' : h >= 1360 ? 'tall' : 'compact';
  const L = { w, h, land, mode, ins };
  const dy = Math.max(0, ins.t - 14), bl = Math.max(0, ins.b - 24);
  const ux0 = ins.l, ux1 = w - ins.r;
  L.U = R(ux0, ins.t, ux1 - ux0, h - ins.t - ins.b);
  const hb = ins.back ? Math.max(ins.back, 56) + 12 : 0;   // width the host's floating back button takes at the top-left

  // ---------------------------------------------------------------------------------------------- play + Watch & Learn
  const P = L.play = { chips: [], hud: {} };
  if (!land) {
    const tall = mode === 'tall';
    P.pause = R(ux1 - 100, 22 + dy, 84, 78);
    P.back = ins.back ? R(P.pause.x - 94, 22 + dy, 84, 78) : R(Math.max(16, ux0 + 16), 22 + dy, 84, 78);
    const bd = tall ? 36 : 44;   // room under the top inset for the kit's "Preview m:ss" pill, which sits top-centre
    const cy = (tall ? 124 : 108) + dy + bd, ch = tall ? 64 : 56;
    P.hud = { title: { x: w / 2, y: (tall ? 62 : 50) + dy + bd, size: tall ? 40 : 34 }, sub: { x: w / 2, y: (tall ? 98 : 80) + dy + bd, size: tall ? 24 : 22 } };
    const cw = Math.min(200, (w - 96 - 24) / 3);
    P.chips = [0, 1, 2].map((i) => R(w / 2 - (3 * cw + 24) / 2 + i * (cw + 12), cy, cw, ch));
    const barH = tall ? 112 : 96, barY = h - (tall ? 164 : 124) - bl;
    P.tools = TOOLBAR_IDS.map((_, i) => R(24 + i * 232, barY, 216, barH));
    P.auto = {
      slower: R(24, barY, 160, barH), pause: R(200, barY, 320, barH), faster: R(536, barY, 160, barH),
      label: { x: w / 2, y: barY - 16, size: 22 },
    };
    P.banner = { x: w / 2, y: cy + ch + (tall ? 74 : 38), maxW: 680 };
    const top = P.banner.y + (tall ? 54 : 40);
    P.progress = R(120, P.banner.y + 42, 480, 8);
    P.scene = R(0, top, w, barY - 20 - top);
    P.sceneAuto = R(0, top, w, barY - 44 - top);
  } else {
    const pw = clamp(Math.round(w * 0.27), 264, 330), px = ux1 - pw - 12, top0 = ins.t + 12, bot = h - ins.b - 12;
    const half = (pw - 10) / 2;
    P.back = R(px, top0, half, 64); P.pause = R(px + half + 10, top0, half, 64);
    let y = top0 + 64 + 10;
    P.hud = { title: { x: px + pw / 2, y: y + 30, size: 32 }, sub: { x: px + pw / 2, y: y + 54, size: 21 } };
    y += 64;
    P.chips = [0, 1, 2].map((i) => R(px, y + i * 60, pw, 54));
    y += 3 * 60 + 6;
    const tH = clamp((bot - y - 16) / 3, 64, 112);
    P.tools = TOOLBAR_IDS.map((_, i) => R(px, y + i * (tH + 8), pw, tH));
    P.auto = {
      label: { x: px + pw / 2, y: y + 22, size: 22 }, pause: R(px, y + 34, pw, 104),
      slower: R(px, y + 34 + 104 + 10, half, 92), faster: R(px + half + 10, y + 34 + 104 + 10, half, 92),
    };
    P.panel = R(px - 6, top0 - 6, pw + 12, bot - top0 + 12);
    const sx0 = ux0 + 12, sx1 = px - 12;
    P.banner = { x: (sx0 + sx1) / 2, y: ins.t + 84, maxW: Math.min(680, sx1 - sx0 - 20) };
    P.progress = R((sx0 + sx1) / 2 - 240, ins.t + 124, 480, 8);
    P.scene = R(sx0, ins.t + 108, sx1 - sx0, bot - ins.t - 108);
    P.sceneAuto = R(sx0, ins.t + 136, sx1 - sx0, bot - ins.t - 136);
  }

  // ---------------------------------------------------------------------------------------------- document screens
  const D = L.doc = {};
  if (!land) {
    D.panel = R(24, 112 + dy, w - 48, h - 112 - dy - 40 - bl);
    D.row = { x0: 16, x1: w - 16, y: 20 + dy };
  } else {
    const pw = Math.min(ux1 - ux0 - 48, 1000);
    D.panel = R((ux0 + ux1) / 2 - pw / 2, ins.t + 96, pw, h - ins.t - 96 - ins.b - 14);
    D.row = { x0: D.panel.x - 8, x1: D.panel.x + D.panel.w + 8, y: ins.t + 10 };
  }
  const bx = Math.max(D.row.x0, ins.back ? ux0 + hb : 0);
  D.back = R(bx, D.row.y, 140, 76);
  D.zoomInc = R(D.row.x1 - 84, D.row.y, 84, 76);
  D.pct = R(D.row.x1 - 84 - 140, D.row.y, 140, 76);
  D.zoomDec = R(D.row.x1 - 84 - 140 - 84, D.row.y, 84, 76);
  D.body = R(D.panel.x + 24, D.panel.y + 24, D.panel.w - 48, D.panel.h - 48);

  // ---------------------------------------------------------------------------------------------- title screen
  const T = L.title = {};
  if (!land) {
    const ks = clamp(0.5 + ((h - 960) / 600) * 0.5, 0.5, 1);
    T.k = ks; T.ox = w / 2 - 360 * ks; T.oy = dy;
    const top = 840 * ks + dy, lock = 0;
    T.region = R(24, top, w - 48, h - top - 14 - bl - lock);
    T.lock = { x: w / 2, y: h - bl - 12 - lock / 2, h: 34 };
  } else {
    const mw = clamp(Math.round(w * 0.4), 420, 620), rx = ux1 - mw - 16;
    const aw = rx - 16 - (ux0 + 16), ah = h - ins.t - ins.b - 16;
    T.k = clamp(Math.min(aw / 720, ah / 840), 0.4, 1.15);
    T.ox = ux0 + 16 + (aw - 720 * T.k) / 2; T.oy = ins.t + 8 + (ah - 840 * T.k) / 2;
    const lock = 0;
    T.region = R(rx, ins.t + 8, mw, h - ins.t - ins.b - 16 - lock);
    T.lock = { x: rx + mw / 2, y: h - ins.b - 8 - lock / 2, h: 34 };
  }

  // ---------------------------------------------------------------------------------------------- overlays
  const ow = land ? Math.min(760, ux1 - ux0 - 60) : 620;
  L.overlay = R(w / 2 - ow / 2, 0, ow, 0); L.overlay.cy = h / 2; L.overlay.maxH = Math.min(h - 40 - ins.t - ins.b, 1180);
  L.short = h < 900 || land;     // image blocks shrink in the overlay cards on short screens
  return L;
}
