// Screen geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long
// side follows the screen). `layoutFor(w, h, left)` returns every rectangle for that size; it is cached by size, insets and the
// left-handed flag, so a frame never recomputes it.
//
// The board is a square drawn in its own CANONICAL space (the playing surface is PLAY units wide, the frame FRAME units thick,
// centred on CX, CY). A board scene draws it through one transform (scale f, centre cx, cy), and pointer positions are mapped
// back with `toBoard`, so the physics, the art and the aiming code never see the screen size.
//
// Shapes:
//   tall     portrait phone (h >= 1500): header (players, message), board, power meter, tip, three buttons.
//   compact  portrait but shorter (tablets, small phones): the same stack, tighter, the board scaled to what is left.
//   wide     landscape: the board as large as the height allows, a card of players + message on one side and the controls
//            on the other (mirrored for left-handed play).
// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is 720 units, the long side follows the
// screen). `layoutFor(w, h, left)` returns every rectangle for that size, cached by size, insets and the left-handed flag.
// The court is drawn in its own CANONICAL space (720 x 960 units, centre CX, CY) through one transform (scale f, centre cx, cy);
// pointer positions map back with `toCourt`, so the engine, the art and the aiming code never see the screen size.
//   tall     portrait phone (h >= 1500): scoreboard cards, strip, court, three buttons.
//   compact  portrait but shorter (tablets, small phones): the same stack, tighter, the court scaled to what is left.
//   wide     landscape: the court as large as the height allows, a scoreboard column on one side and the controls on the other.
export const CW = 720, CH = 960, CX = 360, CY = 480;
export const FR = CH;                                   // court height, the scale reference
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const rect = (x, y, w, h) => ({ x, y, w, h });
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
// The 3D presenter (web/view3d) publishes its camera here every frame while it draws the field: pointer positions then map to the
// court through the camera (a ray onto the ground), and court points to the screen through the same camera. `gl` is null in 2D.
export const glHook = { gl: null };

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
    const P = { sc, f: 1, rot: false, cx: w / 2, cy: h / 2, cards: {}, btn: {}, auto: null, strip: null, msg: null, head: null, area: null };
    const g = 12;
    if (!land) {
      // the kit's preview pill sits at the top centre (safe inset + 6 css px, 1.7 x its font tall): the scoreboard starts below it
      const pillBottom = ins.t + 6 / px + 1.7 * Math.max(16, 11.5 / px) + 4;
      const top = ins.back ? Math.max(backBox.y + backBox.h + 4, pillBottom) : Math.max(ins.t + 10, tall ? 56 : 36, pillBottom);
      const cardH = tall ? 138 : h >= 1100 ? 118 : 104, stripH = Math.max(tall ? 52 : 44, Math.ceil(2 * minText * 1.26 + 14)), barH = Math.max(72, Math.round(46 / px));
      const head = cardH + 8 + (sc === 'auto' ? barH + 8 : 0) + stripH;
      const btnY = h - bottomPad - bh;
      const freeTop = top + head + 8, freeBot = btnY - 12, free = freeBot - freeTop;
      P.f = clamp(Math.min(free / FR, (U.w - 8) / CW), 0.4, 1.12);
      P.cx = ucx; P.cy = freeTop + free / 2;
      const cw = (U.w - 3 * g) / 2;
      P.cards = { H: R(U.x0 + g, top, cw, cardH), C: R(U.x0 + g * 2 + cw, top, cw, cardH) };
      const bar = R(U.x0 + g, top + cardH + 8, U.w - 2 * g, barH), inc = R(bar.x + bar.w - 8 - 84, bar.y + 4, 84, barH - 8), dec = R(inc.x - 8 - 84, bar.y + 4, 84, barH - 8);
      P.auto = { bar, inc, dec, label: { x: bar.x + 20, y: bar.y + bar.h / 2, align: 'left' }, think: { x: dec.x - 14, y: bar.y + bar.h / 2, align: 'right' } };
      P.strip = R(U.x0 + g, top + cardH + 8 + (sc === 'auto' ? barH + 8 : 0), U.w - 2 * g, stripH);
      const bw = Math.min(214, (U.w - 2 * g - 28) / 3), x0 = ucx - (3 * bw + 28) / 2, slot = (i) => R(x0 + (left ? 2 - i : i) * (bw + 14), btnY, bw, bh);
      P.btn = { menu: slot(0), hint: slot(1), act: slot(2) };
      P.area = R(U.x0, freeTop - 6, U.w, free + 12);
      P.head = R(U.x0, top, U.w, head);
    } else {
      const Lmin = 214, Rmin = 190;
      // Landscape: the field may be turned a quarter turn (my fort on the left) when that makes it clearly larger.
      const fUp = clamp(Math.min((U.h - 14) / FR, (U.w - Lmin - Rmin - 2 * g) / CW), 0.4, 1.12);
      const fTurn = clamp(Math.min((U.h - 14) / CW, (U.w - Lmin - Rmin - 2 * g) / FR), 0.4, 1.12);
      P.rot = fTurn > fUp * 1.08; P.f = P.rot ? fTurn : fUp;
      const bw = (P.rot ? FR : CW) * P.f, extra = U.w - bw - 2 * g;
      let Lw, Rw;
      if (extra / 2 >= Math.max(Lmin, Rmin)) Lw = Rw = Math.min(extra / 2, 380); else { const s2 = Math.max(0, (extra - Lmin - Rmin) / 2); Lw = Lmin + s2; Rw = Rmin + s2; }
      const gw = Lw + g + bw + g + Rw, x0 = U.x0 + (U.w - gw) / 2;
      P.cx = x0 + Lw + g + bw / 2; P.cy = (U.y0 + U.y1) / 2;
      const panelTop = (x) => (ins.back && x < backRight + 6 ? backBox.y + backBox.h + 4 : U.y0 + 8);
      const A = R(x0, 0, Lw, 0), B = R(x0 + Lw + g + bw + g, 0, Rw, 0);
      for (const p of [A, B]) { p.y = panelTop(p.x); p.h = U.y1 - 8 - p.y; }
      const info = left ? B : A, ctrl = left ? A : B;
      P.info = info; P.ctrl = ctrl; P.head = info;
      const stripH = 96, cardH = clamp((info.h - stripH - 16) / 2, 84, 150), cw = info.w - 8;
      P.cards = { H: R(info.x + 4, info.y, cw, cardH), C: R(info.x + 4, info.y + cardH + 8, cw, cardH) };
      P.strip = R(info.x + 4, info.y + 2 * cardH + 16, cw, stripH);
      const cwid = Math.min(ctrl.w - 16, 330), cxx = ctrl.x + (ctrl.w - cwid) / 2, hgap = 14, hdr = sc === 'auto' ? 110 : 0;
      const bhh = Math.min(bh, Math.floor((ctrl.h - 20 - hdr - 3 * hgap) / 3));
      const block = hdr + (hdr ? hgap : 0) + 3 * bhh + 2 * hgap;
      let y = ctrl.y + Math.max(0, (ctrl.h - block) / 2);
      if (sc === 'auto') {
        const dec = R(cxx, y + 38, 76, 64), inc = R(cxx + cwid - 76, y + 38, 76, 64);
        P.auto = { bar: R(cxx - 6, y - 4, cwid + 12, 114), dec, inc, label: { x: cxx + cwid / 2, y: y + 22, align: 'center' }, think: { x: cxx + cwid / 2, y: y + 38 + 32, align: 'center' } };
        y += hdr + hgap;
      }
      const slot = (i) => R(cxx, y + i * (bhh + hgap), cwid, bhh);
      P.btn = { menu: slot(0), hint: slot(1), act: slot(2) };
      const gm = 8; P.area = R(P.cx - bw / 2 - gm, U.y0, bw + 2 * gm, U.h);
    }
    // the toast shares the progress strip
    P.msg = P.strip;
    return P;
  }
  // convert pointer (screen) <-> canonical court space for a play scene
  // (a turned field: screen = centre + (-dy, dx) * f, so my fort, at the bottom of the court, sits on the left)
  const g3 = (P) => { const g = glHook.gl; return g && g.on && g.kind === P.sc ? g : null; };
  L.toCourt = (P, x, y) => (g3(P) ? g3(P).toCourt(x, y) : P.rot ? { x: CX + (y - P.cy) / P.f, y: CY - (x - P.cx) / P.f } : { x: CX + (x - P.cx) / P.f, y: CY + (y - P.cy) / P.f });
  L.toScreen = (P, X, Y) => (g3(P) ? g3(P).project(X, Y) : P.rot ? { x: P.cx - (Y - CY) * P.f, y: P.cy + (X - CX) * P.f } : { x: P.cx + (X - CX) * P.f, y: P.cy + (Y - CY) * P.f });

  // ================================================================ dialogs (result, lesson complete, solved, failed)
  const dialogs = {};
  L.dialog = (kind) => (dialogs[kind] ??= buildDialog(kind));
  function buildDialog(kind) {
    const bodyH = { inning: 170, over: 190 }[kind] ?? 150, nBtn = 2, extra = 44;
    const b1 = bh + 12, b2 = bh, gap = 14, btnsH = nBtn === 2 ? b1 + gap + b2 : b1;
    if (!land) {
      const dw = Math.min(U.w - 40, 620), dh = 24 + 86 + bodyH + 12 + btnsH + extra + 24;
      const x = ucx - dw / 2, y = clamp((U.y0 + U.y1) / 2 - dh / 2, U.y0 + 8, Math.max(U.y0 + 8, U.y1 - dh - 8));
      const bw = Math.min(dw - 80, 500), bx = x + (dw - bw) / 2, by = y + 24 + 86 + bodyH + 12;
      const btns = nBtn === 2 ? [R(bx, by, bw, b1), R(bx, by + b1 + gap, bw, b2)] : [R(bx, by, bw, b1)];
      return { panel: R(x, y, dw, dh), title: { x: x + dw / 2, y: y + 24 + 58 }, body: { x: x + dw / 2, y: y + 24 + 86 + 6, w: dw - 60, h: bodyH }, btns, extra: { x: x + dw / 2, y: by + btnsH + 34 }, land: false };
    }
    const dw = Math.min(U.w - 40, 900), lw = dw * 0.56, rw = dw - lw - 24;
    const dh = Math.max(24 + 86 + bodyH + 24, 24 + btnsH + extra + 24, 280);
    const x = ucx - dw / 2, y = clamp((U.y0 + U.y1) / 2 - dh / 2, U.y0 + 8, Math.max(U.y0 + 8, U.y1 - dh - 8));
    const bw = Math.min(rw - 24, 320), bx = x + lw + 12 + (rw - bw) / 2, by = y + (dh - btnsH - extra) / 2;
    const btns = nBtn === 2 ? [R(bx, by, bw, b1), R(bx, by + b1 + gap, bw, b2)] : [R(bx, by, bw, b1)];
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
    const sw = 110, sh = Math.max(60, Math.min(70, bh - 10)), inc = R(panel.x + panel.w - 16 - sw, panel.y + 14, sw, sh), dec = R(inc.x - 10 - sw, panel.y + 14, sw, sh);
    const viewport = R(panel.x + 24, panel.y + 14 + sh + 12, panel.w - 48 - 14, panel.h - (14 + sh + 12) - 44);
    const nw = Math.min(220, (pw - 28) / 3), nx = panel.x + (pw - (3 * nw + 28)) / 2;
    L.reader = {
      panel, viewport, dec, inc, title: { x: panel.x + 28, y: panel.y + 14 + sh / 2 }, counter: { x: panel.x + panel.w / 2, y: panel.y + panel.h - 16 },
      scrollbar: R(panel.x + panel.w - 22, viewport.y, 10, viewport.h), textW: Math.min(viewport.w - 4, 780), cx: viewport.x + viewport.w / 2,
      nav: { prev: R(nx, navY, nw, bh), back: R(nx + nw + 14, navY, nw, bh), next: R(nx + 2 * (nw + 14), navY, nw, bh) },
    };
  }

  // ================================================================ settings, the lesson list, the web-preview card
  {
    const doneW = Math.min(320, U.w - 80), done = R(ucx - doneW / 2, h - bottomPad - bh, doneW, bh);
    const hdrY = (ins.back && !land ? backBox.y + backBox.h : Math.max(ins.t, 0)) + (land ? 58 : 76), size = land ? 52 : 68;
    const aTop = Math.max(hdrY + 24, ins.back && land ? backBox.y + backBox.h + 6 : 0), aBot = done.y - (land ? 12 : 34), cols = land ? 2 : 1;
    const aw = Math.min(cols === 2 ? 920 : 600, U.w - 60), area = R(ucx - aw / 2, aTop, aw, aBot - aTop);
    L.settings = { title: { x: ucx, y: hdrY, size }, rows: grid(6, area, cols, 12, 104), done, note: { x: ucx, y: done.y - 12 }, noteFits: !land && aBot - aTop > 600 };
    L.demo = { title: { x: ucx, y: h * 0.3, size: land ? 50 : 60 }, body: { x: ucx, y: h * 0.3 + 70, w: Math.min(U.w - 80, 600) }, back: done };
  }

  // ================================================================ title
  const titles = {};
  L.title = (hasSave) => (titles[hasSave ? 1 : 0] ??= buildTitle(!!hasSave));
  function buildTitle(hasSave) {
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
    // Tap zone of the lockup: the lockup padded to >= 44 css px each way, never above the last button row (rowsBottom) or below limitY.
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
      const top = Math.max(ins.t + 6, 14), tsz = h >= 1100 ? 120 : 92;
      T.titleText = { x: ucx, y: top + tsz * 0.9, size: tsz }; T.tag = { x: ucx, y: top + tsz * 0.9 + 42, size: 28 };
      T.brand = { x: ucx, y: h - bottomPad - 8 - lkh / 2, w: lkw };
      T.lockTap = tapZone(T.brand, lkh, btnTop - gapV + unit * sumW, h);
      const heroTop = top + tsz * 0.9 + 42 + 14, zone = btnTop - 20 - heroTop;
      T.hero = { sc: clamp(Math.min(zone / FR, (U.w - 20) / CW), 0.3, 1), cx: ucx, cy: heroTop + zone / 2 };
      T.dim = R(0, btnTop - 14, w, h - btnTop + 14);
      return T;
    }
    const aw = clamp(U.w * 0.46, 420, 640), ax = U.x1 - aw - 16, card = R(ax, U.y0 + 8, aw, U.h - 16), pad = 16;
    const lkw = Math.min(aw - 2 * pad, Math.max(180, 125 / ins.px)), lkh = lkw * LK, strip = lkh + 20;
    const unit = Math.min(94, (card.h - 2 * pad - strip + gapV) / sumW);
    const by0 = card.y + pad + Math.max(0, (card.h - 2 * pad - strip + gapV - unit * sumW) / 2);
    place(ax + pad, aw - 2 * pad, by0, unit);
    T.card = card;
    const lx0 = Math.max(U.x0 + 8, backRight + 4), LW = ax - 8 - lx0, lcx = lx0 + LW / 2;
    const tsz = Math.min(110, (LW - 20) / 3.3), top = U.y0 + 10;
    T.titleText = { x: lcx, y: top + tsz * 0.85, size: tsz }; T.tag = { x: lcx, y: top + tsz * 0.85 + 36, size: 26 };
    T.brand = { x: ax + aw / 2, y: Math.min(card.y + card.h - pad - lkh / 2, by0 + unit * sumW - gapV + 10 + lkh / 2), w: lkw };
    T.lockTap = tapZone(T.brand, lkh, by0 + unit * sumW - gapV, card.y + card.h);
    const heroTop = top + tsz * 0.85 + 50, zone = U.y1 - 12 - heroTop;
    T.hero = { sc: clamp(Math.min(zone / FR, (LW - 16) / CW), 0.3, 1), cx: lcx, cy: heroTop + zone / 2 };
    return T;
  }
  return L;
}
