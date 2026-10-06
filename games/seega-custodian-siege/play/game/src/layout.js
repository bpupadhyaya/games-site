// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data, a function of the LIVE screen size.
// Fluid viewport (kit 1.7): the SHORT side is always 720 units. Portrait: 720 wide x (up to 1728) tall. Landscape: (up to 1728) wide x 720 tall.
// `setSize(w, h)` (called by game.js every frame; it only recomputes when the size or the host insets change) refills the exported rect
// objects IN PLACE, so every importer sees the live geometry. Shapes:
//   portrait   the approved phone look (top bar, plates, board, status, toolbar); it squeezes gracefully down to 4:3.
//   landscape  a column on the left (back / pause, plates, status, tools) + the board; wide screens add a tool column on the right.
export const SCREEN = { width: 720, height: 1560, land: false, three: false };
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const rect = () => ({ x: 0, y: 0, w: 0, h: 0 });
const set = (o, x, y, w, h) => Object.assign(o, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- play screen
export const BACK_BTN = rect();
export const PAUSE_BTN = rect();
export const HUD = { title: { x: 360, y: 58, maxW: 480 }, sub: { x: 360, y: 96, maxW: 480 } };
// ---- document screens
export const DOC_BACK = rect(), ZOOM_DEC = rect(), ZOOM_INC = rect(), ZOOM_LBL = rect();
export const DOC_PANEL = rect(), DOC_BODY = rect(), DOC_BODY_NAV = DOC_BODY, DOC_BODY_START = DOC_BODY;
export const NAV_PREV = rect(), NAV_NEXT = rect(), START_BTN = rect(), NAV_LABEL = { x: 360, y: 1500 };
// ---- title screen
export const LANG_EN = rect(), LANG_AR = rect(), MENU_REGION = rect();
export const TITLE = { cx: 360, top: 90, s: 1, creditX: 360, creditY: 1536, land: false, lock: { x: 230, y: 1450, w: 260, h: 71 } };
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the menu above).
export function lockHit() {
  const c = TITLE.lock, m = 44 / Math.max(0.05, host.px), w = Math.max(c.w, m), y = c.y - 2;
  return { x: c.x + c.w / 2 - w / 2, y, w, h: Math.max(c.h + 2, Math.min(m, SCREEN.height - y)) };
}
// ---- overlays
export const OVERLAY = rect();
// the safe area, and the zones of the landscape play screen
export const AREA = { x0: 0, y0: 0, x1: 720, y1: 1560, w: 720, h: 1560 };
export const ZONES = { L: rect(), R: rect(), board: 0, bx: 0, by: 0 };

