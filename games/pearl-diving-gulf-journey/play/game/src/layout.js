// Screen geometry in one place so game.js (hit-testing), menus.js and hud.js (drawing) never disagree.
// Kit fluid viewport: the SHORT side is always 720 virtual units, the long side follows the screen. W and H are LIVE bindings; syncLayout() recomputes every
// rectangle IN PLACE (the exported objects keep their identity).
//   portrait  status strip on top, the 3D picture, the controls in a zone at the bottom.
//   landscape the 3D picture on the left, a control column on the right, the status strip across the top.
// Safe areas and the host's floating back button come from `host` (kept current by main.js). Browsers: zeros.
export let W = 720;
export let H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y) => !!c && Math.hypot(x - c.cx, y - c.cy) <= c.r;
const R = (x, y, w, h) => ({ x, y, w, h });
const set = (o, x, y, w, h) => { o.x = x; o.y = y; o.w = w; o.h = h; return o; };
export const REF_BACK = R(20, 1164, 332, 100);
export const REF_NEXT = R(368, 1164, 332, 100);
export const TEXT_DEC = R(20, 18, 120, 60);
export const TEXT_INC = R(580, 18, 120, 60);
export const SETUP_PINS = { start: R(30, 1156, 440, 96), back: R(486, 1156, 204, 96) };
export const READ = { panel: R(10, 100, 700, 1030), view: R(10, 196, 700, 914), label: { x: 360, y: 48 }, bar: R(0, 0, 0, 0) };
export const estWidth = (text, px) => String(text).length * px * 0.54;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export const LY = {
  key: '', w: 720, h: 1280, land: false, mode: 'tall', U: { x: 0, y: 0, w: 720, h: 1280, x0: 0, y0: 0, x1: 720, y1: 1280 }, tap: 60, minText: 22, backSz: 0,
  col: { x: 40, w: 640 }, flowTop: 0, flowBottom: 1280, title: { hero: null, col: { x: 40, w: 640 }, heroH: 560 }, setupBottom: 1130,
  card: { x: 60, w: 600, top: 70, bottom: 1210, panelX: 30, panelW: 660 }, watchPause: R(480, 1196, 220, 64), toast: R(60, 1090, 600, 52),
};

// the action screens (song, dive, haul, open) and the status strip every playing screen shares
export const HUD = {
  key: '', hs: 1, fonts: {}, land: false,
  strip: R(0, 0, 720, 92), info: R(0, 0, 400, 92), menu: R(0, 0, 76, 76), think: R(0, 0, 76, 76),
  view: R(0, 0, 720, 600), ctl: R(0, 0, 720, 300), msg: R(0, 0, 400, 60),
};

export function syncLayout(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1280;
  const hk = `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(3)}`;
  const key = `${w}x${h}|${hk}`;
  if (key === LY.key) return false;
  W = w; H = h;
  const land = w > h;
  const vpc = 1 / Math.max(0.2, host.px);
  const U = { x: host.l, y: host.t, w: w - host.l - host.r, h: h - host.t - host.b }; U.x0 = U.x; U.y0 = U.y; U.x1 = U.x + U.w; U.y1 = U.y + U.h;
  const tap = clampN(Math.round(44 * vpc), 56, 84);
  const backSz = host.back ? Math.max(host.back, 56) + 12 : 0;
  Object.assign(LY, { key, w, h, land, U, tap, backSz, minText: Math.max(16, Math.round(11 * vpc)), mode: land ? 'wide' : h >= 1500 ? 'tall' : 'compact' });
  const cx = (U.x0 + U.x1) / 2;
  const colW = land ? clampN(U.w - 2 * 120, 520, 700) : Math.min(640, U.w - 2 * 40);
  LY.col = { x: Math.round(cx - colW / 2), w: colW };
  LY.flowTop = U.y0 + (!land && backSz ? backSz : 0);
  LY.flowBottom = U.y1;
  const pinH = land ? Math.max(tap, 72) : 96;
  const pinY = U.y1 - (land ? 12 : 20) - pinH;
  const pinX = LY.col.x - 10, pinW = LY.col.w + 20, sw = Math.round(pinW * 0.68);
  set(SETUP_PINS.start, pinX, pinY, sw, pinH); set(SETUP_PINS.back, pinX + sw + 16, pinY, pinW - sw - 16, pinH);
  LY.setupBottom = pinY - 22;
  if (land) {
    const colX = Math.round(U.x0 + U.w * 0.5 + 10), cw = clampN(Math.min(560, U.x1 - 20 - colX), 320, 560);
    LY.title = { hero: R(U.x0 + 24, U.y0 + 12, Math.round(U.w * 0.5) - 30, U.h - 24), col: { x: colX, w: cw }, heroH: 0 };
  } else LY.title = { hero: null, col: LY.col, heroH: clampN(Math.round(h * (h < 1100 ? 0.3 : 0.34)), 260, 520) };
  { const cw = land ? Math.min(660, U.w - 80) : Math.min(600, U.w - 120); LY.card = { x: Math.round(cx - cw / 2), w: cw, top: U.y0 + (land ? 18 : 70), bottom: U.y1 - (land ? 18 : 70), panelX: Math.round(cx - cw / 2) - 30, panelW: cw + 60 }; }
  set(LY.watchPause, U.x1 - 14 - 220, U.y1 - 12 - Math.max(64, tap), 220, Math.max(64, tap));
  { const tw = Math.min(600, U.w - 60); set(LY.toast, Math.round(cx - tw / 2), land ? U.y0 + 150 : U.y1 - 170, tw, 52); }
  {
    const ph = Math.max(58, Math.min(tap, 70)), bh = land ? 76 : 92, pw = 100;
    const topY = U.y0 + 10;
    set(TEXT_INC, U.x1 - 14 - pw, topY, pw, ph); set(TEXT_DEC, TEXT_INC.x - 10 - 96 - 10 - pw, topY, pw, ph);
    READ.label = { x: TEXT_DEC.x + pw + 10 + 48, y: topY + ph / 2 };
    const btnY = U.y1 - 14 - bh;
    const pwid = land ? clampN(U.w - 2 * 110, 520, 920) : U.w - 20;
    const py = topY + ph + 10;
    set(READ.panel, Math.round(cx - pwid / 2), py, pwid, btnY - 10 - py);
    const bw = Math.min(340, Math.round((pwid - 16) / 2));
    set(REF_BACK, Math.round(cx - bw - 8), btnY, bw, bh); set(REF_NEXT, Math.round(cx + 8), btnY, bw, bh);
    set(READ.view, READ.panel.x, READ.panel.y + 96, READ.panel.w, READ.panel.h - 96 - 16);
    set(READ.bar, READ.panel.x + READ.panel.w - 30, READ.view.y, 26, READ.view.h);
  }
  HUD.key = '';
  return true;
}

