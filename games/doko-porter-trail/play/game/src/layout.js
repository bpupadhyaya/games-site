// Geometry as a pure function of the LIVE screen size (fluid viewport: the short side is always 720 units).
// Drawing and hit-testing read the same rects, so what is drawn is what is tapped.
export const THINK_STEPS = [3, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button (main.js keeps it current)
export const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// A comfortable touch target in virtual units: 46 css px, never under 66 units.
export const tap = () => clamp(46 / (host.px || 0.55), 66, 112);

export function frame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  return { w, h, U, land: w >= h, lx: U.x0 + 14 + (host.back || 0) };
}

// Standard header: back button, centred title, optional text zoom buttons, and the body rect below.
export function headerLayout(w, h, { zoom = true, footer = 0 } = {}) {
  const f = frame(w, h), U = f.U, s = tap();
  const bw = Math.min(U.w - 28, 940), bx = U.x0 + (U.w - bw) / 2;
  const y = U.y0 + 10;
  const back = R(f.lx, y, s + 8, s);
  const textInc = zoom ? R(U.x1 - 14 - s, y, s, s) : null;
  const textDec = zoom ? R(U.x1 - 14 - s * 2 - 8, y, s, s) : null;
  const top = y + s + 14;
  const body = R(bx, top, bw, Math.max(80, U.y1 - top - 12 - footer));
  const titleX = Math.max(f.lx + s + 24, bx);
  return { f, U, back, textDec, textInc, body, title: R(titleX, y, (zoom ? textDec.x : U.x1 - 14) - titleX - 10, s), footerY: U.y1 - 12 - footer, bx, bw };
}

export function docLayout(w, h) {
  const s = tap(), H = headerLayout(w, h, { zoom: true, footer: s + 14 });
  const y = H.footerY + 12;
  const prev = R(H.bx, y, s * 2.1, s), next = R(H.bx + H.bw - s * 2.1, y, s * 2.1, s);
  return { ...H, prev, next, label: R(prev.x + prev.w + 8, y, next.x - prev.x - prev.w - 16, s) };
}

export function settingsLayout(w, h, scale, n) {
  const H = headerLayout(w, h, { zoom: true }), s = tap();
  const rowH = 34 * scale + 18 + s + 30, rows = [];
  for (let i = 0; i < n; i++) {
    const y = i * rowH;
    rows.push({ y, h: rowH - 12, label: R(H.body.x + 18, y + 12, H.body.w - 36, 34 * scale), ctrl: R(H.body.x + 18, y + 12 + 34 * scale + 10, H.body.w - 36, s) });
  }
  return { ...H, rows, rowH, contentH: n * rowH + 10 };
}

// Journey list: chapter headers and trail cards (content coordinates, scrolled by the caller).
export function journeyRects(body, counts, scale) {
  const cols = body.w >= 860 ? 4 : 2, gap = 14, cw = (body.w - gap * (cols - 1)) / cols;
  const ch = 192 + (scale - 1) * 70;
  let y = body.y + 6; const items = [];
  counts.forEach((n, ci) => {
    const hh = 52 * Math.max(1, scale * 0.9);
    items.push({ ci, head: R(body.x, y, body.w, hh), cards: [] });
    y += hh + 8;
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      items[items.length - 1].cards.push(R(body.x + col * (cw + gap), y + row * (ch + gap), cw, ch));
    }
    y += Math.ceil(n / cols) * (ch + gap) + 10;
  });
  return { items, h: y - body.y + 20 };
}

export function titleLayout(w, h) {
  const f = frame(w, h), U = f.U, s = tap();
  const bh = Math.max(s, 78), gap = 12;
  let colX, colW, top, art;
  if (f.land) {
    colW = Math.min(520, U.w * 0.42); colX = U.x1 - colW - 28; top = U.y0 + Math.max(20, (U.h - (bh * 5 + gap * 4)) / 2 - 10);
    art = R(U.x0, U.y0, colX - U.x0 - 10, U.h);
  } else {
    colW = Math.min(U.w - 48, 620); colX = U.x0 + (U.w - colW) / 2;
    const total = bh * 5 + gap * 4;
    top = U.y1 - total - Math.max(24, h * 0.03);
    art = R(U.x0, U.y0, U.w, top - U.y0 - 10);
  }
  const half = (colW - gap) / 2;
  const row = (i) => top + i * (bh + gap);
  const buttons = {
    journey: R(colX, row(0), colW, bh),
    long: R(colX, row(1), half, bh), daily: R(colX + half + gap, row(1), half, bh),
    learn: R(colX, row(2), colW, bh),
    howto: R(colX, row(3), half, bh), rules: R(colX + half + gap, row(3), half, bh),
    about: R(colX, row(4), half, bh), settings: R(colX + half + gap, row(4), half, bh),
  };
  return { f, art, buttons, colX, colW, top, titleY: f.land ? U.y0 + U.h * 0.3 : U.y0 + Math.max(60, art.h * 0.2) };
}

