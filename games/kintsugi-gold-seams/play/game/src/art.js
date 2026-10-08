// Painting for Kintsugi: glazed vessels (procedural, lit from the upper left), baked shard bitmaps, cracks and liquid gold.
// All drawing happens in WORLD units (1000 x 1000); callers apply the board transform first.
import { rngOf } from './geom.js';

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const parse = (s) => { const [name, rest] = s.split(':'); return { name, col: rest ? rest.split(',').map(Number) : [40, 40, 40] }; };
const path = (g, poly) => { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };

// ---- motifs ----------------------------------------------------------------------------------------------------------------
function petal5(g, x, y, r, rot, col, centre) {
  g.fillStyle = rgba(col, 0.96);
  for (let k = 0; k < 5; k++) {
    const a = rot + (k * Math.PI * 2) / 5;
    g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.55, r * 0.46, a, 0, 7); g.fill();
  }
  g.fillStyle = rgba(centre, 0.95); g.beginPath(); g.arc(x, y, r * 0.2, 0, 7); g.fill();
}
const M = {
  drip(g, V, rnd, col) {
    const b = V.bounds, pts = [], drips = [];
    for (let i = 0; i < 7; i++) drips.push({ x: b.x0 + b.w * (0.08 + 0.84 * ((i + rnd() * 0.7) / 7)), w: 14 + rnd() * 22, len: b.h * (0.05 + rnd() * 0.3) });
    const base = b.y0 + b.h * 0.14;
    for (let x = b.x0 - 4; x <= b.x1 + 4; x += 4) {
      let y = base + Math.sin(x * 0.045) * 6;
      for (const d of drips) { const u = (x - d.x) / d.w; if (Math.abs(u) < 1.4) y = Math.max(y, base + d.len * Math.exp(-u * u * 1.6)); }
      pts.push([x, y]);
    }
    g.beginPath(); g.moveTo(b.x0 - 6, b.y0 - 40); pts.forEach((p) => g.lineTo(p[0], p[1])); g.lineTo(b.x1 + 6, b.y0 - 40); g.closePath();
    const gr = g.createLinearGradient(0, b.y0, 0, base + 80); gr.addColorStop(0, rgba(col, 0.96)); gr.addColorStop(0.7, rgba(col, 0.9)); gr.addColorStop(1, rgba(mixc(col, [90, 50, 30], 0.5), 0.9));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = rgba(shade(col, 0.55), 0.35); g.lineWidth = 2; g.stroke();
  },
  speckle(g, V, rnd, col) {
    const b = V.bounds;
    for (let i = 0; i < 190; i++) { g.fillStyle = rgba(col, 0.25 + rnd() * 0.45); g.beginPath(); g.arc(b.x0 + rnd() * b.w, b.y0 + rnd() * b.h, 0.7 + rnd() * 2, 0, 7); g.fill(); }
  },
  crackle(g, V, rnd, col) {
    const b = V.bounds; g.strokeStyle = rgba(col, 0.32); g.lineWidth = 1; g.lineCap = 'round';
    for (let i = 0; i < 64; i++) {
      let x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h, a = rnd() * 6.28;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { a += (rnd() - 0.5) * 2.2; x += Math.cos(a) * (14 + rnd() * 26); y += Math.sin(a) * (14 + rnd() * 26); g.lineTo(x, y); }
      g.stroke();
    }
  },
  plum(g, V, rnd) {
    const b = V.bounds, ink = [66, 58, 52];
    const stem = (x0, y0, x1, y1, w, depth) => {
      const mx = (x0 + x1) / 2 + (rnd() - 0.5) * 60, my = (y0 + y1) / 2 + (rnd() - 0.5) * 60;
      g.strokeStyle = rgba(ink, 0.92); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
      if (depth > 0) { stem(mx * 0.6 + x1 * 0.4, my * 0.6 + y1 * 0.4, x1 + (rnd() - 0.2) * 110, y1 - rnd() * 90, w * 0.62, depth - 1); stem(x0 * 0.3 + mx * 0.7, y0 * 0.3 + my * 0.7, x0 + (rnd() - 0.8) * 120, y0 - rnd() * 100 - 20, w * 0.55, depth - 1); }
      else for (let k = 0; k < 2; k++) petal5(g, x1 + (rnd() - 0.5) * 24, y1 + (rnd() - 0.5) * 24, 15 + rnd() * 8, rnd() * 6, rnd() < 0.5 ? [255, 244, 246] : [248, 196, 208], [226, 160, 60]);
    };
    stem(b.x0 + b.w * 0.08, b.y1 - b.h * 0.08, b.x0 + b.w * 0.62, b.y0 + b.h * 0.34, 12, 2);
    stem(b.x0 + b.w * 0.4, b.y1 - b.h * 0.04, b.x0 + b.w * 0.82, b.y0 + b.h * 0.7, 8, 1);
  },
  waves(g, V, rnd, col) {
    const b = V.bounds, R = 32, base = V.def.glaze.base;
    for (let j = 0; ; j++) {
      const y = b.y0 + b.h * 0.42 + j * R * 0.5; if (y > b.y1 + R) break;
      for (let i = -1; i < b.w / (R * 2) + 2; i++) {
        const x = b.x0 + i * R * 2 + (j % 2) * R;
        for (let k = 0; k < 4; k++) { const r = R * (1 - k * 0.22); g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.closePath(); g.fillStyle = k % 2 ? rgba(col, 0.9) : rgba(mixc(base, [255, 255, 255], 0.55), 1); g.fill(); g.strokeStyle = rgba(col, 0.95); g.lineWidth = 1.6; g.stroke(); }
      }
    }
    g.fillStyle = rgba(col, 0.8); g.fillRect(b.x0, b.y0 + b.h * 0.4, b.w, 3);
  },
  bands(g, V, rnd, col) {
    const b = V.bounds, ry = V.open ? V.open.ry : 20;
    const line = (y, w, a) => { g.strokeStyle = rgba(col, a); g.lineWidth = w; g.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40; const x = b.x0 + b.w * u, yy = y + ry * 0.55 * (1 - (2 * u - 1) ** 2); i ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); };
    line(b.y0 + b.h * 0.2, 7, 0.9); line(b.y0 + b.h * 0.24, 2.5, 0.8); line(b.y1 - b.h * 0.17, 6, 0.9); line(b.y1 - b.h * 0.21, 2.5, 0.8);
  },
  pine(g, V, rnd, col) {
    const b = V.bounds; g.strokeStyle = rgba(col, 0.82); g.lineCap = 'round';
    const tx = b.x0 + b.w * 0.72, ty = b.y1 - b.h * 0.12;
    g.lineWidth = 9; g.beginPath(); g.moveTo(tx, ty); g.bezierCurveTo(tx - 30, ty - b.h * 0.25, tx + 40, ty - b.h * 0.4, tx - 20, ty - b.h * 0.62); g.stroke();
    for (let i = 0; i < 6; i++) {
      const u = 0.25 + i * 0.12, cx = tx + Math.sin(u * 7) * 26 - 8, cy = ty - b.h * u * 0.95, dir = i % 2 ? 1 : -1;
      g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dir * 70, cy - 14); g.stroke();
      g.lineWidth = 1.8;
      for (let k = 0; k < 11; k++) { const a = -2.7 + k * 0.2; g.beginPath(); g.moveTo(cx + dir * 70, cy - 14); g.quadraticCurveTo(cx + dir * 70 + Math.cos(a) * 18, cy - 14 + Math.sin(a) * 18 - 4, cx + dir * 70 + Math.cos(a) * 34, cy - 14 + Math.sin(a) * 30 + 12); g.stroke(); }
    }
    g.fillStyle = rgba([210, 70, 50], 0.85); g.beginPath(); g.arc(b.x0 + b.w * 0.22, b.y0 + b.h * 0.42, 12, 0, 7); g.fill();
  },
  sakura(g, V, rnd) {
    const b = V.bounds, cx = b.cx, cy = b.cy;
    for (let i = 0; i < 38; i++) {
      const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * b.w * 0.47;
      petal5(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 13 + rnd() * 12, rnd() * 6, rnd() < 0.4 ? [255, 250, 250] : [236, 150, 170], [210, 80, 110]);
    }
  },
  ripples(g, V, rnd, col) {
    const b = V.bounds; g.strokeStyle = rgba(col, 0.55); g.lineWidth = 1.6;
    for (let r = 40; r < b.w * 0.5; r += 26) { g.beginPath(); g.arc(b.cx, b.cy, r + rnd() * 3, 0, 7); g.stroke(); }
  },
  bamboo(g, V, rnd, col) {
    const b = V.bounds;
    for (let s = 0; s < 4; s++) {
      const x = b.x0 + b.w * (0.14 + s * 0.24 + rnd() * 0.05);
      g.strokeStyle = rgba(col, 0.85); g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, b.y0); g.lineTo(x + 6, b.y1); g.stroke();
      for (let y = b.y0 + 30 + rnd() * 20; y < b.y1; y += 55 + rnd() * 25) {
        g.lineWidth = 12; g.strokeStyle = rgba(shade(col, 0.7), 0.95); g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 14, y); g.stroke();
        for (let k = 0; k < 2; k++) { const d = k ? 1 : -1; g.fillStyle = rgba(col, 0.88); g.beginPath(); g.ellipse(x + d * 28, y - 12, 30, 6.5, d * -0.45, 0, 7); g.fill(); }
      }
    }
  },
  vines(g, V, rnd, col) {
    const b = V.bounds; g.strokeStyle = rgba(col, 0.9); g.lineWidth = 4; g.lineCap = 'round';
    for (let v = 0; v < 3; v++) {
      let x = b.x0 + b.w * (0.2 + v * 0.3), y = b.y0 + b.h * 0.18; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { const nx = x + (rnd() - 0.5) * 90, ny = y + b.h * 0.13; g.quadraticCurveTo(x + (rnd() - 0.5) * 120, (y + ny) / 2, nx, ny); x = nx; y = ny;
        g.stroke(); g.fillStyle = rgba(col, 0.9); g.beginPath(); g.ellipse(x + 20, y, 24, 11, 0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(x - 20, y + 10, 22, 10, -0.5, 0, 7); g.fill(); g.beginPath(); g.moveTo(x, y); }
      g.beginPath(); g.arc(x, y + 20, 14, 0, 4.6); g.stroke();
    }
  },
  night(g, V, rnd) {
    const b = V.bounds, mx = b.x0 + b.w * 0.62, my = b.y0 + b.h * 0.34;
    const gl = g.createRadialGradient(mx, my, 6, mx, my, 120); gl.addColorStop(0, 'rgba(255,244,200,.55)'); gl.addColorStop(1, 'rgba(255,244,200,0)'); g.fillStyle = gl; g.fillRect(b.x0, b.y0, b.w, b.h);
    g.fillStyle = 'rgba(255,246,214,.98)'; g.beginPath(); g.arc(mx, my, 54, 0, 7); g.fill();
    g.fillStyle = 'rgba(200,190,150,.45)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(mx - 16 + (i % 3) * 18, my - 14 + Math.floor(i / 3) * 26, 7 + (i % 2) * 4, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(214,190,120,.8)'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const y = b.y0 + b.h * (0.56 + i * 0.1); g.beginPath(); g.moveTo(b.x0, y); for (let x = b.x0; x <= b.x1; x += 20) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 7); g.stroke(); }
    g.fillStyle = 'rgba(255,248,220,.9)'; for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(b.x0 + rnd() * b.w, b.y0 + rnd() * b.h * 0.5, 1.3 + rnd() * 1.6, 0, 7); g.fill(); }
  },
  asanoha(g, V, rnd, col) {
    const b = V.bounds, S = 44; g.strokeStyle = rgba(col, 0.78); g.lineWidth = 1.5;
    for (let row = -1; row * S * 1.5 < b.h + S * 2; row++) for (let i = -1; i * S * 1.732 < b.w + S * 2; i++) {
      const cx = b.x0 + i * S * 1.732 + (row % 2 ? S * 0.866 : 0), cy = b.y0 + row * S * 1.5, v = [];
      for (let k = 0; k < 6; k++) v.push([cx + Math.cos((k * Math.PI) / 3 + 0.5236) * S, cy + Math.sin((k * Math.PI) / 3 + 0.5236) * S]);
      g.beginPath(); v.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
      g.beginPath(); for (let k = 0; k < 6; k++) { g.moveTo(cx, cy); g.lineTo(v[k][0], v[k][1]); } g.stroke();
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = v[k], c2 = v[(k + 1) % 6]; g.moveTo((a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2); g.lineTo(cx, cy); } g.stroke();
    }
  },
  kiku(g, V, rnd) {
    const cx = V.bounds.cx, cy = V.bounds.cy, R = V.bounds.w / 2;
    const ring = (n, r0, r1, wd, col, rot) => { for (let k = 0; k < n; k++) { const a = rot + (k * Math.PI * 2) / n; g.save(); g.translate(cx + Math.cos(a) * (r0 + r1) / 2, cy + Math.sin(a) * (r0 + r1) / 2); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, (r1 - r0) / 2, wd, 0, 0, 7); g.fill(); g.restore(); } };
    ring(24, R * 0.4, R * 0.76, 11, 'rgba(250,224,160,.9)', 0); ring(24, R * 0.28, R * 0.6, 9, 'rgba(226,170,70,.95)', 0.13); ring(16, R * 0.08, R * 0.36, 8, 'rgba(255,240,200,.95)', 0.2);
    g.fillStyle = 'rgba(200,120,40,.95)'; g.beginPath(); g.arc(cx, cy, R * 0.09, 0, 7); g.fill();
  },
};

