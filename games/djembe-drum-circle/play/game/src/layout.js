// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the
// screen, up to 2.4:1). layoutFor(w, h) returns every rectangle the game draws or hit-tests; update() and render() share it, so
// a button is always exactly where it is drawn. Two shapes: portrait (phones, tablets held upright) and landscape (side panels).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, zoom: 1 };

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|z${host.zoom}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// A centred column of n equal buttons.
function column(x, y, w, n, bh, gap) { return Array.from({ length: n }, (_, i) => R(x, y + i * (bh + gap), w, bh)); }
// A grid of cells that fills a rectangle.
function grid(r, cols, rows, gap) {
  const cw = (r.w - gap * (cols - 1)) / cols, ch = (r.h - gap * (rows - 1)) / rows, out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push(R(r.x + i * (cw + gap), r.y + j * (ch + gap), cw, ch));
  return out;
}

function build(w, h, ins) {
  const land = w > h * 1.05;
  const pad = Math.max(22, ins.l, ins.r);
  const back = ins.back > 0 ? Math.max(ins.back, 56) : 0;
  const top = ins.t + 8, bottom = ins.b + 12;
  const L = { w, h, land, ins, pad, back, top, bottom, px: host.px, zoom: host.zoom };
  L.safe = R(ins.l, ins.t, w - ins.l - ins.r, h - ins.t - ins.b);
  L.title = titleLayout(L);
  L.play = playLayout(L);
  L.page = pageLayout(L);
  L.modal = (bw, bh) => { bw = Math.min(bw, w - 2 * pad), bh = Math.min(bh, h - top - bottom); return R((w - bw) / 2, clamp((h - bh) / 2, top, h - bottom - bh), bw, bh); };
  return L;
}

// ---- title ---------------------------------------------------------------------------------------------------------------------
function titleLayout(L) {
  const { w, h, land, pad, top, bottom, zoom } = L;
  const T = { cards: [], pills: [], zoom };
  if (!land) {
    const avail = h - top - bottom, sc = clamp(avail / 1480, 0.62, 1), gz = 1 + (zoom - 1) * 0.28, one = zoom >= 2;
    T.sc = sc;
    const cw = Math.min(w - 2 * pad, 700), cx = (w - cw) / 2;
    const titleH = (250 - (zoom > 1 ? 30 : 0)) * sc + L.back * 0.2, gap = 14 * sc, credit = 74 * sc;
    let cardH = 144 * sc * gz, pillH = 62 * sc * gz;
    T.titleY = top + (L.back ? Math.max(0, L.back - 38) : 0) + 40 * sc;
    T.titleBox = R(cx, T.titleY, cw, titleH);
    const crow = one ? 4 : 2, prow = one ? 3 : 2;
    // the menu never grows over the title: squeeze the buttons if the text zoom asks for more height than there is
    const room = h - bottom - credit - gap - (T.titleY + titleH + gap), want = cardH * crow + pillH * prow + gap * (crow + prow);
    if (want > room) { const f = Math.max(0.5, (room - gap * (crow + prow)) / (want - gap * (crow + prow))); cardH *= f; pillH *= f; }
    const cardsH = cardH * crow + gap * (crow - 1), pillsH = pillH * prow + gap * (prow - 1);
    const cardsY = h - bottom - credit - gap - pillsH - gap - cardsH;
    T.cards = grid(R(cx, cardsY, cw, cardsH), one ? 1 : 2, crow, gap);
    T.pills = one ? pillGrid2(R(cx, cardsY + cardsH + gap, cw, pillsH), gap) : pillGrid(R(cx, cardsY + cardsH + gap, cw, pillsH), gap);
    T.credit = R(cx, h - bottom - credit, cw, credit);
    const artTop = T.titleBox.y + titleH, artBot = cardsY - gap;
    T.art = R(0, artTop, w, Math.max(0, artBot - artTop));
    T.drum = drumGeom(R(0, artTop, w, Math.max(120, artBot - artTop)), false, true);
    T.showDrum = artBot - artTop >= 230;
  } else {
    const sc = clamp((h - top - bottom) / 640, 0.72, 1.1), gz = 1 + (zoom - 1) * 0.17;
    T.sc = sc;
    const half = Math.min(w * 0.46, 760), lx = Math.max(pad, L.ins.l + 20);
    const rw = Math.min(w - half - lx - pad - 20, 760), rx = w - pad - rw;
    const titleH = 190 * sc;
    T.titleBox = R(lx, top + 6, half - lx, titleH);
    T.art = R(0, T.titleBox.y + titleH - 30 * sc, rx - 20, h - bottom - (T.titleBox.y + titleH - 30 * sc));
    const gap = 14 * sc, cardH = 128 * sc * gz, pillH = 58 * sc * gz, credit = 60 * sc;
    const cardsY = top + 12;
    T.cards = grid(R(rx, cardsY, rw, cardH * 2 + gap), 2, 2, gap);
    const py = cardsY + cardH * 2 + gap * 2;
    T.pills = pillGrid(R(rx, py, rw, pillH * 2 + gap), gap);
    T.credit = R(rx, h - bottom - credit, rw, credit);
    T.drum = drumGeom(T.art, true, true);
    T.showDrum = true;
  }
  return T;
}
function pillGrid2(r, gap) {
  // five pills in two columns (large text): 2 + 2 + 1
  const rowH = (r.h - 2 * gap) / 3, w2 = (r.w - gap) / 2, out = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) out.push(R(r.x + i * (w2 + gap), r.y + j * (rowH + gap), w2, rowH));
  out.push(R(r.x, r.y + 2 * (rowH + gap), r.w, rowH));
  return out;
}
function pillGrid(r, gap) {
  // five pills: Auto Play, How to Play, Rules, About, Settings  ->  3 + 2
  const out = [], rowH = (r.h - gap) / 2, w3 = (r.w - 2 * gap) / 3, w2 = (r.w - gap) / 2;
  for (let i = 0; i < 3; i++) out.push(R(r.x + i * (w3 + gap), r.y, w3, rowH));
  for (let i = 0; i < 2; i++) out.push(R(r.x + i * (w2 + gap), r.y + rowH + gap, w2, rowH));
  return out;
}

