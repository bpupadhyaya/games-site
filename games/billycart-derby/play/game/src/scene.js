// The road scene: a pseudo-3D view from behind the cart (sky, hills, lit road strips, crowds, hay bales, bunting, carts).
// drawScene(ctx, rect, scn) is pure drawing; everything it needs comes in `scn`. Used by the play screen and by the attract
// race behind the menus.
import { ROAD, WALL, SURF, RUNOUT } from './sim.js';
import { drawCartBack, drawPerson, shade, mix } from './art.js';

const TAU = Math.PI * 2;
export const Z0 = 4.2;            // the cart sits this far in front of the camera (m)
const ZN = 2.2, ZMAX = 240;
const VISK = 0.62;                // visual curvature scale (bends are exaggerated a little)
const HAZE = '#d6e8f2';

// depth slices: fine near the camera, coarse far away
const ZS = (() => { const a = []; let z = ZN; while (z < ZMAX) { a.push(z); z += z < 30 ? 1.5 : z < 90 ? 3 : 6; } a.push(ZMAX); return a; })();
const NS = ZS.length;

const hdgCache = new WeakMap();
function heading(course) {
  let h = hdgCache.get(course);
  if (!h) {
    h = new Float32Array(Math.ceil(course.total) + 2);
    let a = 0;
    for (let i = 0; i < h.length; i++) { h[i] = a; a += course.k(i) * VISK; }
    hdgCache.set(course, h);
  }
  return h;
}

const fogA = (a, z) => (a * Math.max(0.1, 1 - Math.pow(z / ZMAX, 1.2) * 1.2)).toFixed(3);
const fogHex = (hex, z) => mix(hex, HAZE, Math.min(0.85, Math.pow(z / ZMAX, 1.6) * 1.1));

function poly(ctx, pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }


