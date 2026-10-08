// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio, so
// the live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; syncSize() copies it into the live bindings W and H (the game calls it every frame).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

// Safe areas and the host's floating back button in virtual units (main.js keeps this current; browsers: all zero).
// px = CSS pixels per virtual unit (0 = unknown).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 24) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// ---- the play screen ----------------------------------------------------------------------------------------------
// Portrait: two score cards on top, a one-line info strip, the floor scene, then strength, twist and the button row.
// Landscape: the floor scene on the left, one panel on the right with the cards, info, sliders and buttons.
// HUD text follows the text-size setting up to 160% (the menus and pages follow it fully); the scene takes whatever is left.
const cache = new Map();
export function playLayout(z = 1, watch = false) {
  const key = `${W}x${H}|${z}|${watch ? 1 : 0}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    L = W > H ? landscape(z, watch) : portrait(z, watch);
    L.key = key; L.w = W; L.h = H; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const fontsFor = (hz, mf) => {
  const f = (b) => Math.round(Math.max(b, mf) * hz);
  return { name: f(24), sub: f(16), score: f(34), info: f(21), slider: f(19), btn: f(26), demoBtn: f(22), toast: f(21), pip: f(16) };
};

function portrait(z) { return build(z, false); }
function landscape(z) { return build(z, true); }

function build(z, land) { return buildImpl(z, land); }
function buildImpl(z, land) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf);
  const g = 10;
  if (!land) {
    const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
    const top = host.t + 66 + T, bb = Math.max(0, host.b - 8), M = Math.max(18, host.l, host.r);
    const cw = (W - 2 * M - g) / 2, cardH = Math.round(Math.max(92, fs.name * 1.2 + fs.sub * 1.3 + fs.pip * 1.6 + 24));
    const cards = [R(M, top, cw, cardH), R(M + cw + g, top, cw, cardH)];
    const infoH = Math.round(Math.max(52, fs.info * 2.5 + 8)), info = R(M, top + cardH + g, W - 2 * M, infoH);
    const btnH = tap(Math.round(Math.max(66, fs.btn * 2.1))), sh = tap(Math.round(Math.max(70, fs.slider * 1.25 + 52)));
    const yBtn = H - 10 - bb - btnH, yTw = yBtn - 6 - sh, ySt = yTw - 4 - sh;
    const dBtn = tap(Math.round(Math.max(60, fs.demoBtn * 2.2)));
    const demoY = H - 10 - bb - 2 * dBtn - g;
    const hintW = Math.round((W - 2 * M) * 0.26), thrW = (W - 2 * M) - 2 * hintW - 2 * g;
    const L = {
      land: false, z, hz, fs, cards, info, M, topPad: top,
      strength: R(M, ySt, W - 2 * M, sh), twist: R(M, yTw, W - 2 * M, sh),
      hint: R(M, yBtn, hintW, btnH), throw: R(M + hintW + g, yBtn, thrW, btnH), menu: R(M + hintW + g + thrW + g, yBtn, hintW, btnH),
      demo: { dec: R(M, demoY, hintW, dBtn), pause: R(M + hintW + g, demoY, thrW, dBtn), inc: R(M + hintW + g + thrW + g, demoY, hintW, dBtn), exit: R(M, demoY + dBtn + g, W - 2 * M, dBtn) },
    };
    const zTop = info.y + info.h + 2;
    L.ctrlTop = ySt - 4; L.demoTop = demoY - 4;
    L.zone = R(0, zTop, W, L.ctrlTop - zTop);
    L.zoneWatch = R(0, zTop, W, L.demoTop - zTop);
    return L;
  }
  // landscape
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const pw = Math.round(clamp(U.w * 0.34 * (1 + (hz - 1) * 0.35), 340, 520)), px0 = U.x1 - pw - 14, M = 0;
  const cardH = Math.round(Math.max(88, fs.name * 1.2 + fs.sub * 1.3 + fs.pip * 1.6 + 24));
  const infoH = Math.round(Math.max(54, fs.info * 3.1 + 8));
  const sh = tap(Math.round(Math.max(70, fs.slider * 1.25 + 52))), btnH = tap(Math.round(Math.max(64, fs.btn * 2.1)));
  const dBtn = tap(Math.round(Math.max(58, fs.demoBtn * 2.2)));
  const topPad = Math.max(host.t + 12, 12) + (host.back && px0 < host.l + host.back + 20 ? host.back : 0);
  const need = 2 * cardH + infoH + 2 * sh + btnH + 7 * g, free = U.y1 - topPad - 10;
  const f = Math.min(1, free / need);
  const S = (v) => Math.round(v * f);
  const cH = S(cardH), iH = S(infoH), sH = S(sh), bH = S(btnH);
  let y = topPad;
  const cards = [R(px0, y, pw, cH), R(px0, y + cH + g, pw, cH)]; y += 2 * cH + g + g;
  const info = R(px0, y, pw, iH); y += iH + g;
  const yBtn = U.y1 - 10 - bH, yTw = yBtn - g - sH, ySt = yTw - 4 - sH;
  const hw = Math.round((pw - 2 * g) * 0.28), tw = pw - 2 * hw - 2 * g;
  const dB = S(dBtn), dTop = U.y1 - 10 - (3 * dB + 2 * g);
  const L = {
    land: true, z, hz, fs, cards, info, M, topPad, f, pw, px0,
    strength: R(px0, ySt, pw, sH), twist: R(px0, yTw, pw, sH),
    hint: R(px0, yBtn, hw, bH), throw: R(px0 + hw + g, yBtn, tw, bH), menu: R(px0 + hw + g + tw + g, yBtn, hw, bH),
    demo: { pause: R(px0, dTop, pw, dB), dec: R(px0, dTop + dB + g, (pw - g) / 2, dB), inc: R(px0 + (pw + g) / 2, dTop + dB + g, (pw - g) / 2, dB), exit: R(px0, dTop + 2 * (dB + g), pw, dB) },
    ctrlTop: ySt - 4, demoTop: dTop - 4,
  };
  L.zone = R(U.x0 + 8, 6, px0 - U.x0 - 20, H - 12);
  L.zoneWatch = L.zone;
  L.overflow = ySt < y + 4;
  return L;
}

// A slider's track and knob geometry inside its rect.
export function sliderGeom(r, centered) {
  const padX = 34, y = r.y + r.h * 0.68;
  return { x0: r.x + padX, x1: r.x + r.w - padX, y, labelY: r.y + r.h * 0.3, centered, cx: r.x + r.w / 2 };
}
export const sliderValue = (r, x, centered) => {
  const g = sliderGeom(r, centered), t = clamp((x - g.x0) / (g.x1 - g.x0), 0, 1);
  return centered ? t * 2 - 1 : t;
};

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
// Portrait: text size controls top right, Back / Done along the bottom. Landscape: one bottom row Back | A- 100% A+ | Done.
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

// Setup screen pins (Start / Back).
export function setupPins() {
  const bb = Math.max(0, host.b - 10), h = tap(96);
  if (W > H) {
    const cw = Math.min(640, W - 80), x0 = Math.round((W - cw) / 2), by = H - host.b - 16, ph = tap(84);
    const sw = Math.round(cw * 0.66);
    return { start: R(x0, by - ph, sw, ph), back: R(x0 + sw + 12, by - ph, cw - sw - 12, ph) };
  }
  return { start: R(30, H - 124 - bb + (96 - h), 440, h), back: R(486, H - 124 - bb + (96 - h), 204, h) };
}
