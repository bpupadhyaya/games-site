// Screen geometry: one place for every rectangle and every camera so game.js (hit-testing) and view.js (drawing) never
// disagree. FLUID (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the
// aspect ratio, so the live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape.
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
// Portrait: pause / score / think strip, the stage (pitch or field), then the control panel.
// Landscape: the stage on the left, one panel on the right with pause / think, score, then the controls.
// HUD text follows the text-size setting up to 160 percent (menus and pages follow it fully); the stage takes what is left.
const cache = new Map();
export function playLayout(z = 1, role = 'bat', watch = false) {
  const key = `${W}x${H}|${z}|${role}|${watch ? 1 : 0}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    L = W > H ? landscape(z, role, watch) : portrait(z, role, watch);
    L.key = key; L.w = W; L.h = H; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const fontsFor = (hz, mf) => {
  const f = (b) => Math.max(b, mf) * hz;
  return { big: Math.round(f(54)), mid: Math.round(f(26)), small: Math.round(f(18)), btn: Math.round(f(26)), lab: Math.round(f(20)), toast: Math.round(f(24)) };
};

function portrait(z, role, watch) {
  const hz = Math.min(z, 1.5), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 12 + T, M = Math.max(16, host.l, host.r), bb = Math.max(0, host.b - 8);
  const side = tap(Math.round(Math.max(84, fs.btn * 3)));
  const hudH = Math.round(Math.max(side, fs.big * 0.78 + fs.small * 2.6 + 18, 96));
  const pause = R(M, top, side, hudH), think = R(W - M - side, top, side, hudH), score = R(M + side + g, top, W - 2 * M - 2 * side - 2 * g, hudH);
  const base = role === 'bowl' ? 430 : 236;
  const panelH = Math.round(Math.min(base * (0.8 + 0.2 * hz), H * (role === 'bowl' ? 0.42 : 0.3)));
  const panel = R(M, H - 10 - bb - panelH, W - 2 * M, panelH);
  const stage = R(0, top + hudH + g, W, Math.max(160, panel.y - 8 - (top + hudH + g)));
  return finish({ land: false, z, hz, fs, M, pause, think, score, stage, panel, g, role, watch });
}

function landscape(z, role, watch) {
  const hz = Math.min(z, 1.5), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b };
  const pw = Math.round(clamp((U.x1 - U.x0) * 0.38 * (1 + (hz - 1) * 0.25), 330, 520)), px0 = U.x1 - pw - 12;
  const topPad = Math.max(host.t + 8, 8);
  const btnH = tap(Math.round(Math.max(64, fs.btn * 2.2)));
  const pause = R(px0, topPad, (pw - g) / 2, btnH), think = R(px0 + (pw + g) / 2, topPad, (pw - g) / 2, btnH);
  const scoreH = Math.round(Math.max(104, fs.big * 0.78 + fs.small * 2.6 + 18));
  const score = R(px0, topPad + btnH + g, pw, scoreH);
  const py = score.y + score.h + g;
  const panel = R(px0, py, pw, Math.max(150, U.y1 - 8 - py));
  const stage = R(0, 0, px0 - 6, H);
  return finish({ land: true, z, hz, fs, M: 0, pause, think, score, stage, panel, g, role, watch, px0, pw, backClear: host.back ? host.l + host.back + 10 : 0 });
}

// Sub-rectangles of the panel, by what the panel shows.
function finish(L) {
  const { panel: P, g, fs, hz } = L;
  const bh = tap(Math.round(Math.max(72, fs.btn * 2.6)));
  // batting: three swing buttons, and the big RUN button in the same place when the ball is in the field
  const sw = (P.w - 2 * g) / 3;
  const swH = Math.min(P.h - 44, Math.max(bh, Math.round(P.h * 0.62)));
  L.swing = [0, 1, 2].map((i) => R(P.x + i * (sw + g), P.y + P.h - swH, sw, swH));
  L.run = R(P.x, P.y + P.h - swH, P.w, swH);
  L.gauge = R(P.x, P.y, P.w, Math.max(30, P.h - swH - g));
  // bowling: aim pad, then chips and the bowl button
  const chipH = tap(Math.round(Math.max(54, fs.lab * 2.4)));
  if (L.land) {
    let bowlH = tap(Math.round(Math.max(74, fs.btn * 2.5)));
    let chipH2 = chipH;
    const rows = 4, padMin = 84;
    const need = padMin + rows * chipH2 + bowlH + (rows + 2) * g;
    if (need > P.h) {
      const k = Math.max(0.1, (P.h - padMin - (rows + 2) * g) / (rows * chipH2 + bowlH));
      chipH2 = Math.max(tap(40), Math.floor(chipH2 * k)); bowlH = Math.max(tap(50), Math.floor(bowlH * k));
    }
    const padH = Math.max(60, P.h - rows * chipH2 - bowlH - (rows + 1) * g);
    L.pad = R(P.x, P.y, P.w, Math.min(padH, P.w * 0.9));
    let y = L.pad.y + L.pad.h + g;
    const rowRect = (n) => { const w = (P.w - (n - 1) * g) / n; const out = []; for (let i = 0; i < n; i++) out.push(R(P.x + i * (w + g), y, w, chipH2)); y += chipH2 + g; return out; };
    L.pace = rowRect(3); L.flight = rowRect(2); L.swingChips = rowRect(3); L.fieldChips = rowRect(3);
    L.bowl = R(P.x, Math.min(y, P.y + P.h - bowlH), P.w, bowlH);
  } else {
    const bowlH = tap(Math.round(Math.max(72, fs.btn * 2.5)));
    const chipsTotal = 2 * chipH + g;                  // two rows: [pace x3][flight x2 + swing x3 => split]
    const padW = Math.min(P.w * 0.46, P.h - 2 * g);
    L.pad = R(P.x, P.y, padW, P.h - bowlH - g);
    const cx = P.x + padW + g, cw = P.w - padW - g;
    let y = P.y;
    const rowRect = (n, h = chipH) => { const w = (cw - (n - 1) * g) / n; const out = []; for (let i = 0; i < n; i++) out.push(R(cx + i * (w + g), y, w, h)); y += h + g; return out; };
    const avail = L.pad.h, per = Math.max(40, Math.min(chipH, (avail - 3 * g) / 4));
    L.pace = rowRect(3, per); L.flight = rowRect(2, per); L.swingChips = rowRect(3, per); L.fieldChips = rowRect(3, per);
    L.bowl = R(P.x, P.y + P.h - bowlH, P.w, bowlH);
    void chipsTotal;
  }
  // Watch & Learn: [ - ] [ Pause ] [ + ] [ Exit ] sits in the panel's bottom row
  const dh = tap(Math.round(Math.max(64, fs.btn * 2.3))), dw = (P.w - 3 * g) / 4;
  L.demo = { dec: R(P.x, P.y + P.h - dh, dw, dh), pause: R(P.x + dw + g, P.y + P.h - dh, dw, dh), inc: R(P.x + 2 * (dw + g), P.y + P.h - dh, dw, dh), exit: R(P.x + 3 * (dw + g), P.y + P.h - dh, dw, dh) };
  L.skip = R(P.x, P.y + P.h - dh, P.w, dh);
  void hz;
  return L;
}

// ---- cameras ----------------------------------------------------------------------------------------------------------
// A camera maps the ground plane (x sideways, y along the pitch, z up) to the stage. Portrait: y runs up the screen with a
// tilt factor k (oblique top-down); landscape: the pitch lies sideways, the bowler at the left and the striker's board at
// the right, lateral x runs up the screen. Heights always lift straight up.
export function fitCam(stage, wm, dm, cx, cy, land, zSpace = 2.3) {
  let s, k;
  if (!land) {
    s = stage.w / wm;
    k = clamp((stage.h - zSpace * s) / (dm * s), 0.5, 0.95);
    if ((dm * k + zSpace) * s > stage.h) s = stage.h / (dm * k + zSpace);
    return { land, s, k, ox: stage.x + stage.w / 2 - cx * s, oy: stage.y + stage.h - 0.25 * s + (cy - dm / 2) * s * k, stage };
  }
  s = stage.w / dm;
  k = clamp((stage.h - zSpace * s) / (wm * s), 0.5, 0.95);
  if ((wm * k + zSpace) * s > stage.h) s = stage.h / (wm * k + zSpace);
  return { land, s, k, ox: stage.x + stage.w / 2 + cy * s, oy: stage.y + stage.h / 2 + 0.35 * zSpace * s + cx * s * k, stage };
}
// The follow camera of the field view: centre (cx, cy) in metres, wm = metres across the screen's horizontal axis.
export function followCam(stage, land, cx, cy, wm, k = 0.8) {
  const s = stage.w / wm;
  if (!land) return { land, s, k, ox: stage.x + stage.w / 2 - cx * s, oy: stage.y + stage.h * 0.56 + cy * s * k, stage };
  return { land, s, k, ox: stage.x + stage.w / 2 + cy * s, oy: stage.y + stage.h * 0.56 + cx * s * k, stage };
}
// project a world point to the stage: returns [sx, sy]
export function proj(cam, x, y, z = 0) {
  if (!cam.land) return [cam.ox + x * cam.s, cam.oy - y * cam.s * cam.k - z * cam.s];
  return [cam.ox - y * cam.s, cam.oy - x * cam.s * cam.k - z * cam.s];
}
// unproject a stage point to the ground plane (z = 0)
export function unproj(cam, sx, sy) {
  if (!cam.land) return { x: (sx - cam.ox) / cam.s, y: (cam.oy - sy) / (cam.s * cam.k) };
  return { x: (cam.oy - sy) / (cam.s * cam.k), y: (cam.ox - sx) / cam.s };
}
// pixels per metre at ground depth (for sprite size)
export const mpx = (cam) => cam.s;

// The pitch camera: the striker's end and the bowler. The field camera: the whole rope circle.
export function cams(stage, land) {
  const pitch = land ? fitCam(stage, 13, 12.6, 0, 3.6, true) : fitCam(stage, 9, 15, 0, 5.2, false);
  const field = land ? fitCam(stage, 60, 62, 0, 6.85, true, 1.5) : fitCam(stage, 60, 62, 0, 6.85, false, 1.5);
  return { pitch, field };
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