let key = '';
export function setSize(w, h) {
  w = Math.round(w); h = Math.round(h);
  if (!(w > 0 && h > 0)) return;
  const k = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (k === key) return;
  key = k;
  const land = w > h;
  Object.assign(SCREEN, { width: w, height: h, land, three: false });
  const U = Object.assign(AREA, { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b });
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = host.back ? Math.max(host.back, 56) : 0;
  const backR = backSz ? U.x0 + 8 + backSz + 12 : 0;                    // right edge of the host's floating back button (+ gap)
  const leftX = Math.max(U.x0 + 16, backR);                             // where a top-left control may start
  const bh = land ? 68 : 76;

  // ------------------------------------------------------------------------------------------------ play (portrait top bar)
  if (!land) {
    const y = U.y0 + 22;
    set(BACK_BTN, leftX, y, 84, 78); set(PAUSE_BTN, U.x1 - 16 - 84, y, 84, 78);
    const mw = PAUSE_BTN.x - (BACK_BTN.x + BACK_BTN.w) - 28;
    HUD.title = { x: 360, y: y + 50, maxW: Math.min(480, mw) }; HUD.sub = { x: 360, y: y + 84, maxW: Math.min(480, mw) };   // clear of the kit's top-centre Preview badge
  }

  // ------------------------------------------------------------------------------------------------ documents
  if (!land) {
    const y0 = U.y0 + 20;
    set(DOC_BACK, leftX, y0, 140, 76); set(ZOOM_DEC, 396, y0, 84, 76); set(ZOOM_LBL, 480, y0, 140, 76); set(ZOOM_INC, 620, y0, 84, 76);
    set(START_BTN, 24, h - host.b - 24 - 96, 672, 96);
    const navY = h - host.b - 26 - 84;
    set(NAV_PREV, 24, navY, 210, 84); set(NAV_NEXT, 486, navY, 210, 84);
    NAV_LABEL.x = 360; NAV_LABEL.y = navY + 50;
    const py = y0 + 92;
    set(DOC_PANEL, 24, py, 672, START_BTN.y - 6 - py);
    set(DOC_BODY, 48, py + 24, 624, DOC_PANEL.h - 48);
  } else {
    const pw = Math.min(U.w - 32, 900), px = U.x0 + (U.w - pw) / 2, y0 = U.y0 + 12, bx = Math.max(px, backR);
    const right = px + pw;
    set(DOC_BACK, bx, y0, 140, bh);
    set(ZOOM_INC, right - 84, y0, 84, bh); set(ZOOM_LBL, right - 84 - 112, y0, 112, bh); set(ZOOM_DEC, right - 84 - 112 - 84, y0, 84, bh);
    const ml = DOC_BACK.x + 140 + 12, mr = ZOOM_DEC.x - 12, mw = Math.max(200, mr - ml);
    const pb = Math.min(150, (mw - 70) / 2);
    set(NAV_PREV, ml, y0, pb, bh); set(NAV_NEXT, ml + mw - pb, y0, pb, bh);
    NAV_LABEL.x = ml + mw / 2; NAV_LABEL.y = y0 + bh / 2 + 9;
    set(START_BTN, ml + Math.max(0, (mw - 340) / 2), y0, Math.min(340, mw), bh);
    const py = y0 + bh + 10;
    set(DOC_PANEL, px, py, pw, U.y1 - 14 - py);
    set(DOC_BODY, px + 24, py + 22, pw - 48, DOC_PANEL.h - 44);
  }

  // ------------------------------------------------------------------------------------------------ title
  if (!land) {
    const langW = (U.x1 - 24 - leftX - 12) / 2, ly = U.y0 + 20;
    set(LANG_EN, leftX, ly, langW, 64); set(LANG_AR, leftX + langW + 12, ly, langW, 64);
    // art block: local y 90..732 (title, board). Scaled down on short screens so the menu keeps >= 540 units.
    const lw = Math.min(260, U.w - 80), lh = lw * 327 / 1200, top = U.y0 + 90, lockY = h - host.b - 10 - lh, creditY = lockY + 40, minMenu = 540;
    const s = clamp((creditY - 36 - top - minMenu - 28) / 642, 0.48, 1);
    Object.assign(TITLE, { cx: 360, top, s, creditX: 360, creditY, land: false, lock: { x: w / 2 - lw / 2, y: lockY, w: lw, h: lh } });
    const my = top + 642 * s + 28;
    set(MENU_REGION, 24, my, 672, lockY - 8 - my);
  } else {
    const mw = clamp(w * 0.4, 430, 620), mx = U.x1 - 16 - mw, ly = U.y0 + 12;
    set(LANG_EN, mx, ly, (mw - 12) / 2, 58); set(LANG_AR, mx + (mw - 12) / 2 + 12, ly, (mw - 12) / 2, 58);
    const lw = Math.min(260, mw - 40), lh = lw * 327 / 1200, creditY = U.y1 - 14, lockY = U.y1 - 8 - lh, my = ly + 58 + 10;
    set(MENU_REGION, mx, my, mw, lockY - 8 - my);
    const zw = mx - 16 - U.x0, s = clamp(Math.min((U.h - 24) / 642, zw / 560), 0.4, 1);
    Object.assign(TITLE, { cx: U.x0 + zw / 2, top: U.y0 + (U.h - 642 * s) / 2, s, creditX: mx + mw / 2, creditY, land: true, lock: { x: mx + mw / 2 - lw / 2, y: lockY, w: lw, h: lh } });
  }

  // ------------------------------------------------------------------------------------------------ overlays
  if (!land) set(OVERLAY, 50, 250, 620, 1060);
  else { const ow = Math.min(660, U.w - 32); set(OVERLAY, (w - ow) / 2, U.y0 + 12, ow, U.h - 24); }

  // ------------------------------------------------------------------------------------------------ landscape play zones
  if (land) {
    const g = 16, side0 = Math.min(U.h - 36, 720), free = U.w - side0 - 4 * g;
    const colY = U.y0 + 12, colH = U.h - 24;
    if (free >= 472) {
      const Rw = clamp(free * 0.38, 200, 300), Lw = Math.min(440, free - Rw), grp = Lw + Rw + side0 + 2 * g, ox = U.x0 + (U.w - grp) / 2;
      SCREEN.three = true;
      set(ZONES.L, ox, colY, Lw, colH); ZONES.bx = ox + Lw + g; ZONES.board = side0;
      set(ZONES.R, ox + Lw + g + side0 + g, colY, Rw, colH);
    } else {
      const Lw = clamp(U.w * 0.34, 270, 420), side = Math.min(side0, U.w - Lw - 3 * g), grp = Lw + g + side, ox = U.x0 + (U.w - grp) / 2;
      set(ZONES.L, ox, colY, Lw, colH); ZONES.bx = ox + Lw + g; ZONES.board = side; set(ZONES.R, 0, 0, 0, 0);
    }
    ZONES.by = U.y0 + (U.h - ZONES.board) / 2;
    const Lz = ZONES.L, bx = Math.max(Lz.x + 8, backR);
    set(BACK_BTN, bx, Lz.y, 70, 64); set(PAUSE_BTN, Lz.x + Lz.w - 70, Lz.y, 70, 64);
    const tx = (BACK_BTN.x + BACK_BTN.w + PAUSE_BTN.x) / 2, tw = PAUSE_BTN.x - (BACK_BTN.x + BACK_BTN.w) - 16;
    HUD.title = { x: tx, y: Lz.y + 42, maxW: Math.max(120, tw) }; HUD.sub = { x: Lz.x + Lz.w / 2, y: Lz.y + 64 + 28, maxW: Lz.w - 16 };
  }
}
setSize(720, 1560);

