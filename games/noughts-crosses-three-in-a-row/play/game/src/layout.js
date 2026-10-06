// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data, a function of the LIVE screen size
// (kit 1.7 fluid viewport: the short side is always 720 units, the long side follows the aspect ratio).
//   layoutFor(w, h)          -> L: the safe area, the top-left buttons, the document screens, the overlay card
//   playLayout(L, scale)     -> the play screen (board, player plates, status, toolbar) for text-zoom step `scale` (1..3)
//   autoLayout(L, scale)     -> the Watch & Learn controls
// Shapes: `tall` / `compact` = portrait (the approved phone look; shorter screens shrink the chrome), `wide` = landscape
// (side columns round a bigger board). The result is cached per size + safe-area key; never read module-level W / H.
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];

// Safe areas (notch, home indicator) and the host's floating back button, in virtual units. main.js keeps this current.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();

export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const land = w >= h, wide = land && w >= h * 1.2, mode = wide ? 'wide' : h >= 1540 ? 'tall' : 'compact';
  const L = { w, h, land, wide, mode, ins };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  // the phone-shaped column (720 wide) for portrait-style screens; squarish windows centre it
  L.ox = wide ? 0 : Math.max(0, (w - 720) / 2);
  L.colL = wide ? U.x0 : Math.max(U.x0, L.ox);
  L.colR = wide ? U.x1 : Math.min(U.x1, L.ox + 720);
  L.top = Math.max(22, U.y0 + 6);
  // x where our own top-left button starts: clear of the host's floating back button
  L.leftX = ins.back ? Math.max(L.colL + 16, ins.l + backSz + 14) : L.colL + 16;
  L.bm = Math.max(28, ins.b + 10);

  // ---- document screens (setup, learn, rules, how to play, about, settings) ----
  const barY = Math.max(20, U.y0 + 8), barH = 76, D = {};
  D.back = R(L.leftX, barY, 140, barH);
  const pctW = wide ? 100 : 140, pgap = wide ? 8 : 0;
  D.inc = R(L.colR - 16 - 84, barY, 84, barH);
  D.pct = R(D.inc.x - pgap - pctW, barY, pctW, barH);
  D.dec = R(D.pct.x - pgap - 84, barY, 84, barH);
  if (!wide) {
    const pw = L.colR - L.colL - 48, navY = h - Math.max(26, ins.b + 10) - 84;
    D.panel = R(L.colL + 24, barY + 92, pw, navY - 16 - (barY + 92));
    D.body = R(D.panel.x + 24, D.panel.y + 24, pw - 48, D.panel.h - 48);
    D.bodyNav = R(D.body.x, D.body.y, D.body.w, Math.max(120, D.body.h - 84));
    D.start = R(D.panel.x, h - Math.max(24, ins.b + 8) - 96, pw, 96);
    D.bodyStart = R(D.body.x, D.body.y, D.body.w, Math.max(120, D.body.h - 94));
    D.prev = R(D.panel.x, navY, 210, 84);
    D.next = R(D.panel.x + pw - 210, navY, 210, 84);
    D.navLabel = { x: (L.colL + L.colR) / 2, y: navY + 50 };
  } else {
    const pw = Math.min(U.w - 48, 1000), px = U.x0 + (U.w - pw) / 2, py = barY + 92;
    D.panel = R(px, py, pw, Math.max(200, U.y1 - Math.max(16, ins.b) - 8 - py));
    D.body = R(px + 24, py + 24, pw - 48, D.panel.h - 48);
    D.bodyNav = D.body; D.bodyStart = D.body;
    // nav / start sit in the top bar, centred in the free stretch between Back and the text-size group
    const free0 = D.back.x + D.back.w + 8, free1 = D.dec.x - 8, free = free1 - free0;
    const nw = clamp((free - 86) / 2, 96, 150), gw = nw * 2 + 86, gx = free0 + (free - gw) / 2;
    D.prev = R(gx, barY, nw, barH); D.next = R(gx + nw + 86, barY, nw, barH);
    D.navLabel = { x: gx + nw + 43, y: barY + 48 };
    const sw = clamp(free, 160, 320); D.start = R(free0 + (free - sw) / 2, barY, sw, barH);
  }
  L.doc = D;

  // ---- overlay card: portrait = one column, landscape = text left, buttons right ----
  const ow = wide ? Math.min(U.w - 48, 900) : clamp(L.colR - L.colL - 100, 300, 620);
  L.card = { w: ow, cx: (U.x0 + U.x1) / 2, cy: (U.y0 + U.y1) / 2, maxH: Math.max(300, U.h - 32), wide };
  return L;
}

// ---------------------------------------------------------------------------------------------- play screen
const pcache = new Map();
export function playLayout(L, scale) {
  const key = `${L.key}|${scale}`;
  let P = pcache.get(key);
  if (!P) { P = L.wide ? playWide(L, scale) : playPortrait(L, scale); P.key = key; pcache.set(key, P); if (pcache.size > 60) pcache.delete(pcache.keys().next().value); }
  return P;
}