// ---- play ----------------------------------------------------------------------------------------------------------------------
function playLayout(L, ex = { row: 0, chip: 0, pass: 0 }) {
  const { w, h, land, pad, top, bottom, back } = L;
  const P = { land };
  const mid = land && w < h * 1.5;                       // 4:3 style landscape (tablets): the circle becomes a row on top, not a side panel
  P.mid = mid;
  const laneRowH = (land ? 44 : 54) + ex.row + (mid ? 8 : 0), laneH = laneRowH * 3 + (land ? 36 : 40);
  P.rowH = laneRowH;
  if (!land) {
    const x = pad, cw = w - 2 * pad;
    P.hdr = R(x, top, cw, 72);
    const compact = h < 1250;
    const chipH = (compact ? 92 : 112) + ex.chip;
    P.circle = R(x, P.hdr.y + P.hdr.h + 4, cw, chipH);
    P.lane = R(x, P.circle.y + chipH + 8, cw, laneH);
    P.status = R(x, P.lane.y + laneH + 6, cw, 58);
    const barH = compact ? 92 : 108;
    P.bar = R(x, h - bottom - barH, cw, barH);
    P.drumRegion = R(0, P.status.y + P.status.h + 4, w, P.bar.y - 8 - (P.status.y + P.status.h + 4));
    P.pause = R(x + cw - 168, P.hdr.y, 168, 64);
    const sh = back ? Math.max(0, L.ins.l + back + 10 - x) : 0;
    P.titleBox = R(x + sh, P.hdr.y, cw - 180 - sh, 72);
    P.btn = (n) => rowButtons(P.bar, n);
    P.chips = (k) => rowChips(P.circle, k);
    P.panelL = P.panelR = null;
  } else {
    const pw = clamp(w * (mid ? 0.19 : 0.2), mid ? 200 : 210, 330);
    const lx = Math.max(L.ins.l + 12, 16), rxp = w - Math.max(L.ins.r + 12, 16) - pw;
    P.panelR = R(rxp, top + 4, pw, h - bottom - top - 4);
    P.titleBox = R(P.panelR.x, P.panelR.y, pw, 124);
    P.pause = R(P.panelR.x, P.panelR.y + 128, pw, 64);
    P.btn = (n) => column(P.panelR.x, P.panelR.y + 204, pw, n, 64, 12);
    P.bar = null; P.hdr = null;
    if (!mid) {
      P.panelL = R(lx, top + (back ? back + 8 : 4), pw, h - bottom - top - (back ? back + 8 : 4));
      const cx0 = lx + pw + 18, cx1 = rxp - 18;
      P.lane = R(cx0, top + 4, cx1 - cx0, laneH);
      P.status = R(cx0, P.lane.y + laneH + 4, cx1 - cx0, 52);
      P.drumRegion = R(cx0 - 10, P.status.y + P.status.h + 2, cx1 - cx0 + 20, h - bottom - (P.status.y + P.status.h + 2));
      P.circle = P.panelL;
      P.chips = (k) => {
        const gap = 8, bh = clamp((P.panelL.h - 70 - gap * (k - 1)) / Math.max(1, k), 56, 96);
        return Array.from({ length: k }, (_, i) => R(P.panelL.x, P.panelL.y + i * (bh + gap), pw, bh));
      };
    } else {
      P.panelL = null;
      const cx0 = lx + (back ? back + 8 : 0), cx1 = rxp - 18, chipH = 84;
      P.circle = R(cx0, top + 4, cx1 - cx0, chipH);
      P.chips = (k) => rowChips(P.circle, k);
      P.lane = R(cx0, P.circle.y + chipH + 6, cx1 - cx0, laneH);
      P.status = R(cx0, P.lane.y + laneH + 4, cx1 - cx0, 52);
      P.drumRegion = R(lx - 6, P.status.y + P.status.h + 2, cx1 - lx + 12, h - bottom - (P.status.y + P.status.h + 2));
    }
  }
  P.hitX = P.lane.x + P.lane.w * 0.2;
  P.laneTop = P.lane.y + 36;
  P.drum = drumGeom(P.drumRegion, land);
  if (ex.pass === 0 && (!land || mid)) {
    // spare height goes into a roomier timeline and chip row, so the screen is filled rather than left with empty sky
    const need = P.drum.rx * (DRUM_RY + DRUM_BODY) + 56, slack = P.drumRegion.h - need;
    if (slack > 24) return playLayout(L, { pass: 1, row: Math.min(land ? 12 : 30, Math.floor(slack * 0.5 / 3)), chip: land ? 0 : Math.min(40, Math.floor(slack * 0.22)) });
  }
  return P;
}
function rowButtons(r, n) {
  const gap = 12, bw = (r.w - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => R(r.x + i * (bw + gap), r.y + 6, bw, r.h - 12));
}
function rowChips(r, k) {
  const gap = 10, cw = (r.w - gap * (k - 1)) / k;
  return Array.from({ length: k }, (_, i) => R(r.x + i * (cw + gap), r.y, cw, r.h));
}