// ---- play screen: every size follows the text-zoom step s (1 to 3), so the HUD grows with the text ----
export function playLayout(scale, chain = false) {
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  const U = AREA, w = SCREEN.width, h = SCREEN.height;
  if (!SCREEN.land) {
    const roomy = clamp((h - 1000) / 560, 0, 1);                       // 0 = short screen (4:3), 1 = tall phone
    const chipH = Math.min(Math.round(86 + 18 * roomy + 70 * k), Math.round(h * 0.125));
    let statusH = Math.min(Math.round(120 + 30 * roomy + 150 * k), Math.round(h * 0.2));
    const toolH = Math.min(Math.round(84 + 28 * roomy + 74 * k), Math.round(h * 0.115));
    const toolY = h - host.b - 28 - toolH;
    const top = U.y0 + 128, bottom = toolY - 18;
    const gap = h < 1200 ? 14 : 18;
    const side = Math.max(260, Math.min(672, bottom - top - chipH - statusH - gap * 2 - 24));
    // spare height goes to the status panel (Think reasons are long) and to breathing room
    statusH += Math.min(120, Math.max(0, Math.round((bottom - top - (chipH + side + statusH + gap * 2) - 24) * 0.6)));
    const total = chipH + gap + side + gap + statusH;
    const y0 = Math.round(top + (bottom - top - total) * 0.45);
    const boardY = y0 + chipH + gap;
    const sy = boardY + side + gap;
    const endW = chain ? Math.round(232 + 60 * k) : 0;
    const tw = Math.round((672 - 2 * 16) / 3);
    return {
      chips: [{ x: 24, y: y0, w: 330, h: chipH }, { x: 366, y: y0, w: 330, h: chipH }],
      board: { x: Math.round((w - side) / 2), y: boardY, side },
      status: { x: 24, y: sy, w: 672 - (chain ? endW + 12 : 0), h: statusH },
      endBtn: chain ? { x: 696 - endW, y: sy, w: endW, h: statusH } : null,
      tool: [0, 1, 2].map((i) => ({ x: 24 + i * (tw + 16), y: toolY, w: tw, h: toolH })),
    };
  }
  // landscape
  const L = ZONES.L, R = ZONES.R, three = SCREEN.three, g = 12;
  const head = 64 + 34;
  const chipH = Math.min(Math.round(86 + 56 * k), Math.round(L.h * 0.16));
  const board = { x: Math.round(ZONES.bx), y: Math.round(ZONES.by), side: Math.round(ZONES.board) };
  const chips = [{ x: L.x, y: L.y + head + 4, w: L.w, h: chipH }, { x: L.x, y: L.y + head + 4 + chipH + g, w: L.w, h: chipH }];
  const sTop = chips[1].y + chipH + g;
  let tool, endBtn = null, statusBottom = L.y + L.h;
  if (three) {
    const n = chain ? 4 : 3, bh = Math.min(132, (R.h - (n - 1) * 14) / n), tot = n * bh + (n - 1) * 14, ty0 = R.y + (R.h - tot) / 2;
    const slot = (i) => ({ x: R.x, y: Math.round(ty0 + i * (bh + 14)), w: R.w, h: Math.round(bh) });
    if (chain) endBtn = slot(0);
    tool = [0, 1, 2].map((i) => slot(i + (chain ? 1 : 0)));
  } else {
    const th = Math.min(Math.round(84 + 28 * k), Math.round(L.h * 0.15)), tw = (L.w - 2 * 10) / 3, ty = L.y + L.h - th;
    tool = [0, 1, 2].map((i) => ({ x: Math.round(L.x + i * (tw + 10)), y: ty, w: Math.round(tw), h: th }));
    statusBottom = ty - g;
    if (chain) { const eh = Math.min(76, th); endBtn = { x: L.x, y: ty - g - eh, w: L.w, h: eh }; statusBottom = endBtn.y - g; }
  }
  return { chips, board, status: { x: L.x, y: sTop, w: L.w, h: Math.max(100, statusBottom - sTop) }, endBtn, tool };
}

