// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio, so
// the live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; syncSize() copies it into the live bindings W and H (the game calls it every frame).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

// Safe areas and the host's floating back button in virtual units (main.js keeps this current; browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 24) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// ---- the play screen -------------------------------------------------------------------------------------------------
// The whole canvas is the sea (the stage). On top: pause, score and think at the top; in the line-up a scouting card, a
// row of boards and a Paddle out button at the bottom; while riding a slim distance-to-the-foam meter at the bottom.
// HUD text follows the text-size setting up to 160 percent (menus and pages follow it fully).
const cache = new Map();
export function playLayout(z = 1) {
  const key = `${W}x${H}|${z}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    L = build(z);
    L.key = key; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const fontsFor = (hz, mf) => {
  const f = (b) => Math.max(b, mf) * hz;
  return { big: Math.round(f(54)), mid: Math.round(f(24)), small: Math.round(f(17)), btn: Math.round(f(23)), lab: Math.round(f(20)), toast: Math.round(f(22)), chip: Math.round(f(18)) };
};

function build(z) {
  const land = W > H, hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 12 + (land ? 0 : T), M = Math.max(18, host.l, host.r), bb = Math.max(0, host.b - 6);
  const sideW = tap(Math.round(Math.max(92, fs.btn * 3.2)));
  const hudH = Math.round(Math.max(sideW * 0.8, fs.big * 0.95 + fs.small * 1.2 + 10));
  const backClear = land && host.back ? host.l + host.back + 8 : 0;
  const pause = R(Math.max(M, backClear), top, sideW, hudH), think = R(W - M - sideW, top, sideW, hudH);
  const freeW = think.x - g - (pause.x + sideW + g), sw = Math.min(freeW, 560);
  const score = R(pause.x + sideW + g + (freeW - sw) / 2, top, sw, hudH);
  const goH = tap(Math.round(Math.max(84, fs.btn * 2.8)));
  const hudBottom = top + hudH + g;
  let pw, px0, go, tray, scout;
  if (land) {
    // a panel on the right holds the boards and the Paddle out button; the sea stays visible on the left
    pw = Math.round(clamp(W * 0.36, 380, 560)); px0 = W - M - pw;
    go = R(px0, H - 10 - bb - goH, pw, goH);
    const cw = (pw - g) / 2, chipH = tap(Math.round(Math.max(92, fs.chip * 4.8)));
    const y0 = go.y - g - 2 * chipH - g;
    tray = [0, 1, 2, 3].map((i) => R(px0 + (i % 2) * (cw + g), y0 + Math.floor(i / 2) * (chipH + g), cw, chipH));
    scout = R(px0, hudBottom + (fs.mid * 1.8 + 8), pw, Math.max(60, y0 - g - (hudBottom + fs.mid * 1.8 + 8)));
  } else {
    pw = Math.min(W - 2 * M, 700); px0 = Math.round((W - pw) / 2);
    go = R(px0, H - 10 - bb - goH, pw, goH);
    const cw = (pw - 3 * g) / 4, chipH = tap(Math.round(Math.max(104, fs.chip * 5.2)));
    tray = [0, 1, 2, 3].map((i) => R(px0 + i * (cw + g), go.y - g - chipH, cw, chipH));
    const scoutTop = hudBottom + fs.mid * 1.8 + 8;
    scout = R(px0, scoutTop, pw, Math.max(60, tray[0].y - g - scoutTop));
  }
  // the bottom rows that do not depend on the side panel
  const bw = Math.min(W - 2 * M, land ? 900 : 700), bx = Math.round((W - bw) / 2);
  const demoW = (bw - 3 * g) / 4;
  const dy = H - 10 - bb - goH;
  const demo = { dec: R(bx, dy, demoW, goH), pause: R(bx + demoW + g, dy, demoW, goH), inc: R(bx + 2 * (demoW + g), dy, demoW, goH), exit: R(bx + 3 * (demoW + g), dy, demoW, goH) };
  const meterH = Math.round(Math.max(44, fs.small * 2.6));
  const meter = R(bx, H - 12 - bb - meterH, bw, meterH);
  return { land, z, hz, fs, M, pause, think, score, stage: R(0, 0, W, H), go, demo, tray, meter, scout, px0, pw, top, hudH, mult: R(score.x, top + hudH + 4, score.w, Math.round(fs.mid * 1.8)) };
}

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
const refCache = new Map();
export function refLayout() {
  const key = `${W}x${H}|${Math.round(host.t)},${Math.round(host.l)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let r = refCache.get(key);
  if (r) return r;
  if (W > H) {
    const margin = host.back ? Math.max(34, host.l + host.back + 10) : 34;
    const pw = Math.min(W - 2 * margin, 920), barH = tap(76), barY = H - Math.max(14, host.b + 8) - barH, py = Math.max(10, host.t + 6);
    const gw = Math.min(pw, 860), x0 = (W - gw) / 2, bw = Math.round(gw * 0.27), g = 12, mw = gw - 2 * bw - 2 * g, sw = Math.round(mw * 0.3);
    r = {
      land: true, panel: R((W - pw) / 2, py, pw, barY - 10 - py), back: R(x0, barY, bw, barH), next: R(x0 + gw - bw, barY, bw, barH),
      dec: R(x0 + bw + g, barY, sw, barH), inc: R(x0 + gw - bw - g - sw, barY, sw, barH), pct: { x: x0 + bw + g + sw + (mw - 2 * sw) / 2, y: barY + barH / 2 },
    };
  } else {
    const rowY = Math.max(18, host.t + 6), M = Math.max(20, host.l, host.r);
    const py = Math.max(100, rowY + 70, host.back ? host.t + host.back + 10 : 0);
    const barH = 100, barY = H - Math.max(116, host.b + barH + 10);
    const half = (W - 2 * M - 16) / 2;
    r = {
      land: false, panel: R(34, py, W - 68, barY - 34 - py), back: R(M, barY, half, barH), next: R(M + half + 16, barY, half, barH),
      inc: R(W - M - 120, rowY, 120, 60), dec: R(W - M - 252, rowY, 120, 60), pct: { x: W - M - 268, y: rowY + 30, right: true },
    };
  }
  refCache.set(key, r); if (refCache.size > 30) refCache.delete(refCache.keys().next().value);
  return r;
}