// ---- vessel painting -------------------------------------------------------------------------------------------------------
export function paintVessel(g, V) {
  const d = V.def, gl = d.glaze, b = V.bounds, rnd = rngOf(d.seed * 7 + 3);
  g.save(); path(g, V.sil); g.clip();
  if (V.disc) {
    const R = V.R, rg = g.createRadialGradient(b.cx - R * 0.35, b.cy - R * 0.4, R * 0.05, b.cx, b.cy, R * 1.05);
    rg.addColorStop(0, rgba(gl.hi)); rg.addColorStop(0.45, rgba(gl.base)); rg.addColorStop(1, rgba(shade(gl.base, 0.62))); g.fillStyle = rg; g.fillRect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8);
    g.fillStyle = rgba(gl.rim, 0.5); g.beginPath(); g.arc(b.cx, b.cy, R, 0, 7); g.arc(b.cx, b.cy, R * 0.86, 0, 7, true); g.fill();
    const well = g.createLinearGradient(b.x0, b.y0, b.x1, b.y1); well.addColorStop(0, rgba(shade(gl.base, 0.8))); well.addColorStop(1, rgba(gl.base)); g.fillStyle = well;
    g.beginPath(); g.arc(b.cx, b.cy, R * 0.8, 0, 7); g.fill();
  } else {
    const gr = g.createLinearGradient(b.x0, 0, b.x1, 0);
    gr.addColorStop(0, rgba(shade(gl.base, 0.6))); gr.addColorStop(0.2, rgba(gl.base)); gr.addColorStop(0.34, rgba(mixc(gl.base, gl.hi, 0.7))); gr.addColorStop(0.55, rgba(gl.base)); gr.addColorStop(0.85, rgba(shade(gl.base, 0.72))); gr.addColorStop(1, rgba(shade(gl.base, 0.48)));
    g.fillStyle = gr; g.fillRect(b.x0 - 4, b.y0 - 60, b.w + 8, b.h + 120);
  }
  for (const m of d.motif) { const { name, col } = parse(m); g.save(); M[name]?.(g, V, rnd, col); g.restore(); }
  if (V.disc) {
    const R = V.R; g.lineWidth = 5; g.strokeStyle = rgba(shade(gl.base, 0.55), 0.55); g.beginPath(); g.arc(b.cx, b.cy, R * 0.8, 0, 7); g.stroke();
    g.lineWidth = 3; g.strokeStyle = rgba(gl.hi, 0.5); g.beginPath(); g.arc(b.cx + 1.5, b.cy + 1.5, R * 0.8 + 3, 0.2, 2.2); g.stroke();
    const sh = g.createLinearGradient(b.x0, b.y0, b.x1, b.y1); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = sh; g.fillRect(b.x0, b.y0, b.w, b.h);
  } else {
    const cyl = g.createLinearGradient(b.x0, 0, b.x1, 0);
    cyl.addColorStop(0, 'rgba(0,0,0,.42)'); cyl.addColorStop(0.18, 'rgba(0,0,0,0)'); cyl.addColorStop(0.62, 'rgba(0,0,0,0)'); cyl.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = cyl; g.fillRect(b.x0, b.y0 - 60, b.w, b.h + 120);
    const vg = g.createLinearGradient(0, b.y0, 0, b.y1); vg.addColorStop(0, 'rgba(255,255,255,.1)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = vg; g.fillRect(b.x0, b.y0 - 60, b.w, b.h + 120);
    g.save(); g.translate(b.x0 + b.w * 0.3, b.cy - b.h * 0.05); g.scale(0.07 * b.w / 100, 0.34 * b.h / 100);
    const sp = g.createRadialGradient(0, 0, 0, 0, 0, 100); sp.addColorStop(0, 'rgba(255,255,255,.55)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sp; g.beginPath(); g.arc(0, 0, 100, 0, 7); g.fill(); g.restore();
    g.fillStyle = 'rgba(190,160,120,.5)'; g.fillRect(b.x0, b.y1 - b.h * 0.045, b.w, b.h * 0.06);   // unglazed foot
  }
  g.restore();
  if (V.open) {
    const o = V.open;
    g.save(); g.beginPath(); g.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, 7); g.clip();
    const ig = g.createLinearGradient(o.x - o.rx, 0, o.x + o.rx, 0); ig.addColorStop(0, rgba(shade(gl.inner, 0.7))); ig.addColorStop(0.5, rgba(gl.inner)); ig.addColorStop(1, rgba(shade(gl.inner, 1.25)));
    g.fillStyle = ig; g.fillRect(o.x - o.rx, o.y - o.ry, o.rx * 2, o.ry * 2);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(o.x, o.y - o.ry * 0.25, o.rx * 0.92, o.ry * 0.7, 0, 0, 7); g.fill();
    g.restore();
    g.lineWidth = Math.max(3, o.ry * 0.18); g.strokeStyle = rgba(gl.rim, 0.95); g.beginPath(); g.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, 7); g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(o.x, o.y, o.rx - o.ry * 0.1, o.ry * 0.9, 0, 0.1, Math.PI - 0.1); g.stroke();
  }
  g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.4)'; path(g, V.sil); g.stroke();
}

