// Kho-Kho ground textures, painted once with canvas 2D (presentation only). A real school-ground court: raked laterite clay with grit,
// scuffs, footprints and a worn lane, and chalk lines that are never perfectly straight (thick dusty core, ragged edge, worn through
// where the players run). Everything is in canonical court units (640 x 1000, engine COURT) so the lines match the simulation exactly.
import { COURT, SEAT_Y } from '../src/engine.js';

export const CW = 640, CH = 1000;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const TAU = Math.PI * 2;
const canvasOf = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };

// Wrap-around soft blotches so the texture tiles seamlessly.
function blotches(g, w, h, r, n, rmin, rmax, colour) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = rmin + r() * (rmax - rmin);
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      const X = x + ox, Y = y + oy;
      if (X + rad < 0 || X - rad > w || Y + rad < 0 || Y - rad > h) continue;
      const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
      gr.addColorStop(0, colour(r)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
    }
  }
}

/** Seamless packed-earth tile for everything round the court (and a grayscale grit map for the bump). */
export function surroundTile(size = 512) {
  const c = canvasOf(size, size), g = c.getContext('2d'), r = lcg(41);
  g.fillStyle = '#8f5a3a'; g.fillRect(0, 0, size, size);
  blotches(g, size, size, r, 46, 24, 90, () => (r() > 0.5 ? `rgba(${150 + (r() * 40 | 0)},${96 + (r() * 30 | 0)},${58 + (r() * 20 | 0)},0.34)` : `rgba(${88 + (r() * 24 | 0)},${56 + (r() * 14 | 0)},${38 + (r() * 10 | 0)},0.30)`));
  for (let i = 0; i < 900; i++) { const x = r() * size, y = r() * size; g.fillStyle = r() > 0.5 ? `rgba(255,220,180,${0.05 + r() * 0.1})` : `rgba(60,30,16,${0.07 + r() * 0.12})`; g.beginPath(); g.ellipse(x, y, 0.8 + r() * 3, 0.6 + r() * 1.8, r() * 3, 0, TAU); g.fill(); }
  // sparse dry grass tufts
  for (let i = 0; i < 70; i++) {
    const x = r() * size, y = r() * size; g.strokeStyle = `rgba(${96 + (r() * 40 | 0)},${112 + (r() * 30 | 0)},${52},${0.4 + r() * 0.3})`; g.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (k - 2) * 2.4 + (r() - 0.5) * 2, y - 5 - r() * 7); g.stroke(); }
  }
  return c;
}

export function gritMap(size = 256) {
  const c = canvasOf(size, size), g = c.getContext('2d'), r = lcg(9);
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 3200; i++) { const v = 90 + (r() * 90 | 0); g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.beginPath(); g.ellipse(r() * size, r() * size, 0.6 + r() * 1.8, 0.5 + r() * 1.2, r() * 3, 0, TAU); g.fill(); }
  return c;
}

