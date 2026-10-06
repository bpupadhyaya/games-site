// Geometry for every screen as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rect and anchor for that size, cached by size + insets, so a frame never recomputes it.
//
// The field (trees, perches, hunters, stones, bird) keeps its authored 720 x 1280 world and its exact gameplay geometry. What
// changes is how the world is placed on the screen: V = { z, ox, oy } maps a world point (x, y) to the screen
// (ox + x * z, oy + y * z). Sky, hills and grass extend beyond the column to fill every pixel (render.js draws them over the
// whole visible world rectangle V.vx0..vx1 x vy0..vy1), so there are no bars at any size.
//   portrait   the column fills the width (z = 1 on phones; a little smaller on squarer tablets so the HUD still has sky),
//              HUD along the top, buttons along the bottom. Extra height on tall phones becomes sky above the column.
//   landscape  the tall column stays centred (cropped to the 150..1250 band that holds all the play), the HUD and the
//              buttons move into panels left and right of it, and extra trees fill the sides.
// Pointer input arrives in screen units; the world point is ((x - ox) / z, (y - oy) / z).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const LOCKUP_ASPECT = 1200 / 327;   // web/brand/arcforge-lockup.png

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

// Every button rect of a layout, flattened, for the programmatic overlap check (check scripts and tests).
export function allButtons(L) {
  const out = [];
  const walk = (o, path) => {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, path + '[' + i + ']')); return; }
    if (typeof o.x === 'number' && typeof o.w === 'number' && typeof o.h === 'number') { out.push({ name: path, ...o }); return; }
    if (typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], path ? path + '.' + k : k);
  };
  for (const g of ['title', 'play', 'pause', 'result', 'demo', 'rules', 'auto']) walk(L.btn[g], g);
  return out;
}

