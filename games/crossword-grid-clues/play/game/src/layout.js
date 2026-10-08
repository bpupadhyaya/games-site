// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Every screen has a builder here; render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play   portrait : header, square grid, current clue, keyboard, tool row  (a clue list joins the grid's side when the screen is wide enough)
//          landscape A : clue list | grid | clue + keyboard panel
//          landscape B : grid | clue + keyboard panel   (the list opens from the tool row)
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button (main.js keeps it current); px = css px per unit

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
const insKey = () => `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${Math.round(host.px * 100)}`;
export function frame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const ins = { ...host }, U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 10, Math.max(ins.back, 56) + 10) : R(0, 0, 0, 0);
  return { w, h, ins, U, back, land: w >= h };
}

// ---- the grid ------------------------------------------------------------------------------------------------------------------
export function boardGeo(x, y, B, n) {
  const pad = Math.max(6, B * 0.022), cs = (B - 2 * pad) / n;
  const cells = Array.from({ length: n * n }, (_, i) => R(x + pad + (i % n) * cs, y + pad + Math.floor(i / n) * cs, cs, cs));
  const at = (px, py) => {
    const c = Math.floor((px - x - pad) / cs), r = Math.floor((py - y - pad) / cs);
    return c >= 0 && r >= 0 && c < n && r < n ? r * n + c : -1;
  };
  return { x, y, size: B, n, s: cs, pad, cells, at, rect: R(x, y, B, B) };
}

// A zoomed view of the same grid (phones with small squares): the frame stays put, the squares grow, (cx, cy) is the camera centre in
// square units. Everything that uses `cells` / `at` keeps working; `view` is the clip rect, `chip` the fit/zoom toggle.
export function zoomLevel(g) { const css = g.s * (host.px || 0.55); return clamp(46 / css, 1.45, 2.5); }
export function zoomSpan(g) { const z = zoomLevel(g), vw = g.size - 2 * g.pad; return { z, vw, hs: vw / (g.s * z) / 2 }; }
export function zoomGeo(g, cx, cy) {
  const { z, vw, hs } = zoomSpan(g), n = g.n, cs = g.s * z, vx = g.x + g.pad, vy = g.y + g.pad;
  const px = clamp(cx, hs, n - hs), py = clamp(cy, hs, n - hs);
  const ox = vx + vw / 2 - px * cs, oy = vy + vw / 2 - py * cs;
  const cells = Array.from({ length: n * n }, (_, i) => R(ox + (i % n) * cs, oy + Math.floor(i / n) * cs, cs, cs));
  const view = R(vx, vy, vw, vw);
  const at = (X, Y) => {
    if (X < vx || Y < vy || X >= vx + vw || Y >= vy + vw) return -1;
    const c = Math.floor((X - ox) / cs), r = Math.floor((Y - oy) / cs);
    return c >= 0 && r >= 0 && c < n && r < n ? r * n + c : -1;
  };
  return { ...g, s: cs, cells, at, view, zoomed: true, cam: { x: px, y: py }, hs };
}
export const zoomChip = (g) => { const d = Math.max(72, 44 / (host.px || 0.55)); return R(g.x + g.size - d - 6, g.y + g.size - d - 6, d, d); };

// ---- the keyboard --------------------------------------------------------------------------------------------------------------
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
export function kbGeo(r, g = 7) {
  const kw = (r.w - 9 * g) / 10, kh = (r.h - 2 * g) / 3, keys = {};
  for (let j = 0; j < 3; j++) {
    const row = ROWS[j], delW = j === 2 ? kw * 1.5 : 0, total = row.length * kw + (row.length - 1) * g + (j === 2 ? delW + g : 0);
    let x = r.x + (r.w - total) / 2;
    for (const ch of row) { keys[ch] = R(x, r.y + j * (kh + g), kw, kh); x += kw + g; }
    if (j === 2) keys.DEL = R(x, r.y + j * (kh + g), delW, kh);
  }
  return keys;
}