/** The court: clay + markings, 640 x 1000 court units at `scale` canvas px per unit. Alpha feathers to 0 at the borders so it melts into the surround. */
export function courtTexture(scale = 2) {
  const c = canvasOf(CW * scale, CH * scale), g = c.getContext('2d'), r = lcg(77);
  g.scale(scale, scale);
  const C = COURT, x0 = C.x0, x1 = C.x1, y0 = C.y0, y1 = C.y1, sp = C.spine;
  // base earth: slightly cooler outside the court, warm raked clay inside
  g.fillStyle = '#8b5636'; g.fillRect(0, 0, CW, CH);
  blotches(g, CW, CH, r, 120, 16, 70, () => (r() > 0.55 ? `rgba(${160 + (r() * 36 | 0)},${100 + (r() * 24 | 0)},${60 + (r() * 14 | 0)},0.30)` : `rgba(${96 + (r() * 24 | 0)},${58 + (r() * 14 | 0)},${38 + (r() * 10 | 0)},0.26)`));
  // the playing surface
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#c4703f'); gr.addColorStop(0.5, '#b9633a'); gr.addColorStop(1, '#ac5a35');
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  blotches(g, CW, CH, r, 140, 14, 60, () => (r() > 0.5 ? `rgba(255,190,130,${0.05 + r() * 0.08})` : `rgba(80,30,12,${0.06 + r() * 0.08})`));
  // end zones and the lane are swept clean: lighter, finer
  g.fillStyle = 'rgba(255,214,170,0.10)'; g.fillRect(x0, y0, x1 - x0, C.end); g.fillRect(x0, y1 - C.end, x1 - x0, C.end);
  g.fillStyle = 'rgba(255,226,196,0.15)'; g.fillRect(sp - 15, y0, 30, y1 - y0);
  // broom / rake strokes
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(90,34,14,${0.05 + r() * 0.07})`; g.lineWidth = 0.8 + r() * 1.4; const y = y0 + r() * (y1 - y0), x = x0 + r() * (x1 - x0 - 200); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 60, y - 6 + r() * 12, x + 120, y + r() * 10, x + 190, y - 5 + r() * 9); g.stroke(); }
  // grit
  for (let i = 0; i < 4200; i++) { const dark = r() > 0.5; g.fillStyle = dark ? `rgba(70,26,10,${0.05 + r() * 0.1})` : `rgba(255,222,180,${0.06 + r() * 0.12})`; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.5 + r() * 2.6, 0.4 + r() * 1.6, r() * 3, 0, TAU); g.fill(); }
  // scuffs and skid marks where players have turned (kho-kho is all sudden turns): short arcs, denser along the lane
  for (let i = 0; i < 46; i++) {
    const near = r() < 0.5, x = near ? sp + (r() - 0.5) * 120 : x0 + 20 + r() * (x1 - x0 - 40), y = y0 + C.end + r() * (y1 - y0 - 2 * C.end);
    g.strokeStyle = `rgba(255,218,176,${0.04 + r() * 0.06})`; g.lineWidth = 1 + r() * 1.6; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, 6 + r() * 16, r() * TAU, r() * TAU + 0.9 + r()); g.stroke();
  }
  // footprints near the seats: the batch has been shuffling in and out of the squat all afternoon
  for (const sy of SEAT_Y) for (let k = 0; k < 4; k++) {
    const side = r() < 0.5 ? -1 : 1, x = sp + side * (22 + r() * 40), y = sy + (r() - 0.5) * 30;
    g.fillStyle = `rgba(70,26,10,${0.10 + r() * 0.1})`; g.beginPath(); g.ellipse(x, y, 5 + r() * 2, 2.6 + r(), (r() - 0.5) * 0.9 + Math.PI / 2, 0, TAU); g.fill();
  }
  g.restore();
  // ---- chalk
  g.lineCap = 'round'; g.lineJoin = 'round';
  const worn = (x, y) => { const lane = Math.abs(x - sp) < 40 ? 0.35 : 0, end = y < y0 + C.end + 30 || y > y1 - C.end - 30 ? 0.12 : 0; return lane + end; };
  const chalk = (xa, ya, xb, yb, w = 4.2, a = 0.92) => {
    const len = Math.hypot(xb - xa, yb - ya), n = Math.max(2, Math.round(len / 7)), nx = -(yb - ya) / len, ny = (xb - xa) / len;
    // soft dust halo (chalk powder spilled beside the line)
    g.strokeStyle = 'rgba(255,240,215,0.10)'; g.lineWidth = w + 6; g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.stroke();
    for (let pass = 0; pass < 3; pass++) {
      const ww = w * (pass === 0 ? 1 : 0.5), off = pass === 0 ? 0 : (r() - 0.5) * w * 0.8;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n + 0.02;
        const px = xa + (xb - xa) * t0 + nx * (off + (r() - 0.5) * 0.9), py = ya + (yb - ya) * t0 + ny * (off + (r() - 0.5) * 0.9);
        const qx = xa + (xb - xa) * t1 + nx * (off + (r() - 0.5) * 0.9), qy = ya + (yb - ya) * t1 + ny * (off + (r() - 0.5) * 0.9);
        const al = a * (pass === 0 ? 0.85 : 0.5) * (1 - worn((px + qx) / 2, (py + qy) / 2) * r() * 2) * (0.78 + r() * 0.22);
        g.strokeStyle = `rgba(255,251,240,${Math.max(0.05, al)})`; g.lineWidth = ww * (0.85 + r() * 0.3);
        g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke();
      }
    }
  };
  chalk(x0, y0, x1, y0, 5); chalk(x1, y0, x1, y1, 5); chalk(x1, y1, x0, y1, 5); chalk(x0, y1, x0, y0, 5);
  chalk(x0, y0 + C.end, x1, y0 + C.end, 4); chalk(x0, y1 - C.end, x1, y1 - C.end, 4);
  chalk(sp - 15, y0 + C.end, sp - 15, y1 - C.end, 3.6, 0.9); chalk(sp + 15, y0 + C.end, sp + 15, y1 - C.end, 3.6, 0.9);
  const pitch = SEAT_Y[1] - SEAT_Y[0];
  for (let i = 0; i <= SEAT_Y.length; i++) { const y = SEAT_Y[0] - pitch / 2 + i * pitch; chalk(sp - 15, y, sp + 15, y, 3, 0.9); }
  // pole circles: a small chalk circle marks where each end pole stands
  g.strokeStyle = 'rgba(255,251,240,0.55)'; g.lineWidth = 2.4;
  for (const py of [y0 + 26, y1 - 26]) { g.beginPath(); g.arc(sp, py, 14, 0, TAU); g.stroke(); }
  // ---- feather the edges so the texture melts into the surround plane
  g.save(); g.globalCompositeOperation = 'destination-in';
  const F = 46;
  const fx = g.createLinearGradient(0, 0, CW, 0); fx.addColorStop(0, 'rgba(0,0,0,0)'); fx.addColorStop(F / CW, 'rgba(0,0,0,1)'); fx.addColorStop(1 - F / CW, 'rgba(0,0,0,1)'); fx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fx; g.fillRect(0, 0, CW, CH);
  g.restore(); g.save(); g.globalCompositeOperation = 'destination-in';
  const fy = g.createLinearGradient(0, 0, 0, CH); fy.addColorStop(0, 'rgba(0,0,0,0)'); fy.addColorStop(F / CH, 'rgba(0,0,0,1)'); fy.addColorStop(1 - F / CH, 'rgba(0,0,0,1)'); fy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fy; g.fillRect(0, 0, CW, CH); g.restore();
  return c;
}

/** Soft round particle sprite (dust / chalk puff). */
export function puffSprite(size = 64) {
  const c = canvasOf(size, size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}

/** Whitewashed plaster with a red-ochre band at the foot (the boundary wall and the school), `bands` stripes of damp and flaking. */
export function plasterTexture(w = 256, h = 128, base = '#f2ead9', seed = 3) {
  const c = canvasOf(w, h), g = c.getContext('2d'), r = lcg(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  blotches(g, w, h, r, 40, 10, 40, () => `rgba(${150 + (r() * 40 | 0)},${130 + (r() * 30 | 0)},${100 + (r() * 30 | 0)},${0.08 + r() * 0.1})`);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(90,70,50,${0.04 + r() * 0.07})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); }
  // damp creeping up from the ground
  const gr = g.createLinearGradient(0, h, 0, h * 0.55); gr.addColorStop(0, 'rgba(70,50,36,0.35)'); gr.addColorStop(1, 'rgba(70,50,36,0)');
  g.fillStyle = gr; g.fillRect(0, h * 0.55, w, h * 0.45);
  return c;
}

/** Dusk sky for the perspective views (title hero, icon): a warm horizon, deep blue above, soft cloud streaks and layered tree / hill silhouettes. 2048 x 512, wraps round. */
export function skyTexture() {
  const W = 2048, H = 512, c = canvasOf(W, H), g = c.getContext('2d'), r = lcg(23);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#16224f'); gr.addColorStop(0.35, '#3a3f86'); gr.addColorStop(0.55, '#b9608f'); gr.addColorStop(0.7, '#ff9d6b'); gr.addColorStop(0.8, '#ffd08a'); gr.addColorStop(1, '#ffd9a0');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // cloud streaks, lit from below by the low sun
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = H * (0.3 + r() * 0.3), w = 120 + r() * 320, h = 6 + r() * 16;
    for (const ox of [-W, 0, W]) { const gg = g.createRadialGradient(x + ox, y, 2, x + ox, y, w * 0.5); gg.addColorStop(0, `rgba(255,${150 + (r() * 60 | 0)},${120 + (r() * 50 | 0)},${0.22 + r() * 0.2})`); gg.addColorStop(1, 'rgba(255,150,120,0)'); g.save(); g.translate(x + ox, y); g.scale(1, h / (w * 0.5)); g.translate(-(x + ox), -y); g.fillStyle = gg; g.beginPath(); g.arc(x + ox, y, w * 0.5, 0, TAU); g.fill(); g.restore(); }
  }
  // distant hills, then a tree line, then nearer trees (silhouettes get darker and larger towards the front)
  const band = (y0, amp, col, haze) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * 0.0061 + y0) * amp + Math.sin(x * 0.017 + y0 * 2) * amp * 0.45 + Math.sin(x * 0.043) * amp * 0.2; g.lineTo(x, y); }
    g.lineTo(W, H); g.closePath(); g.fill();
    const hz = g.createLinearGradient(0, y0 - amp * 2, 0, y0 + amp * 2); hz.addColorStop(0, `rgba(255,190,140,${haze})`); hz.addColorStop(1, 'rgba(255,190,140,0)'); g.fillStyle = hz; g.fillRect(0, y0 - amp * 2, W, amp * 4);
  };
  band(H * 0.74, 14, '#7a5a7e', 0.35); band(H * 0.8, 10, '#4b3d62', 0.2);
  g.fillStyle = '#2a2a45';
  for (let i = 0; i < 90; i++) { const x = r() * W, h = 20 + r() * 38, w = 14 + r() * 26, y = H * 0.84; g.beginPath(); g.ellipse(x, y - h * 0.5, w, h * 0.6, 0, 0, TAU); g.fill(); g.fillRect(x - 2, y - h * 0.3, 4, h * 0.5); }
  g.fillStyle = '#1b1d36'; g.fillRect(0, H * 0.88, W, H * 0.12);
  return c;
}
