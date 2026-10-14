// Screen geometry, as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side
// follows the screen). `layoutFor(w, h, left)` returns every rectangle for that size, cached by size, insets and the left-handed flag.
// The court is drawn in its own CANONICAL space (CW x CH, long side vertical) through one transform (scale f, centre cx, cy, and a
// quarter turn on landscape screens so the long side runs along the long side of the screen); pointer positions map back with
// `toCourt`, so the engine, the art and the input code never see the screen size.
//   tall     portrait phone (h >= 1500): info card, court, three buttons.
//   compact  portrait but shorter (tablets, small phones): the same stack, tighter.
//   wide     landscape: court turned on its side, an info column on one side, the controls on the other.
export const CW = 640, CH = 1000;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const rect = (x, y, w, h) => ({ x, y, w, h });
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const cache = new Map();
export function layoutFor(w, h, left = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}|${left ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, !!left); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

const R = rect;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Rows of a grid inside `area` (cols columns, row-major), each as tall as fits up to maxH, the block centred vertically.
function grid(count, area, cols, gap, maxH) {
  const rows = Math.ceil(count / cols), cw = (area.w - gap * (cols - 1)) / cols, rh = Math.min(maxH, (area.h - gap * (rows - 1)) / rows), out = [];
  const total = rows * rh + (rows - 1) * gap, y0 = area.y + Math.max(0, (area.h - total) / 2);
  for (let i = 0; i < count; i++) out.push(R(area.x + (i % cols) * (cw + gap), y0 + Math.floor(i / cols) * (rh + gap), cw, rh));
  return out;
}