// ---- bitmap caches ----------------------------------------------------------------------------------------------------------
const hasOff = typeof OffscreenCanvas !== 'undefined';
const mk = (w, h) => new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
const KB = 1.4, PAD = 12;
const arts = new Map(), pieceBakes = new Map();

export function getArt(V, kb = KB) {
  if (!hasOff) return null;
  const key = V.def.id + ':' + kb; let a = arts.get(key);
  if (a) return a;
  const b = V.bounds, w = b.w + 60, h = b.h + 140, c = mk(w * kb, h * kb), g = c.getContext('2d');
  g.scale(kb, kb); g.translate(-(b.x0 - 30), -(b.y0 - 90)); paintVessel(g, V);
  a = { c, kb, ox: b.x0 - 30, oy: b.y0 - 90, w, h };
  const big = [...arts.keys()].filter((k) => parseFloat(k.split(':')[1]) >= 1);
  if (kb >= 1 && big.length >= 2) arts.delete(big[0]);
  arts.set(key, a);
  return a;
}


function bakePiece(V, i) {
  const pc = V.pieces[i], art = getArt(V);
  if (!art) return null;
  const x0 = pc.bb.x0 - PAD, y0 = pc.bb.y0 - PAD, w = pc.bb.x1 - pc.bb.x0 + PAD * 2, h = pc.bb.y1 - pc.bb.y0 + PAD * 2;
  const c = mk(w * KB, h * KB), g = c.getContext('2d');
  g.scale(KB, KB); g.translate(-x0, -y0);
  g.save(); g.translate(-pc.hx, -pc.hy);   // world coords of the assembled vessel, shifted so the shard's centroid is at the origin
  g.save(); path(g, V.sil); g.clip(); path(g, pc.poly.map(([x, y]) => [x + pc.hx, y + pc.hy])); g.clip();
  g.drawImage(art.c, art.ox, art.oy, art.w, art.h);
  const cell = pc.poly.map(([x, y]) => [x + pc.hx, y + pc.hy]);
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(40,22,12,.22)'; g.lineWidth = 9; path(g, cell); g.stroke();
  g.strokeStyle = 'rgba(226,200,156,.95)'; g.lineWidth = 3.4; path(g, cell); g.stroke();
  g.save(); g.translate(-1.3, -1.3); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.3; path(g, cell); g.stroke(); g.restore();
  g.save(); g.translate(1.5, 1.5); g.strokeStyle = 'rgba(60,34,20,.5)'; g.lineWidth = 1.5; path(g, cell); g.stroke(); g.restore();
  g.restore();
  g.restore();
  const s = mk((w + 40) * KB, (h + 40) * KB), sg = s.getContext('2d');
  sg.scale(KB, KB); sg.shadowColor = 'rgba(0,0,0,.6)'; sg.shadowBlur = 9 * KB; sg.shadowOffsetX = 3000; sg.drawImage(c, -3000 / KB + 20, 20, w, h);
  return { c, s, x0, y0, w, h };
}
export function bakedPiece(V, i, allowBake = true) {
  const key = V.def.id + '#' + i; let b = pieceBakes.get(key);
  if (!b && allowBake) { b = bakePiece(V, i); if (b) pieceBakes.set(key, b); }
  return b ?? null;
}
export function bakeProgress(V) { let n = 0; for (let i = 0; i < V.pieces.length; i++) if (pieceBakes.has(V.def.id + '#' + i)) n++; return n; }
export function dropBakes(keepId) { for (const k of [...pieceBakes.keys()]) if (!k.startsWith(keepId + '#')) pieceBakes.delete(k); for (const k of [...arts.keys()]) if (parseFloat(k.split(':')[1]) >= 1 && !k.startsWith(keepId + ':')) arts.delete(k); }

