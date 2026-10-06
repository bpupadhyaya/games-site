// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the SHORT side is always 720 virtual units, the long
// side follows the screen). `layoutFor(w, h)` returns every rect for that size; it is cached, so a frame never recomputes it.
//
// The art (table, board, pebbles) is painted in a fixed "canonical" space: the board group is 700 x 800 units at (10, 350) with the
// pit rows at y 612 / 888 (see pitPos below). The play screens draw that group through a transform (`L.bt`: scale s + offset), so the
// board scales as one piece and pit taps are mapped back with `pitNear`. Four shapes:
//   tall     portrait phone (h >= 1480): the approved phone look: header, board, message, buttons stacked.
//   compact  portrait but shorter (small phones, portrait tablets, squarish windows): the same stack, tighter.
//   side     landscape up to ~1.7:1: the board on the right, one card on the left (status, message, buttons).
//   wide     landscape beyond 1.7:1: a status card left, the board in the middle, a button card right.
export const W = 720, H = 1560;                           // canonical art space (cached art layers are painted in it)
export const RX = 30, RY = 42, PITCH = 68, X0 = 88;
export const ROW_Y = { top: 612, bottom: 888 };
export const FRAME = { x: 10, y: 350, w: 700, h: 800 };
export const TRAY = { top: { x: 60, y: 386, w: 600, h: 126 }, bottom: { x: 60, y: 988, w: 600, h: 126 } };
export const MID_Y = 750;
export const TEXT_SCALES = [1, 1.3, 1.6, 2, 2.5, 3];
// Auto Play ("Watch & Learn") think-time steps, in seconds: an index into this, never a raw float. Hard-capped at 10 s.
export const THINK_STEPS = [2, 5, 8, 10];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// `px` = css pixels per virtual unit, so text can be kept above ~11 css px.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// pit i: 0-8 along the bottom, left to right; 9-17 along the top, right to left (counter-clockwise)
export const pitPos = (i) => (i < 9 ? { x: X0 + PITCH * i, y: ROW_Y.bottom } : { x: X0 + PITCH * (17 - i), y: ROW_Y.top });
export const trayPos = (p) => ({ x: 360, y: p === 0 ? TRAY.bottom.y + 63 : TRAY.top.y + 63 });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Board group transform: canonical (cx, cy) -> screen (bt.ox + cx * bt.s, bt.oy + cy * bt.s).
export const toScreen = (L, p) => ({ x: L.bt.ox + p.x * L.bt.s, y: L.bt.oy + p.y * L.bt.s });
export const pitScreen = (L, i) => toScreen(L, pitPos(i));
// nearest pit to a tap (generous: the whole pit band counts), or -1
export function pitNear(L, x, y) {
  const cx = (x - L.bt.ox) / L.bt.s, cy = (y - L.bt.oy) / L.bt.s;
  let best = -1, bd = 1e9;
  for (let i = 0; i < 18; i++) {
    const p = pitPos(i), dx = Math.abs(cx - p.x), dy = Math.abs(cy - p.y);
    if (dx > 34 || dy > 76) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ---- the per-size layout -----------------------------------------------------------------------------------------
let cacheKey = '', cache = null;
export function layoutFor(w, h) {
  w = Math.round(w * 100) / 100; h = Math.round(h * 100) / 100;
  const key = `${w}|${h}|${host.t}|${host.r}|${host.b}|${host.l}|${host.back}`;
  if (key === cacheKey) return cache;
  cacheKey = key; cache = build(w, h);
  return cache;
}

function build(w, h) {
  const sl = Math.max(host.l, 0), sr = Math.max(host.r, 0), st = Math.max(host.t, 0), sb = Math.max(host.b, 0);
  const land = w >= h * 0.95, wide = w >= h * 1.7;
  const mode = land ? (wide ? 'wide' : 'side') : h >= 1480 ? 'tall' : 'compact';
  // the decorative bands of the table: lattice on top, kilim below (landscape: a slim lattice only, to keep the height for play)
  const bandTop = land ? 38 : clamp(Math.round(h * 0.059), 44, 92), bandBot = land ? 0 : clamp(Math.round(h * 0.059), 44, 92);
  const bk = host.back ? Math.ceil(host.back + 12) : 0;                    // the host's floating back button: a square this big, top-left
  const BK = R(0, 0, sl + bk + 8, st + bk + 8);
  const ux0 = sl + 16, ux1 = w - sr - 16, uy0 = Math.max(st + 8, bandTop + 10), uy1 = h - Math.max(sb + 8, bandBot + 10);
  const aw = ux1 - ux0, ah = uy1 - uy0;
  const L = { w, h, mode, land, wide, bandTop, bandBot, BK, bk, ux0, ux1, uy0, uy1, aw, ah, sl, sr, st, sb };

  // ---- play frame: board transform, header, message, buttons ----
  const boardAt = (s, x, y) => { L.bt = { s, ox: x - FRAME.x * s, oy: y - FRAME.y * s }; L.board = R(x, y, FRAME.w * s, FRAME.h * s); };
  const row = (n, rect, gap = 14) => { const bw = (rect.w - gap * (n - 1)) / n; return Array.from({ length: n }, (_, i) => R(rect.x + i * (bw + gap), rect.y, bw, rect.h)); };
  const stack = (n, x, y, ww, bh, gap) => Array.from({ length: n }, (_, i) => R(x, y + i * (bh + gap), ww, bh));
  const SCENES = { play: ['menu', 'undo', 'hint'], auto: ['exit', 'pause', 'dec', 'inc'], lesson: ['menu', 'next'], puzzle: ['menu', 'share'] };
  L.play = {};                                            // scene -> { btn: {name: rect}, msg: rect }
  if (!land) {
    const tall = mode === 'tall';
    const hH = tall ? 130 : 112, mH = tall ? 128 : 96, bH = tall ? 82 : 66, g = tall ? 12 : 8;
    const fixed = hH + mH + bH + 3 * g;
    const s = clamp(Math.min(1, aw / FRAME.w, (ah - fixed) / FRAME.h), 0.3, 1), bh = FRAME.h * s;
    const extra = Math.max(0, ah - fixed - bh);
    let y = uy0 + extra * 0.25;
    L.header = R(ux0 + bk, y, aw - 2 * bk, hH); y += hH + g + extra * 0.25;
    boardAt(s, (w - FRAME.w * s) / 2, y); y += bh + g + extra * 0.1;
    const mw = Math.min(aw, 640), mx = (w - mw) / 2;
    const msg = R(mx, y, mw, mH); y += mH + g + extra * 0.1;
    const area = R(mx, y, mw, bH);
    for (const [sc, names] of Object.entries(SCENES)) {
      const rs = row(names.length, area, names.length > 3 ? 12 : 16), btn = {}; names.forEach((nm, i) => { btn[nm] = rs[i]; });
      L.play[sc] = { btn, msg };
    }
  } else if (!wide) {
    const hH = 168, cwMin = 300;
    const s = clamp(Math.min(1, ah / FRAME.h, (aw - cwMin - 16) / FRAME.w), 0.3, 1);
    boardAt(s, ux1 - FRAME.w * s, uy0 + (ah - FRAME.h * s) / 2);
    const card = R(ux0, uy0, L.board.x - 16 - ux0, ah);
    L.card = card; L.header = R(card.x, uy0 + bk, card.w, hH);
    const bh = 60, gap = 8;
    for (const [sc, names] of Object.entries(SCENES)) {
      const btn = {}; let top;
      if (sc === 'auto') {
        const half = (card.w - gap) / 2, y1 = uy1 - 2 * bh - gap;
        names.forEach((nm, i) => { btn[nm] = R(card.x + (i % 2) * (half + gap), y1 + Math.floor(i / 2) * (bh + gap), half, bh); });
        top = y1;
      } else {
        const ys = uy1 - names.length * bh - (names.length - 1) * gap;
        const rs = stack(names.length, card.x, ys, card.w, bh, gap);
        names.forEach((nm, i) => { btn[nm] = rs[names.length === 2 ? 1 - i : i]; });     // the primary action ("Next lesson") sits on top, Menu last
        top = ys;
      }
      const my = L.header.y + L.header.h + 8;
      L.play[sc] = { btn, msg: R(card.x, my, card.w, Math.max(80, top - 10 - my)) };
    }
  } else {
    const hH = 178, bh = 84, gap = 16;
    const s = clamp(Math.min(1, ah / FRAME.h), 0.3, 1);
    boardAt(s, (w - FRAME.w * s) / 2, uy0 + (ah - FRAME.h * s) / 2);
    const lc = R(ux0, uy0, L.board.x - 20 - ux0, ah), rc = R(L.board.x + L.board.w + 20, uy0, ux1 - (L.board.x + L.board.w + 20), ah);
    L.card = lc; L.cardR = rc; L.header = R(lc.x, uy0 + bk, lc.w, hH);
    const bw = Math.min(rc.w, 360), bx = rc.x + (rc.w - bw) / 2;
    for (const [sc, names] of Object.entries(SCENES)) {
      const total = names.length * bh + (names.length - 1) * gap, y0 = uy0 + (ah - total) / 2;
      const rs = stack(names.length, bx, y0, bw, bh, gap), btn = {}; names.forEach((nm, i) => { btn[nm] = rs[i]; });
      const my = L.header.y + L.header.h + 8;
      L.play[sc] = { btn, msg: R(lc.x, my, lc.w, Math.min(300, uy1 - my)) };
    }
  }
  L.dev = R(ux1 - 60, uy0 - 4, 60, 26);                    // the DEV tag: top-right corner, never over a button

  // ---- result screen: a 720-wide block, scaled to fit and centred (content lives in canonical y 420..1250) ----
  {
    const y0 = 420, y1 = 1250, k = clamp(Math.min(1, aw / 700, ah / (y1 - y0)), 0.3, 1);
    const ox = w / 2 - 360 * k, oy = (uy0 + uy1) / 2 - ((y0 + y1) / 2) * k;
    const at = (r) => R(ox + r.x * k, oy + r.y * k, r.w * k, r.h * k);
    L.over = { k, ox, oy, again: at(R(130, 1000, 460, 96)), back: at(R(130, 1120, 460, 96)), block: R(ox + 10 * k, oy + y0 * k, 700 * k, (y1 - y0) * k) };
  }

  // ---- title screen ----
  L.title = (hasSave) => {
    const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily', 'trio', 'auto']), n = names.length;
    const ART_H = 870, out = { rows: {}, art: null, stats: null, lockup: null, blocks: {} };
    const place = (x, rowW, y, rh, gap) => {
      const trioW = (rowW - 10 * 2) / 3; let yy = y;
      for (const nm of names) {
        if (nm === 'trio') { out.rows.about = R(x, yy, trioW, rh); out.rows.rules = R(x + trioW + 10, yy, trioW, rh); out.rows.settings = R(x + (trioW + 10) * 2, yy, trioW, rh); }
        else out.rows[nm] = R(x, yy, rowW, rh);
        yy += rh + gap;
      }
      return yy - gap;
    };
    if (!land) {
      const rowW = Math.min(580, aw), x = (w - rowW) / 2, lkW = Math.min(aw - 40, Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6))), lkH = Math.round(lkW * 327 / 1200);
      let pick = null;
      for (const rh of [78, 70, 62, 56, 50, 46]) {
        const g = rh >= 70 ? 6 : 5, rowsH = n * rh + (n - 1) * g, block = rowsH + 14 + 62 + 16 + lkH;
        const ts = clamp(Math.min(aw / 720, (ah - block - 10) / ART_H), 0.2, 1);
        pick = { rh, g, block, ts };
        if (ts >= 0.62 || rh === 46) break;
      }
      const { rh, g, block, ts } = pick, artH = ART_H * ts, extra = Math.max(0, ah - block - artH - 10);
      const ay = uy0 + extra * 0.3;
      out.art = { s: ts, ox: w / 2 - 360 * ts, oy: ay - 10 * ts, rect: R(w / 2 - 360 * ts, ay, 720 * ts, artH) };
      const endY = place(x, rowW, ay + artH + 10 + extra * 0.3, rh, g);
      out.stats = { x: w / 2, y: endY + 14 + 22, wMax: rowW };
      out.lockup = R(w / 2 - lkW / 2, endY + 14 + 62 + 10, lkW, lkH);
    } else {
      const ts = clamp(Math.min(1, ah / ART_H, (aw - 24 - 300) / 720), 0.3, 1);
      const rowW = Math.min(580, aw - 24 - 720 * ts), groupW = 720 * ts + 24 + rowW, gx = ux0 + (aw - groupW) / 2;
      const ay = uy0 + (ah - ART_H * ts) / 2;
      out.art = { s: ts, ox: gx, oy: ay - 10 * ts, rect: R(gx, ay, 720 * ts, ART_H * ts) };
      const lkW = Math.min(rowW, Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6))), lkH = Math.round(lkW * 327 / 1200), foot = 14 + 56 + 12 + lkH;
      const rh = clamp(Math.floor((ah - foot - (n - 1) * 8) / n), 50, 78), colH = n * rh + (n - 1) * 8 + foot, y0 = uy0 + (ah - colH) / 2;
      const rx = gx + 720 * ts + 24, endY = place(rx, rowW, y0, rh, 8);
      out.stats = { x: rx + rowW / 2, y: endY + 14 + 22, wMax: rowW };
      out.lockup = R(rx + rowW / 2 - lkW / 2, endY + 14 + 56 + 10, lkW, lkH);
    }
    out.blocks.stats = R(out.stats.x - out.stats.wMax / 2, out.stats.y - 22, out.stats.wMax, 56);
    return out;
  };

  // ---- settings: one column (portrait) or two (landscape) ----
  {
    const names = ['level', 'sound', 'calm', 'big', 'seeds', 'wood'], out = { rows: {} };
    if (!land) {
      const colW = Math.min(580, aw - 40), x = (w - colW) / 2, top = Math.max(uy0 + 110, BK.h + 6), backH = 78;
      const fixedBelow = 90 + 60 + 20 + backH + 10, rh = clamp(Math.floor((uy1 - top - fixedBelow) / 6) - 12, 52, 84), pitch = rh + 12;
      names.forEach((nm, i) => { out.rows[nm] = R(x, top + i * pitch, colW, rh); });
      const yEnd = top + 6 * pitch;
      out.titleY = uy0 + 78; out.blurbY = yEnd + 30; out.seedsY = yEnd + 100; out.back = R((w - Math.min(460, colW)) / 2, yEnd + 130, Math.min(460, colW), backH);
      out.panel = R(ux0, uy0 + 8, aw, out.back.y + backH + 22 - (uy0 + 8));
      out.blurbW = colW; out.sz = 30;
    } else {
      const totalW = Math.min(aw, 1100), x0 = (w - totalW) / 2, gap = 22, colW = (totalW - gap - 40) / 2, rh = clamp(Math.floor((ah - 215) / 3) - 12, 50, 76), pitch = rh + 12;
      const top = Math.max(uy0 + 90, BK.h + 6);
      names.forEach((nm, i) => { out.rows[nm] = R(x0 + 20 + (i % 2) * (colW + gap), top + Math.floor(i / 2) * pitch, colW, rh); });
      const yEnd = top + 3 * pitch;
      out.titleY = uy0 + 56; out.blurbY = yEnd + 26; out.seedsY = yEnd + 70; out.back = R(w / 2 - 220, Math.min(yEnd + 90, uy1 - 66), 440, 66);
      out.panel = R(x0, uy0 + 4, totalW, out.back.y + out.back.h + 14 - (uy0 + 4));
      out.blurbW = totalW - 80; out.sz = 28;
    }
    L.settings = out;
  }

  // ---- reference pages (About / Rules): a text-size stepper top-right, a panel, Back / Next below ----
  {
    const navH = land ? 66 : 80, nbw = Math.min(300, (Math.min(aw, 900) - 8) / 2);
    const nav = { back: R(w / 2 - 4 - nbw, uy1 - navH, nbw, navH), next: R(w / 2 + 4, uy1 - navH, nbw, navH) };
    const bw2 = 120, th = land ? 50 : 60;
    const text = { dec: R(ux1 - 2 * bw2 - 12, uy0, bw2, th), inc: R(ux1 - bw2, uy0, bw2, th) };
    const py = uy0 + th + 10, pw = Math.min(aw, 1100), panel = R((w - pw) / 2, py, pw, nav.back.y - 10 - py);
    const hs = land ? 0.7 : 1, bodyW = Math.min(pw - 60, land ? 900 : 580);
    const mk = (kind) => {
      const top = (kind === 'about' ? 236 : 180) * hs;
      return { hs, body: R(panel.x + (pw - bodyW) / 2, panel.y + top, bodyW, panel.h - top - 44), titleY: panel.y + (kind === 'about' ? 90 : 112) * hs, hornY: panel.y + (kind === 'about' ? 126 : 144) * hs, pageY: panel.y + 184 * hs, labelY: panel.y + 56 * hs, counterY: panel.y + panel.h - 14 };
    };
    L.ref = { nav, text, panel, about: mk('about'), rules: mk('rules'), artH: mode === 'tall' ? 260 : 190 };
  }

  // ---- the "free taste is over" card ----
  { const pw = Math.min(aw, 620), ph = 380; L.demo = R((w - pw) / 2, clamp(h * 0.52 - ph / 2, uy0, Math.max(uy0, uy1 - ph)), pw, ph); }

  // everything a test (or a human) needs to check overlaps screen by screen: { buttons, blocks }
  L.ui = (scene, o = {}) => {
    if (scene === 'title') { const t = L.title(!!o.save); return { buttons: t.rows, blocks: { stats: t.blocks.stats, lockup: t.lockup } }; }
    if (scene === 'settings') return { buttons: { ...L.settings.rows, back: L.settings.back }, blocks: {} };
    if (scene === 'about' || scene === 'rules') return { buttons: { ...L.ref.nav, textDec: L.ref.text.dec, textInc: L.ref.text.inc }, blocks: { body: L.ref[scene].body } };
    if (scene === 'over') return { buttons: { again: L.over.again, back: L.over.back }, blocks: {} };
    if (L.play[scene]) return { buttons: L.play[scene].btn, blocks: { header: L.header, board: L.board, msg: L.play[scene].msg } };
    return { buttons: {}, blocks: {} };
  };
  return L;
}

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return { x: Math.round(r.x + r.w / 2 - w / 2), y: Math.round(r.y), w: Math.round(w), h: Math.round(h) }; };