function build(w, h, ins, left) {
  const land = w >= h, px = ins.px > 0 ? ins.px : 0.6;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const ucx = (U.x0 + U.x1) / 2;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const tall = !land && h >= 1500, mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const bh = Math.round(clamp(46 / px, 58, 84));       // a comfortable tap target (~44 css px where the screen allows)
  const minText = Math.max(16, 11 / px);               // never below ~11 css px
  const bottomPad = Math.max(16, ins.b + 8);
  const L = { w, h, land, mode, tall, ins, U, backBox, bh, minText, left, px };
  const backRight = ins.back ? backBox.x + backBox.w : 0;

  // ================================================================ court scenes: play, auto
  const scenes = {};
  L.play = (sc) => (scenes[sc] ??= buildPlay(sc));
  function buildPlay(sc) {
    const P = { sc, f: 1, cx: w / 2, cy: h / 2, rot: land, card: null, btn: {}, auto: null, msg: null, head: null, area: null };
    const g = 12;
    // Wide screens that are not wide enough for the side panels (tablets): stack the card above and the buttons below the court (turned on its side).
    const EH = 930, EW = 624;      // the picture's extent: the lines plus about 50 units of stands round them
    const topY = ins.back ? backBox.y + backBox.h + 4 : Math.max(ins.t + 10, tall ? 56 : 36);
    // stacked: the info card and the three buttons share ONE row on top, so the court gets the whole rest of the height
    const rowH = Math.max(100, bh + 16);
    const stackFree = () => { const bH = Math.max(72, Math.round(46 / px)); return (h - bottomPad) - 14 - (topY + rowH + 8); };
    const sideF = clamp(Math.min((U.h - 14) / EW, (U.w - 230 - 190 - 2 * g) / EH), 0.3, 1.3);
    const stackF = clamp(Math.min(stackFree() / EW, (U.w - 8) / EH), 0.3, 1.3);
    const stack = land && stackF > sideF * 1.1;
    P.stack = stack;
    if (!land || stack) {
      const top = ins.back ? backBox.y + backBox.h + 4 : Math.max(ins.t + 10, tall ? 56 : 36);
      const cardH = stack ? rowH : tall ? 156 : h >= 1100 ? 132 : 112, barH = Math.max(72, Math.round(46 / px));
      const head = cardH;                                  // Auto Play: the think-time buttons now sit in the button row, the label in the card
      const btnY = h - bottomPad - bh;
      const freeTop = top + head + 8, freeBot = (stack ? h - bottomPad : btnY - 12) - (stack ? 14 : 48), free = freeBot - freeTop;
      P.f = clamp(Math.min(free / (stack ? EW : EH), (U.w - 8) / (stack ? EH : EW)), 0.3, 1.3);
      P.rot = stack;
      P.cx = ucx; P.cy = freeTop + free / 2;
      const sbw = Math.min(190, (U.w * 0.5 - 28) / 3);
      const auto = sc === 'auto', sm = 84;
      // Auto Play: Exit / Pause / Skip and the two think-time buttons share one row (the think seconds are written in the card)
      const bw = auto ? (stack ? 110 : Math.min(190, (U.w - 2 * g - 4 * 14 - 2 * sm) / 3)) : stack ? sbw : Math.min(214, (U.w - 2 * g - 28) / 3);
      const rowW = auto ? 3 * bw + 2 * sm + 4 * 14 : 3 * bw + 28;
      P.card = stack ? R(U.x0 + g, top, Math.max(300, U.w - 2 * g - rowW - 12), cardH) : R(U.x0 + g, top, U.w - 2 * g, cardH);
      const x0 = stack ? U.x1 - g - rowW : ucx - rowW / 2, by = stack ? top + (cardH - bh) / 2 : btnY;
      const widths = auto ? [bw, bw, bw, sm, sm] : [bw, bw, bw];
      const xs = []; { let x = x0; for (const wd of widths) { xs.push(x); x += wd + 14; } }
      const slot = (i) => { const k = left ? widths.length - 1 - i : i; return R(xs[k], by, widths[k], bh); };
      P.btn = { menu: slot(0), hint: slot(1), act: slot(2) };
      if (auto) P.auto = { inCard: true, dec: slot(3), inc: slot(4), bar: null };
      P.area = R(U.x0, freeTop - 6, U.w, free + 12);
      P.head = R(U.x0, top, U.w, head);
      P.msg = R(U.x0 + g, (stack ? h - bottomPad : btnY - 12) - 58, U.w - 2 * g, 56);
    } else {
      const Lmin = 230, Rmin = 190;
      P.f = sideF;
      const bw = EH * P.f, extra = U.w - bw - 2 * g;
      let Lw, Rw;
      if (extra / 2 >= Math.max(Lmin, Rmin)) Lw = Rw = Math.min(extra / 2, 380); else { const s2 = Math.max(0, (extra - Lmin - Rmin) / 2); Lw = Lmin + s2; Rw = Rmin + s2; }
      const gw = Lw + g + bw + g + Rw, x0 = U.x0 + (U.w - gw) / 2;
      P.cx = x0 + Lw + g + bw / 2; P.cy = (U.y0 + U.y1) / 2;
      const panelTop = (x) => (ins.back && x < backRight + 6 ? backBox.y + backBox.h + 4 : U.y0 + 8);
      const A = R(x0, 0, Lw, 0), B = R(x0 + Lw + g + bw + g, 0, Rw, 0);
      for (const p of [A, B]) { p.y = panelTop(p.x); p.h = U.y1 - 8 - p.y; }
      const info = left ? B : A, ctrl = left ? A : B;
      P.info = info; P.ctrl = ctrl; P.head = info;
      const barH = sc === 'auto' ? 150 : 0;      // Auto Play: the think-time control sits under the info card, so the three buttons stay big
      P.card = R(info.x + 4, info.y, info.w - 8, Math.min(info.h - (barH ? barH + 10 : 0), 340));
      const cwid = Math.min(ctrl.w - 16, 330), cxx = ctrl.x + (ctrl.w - cwid) / 2, hgap = 14;
      const bhh = Math.min(bh, Math.floor((ctrl.h - 20 - 3 * hgap) / 3));
      const block = 3 * bhh + 2 * hgap;
      let y = ctrl.y + Math.max(0, (ctrl.h - block) / 2);
      if (sc === 'auto') {
        const bar = R(P.card.x, P.card.y + P.card.h + 10, P.card.w, barH), bw2 = (bar.w - 24) / 2;
        const dec = R(bar.x + 8, bar.y + bar.h - 76, bw2, 68), inc = R(dec.x + bw2 + 8, dec.y, bw2, 68);
        P.auto = { bar, dec, inc, label: { x: bar.x + bar.w / 2, y: bar.y + 26, align: 'center' }, think: { x: bar.x + bar.w / 2, y: bar.y + 62, align: 'center' } };
      }
      const slot = (i) => R(cxx, y + i * (bhh + hgap), cwid, bhh);
      P.btn = { menu: slot(0), hint: slot(1), act: slot(2) };
      const gm = 8; P.area = R(P.cx - bw / 2 - gm, U.y0, bw + 2 * gm, U.h);
      P.msg = R(P.cx - Math.min(bw, 600) / 2, U.y1 - 70, Math.min(bw, 600), 56);
    }
    return P;
  }
  // convert pointer (screen) <-> canonical court space for a play scene (a quarter turn on landscape screens)
  L.toCourt = (P, x, y) => P.rot
    ? { x: CW / 2 + (y - P.cy) / P.f, y: CH / 2 - (x - P.cx) / P.f }
    : { x: CW / 2 + (x - P.cx) / P.f, y: CH / 2 + (y - P.cy) / P.f };
  L.toScreen = (P, X, Y) => P.rot
    ? { x: P.cx - (Y - CH / 2) * P.f, y: P.cy + (X - CW / 2) * P.f }
    : { x: P.cx + (X - CW / 2) * P.f, y: P.cy + (Y - CH / 2) * P.f };

  // ================================================================ dialogs (batch result, match result)
  const dialogs = {};
  L.dialog = (kind) => (dialogs[kind] ??= buildDialog(kind));
  function buildDialog(kind) {
    const bodyH = { round: 230, over: 270 }[kind] ?? 200, nBtn = 2, extra = 44;
    const b1 = bh + 12, b2 = bh, gap = 14, btnsH = nBtn === 2 ? b1 + gap + b2 : b1;
    if (!land) {
      const dw = Math.min(U.w - 40, 620), dh = 24 + 86 + bodyH + 12 + btnsH + extra + 24;
      const x = ucx - dw / 2, y = clamp((U.y0 + U.y1) / 2 - dh / 2, U.y0 + 8, Math.max(U.y0 + 8, U.y1 - dh - 8));
      const bw = Math.min(dw - 80, 500), bx = x + (dw - bw) / 2, by = y + 24 + 86 + bodyH + 12;
      const btns = [R(bx, by, bw, b1), R(bx, by + b1 + gap, bw, b2)];
      return { panel: R(x, y, dw, dh), title: { x: x + dw / 2, y: y + 24 + 58 }, body: { x: x + dw / 2, y: y + 24 + 86 + 6, w: dw - 60, h: bodyH }, btns, extra: { x: x + dw / 2, y: by + btnsH + 34 }, land: false };
    }
    const dw = Math.min(U.w - 40, 900), lw = dw * 0.56, rw = dw - lw - 24;
    const dh = Math.max(24 + 86 + bodyH + 24, 24 + btnsH + extra + 24, 280);
    const x = ucx - dw / 2, y = clamp((U.y0 + U.y1) / 2 - dh / 2, U.y0 + 8, Math.max(U.y0 + 8, U.y1 - dh - 8));
    const bw = Math.min(rw - 24, 320), bx = x + lw + 12 + (rw - bw) / 2, by = y + (dh - btnsH - extra) / 2;
    const btns = [R(bx, by, bw, b1), R(bx, by + b1 + gap, bw, b2)];
    return { panel: R(x, y, dw, dh), title: { x: x + lw / 2 + 12, y: y + 24 + 58 }, body: { x: x + lw / 2 + 12, y: y + 24 + 86 + 6, w: lw - 40, h: bodyH }, btns, extra: { x: bx + bw / 2, y: by + btnsH + 34 }, land: true };
  }

  // ================================================================ pause menu
  {
    const n = 4, gap = 14, titleH = land ? 80 : 110, bhh = Math.min(bh + 8, Math.floor((U.h - titleH - 40 - (n - 1) * gap) / n)), bw = Math.min(500, U.w - 60);
    const total = titleH + n * bhh + (n - 1) * gap, y0 = (U.y0 + U.y1) / 2 - total / 2, x = ucx - bw / 2, cy = (i) => y0 + titleH + i * (bhh + gap);
    L.menu = { title: { x: ucx, y: y0 + titleH - 34, size: land ? 56 : 70 }, resume: R(x, cy(0), bw, bhh), restart: R(x, cy(1), bw, bhh), settings: R(x, cy(2), bw, bhh), quit: R(x, cy(3), bw, bhh) };
  }

  // ================================================================ reader pages: How to play, About, Game Rules
  {
    const navY = h - bottomPad - bh, top = !land && ins.back ? backBox.y + backBox.h + 4 : Math.max(ins.t + 8, 16);
    let pw, px0;
    if (land) { const lo = Math.max(U.x0 + 16, ins.back ? backRight + 8 : 0); pw = Math.min(U.x1 - 16 - lo, 1000); px0 = lo + (U.x1 - 16 - lo - pw) / 2; }
    else { pw = Math.min(U.w - 32, 760); px0 = ucx - pw / 2; }
    const panelY = land ? U.y0 + 8 : top, panel = R(px0, panelY, pw, navY - 12 - panelY);
    const sw = 120, sh = Math.max(60, bh), inc = R(panel.x + panel.w - 16 - sw, panel.y + 14, sw, sh), dec = R(inc.x - 10 - sw, panel.y + 14, sw, sh);
    const viewport = R(panel.x + 24, panel.y + 14 + sh + 12, panel.w - 48 - 14, panel.h - (14 + sh + 12) - 44);
    const nw = Math.min(220, (pw - 28) / 3), nx = panel.x + (pw - (3 * nw + 28)) / 2;
    L.reader = {
      panel, viewport, dec, inc, title: { x: panel.x + 28, y: panel.y + 14 + sh / 2 }, counter: { x: panel.x + panel.w / 2, y: panel.y + panel.h - 16 },
      scrollbar: R(panel.x + panel.w - 22, viewport.y, 10, viewport.h), textW: Math.min(viewport.w - 4, 780), cx: viewport.x + viewport.w / 2,
      nav: { prev: R(nx, navY, nw, bh), back: R(nx + nw + 14, navY, nw, bh), next: R(nx + 2 * (nw + 14), navY, nw, bh) },
    };
  }

  // ================================================================ settings, the web-preview card
  {
    const doneW = Math.min(320, U.w - 80), done = R(ucx - doneW / 2, h - bottomPad - bh, doneW, bh);
    const hdrY = (ins.back && !land ? backBox.y + backBox.h : Math.max(ins.t, 0)) + (land ? 58 : 76), size = land ? 52 : 68;
    const aTop = Math.max(hdrY + 24, ins.back && land ? backBox.y + backBox.h + 6 : 0), aBot = done.y - (land ? 12 : 34), cols = land ? 2 : 1;
    const aw = Math.min(cols === 2 ? 920 : 600, U.w - 60), area = R(ucx - aw / 2, aTop, aw, aBot - aTop);
    L.settings = { title: { x: ucx, y: hdrY, size }, rows: grid(6, area, cols, 12, 104), rows5: grid(5, area, cols, 12, 104), done, note: { x: ucx, y: done.y - 12 }, noteFits: !land && aBot - aTop > 600 };
    L.demo = { title: { x: ucx, y: h * 0.3, size: land ? 50 : 60 }, body: { x: ucx, y: h * 0.3 + 70, w: Math.min(U.w - 80, 600) }, back: done };
  }

  // ================================================================ title
  const titles = {};
  L.title = () => (titles.t ??= buildTitle());
  function buildTitle() {
    const T = { rows: {}, hero: null, titleText: null, tag: null, brand: null, dim: null, card: null, dev: { x: U.x1 - 12, y: U.y0 + 28 } };
    const rowsDef = [['play'], ['level', 'auto'], ['howto', 'about', 'rules'], ['settings']];
    const wt = (r) => (r[0] === 'play' ? 1.4 : r[0] === 'howto' ? 0.95 : 1);
    const sumW = rowsDef.reduce((a, r) => a + wt(r), 0), gapV = 10;
    const place = (x0, aw, y0, unit) => rowsDef.forEach((row) => {
      const rh = unit * wt(row) - gapV, cw = (aw - 12 * (row.length - 1)) / row.length;
      row.forEach((nm, i) => { T.rows[nm] = R(x0 + i * (cw + 12), y0, cw, rh); });
      y0 += unit * wt(row);
    });
    const LK = 0.2725;                                   // lockup aspect (327 / 1200)
    const tapZone = (b, lkh, rowsBottom, limitY) => {
      const m = 44 / ins.px, tw = Math.max(b.w + 20, m), th = Math.max(lkh + 12, m);
      const y0 = Math.max(b.y - th / 2, rowsBottom + 2), y1 = Math.max(Math.min(limitY, y0 + th), b.y + lkh / 2 + 4);
      return R(b.x - tw / 2, y0, tw, Math.max(y1 - y0, lkh));
    };
    if (!land) {
      const lkw = Math.min(U.w - 80, Math.max(260, 125 / ins.px)), lkh = lkw * LK, strip = lkh + 22;
      const unit = clamp(h * 0.058, 62, 96), blockH = unit * sumW, bw = Math.min(U.w - 80, 580), bx = ucx - bw / 2;
      const btnTop = h - bottomPad - strip - blockH + gapV;
      place(bx, bw, btnTop, unit);
      const top = Math.max(ins.t + 6, 14), tsz = h >= 1100 ? 112 : 88;
      T.titleText = { x: ucx, y: top + tsz * 0.9, size: tsz }; T.tag = { x: ucx, y: top + tsz * 0.9 + 42, size: 28 };
      T.brand = { x: ucx, y: h - bottomPad - 8 - lkh / 2, w: lkw };
      T.lockTap = tapZone(T.brand, lkh, btnTop - gapV + unit * sumW, h);
      const heroTop = top + tsz * 0.9 + 42 + 14, zone = btnTop - 20 - heroTop;
      T.hero = { sc: clamp(Math.min(zone / CH, (U.w - 20) / CW), 0.3, 1), cx: ucx, cy: heroTop + zone / 2, rot: false };
      T.dim = R(0, btnTop - 14, w, h - btnTop + 14);
      return T;
    }
    const aw = clamp(U.w * 0.4, 400, 600), ax = U.x1 - aw - 16, card = R(ax, U.y0 + 8, aw, U.h - 16), pad = 16;
    const lkw = Math.min(aw - 2 * pad, Math.max(180, 125 / ins.px)), lkh = lkw * LK, strip = lkh + 20;
    const unit = Math.min(94, (card.h - 2 * pad - strip + gapV) / sumW);
    const by0 = card.y + pad + Math.max(0, (card.h - 2 * pad - strip + gapV - unit * sumW) / 2);
    place(ax + pad, aw - 2 * pad, by0, unit);
    T.card = card;
    const lx0 = Math.max(U.x0 + 8, backRight + 4), LW = ax - 8 - lx0, lcx = lx0 + LW / 2;
    const tsz = Math.min(100, (LW - 20) / 4.4), top = U.y0 + 10;
    T.titleText = { x: lcx, y: top + tsz * 0.85, size: tsz }; T.tag = { x: lcx, y: top + tsz * 0.85 + 36, size: 26 };
    T.brand = { x: ax + aw / 2, y: Math.min(card.y + card.h - pad - lkh / 2, by0 + unit * sumW - gapV + 10 + lkh / 2), w: lkw };
    T.lockTap = tapZone(T.brand, lkh, by0 + unit * sumW - gapV, card.y + card.h);
    // the court lies on its side in the hero area
    const heroTop = top + tsz * 0.85 + 50, zone = U.y1 - 12 - heroTop;
    T.hero = { sc: clamp(Math.min(zone / CW, (LW - 16) / CH), 0.3, 1), cx: lcx, cy: heroTop + zone / 2, rot: true };
    return T;
  }
  return L;
}