// ---- play ------------------------------------------------------------------------------------------------------------------------
export function playLayout(w, h, { coach = false, n = 9 } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${coach ? 1 : 0}|${n}`, () => buildPlay(frame(w, h), coach, n));
}
const TOOLS = ['undo', 'redo', 'pencil', 'check', 'reveal', 'hint', 'list'];

function buildPlay(F, coach, n) {
  const { U, back } = F, w = F.w, h = F.h, px = host.px || 0.55;
  const m = clamp(U.w * 0.02, 12, 26), g = 7;
  const kwMin = Math.max(24, 28 / px), Rmin = Math.round(10 * kwMin + 9 * g + 28);
  const L = { F, w, h, U, m, coach, back, n };

  // ---- portrait candidate
  const hudH = 78, hudTop = U.y0 + 6, bTop = hudTop + hudH + 6;
  const cw = Math.min(U.w - 2 * m, 800), cx = U.x0 + (U.w - cw) / 2;
  let pk = null;
  for (const kh of [84, 76, 68, 60, 54, 48]) {
    const clueH = kh > 60 ? 100 : 84, toolH = kh > 60 ? 64 : 56;
    const bottom = coach ? 330 : clueH + 8 + (3 * kh + 2 * g) + 8 + toolH + 6;
    const B = clamp(Math.min(U.w - 2 * m, U.y1 - bTop - bottom - 8), 120, 1200);
    pk = { kh, clueH, toolH, bottom, B };
    if (B >= (U.w - 2 * m) * 0.9 || kh === 48) break;
  }
  const Bp = pk.B;
  // spare height on tall screens goes to bigger keys, a roomier clue card and a little air above the controls
  let shift = 0;
  if (!coach) {
    const used = bTop + pk.B + 10 + pk.clueH + 8 + (3 * pk.kh + 2 * g) + 8 + pk.toolH + 6;
    let slack = Math.max(0, U.y1 - used - 8);
    const gk = Math.min(slack * 0.5 / 3, 24), gc = Math.min(slack * 0.2, 44), gt = Math.min(slack * 0.1, 14);
    pk.kh += gk; pk.clueH += gc; pk.toolH += gt; slack -= gk * 3 + gc + gt; shift = Math.min(slack * 0.4, 50);
  }
  // ---- landscape candidate
  const Hmax = U.h - 2 * m, Bl = clamp(Math.min(Hmax, U.w - Rmin - 3 * m), 120, 1200);
  const Lmin = Math.max(240, 170 / px), leftover = U.w - Bl - Rmin - 4 * m;
  const landscape = F.land && Bl >= Bp;

  if (!landscape) {
    L.mode = 'portrait';
    const B = Bp, by = bTop + shift;
    let bx = U.x0 + (U.w - B) / 2;
    const sideW = U.w - B - 3 * m;
    if (sideW >= Math.max(210, 160 / px) && B < (U.w - 2 * m) * 0.86) {
      bx = U.x0 + m;
      L.list = R(bx + B + m, by, U.x1 - m - (bx + B + m), B);
    }
    L.board = boardGeo(bx, by, B, n);
    const hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.hud = { title: { x: Math.max(U.x0 + m, hb), y: hudTop + 26 }, sub: { x: Math.max(U.x0 + m, hb), y: hudTop + 58 }, timer: { x: U.x0 + U.w / 2 + (back.w ? 30 : 0), y: hudTop + 56 }, mist: { x: U.x1 - m - 66 - 18, y: hudTop + 64 } };
    L.pause = R(U.x1 - m - 66, hudTop + 6, 66, 66);
    const top = by + B + 10;
    L.ctl = R(cx, top, cw, U.y1 - top - 8);
    if (coach) { L.coachR = L.ctl; } else {
      L.clue = R(cx, top, cw, pk.clueH);
      const kbTop = top + pk.clueH + 8, kbH = 3 * pk.kh + 2 * g;
      L.kb = R(cx, kbTop, cw, kbH);
      L.tools = toolRow(R(cx, kbTop + kbH + 8, cw, pk.toolH), !L.list);
    }
  } else {
    const hasList = leftover >= Lmin;
    L.mode = hasList ? 'A' : 'B';
    let Lw = 0, Rw, B = Bl;
    if (hasList) { Lw = clamp(leftover * 0.5, Lmin, 520); Rw = clamp(U.w - B - Lw - 4 * m, Rmin, 760); } else Rw = clamp(U.w - B - 3 * m, Rmin, 820);
    const groupW = (hasList ? Lw + m : 0) + B + m + Rw, gx0 = U.x0 + Math.max(m, (U.w - groupW) / 2);
    let x = gx0;
    const top = U.y0 + m, ph = U.h - 2 * m;
    if (hasList) { L.list = R(x, top, Lw, ph); L.listTop = top + (back.w ? back.h + 2 : 0) + 6; x += Lw + m; } else {
      // back button sits over the panel's top-left, so the panel (not the grid) goes on the left
    }
    let panelX;
    if (hasList) { L.board = boardGeo(x, U.y0 + (U.h - B) / 2, B, n); panelX = x + B + m; }
    else { panelX = x; L.board = boardGeo(x + Rw + m, U.y0 + (U.h - B) / 2, B, n); }
    const P = R(panelX, top, Rw, ph);
    L.panel = P;
    const pad = 14, ix = P.x + pad, iw = P.w - 2 * pad, edgeLeft = P.x <= U.x0 + 70;
    // header: row 1 = back-button space | free-preview badge | pause ; row 2 = title and squares left, timer right
    const hy = P.y + 8, r1 = 58, titleX = P.x + 18;
    L.pause = R(P.x + P.w - 14 - 58, hy, 58, 58);
    L.badgeAt = { x: P.x + P.w - 14 - 58 - 12, y: hy + 10 };
    L.hud = { title: { x: titleX, y: hy + r1 + 22 }, sub: { x: titleX, y: hy + r1 + 54 }, timer: { x: P.x + P.w - 18, y: hy + r1 + 30 }, mist: { x: P.x + P.w - 18, y: hy + r1 + 62 } };
    const iy = hy + r1 + 74, rest = P.y + P.h - iy - pad;
    if (coach) { L.coachR = R(P.x + pad, iy, iw, rest); L.ctl = L.coachR; } else {
      const toolH = clamp(rest * 0.1, 52, 66), kw = (iw - 9 * g) / 10;
      const kh = clamp(Math.min((rest - 130 - toolH - 20) / 3 - 3, kw * 1.35), 46, 96), kbH = 3 * kh + 2 * g;
      const kbTop = P.y + P.h - pad - toolH - 10 - kbH, free = kbTop - 10 - iy;   // height left for the clue card (and a list, if there is plenty)
      L.kb = R(ix, kbTop, iw, kbH);
      let clueH = free;
      if (!hasList && free >= 330) { clueH = clamp(free * 0.38, 150, 230); L.list = R(ix, iy + clueH + 10, iw, free - clueH - 10); L.listIn = true; }
      else clueH = clamp(free, 90, 420);
      L.clue = R(ix, iy, iw, clueH);
      L.tools = toolRow(R(ix, P.y + P.h - pad - toolH, iw, toolH), !(hasList || L.listIn));
    }
  }
  // the hint card and the Watch and Learn rail share the controls area
  const C = L.coachR ?? L.ctl ?? L.clue, bh = 62, ip = 12;
  if (C) {
    L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
    const wide = C.w >= 560, rh = wide ? bh : bh * 2 + 10;
    const rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 10);
    L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
    L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 12 - ip);
  }
  if (L.clue) {
    const c = L.clue, bw = Math.min(64, c.h * 0.6, c.w * 0.14);
    L.clueNav = { prev: R(c.x + 8, c.y + (c.h - bw) / 2, bw, bw), next: R(c.x + c.w - 8 - bw, c.y + (c.h - bw) / 2, bw, bw) };
    L.clueText = R(c.x + bw + 20, c.y + 6, c.w - 2 * bw - 40, c.h - 12);
    if (c.h >= 190) { const t = L.clueText, cut = Math.round(t.h * 0.56); L.clueMain = R(t.x, t.y, t.w, cut); L.clueCross = R(t.x, t.y + cut + 6, t.w, t.h - cut - 6); } else L.clueMain = L.clueText;
  }
  if (L.kb) L.keys = kbGeo(L.kb, g);
  return L;
}
function toolRow(r, withList) {
  const ids = withList ? TOOLS : TOOLS.filter((t) => t !== 'list'), cells = grid(r, ids.length, 1, 8), t = { ids };
  ids.forEach((id, i) => { t[id] = cells[i]; });
  return t;
}
// Small pop-up menu (Check / Reveal) above a tool button.
export function popLayout(L, anchor, count) {
  const U = L.U, bw = Math.min(300, U.w - 24), bh = 60, gap = 8, total = count * (bh + gap) + gap;
  const x = clamp(anchor.x + anchor.w / 2 - bw / 2, U.x0 + 12, U.x1 - 12 - bw), y = clamp(anchor.y - total - 8, U.y0 + 8, U.y1 - total - 8);
  return { card: R(x, y, bw, total), items: Array.from({ length: count }, (_, i) => R(x + 10, y + gap + i * (bh + gap), bw - 20, bh)) };
}

// ---- the clue list ---------------------------------------------------------------------------------------------------------------
// One scrolling column: a heading row, then clue rows of fixed height (two text lines). Pure geometry so taps and drawing agree.
export function listRows(pz) {
  const rows = [{ k: 'head', label: 'Across' }];
  let down = false;
  for (const id of pz.order) {
    if (!down && pz.slots[id].dir === 1) { rows.push({ k: 'head', label: 'Down' }); down = true; }
    rows.push({ k: 'clue', id });
  }
  return rows;
}
export function listGeo(rect, pz, fs) {
  const rowH = Math.round(fs * 2.55 + 12), headH = Math.round(fs * 1.7);
  const rows = listRows(pz), pos = [];
  let y = 0;
  for (const r of rows) { const hgt = r.k === 'head' ? headH : rowH; pos.push({ ...r, y, h: hgt }); y += hgt; }
  return { rect, rows: pos, total: y, rowH, headH };
}
export function cluesScreen(w, h) {
  return memo(`clues|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    return P;
  });
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['new', 'daily']), sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 20);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 96);
      T.brand = { x: cx + cw / 2, y: U.y1 - 40 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 96 + 16 + 3 * 74 + 10 + 80;
      const heroH = clamp(U.h - need - 100, 200, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 100);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 40 };
    }
    const pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 3) * 1.18, 70, 132), sH = clamp(pH * 0.74, 54, 100);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const gg = grid(R(col.x, y, col.w, 3 * sH + 20), 2, 3, 10);
    sec.forEach((id, i) => { T.buttons[id] = gg[i]; });
    return T;
  });
}

