// The fluid frame (kit fluid viewport: the SHORT side is always 720 units, the long side follows the screen).
//
// Every classic screen of this game is composed in a 720 x 1560 portrait "design space" (theme.js W x H). The frame decides how
// that composition lands on the live screen, and the same mapping is used to draw it and to read the pointer, so a thing is
// always tappable exactly where it is drawn:
//
//   stage   the whole 720 x 1560 composition, scaled down to fit and centred; the sky art fills every other pixel (no bars).
//           Used in portrait (phones, tablets) and whenever it is the largest fit.
//   bands   landscape / wide windows: the composition is cut at natural seams into two pieces drawn side by side, each a
//           full-height column (e.g. battle: enemies and header on the left, archer + hand + buttons on the right). Each piece
//           keeps the portrait scale (up to 1:1), so text and tap targets stay as large as in portrait.
//   native  screens that lay themselves out from the live size (the scrolling reader, the card grid, card close-up).
//
// Safe areas: the shell publishes window.__safeInsets (CSS px); main.js converts them to virtual units into `host`.
import { W, H } from './theme.js';

// Safe areas and the host's floating back button in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// Landscape cut lines per screen kind. Each entry is a list of bands drawn left to right; a band is a list of design-space
// y ranges [y0, y1) stacked top to bottom (so dead space between two ranges can be dropped). Kinds not listed use the stage.
export const BANDS = {
  'sc:title': [[[150, 1030]], [[1030, 1520]]],
  'sc:map': [[[90, 640]], [[640, 1520]]],
  'sc:battle': [[[90, 1005]], [[1005, 1520]]],
  'sc:reward': [[[90, 548]], [[548, 930], [1290, 1500]]],
  'sc:camp': [[[90, 460]], [[460, 1040], [1290, 1510]]],
  'sc:envoy': [[[90, 720]], [[740, 1400]]],
  'sc:tuner': [[[90, 480]], [[480, 1100], [1290, 1500]]],
  'sc:runover': [[[150, 560]], [[560, 1260], [1290, 1535]]],
  'sc:demo-limit': [[[430, 1040]]],
  'ov:newrun': [[[200, 760]], [[760, 1300]]],
  'ov:confirmFoul': [[[480, 1050], [1290, 1500]]],
  'ov:covenant': [[[130, 946]], [[948, 1440]]],
  'ov:options': [[[300, 500]], [[500, 1280], [1350, 1450]]],
  // Auto Play: the scene alone on the left, the caption / think-time stepper and the Skip / Pause / Exit row as a side panel on the right.
  'auto:map': [[[300, 860]], [[90, 272], [1420, 1504]]],
  'auto:battle': [[[276, 640], [1230, 1410]], [[90, 272], [1420, 1504]]],
  'auto:reward': [[[300, 700]], [[90, 272], [1420, 1504]]],
  'auto:camp': [[[300, 860]], [[90, 272], [1420, 1504]]],
  'auto:envoy': [[[300, 900]], [[90, 272], [1420, 1504]]],
  'auto:tuner': [[[300, 700]], [[90, 272], [1420, 1504]]],
  'auto:runover': [[[300, 600], [1300, 1400]], [[90, 272], [1420, 1504]]],
};

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });

export function frameFor(w, h, kind) {
  const key = `${Math.round(w * 10)}x${Math.round(h * 10)}|${kind}|${host.t | 0},${host.r | 0},${host.b | 0},${host.l | 0}`;
  let F = cache.get(key);
  if (!F) {
    F = build(w, h, kind);
    F.key = key;
    cache.set(key, F);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return F;
}

// A "piece" is one clipped, transformed draw of a design y range: { y0, y1, ox, oy, f, col, clip, band }.
function build(w, h, kind) {
  const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b };
  U.w = U.x1 - U.x0;
  U.h = U.y1 - U.y0;
  const screen = R(0, 0, w, h);
  if (kind === 'native') return { mode: 'native', f: 1, U, screen, tight: false, bands: 1, pieces: [{ y0: 0, y1: h, ox: 0, oy: 0, f: 1, col: screen, clip: screen, band: 0 }] };

  const fs = Math.max(0.2, Math.min(1, U.w / W, U.h / H));
  const stage = { mode: 'stage', f: fs, U, screen, tight: false, bands: 1, pieces: [{ y0: 0, y1: H, ox: U.x0 + (U.w - W * fs) / 2, oy: U.y0 + (U.h - H * fs) / 2, f: fs, col: screen, clip: null, band: 0 }] };
  const spec = BANDS[kind];
  if (!spec || w < h) return stage;
  const n = spec.length;
  const colW = U.w / n;
  const fits = spec.map((segs) => Math.max(0.2, Math.min(1, colW / W, U.h / segs.reduce((t, [a, b]) => t + (b - a), 0))));
  const fmin = Math.min(...fits);
  if (fmin <= fs * 1.08) return stage;
  const pieces = [];
  spec.forEach((segs, bi) => {
    const f = fits[bi];
    const col = R(U.x0 + bi * colW, 0, colW, h);
    const ox = col.x + (colW - W * f) / 2;
    let y = U.y0 + (U.h - segs.reduce((t, [a, b]) => t + (b - a), 0) * f) / 2;
    for (const [y0, y1] of segs) {
      const oy = y - y0 * f;
      pieces.push({ y0, y1, ox, oy, f, col, clip: R(ox, y, W * f, (y1 - y0) * f), band: bi });
      y += (y1 - y0) * f;
    }
  });
  return { mode: 'bands', f: fmin, U, screen, tight: true, bands: n, pieces };
}

// Screen point -> design point (the column that holds x; y snapped into the nearest piece of that column).
export function toDesign(F, x, y) {
  if (F.mode !== 'bands') {
    const b = F.pieces[0];
    return { x: (x - b.ox) / b.f, y: (y - b.oy) / b.f };
  }
  let bi = F.bands - 1;
  for (const pc of F.pieces) if (x < pc.col.x + pc.col.w) { bi = pc.band; break; }
  let best = null;
  let bestD = Infinity;
  for (const pc of F.pieces) {
    if (pc.band !== bi) continue;
    const top = pc.oy + pc.y0 * pc.f;
    const bot = pc.oy + pc.y1 * pc.f;
    const d = y < top ? top - y : y > bot ? y - bot : 0;
    if (d < bestD) { bestD = d; best = pc; }
  }
  const top = best.oy + best.y0 * best.f;
  const sy = Math.max(top, Math.min(best.oy + best.y1 * best.f, y));
  return { x: (x - best.ox) / best.f, y: (sy - best.oy) / best.f };
}

// Design rect -> screen rect through the piece that holds it (null when it straddles pieces).
export function toScreenRect(F, r) {
  const pc = F.pieces.find((p) => r.y >= p.y0 - 1 && r.y + r.h <= p.y1 + 1);
  if (!pc) return null;
  return { x: pc.ox + r.x * pc.f, y: pc.oy + r.y * pc.f, w: r.w * pc.f, h: r.h * pc.f };
}

// Runs draw(piece) once per piece inside that piece's clip and transform (column = clip to the whole column: the sky).
export function drawBands(ctx, F, draw, { column = false } = {}) {
  const seen = new Set();
  for (const pc of F.pieces) {
    if (column) {
      if (seen.has(pc.band)) continue;
      seen.add(pc.band);
    }
    ctx.save();
    const c = column ? pc.col : pc.clip;
    if (c) {
      ctx.beginPath();
      ctx.rect(c.x, c.y, c.w, c.h);
      ctx.clip();
    }
    ctx.translate(pc.ox, pc.oy);
    ctx.scale(pc.f, pc.f);
    draw(pc);
    ctx.restore();
  }
}

// The sky gradient (same stops as draw.js drawStaticScene), extended to every pixel of each column.
export function paintSkyBase(ctx, F, stops) {
  const seen = new Set();
  for (const pc of F.pieces) {
    if (seen.has(pc.band)) continue;
    seen.add(pc.band);
    const g = ctx.createLinearGradient(0, pc.oy, 0, pc.oy + H * pc.f);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(pc.col.x, pc.col.y, pc.col.w, pc.col.h);
    ctx.restore();
  }
}
