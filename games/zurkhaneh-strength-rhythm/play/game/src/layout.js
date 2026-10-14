// Screen geometry for every scene, computed from the live virtual size (the kit's fluid viewport keeps the short side at 720).
// Three shapes: tall (portrait phones), compact (portrait tablets / windows) and wide (landscape, w >= 1.2 h).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 1 };      // safe insets and the host's floating back button, in virtual units
import { makeCam } from './cam.js';
export const gl = { on: false };                              // true while the 3D pit is on screen (set by main.js through the game)
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const stack = (x, y, w, n, bh, gap) => Array.from({ length: n }, (_, i) => R(x, y + i * (bh + gap), w, bh));

export function layoutFor(w, h) {
  const wide = w >= h * 1.2, tall = h >= w * 1.5;
  const top = host.t + (host.back > 0 ? host.back + 6 : 16), bot = h - host.b - 14, left = host.l + 18, right = w - host.r - 18, W = right - left;
  const L = { w, h, wide, tall, top, bot, left, right, W };

  // title ----------------------------------------------------------------------------------------------------------------------
  {
    if (wide) {
      const pitR = Math.min((h - top - 70) * 0.5, w * 0.24), cx = left + (w * 0.46 - left) / 2 + 20, cy = top + (bot - top) / 2;
      const bx = w * 0.5 + 10, bw = Math.min(right - bx, 520), x = bx + (right - bx - bw) / 2, mid = bx + (right - bx) / 2;
      const hs = [84, 60, 60, 60, 60, 60], ys = []; let yy = top + 150;
      hs.forEach((hh) => { ys.push(yy); yy += hh + 10; });
      const rr = (i) => R(x, ys[i], bw, hs[i]);
      L.title = { pit: { cx, cy, R: pitR }, name: { x: mid, y: top + 52 }, tag: { x: mid, y: top + 106 }, play: rr(0), auto: rr(1), how: rr(2), rules: rr(3), about: rr(4), settings: rr(5), credit: { x: mid, y: bot - 6 } };
    } else {
      const bh1 = 96, bh = 72, gap = 12, bw = Math.min(W, 560), bx = (w - bw) / 2, half = (bw - gap) / 2;
      // the pit never grows so tall that the buttons and the lockup fall off the bottom (portrait tablets)
      const fit = (bot - top - 130 - 40 - (bh1 + bh * 3 + gap * 3) - 100) / 2.3;
      const pitR = Math.max(120, Math.min(W * 0.47, 330, fit));
      const block = 130 + pitR * 2.3 + 40 + (bh1 + bh * 3 + gap * 3) + 100, extra = Math.max(0, h - top - block);
      const cy = top + 130 + extra * 0.3 + pitR * 1.3, by = cy + pitR + 40 + extra * 0.4;
      L.title = {
        pit: { cx: w / 2, cy, R: pitR }, name: { x: w / 2, y: top + 62 + extra * 0.12 }, tag: { x: w / 2, y: top + 118 + extra * 0.12 },
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
      L.piece = { back: R(left, top, 140, 64), pit: { cx: left + (w * 0.46 - left) / 2 + 20, cy: top + (bot - top) / 2, R: Math.min((bot - top) * 0.42, w * 0.22) }, info: R(x, top + 80, cw, 250), learn: R(x, top + 346, cw, 80), perform: R(x, top + 438, cw, 80), watch: R(x, top + 530, cw, 80) };
    } else {
      const pr = Math.max(96, Math.min(W * 0.32, 240, (bot - top - 96 - 24 - 250 - 18 - 288) / 2));   // short portrait windows: the pit gives way to the buttons
      L.piece = { back: R(left, top, 140, 64), pit: { cx: w / 2, cy: top + 96 + pr, R: pr }, info: R(bx, top + 96 + pr * 2 + 24, bw, 250), learn: R(bx, 0, bw, 88), perform: R(bx, 0, bw, 88), watch: R(bx, 0, bw, 88) };
      const y0 = L.piece.info.y + L.piece.info.h + 18;
      L.piece.learn.y = y0; L.piece.perform.y = y0 + 100; L.piece.watch.y = y0 + 200;
    }
  }

  // play ---------------------------------------------------------------------------------------------------------------------------
  {
    const pb = 72;
    if (wide) {
      const topPad = host.t + 46, R0 = Math.max(120, Math.min((h - topPad - host.b - 20) / 2, (w - 2 * 230) / 2)), cx = w / 2, cy = topPad + (h - topPad - host.b - 20) / 2 + 4;
      const lx = left, lw = Math.max(150, cx - R0 - 16 - left), rx = cx + R0 + 16, rw = Math.max(150, right - rx);
      L.play = {
        pit: { cx, cy, R: R0 }, pause: R(right - pb, top, pb, pb), hint: R(right - pb * 2 - 12, top, pb, pb),
        score: { x: lx, y: top + 36, w: lw }, combo: { x: lx, y: top + 92 }, unison: R(lx, top + 128, lw, 26),
        info: { x: lx, y: top + 196, w: lw, align: 'left' }, strip: { x: rx, y: top + pb + 18, w: rw, h: Math.max(200, bot - (top + pb + 18)), vertical: true },
      };
    } else {
      const hudBottom = top + 150, stripH = 116, infoH = 64, gap = 14;
      const avail = bot - hudBottom, R0 = Math.max(120, Math.min(W * 0.5 - 4, (avail - infoH - stripH - gap * 2) / 2));
      const total = infoH + gap + R0 * 2 + gap + stripH, start = hudBottom + Math.max(0, (avail - total) / 2);
      L.play = {
        pit: { cx: w / 2, cy: start + infoH + gap + R0, R: R0 }, pause: R(right - pb, top, pb, pb), hint: R(right - pb * 2 - 12, top, pb, pb),
        score: { x: left, y: top + 36, w: W - pb * 2 - 20 }, combo: { x: left, y: top + 88 }, unison: R(left, top + 108, W, 26),
        info: { x: w / 2, y: start + infoH / 2, w: W, align: 'center' }, strip: { x: left, y: start + infoH + gap + R0 * 2 + gap, w: W, h: stripH, vertical: false },
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
      L.result = { stars: { x: left + (w * 0.5 - left) / 2, y: h * 0.36 }, again: R(x, h * 0.58, cw, 72), songs: R(x, h * 0.58 + 84, cw, 72), menu: R(x, h * 0.58 + 168, cw, 72), more: { x: w / 2, y: bot - 6 }, stats: { x: x, y: top + 60, w: cw } };
    } else {
      const y0 = Math.max(h * 0.62, top + 730);
      L.result = { stars: { x: w / 2, y: top + 235 }, again: R(bx, y0, bw, 78), songs: R(bx, y0 + 90, bw, 72), menu: R(bx, y0 + 174, bw, 72), more: { x: w / 2, y: bot - 6 }, stats: { x: bx, y: top + 450, w: bw } };
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
  if (gl.on) for (const pit of [L.title.pit, L.piece.pit, L.play.pit]) pit.cam = makeCam(w, h, pit);   // overlay spots follow the 3D camera
  return L;
}