// ---- generic header + scrolling body used by the text/list screens ------------------------------------------------------------------
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
export function settingsLayout(w, h, scale, nRows) {
  return memo(`set|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${nRows}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(98 * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
    P.rows = []; P.cols = cols;
    for (let i = 0; i < nRows; i++) {
      const c = i % cols, r = Math.floor(i / cols), rect = R(P.body.x + c * (cw + gap), P.body.y + r * (rowH + gap), cw, rowH);
      const frac = cw < 800 ? ({ 0: 0.8 }[i] ?? 0.5) : 0.5, ctrlW = Math.min(cw * (scale > 1.6 ? Math.max(frac, 0.6) : frac), 560), ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 14, ctrlW, rect.h - 28);
      P.rows.push({ rect, ctrl });
    }
    P.contentH = Math.ceil(nRows / cols) * (rowH + gap);
    return P;
  });
}
export function newLayout(w, h, nCards) {
  return memo(`new|${Math.round(w)}x${Math.round(h)}|${insKey()}|${nCards}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const cols = P.body.w >= 1500 ? 3 : P.body.w >= 780 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols, rows = Math.ceil(nCards / cols), ch = clamp((P.body.h - gap * (rows - 1)) / rows, cols === 1 ? 128 : 140, 200);
    P.cards = []; P.cols = cols;
    for (let i = 0; i < nCards; i++) P.cards.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(nCards / cols) * (ch + gap);
    return P;
  });
}
export function statsLayout(w, h) {
  return memo(`stats|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    return P;
  });
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h, scale = 1, n = 9) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${n}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const bh = F.land && U.w > U.h * 1.05 ? 66 : 76, wide = F.land && U.w > U.h * 1.05;
    O.wide = wide;
    if (wide) {
      const bs = Math.min(U.h - 2 * m - 20, U.w * 0.42) * (scale > 2 ? 0.8 : 1);
      O.board = boardGeo(U.x0 + m + 6, U.y0 + (U.h - bs) / 2, bs, n);
      const cx = O.board.x + bs + 36, cw = U.x1 - m - cx;
      O.btns = { next: R(cx, U.y1 - m - 2 * (bh + 12) - 24, cw, bh) };
      O.btns.share = R(cx, O.btns.next.y + bh + 12, cw / 2 - 6, bh); O.btns.menu = R(cx + cw / 2 + 6, O.btns.next.y + bh + 12, cw / 2 - 6, bh);
      O.more = { x: cx + cw / 2, y: U.y1 - m - 8 };
      O.body = R(cx, U.y0 + m, cw, O.btns.next.y - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const bs = clamp(Math.min(cw * 0.8, U.h * 0.34) * (scale <= 1 ? 1 : scale <= 1.5 ? 0.8 : scale <= 2 ? 0.6 : 0.42), 100, 520);
      O.board = boardGeo(U.x0 + (U.w - bs) / 2, U.y0 + 14 + (F.ins.back ? 44 : 0), bs, n);
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.board.y + bs + 10, cw, by - 12 - (O.board.y + bs + 10));
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 14 };
    }
    return O;
  });
}

// ---- small overlays -----------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h, board) {
  const b = board, cw = Math.min(b.size - 24, 520), nb = 4, bh = Math.max(44, Math.min(78, (b.size - 24 - 80) / nb - 12)), ch = nb * (bh + 12) + 80;
  const card = R(b.x + (b.size - cw) / 2, b.y + (b.size - ch) / 2, cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

// The play layout with the zoom applied (game.js and view.js both use it, so taps and drawing agree).
export function playLayoutZ(w, h, opts, st) {
  const l = { ...playLayout(w, h, opts) }, g = l.board, css = g.s * (host.px || 0.55);
  l.fit = g; l.chipShow = css < 36; l.zoomOn = st.zoomUser ?? css < 32;
  if (l.zoomOn) l.board = zoomGeo(g, st.cam.x, st.cam.y);
  if (l.chipShow) l.chip = zoomChip(g);
  return l;
}
