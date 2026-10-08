// Geometry for every screen, a pure function of the LIVE virtual size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle; cached by size and safe-area key. Shapes: `tall` portrait phone, `compact` portrait tablet,
// `wide` landscape. Nothing else reads a module-level width/height for placement.
import { clamp } from './core.js';

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54, ls: 1, zoom: 1, padLeft: false };
const cache = new Map();
export let LY = null;
const R = (x, y, w, h) => ({ x, y, w, h });

export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(3)}|${host.zoom.toFixed(2)}|${host.padLeft ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
export function syncLayout(w, h) { const L = layoutFor(w, h); if (LY !== L) LY = L; return L; }

function build(w, h, ins) {
  const land = w >= h;
  const vpc = 1 / Math.max(0.2, ins.px);
  const minText = Math.max(16, Math.round(11 * vpc));
  const tap = clamp(Math.round(44 * vpc), 56, 84);
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) + 12 : 0;
  const cx = (U.x0 + U.x1) / 2;
  const L = { w, h, land, U, vpc, minText, tap, backSz, ins, cx, aspect: w / h, mode: land ? 'wide' : h >= 1500 ? 'tall' : 'compact' };

  // ---- play furniture ---------------------------------------------------------------------------------------------------------
  const kc = Math.max(0.3, ins.px || 0.54), badgeBottom = U.y0 + 6 / kc + 1.7 * Math.max(16, 11.5 / kc);   // the kit's preview pill (top centre)
  const hx = U.x0 + 12 + backSz, hy = land ? U.y0 + 10 : Math.max(U.y0 + 10, Math.ceil(badgeBottom + 4));
  const hz = 1 + (clamp(ins.zoom || 1, 1, 2) - 1) * 0.6;
  const hud = L.hud = { x: hx, y: hy, w: land ? clamp(cx - 86 - hx, 300, 560) : U.x1 - 12 - hx, h: Math.round((land ? (h < 460 ? 82 : 112) : 126) * hz) };
  if (land) L.pause = R(U.x1 - 12 - tap, U.y0 + 12, tap, tap);
  else L.pause = R(hud.x + hud.w - 12 - tap, hy + 10, tap, tap);
  L.think = R(L.pause.x - 8 - tap, L.pause.y, tap, tap);
  hud.textMaxW = (land ? hud.w - 28 : L.think.x - 10 - (hud.x + 18));
  // the action pad (TAP / SWING) along the bottom (portrait) or in a bottom corner (landscape); everything above it is the aim area
  const padH = land ? clamp(Math.round(U.h * 0.42), 200, 270) : clamp(Math.round(U.h * 0.185), 200, 270);
  const padW = land ? clamp(Math.round(U.w * 0.34), 300, 400) : U.w - 28;
  L.pad = land ? R(ins.padLeft ? U.x0 + 14 : U.x1 - 14 - padW, U.y1 - 14 - padH, padW, padH) : R(U.x0 + 14, U.y1 - 14 - padH, padW, padH);
  L.aimTop = hud.y + hud.h + 8;
  // the field map (a fan seen from above: fielders, your aim, earlier hits) under the scoreboard (portrait) or under the pause buttons (landscape)
  { const fw = land ? clamp(Math.round(U.w * 0.26), 300, 420) : Math.min(U.w - 28, 420), fh = Math.round(fw * (land ? 0.52 : 0.48));
    L.fan = land ? R(U.x1 - 12 - fw, L.pause.y + tap + 10, fw, fh) : R(Math.round(cx - fw / 2), hud.y + hud.h + 10, fw, fh); }
  L.callY = land ? U.h * 0.36 : L.fan.y + L.fan.h + 74;
  L.hintY = L.pad.y - 18;
  L.aimR = land ? 200 : 260;            // virtual units of drag that equal full aim
  L.dial = R(cx - 150, L.pad.y - 66, 300, 40);
  if (land) L.dial = R(L.pad.x + L.pad.w / 2 - 150, L.pad.y - 54, 300, 38);

  // pause menu, think card, auto play
  const mcy = (U.y0 + U.y1) / 2, b0 = mcy - 210;
  L.pauseMenu = { titleY: b0 - 70, resume: R(cx - 200, b0, 400, 96), sound: R(cx - 200, b0 + 120, 400, 96), quit: R(cx - 200, b0 + 240, 400, 96) };
  const gotY = U.y1 - (land ? 100 : 240);
  L.thinkCard = { x: land ? Math.round((w - Math.min(720, w - 48)) / 2) : (w - 672) / 2, w: land ? Math.min(720, w - 48) : 672, btn: R(cx - 160, gotY, 320, 70), bottom: gotY - 10 };
  {
    // Auto Play's controls live inside the pad's rectangle (the pad itself is not used there): PAUSE across the top, SPEED | EXIT, then think time - / +
    const P = L.pad, g = 8, rh = Math.floor((P.h - g * 4) / 3), a = L.auto = {};
    const y1 = P.y + g, y2 = y1 + rh + g, y3 = y2 + rh + g, half = (P.w - g * 3) / 2;
    a.pause = R(P.x + g, y1, P.w - g * 2, rh);
    a.speed = R(P.x + g, y2, half, rh); a.exit = R(P.x + g * 2 + half, y2, half, rh);
    const bw = Math.min(tap + 24, (P.w - g * 4) / 3);
    a.dec = R(P.x + g, y3, bw, rh); a.inc = R(P.x + P.w - g - bw, y3, bw, rh);
    a.thinkLbl = { x: P.x + P.w / 2, y: y3 + rh / 2 };
    a.row = P;
    const beside = land;
    const cw = beside ? clamp(P.x - 24 - U.x0 - 12, 240, 560) : Math.min(684, U.w - 36);
    a.card = { x: beside ? (ins.padLeft ? P.x + P.w + 12 : U.x0 + 12) : cx - cw / 2, w: cw, bottom: beside ? U.y1 - 14 : P.y - 14 };
    a.pausedY = land ? h * 0.45 : P.y - 30;
    L.skip = R(P.x + g, y2, P.w - g * 2, rh);       // rival innings: fast-forward sits in the pad too
  }
  L.next = R(cx - 200, U.y1 - (land ? 14 + 92 : 150), 400, 92);

  // ---- menus (scrolling column screens) ----------------------------------------------------------------------------------------------
  {
    const pw = 100, ph = Math.max(58, Math.min(tap, 70));
    const z = L.zoom = {};
    if (!land) { z.inc = R(U.x1 - 16 - pw, U.y0 + 14, pw, ph); z.dec = R(z.inc.x - 8 - 96 - 8 - pw, z.inc.y, pw, ph); z.label = { x: z.inc.x - 8 - 48, y: z.inc.y + ph / 2 }; }
    else { z.inc = R(U.x1 - 8 - pw, U.y0 + 14, pw, ph); z.label = { x: z.inc.x + pw / 2, y: z.inc.y + ph + 20 }; z.dec = R(z.inc.x, z.inc.y + ph + 40, pw, ph); }
    const cw = land ? clamp(U.w - 2 * 124, 520, 760) : U.w - 68;
    L.col = land ? { x: Math.round(U.x0 + (U.w - cw) / 2), w: cw, top: U.y0 + 14, bottom: U.y1 - 24 } : { x: U.x0 + 34, w: cw, top: U.y0 + 14 + ph + 16, bottom: U.y1 - 24 };
    if (land) {
      const colX = U.x0 + U.w * 0.5 + 4, colW = clamp(Math.min(560, (U.x1 - 124) - colX), 300, 560);
      L.title = { hero: R(U.x0 + 20, U.y0 + 16, Math.round(U.w * 0.5) - 28, U.h - 40), col: { x: colX, w: colW, top: U.y0 + 14, bottom: U.y1 - 24 } };
    } else L.title = { hero: null, col: L.col, heroH: clamp(Math.round(h * (h < 1200 ? 0.3 : 0.34)), 300, 560) };
    L.readerW = land ? clamp(U.w - 2 * 124, 520, 880) : U.w - 68;
    if (land) L.readerX = Math.round(U.x0 + (U.w - L.readerW) / 2);
  }
  return L;
}