// Play HUD. Everything sits at the edges; the middle belongs to the scene.
export function playLayout(w, h, { hand = 'right', coach = false, auto = false } = {}) {
  const f = frame(w, h), U = f.U, s = tap(), m = 12;
  const top = U.y0 + 8;
  const pause = R(U.x1 - m - s, top, s, s);
  const hint = R(pause.x - 8 - s, top, s, s);
  const leftX = f.lx;
  const strip = R(leftX, top + s + 10, U.x1 - m - leftX, 46);
  const barsY = strip.y + strip.h + 12;
  const gap3 = 12, gw = Math.min(190, strip.w * 0.26), side = (strip.w - gw - gap3 * 2) / 2;
  const breath = R(strip.x, barsY, side, 34), gauge = R(strip.x + side + gap3, barsY, gw, 34), day = R(strip.x + side + gw + gap3 * 2, barsY, side, 34);
  const items = R(leftX, top, hint.x - leftX - 10, s);
  // Watch and Learn card sits at the bottom: card + a row of controls
  const railH = s * 2 + 40 + (f.land ? 118 : 170);
  const railW = Math.min(U.w - 28, 800);
  const rail = R(U.x0 + (U.w - railW) / 2, U.y1 - 12 - railH, railW, railH);
  const bw = (rail.w - 24 - 16) / 3;
  const rb = rail.y + rail.h - 12 - s;
  const railBtns = { pause: R(rail.x + 12, rb, bw, s), dec: R(rail.x + 12 + bw + 8, rb, (bw - 8) / 2, s), inc: R(rail.x + 12 + bw + 8 + (bw - 8) / 2 + 8, rb, (bw - 8) / 2, s), exit: R(rail.x + 12 + (bw + 8) * 2, rb, bw, s) };
  // hint card: at the bottom, so the porter stays in view
  const coachH = f.land ? 176 : 200, coachW = f.land ? Math.min(U.w - 360, 760) : Math.min(U.w - 28, 760);
  const coachX = f.land ? (hand === 'left' ? U.x1 - 14 - coachW : U.x0 + 14) : U.x0 + (U.w - coachW) / 2;
  const coachRect = R(coachX, U.y1 - 14 - coachH, coachW, coachH);
  const coachBtns = { close: R(coachRect.x + coachRect.w - s - 8, coachRect.y - Math.round(s * 0.55), s, s) };
  // idle control circle (an echo of where the thumb is); in play it follows the thumb
  const padR = 78;
  const pad = f.land
    ? { x: hand === 'left' ? U.x0 + 150 : U.x1 - 150, y: U.y1 - 130 }
    : { x: U.x0 + U.w / 2, y: U.y1 - 150 };
  if (!f.land && auto) pad.y = Math.min(pad.y, rail.y - padR - 14);
  else if (!f.land && coach) pad.y = Math.min(pad.y, coachRect.y - padR - 14);
  return { f, U, pause, hint, strip, breath, gauge, day, items, pad: { ...pad, r: padR }, coach: coachRect, coachBtns, rail, railBtns, sceneTop: barsY + 58 };
}

export function pauseLayout(w, h) {
  const f = frame(w, h), U = f.U, s = Math.max(tap(), 80);
  const pw = Math.min(U.w - 40, 560), ph = s * 4 + 12 * 3 + 150;
  const panel = R(U.x0 + (U.w - pw) / 2, U.y0 + (U.h - ph) / 2, pw, ph);
  const b = (i) => R(panel.x + 24, panel.y + 120 + i * (s + 12), pw - 48, s);
  return { panel, resume: b(0), restart: b(1), settings: b(2), menu: b(3) };
}

export function overLayout(w, h, scale = 1) {
  const f = frame(w, h), U = f.U, s = Math.max(tap(), 78);
  const pw = Math.min(U.w - 28, 700), ph = Math.min(U.h - 20, 760 * Math.min(1.3, scale) + 40);
  const panel = R(U.x0 + (U.w - pw) / 2, U.y0 + Math.max(10, (U.h - ph) / 2), pw, ph);
  const by = panel.y + panel.h - 24 - s * 2 - 12;
  const half = (pw - 48 - 12) / 2;
  return { panel, btns: { next: R(panel.x + 24, by, pw - 48, s), menu: R(panel.x + 24, by + s + 12, half, s), share: R(panel.x + 24 + half + 12, by + s + 12, half, s) }, bodyBottom: by - 12 };
}

export function demoLayout(w, h) {
  const f = frame(w, h), U = f.U, s = Math.max(tap(), 80);
  const pw = Math.min(U.w - 40, 620), panel = R(U.x0 + (U.w - pw) / 2, U.y0 + U.h * 0.28, pw, 430);
  return { panel, ok: R(panel.x + 24, panel.y + panel.h - 24 - s, pw - 48, s) };
}
