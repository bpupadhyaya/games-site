// Geometry for every screen, a pure function of the LIVE virtual size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle; cached by size and safe-area key. Shapes: `tall` portrait phone, `compact` portrait tablet,
// `wide` landscape. Nothing else reads a module-level width/height for placement.
import { clamp } from './core.js';

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54, ls: 1, zoom: 1 };
const cache = new Map();
export let LY = null;
const R = (x, y, w, h) => ({ x, y, w, h });

export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(3)}|${host.zoom.toFixed(2)}`;
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
  const hud = L.hud = { x: hx, y: hy, w: land ? clamp(cx - 86 - hx, 300, 560) : U.x1 - 12 - hx, h: Math.round((land ? (h < 460 ? 82 : 116) : 132) * hz) };
  if (land) L.pause = R(U.x1 - 12 - tap, U.y0 + 12, tap, tap);
  else L.pause = R(hud.x + hud.w - 12 - tap, hy + 10, tap, tap);
  L.think = R(L.pause.x - 8 - tap, L.pause.y, tap, tap);
  hud.textMaxW = (land ? hud.w - 28 : L.think.x - 10 - (hud.x + 18));
  // spotlight arc strip + outs pips under the scoreboard (portrait) / right of it (landscape)
  const sh = Math.round((land ? (h < 460 ? 30 : 40) : 48) * Math.min(hz, 1.35));
  L.strip = R(hud.x, hud.y + hud.h + (land ? 6 : 8), hud.w, sh);
  L.pitchTag = { x: cx, y: land ? Math.max(U.y0 + 66, L.strip.y + L.strip.h + 30) : hud.y + hud.h + 40 + L.strip.h };
  L.callY = land ? U.h * 0.34 : U.h * 0.30;
  L.hintY = U.y1 - (land ? 54 : 96);
  L.aimR = land ? 120 : 130;                       // virtual units of drag that equal full spray
  L.chip = { x: cx, y: U.y1 - (land ? 120 : 190) };
  L.wave = land ? R(U.x1 - 14 - 190, U.y1 - 14 - 190, 190, 190) : R(U.x1 - 14 - 190, U.y1 - 14 - 190, 190, 190);

  // pause menu, think card, auto play
  const mcy = (U.y0 + U.y1) / 2, b0 = mcy - 210;
  L.pauseMenu = { titleY: b0 - 70, resume: R(cx - 200, b0, 400, 96), sound: R(cx - 200, b0 + 120, 400, 96), quit: R(cx - 200, b0 + 240, 400, 96) };
  const gotY = U.y1 - (land ? 100 : 240);
  L.thinkCard = { x: land ? Math.round((w - Math.min(720, w - 48)) / 2) : (w - 672) / 2, w: land ? Math.min(720, w - 48) : 672, btn: R(cx - 160, gotY, 320, 70), bottom: gotY - 10 };
  {
    const g = 10, aw = { exit: 92, speed: 164, pause: 212 };
    const rowW = aw.exit + aw.speed + aw.pause + tap * 2 + g * 4;
    const x0 = land ? U.x1 - 14 - rowW : cx - rowW / 2, y = land ? U.y1 - tap - 14 : U.y1 - 150;
    let x = x0; const a = L.auto = {};
    a.exit = R(x, y, aw.exit, tap); x += aw.exit + g; a.speed = R(x, y, aw.speed, tap); x += aw.speed + g; a.pause = R(x, y, aw.pause, tap); x += aw.pause + g;
    a.dec = R(x, y, tap, tap); x += tap + g; a.inc = R(x, y, tap, tap);
    a.thinkLbl = { x: (a.dec.x + a.inc.x + tap) / 2, y: y + tap + 22 }; a.row = R(x0, y, rowW, tap);
    const beside = land && U.w >= 1100;
    const cw = beside ? Math.min(560, x0 - 12 - (U.x0 + 12)) : Math.min(684, U.w - 36);
    a.card = { x: beside ? U.x0 + 12 : land ? U.x0 + 12 : cx - cw / 2, w: cw, bottom: beside ? U.y1 - 14 : y - 20 };
    a.pausedY = land ? h * 0.45 : y - 30;
  }
  // result banner / next button
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
    play: [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['strip', L.strip]],
    'pause-menu': [['resume', L.pauseMenu.resume], ['sound', L.pauseMenu.sound], ['quit', L.pauseMenu.quit]],
    'think-card': [['btn', L.thinkCard.btn]],
    auto: [['hud', hudAll], ['pause', L.pause], ['exit', L.auto.exit], ['speed', L.auto.speed], ['apause', L.auto.pause], ['dec', L.auto.dec], ['inc', L.auto.inc]],
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
      if (['pause', 'think', 'exit', 'speed', 'apause', 'dec', 'inc', 'btn', 'resume', 'sound', 'quit', 'zoomDec', 'zoomInc'].includes(n) && r.h < Math.min(L.tap, 56) - 0.5) out.push(`${set}/${n}: tap target too short`);
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