const hits = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
export function layoutSets(L) {
  const { U, hud } = L;
  const hudAll = R(hud.x, hud.y, hud.w, hud.h);
  return {
    play: [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['pad', L.pad], ['fan', L.fan]],
    'pause-menu': [['resume', L.pauseMenu.resume], ['sound', L.pauseMenu.sound], ['quit', L.pauseMenu.quit]],
    'think-card': [['btn', L.thinkCard.btn]],
    auto: [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['exit', L.auto.exit], ['speed', L.auto.speed], ['apause', L.auto.pause], ['dec', L.auto.dec], ['inc', L.auto.inc]],
    menu: [['zoomDec', L.zoom.dec], ['zoomInc', L.zoom.inc], ['col', R(L.col.x, L.col.top, L.col.w, Math.max(60, L.col.bottom - L.col.top - 100))]],
    _U: [['u', U]],
  };
}
export function layoutProblems(L) {
  const out = [], { U } = L;
  const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
  for (const [set, items] of Object.entries(layoutSets(L))) {
    if (set === '_U') continue;
    for (const [n, r] of items) {
      if (!(r.w > 0 && r.h > 0)) out.push(`${set}/${n}: empty`);
      else if (r.x < U.x0 - 0.5 || r.y < U.y0 - 0.5 || r.x + r.w > U.x1 + 0.5 || r.y + r.h > U.y1 + 0.5) out.push(`${set}/${n}: outside the safe area ${JSON.stringify(r)}`);
      if (['pause', 'think', 'exit', 'speed', 'apause', 'dec', 'inc', 'btn', 'resume', 'sound', 'quit', 'zoomDec', 'zoomInc', 'pad'].includes(n) && r.h < Math.min(L.tap, 56) - 0.5) out.push(`${set}/${n}: tap target too short`);
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const [na, a] = items[i], [nb, b] = items[j];
      if (!hits(a, b)) continue;
      if (na === 'hud' && (nb === 'pause' || nb === 'think') && contains(a, b)) continue;
      out.push(`${set}: ${na} overlaps ${nb}`);
    }
  }
  return out;
}
syncLayout(720, 1280);
