// Geometry for every screen, as a pure function of the LIVE virtual size (kit 1.7 fluid viewport: the short side is always 720 units,
// the long side follows the screen). `layoutFor(w, h)` returns every rectangle and anchor for that size; it is cached by size and
// safe-area key, so a frame never recomputes it. Three shapes:
//   tall     portrait phone (h >= 1500): the approved phone look, the extra height goes between the scoreboard and the controls.
//   compact  portrait shorter than a phone (tablets, small phones): same pieces, bottom-anchored controls, the field scaled down a little.
//   wide     landscape: scoreboard top-left, pause/think top-right, thumb controls on the right edge, the picture in the middle.
// The 3D camera (CAM) and the overhead field (OH) live in scene.js and are written here from the same layout, so the 2D fallback figures,
// the 3D layer and every overlay agree about where the horizon, the pitch and the field are.
// No module-level W/H is read anywhere else for placement: everything comes from `LY` (the current layout) or a rect inside it.
import { clamp } from './core.js';
import { CAM, OH } from './scene.js';

// Safe areas (CSS px converted to virtual units) and the host's floating back button; main.js keeps this current. Browsers: zeros.
// px = css pixels per virtual unit (text never shrinks below ~11 css px, taps stay ~44 css px); ls = scenery layer resolution.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54, ls: 1 };

const cache = new Map();
export let LY = null;

const R = (x, y, w, h) => ({ x, y, w, h });

export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(3)}|${host.ls.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    L = build(w, h, { ...host }); L.key = key; cache.set(key, L);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  return L;
}

/** Make `w x h` the current layout (call at the top of update and render; cheap when the size has not changed). Writes the camera and the field. */
export function syncLayout(w, h) {
  const L = layoutFor(w, h);
  if (LY !== L) {
    LY = L;
    Object.assign(CAM, { f: L.cam.f, hy: L.cam.hy, cx: L.cam.cx, w: L.w, h: L.h, ls: L.ls });
    Object.assign(OH, { cx: L.oh.cx, cy: L.oh.cy, k: L.oh.k, w: L.w, h: L.h, fx: L.oh.fx, fy: L.oh.fy });
  }
  return L;
}