// A shard at (x, y) rotated by a. o: { lift, alpha }
export function drawPiece(g, V, i, x, y, a, o = {}) {
  const b = bakedPiece(V, i), pc = V.pieces[i];
  const lift = o.lift ?? 0;
  if (b) {
    g.save(); g.translate(x + 3 + lift * 8, y + 5 + lift * 14); g.rotate(a); g.globalAlpha = (o.shadow ?? 1) * (0.7 + lift * 0.3);
    g.drawImage(b.s, b.x0 - 20, b.y0 - 20, b.w + 40, b.h + 40); g.restore();
    g.save(); g.translate(x, y - lift * 4); g.rotate(a); if (o.alpha !== undefined) g.globalAlpha = o.alpha;
    g.drawImage(b.c, b.x0, b.y0, b.w, b.h); g.restore();
    return;
  }
  // fallback (no OffscreenCanvas, or not baked yet): paint the shard directly
  g.save(); g.translate(x, y); g.rotate(a); g.translate(-pc.hx, -pc.hy);
  path(g, V.sil); g.clip(); path(g, pc.poly.map(([px, py]) => [px + pc.hx, py + pc.hy])); g.clip();
  if (hasOff) { g.fillStyle = rgba(V.def.glaze.base); g.fillRect(V.bounds.x0, V.bounds.y0, V.bounds.w, V.bounds.h); } else paintVessel(g, V);
  g.restore();
}

