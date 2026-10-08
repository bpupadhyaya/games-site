// The carved board, baked once into a texture: a stone slab with the coiled snake in relief (raised body, sunken cells, an engraved
// diamond on every resting stone, a domed head), lit from the upper left with bump-mapped light, cast shadows, grain and gold leaf.
// The work is done in small row slices (a fixed budget per frame, no clock) so the first playable frame never waits for it.
// Canvases are not allowed in web/src, so main.js hands over a factory: gfx.make(w, h) -> canvas. Without it (headless tests) the
// board is drawn by plain vector fallbacks in art.js.
import { SPIRAL, radiusAt, slope, sOf, CELL_LEN, TAIL_TH, END_TH } from './geo.js';
import { TRACK, isSafe } from './rules.js';

export const gfx = { make: null };
export const BAKE_SIZE = 896;

export const STONES = {
  sandstone: { low: [92, 62, 38], high: [238, 218, 184], gold: [246, 196, 78], rim: [255, 240, 206], tone: 1.04 },
  basalt:    { low: [18, 18, 24],  high: [86, 88, 100],   gold: [236, 188, 78], rim: [255, 230, 170], tone: 1.15 },
  lapis:     { low: [14, 26, 66],  high: [74, 108, 190],  gold: [244, 202, 96], rim: [255, 240, 200], tone: 1.1 },
};
export const stoneOf = (id) => STONES[id] ?? STONES.sandstone;