function build(w, h, ins) {
  const land = w >= h;
  const vpc = 1 / Math.max(0.2, ins.px);                         // virtual units per css px
  const minText = Math.max(16, Math.round(11 * vpc));            // smallest text, in virtual units (about 11 css px)
  const tap = clamp(Math.round(44 * vpc), 56, 84);               // a tap target about 44 css px
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) + 12 : 0;      // the host's floating back button (top-left), only when it exists
  const cx = (U.x0 + U.x1) / 2;
  const L = { w, h, land, U, vpc, minText, tap, backSz, ins, cx, mode: land ? 'wide' : h >= 1500 ? 'tall' : 'compact', ls: clamp(ins.ls || 1, 1, 2) };

  // ---- the batter's-eye camera and the overhead field ---------------------------------------------------------------------------
  if (!land) L.cam = h >= 1280 ? { f: 1050, hy: 455 + (h - 1280) * 0.4 } : { f: 1050 * h / 1280, hy: 455 * h / 1280 };
  else L.cam = { f: 1050 * (h / 1280) * 1.15, hy: h * 0.36 };    // landscape: a wider lens so the field and the stands stay in the picture
  L.cam.cx = w / 2;
  if (!land) L.oh = { k: clamp((h - 270) / 700, 0.6, 1), cx: w / 2, cy: 690 + (h - 1280) / 2 + (ins.t - ins.b) / 2, fx: 1, fy: h / 1280 };
  else L.oh = { k: clamp((h - 90) / 700, 0.55, 1), cx: w / 2, cy: h / 2 - 16, fx: w / 720, fy: h / 1280 * 1.15 };

  // ---- scoreboard, pause, think ---------------------------------------------------------------------------------------------------
  const kc = Math.max(0.3, ins.px || 0.54), badgeBottom = U.y0 + 6 / kc + 1.7 * Math.max(16, 11.5 / kc);   // the kit's preview badge (top centre)
  const hx = U.x0 + 12 + backSz, hy = land ? U.y0 + 10 : Math.max(U.y0 + 10, Math.ceil(badgeBottom + 4));
  const hud = L.hud = { x: hx, y: hy, w: land ? Math.min(620, Math.max(470, U.w * 0.55 - backSz)) : U.x1 - 12 - hx, h: 124 };
  if (land) L.pause = R(U.x1 - 12 - tap, U.y0 + 12, tap, tap);
  else L.pause = R(hud.x + hud.w - 12 - tap, hy + 10, tap, tap);
  L.think = R(L.pause.x - 8 - tap, L.pause.y, tap, tap);
  hud.midX = hud.x + 220;
  hud.midMaxW = (land ? hud.x + hud.w - 16 : L.think.x - 10) - hud.midX;
  hud.textMaxW = (land ? hud.w - 44 : L.think.x - 10 - (hud.x + 22));

  // ---- play furniture -------------------------------------------------------------------------------------------------------------
  const rs = land ? 170 : 154;
  L.radar = R(U.x1 - 16 - rs, land ? L.pause.y + tap + 12 : hud.y + 176, rs, rs);
  L.over = { cx, y: U.y1 - (land ? 34 : 44), r: land ? 17 : 21, gap: land ? 10 : 12 };
  L.run = land ? R(U.x1 - 14 - 300, U.y1 - 14 - 112, 300, 112) : R(cx - 210, U.y1 - 184, 420, 112);
  L.runSize = land ? 34 : 40;
  L.hintY = U.y1 - (land ? 78 : 104);
  L.coach = land ? { x0: cx - 40, y0: h * 0.8, x1: cx + 110, y1: h * 0.42, textY: L.hintY - 46 } : { x0: cx - 70, y0: U.y1 - 270, x1: cx + 108, y1: U.y1 - 520, textY: L.hintY - 46 };
  L.chipY = land ? h * 0.5 : 700 + (h - 1280) * 0.45;
  L.callY = land ? { over: h * 0.38, deliv: h * 0.38 } : { over: 300, deliv: 330 };
  L.freeHitX = cx;
  const pipH = land ? clamp(Math.round(h * 0.42), 260, 340) : 300, pipW = land ? Math.round(pipH * 0.9) : 270;
  L.pip = land ? R(U.x0 + 14, U.y1 - 14 - pipH, pipW, pipH) : R(U.x1 - 14 - pipW, L.oh.cy - 298, pipW, pipH);

  // ---- pause menu, think card, replay ---------------------------------------------------------------------------------------------
  const mcy = (U.y0 + U.y1) / 2, b0 = mcy - 210;
  L.pauseMenu = { titleY: b0 - 70, resume: R(cx - 200, b0, 400, 96), sound: R(cx - 200, b0 + 120, 400, 96), quit: R(cx - 200, b0 + 240, 400, 96) };
  const gotY = U.y1 - (land ? 100 : 240);
  L.thinkCard = { x: land ? Math.round((w - Math.min(720, w - 48)) / 2) : (w - 672) / 2, w: land ? Math.min(720, w - 48) : 672, btn: R(cx - 160, gotY, 320, 70), bottom: gotY - 10 };
  L.replay = { btn: R(cx - 200, U.y1 - (land ? 14 + 100 : 150), 400, 100), titleY: U.y0 + (land ? 70 : 120), subY: U.y0 + (land ? 118 : 172) };

  // ---- Auto Play controls ---------------------------------------------------------------------------------------------------------
  {
    const g = 10, aw = { exit: 92, speed: 164, pause: 212 };
    const rowW = aw.exit + aw.speed + aw.pause + tap * 2 + g * 4;
    const x0 = land ? U.x1 - 14 - rowW : cx - rowW / 2;
    // landscape: the row sits bottom right; when it would run into the over strip (bottom centre) it moves up above it
    const stripR = cx + 3 * (L.over.r * 2 + L.over.gap) + 10;
    const lift = land && x0 < stripR ? L.over.r * 2 + 14 : 0;
    const y = land ? U.y1 - tap - 14 - lift : U.y1 - 150;
    let x = x0;
    const a = L.auto = {};
    a.exit = R(x, y, aw.exit, tap); x += aw.exit + g;
    a.speed = R(x, y, aw.speed, tap); x += aw.speed + g;
    a.pause = R(x, y, aw.pause, tap); x += aw.pause + g;
    a.dec = R(x, y, tap, tap); x += tap + g;
    a.inc = R(x, y, tap, tap);
    a.thinkLbl = { x: (a.dec.x + a.inc.x + tap) / 2, y: y + tap + 22 };
    a.row = R(x0, y, rowW, tap);
    const beside = land && U.w >= 1100 && lift === 0;
    const cw = beside ? Math.min(560, x0 - 12 - (U.x0 + 12)) : Math.min(684, U.w - 36);
    a.card = { x: beside ? U.x0 + 12 : (land ? U.x0 + 12 : cx - cw / 2), w: cw, bottom: beside ? U.y1 - 14 : y - 20 };
    a.pausedY = land ? h * 0.45 : y - 30;
  }

  // ---- menus (scrolling column screens) ---------------------------------------------------------------------------------------------
  {
    const pw = 100, ph = Math.max(58, Math.min(tap, 70));
    const z = L.zoom = {};
    if (!land) {
      z.inc = R(U.x1 - 16 - pw, U.y0 + 14, pw, ph); z.dec = R(z.inc.x - 8 - 96 - 8 - pw, z.inc.y, pw, ph); z.label = { x: z.inc.x - 8 - 48, y: z.inc.y + ph / 2 };
    } else {
      z.inc = R(U.x1 - 8 - pw, U.y0 + 14, pw, ph); z.label = { x: z.inc.x + pw / 2, y: z.inc.y + ph + 20 }; z.dec = R(z.inc.x, z.inc.y + ph + 40, pw, ph);
    }
    const cw = land ? clamp(U.w - 2 * 124, 520, 760) : U.w - 68;
    L.col = land ? { x: Math.round(U.x0 + (U.w - cw) / 2), w: cw, top: U.y0 + 14, bottom: U.y1 - 24 } : { x: U.x0 + 34, w: cw, top: U.y0 + 14 + ph + 16, bottom: U.y1 - 24 };
    // title screen: the hero art next to a column of buttons (landscape) or above it (portrait)
    if (land) {
      const colX = U.x0 + U.w * 0.5 + 4, colW = clamp(Math.min(560, (U.x1 - 124) - colX), 300, 560);
      L.title = { hero: R(U.x0 + 20, U.y0 + 16, Math.round(U.w * 0.5) - 28, U.h - 40), col: { x: colX, w: colW, top: U.y0 + 14, bottom: U.y1 - 24 } };
    } else L.title = { hero: null, col: L.col, heroH: clamp(Math.round(h * (h < 1200 ? 0.3 : 0.34)), 300, 560) };
    L.readerW = land ? clamp(U.w - 2 * 124, 520, 880) : U.w - 68;
    if (land) { L.readerX = Math.round(U.x0 + (U.w - L.readerW) / 2); }
  }

  // ---- bowling aim screen and the field picker (placed again with the live scoreboard height, see placeBowl / placeField) -----------
  placeBowl(L, hud.y + 176);
  placeField(L, hud.y + 176);
  return L;
}

