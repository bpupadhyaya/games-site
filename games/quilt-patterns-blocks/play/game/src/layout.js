// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Every screen has a builder here; render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play  stacked  (tall phone, portrait tablet): header, board on its mat, rules card, tray, tools
//         side     (4:3 landscape, squarish portrait): board | panel with header, rules, tray, tools
//         three    (wide landscape): header+rules | board | tray+tools
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button (main.js keeps it current)

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const grid = (r, cols, rows, gx, gy = gx) => {
  const w = (r.w - gx * (cols - 1)) / cols, h = (r.h - gy * (rows - 1)) / rows, out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push(R(r.x + i * (w + gx), r.y + j * (h + gy), w, h));
  return out;
};
const cache = new Map();
function memo(key, f) {
  let v = cache.get(key);
  if (!v) { v = f(); cache.set(key, v); if (cache.size > 160) cache.delete(cache.keys().next().value); }
  return v;
}
const insKey = () => `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
export function frame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const ins = { ...host }, U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 10, Math.max(ins.back, 56) + 10) : R(0, 0, 0, 0);
  return { w, h, ins, U, back, land: w >= h };
}

// ---- the tray: swatches (and, for quilts, tabs, width chips, tiles) --------------------------------------------------------------
// opts: kind 'block'|'quilt', n (swatches), tab ('tiles'|'sash'|'border'), nTiles
function trayGeo(r, o) {
  const T = { rect: r, tabs: null, chips: null, items: [] }, g = 8;
  let y = r.y;
  if (o.kind === 'quilt') {
    const th = clamp(r.h * 0.17, 46, 60);
    T.tabs = grid(R(r.x, y, r.w, th), 3, 1, g); y += th + g;
    if (o.tab !== 'tiles') { const ch = clamp(r.h * 0.15, 42, 54); T.chips = grid(R(r.x, y, r.w, ch), 3, 1, g); y += ch + g; }
  }
  const body = R(r.x, y, r.w, Math.max(30, r.y + r.h - y));
  const count = o.kind === 'quilt' && o.tab === 'tiles' ? o.nTiles : o.n;
  const cols = clamp(Math.round(body.w / (count > 10 ? 76 : 98)), 3, 6), rows = Math.ceil(count / cols);
  const w = (body.w - g * (cols - 1)) / cols, h = clamp((body.h - g * (rows - 1)) / rows, 40, 112);
  for (let i = 0; i < count; i++) T.items.push(R(body.x + (i % cols) * (w + g), body.y + Math.floor(i / cols) * (h + g), w, h));
  T.cols = cols; T.rows = rows; T.itemH = h;
  return T;
}
function trayNeed(w, o) {
  const g = 8, count = o.kind === 'quilt' && o.tab === 'tiles' ? o.nTiles : o.n, cols = clamp(Math.round(w / (count > 10 ? 76 : 98)), 3, 6), rows = Math.ceil(count / cols);
  const sh = clamp(((w - g * (cols - 1)) / cols) * 0.78, 50, 96);
  return (o.kind === 'quilt' ? 60 + g + 54 + g : 0) + rows * sh + (rows - 1) * g;
}

export function playLayout(w, h, o = {}) {
  const key = `play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${o.kind}|${o.n}|${o.tab}|${o.nTiles}|${o.coach ? 1 : 0}|${o.hand}|${o.nCons}|${o.studio ? 1 : 0}|${o.nTools}`;
  return memo(key, () => buildPlay(frame(w, h), o));
}
function buildPlay(F, o) {
  const { U, back } = F, w = F.w, h = F.h, m = clamp(U.w * 0.02, 12, 24), g = 10, lefty = o.hand === 'left';
  const quilt = o.kind === 'quilt', nTools = o.nTools ?? 5;
  const hudH = 84, toolsH = 78, briefMin = o.coach ? 260 : clamp(70 + (o.nCons || 1) * 52, 130, 330);
  const L = { F, w, h, U, m, back, quilt };
  // candidate sizes of the mat (the square the block or quilt sits on)
  const sideW = clamp(U.w * 0.36, 310, 470), threeL = clamp(U.w * 0.22, 250, 360), threeR = clamp(U.w * 0.28, 440, 480);
  const Mp = Math.min(U.w - 2 * m, U.y1 - (U.y0 + 6 + hudH) - 2 * g - toolsH - briefMin - trayNeed(U.w - 2 * m, o) - 12);
  const Ms = Math.min(U.h - 2 * m, U.w - sideW - 3 * m), Mt = Math.min(U.h - 2 * m, U.w - threeL - threeR - 4 * m);
  let mode = 'stacked', M = Mp;
  if (F.land || Mp < U.w * 0.64) {
    if (Mt >= 0.9 * Math.max(Ms, 1) && Mt >= Mp * 1.05 && F.land) { mode = 'three'; M = Mt; } else if (Ms >= Mp * 1.05) { mode = 'side'; M = Ms; }
  }
  M = clamp(M, 220, 1400);
  L.mode = mode; L.M = M;
  const hb = U.x0 + (back.w ? back.w + 4 : 0);
  if (mode === 'stacked') {
    const hudTop = U.y0 + 6, my = hudTop + hudH + g, mx = U.x0 + (U.w - M) / 2;
    L.mat = R(mx, my, M, M);
    L.hud = { x: Math.max(U.x0 + m, hb), y: hudTop, w: U.w - 2 * m - 80 - Math.max(0, hb - U.x0 - m), h: hudH };
    L.pause = R(U.x1 - m - 66, hudTop + 8, 66, 66);
    const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2, top = my + M + g;
    const toolsY = U.y1 - toolsH - 8, trayH = trayNeed(cw, o), trayY = toolsY - g - trayH;
    L.tools = R(cx, toolsY, cw, toolsH); L.trayR = R(cx, trayY, cw, trayH);
    L.brief = R(cx, top, cw, Math.max(100, trayY - g - top));
  } else {
    const gm = m * 1.4;
    if (mode === 'side') {
      const Pw = sideW, groupW = M + Pw + gm, gx = U.x0 + Math.max(m, (U.w - groupW) / 2), my = U.y0 + (U.h - M) / 2;
      const mx = lefty ? gx + Pw + gm : gx, px = lefty ? gx : gx + M + gm;
      L.mat = R(mx, my, M, M);
      const py = U.y0 + m, ph = U.h - 2 * m, pTop = back.w && px <= U.x0 + 60 ? Math.max(py, back.y + back.h - 2) : py;
      L.hud = { x: px, y: pTop, w: Pw - 76, h: hudH - 14 }; L.pause = R(px + Pw - 66, pTop + 4, 66, 66);
      const toolsY = py + ph - toolsH, trayH = trayNeed(Pw, o), trayY = toolsY - g - trayH, briefY = pTop + hudH - 6;
      L.tools = R(px, toolsY, Pw, toolsH); L.trayR = R(px, trayY, Pw, trayH); L.brief = R(px, briefY, Pw, Math.max(90, trayY - g - briefY));
    } else {
      const groupW = threeL + M + threeR + 2 * gm, gx = U.x0 + Math.max(m, (U.w - groupW) / 2), my = U.y0 + (U.h - M) / 2;
      const lx = lefty ? gx + M + threeR + 2 * gm : gx, rx = lefty ? gx : gx + threeL + M + 2 * gm, mx = gx + (lefty ? threeR : threeL) + gm;
      L.mat = R(mx, my, M, M);
      const py = U.y0 + m, ph = U.h - 2 * m, pTop = back.w && lx <= U.x0 + 60 ? Math.max(py, back.y + back.h - 2) : py;
      L.hud = { x: lx, y: pTop, w: threeL - 76, h: hudH - 14 }; L.pause = R(lx + threeL - 66, pTop + 4, 66, 66);
      L.brief = R(lx, pTop + hudH - 6, threeL, Math.max(120, py + ph - (pTop + hudH - 6)));
      const toolsY = py + ph - toolsH, trayH = trayNeed(threeR, o);
      L.tools = R(rx, toolsY, threeR, toolsH); L.trayR = R(rx, Math.max(py, toolsY - g - trayH), threeR, trayH);
    }
  }
  L.pad = M * 0.05;
  L.board = R(L.mat.x + L.pad, L.mat.y + L.pad, M - 2 * L.pad, M - 2 * L.pad);
  L.tray = trayGeo(L.trayR, o);
  const tl = grid(L.tools, nTools, 1, 8);
  L.toolRects = tl;
  // hint card / Watch and Learn card take over the rules area (and grow downwards into the tray when the area is short)
  const C = o.coach && L.brief.h < 250 ? R(L.brief.x, L.brief.y, L.brief.w, Math.min(280, L.trayR.y + L.trayR.h - L.brief.y)) : L.brief;
  const bh = 62, ip = 12;
  L.coachR = C;
  L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
  const wide = C.w >= 540, rh = wide ? bh : bh * 2 + 10, rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 10);
  L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
  L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 12 - ip);
  // the studio block chooser lives at the top of the rules area
  L.typeBar = R(L.brief.x, L.brief.y, L.brief.w, 56);
  L.typePrev = R(L.typeBar.x, L.typeBar.y, 70, 56); L.typeNext = R(L.typeBar.x + L.typeBar.w - 70, L.typeBar.y, 70, 56);
  return L;
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['play', 'daily']), sec = ['studio', 'gallery', 'learn', 'stats', 'howto', 'rules', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 60);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 92 + 16 + 4 * 70 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 190, 600);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 4) * 1.15, 62, 128), sH = clamp(pH * 0.72, 48, 96);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 4 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const gr = grid(R(col.x, y, col.w, 4 * sH + 30), 2, 4, 10);
    sec.forEach((id, i) => { T.buttons[id] = gr[i]; });
    return T;
  });
}

// ---- generic header + scrolling body used by the text/list screens -------------------------------------------------------------------
export function pageLayout(w, h, { footer = 0 } = {}) {
  return memo(`page|${Math.round(w)}x${Math.round(h)}|${insKey()}|${footer}`, () => {
    const F = frame(w, h), { U, back } = F, m = clamp(U.w * 0.025, 14, 36);
    const hdrTop = U.y0 + 8, hdrH = 70, maxW = Math.min(U.w - 2 * m, 1500);
    const x0 = U.x0 + (U.w - maxW) / 2;
    const P = { F, m, maxW, x0 };
    P.titleX = Math.max(x0, back.w ? U.x0 + back.w + 4 : x0);
    P.header = R(x0, hdrTop, maxW, hdrH);
    P.textDec = R(U.x1 - m - 2 * 74 - 8, hdrTop + 4, 74, 62); P.textInc = R(U.x1 - m - 74, hdrTop + 4, 74, 62);
    const fh = footer ? 78 : 0;
    P.footer = R(x0, U.y1 - fh - 8, maxW, fh);
    P.body = R(x0, hdrTop + hdrH + 8, maxW, U.y1 - 8 - fh - (hdrTop + hdrH + 8) - (footer ? 8 : 0));
    return P;
  });
}
export function docLayout(w, h) {
  return memo(`doc|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer, bw = Math.min(190, f.w * 0.22);
    P.menu = R(f.x, f.y, bw, f.h); P.prev = R(f.x + f.w - 2 * bw - 14 - Math.min(150, f.w * 0.16), f.y, bw, f.h);
    P.count = R(P.prev.x + bw + 7, f.y, Math.min(150, f.w * 0.16), f.h); P.next = R(f.x + f.w - bw, f.y, bw, f.h);
    P.split = P.F.land && P.F.U.w >= 880;
    if (P.split) { const lw = clamp(P.body.w * 0.44, 380, 760); P.fig = R(P.body.x, P.body.y, lw, P.body.h); P.text = R(P.body.x + lw + 20, P.body.y, P.body.w - lw - 20, P.body.h); }
    else { P.fig = null; P.text = P.body; }
    return P;
  });
}
export function backFooter(w, h) {
  return memo(`bf|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => { const P = { ...pageLayout(w, h, { footer: 1 }) }; const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h); return P; });
}
export function settingsLayout(w, h, scale, nRows) {
  return memo(`set|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${nRows}`, () => {
    const P = { ...backFooter(w, h) };
    const cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(98 * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
    P.rows = []; P.cols = cols;
    for (let i = 0; i < nRows; i++) {
      const c = i % cols, r = Math.floor(i / cols), rect = R(P.body.x + c * (cw + gap), P.body.y + r * (rowH + gap), cw, rowH);
      const frac = cw < 800 ? ({ 0: 0.8, 2: 0.68 }[i] ?? 0.54) : 0.5, ctrlW = Math.min(cw * (scale > 1.6 ? Math.max(frac, 0.6) : frac), 560), ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 14, ctrlW, rect.h - 28);
      P.rows.push({ rect, ctrl });
    }
    P.contentH = Math.ceil(nRows / cols) * (rowH + gap);
    return P;
  });
}
// pick list: group headings and cards, scrolling
export function pickLayout(w, h, items, scale = 1) {
  return memo(`pick|${Math.round(w)}x${Math.round(h)}|${insKey()}|${items.map((i) => i.t).join('')}|${scale}`, () => {
    const P = { ...backFooter(w, h) };
    const cols = P.body.w >= 1500 ? 3 : P.body.w >= 760 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols, ch = clamp(118 * (1 + (scale - 1) * 0.45), 110, 250), hh = 54 * (1 + (scale - 1) * 0.3);
    P.rects = []; let y = 0, col = 0;
    for (const it of items) {
      if (it.t === 'h') { if (col) { y += ch + gap; col = 0; } P.rects.push(R(P.body.x, P.body.y + y, P.body.w, hh)); y += hh + 4; }
      else { P.rects.push(R(P.body.x + col * (cw + gap), P.body.y + y, cw, ch)); col += 1; if (col >= cols) { col = 0; y += ch + gap; } }
    }
    if (col) y += ch + gap;
    P.contentH = y;
    return P;
  });
}
export function galleryLayout(w, h, n, scale = 1) {
  return memo(`gal|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}|${scale}`, () => {
    const P = { ...backFooter(w, h) };
    const cols = clamp(Math.floor((P.body.w + 14) / 230), 2, 5), gap = 14, cw = (P.body.w - gap * (cols - 1)) / cols, ch = cw + 52;
    P.cards = []; for (let i = 0; i < n; i++) P.cards.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(n / cols) * (ch + gap);
    return P;
  });
}
// A single big picture with a few buttons (result screen, gallery viewer).
export function showLayout(w, h, nBtn = 3) {
  return memo(`show|${Math.round(w)}x${Math.round(h)}|${insKey()}|${nBtn}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F }, bh = 70;
    if (F.land && U.w > U.h * 1.1) {
      const S = Math.min(U.h - 2 * m, U.w * 0.5), px = U.x0 + m + 6;
      O.pic = R(px, U.y0 + (U.h - S) / 2, S, S);
      const cx = px + S + 40, cw = U.x1 - m - cx;
      O.btns = Array.from({ length: nBtn }, (_, i) => R(cx, U.y1 - m - (nBtn - i) * (bh + 12) + 12, cw, bh));
      O.body = R(cx, U.y0 + m + (F.ins.back ? 20 : 0), cw, O.btns[0].y - 12 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 680), cx = U.x0 + (U.w - cw) / 2;
      const by = U.y1 - m - nBtn * (bh + 12) + 12;
      const S = clamp(Math.min(cw * 0.86, U.h * 0.42), 160, 640);
      O.pic = R(U.x0 + (U.w - S) / 2, U.y0 + 16 + (F.ins.back ? 44 : 0), S, S);
      O.btns = Array.from({ length: nBtn }, (_, i) => R(cx, by + i * (bh + 12), cw, bh));
      O.body = R(cx, O.pic.y + S + 14, cw, by - 12 - (O.pic.y + S + 14));
    }
    return O;
  });
}
export function pauseLayout(w, h, mat) {
  const cw = Math.min(mat.w - 30, 520), n = 4, bh = Math.max(46, Math.min(74, (mat.h - 24 - 80) / n - 12)), ch = n * (bh + 12) + 80;
  const card = R(mat.x + (mat.w - cw) / 2, mat.y + (mat.h - ch) / 2, cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

export const toolsFor = (ch) => (ch.kind === 'block' ? ['undo', 'redo', 'role', 'squint', 'hint'] : ['undo', 'redo', 'rotate', 'squint', 'hint']).concat(ch.mode === 'studio' ? ['save'] : []);
export const playOpts = (s) => ({ kind: s.ch.kind, n: s.ch.tray.length, tab: s.tab, nTiles: s.ch.tiles?.length ?? 0, coach: !!(s.hint || s.auto.on), hand: s.prefs.hand, nCons: s.ch.cons.length, studio: s.ch.mode === 'studio', nTools: toolsFor(s.ch).length });