function build(w, h, ins) {
  const land = w >= h;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back ? Math.max(ins.back, 56) : 0;
  const T = ins.t, B = Math.max(ins.b, 10);
  const L = { w, h, land, ins, U, back, T, B };
  L.backBox = back ? R(ins.l, ins.t, back + 8, back + 8) : R(0, 0, 0, 0);

  // ---- the world on the screen ----------------------------------------------------------------------------------------
  let z, ox, oy, pw = 0;
  if (!land) {
    z = clamp((h - 225 - T) / 992, 0.5, 1);
    oy = h - 1280 * z - Math.max(0, ins.b - 60);
    ox = (w - 720 * z) / 2;
  } else {
    z = clamp(Math.min((h - ins.t - ins.b) / 1100, (U.w - 400) / 720), 0.3, 1);
    oy = ins.t - 150 * z;
    ox = ins.l + (U.w - 720 * z) / 2;
    pw = (U.w - 720 * z) / 2;
  }
  L.V = { z, ox, oy, vx0: -ox / z, vx1: (w - ox) / z, vy0: -oy / z, vy1: (h - oy) / z };
  L.toWorld = (x, y) => ({ x: (x - ox) / z, y: (y - oy) / z });
  L.pw = pw;
  const cxCol = ox + 360 * z;                                  // screen x of the column centre
  const pL = { x0: ins.l, x1: ox, cx: (ins.l + ox) / 2 }, pR = { x0: ox + 720 * z, x1: w - ins.r, cx: (ox + 720 * z + w - ins.r) / 2 };
  L.panelL = pL; L.panelR = pR;
  const pin = land ? Math.min(pw - 28, 340) : 0;               // inner width of a side panel
  L.pin = pin;

  const btn = L.btn = { title: {}, play: {}, pause: {}, result: {}, demo: {}, rules: {}, auto: {} };

  // ---- HUD ------------------------------------------------------------------------------------------------------------
  // Portrait: the original top HUD (offset by the safe inset). Landscape: a card in the left panel (score, feathers, combo,
  // level, day bar, seeds, acorns) and a card in the right panel (pause, wind).
  const hud = L.hud = { land, bossY: oy + 400 * z, blurbY: h - B - 118, hintY: h - B - 70, blurbW: Math.min(U.w - 60, land ? 640 : 630), cx: cxCol, bossW: land ? 720 * z - 24 : Math.min(w - 40, 680) };
  const yTop = back ? ins.t + back + 16 : ins.t + 16;
  if (!land) {
    hud.dy = T;
    btn.play.pause = R(w - ins.r - 84, T + 8, 76, 76);
  } else {
    const lx = pL.cx - pin / 2, top = yTop;
    hud.left = R(lx, top, pin, 420);
    hud.score = { x: pL.cx, y: top + 84, max: pin - 24 };
    hud.lives = { x: pL.cx, y: top + 130 };
    hud.combo = { x: pL.cx, y: top + 186, size: 40 };
    hud.level = { x: pL.cx, y1: top + 232, y2: top + 260, size: 24, max: pin - 20 };
    hud.bar = R(lx + 20, top + 282, pin - 40, 12);
    hud.seeds = { x: pL.cx, y: top + 338 };
    hud.ammo = { x: pL.cx, y: top + 384 };
    const rx = pR.cx - pin / 2, rtop = Math.max(ins.t + 16, 16);
    btn.play.pause = R(pR.cx - 38, rtop, 76, 76);
    hud.right = R(rx, rtop + 92, pin, 96);
    hud.wind = { x: pR.cx, y: rtop + 150, max: pin - 16 };
  }

  // ---- title ------------------------------------------------------------------------------------------------------------
  const lh = land ? clamp(Math.round(pin * 0.3), 40, 76) : Math.round(Math.min(w, h) * 0.36 / LOCKUP_ASPECT);
  const lw = Math.round(lh * LOCKUP_ASPECT);
  const tt = L.title = { land };
  const dev = { x: w - ins.r - 252, y: T + 10 };
  btn.title.devPrev = R(dev.x, dev.y, 96, 56); btn.title.devNext = R(dev.x + 156, dev.y, 96, 56);
  if (!land) {
    const lockY = h - B - 16 - lh;
    tt.lockup = R(w / 2 - lw / 2, lockY, lw, lh);
    const bs = 84, bp = 100, ry = lockY - 18 - bs, py = ry - 14 - bp;
    btn.title.play = R(w / 2 - 215, py, 430, bp); btn.title.auto = R(w / 2 - 215, ry, 208, bs); btn.title.rules = R(w / 2 + 7, ry, 208, bs);
    tt.statY = py - 24; tt.levelY = py - 70;
    tt.title = { x: w / 2, y: Math.round(T + (oy + 300 * z - T) * 0.5 + 40), size: 120 };
    tt.tag = { x: w / 2, y: tt.title.y + 64, size: 30, max: w - 40 };
  } else {
    const bw = Math.min(pin, 340), bp = 96, bs = 82, gap = 14, lhh = Math.round(Math.min(lw, bw) / LOCKUP_ASPECT), lww = Math.round(lhh * LOCKUP_ASPECT);
    const total = bp + gap + bs + gap + bs + 24 + lhh, y0 = Math.max(T + 78, (h - ins.b - total) / 2);   // below the dev-only level picker (top right)
    const x = pR.cx - bw / 2;
    btn.title.play = R(x, y0, bw, bp); btn.title.auto = R(x, y0 + bp + gap, bw, bs); btn.title.rules = R(x, y0 + bp + gap + bs + gap, bw, bs);
    tt.lockup = R(pR.cx - lww / 2, y0 + bp + 2 * gap + 2 * bs + 24, lww, lhh);
    tt.title = { x: pL.cx, y: Math.round(h * 0.42), size: 120, max: pin };
    tt.tag = { x: pL.cx, y: tt.title.y + 56, size: 28, max: pin };
    tt.statY = tt.title.y + 56 + 170; tt.levelY = tt.statY - 46;
  }

  { // tap zone for the lockup: at least 44 css px each way, padded away from the buttons above
    const m = 44 / Math.max(0.2, ins.px || 0.6), lk = tt.lockup;
    const tw = Math.max(lk.w + 24, m), th = Math.max(lk.h + 12, m);
    tt.lockupTap = R(lk.x + lk.w / 2 - tw / 2, lk.y + lk.h + 6 - th, tw, th);
  }

  // ---- centred stacks: pause menu, result, demo limit ----------------------------------------------------------------
  const cy = (T + h - ins.b) / 2;
  const colW = land ? Math.min(U.w - 80, 1000) : Math.min(w - 60, 640);
  const bwC = Math.min(land ? 380 : 440, colW - 20);
  L.pauseCard = R(w / 2 - Math.min(w - 40, 520) / 2, cy - 240, Math.min(w - 40, 520), 440);
  btn.pause.resume = R(w / 2 - bwC / 2, cy - 40, bwC, 100);
  btn.pause.menu = R(w / 2 - bwC / 2, cy + 76, bwC, 84);
  L.pauseTitle = { x: w / 2, y: cy - 130 };

  const rs = L.result = { land };
  if (!land) {
    const blockH = 880, t0 = Math.max(T + 16, (h - ins.b - blockH) / 2);
    rs.cx = w / 2; rs.t0 = t0;
    rs.over = { title: t0 + 90, sub: t0 + 170, score: t0 + 360, stats: t0 + 430 };
    rs.won = { title: t0 + 90, sub: t0 + 160, stars: t0 + 300, score: t0 + 470, stats: t0 + 540 };
    const pyO = t0 + 520, pyW = t0 + 620;
    rs.btnY = { over: pyO, won: pyW };
    btn.result.again = R(w / 2 - bwC / 2, pyO, bwC, 96); btn.result.menu = R(w / 2 - bwC / 2, pyO + 110, bwC, 80);
    btn.result.againW = R(w / 2 - bwC / 2, pyW, bwC, 96); btn.result.menuW = R(w / 2 - bwC / 2, pyW + 110, bwC, 80);
    rs.moreOver = t0 + 760; rs.moreWon = t0 + 860;
    rs.colMax = colW;
  } else {
    const c = cy, lx = w / 2 - colW / 4, rx = w / 2 + colW / 4;
    rs.cxL = lx; rs.cxR = rx; rs.colMax = colW / 2 - 24;
    rs.over = { title: c - 40, sub: c + 30, score: c - 70, stats: c - 22 };
    rs.won = { title: c - 70, sub: c - 4, stars: c + 110, score: c - 70, stats: c - 22 };
    const bw = Math.min(bwC, colW / 2 - 40);
    btn.result.again = R(rx - bw / 2, c + 10, bw, 84); btn.result.menu = R(rx - bw / 2, c + 104, bw, 72);
    btn.result.againW = btn.result.again; btn.result.menuW = btn.result.menu;
    rs.moreOver = rs.moreWon = c + 222;
  }
  btn.demo.menu = R(w / 2 - bwC / 2, cy + 110, bwC, 84);
  L.demo = { cy };

  // ---- Auto Play ("Watch & Learn") --------------------------------------------------------------------------------------
  const ap = L.ap = { land };
  if (!land) {
    const bx = back ? ins.l + back + 16 : Math.max(12, ins.l + 12);
    const bw = 150, g = 10, by = T + 8, bh = 64;
    btn.auto.exit = R(bx, by, bw, bh); btn.auto.pause = R(bx + bw + g, by, bw, bh); btn.auto.skip = R(bx + 2 * (bw + g), by, bw, bh);
    ap.status = { x: w / 2, y: T + 252 };
    const ty = h - B - 108;
    btn.auto.dec = R(20 + ins.l, ty, 230, 90); btn.auto.inc = R(w - ins.r - 250, ty, 230, 90);
    ap.think = { x: w / 2, y: ty + 52 };
  } else {
    const bw = Math.min(pin, 240), x = pR.cx - bw / 2, y0 = Math.max(ins.t + 12, 12), bh = 62;
    btn.auto.exit = R(x, y0, bw, bh); btn.auto.pause = R(x, y0 + bh + 10, bw, bh); btn.auto.skip = R(x, y0 + 2 * (bh + 10), bw, bh);
    ap.status = { x: cxCol, y: ins.t + 38 };
    const hw = (bw - 10) / 2, ty = h - B - 84;
    btn.auto.dec = R(x, ty, hw, 72); btn.auto.inc = R(x + hw + 10, ty, hw, 72);
    ap.think = { x: pR.cx, y: ty - 18, max: pin };
    ap.wind = { x: pR.cx, y: y0 + 3 * (bh + 10) + 36, max: pin - 16 };
  }
  ap.endAgain = btn.result.again; ap.endExit = btn.result.menu;

  // ---- Rules reader ----------------------------------------------------------------------------------------------------
  {
    const T0 = Math.max(land ? 8 : 14, ins.t + (land ? 6 : 8)), barH = land ? ins.b + 88 : ins.b + 108;
    const cw = land ? Math.min(U.w - 40, 1000) : w - 28, cxm = (U.x0 + U.x1) / 2, cx = land ? cxm - cw / 2 : 14;
    const card = R(cx, T0, cw, h - T0 - barH);
    const hdrH = 76, footH = 40;
    const inc = R(card.x + card.w - 16 - 96, card.y + 8, 96, 60), dec = R(inc.x - 10 - 96, inc.y, 96, 60);
    const vp = R(card.x + 8, card.y + hdrH + 8, card.w - 16, card.h - hdrH - 8 - footH);
    const bw = land ? 240 : 250, bh = land ? 64 : 76, byy = h - ins.b - (land ? 78 : 94);
    btn.rules.back = R(cxm - bw - 10, byy, bw, bh); btn.rules.next = R(cxm + 10, byy, bw, bh);
    btn.rules.dec = dec; btn.rules.inc = inc;
    L.rules = { card, hdrH, footH, viewport: vp, textW: Math.min(vp.w - 70, 860), cx: card.x + card.w / 2, headerY: card.y + 46, scrollbar: R(card.x + card.w - 22, vp.y + 6, 10, vp.h - 12), footY: card.y + card.h - 12 };
  }
  return L;
}
