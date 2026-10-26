// Screen geometry for every scene, computed from the live virtual size (the kit's fluid viewport keeps the short side at 720).
// Two shapes: stacked (portrait phones, tablets, near-square windows) and wide (landscape, w >= 1.55 h).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 1 };      // safe insets and the host's floating back button, in virtual units
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const stack = (x, y, w, n, bh, gap) => Array.from({ length: n }, (_, i) => R(x, y + i * (bh + gap), w, bh));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Which pad a touch lands on: the three pads sit in one row at the bottom; a touch below the sash picks the pad by its column, so a
// finger that lands a little outside a pad still plays the pad it was aimed at.
export function padAt(P, x, y) {
  if (y < P.drum.y - 34) return null;
  const mid1 = (P.drum.x + P.drum.w + P.clap.x) / 2, mid2 = (P.clap.x + P.clap.w + P.step.x) / 2;
  return x < mid1 ? 'drum' : x < mid2 ? 'clap' : 'step';
}

export function layoutFor(w, h) {
  const wide = w >= h * 1.55, tall = h >= w * 1.45, side = w >= h * 1.15;
  const top = host.t + (host.back > 0 ? host.back + 6 : 16), bot = h - host.b - 14, left = host.l + 18, right = w - host.r - 18, W = right - left;
  const L = { w, h, wide, tall, side, top, bot, left, right, W };

  // title ----------------------------------------------------------------------------------------------------------------------
  {
    if (side) {
      const bx = w * 0.5 + 10, bw = Math.min(right - bx, 520), x = bx + (right - bx - bw) / 2, mid = bx + (right - bx) / 2;
      // The six buttons must always sit fully above the bottom edge (host insets and the floating back button eat height): keep
      // room for the Arcforge lockup when there is room, otherwise start higher, then shrink heights and gaps.
      const base = [100, 60, 58, 58, 58, 58], sum = base.reduce((a, b) => a + b, 0) + 8, lock = 84;   // +8: extra air under Play so its subtitle clears the next button
      let y0 = top + 160, avail = bot - lock - y0;
      let creditX = mid;
      if (sum + 50 > avail) {   // no room for the lockup under the buttons: it moves to the art column and the buttons take the height
        y0 = top + 150; avail = bot - 4 - y0; creditX = left + (w * 0.5 - left - 10) / 2;
      }
      const k = clamp((avail - 50) / sum, 0.55, 1), gp = k < 1 ? Math.max(6, 10 * k) : 10;
      const hs = base.map((v) => Math.round(v * k)), ys = []; let yy = y0;
      hs.forEach((hh, i) => { ys.push(yy); yy += hh + gp + (i === 0 ? Math.round(8 * k) : 0); });
      const rr = (i) => R(x, ys[i], bw, hs[i]);
      L.title = {
        art: R(left, top + 20, w * 0.5 - left - 10, bot - top - 80), name: { x: mid, y: top + 52 }, tag: { x: mid, y: top + 112 }, nameW: right - bx - 10,
        play: rr(0), auto: rr(1), how: rr(2), rules: rr(3), about: rr(4), settings: rr(5), credit: { x: creditX, y: bot - 6 },
      };
    } else {
      const bw = Math.min(W, 560), bx = (w - bw) / 2, bh1 = 96, bh = 72, gap = 12, half = (bw - gap) / 2;
      const blockH = bh1 + bh * 3 + gap * 3, creditH = 100;
      const by = bot - creditH - blockH;
      const nameH = 150, artY = top + nameH, artH = Math.max(150, by - artY - 18);
      L.title = {
        art: R(left, artY, W, artH), name: { x: w / 2, y: top + 56 }, tag: { x: w / 2, y: top + 118 }, nameW: W - 20,
        play: R(bx, by, bw, bh1), auto: R(bx, by + bh1 + gap, bw, bh),
        how: R(bx, by + bh1 + bh + gap * 2, half, bh), rules: R(bx + half + gap, by + bh1 + bh + gap * 2, half, bh),
        about: R(bx, by + bh1 + bh * 2 + gap * 3, half, bh), settings: R(bx + half + gap, by + bh1 + bh * 2 + gap * 3, half, bh),
        credit: { x: w / 2, y: bot - 6 },
      };
    }
  }

  // piece list -------------------------------------------------------------------------------------------------------------------
  {
    const cols = side ? 2 : 1, gap = 14, cw = Math.min((W - gap * (cols - 1)) / cols, 640), total = cw * cols + gap * (cols - 1), x0 = (w - total) / 2;
    const ty = top + 86, rows = Math.ceil(6 / cols), ch = Math.min(176, (bot - ty - gap * (rows - 1)) / rows);
    L.songs = { back: R(left, top, 140, 78), title: { x: w / 2, y: top + 34 }, cards: Array.from({ length: 6 }, (_, i) => R(x0 + (i % cols) * (cw + gap), ty + Math.floor(i / cols) * (ch + gap), cw, ch)) };
  }

  // piece page ---------------------------------------------------------------------------------------------------------------
  {
    const bw = Math.min(W, 600), bx = (w - bw) / 2;
    if (side) {
      const colX = w * 0.5 + 10, cw = Math.min(right - colX, 560), x = colX + (right - colX - cw) / 2;
      L.piece = { back: R(left, top, 140, 78), diagram: R(left, top + 90, w * 0.5 - left - 10, 230), horo: R(left, top + 330, w * 0.5 - left - 10, Math.max(120, bot - top - 340)), info: R(x, top + 80, cw, 296), learn: R(x, top + 392, cw, 80), perform: R(x, top + 484, cw, 80), watch: R(x, top + 576, cw, 80) };
    } else {
      const diaH = clamp(h * 0.15, 150, 230);
      const infoH = 316, btn = 84, g = 14;
      const info = R(bx, 0, bw, infoH);
      const need = diaH + infoH + btn * 3 + g * 4 + 100;
      const spare = Math.max(0, bot - top - need);
      const dy = top + 80, iy = dy + diaH + 12 + Math.min(spare * 0.5, 270);
      info.y = iy;
      const b0 = info.y + infoH + 14;
      L.piece = { back: R(left, top, 140, 78), diagram: R(left, dy, W, diaH), horo: R(left, dy + diaH + 4, W, Math.max(0, iy - dy - diaH - 8)), info, learn: R(bx, b0, bw, btn), perform: R(bx, b0 + btn + g, bw, btn), watch: R(bx, b0 + (btn + g) * 2, bw, btn) };
    }
  }

  // play ---------------------------------------------------------------------------------------------------------------------------
  {
    const pb = 82, gapP = 14;
    const base = { pause: R(right - pb, top, pb, pb), hint: R(right - pb * 2 - 12, top, pb, pb) };
    const padH = wide ? clamp(h * 0.26, 140, 190) : clamp(h * 0.19, 140, 240);
    const py = bot - padH, dw = (W - gapP * 2) * 0.42, cw = (W - gapP * 2) * 0.29;
    const pads = { drum: R(left, py, dw, padH), clap: R(left + dw + gapP, py, cw, padH), step: R(left + dw + cw + gapP * 2, py, cw, padH) };
    const compact = h < 1000;
    if (wide) {
      const colL = Math.min(W * 0.6, 920), colX = left + colL + 26, colW = right - colX, hudW = colW - pb * 2 - 24;
      L.play = {
        ...base, ...pads, wide: true, compact: false,
        score: { x: colX, y: top + 34, size: 56 }, combo: { x: colX + 2, y: top + 82 }, flow: R(colX, top + 100, hudW, 22),
        sash: R(left, top + 4, colL, py - top - 4 - 14),
        horo: R(colX, top + 172, colW, py - top - 172 - 14),
      };
    } else {
      const hudB = compact ? top + 78 : top + 144;
      const avail = py - hudB - 16;
      let dH = clamp(avail * 0.34, 120, 380), sH = avail - dH;
      if (sH > 600) { dH += sH - 600; sH = 600; }
      L.play = {
        ...base, ...pads, wide: false, compact,
        score: { x: left, y: top + (compact ? 28 : 36), size: compact ? 54 : 66 }, combo: { x: left + 2, y: top + (compact ? 64 : 88) },
        flow: compact ? R(left + 250, top + 18, Math.max(120, W - 250 - pb * 2 - 26), 22) : R(left, top + 108, W, 26),
        sash: R(left, hudB + 6, W, sH),
        horo: R(left, hudB + 6 + sH + 8, W, dH),
      };
    }
    const mw = Math.min(W, 520), mx = (w - mw) / 2;
    L.menu = (n) => ({ x: mx, y: h / 2 - (n * 82) / 2 + 10, w: mw, btns: stack(mx, h / 2 - (n * 82) / 2 + 10, mw, n, 70, 12) });
  }

  // result ---------------------------------------------------------------------------------------------------------------------
  {
    const bw = Math.min(W, 520), bx = (w - bw) / 2;
    if (side) {
      const colX = w * 0.5, cw = Math.min(right - colX - 10, 520), x = colX + (right - colX - cw) / 2;
      L.result = {
        stars: { x: left + (w * 0.5 - left) / 2, y: top + 215 }, cloth: R(left + 10, top + 395, w * 0.5 - left - 30, bot - top - 425),
        again: R(x, h * 0.58, cw, 72), songs: R(x, h * 0.58 + 84, cw, 72), menu: R(x, h * 0.58 + 168, cw, 72), more: { x: w / 2, y: bot - 6 }, stats: { x, y: top + 60, w: cw },
      };
    } else {
      const compact = h < 1040;
      const y0 = bot - (compact ? 238 : 270), bA = compact ? 70 : 78, bB = compact ? 56 : 66, gap = compact ? 8 : 10;
      const statsY = top + (compact ? 405 : 430);
      const rowH = Math.max(38, Math.min(54, (y0 - 14 - (statsY + 20 - 70) - 96) / 5));
      const panelBottom = statsY + 20 - 70 + rowH * 5 + 96, clothY = panelBottom + 12;
      const clothH = y0 - clothY - 14;
      L.result = {
        stars: { x: w / 2, y: top + (compact ? 212 : 215) }, again: R(bx, y0, bw, bA), songs: R(bx, y0 + bA + gap, bw, bB), menu: R(bx, y0 + bA + gap + bB + gap, bw, bB), more: { x: w / 2, y: bot - 6 },
        stats: { x: bx, y: statsY, w: bw }, rowH, cloth: R(left + 10, clothY, W - 20, clothH >= 80 ? clothH : 0),
      };
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
