// Screen geometry for every scene, computed from the live virtual size (the kit's fluid viewport keeps the short side at 720).
// Three shapes: tall (portrait phones), compact (portrait tablets / windows) and wide (landscape, w >= 1.2 h).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 1 };      // safe insets and the host's floating back button, in virtual units
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const CUE_OUT = 1.14;       // dots start this many drum radii out and drop onto the rim track
export const TRACK = 0.74;         // radius of the rim track, in drum radii

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const stack = (x, y, w, n, bh, gap) => Array.from({ length: n }, (_, i) => R(x, y + i * (bh + gap), w, bh));

// Which instrument a touch lands on: the drum face first, then the nearest small pad within a generous reach.
export function padAt(P, x, y) {
  if (Math.hypot(x - P.drum.cx, y - P.drum.cy) <= P.drum.r * 1.03) return 'drum';
  let best = null, bd = 1e9;
  for (const k of ['tri', 'shk', 'fire']) {
    const p = P[k], rx = (p.w ?? p.r * 2) / 2 + 26, ry = (p.h ?? p.r * 2) / 2 + 26;
    const d = Math.max(Math.abs(x - p.cx) / rx, Math.abs(y - p.cy) / ry);
    if (d <= 1 && d < bd) { best = k; bd = d; }
  }
  return best;
}