export function drawArtFlat(g, V, x, y, scale, alpha = 1) {   // whole vessel at screen position (used by the shelf, title, result)
  const t = getArt(V, 0.7);
  if (!t) return false;
  g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(scale, scale); g.drawImage(t.c, t.ox - V.bounds.cx, t.oy - V.bounds.cy, t.w, t.h); g.restore();
  return true;
}

// ---- cracks and gold ---------------------------------------------------------------------------------------------------------
export function drawCracks(g, V, alpha = 1) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha; g.lineCap = 'round'; g.lineJoin = 'round';
  const trace = () => { g.beginPath(); for (const s of V.seams) s.pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
  trace(); g.strokeStyle = 'rgba(24,12,6,.78)'; g.lineWidth = 3.4; g.stroke();
  g.save(); g.translate(0.9, 0.9); trace(); g.strokeStyle = 'rgba(232,206,160,.75)'; g.lineWidth = 1.1; g.stroke(); g.restore();
  g.restore();
}

const WIDTHS = [4.5, 6.8, 9, 11.2, 13.4];
export function drawGold(g, V, Q, t = 0, glints = true) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const buckets = [[], [], [], [], []];
  V.seams.forEach((s, i) => { const q = Q[i]; for (let k = 0; k < s.pts.length - 1; k++) { const v = Math.min(q[k], q[k + 1]); if (v > 0.01) buckets[Math.min(4, Math.floor(v * 5))].push(s.pts[k], s.pts[k + 1]); } });
  const pass = (style, wAdd, wMul, dx, dy) => {
    for (let bi = 0; bi < 5; bi++) {
      const seg = buckets[bi]; if (!seg.length) continue;
      g.beginPath(); for (let k = 0; k < seg.length; k += 2) { g.moveTo(seg[k][0] + dx, seg[k][1] + dy); g.lineTo(seg[k + 1][0] + dx, seg[k + 1][1] + dy); }
      g.strokeStyle = style; g.lineWidth = WIDTHS[bi] * wMul + wAdd; g.stroke();
    }
  };
  pass('rgba(92,56,12,.95)', 2.6, 1, 0.6, 0.9);
  pass('rgb(201,148,44)', 0, 1, 0, 0);
  pass('rgb(244,206,98)', 0, 0.62, -0.3, -0.4);
  pass('rgb(255,240,176)', 0, 0.22, -0.9, -1.2);
  if (glints) {
    g.fillStyle = 'rgba(255,252,230,.95)';
    for (let n = 0; n < 9; n++) {
      const si = (n * 7 + 3) % V.seams.length, s = V.seams[si], q = Q[si], k = Math.floor(((t * 0.22 + n * 0.37) % 1) * s.pts.length);
      if (!q || q[k] < 0.3) continue;
      const ph = (t * 0.22 + n * 0.37) % 1, a = Math.sin(ph * Math.PI * 4) ** 2 * 0.9, p = s.pts[k], r = 3 + a * 7;
      g.globalAlpha = a; g.beginPath(); g.moveTo(p[0], p[1] - r); g.lineTo(p[0] + r * 0.2, p[1] - r * 0.2); g.lineTo(p[0] + r, p[1]); g.lineTo(p[0] + r * 0.2, p[1] + r * 0.2); g.lineTo(p[0], p[1] + r); g.lineTo(p[0] - r * 0.2, p[1] + r * 0.2); g.lineTo(p[0] - r, p[1]); g.lineTo(p[0] - r * 0.2, p[1] - r * 0.2); g.closePath(); g.fill();
    }
  }
  g.restore();
}
export const GOLD = { hi: [255, 240, 176], mid: [244, 206, 98], deep: [201, 148, 44] };

let benchPat = null;
export function benchPattern(g) {
  if (!hasOff || !g.createPattern) return null;
  if (benchPat === null) {
    const c = mk(256, 256), p = c.getContext('2d'), rnd = rngOf(99);
    p.fillStyle = 'rgba(0,0,0,0)'; p.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { const x = rnd() * 256, y = rnd() * 256, l = 20 + rnd() * 60; p.strokeStyle = rnd() < 0.5 ? 'rgba(255,230,190,.045)' : 'rgba(0,0,0,.12)'; p.lineWidth = 0.6 + rnd(); p.beginPath(); p.moveTo(x, y); p.lineTo(x + l, y + (rnd() - 0.5) * 3); p.stroke(); }
    benchPat = c;
  }
  return g.createPattern(benchPat, 'repeat');
}
const fullQs = new WeakMap();
export function fullQ(V, q) { let m = fullQs.get(V); if (!m) { m = new Map(); fullQs.set(V, m); } if (!m.has(q)) m.set(q, V.seams.map((s) => s.pts.map(() => q))); return m.get(q); }