// Build the HUD rectangles for the live size and the text size.
export function setHudLayout(textIdx) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const key = `${idx}:${LY.key}`;
  if (key === HUD.key) return false;
  HUD.key = key;
  const U = LY.U, land = LY.land, tap = LY.tap, hs = TEXT_SCALES[idx], hf = Math.min(hs, land ? 1.35 : 1.5);
  HUD.hs = hs; HUD.land = land;
  const fn = Math.round(24 * hf), fb = Math.round(26 * Math.min(hs, land ? 1.5 : 1.8)), fi = Math.round(22 * Math.min(hf, 1.6));
  HUD.fonts = { name: fn, btn: fb, info: fi };
  const sbH = Math.round(Math.max(92, fn * 2.5 + 30));
  const sbX = U.x0 + 8 + LY.backSz, sbY = U.y0 + 8;
  const sq = Math.max(tap, 68);
  set(HUD.strip, sbX, sbY, U.x1 - 8 - sbX, sbH);
  set(HUD.menu, U.x1 - 12 - sq, sbY + (sbH - sq) / 2, sq, sq);
  set(HUD.think, HUD.menu.x - 10 - sq, HUD.menu.y, sq, sq);
  set(HUD.info, sbX + 8, sbY, HUD.think.x - 10 - sbX - 8, sbH);
  if (!land) {
    const ctlH = Math.round(clampN(U.h * 0.27, 290, 400));
    set(HUD.ctl, U.x0 + 8, U.y1 - 10 - ctlH, U.w - 16, ctlH);
    set(HUD.view, U.x0, sbY + sbH + 4, U.w, HUD.ctl.y - 8 - (sbY + sbH + 4));
  } else {
    const ctlW = Math.round(clampN(U.w * 0.34, 340, 500));
    const top = sbY + sbH + 8;
    set(HUD.ctl, U.x1 - 8 - ctlW, top, ctlW, U.y1 - 10 - top);
    set(HUD.view, U.x0, top, HUD.ctl.x - 8 - U.x0, U.y1 - top);
  }
  set(HUD.msg, HUD.view.x + 16, HUD.view.y + 12, HUD.view.w - 32, 70);
  return true;
}

// the region the 3D camera composes its picture in (virtual units): the free picture, never under the controls
export function viewRegion() {
  const U = LY.U;
  if (LY.land) return { x: U.x0, y: U.y0, w: HUD.view.x + HUD.view.w - U.x0, h: U.h };
  const y = HUD.strip.y + HUD.strip.h; return { x: 0, y, w: LY.w, h: Math.max(160, HUD.ctl.y - 6 - y) };
}

// A pure check over named rectangles: inside the safe area, no two overlapping, tap targets tall enough. Returns a list of problem strings.
export function rectProblems(named, U = LY.U) {
  const out = [], keys = Object.keys(named).filter((k) => named[k]), tapMin = Math.min(56, 44 / Math.max(0.2, host.px) * 0.9);
  for (const k of keys) {
    const r = named[k];
    if (r.x < U.x0 - 0.5 || r.y < U.y0 - 0.5 || r.x + r.w > U.x1 + 0.5 || r.y + r.h > U.y1 + 0.5) out.push(`${k} outside the safe area`);
    if (r.btn && r.h < tapMin) out.push(`${k} too short (${Math.round(r.h)})`);
  }
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = named[keys[i]], b = named[keys[j]];
    if (a.nox || b.nox) continue;
    if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) out.push(`${keys[i]} overlaps ${keys[j]}`);
  }
  return out;
}
