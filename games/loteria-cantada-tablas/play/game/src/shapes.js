// Tiny vector toolkit for the folk-art card pictures. Pure functions: they build SVG-style path
// strings (absolute M L H V Q C Z only) and a small painter that fills + inks them on a canvas
// context. Every picture in icons.js is authored on a 100 x 100 box.
export const INK = '#2a1430';

const f = (n) => Math.round(n * 100) / 100;

// ---- path builders --------------------------------------------------------------------------------
const rotPt = (x, y, cx, cy, deg) => {
  if (!deg) return [x, y];
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};
export function ell(cx, cy, rx, ry, deg = 0) {
  const k = 0.5523;
  const raw = [[-rx, 0], [-rx, -ry * k], [-rx * k, -ry], [0, -ry], [rx * k, -ry], [rx, -ry * k], [rx, 0], [rx, ry * k], [rx * k, ry], [0, ry], [-rx * k, ry], [-rx, ry * k], [-rx, 0]];
  const p = raw.map(([x, y]) => { const [a, b] = rotPt(cx + x, cy + y, cx, cy, deg); return `${f(a)} ${f(b)}`; });
  return `M${p[0]} C${p[1]},${p[2]},${p[3]} C${p[4]},${p[5]},${p[6]} C${p[7]},${p[8]},${p[9]} C${p[10]},${p[11]},${p[12]} Z`;
}
export const cir = (cx, cy, r) => ell(cx, cy, r, r);
export function poly(...n) {
  let s = '';
  for (let i = 0; i < n.length; i += 2) s += `${i ? 'L' : 'M'}${f(n[i])} ${f(n[i + 1])} `;
  return `${s}Z`;
}
export function rr(x, y, w, h, r) {
  return `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}
export function star(cx, cy, R, r, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180, rad = i % 2 ? r : R;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  return poly(...pts);
}
// Smooth closed (sm) or open (sp) curve through points (Catmull-Rom -> cubic Bezier).
function spline(pts, closed) {
  const P = [];
  for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
  const n = P.length, at = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  let s = `M${f(P[0][0])} ${f(P[0][1])} `;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    s += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)},${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)},${f(p2[0])} ${f(p2[1])} `;
  }
  return closed ? `${s}Z` : s;
}
export const sm = (...n) => spline(n, true);
export const sp = (...n) => spline(n, false);

// ---- colour helpers -------------------------------------------------------------------------------
export function hexRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function mix(h, to, t) {
  const a = hexRgb(h), b = typeof to === 'string' ? hexRgb(to) : to;
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export const lighten = (h, t) => mix(h, [255, 248, 230], t);
export const darken = (h, t) => mix(h, [40, 16, 48], t);

// ---- layer constructors (icons.js) ----------------------------------------------------------------
// F: lit fill + ink outline. N: flat fill, no outline (details). K: plain line. T: thick inked line.
export const F = (fill, d, o) => ({ k: 'F', fill, d, ...o });
export const N = (fill, d, o) => ({ k: 'N', fill, d, ...o });
export const K = (stroke, w, d, o) => ({ k: 'K', stroke, w, d, ...o });
export const T = (stroke, w, d, o) => ({ k: 'T', stroke, w, d, ...o });
// Rotate a group of layers around (cx, cy).
export const R = (deg, layers, cx = 50, cy = 50) => layers.map((l) => ({ ...l, rot: [deg, cx, cy] }));

// ---- path interpreter -----------------------------------------------------------------------------
export function tracePath(ctx, d) {
  const t = d.match(/[MLHVQCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0, cmd = 'M', x = 0, y = 0, sx = 0, sy = 0;
  const num = () => parseFloat(t[i++]);
  ctx.beginPath();
  while (i < t.length) {
    if (/[A-Z]/.test(t[i])) cmd = t[i++];
    switch (cmd) {
      case 'M': x = num(); y = num(); sx = x; sy = y; ctx.moveTo(x, y); cmd = 'L'; break;
      case 'L': x = num(); y = num(); ctx.lineTo(x, y); break;
      case 'H': x = num(); ctx.lineTo(x, y); break;
      case 'V': y = num(); ctx.lineTo(x, y); break;
      case 'Q': { const a = num(), b = num(); x = num(); y = num(); ctx.quadraticCurveTo(a, b, x, y); break; }
      case 'C': { const a = num(), b = num(), c = num(), e = num(); x = num(); y = num(); ctx.bezierCurveTo(a, b, c, e, x, y); break; }
      case 'Z': ctx.closePath(); x = sx; y = sy; break;
      default: i++;
    }
  }
}

// Paint one picture (an array of layers) into the 100x100 box at the context's current transform.
export function paintLayers(ctx, layers, lw = 2.6) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const L of layers) {
    ctx.save();
    if (L.rot) { ctx.translate(L.rot[1], L.rot[2]); ctx.rotate((L.rot[0] * Math.PI) / 180); ctx.translate(-L.rot[1], -L.rot[2]); }
    if (L.alpha != null) ctx.globalAlpha = L.alpha;
    tracePath(ctx, L.d);
    if (L.k === 'F') {
      ctx.strokeStyle = L.ink ?? INK; ctx.lineWidth = (L.w ?? lw) * 2; ctx.stroke();
      const g = ctx.createLinearGradient(15, 10, 85, 92);
      g.addColorStop(0, lighten(L.fill, 0.34)); g.addColorStop(0.5, L.fill); g.addColorStop(1, darken(L.fill, 0.22));
      ctx.fillStyle = g; ctx.fill();
    } else if (L.k === 'N') {
      ctx.fillStyle = L.fill; ctx.fill();
      if (L.line) { ctx.strokeStyle = L.line; ctx.lineWidth = L.lw ?? 1.4; ctx.stroke(); }
    } else if (L.k === 'K') {
      ctx.strokeStyle = L.stroke; ctx.lineWidth = L.w; ctx.stroke();
    } else if (L.k === 'T') {
      ctx.strokeStyle = L.ink ?? INK; ctx.lineWidth = L.w + lw * 2; ctx.stroke();
      ctx.strokeStyle = L.stroke; ctx.lineWidth = L.w; ctx.stroke();
    }
    ctx.restore();
  }
}