function playPortrait(L, scale) {
  const k = clamp((scale - 1) / 2, 0, 1), ox = L.ox, h = L.h;
  const T = L.top, gap = 18;
  const kp = Math.max(0.05, host.px), badgeB = host.t + 6 / kp + 1.7 * Math.max(16, 11.5 / kp), dT = Math.max(0, Math.round(badgeB + 32 - (T + 36)));   // the title clears the kit's preview badge
  const top = T + 94 + dT;
  let chipH, statusH, toolH, toolY, bottom, side;
  for (const f of [1, 0.88, 0.78, 0.7]) {
    chipH = Math.round((104 + 70 * k) * f); statusH = Math.round((150 + 150 * k) * f); toolH = Math.max(84, Math.round((112 + 74 * k) * f));
    toolY = h - L.bm - toolH; bottom = toolY - 18;
    side = clamp(bottom - top - chipH - statusH - gap * 2 - 24, 200, 672);
    if (side >= 470) break;
  }
  const total = chipH + gap + side + gap + statusH;
  const y0 = Math.round(top + (bottom - top - total) * 0.4);
  const boardY = y0 + chipH + gap;
  const back = R(L.leftX, T, 84, 78), pause = R(L.colR - 16 - 84, T, 84, 78);
  return {
    mode: 'portrait', wide: false, hudPause: true, back, pause,
    title: { x: (back.x + back.w + pause.x) / 2, y: T + 36 + dT, w: Math.max(200, Math.min(480, pause.x - back.x - back.w - 24)), sub: T + 74 + dT, align: 'center' },
    chips: [R(ox + 24, y0, 330, chipH), R(ox + 366, y0, 330, chipH)],
    board: { x: Math.round(ox + (720 - side) / 2), y: boardY, side },
    status: R(ox + 24, boardY + side + gap, 672, statusH),
    tool: [0, 1, 2].map((i) => R(ox + 24 + i * 232, toolY, 216, toolH)),
    badge: null,
  };
}

function playWide(L, scale) {
  const { U } = L, k = clamp((scale - 1) / 2, 0, 1), g = 14, pad = 16;
  const colTop = U.y0 + pad, colBot = U.y1 - pad, colH = colBot - colTop;
  const bh = colH - 24;   // the board slab has depth below it
  const free3 = U.w - bh - 2 * pad - 2 * g, three = free3 >= 540;
  let S, Lw, Rw = 0, gx;
  if (three) { S = bh; Lw = Rw = Math.min(free3 / 2, 460); gx = U.x0 + (U.w - (Lw + g + S + g + Rw)) / 2; }
  else { S = Math.max(200, Math.min(bh, U.w - 2 * pad - g - 300)); Lw = Math.min(U.w - 2 * pad - g - S, 440); gx = U.x0 + (U.w - (Lw + g + S)) / 2; }
  gx = Math.max(gx, U.x0 + pad);
  const bx = gx + Lw + g, by = colTop + (bh - S) / 2 + 4, rx = bx + S + g;
  const backX = Math.max(gx, L.ins.back ? L.ins.l + Math.max(L.ins.back, 56) + 14 : gx);
  const back = R(backX, colTop, 84, 78);
  const title = { x: back.x + back.w + 14, y: colTop + 34, w: Math.max(100, gx + Lw - (back.x + back.w + 14)), sub: colTop + 66, align: 'left' };
  // plates, status and (two columns) the 2x2 button grid share the column height; shrink the plates and buttons until the status fits
  let chipH, toolH;
  for (let f = 1; f >= 0.65; f -= 0.1) {
    chipH = Math.round((92 + 60 * k) * f); toolH = Math.round((92 + 44 * k) * f);
    const left = colH - 78 - g - 2 * chipH - 2 * g - (three ? 0 : 2 * toolH + g);
    if (left >= 130) break;
  }
  const chips = [R(gx, colTop + 78 + g, Lw, chipH), R(gx, colTop + 78 + g + chipH + g, Lw, chipH)];
  const statusY = chips[1].y + chipH + g;
  if (!three) {
    const hw = (Lw - g) / 2, y1 = colBot - 2 * toolH - g, y2 = colBot - toolH;
    return {
      mode: 'wide2', wide: true, hudPause: false, back, title, chips, board: { x: bx, y: by, side: S }, badge: null,
      status: R(gx, statusY, Lw, Math.max(80, y1 - g - statusY)),
      tool: [R(gx, y1, hw, toolH), R(gx + hw + g, y1, hw, toolH), R(gx, y2, hw, toolH)], pause: R(gx + hw + g, y2, hw, toolH),
    };
  }
  const th = clamp((colH - 3 * g - 96) / 4, 70, 130 + 20 * k);
  const tool = [0, 1, 2].map((i) => R(rx, colTop + (i + 1) * (th + g), Rw, th));
  const used = colTop + 4 * (th + g);
  return {
    mode: 'wide3', wide: true, hudPause: false, back, title, chips, board: { x: bx, y: by, side: S },
    status: R(gx, statusY, Lw, colBot - statusY), tool, pause: R(rx, colTop, Rw, th), badge: colBot - used >= 80 ? R(rx, used, Rw, colBot - used) : null,
  };
}

// ---------------------------------------------------------------------------------------------- Watch & Learn controls
export function autoLayout(L, scale) {
  const P = playLayout(L, scale);
  const k = clamp((scale - 1) / 2, 0, 1);
  if (P.mode === 'portrait') {
    const ox = L.ox, hh = Math.round(112 + 74 * k), y = L.h - L.bm - hh;
    return { slower: R(ox + 24, y, 160, hh), pause: R(ox + 200, y, 320, hh), faster: R(ox + 536, y, 160, hh) };
  }
  if (P.mode === 'wide2') {
    const t = P.tool, hh = t[2].h, colBot = t[2].y + hh, W2 = P.chips[0].w, hw = (W2 - 14) / 2, x0 = P.chips[0].x;
    return { pause: R(x0, colBot - 2 * hh - 14, W2, hh), slower: R(x0, colBot - hh, hw, hh), faster: R(x0 + hw + 14, colBot - hh, hw, hh) };
  }
  return { pause: P.pause, slower: P.tool[0], faster: P.tool[1] };
}