/** Bowling aim UI for a scoreboard that ends at `top - 176 + ...`: `top` is the first free row under the scoreboard. */
export function placeBowl(L, top) {
  const { U, land, tap, w, h, cx } = L;
  const bowl = { top };
  const th = clamp(tap, 58, 72), gap = 8, keys = 9;
  if (!land) {
    const cw = Math.floor((U.w - 28 - gap * 3) / 4);
    const y3 = U.y1 - 24 - th, y2 = y3 - th - gap, y1 = y2 - th - gap;
    bowl.chips = Array.from({ length: keys }, (_, i) => R(U.x0 + 14 + (i % 4) * (cw + gap), [y1, y2, y3][Math.floor(i / 4)], cw, th));
    bowl.hintY = y1 - 22;
    bowl.info = { x: cx, y1: top + 38, y2: top + 62, align: 'center', w: U.w - 40 };
    const mapTop = top + 92, avail = y1 - 76 - mapTop, mh = clamp(avail, 300, 780);
    const mw = Math.round(mh * 0.656);
    bowl.pm = R(Math.round(cx - mw / 2), mapTop + Math.max(0, (avail - mh) / 2), mw, mh);
    bowl.dimTop = top - 4; bowl.hint = { x: cx, y: bowl.hintY, w: U.w - 40, align: 'center' };
  } else {
    // three columns centred: map | info | chips (two columns). The scoreboard is above the map, pause / think at the far right.
    const mh = clamp(U.y1 - 14 - (top + 6), 340, 640), mw = Math.round(mh * 0.656);
    const cw = 150, chipsW = cw * 2 + gap, infoW = clamp(U.w - 2 * 16 - 2 * 20 - mw - chipsW, 190, 360);
    const total = mw + 20 + infoW + 20 + chipsW;
    const x0 = Math.round(U.x0 + (U.w - total) / 2);
    bowl.pm = R(x0, top + 6, mw, mh);
    bowl.info = { x: x0 + mw + 20, y1: top + 38, y2: top + 70, align: 'left', w: infoW };
    bowl.hint = { x: x0 + mw + 20, y: top + 236, w: infoW, align: 'left' };
    const cx0 = x0 + mw + 20 + infoW + 20, th2 = clamp(th, 56, 64);
    bowl.chips = Array.from({ length: keys }, (_, i) => R(cx0 + (i % 2) * (cw + gap), top + 6 + Math.floor(i / 2) * (th2 + gap), cw, th2));
    bowl.hintY = bowl.hint.y; bowl.dimTop = 0;
  }
  L.bowl = bowl;
  return bowl;
}

