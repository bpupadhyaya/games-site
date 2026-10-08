// Geometry for every screen, a pure function of the LIVE virtual size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle; cached by size and safe-area key. Shapes: `tall` portrait phone, `compact` portrait tablet,
// `wide` landscape. Nothing else reads a module-level width/height for placement.
import { clamp } from './core.js';

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54, ls: 1, zoom: 1, sheetLeft: false };
const cache = new Map();
export let LY = null;
const R = (x, y, w, h) => ({ x, y, w, h });

export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(3)}|${host.zoom.toFixed(2)}|${host.sheetLeft ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
export function syncLayout(w, h) { const L = layoutFor(w, h); if (LY !== L) LY = L; return L; }

function build(w, h, ins) {
  const land = w >= h;
  const vpc = 1 / Math.max(0.2, ins.px);
  const minText = Math.max(16, Math.round(11 * vpc));
  const tap = clamp(Math.round(46 * vpc), 56, 100);
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) + 12 : 0;
  const cx = (U.x0 + U.x1) / 2;
  const L = { w, h, land, U, vpc, minText, tap, backSz, ins, cx, aspect: w / h, mode: land ? 'wide' : h >= 1500 ? 'tall' : 'compact' };

  // ---- sailing furniture -------------------------------------------------------------------------------------------------------------
  const kc = Math.max(0.3, ins.px || 0.54), badgeBottom = U.y0 + 6 / kc + 1.7 * Math.max(16, 11.5 / kc);   // the kit's preview pill (top centre)
  const hx = U.x0 + 12 + backSz, hy = land ? U.y0 + 10 : Math.max(U.y0 + 10, Math.ceil(badgeBottom + 4));
  const hz = 1 + (clamp(ins.zoom || 1, 1, 2) - 1) * (land ? 0.2 : 0.6);
  const hud = L.hud = { x: hx, y: hy, w: land ? clamp(cx - 86 - hx, 320, 600) : U.x1 - 12 - hx, h: Math.round((land ? (h < 460 ? 84 : 112) : 128) * hz) };
  if (land) { L.pause = R(U.x1 - 12 - tap, U.y0 + 12, tap, tap); } else L.pause = R(hud.x + hud.w - 12 - tap, hy + 10, tap, tap);
  L.think = R(L.pause.x - 8 - tap, L.pause.y, tap, tap);
  L.camBtn = R(L.think.x - 8 - tap, L.pause.y, tap, tap);
  hud.textMaxW = (land ? hud.w - 28 : L.camBtn.x - 10 - (hud.x + 18));

  // controls: the compass dial (steering), the sheet slider (sail trim) and three round action buttons
  const sliderW = clamp(Math.round(tap * 1.5), 84, 120);
  const bsz = clamp(tap + 8, 64, 92);
    const sx = U.x1 - 14 - sliderW;
  const chartW = land ? clamp(Math.round(U.w * 0.25), 260, 360) : clamp(Math.round(U.w * 0.5), 300, 420), chartH = Math.round(chartW * (land ? 0.56 : 0.66));
  L.chart = R(U.x0 + 14, hud.y + hud.h + 10, chartW, chartH);
  const dialD = land ? clamp(Math.min(Math.round(U.h * 0.5), U.y1 - 18 - (L.chart.y + chartH + 14)), 200, 340) : clamp(Math.round(Math.min(U.w * 0.6, U.h * 0.3, U.y1 - 18 - (L.chart.y + chartH + 14) - bsz - 14)), 200, 400);
  L.dial = { cx: U.x0 + 20 + dialD / 2, cy: U.y1 - 18 - dialD / 2, r: dialD / 2 };
  // slider track: from below the pause buttons to above the bottom edge
  const sTop = (land ? L.pause.y + tap + 16 : hud.y + hud.h + 14), sBot = U.y1 - 18;
  L.sheet = R(sx, sTop, sliderW, Math.max(180, sBot - sTop));
  // action buttons: reef / sight / sweeps stacked next to the slider (landscape) or in a row above the dial (portrait)
  const gap = 12;
  if (land) {
    const bx = L.sheet.x - 16 - bsz;
    L.reef = R(bx, U.y1 - 18 - bsz, bsz, bsz); L.sight = R(bx, L.reef.y - gap - bsz, bsz, bsz); L.sweeps = R(bx, L.sight.y - gap - bsz, bsz, bsz);
  } else {
    const y = L.dial.cy - L.dial.r - 14 - bsz;
    const x0 = U.x0 + 20;
    L.reef = R(x0, y, bsz, bsz); L.sight = R(x0 + bsz + gap, y, bsz, bsz); L.sweeps = R(x0 + 2 * (bsz + gap), y, bsz, bsz);
  }
  // toast / banner and the decision card (squall, calm, a dhow in need)
  const cardW = land ? Math.min(560, U.w - 2 * (dialD + 120)) : Math.min(660, U.w - 28 - (sliderW + 12));
  L.card = { x: land ? Math.round(cx - cardW / 2) : U.x0 + 14, w: Math.max(300, cardW), bottom: land ? U.y1 - 18 : L.reef.y - 14 };
  L.toastY = land ? U.y0 + 20 + hud.h + 8 : hud.y + hud.h + 12 + chartH + 26;
  L.sightPanel = land ? R(Math.round(cx - 300), U.y1 - 250, 600, 232) : R(U.x0 + 14, L.reef.y - 250, U.w - 28 - sliderW - 8, 236);
  if (land) L.sightPanel.x = clamp(L.sightPanel.x, L.dial.cx + L.dial.r + 14, L.sheet.x - 14 - L.sightPanel.w - bsz);

  // pause menu, think card, auto play
  const mcy = (U.y0 + U.y1) / 2, b0 = mcy - 210;
  L.pauseMenu = { titleY: b0 - 70, resume: R(cx - 200, b0, 400, 96), sound: R(cx - 200, b0 + 120, 400, 96), quit: R(cx - 200, b0 + 240, 400, 96) };
  const gotY = U.y1 - (land ? 100 : 240);
  L.thinkCard = { x: land ? Math.round((w - Math.min(760, w - 48)) / 2) : (w - 672) / 2, w: land ? Math.min(760, w - 48) : 672, btn: R(cx - 160, gotY, 320, 70), bottom: gotY - 10 };
  {
    // Auto Play's controls take the place of the compass dial: PAUSE across the top, SPEED | EXIT, then think time - / +
    const D = L.dial, pw = Math.max(300, Math.min(land ? 360 : U.w - 28 - sliderW - 8, 460)), g = 8;
    const px0 = U.x0 + 14, py = land ? Math.max(L.chart.y + chartH + 10, U.y1 - 18 - 232) : U.y1 - 18 - 232, ph2 = U.y1 - 18 - py;
    const rh = Math.floor((ph2 - g * 4) / 3), a = L.auto = {};
    a.pause = R(px0 + g, py + g, pw - g * 2, rh);
    const half = (pw - g * 3) / 2;
    a.speed = R(px0 + g, a.pause.y + rh + g, half, rh); a.exit = R(px0 + g * 2 + half, a.speed.y, half, rh);
    const bw = Math.min(tap + 24, (pw - g * 4) / 3);
    a.dec = R(px0 + g, a.speed.y + rh + g, bw, rh); a.inc = R(px0 + pw - g - bw, a.dec.y, bw, rh);
    a.thinkLbl = { x: px0 + pw / 2, y: a.dec.y + rh / 2 };
    a.row = R(px0, py, pw, ph2);
    const beside = land;
    const cw = beside ? clamp(L.sheet.x - 24 - (px0 + pw + 12) - bsz - 16, 260, 560) : Math.max(300, Math.min(684, L.sheet.x - 12 - (U.x0 + 14)));
    a.card = { x: beside ? px0 + pw + 12 : U.x0 + 14, w: cw, bottom: beside ? U.y1 - 18 : py - 12 };
    a.pausedY = land ? h * 0.45 : py - 30;
    void D;
  }
  L.next = R(cx - 200, U.y1 - (land ? 14 + 92 : 150), 400, 92);

  // ---- menus (scrolling column screens) --------------------------------------------------------------------------------------------
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
  const { U, hud } = L, d = L.dial;
  const hudAll = R(hud.x, hud.y, hud.w, hud.h), dialBox = R(d.cx - d.r, d.cy - d.r, d.r * 2, d.r * 2);
  return {
    play: [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['cam', L.camBtn], ['chart', L.chart], ['dial', dialBox], ['sheet', L.sheet], ['reef', L.reef], ['sight', L.sight], ['sweeps', L.sweeps]],
    'pause-menu': [['resume', L.pauseMenu.resume], ['sound', L.pauseMenu.sound], ['quit', L.pauseMenu.quit]],
    'think-card': [['btn', L.thinkCard.btn]],
    auto: [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['cam', L.camBtn], ['chart', L.chart], ['sheet', L.sheet], ['exit', L.auto.exit], ['speed', L.auto.speed], ['apause', L.auto.pause], ['dec', L.auto.dec], ['inc', L.auto.inc]],
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
      if (['pause', 'think', 'cam', 'exit', 'speed', 'apause', 'dec', 'inc', 'btn', 'resume', 'sound', 'quit', 'zoomDec', 'zoomInc', 'reef', 'sight', 'sweeps'].includes(n) && r.h < Math.min(L.tap, 56) - 0.5) out.push(`${set}/${n}: tap target too short`);
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const [na, a] = items[i], [nb, b] = items[j];
      if (!hits(a, b)) continue;
      if (na === 'hud' && (nb === 'pause' || nb === 'think' || nb === 'cam') && contains(a, b)) continue;
      out.push(`${set}: ${na} overlaps ${nb}`);
    }
  }
  return out;
}
syncLayout(720, 1280);