const TWO_PI = Math.PI * 2;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const LOWN = 48;
const lowNoise = (() => { const a = new Float32Array(LOWN * LOWN); for (let y = 0; y < LOWN; y++) for (let x = 0; x < LOWN; x++) a[y * LOWN + x] = hash(x * 7 + 3, y * 13 + 5); return a; })();
const smoothNoise = (u, v) => {
  const x = u * (LOWN - 1), y = v * (LOWN - 1), x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const x1 = Math.min(LOWN - 1, x0 + 1), y1 = Math.min(LOWN - 1, y0 + 1);
  const a = lowNoise[y0 * LOWN + x0], b = lowNoise[y0 * LOWN + x1], c = lowNoise[y1 * LOWN + x0], d = lowNoise[y1 * LOWN + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

const HALF = SPIRAL.half, HEAD_R = SPIRAL.headR, K = slope;
const ELL = CELL_LEN;
const S_END = sOf(END_TH);

// Height (0..1) and gold mask at unit coordinates. Writes into out[0] (height) and out[1] (gold 0..1).
function field(u, v, out) {
  const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy);
  let H = 0.4 + 0.012 * lowNoise[((v * (LOWN - 1)) | 0) * LOWN + ((u * (LOWN - 1)) | 0)];
  let gold = 0;
  // the snake body: nearest turn of the spiral
  const a0 = Math.atan2(dy, dx) - SPIRAL.phi0;
  const a = a0 - TWO_PI * Math.floor(a0 / TWO_PI);
  const ts = (SPIRAL.rOut - r) / K;
  const n0 = Math.round((ts - a) / TWO_PI);
  let bestD = 9, bestTh = 0;
  const cosA = 1 / Math.sqrt(1 + (K / Math.max(r, 0.02)) ** 2);
  for (let n = n0 - 1; n <= n0 + 1; n++) {
    const th = a + TWO_PI * n;
    if (th < TAIL_TH || th > END_TH + 0.35) continue;
    const d = Math.abs(r - radiusAt(th)) * cosA;
    if (d < bestD) { bestD = d; bestTh = th; }
  }
  if (bestD < 1) {
    const s = sOf(bestTh), cs = s / ELL;
    const taper = cs < 0 ? Math.sqrt(sm(-1.9, 0.15, cs)) : 1;
    const w = Math.max(1e-4, HALF * taper);
    const t = bestD / w;
    const body = 1 - sm(0.9, 1.05, t);
    if (body > 0) {
      let hb = 0.78;
      hb += 0.05 * (1 - t * t);                                            // rounded back
      // overlapping scales: rows of chevrons running along the body (rims, tail and neck; the cell floors stay smooth)
      const open = cs < 0 || cs >= TRACK - 1 || t > 0.72;
      if (open) {
        const q = (cs * 11 + t * 2.6) % 1, qq = ((cs * 11 + 0.5 - t * 2.6) % 1 + 1) % 1;
        const chev = Math.min(Math.abs(q - 0.5), Math.abs(qq - 0.5)) * 2;
        hb += 0.03 * (1 - chev) * (cs < 0 || cs >= TRACK - 1 ? 1.4 : 0.8);
      }
      if (cs >= 0 && cs < TRACK - 1) {
        const ci = Math.floor(cs) + 1, fu = cs - (ci - 1);
        const e = sm(0.07, 0.115, fu) * (1 - sm(0.885, 0.93, fu)) * (1 - sm(0.66, 0.74, t));
        hb -= 0.19 * e + 0.035 * e * (1 - t * t);
        if (isSafe(ci)) {
          const x = (fu - 0.5) * 2, dd = Math.abs(x) * 0.78 + t;
          hb -= 0.07 * e * (1 - sm(0.5, 0.6, dd));
          const ring = Math.abs(dd - 0.62);
          if (e > 0.5 && ring < 0.045) gold = Math.max(gold, 1 - ring / 0.045);
        }
        // the carved dividers between cells get a thin gold line
        if (t < 0.7 && (fu < 0.085 && fu > 0.065 || fu > 0.915 && fu < 0.935)) gold = Math.max(gold, 0.55);
      }
      H = H + (hb - H) * body;
      if (t > 0.93 && t < 1.0) gold = Math.max(gold, 0.8 * (1 - Math.abs(t - 0.965) / 0.035));
      if (cs < -0.15 && t < 0.4) H -= 0.02;
      // the neck swells into the head
      if (cs > TRACK - 1.6) H += 0.04 * sm(TRACK - 1.6, TRACK - 0.6, cs) * (1 - t * t);
      if (cs > TRACK - 1.0 && t < 0.85) gold = Math.max(gold, 0.5 * (1 - Math.abs(t - 0.6)) * sm(TRACK - 1.0, TRACK - 0.4, cs) * (Math.abs((cs * 18) % 1 - 0.5) < 0.12 ? 1 : 0));
    }
    // a soft shadow lip around the body
    H -= 0.025 * (1 - sm(1.0, 1.35, t)) * (1 - body);
  }
  // the head
  if (r < HEAD_R * 1.12) {
    const k = 1 - sm(HEAD_R * 0.98, HEAD_R * 1.1, r);
    let hh = 0.84 + 0.02 * Math.cos(r * 330);
    hh -= 0.22 * (1 - sm(0.058, 0.074, r));            // the pit where finished lions stand
    H = H + (hh - H) * k;
    const rg = Math.abs(r - HEAD_R * 0.97);
    if (rg < 0.006) gold = Math.max(gold, 1 - rg / 0.006);
    // a crown of gold studs round the head
    if (Math.abs(r - HEAD_R * 0.8) < 0.0075) {
      const ang = Math.atan2(dy, dx), seg = ((ang / TWO_PI) * 16) % 1, dd = Math.abs((seg + 1) % 1 - 0.5);
      if (dd < 0.2) { gold = Math.max(gold, 1); H += 0.04 * (1 - dd / 0.2); }
    }
    const rp = Math.abs(r - 0.07);
    if (rp < 0.005) gold = Math.max(gold, 1 - rp / 0.005);
  }
  // the frame
  const e = Math.min(u, v, 1 - u, 1 - v);
  if (e < 0.04) {
    const k = 1 - sm(0.024, 0.032, e);
    H = H + (0.84 - H) * k;
    if (e > 0.0075 && e < 0.0155) { const zz = Math.abs(((u + v) * 52) % 1 - 0.5) + Math.abs(((u - v) * 52) % 1 - 0.5); H -= 0.05 * (1 - sm(0.4, 0.8, zz)); }
    if (e > 0.034 && e < 0.04) { H -= 0.04; gold = Math.max(gold, 0.9); }
    if (e < 0.0045) H -= 0.1 * (1 - e / 0.0045);
  }
  out[0] = H; out[1] = gold;
}

export function createBake(themeId, size = BAKE_SIZE) {
  const make = gfx.make;
  if (!make) return null;
  const N = size, stone = stoneOf(themeId);
  const canvas = make(N, N), cx = canvas.getContext('2d');
  const img = cx.createImageData(N, N);
  const Hs = new Float32Array(N * N), Gs = new Uint8Array(N * N);
  const tmp = [0, 0];
  const job = { canvas, done: false, stage: 0, row: 0, themeId, size: N, progress: 0 };
  const ROWS = 36;
  const L = [-0.52, -0.62, 0.58];
  const ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const Hv = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(Hv[0], Hv[1], Hv[2]); Hv[0] /= hl; Hv[1] /= hl; Hv[2] /= hl;
  const BUMP = 15;
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // a wide soft copy of the height field: where the stone is lower than its surroundings (cell floors, grooves) it is shadowed
  const Bl = new Float32Array(N * N);
  const blurH = () => {
    const R = Math.max(4, Math.round(N * 0.012)), tmpA = new Float32Array(N * N), inv = 1 / (2 * R + 1);
    for (let y = 0; y < N; y++) {
      let acc = 0; for (let x = -R; x <= R; x++) acc += Hs[y * N + Math.min(N - 1, Math.max(0, x))];
      for (let x = 0; x < N; x++) { tmpA[y * N + x] = acc * inv; acc += Hs[y * N + Math.min(N - 1, x + R + 1)] - Hs[y * N + Math.max(0, x - R)]; }
    }
    for (let x = 0; x < N; x++) {
      let acc = 0; for (let y = -R; y <= R; y++) acc += tmpA[Math.min(N - 1, Math.max(0, y)) * N + x];
      for (let y = 0; y < N; y++) { Bl[y * N + x] = acc * inv; acc += tmpA[Math.min(N - 1, y + R + 1) * N + x] - tmpA[Math.max(0, y - R) * N + x]; }
    }
  };
  const L2 = [0.6, 0.55, 0.4]; { const q = Math.hypot(...L2); L2[0] /= q; L2[1] /= q; L2[2] /= q; }
  job.step = (rows = ROWS) => {
    if (job.done) return true;
    if (job.stage === 0) {
      const y1 = Math.min(N, job.row + rows);
      for (let y = job.row; y < y1; y++) for (let x = 0; x < N; x++) {
        field((x + 0.5) / N, (y + 0.5) / N, tmp);
        Hs[y * N + x] = tmp[0]; Gs[y * N + x] = Math.round(tmp[1] * 255);
      }
      job.row = y1; job.progress = (y1 / N) * 0.6;
      if (y1 >= N) { job.stage = 1; job.row = 0; blurH(); }
      return false;
    }
    const y1 = Math.min(N, job.row + rows * 2);
    const data = img.data;
    const Hat = (x, y) => Hs[(y < 0 ? 0 : y >= N ? N - 1 : y) * N + (x < 0 ? 0 : x >= N ? N - 1 : x)];
    for (let y = job.row; y < y1; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x, h = Hs[i];
        const dHx = (Hat(x + 1, y) - Hat(x - 1, y)) * 0.5, dHy = (Hat(x, y + 1) - Hat(x, y - 1)) * 0.5;
        let nx = -dHx * BUMP * (N / 896) * 4, ny = -dHy * BUMP * (N / 896) * 4, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        let diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        // shadow from the terrain towards the light
        const occ = Hat(x - 5, y - 5) * 0.55 + Hat(x - 10, y - 10) * 0.45;
        const sh = Math.min(0.5, Math.max(0, (occ - h - 0.025) * 7));
        const u = (x + 0.5) / N, v = (y + 0.5) / N;
        const grain = 0.86 + 0.14 * hash(x, y) + 0.2 * (smoothNoise(u, v) - 0.5);
        const cav = Math.min(1, Math.max(0, (Bl[i] - h) * 5.5));
        const ao = (0.62 + 0.62 * Math.min(1, Math.max(0, h))) * (1 - 0.42 * cav);
        const fill = Math.max(0, nx * L2[0] + ny * L2[1] + nz * L2[2]) * 0.16;
        const g = Gs[i] / 255;
        const t = Math.min(1, Math.max(0, (h - 0.28) / 0.62));
        const col = lerp3(stone.low, stone.high, t);
        let sh1 = (0.32 + 0.95 * diff + fill) * ao * (1 - sh * 0.8);
        let r = col[0] * grain * sh1 * stone.tone, gg = col[1] * grain * sh1 * stone.tone, b = col[2] * grain * sh1 * stone.tone;
        if (g > 0.02) {
          const spec = Math.pow(Math.max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]), 18);
          const gl = (0.5 + 0.8 * diff) * (1 - sh * 0.5);
          const gr = stone.gold[0] * gl + 255 * spec * 0.5, gb = stone.gold[1] * gl + 230 * spec * 0.5, bb = stone.gold[2] * gl + 160 * spec * 0.4;
          r += (gr - r) * g; gg += (gb - gg) * g; b += (bb - b) * g;
        } else {
          const spec = Math.pow(Math.max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]), 40) * 0.16;
          r += stone.rim[0] * spec; gg += stone.rim[1] * spec; b += stone.rim[2] * spec;
        }
        // rounded outer corners
        const cr = 0.052, ex = Math.min(u, 1 - u), ey = Math.min(v, 1 - v);
        let al = 255;
        if (ex < cr && ey < cr) { const d = Math.hypot(cr - ex, cr - ey) - cr; al = d > 0.0012 ? 0 : d < -0.0012 ? 255 : Math.round(255 * (0.5 - d / 0.0024)); }
        const o = i * 4;
        data[o] = r > 255 ? 255 : r; data[o + 1] = gg > 255 ? 255 : gg; data[o + 2] = b > 255 ? 255 : b; data[o + 3] = al;
      }
    }
    job.row = y1; job.progress = 0.6 + (y1 / N) * 0.4;
    if (y1 >= N) { cx.putImageData(img, 0, 0); job.done = true; job.progress = 1; }
    return job.done;
  };
  return job;
}