export function layoutFor(w, h) {
  const wide = w >= h * 1.2, tall = h >= w * 1.5;
  const top = host.t + (host.back > 0 ? host.back + 6 : 16), bot = h - host.b - 14, left = host.l + 18, right = w - host.r - 18, W = right - left;
  const L = { w, h, wide, tall, top, bot, left, right, W };

  // title ----------------------------------------------------------------------------------------------------------------------
  {
    if (wide) {
      const dR = Math.min((h - top - 90) * 0.4, w * 0.2), cx = left + (w * 0.46 - left) / 2 + 20, cy = top + (bot - top) / 2 + 20;
      const bx = w * 0.5 + 10, bw = Math.min(right - bx, 520), x = bx + (right - bx - bw) / 2, mid = bx + (right - bx) / 2;
      const y0 = top + 150, rows1 = [84, 60, 60, 60, 60, 60], full = y0 + rows1.reduce((a, b) => a + b, 0) + 10 * 5;
      const lockH = Math.min(300, (right - bx) * 0.5) * 0.2725 + 14;
      let play, auto, how, rules, about, settings;
      if (full <= bot - lockH) {        // roomy: one column
        const ys = []; let yy = y0;
        rows1.forEach((hh) => { ys.push(yy); yy += hh + 10; });
        const rr = (i) => R(x, ys[i], bw, rows1[i]);
        play = rr(0); auto = rr(1); how = rr(2); rules = rr(3); about = rr(4); settings = rr(5);
      } else {                           // short landscape (phones, safe areas): the four small buttons go two by two
        const g = 10, hw = (bw - g) / 2, ph = 84, ah = 60, sh = 60;
        play = R(x, y0, bw, ph); auto = R(x, y0 + ph + g, bw, ah);
        const r2 = y0 + ph + ah + g * 2, r3 = r2 + sh + g;
        how = R(x, r2, hw, sh); rules = R(x + hw + g, r2, hw, sh); about = R(x, r3, hw, sh); settings = R(x + hw + g, r3, hw, sh);
      }
      L.title = { drum: { cx, cy, R: dR }, name: { x: mid, y: top + 52 }, tag: { x: mid, y: top + 106 }, play, auto, how, rules, about, settings, credit: { x: mid, y: bot - 6 } };
    } else {
      const bw = Math.min(W, 560), bx = (w - bw) / 2;
      const bh1 = 96, bh = 72, gap = 12, half = (bw - gap) / 2, colH = bh1 + bh * 3 + gap * 3;
      const lockH = Math.min(300, W * 0.5) * 0.2725 + 22;                       // the ARCFORGE lockup gets its own row under the last button
      const avail = bot - lockH - top;                                          // room for drummer + drum + button column
      const dR = Math.max(60, Math.min(W * 0.36, 280, (avail - 140 - 60 - colH - 8) / 2.4));   // leaves room for the drummer's head + raised hand above the drum
      const off = 140 + dR * 0.4;
      const block = off + dR * 2 + 60 + colH, extra = Math.max(0, avail - block);
      const cy = top + off + extra * 0.3 + dR, by = Math.min(cy + dR + 50 + extra * 0.4, bot - lockH - colH);
      L.title = {
        drum: { cx: w / 2, cy, R: dR }, name: { x: w / 2, y: top + 62 + extra * 0.12 }, tag: { x: w / 2, y: top + 118 + extra * 0.12 },
        play: R(bx, by, bw, bh1), auto: R(bx, by + bh1 + gap, bw, bh),
        how: R(bx, by + bh1 + bh + gap * 2, half, bh), rules: R(bx + half + gap, by + bh1 + bh + gap * 2, half, bh),
        about: R(bx, by + bh1 + bh * 2 + gap * 3, half, bh), settings: R(bx + half + gap, by + bh1 + bh * 2 + gap * 3, half, bh),
        credit: { x: w / 2, y: bot - 6 },
      };
    }
  }

  // piece list -------------------------------------------------------------------------------------------------------------------
  {
    const cols = wide ? 2 : 1, gap = 14, cw = Math.min((W - gap * (cols - 1)) / cols, 640), total = cw * cols + gap * (cols - 1), x0 = (w - total) / 2;
    const ty = top + 86, rows = Math.ceil(6 / cols), ch = Math.min(176, (bot - ty - gap * (rows - 1)) / rows);
    L.songs = { back: R(left, top, 140, 64), title: { x: w / 2, y: top + 34 }, cards: Array.from({ length: 6 }, (_, i) => R(x0 + (i % cols) * (cw + gap), ty + Math.floor(i / cols) * (ch + gap), cw, ch)) };
  }

  // piece page ---------------------------------------------------------------------------------------------------------------
  {
    const bw = Math.min(W, 600), bx = (w - bw) / 2;
    if (wide) {
      const colX = w * 0.5 + 10, cw = Math.min(right - colX, 560), x = colX + (right - colX - cw) / 2;
      L.piece = { back: R(left, top, 140, 64), drum: { cx: left + (w * 0.46 - left) / 2 + 20, cy: top + (bot - top) / 2 + 20, R: Math.min((bot - top) * 0.36, w * 0.2) }, info: R(x, top + 80, cw, 250), learn: R(x, top + 346, cw, 80), perform: R(x, top + 438, cw, 80), watch: R(x, top + 530, cw, 80) };
    } else {
      let dR = Math.min(W * 0.28, 210), infoH = 290, bH = 88, bG = 12;
      const need = (r, ih, bh, g) => 96 + r * 2 + 50 + ih + 18 + bh * 3 + g * 2 + 14;
      if (top + need(dR, infoH, bH, bG) > bot) { infoH = 250; bH = 76; bG = 10; dR = Math.max(70, Math.min(dR, (bot - top - need(0, infoH, bH, bG)) / 2)); }
      L.piece = { back: R(left, top, 140, 64), drum: { cx: w / 2, cy: top + 96 + dR + 10, R: dR }, info: R(bx, top + 96 + dR * 2 + 50, bw, infoH), learn: R(bx, 0, bw, bH), perform: R(bx, 0, bw, bH), watch: R(bx, 0, bw, bH) };
      const y0 = L.piece.info.y + L.piece.info.h + 18;
      L.piece.learn.y = y0; L.piece.perform.y = y0 + bH + bG; L.piece.watch.y = y0 + (bH + bG) * 2;
    }
  }

  // play ---------------------------------------------------------------------------------------------------------------------------
  {
    const pb = 72;
    const base = { pause: R(right - pb, top, pb, pb), hint: R(right - pb * 2 - 12, top, pb, pb) };
    if (wide) {
      const availH = bot - top - 6;
      const dR = Math.max(110, Math.min(availH / 2 / (CUE_OUT + 0.04), (w - 2 * 205) / 2 / CUE_OUT, w * 0.24));
      const cx = w / 2, cy = top + 6 + availH / 2 + 6;
      const colL = cx - dR * CUE_OUT - left, colR = right - (cx + dR * CUE_OUT);
      const sideX = left + colL / 2;
      const padR = Math.max(40, Math.min(70, colL / 2 - 8));
      const shw = Math.max(100, Math.min(200, colR - 16)), shh = Math.min(130, shw * 0.7);
      const side = colR >= 165;                                           // room for the dancer beside the drum
      const dwy = cy - 60, dsc = Math.max(0.5, Math.min(1.15, (colR - 30) / 250, (dwy - top - 24) / 175));
      L.play = {
        ...base, drum: { cx, cy, r: dR }, tri: { cx: sideX, cy: cy - padR * 0.5, r: padR },
        shk: side ? { cx: cx + dR * CUE_OUT + colR / 2, cy: bot - shh / 2 - 34, w: shw, h: shh } : { cx: cx + dR * CUE_OUT + colR / 2, cy, w: shw, h: shh },
        fire: { cx: sideX, cy: cy + padR * 2.25, r: padR * 0.82 },
        score: { x: left, y: top + 34 }, combo: { x: left, y: top + 84 }, groove: R(left, top + 108, Math.max(160, Math.min(300, colL)), 22),
        tag: { x: cx, y: cy },
        dancer: side ? { x: cx + dR * CUE_OUT + colR / 2, y: dwy, s: dsc, behind: false } : { x: cx, y: cy - dR * 0.96, s: Math.max(0.42, Math.min(1.5, (cy - dR * 0.96 - top - 40) / 205)), behind: true },
      };
    } else {
      const hudB = top + 160, padH = 150;
      const availH = bot - hudB - padH;
      const dR = Math.max(110, Math.min((w - 14) / 2 / CUE_OUT, (availH - 170) / 2 / CUE_OUT));
      const cx = w / 2, cy = Math.min(bot - padH - dR * 0.9 - 6, hudB + availH * 0.62 + dR * 0.1);
      const py = bot - padH / 2 + 4, padR = Math.min(66, W * 0.1);
      L.play = {
        ...base, drum: { cx, cy, r: dR }, tri: { cx: left + padR + W * 0.04, cy: py, r: padR }, fire: { cx: w / 2, cy: py, r: padR * 0.9 },
        shk: { cx: right - Math.min(100, W * 0.15) - W * 0.02, cy: py, w: Math.min(200, W * 0.3), h: Math.min(124, padR * 1.9) },
        score: { x: left, y: top + 36 }, combo: { x: left, y: top + 88 }, groove: R(left, top + 108, W, 26),
        tag: { x: cx, y: cy }, dancer: { x: cx, y: cy - dR * 0.96, s: Math.max(0.42, Math.min(1.7, (cy - dR * 0.96 - hudB - 16) / 205)), behind: true },
      };
    }
    const mw = Math.min(W, 520), mx = (w - mw) / 2;
    L.menu = (n) => ({ x: mx, y: h / 2 - (n * 82) / 2 + 10, w: mw, btns: stack(mx, h / 2 - (n * 82) / 2 + 10, mw, n, 70, 12) });
  }

  // result ---------------------------------------------------------------------------------------------------------------------
  {
    const bw = Math.min(W, 520), bx = (w - bw) / 2;
    if (wide) {
      const colX = w * 0.5, cw = Math.min(right - colX - 10, 520), x = colX + (right - colX - cw) / 2;
      L.result = { stars: { x: left + (w * 0.5 - left) / 2, y: h * 0.36 }, again: R(x, h * 0.58, cw, 72), songs: R(x, h * 0.58 + 84, cw, 72), menu: R(x, h * 0.58 + 168, cw, 72), more: { x: w / 2, y: bot - 6 }, stats: { x, y: top + 60, w: cw } };
    } else {
      if (h < 1060) {
        const y0 = bot - 218 - 30;
        L.result = { compact: true, stars: { x: w / 2, y: top + 205 }, again: R(bx, y0, bw, 70), songs: R(bx, y0 + 80, bw, 64), menu: R(bx, y0 + 154, bw, 64), more: { x: w / 2, y: bot - 6 }, stats: { x: bx, y: top + 410, w: bw } };
      } else {
        const y0 = Math.max(h * 0.62, top + 760);
        L.result = { stars: { x: w / 2, y: top + 222 }, again: R(bx, y0, bw, 78), songs: R(bx, y0 + 90, bw, 72), menu: R(bx, y0 + 174, bw, 72), more: { x: w / 2, y: bot - 6 }, stats: { x: bx, y: top + 452, w: bw } };
      }
    }
  }

  // documents (About, How to Play, Rules, Settings) -----------------------------------------------------------------------
  {
    const headH = 64, navH = 74, vx = left, vw = W, vy = top + headH + 56;
    const vh = bot - vy - navH - 12;
    L.doc = {
      back: R(left, top, 150, headH), textDec: R(right - 2 * 86 - 10, top, 86, headH), textInc: R(right - 86, top, 86, headH),
      viewport: R(vx, vy, vw, vh), nav: { back: R(left, bot - navH, (W - 12) / 2, navH), next: R(left + (W - 12) / 2 + 12, bot - navH, (W - 12) / 2, navH) },
      fullH: bot - vy,
    };
  }
  return L;
}