// A hay bale seen from behind: front face with straw strokes and twine, lit top, shaded inner side. (xo, z) = its centre on the road.
function drawBale(ctx, proj, z, xo, o, cx, fog) {
  const w = o.w ?? 0.95, h = o.h ?? 0.78, d = o.d ?? 1.15, seed = o.seed ?? 0;
  const zn = Math.max(ZN, z - d / 2), zf = Math.max(zn + 0.2, z + d / 2);
  const a = proj(zn, xo - w / 2, 0), b = proj(zn, xo + w / 2, 0), c = proj(zn, xo + w / 2, h), e = proj(zn, xo - w / 2, h);
  const fa = proj(zf, xo - w / 2, h), fb = proj(zf, xo + w / 2, h), ga = proj(zf, xo - w / 2, 0), gb = proj(zf, xo + w / 2, 0);
  const pw = b.x - a.x; if (pw < 1.5) return;
  const left = (a.x + b.x) / 2 < cx;                       // a bale left of the camera shows its right (road-facing) side
  // inner side
  ctx.beginPath();
  if (left) { ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(fb.x, fb.y); ctx.lineTo(gb.x, gb.y); } else { ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.lineTo(fa.x, fa.y); ctx.lineTo(ga.x, ga.y); }
  ctx.closePath(); ctx.fillStyle = fog('#a47f2e'); ctx.fill();
  // top
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(c.x, c.y); ctx.lineTo(fb.x, fb.y); ctx.lineTo(fa.x, fa.y); ctx.closePath();
  ctx.fillStyle = fog('#ecd57e'); ctx.fill();
  // front face
  const g = ctx.createLinearGradient(0, e.y, 0, a.y); g.addColorStop(0, fog('#e3c15f')); g.addColorStop(1, fog('#b98f36'));
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  if (pw > 14) {
    const ph = a.y - e.y;
    ctx.save(); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.clip();
    ctx.lineWidth = Math.max(1, pw * 0.012);
    for (let i = 0; i < 16; i++) {
      const r1 = hash1(seed * 31 + i * 7.3), r2 = hash1(seed * 17 + i * 3.1), r3 = hash1(seed * 5 + i * 11.7);
      ctx.strokeStyle = r3 > 0.5 ? fog('#f4dd8e') : fog('#8a6a22');
      const x = a.x + r1 * pw, y = e.y + r2 * ph, L = pw * (0.12 + 0.2 * r3);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y + (r1 - 0.5) * ph * 0.08); ctx.stroke();
    }
    ctx.restore();
    // two twine bands wrapping over the top
    ctx.strokeStyle = fog('#5c4416'); ctx.lineWidth = Math.max(1, pw * 0.028);
    for (const u of [0.28, 0.72]) {
      ctx.beginPath(); ctx.moveTo(a.x + pw * u, a.y); ctx.lineTo(e.x + pw * u, e.y); ctx.lineTo(fa.x + (fb.x - fa.x) * u, fa.y); ctx.stroke();
    }
  }
  ctx.strokeStyle = fog('#7a5a1c'); ctx.lineWidth = Math.max(1, pw * 0.02);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.stroke();
}
const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function drawScene(ctx, R, scn) {
  const { race, t } = scn;
  const course = race.course, me = scn.me ?? race.racers[0], r = me.r;
  const W = R.w, H = R.h, cx = R.x + W / 2;
  const wideV = W > H * 1.15;
  const hy = R.y + H * (wideV ? 0.4 : 0.33);
  const f = wideV ? Math.min(W * 0.5, H * 0.8) : W * 0.86;
  const camH = Math.max(1.5, Math.min(3.4, (R.y + H * 0.84 - hy) * Z0 / f));
  const shake = scn.shake !== false ? Math.sin(t * 47) * Math.min(1.3, (r.rough > 0.045 ? r.v * 0.06 : 0) + (r.skid || 0) * 0.8) : 0;
  const hyS = hy + shake;
  const camS = r.s - Z0, camX = r.x * 0.72, psiC = r.psi * 0.55;
  const hdg = heading(course);
  const hAt = (s) => hdg[Math.max(0, Math.min(hdg.length - 1, Math.floor(s)))] ?? 0;

  // ---- sky, sun, clouds, hills ----
  ctx.save();
  ctx.beginPath(); ctx.rect(R.x, R.y, W, H); ctx.clip();
  const sky = ctx.createLinearGradient(0, R.y, 0, hyS);
  sky.addColorStop(0, scn.skyTop ?? '#3d84d6'); sky.addColorStop(0.7, '#9fd0f0'); sky.addColorStop(1, HAZE);
  ctx.fillStyle = sky; ctx.fillRect(R.x, R.y, W, hyS - R.y + 2);
  const par = (hAt(camS + 20) - psiC) * W * 0.9;
  const sunX = cx + 0.22 * W - par * 0.15;
  const sg = ctx.createRadialGradient(sunX, hyS - H * 0.16, 2, sunX, hyS - H * 0.16, H * 0.3);
  sg.addColorStop(0, 'rgba(255,248,214,0.95)'); sg.addColorStop(0.15, 'rgba(255,235,170,0.55)'); sg.addColorStop(1, 'rgba(255,235,170,0)');
  ctx.fillStyle = sg; ctx.fillRect(R.x, R.y, W, hyS - R.y);
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 5; i++) {
    const px = ((i * 0.31 + 0.05) * W * 1.6 - par * 0.25 - t * (4 + i * 1.5)) % (W * 1.6);
    const x = R.x + (px < -120 ? px + W * 1.6 : px), y = R.y + H * (0.08 + (i * 0.37 % 0.2));
    ctx.beginPath(); ctx.ellipse(x, y, 52 + i * 8, 13 + i * 2, 0, 0, TAU); ctx.ellipse(x + 30, y - 7, 34, 11, 0, 0, TAU); ctx.ellipse(x - 28, y - 3, 30, 10, 0, 0, TAU); ctx.fill();
  }
  // hills in two layers
  const hill = (col, base, amp, par2, seed) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(R.x, hyS + 2);
    for (let x = 0; x <= W; x += 14) {
      const u = (x - par * par2) / W * 6.0 + seed;
      ctx.lineTo(R.x + x, hyS - base - amp * (0.55 * Math.sin(u) + 0.3 * Math.sin(u * 2.3 + 1.2) + 0.15 * Math.sin(u * 5.1)));
    }
    ctx.lineTo(R.x + W, hyS + 2); ctx.closePath(); ctx.fill();
  };
  hill('#a9c9c4', H * 0.05, H * 0.07, 0.35, 1.0);
  hill('#8fb88a', H * 0.02, H * 0.045, 0.6, 3.7);
  // distant grass under the horizon
  ctx.fillStyle = mix('#6aa83f', HAZE, 0.7); ctx.fillRect(R.x, hyS, W, R.y + H - hyS);
  // a far tree line and fence posts on the horizon, so the hill reads as country
  for (let x = -20; x <= W + 20; x += 10) {
    const u = Math.floor((x - par * 0.8) / 10), r1 = hash1(u * 1.7), r2 = hash1(u * 3.3 + 2);
    const rad = H * (0.012 + 0.014 * r1), bx = R.x + x + r2 * 6, by = hyS + 1 - rad * 0.3;
    ctx.fillStyle = mix(r2 > 0.5 ? '#3f7d3a' : '#4d8c44', HAZE, 0.5); ctx.beginPath(); ctx.ellipse(bx, by - rad * 0.5, rad * 0.9, rad, 0, 0, TAU); ctx.fill();
  }

  // ---- geometry per slice ----
  const X = scn._X || (scn._X = new Float32Array(NS)), Y = scn._Y || (scn._Y = new Float32Array(NS));
  const slope0 = course.slope(camS);
  let th = -psiC, xx = -camX, yy = 0, zp = 0;
  for (let i = 0; i < NS; i++) {
    const z = ZS[i], ds = z - zp, s = camS + z;
    th += course.k(s) * VISK * ds;
    xx += th * ds;
    yy += -(course.slope(s) - slope0) * ds * 3.0;
    X[i] = xx; Y[i] = yy; zp = z;
  }
  const idxOf = (z) => { let lo = 0, hi = NS - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ZS[m] <= z) lo = m; else hi = m; } return lo; };
  const proj = (z, xo, h) => {
    const i = idxOf(z), a = ZS[i], b = ZS[Math.min(NS - 1, i + 1)], u = b > a ? Math.max(0, Math.min(1, (z - a) / (b - a))) : 0;
    const j = Math.min(NS - 1, i + 1), Xz = X[i] + (X[j] - X[i]) * u, Yz = Y[i] + (Y[j] - Y[i]) * u, sc = f / z;
    return { x: cx + (Xz + xo) * sc, y: hyS + (camH - Yz - h) * sc, sc };
  };

  // ---- sprites ----
  const spr = [];
  const lo = (() => { let a = 0, b = course.deco.length; const t0 = camS + ZN; while (a < b) { const m = (a + b) >> 1; if (course.deco[m].s < t0) a = m + 1; else b = m; } return a; })();
  for (let i = lo; i < course.deco.length; i++) { const d = course.deco[i]; const z = d.s - camS; if (z > ZMAX) break; spr.push({ z, k: 'deco', d }); }
  for (const o of course.obs) {
    const z = o.s + o.len - camS;
    if (z > ZN && z < ZMAX + 20 && o.s - camS < ZMAX) spr.push({ z, k: o.kind === 'bale' ? 'chic' : o.kind, o });
    if (o.s - camS > ZMAX + 40) break;
  }
  race.racers.forEach((c, i) => { const z = c.r.s - camS; if ((c === me || z > 3.4) && z > ZN * 0.9 && z < ZMAX) spr.push({ z, k: 'cart', c, i }); });
  if (scn.ghostS != null) { const z = scn.ghostS - camS; if (z > ZN && z < ZMAX) spr.push({ z, k: 'ghost', s: scn.ghostS }); }
  if (scn.parts) for (const q of scn.parts) { const z = q.s - camS; if (z > ZN && z < ZMAX) spr.push({ z, k: 'puff', q }); }
  if (scn.mark) { const z = scn.mark.s - camS; if (z > ZN && z < ZMAX) spr.push({ z, k: 'mark', m: scn.mark }); }
  spr.sort((a, b) => b.z - a.z);
  let sp = 0;
  while (sp < spr.length && spr[sp].z >= ZS[NS - 1]) sp++;

  const labels = [];
  const drawSprite = (it) => {
    const z = it.z;
    if (it.k === 'deco') {
      const d = it.d, xo = d.side * d.off;
      if (d.kind === 'person') {
        const p = proj(z, xo, 0); if (p.sc * 1.75 < 2.5) return;
        drawPerson(ctx, p.x, p.y, 1.75 * p.sc, d.v, d.ph, t, scn.cheer ?? 1, d.side);
      } else if (d.kind === 'tree') {
        const p = proj(z, xo, 0), h = (4.2 + d.v * 1.2) * p.sc, w = h * 0.5;
        if (h < 3) return;
        ctx.fillStyle = 'rgba(10,30,10,0.22)'; ctx.beginPath(); ctx.ellipse(p.x + w * 0.1, p.y, w * 0.5, h * 0.035, 0, 0, TAU); ctx.fill();
        // tapering trunk with a lit side
        ctx.fillStyle = fogHex('#5b4126', z); ctx.beginPath(); ctx.moveTo(p.x - w * 0.07, p.y); ctx.lineTo(p.x - w * 0.04, p.y - h * 0.5); ctx.lineTo(p.x + w * 0.04, p.y - h * 0.5); ctx.lineTo(p.x + w * 0.07, p.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = fogHex('#7a5a38', z); ctx.fillRect(p.x - w * 0.07, p.y - h * 0.45, w * 0.045, h * 0.45);
        // canopy: three overlapping blobs, shaded dark to light
        const blobs = [[-0.2, 0.55, 0.3, 0.22, '#2c6e34'], [0.22, 0.56, 0.28, 0.2, '#2f7a3a'], [0, 0.72, 0.36, 0.26, '#3d8c43'], [-0.1, 0.84, 0.26, 0.17, '#58a64e']];
        for (const [bx, by, bw, bh, col] of blobs) {
          const gr = ctx.createRadialGradient(p.x + (bx - 0.08) * w, p.y - (by + 0.05) * h, bw * w * 0.1, p.x + bx * w, p.y - by * h, bw * w * 1.1);
          gr.addColorStop(0, fogHex(mix(col, '#a6dc78', 0.45), z)); gr.addColorStop(1, fogHex(col, z));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(p.x + bx * w, p.y - by * h, bw * w, bh * h, 0, 0, TAU); ctx.fill();
        }
      } else if (d.kind === 'bale') {
        if (proj(z, xo, 0).sc * 1.0 < 3) return;
        drawBale(ctx, proj, z, xo, { seed: Math.floor(d.s ?? z) + d.v, d: 1.2 }, cx, (c) => fogHex(c, z));
      } else if (d.kind === 'post') {
        const p = proj(z, xo, 0), w = 0.12 * p.sc, h = 1.2 * p.sc;
        ctx.fillStyle = fogHex('#f2f0e8', z); ctx.fillRect(p.x - w / 2, p.y - h, w, h); ctx.fillStyle = fogHex('#d33b2f', z); ctx.fillRect(p.x - w / 2, p.y - h, w, h * 0.22);
      } else if (d.kind === 'sign') {
        const p = proj(z, xo, 0), h = 1.5 * p.sc, w = 0.9 * p.sc;
        if (w < 3) return;
        ctx.fillStyle = fogHex('#555', z); ctx.fillRect(p.x - w * 0.04, p.y - h, w * 0.08, h);
        ctx.save(); ctx.translate(p.x, p.y - h - w * 0.35); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = fogHex('#ffcb2f', z); ctx.fillRect(-w * 0.4, -w * 0.4, w * 0.8, w * 0.8); ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, w * 0.05); ctx.strokeRect(-w * 0.4, -w * 0.4, w * 0.8, w * 0.8);
        ctx.restore();
        ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1.5, w * 0.1); ctx.lineCap = 'round';
        ctx.beginPath(); const dir = d.v; ctx.moveTo(p.x - dir * w * 0.22, p.y - h - w * 0.15); ctx.lineTo(p.x + dir * w * 0.22, p.y - h - w * 0.35); ctx.lineTo(p.x - dir * w * 0.22, p.y - h - w * 0.55); ctx.stroke();
      } else if (d.kind === 'bunting') {
        const a = proj(z, -(WALL + 1.0), 4.7), b = proj(z, WALL + 1.0, 4.7), pa = proj(z, -(WALL + 1.0), 0), pb = proj(z, WALL + 1.0, 0);
        ctx.strokeStyle = fogHex('#f2f0e8', z); ctx.lineWidth = Math.max(1, a.sc * 0.08);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(a.x, a.y); ctx.moveTo(pb.x, pb.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const cols = ['#e2573b', '#f2b53f', '#3aa6d8', '#ffffff', '#3cc78f'];
        const sag = a.sc * 0.5, n = 16;
        ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let i = 0; i <= n; i++) { const u = i / n, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * sag; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
        for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * sag, w = a.sc * 0.22; ctx.fillStyle = fogHex(cols[i % 5], z); ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + w * 2); ctx.closePath(); ctx.fill(); }
      } else if (d.kind === 'start' || d.kind === 'finish') {
        const a = proj(z, -(ROAD + 1.3), 0), b = proj(z, ROAD + 1.3, 0), top = proj(z, 0, 5.4), ba = proj(z, 0, 4.3);
        const bw = b.x - a.x, sc = a.sc;
        ctx.fillStyle = fogHex('#e8e4d8', z); ctx.fillRect(a.x - sc * 0.15, a.y - sc * 5.4, sc * 0.3, sc * 5.4); ctx.fillRect(b.x - sc * 0.15, b.y - sc * 5.4, sc * 0.3, sc * 5.4);
        const bx = a.x - sc * 0.4, by = top.y, bh = ba.y - top.y;
        ctx.fillStyle = d.kind === 'finish' ? '#16181c' : '#1f6d3a'; ctx.fillRect(bx, by, bw + sc * 0.8, bh);
        if (d.kind === 'finish') { const cs = bh / 3; ctx.fillStyle = '#fff'; for (let i = 0; i < Math.ceil((bw + sc * 0.8) / cs); i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) ctx.fillRect(bx + i * cs, by + j * cs, Math.min(cs, bw + sc * 0.8 - i * cs), cs); }
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(8, bh * 0.6)}px system-ui, sans-serif`;
        if (d.kind === 'start') ctx.fillText('START', bx + (bw + sc * 0.8) / 2, by + bh / 2);
        else { ctx.fillStyle = '#16181c'; ctx.fillRect(bx + (bw + sc * 0.8) / 2 - bh * 1.45, by + bh * 0.15, bh * 2.9, bh * 0.7); ctx.fillStyle = '#ffd36a'; ctx.fillText('FINISH', bx + (bw + sc * 0.8) / 2, by + bh / 2); }
      }
    } else if (it.k === 'chic') {
      const o = it.o;
      for (let q = 0; q < 3; q++) {
        const xo = o.x - o.w / 2 + (q + 0.5) * o.w / 3;
        drawBale(ctx, proj, Math.max(ZN + 0.6, z - o.len * (q % 2 ? 0.3 : 0.7)), xo, { w: o.w / 3 * 1.02, h: 0.9, d: 1.3, seed: q + Math.floor(o.s) }, cx, (c) => fogHex(c, z));
      }
    } else if (it.k === 'rut') {
      const o = it.o, zf = z, zn = Math.max(ZN, z - o.len);
      const a = proj(zf, o.x - o.w / 2, 0), b = proj(zf, o.x + o.w / 2, 0), c = proj(zn, o.x + o.w / 2, 0), d = proj(zn, o.x - o.w / 2, 0);
      const mx = (a.x + b.x + c.x + d.x) / 4, my = (a.y + b.y + c.y + d.y) / 4, rx = Math.max(2, (Math.abs(b.x - a.x) + Math.abs(c.x - d.x)) / 4), ry = Math.max(1.5, Math.abs(d.y - a.y) / 2);
      const g = ctx.createRadialGradient(mx, my, 1, mx, my, rx);
      g.addColorStop(0, 'rgba(24,16,8,0.82)'); g.addColorStop(0.75, 'rgba(40,28,16,0.6)'); g.addColorStop(1, 'rgba(40,28,16,0)');
      ctx.save(); ctx.translate(mx, my); ctx.scale(1, ry / rx); ctx.translate(-mx, -my);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, rx, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,240,200,0.28)'; ctx.lineWidth = Math.max(1, rx * 0.06); ctx.beginPath(); ctx.ellipse(mx, my + ry * 0.15, rx * 0.8, ry * 0.7, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (it.k === 'puddle') {
      const o = it.o, zf = z, zn = Math.max(ZN, z - o.len);
      const a = proj(zf, o.x - o.w / 2, 0), b = proj(zf, o.x + o.w / 2, 0), c = proj(zn, o.x + o.w / 2, 0), d = proj(zn, o.x - o.w / 2, 0);
      const g = ctx.createLinearGradient(0, a.y, 0, d.y); g.addColorStop(0, 'rgba(176,214,238,0.85)'); g.addColorStop(1, 'rgba(96,150,196,0.75)');
      const mx = (a.x + b.x + c.x + d.x) / 4, my = (a.y + b.y + c.y + d.y) / 4;
      ctx.save(); ctx.beginPath(); ctx.ellipse(mx, my, Math.max(2, Math.abs(b.x - a.x + c.x - d.x) / 4), Math.max(1.5, Math.abs(d.y - a.y) / 2), 0, 0, TAU); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    } else if (it.k === 'cart' || it.k === 'ghost') {
      const isG = it.k === 'ghost', c = isG ? me : it.c, cr = isG ? null : c.r;
      const s = isG ? it.s : cr.s, xo = isG ? 0 : cr.x;
      const p = proj(z, xo, 0), sc = p.sc;
      if (sc < 2) return;
      const wh = c.st.build.wheels;
      drawCartBack(ctx, p.x, p.y, sc, {
        color: isG ? '#cfe4ff' : c.color, accent: c.human ? '#ffd36a' : '#ffffff', u: isG ? 0 : cr.u, lean: isG ? 0 : cr.lean, psi: isG ? 0 : cr.psi, spin: isG ? s * 2 : cr.spin,
        wheels: wh, frame: c.st.build.frame, shirt: c.human ? '#f2b53f' : c.color, helmet: c.human ? '#d33b2f' : '#f4f4f4', brake: !isG && cr.brake && cr.v > 0.5, t,
        bump: !isG && cr.hits ? 0 : 0, alpha: isG ? 0.38 : 1, num: isG ? '' : String(it.i + 1),
        build: c.st.build, who: isG ? 'Ghost' : c.name, v: isG ? 8 : cr.v, rough: isG ? 0 : Math.min(1, Math.max(0, (cr.rough - 0.02) * 16)), z, camH,
      });
      if (!isG && scn.names !== false && !c.human && sc > 6) {
        labels.push({ name: c.name, x: p.x, y: p.y - sc * 2.8, sc });     // drawn after every sprite, with overlap avoidance (below)
      }
    } else if (it.k === 'puff') {
      const q = it.q, p = proj(z, q.x, q.h), a = 1 - q.t / q.max, rad = Math.max(1.5, p.sc * q.size * (0.7 + q.t * 1.2));
      ctx.globalAlpha = Math.max(0, a * 0.6); ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    } else if (it.k === 'mark') {
      const m = it.m, p = proj(z, m.x, 0), w = 1.6 * p.sc, pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.save(); ctx.globalAlpha = 0.65 + 0.3 * pulse;
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = Math.max(2, w * 0.1); ctx.fillStyle = 'rgba(255,211,106,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, w, w * 0.32, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x, p.y - w * 0.2); ctx.lineTo(p.x - w * 0.35, p.y - w * 0.9); ctx.lineTo(p.x + w * 0.35, p.y - w * 0.9); ctx.closePath(); ctx.fillStyle = '#ffd36a'; ctx.fill();
      ctx.restore();
    }
  };

  // ---- road strips, far to near, sprites interleaved ----
  const kerbBend = (s) => Math.abs(course.k(s)) > 0.012;
  for (let i = NS - 2; i >= 0; i--) {
    const z0 = ZS[i], z1 = ZS[i + 1], sMid = camS + (z0 + z1) / 2;
    const sc0 = f / z0, sc1 = f / z1;
    const x0 = cx + X[i] * sc0, x1 = cx + X[i + 1] * sc1;
    const y0 = hyS + (camH - Y[i]) * sc0, y1 = hyS + (camH - Y[i + 1]) * sc1;
    if (y0 <= y1 && i < NS - 2) { /* hidden behind a crest: still draw, nearer strips will cover */ }
    const par = Math.floor(sMid / 8) & 1;
    const surf = course.surfAt(sMid), sf = SURF[surf];
    // grass
    poly(ctx, [R.x, y1, R.x + W, y1, R.x + W, y0 + 1, R.x, y0 + 1], fogHex(par ? '#68a643' : '#5f9a38', z0));
    // road
    const rc = par ? sf.road : sf.road2;
    poly(ctx, [x1 - ROAD * sc1, y1, x1 + ROAD * sc1, y1, x0 + ROAD * sc0, y0 + 1, x0 - ROAD * sc0, y0 + 1], fogHex(rc, z0));
    if (surf === 'pave') {
      ctx.strokeStyle = fogHex('#5f574d', z0); ctx.lineWidth = Math.max(1, sc0 * 0.05);
      ctx.beginPath(); ctx.moveTo(x0 - ROAD * sc0, y0); ctx.lineTo(x0 + ROAD * sc0, y0); ctx.stroke();
      for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(x0 + q * 1.2 * sc0, y0); ctx.lineTo(x1 + q * 1.2 * sc1, y1); ctx.stroke(); }
    } else if (surf === 'gravel') {
      ctx.fillStyle = fogHex('#8f7b58', z0);
      for (let q = 0; q < 3; q++) { const u = ((Math.floor(sMid) * 7 + q * 13) % 17) / 17 * 2 - 1, wq = sc0 * 0.16; ctx.fillRect(x0 + u * ROAD * 0.9 * sc0, y0 - (y0 - y1) * (0.2 + 0.25 * q), wq * 1.6, Math.max(1, wq * 0.5)); }
    }
    // worn wheel lanes, tar patches and cracks (tarmac); a few pebbles (gravel); wild flowers on the verges
    if (surf === 'tar') {
      for (const lx of [-1.25, 1.25]) poly(ctx, [x1 + (lx - 0.45) * sc1, y1, x1 + (lx + 0.45) * sc1, y1, x0 + (lx + 0.45) * sc0, y0 + 1, x0 + (lx - 0.45) * sc0, y0 + 1], `rgba(20,22,28,${fogA(0.1, z0)})`);
      const sh = Math.floor(sMid / 3), r1 = hash1(sh * 1.31), r2 = hash1(sh * 2.17);
      if (r1 > 0.72) { const px = (r2 * 2 - 1) * ROAD * 0.8, wq = (0.4 + r1 * 0.8) * sc0; ctx.fillStyle = `rgba(30,33,40,${fogA(0.35, z0)})`; ctx.fillRect(x0 + px * sc0, y0 - (y0 - y1) * 0.6, wq, Math.max(1, (y0 - y1) * 0.5)); }
      if (r2 > 0.8) { ctx.strokeStyle = `rgba(25,27,32,${fogA(0.5, z0)})`; ctx.lineWidth = Math.max(1, sc0 * 0.02); const px = (r1 * 2 - 1) * ROAD * 0.7; ctx.beginPath(); ctx.moveTo(x0 + px * sc0, y0); ctx.lineTo(x0 + (px + 0.35) * sc0, y0 - (y0 - y1) * 0.5); ctx.lineTo(x0 + (px + 0.1) * sc0, y1); ctx.stroke(); }
    }
    {
      const sh = Math.floor(sMid / 2);
      for (let q = 0; q < 2; q++) {
        const r = hash1(sh * 7.1 + q * 13.3);
        if (r > 0.55 && sc0 > 8) {
          const side = q ? 1 : -1, off = ROAD + 1.4 + r * 6, fx = x0 + side * off * sc0, fy = y0 - (y0 - y1) * (r * 0.8 + 0.1);
          ctx.fillStyle = fogHex(r > 0.8 ? '#ffe35a' : r > 0.7 ? '#f6f6f0' : '#e87aa0', z0); const rr = Math.max(1, sc0 * 0.035);
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(fx + k * rr * 2.2, fy + (k % 2) * rr, rr, 0, TAU); ctx.fill(); }
        }
      }
    }
    // kerbs on bends, painted edge lines elsewhere
    const kw = 0.38;
    if (kerbBend(sMid)) {
      const kc = (Math.floor(sMid / 3) & 1) ? '#d33b2f' : '#f4f1e8';
      poly(ctx, [x1 - (ROAD + kw) * sc1, y1, x1 - ROAD * sc1, y1, x0 - ROAD * sc0, y0 + 1, x0 - (ROAD + kw) * sc0, y0 + 1], fogHex(kc, z0));
      poly(ctx, [x1 + ROAD * sc1, y1, x1 + (ROAD + kw) * sc1, y1, x0 + (ROAD + kw) * sc0, y0 + 1, x0 + ROAD * sc0, y0 + 1], fogHex(kc, z0));
    } else {
      const e = 0.14, ex = ROAD - 0.25;
      poly(ctx, [x1 - (ex + e) * sc1, y1, x1 - ex * sc1, y1, x0 - ex * sc0, y0 + 1, x0 - (ex + e) * sc0, y0 + 1], fogHex('#f4f1e8', z0));
      poly(ctx, [x1 + ex * sc1, y1, x1 + (ex + e) * sc1, y1, x0 + (ex + e) * sc0, y0 + 1, x0 + ex * sc0, y0 + 1], fogHex('#f4f1e8', z0));
    }
    if (par && surf !== 'gravel') poly(ctx, [x1 - 0.07 * sc1, y1, x1 + 0.07 * sc1, y1, x0 + 0.07 * sc0, y0 + 1, x0 - 0.07 * sc0, y0 + 1], fogHex('#eae6d6', z0));
    // start and finish lines
    const sA = camS + z0, sB = camS + z1;
    if ((0 >= sA && 0 < sB) || (course.len >= sA && course.len < sB)) poly(ctx, [x1 - ROAD * sc1, y1, x1 + ROAD * sc1, y1, x0 + ROAD * sc0, y0 + 1, x0 - ROAD * sc0, y0 + 1], course.len >= sA && course.len < sB ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)');
    while (sp < spr.length && spr[sp].z >= z0) { drawSprite(spr[sp]); sp++; }
  }
  while (sp < spr.length) { drawSprite(spr[sp]); sp++; }
  // rival name labels: nearest first; a label that would sit on one already placed is lifted above it, or dropped when it still collides
  if (labels.length) {
    labels.sort((l1, l2) => l2.sc - l1.sc);
    const placed = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.fillStyle = '#fff';
    for (const l of labels) {
      const fs = Math.max(11, Math.min(18, l.sc * 0.5));
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      const w = ctx.measureText(l.name).width + 6, h = fs + 4;
      const x = Math.max(R.x + w / 2 + 2, Math.min(R.x + W - w / 2 - 2, l.x));
      let y = l.y, ok = false;
      for (let tries = 0; tries < 4 && !ok; tries++) {
        const box = { x0: x - w / 2, x1: x + w / 2, y0: y - fs, y1: y + 4 };
        if (!placed.some((q) => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) { placed.push(box); ok = true; } else y -= h;
      }
      if (ok) { ctx.strokeText(l.name, x, y); ctx.fillText(l.name, x, y); }
    }
  }

  // speed streaks at the edges and a soft vignette
  if (r.v > 9 && scn.fx !== false) {
    const a = Math.min(0.28, (r.v - 9) * 0.04);
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1, u = ((i * 0.37 + t * 1.9 * (0.5 + r.v / 14)) % 1), x = cx + side * (W * (0.3 + 0.2 * (i % 5) / 5 + 0.2 * u)), y = hyS + (R.y + H - hyS) * (0.2 + 0.8 * u);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * W * 0.04 * u, y + H * 0.06 * u); ctx.stroke();
    }
  }
  const vg = ctx.createRadialGradient(cx, R.y + H * 0.55, Math.min(W, H) * 0.4, cx, R.y + H * 0.55, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,20,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(R.x, R.y, W, H);
  ctx.restore();
  return { proj, hy: hyS, f, camH, camS };
}