/** The "Set your field" screen (between overs when you bowl). */
export function placeField(L, top) {
  const { U, land, cx } = L;
  const fp = { top };
  const chipH = 100, g = 8;
  if (!land) {
    const goY = U.y1 - 20 - 96;
    const chipsTop = goY - 16 - (chipH * 3 + g * 2);
    const cw = Math.floor((U.w - 36 - g) / 2);
    fp.go = R(cx - 210, goY, 420, 96);
    fp.chips = Array.from({ length: 6 }, (_, i) => R(U.x0 + 18 + (i % 2) * (cw + g), chipsTop + Math.floor(i / 2) * (chipH + g), cw, chipH));
    fp.blurbY = chipsTop - 22;
    fp.titleY = top + 70; fp.titleX = cx;
    const rt = top + 90, rs = clamp(fp.blurbY - 28 - rt, 160, 440);
    fp.radar = R(Math.round(cx - rs / 2), rt, rs, rs);
    fp.blurbX = cx;
  } else {
    const rs = clamp(Math.min(U.y1 - 20 - (top + 14), U.w * 0.42), 220, 440);
    const cw = clamp(Math.floor((U.w - 24 - rs - 28 - g) / 2), 150, 260), colW = cw * 2 + g, total = rs + 28 + colW, x0 = Math.round(U.x0 + (U.w - total) / 2);
    fp.radar = R(x0, top + 14, rs, rs);
    const gx = x0 + rs + 28, cTop = gx < L.hud.x + L.hud.w + 12 ? top + 30 : U.y0 + 100;   // narrow landscape: the chips go under the scoreboard
    fp.titleY = cTop - 28; fp.titleX = gx + colW / 2;
    fp.chips = Array.from({ length: 6 }, (_, i) => R(gx + (i % 2) * (cw + g), cTop + Math.floor(i / 2) * (chipH + g), cw, chipH));
    const chipsBottom = cTop + 3 * chipH + 2 * g;
    fp.blurbY = chipsBottom + 34; fp.blurbX = gx + colW / 2;
    fp.go = R(gx, Math.min(U.y1 - 14 - 84, fp.blurbY + 16), colW, 84);
  }
  L.field = fp;
  return fp;
}