// ---- Watch & Learn ----
export function autoLayout(scale) {
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  if (!SCREEN.land) {
    const h = Math.min(Math.round(84 + 28 * clamp((SCREEN.height - 1000) / 560, 0, 1) + 74 * k), Math.round(SCREEN.height * 0.115)), y = SCREEN.height - host.b - 28 - h;
    return { slower: { x: 24, y, w: 160, h }, pause: { x: 200, y, w: 320, h }, faster: { x: 536, y, w: 160, h }, labelY: y - 22 };
  }
  const R = ZONES.R, L = ZONES.L;
  if (SCREEN.three) {
    const bh = Math.min(132, (R.h - 28) / 3), gap = 14, tot = 3 * bh + 2 * gap, y0 = R.y + (R.h - tot) / 2;
    const slot = (i) => ({ x: R.x, y: Math.round(y0 + i * (bh + gap)), w: R.w, h: Math.round(bh) });
    return { pause: slot(0), slower: slot(1), faster: slot(2), labelY: y0 - 10 };
  }
  const h = Math.min(Math.round(84 + 28 * k), Math.round(L.h * 0.15)), y = L.y + L.h - h, sw = Math.round(L.w * 0.27), gap = 10;
  return { slower: { x: L.x, y, w: sw, h }, pause: { x: L.x + sw + gap, y, w: L.w - 2 * sw - 2 * gap, h }, faster: { x: L.x + L.w - sw, y, w: sw, h }, labelY: y - 10 };
}