// The drum's skin is an ellipse (cx, cy, rx, ry); the body hangs below it and is cropped by the region when the room is short.
export const DRUM_RY = 0.58, DRUM_BODY = 1.7;
export function drumGeom(reg, land, whole = false) {
  const maxRx = reg.w * (land ? 0.44 : 0.47);
  // the head and at least ~0.55 rx of body must fit; a full body (0.58 + 1.7 + margins) is shown when there is room
  let rx = Math.min(maxRx, whole ? (reg.h - 24) / (DRUM_RY + DRUM_BODY + 0.1) : (reg.h - 12) / (DRUM_RY + 0.62));
  const full = rx * (DRUM_RY + DRUM_BODY) + 28;
  rx = Math.max(rx, 120);
  let cy = reg.y + rx * DRUM_RY + 12;
  if (full < reg.h) cy += Math.min((reg.h - full) * 0.5, 120);
  return { cx: reg.x + reg.w / 2, cy, rx, ry: rx * DRUM_RY, clip: reg };
}

// ---- pages (Rules, About, How to Play, Settings, lists) --------------------------------------------------------------------------
function pageLayout(L) {
  const { w, h, land, pad, top, bottom, back } = L;
  const G = {};
  const cw = Math.min(w - 2 * pad, land ? 1040 : 720), x = (w - cw) / 2;
  G.col = R(x, 0, cw, h);
  G.hdr = R(x, top, cw, 72);
  G.titleX = back ? Math.max(x, L.ins.l + back + 10) : x;
  G.nav = R(x, h - bottom - 84, cw, 84);
  G.body = R(x, G.hdr.y + G.hdr.h + 10, cw, G.nav.y - 12 - (G.hdr.y + G.hdr.h + 10));
  G.back = R(x, G.nav.y, Math.min(240, cw * 0.28), 84);
  G.next = R(x + cw - Math.min(240, cw * 0.28), G.nav.y, Math.min(240, cw * 0.28), 84);
  G.zoomDec = R(x + cw - 218, G.hdr.y + 6, 100, 60);
  G.zoomInc = R(x + cw - 108, G.hdr.y + 6, 100, 60);
  G.scrollbar = R(x + cw - 10, G.body.y, 8, G.body.h);
  return G;
}