// ---- a programmatic overlap check (used by the resize test and the screenshot matrix) ------------------------------------------------------
const hits = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
/** The rectangles that are on screen together in each play state / menu state, at the standard text size. */
export function layoutSets(L) {
  const { U, hud, over } = L;
  const hudAll = R(hud.x, hud.y, hud.w, 164);
  const overW = 6 * (over.r * 2 + over.gap), overR = R(over.cx - overW / 2, over.y - over.r, overW, over.r * 2);
  const hint = R(L.cx - Math.min(340, U.w / 2 - 12), L.hintY - 28, Math.min(680, U.w - 24), 40);
  const B = L.bowl, F = L.field, A = L.auto;
  const bowl = [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['map', R(B.pm.x - 14, B.pm.y - 14, B.pm.w + 28, B.pm.h + 28)], ...B.chips.map((r, i) => [`chip${i}`, r]),
    ['info', R(B.info.align === 'center' ? B.info.x - B.info.w / 2 : B.info.x, B.info.y1 - 24, B.info.w, 60)], ['hint', R(B.hint.align === 'center' ? B.hint.x - B.hint.w / 2 : B.hint.x, B.hint.y - 24, B.hint.w, 30)]];
  const field = [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['radar', F.radar], ...F.chips.map((r, i) => [`fchip${i}`, r]), ['go', F.go]];
  const sets = {
    'bat-delivery': [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['radar', L.radar], ['over', overR], ['hint', hint]],
    'bat-overhead': [['hud', hudAll], ['pause', L.pause], ['think', L.think], ['pip', L.pip], ['run', L.run], ['over', overR]],
    'bowl-aim': bowl, 'field-pick': field,
    'pause-menu': [['resume', L.pauseMenu.resume], ['sound', L.pauseMenu.sound], ['quit', L.pauseMenu.quit]],
    'think-card': [['btn', L.thinkCard.btn]],
    'auto': [['hud', hudAll], ['pause', L.pause], ['exit', A.exit], ['speed', A.speed], ['apause', A.pause], ['dec', A.dec], ['inc', A.inc], ['over', overR], ['card', R(A.card.x, A.card.bottom - 120, A.card.w, 120)]],
    'replay': [['btn', L.replay.btn]],
    'menu': [['zoomDec', L.zoom.dec], ['zoomInc', L.zoom.inc], ['col', R(L.col.x, L.col.top, L.col.w, Math.max(60, L.col.bottom - L.col.top - 100))]],
  };
  return sets;
}
export function layoutProblems(L) {
  const out = [], { U } = L;
  const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
  for (const [set, items] of Object.entries(layoutSets(L))) {
    for (const [n, r] of items) {
      if (!(r.w > 0 && r.h > 0)) out.push(`${set}/${n}: empty ${JSON.stringify(r)}`);
      else if (r.x < U.x0 - 0.5 || r.y < U.y0 - 0.5 || r.x + r.w > U.x1 + 0.5 || r.y + r.h > U.y1 + 0.5) out.push(`${set}/${n}: outside the safe area ${JSON.stringify(r)}`);
      if (['pause', 'think', 'exit', 'speed', 'apause', 'dec', 'inc', 'run', 'btn', 'resume', 'sound', 'quit', 'go', 'zoomDec', 'zoomInc'].includes(n) && r.h < Math.min(L.tap, 56) - 0.5) out.push(`${set}/${n}: tap target too short (${r.h})`);
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const [na, a] = items[i], [nb, b] = items[j];
      if (!hits(a, b)) continue;
      if (na === 'hud' && (nb === 'pause' || nb === 'think') && contains(a, b)) continue;   // portrait: the buttons sit inside the scoreboard
      out.push(`${set}: ${na} overlaps ${nb}`);
    }
  }
  return out;
}

// A default layout exists from the start (the 720x1280 portrait frame), so code that runs before the first render (tests, verify3d) always has one.
syncLayout(720, 1280);
