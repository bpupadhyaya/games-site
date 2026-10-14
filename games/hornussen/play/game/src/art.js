// Static and sprite art for the Alpine meadow: sky, mountains, chalets, pines, the Bock, striker, fielders, boards and the puck.
// Everything is canvas drawing with soft lighting; heavy backdrops are painted once into an OffscreenCanvas layer (when the host
// has one) keyed by screen size and venue, and blitted per frame. No text is baked in here (fonts may still be loading).
import { venueOf } from './rules.js';

export const TEAM = [
  { shirt: '#d93a2b', dark: '#8f2118', light: '#ff8a76', trim: '#fff1d6', name: 'red' },
  { shirt: '#2c7fd1', dark: '#17497f', light: '#8cc4f5', trim: '#fff1d6', name: 'blue' },
];
export const INK = '#2b2118', ACC = '#a3262a', CREAM = '#f7f0dc', FOREST = '#173d2a', GOLD = '#f0b429';
const TAU = Math.PI * 2;

export function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function mix(a, b, f) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const hex = (a, b, f) => { const m = mix(a, b, f).match(/\d+/g).map(Number); return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join(''); };
export const shade = hex;
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// ---- cached layers ------------------------------------------------------------------------------------------------------
export const artStats = { layerPaints: 0 };
const layers = new Map();
function layer(key, w, h, paint, scale = 1) {
  let L = layers.get(key);
  if (L === undefined) {
    L = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const k = Math.min(scale, Math.sqrt(5.5e6 / (w * h))), c = new OffscreenCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k))), lc = c.getContext('2d');
        lc.scale(k, k); paint(lc, k); L = c; artStats.layerPaints++;
      }
    } catch { L = null; }
    layers.set(key, L);
    if (layers.size > 14) layers.delete(layers.keys().next().value);
  }
  return L;
}

// ---- sky and mountains ---------------------------------------------------------------------------------------------------
function ridge(r, w, base, amp, peaks, seedOff) {
  const k = [], n = 4;
  for (let i = 0; i < n; i++) k.push({ f: (0.6 + r() * 1.5 + i * 0.9) * peaks / w * TAU, p: r() * TAU, a: amp * (0.5 + r()) / (i + 1.4) });
  return (x) => { let v = 0; for (const q of k) v += q.a * Math.abs(Math.sin(q.f * x + q.p + seedOff)); return base - v; };
}
function paintBackdrop(ctx, w, h, hy, venue) {
  const v = venueOf(venue), r = lcg(97 + venue.length * 13);
  const sky = ctx.createLinearGradient(0, 0, 0, hy + 10);
  sky.addColorStop(0, v.sky[0]); sky.addColorStop(1, v.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hy + 12);
  // sun glow
  const sx = w * (venue === 'entlebuch' ? 0.2 : venue === 'jura' ? 0.78 : 0.7), sy = hy * (venue === 'entlebuch' ? 0.62 : 0.34);
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, hy) * 0.55);
  g.addColorStop(0, v.sun); g.addColorStop(0.08, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy + 12);
  // far snow mountains, mid ranges, near green hills
  const layersCfg = [
    { col: v.mount[0], snow: true, base: hy - 4, amp: hy * 0.62, peaks: Math.max(3, w / 190) },
    { col: v.mount[1], snow: true, base: hy - 2, amp: hy * 0.44, peaks: Math.max(4, w / 150) },
    { col: v.mount[2], snow: false, base: hy + 6, amp: hy * 0.2, peaks: Math.max(4, w / 260) },
  ];
  layersCfg.forEach((c, li) => {
    const f = ridge(r, w, c.base, c.amp, c.peaks, li * 1.7), pts = [];
    for (let x = 0; x <= w + 6; x += 6) pts.push([x, f(x)]);
    ctx.beginPath(); ctx.moveTo(0, hy + 20); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(w, hy + 20); ctx.closePath();
    const gr = ctx.createLinearGradient(0, hy - c.amp, 0, hy + 20); gr.addColorStop(0, hex(c.col, '#ffffff', 0.18)); gr.addColorStop(1, hex(c.col, v.sky[1], 0.45));
    ctx.fillStyle = gr; ctx.fill();
    if (c.snow) {
      ctx.save(); ctx.clip();
      const top = hy - c.amp * 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0);
      for (let x = w; x >= 0; x -= 12) ctx.lineTo(x, top + Math.abs(Math.sin(x * 0.07 + li)) * c.amp * 0.18 + (x % 24 ? 5 : 0));
      ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      // shaded flank
      ctx.fillStyle = 'rgba(80,100,140,0.18)'; for (let x = 0; x < w; x += 46) { ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(x + 20, f(x + 20) + 6); ctx.lineTo(x + 38, hy); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    // haze between ranges
    const hz = ctx.createLinearGradient(0, hy - c.amp * 0.5, 0, hy + 14); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, `rgba(255,255,255,${0.22 + li * 0.05})`);
    ctx.fillStyle = hz; ctx.fillRect(0, hy - c.amp * 0.5, w, c.amp * 0.5 + 24);
  });
  // far tree line + chalets on the hills
  const rr2 = lcg(31);
  for (let x = -10; x < w + 10; x += 8 + rr2() * 10) {
    const hh = 10 + rr2() * 18, yy = hy + 10 + rr2() * 10;
    ctx.fillStyle = hex(v.mount[2], '#0e2a18', 0.35 + rr2() * 0.25);
    ctx.beginPath(); ctx.moveTo(x - hh * 0.28, yy); ctx.lineTo(x, yy - hh); ctx.lineTo(x + hh * 0.28, yy); ctx.closePath(); ctx.fill();
  }
  // meadow beyond the Ries (the near ground is painted live, this fills the strip down from the horizon)
  const mg = ctx.createLinearGradient(0, hy + 8, 0, hy + 120);
  mg.addColorStop(0, hex(v.grass[0], v.sky[1], 0.55)); mg.addColorStop(1, v.grass[1]);
  ctx.fillStyle = mg; ctx.fillRect(0, hy + 14, w, 110);
}
export function drawBackdrop(ctx, L, cam, venue) {
  const w = L.w, hy = Math.max(60, Math.round(cam.hy)), key = `bd|${w}|${hy}|${venue}`;
  const lay = layer(key, w, hy + 130, (c) => paintBackdrop(c, w, hy, hy, venue), 1.5);
  if (lay) ctx.drawImage(lay, 0, 0, w, hy + 130);
  else paintBackdrop(ctx, w, hy, hy, venue);
  return hy;
}

// drifting clouds (live)
export function drawClouds(ctx, w, hy, t, calm) {
  const r = lcg(5);
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const sp = 4 + r() * 5, y = hy * (0.1 + r() * 0.5), sz = 40 + r() * 70, x0 = r() * (w + 400);
    const x = ((x0 + (calm ? 0 : t * sp)) % (w + 400)) - 200;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x + (k - 2) * sz * 0.38, y + Math.abs(k - 2) * 3, sz * (0.5 - Math.abs(k - 2) * 0.08), sz * 0.26, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(210,225,245,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + sz * 0.13, sz * 0.9, sz * 0.1, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- scenery objects ------------------------------------------------------------------------------------------------------
export function drawPine(ctx, X, Y, s, tone = 0) {
  const h = 6 * s, w = 1.7 * s;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(X + w * 0.5, Y, w * 0.9, w * 0.22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(X - w * 0.08, Y - h * 0.18, w * 0.16, h * 0.18);
  for (let i = 0; i < 4; i++) {
    const y1 = Y - h * (0.12 + i * 0.22), y0 = y1 - h * 0.34, ww = w * (1 - i * 0.2);
    ctx.fillStyle = tone ? '#1f5a35' : '#1a4d2e'; ctx.beginPath(); ctx.moveTo(X - ww / 2, y1); ctx.lineTo(X, y0); ctx.lineTo(X + ww / 2, y1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,200,120,0.28)'; ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X + ww / 2, y1); ctx.lineTo(X + ww * 0.1, y1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
export function drawChalet(ctx, X, Y, s) {
  const w = 7 * s, h = 3.4 * s;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(X, Y, w * 0.62, w * 0.08, 0, 0, TAU); ctx.fill();
  const wall = ctx.createLinearGradient(0, Y - h, 0, Y); wall.addColorStop(0, '#c58a52'); wall.addColorStop(1, '#8a5a30');
  ctx.fillStyle = wall; ctx.fillRect(X - w / 2, Y - h, w, h);
  ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = Math.max(1, s * 0.08);
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(X - w / 2, Y - h + i * h / 5); ctx.lineTo(X + w / 2, Y - h + i * h / 5); ctx.stroke(); }
  ctx.fillStyle = '#6d3b22'; ctx.beginPath(); ctx.moveTo(X - w * 0.62, Y - h + 2); ctx.lineTo(X, Y - h - h * 0.62); ctx.lineTo(X + w * 0.62, Y - h + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,150,0.25)'; ctx.beginPath(); ctx.moveTo(X, Y - h - h * 0.62); ctx.lineTo(X + w * 0.62, Y - h + 2); ctx.lineTo(X + w * 0.1, Y - h + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; for (const dx of [-0.26, 0.2]) { ctx.fillRect(X + dx * w, Y - h * 0.7, w * 0.14, h * 0.32); }
  ctx.fillStyle = '#d8392b'; for (const dx of [-0.26, 0.2]) { ctx.fillRect(X + dx * w - w * 0.03, Y - h * 0.4, w * 0.2, h * 0.07); }
  ctx.restore();
}
export function drawCow(ctx, X, Y, s, flip = 1) {
  const w = 2.1 * s, h = 1.15 * s;
  ctx.save(); ctx.translate(X, Y); ctx.scale(flip, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, w * 0.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f4f1ea'; rr(ctx, -w * 0.5, -h * 0.95, w, h * 0.62, h * 0.25); ctx.fill();
  ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.ellipse(-w * 0.1, -h * 0.72, w * 0.16, h * 0.18, 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(w * 0.22, -h * 0.62, w * 0.12, h * 0.13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f4f1ea'; rr(ctx, w * 0.38, -h * 1.0, w * 0.26, h * 0.4, h * 0.14); ctx.fill();
  ctx.fillStyle = '#e8b8a8'; ctx.fillRect(w * 0.58, -h * 0.82, w * 0.07, h * 0.16);
  ctx.fillStyle = '#4a3a30'; for (const dx of [-0.38, -0.18, 0.18, 0.36]) ctx.fillRect(w * dx, -h * 0.34, w * 0.07, h * 0.36);
  ctx.restore();
}
// bunting between two points (red and cream pennants, no symbols)
export function drawBunting(ctx, x0, y0, x1, y1, s, t, calm) {
  ctx.save(); ctx.strokeStyle = 'rgba(40,30,20,0.75)'; ctx.lineWidth = Math.max(1, s * 0.05);
  const sag = Math.abs(x1 - x0) * 0.06, n = 9;
  ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; ctx.lineTo(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag); } ctx.stroke();
  for (let i = 1; i < n; i++) {
    const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag, sw = calm ? 0 : Math.sin(t * 3 + i) * s * 0.06;
    ctx.fillStyle = i % 2 ? '#d93a2b' : '#fff1d6';
    ctx.beginPath(); ctx.moveTo(x - s * 0.28, y); ctx.lineTo(x + s * 0.28, y); ctx.lineTo(x + sw, y + s * 0.55); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// the wind flag on a pole: `wind` in m/s, positive = blowing to the right of the screen
export function drawFlagPole(ctx, X, Y, s, wind, t, calm) {
  const h = 4.2 * s, len = (0.9 + Math.min(1.6, Math.abs(wind)) * 0.85) * s, dir = wind >= 0 ? 1 : -1;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(X, Y, s * 0.5, s * 0.1, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = Math.max(2, s * 0.12); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - h); ctx.stroke();
  const fy = Y - h, fl = calm ? 0 : Math.sin(t * 6) * 0.1, pts = 8;
  ctx.beginPath(); ctx.moveTo(X, fy);
  for (let i = 0; i <= pts; i++) { const u = i / pts; ctx.lineTo(X + dir * len * u, fy + Math.sin(u * 5 - t * 7) * s * 0.1 * u * (calm ? 0.2 : 1) + u * s * 0.25 * (1 - Math.min(1, Math.abs(wind)) * 0.8) + fl * s * u); }
  for (let i = pts; i >= 0; i--) { const u = i / pts; ctx.lineTo(X + dir * len * u, fy + s * 0.5 * (1 - u * 0.4) + Math.sin(u * 5 - t * 7) * s * 0.1 * u * (calm ? 0.2 : 1) + u * s * 0.25 * (1 - Math.min(1, Math.abs(wind)) * 0.8)); }
  ctx.closePath(); ctx.fillStyle = '#d93a2b'; ctx.fill(); ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = Math.max(1, s * 0.07); ctx.stroke();
  ctx.restore();
}

// ---- the Bock, striker, rod ---------------------------------------------------------------------------------------------------
// The Bock: a wooden ramp, higher at the back; the puck rests on its sloping top. (X, Y) = middle of its foot, s = px/m.
export function drawBock(ctx, X, Y, s, withPuck = true, calm = false) {
  const w = 1.7 * s, d = 1.0 * s, hBack = 1.1 * s, hFront = 0.35 * s;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X + w * 0.1, Y + d * 0.1, w * 0.75, d * 0.38, 0, 0, TAU); ctx.fill();
  // side face
  ctx.fillStyle = '#8c5a2e'; ctx.beginPath(); ctx.moveTo(X - w / 2, Y); ctx.lineTo(X + w / 2, Y); ctx.lineTo(X + w / 2, Y - hFront); ctx.lineTo(X - w / 2, Y - hFront); ctx.closePath(); ctx.fill();
  // sloping top (seen from behind: the far end is higher)
  const tg = ctx.createLinearGradient(0, Y - hBack, 0, Y - hFront); tg.addColorStop(0, '#e1ae6c'); tg.addColorStop(1, '#bf8340');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(X - w / 2, Y - hFront); ctx.lineTo(X + w / 2, Y - hFront); ctx.lineTo(X + w * 0.36, Y - hBack); ctx.lineTo(X - w * 0.36, Y - hBack); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = Math.max(1, s * 0.05);
  for (let i = 1; i < 4; i++) { const u = i / 4; ctx.beginPath(); ctx.moveTo(X - w / 2 + u * w * 0.14, Y - hFront - (hBack - hFront) * u); ctx.lineTo(X + w / 2 - u * w * 0.14, Y - hFront - (hBack - hFront) * u); ctx.stroke(); }
  ctx.strokeStyle = '#5a3416'; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.beginPath(); ctx.moveTo(X - w / 2, Y - hFront); ctx.lineTo(X - w * 0.36, Y - hBack); ctx.lineTo(X + w * 0.36, Y - hBack); ctx.lineTo(X + w / 2, Y - hFront); ctx.closePath(); ctx.stroke();
  if (withPuck) drawPuckAt(ctx, X, Y - hBack - s * 0.05, Math.max(3.5, s * 0.17), 0);
  void calm;
  ctx.restore();
}
// a puck seen mostly edge-on: dark disc with a bright rim; `glow` 0..1 adds a halo while it flies
export function drawPuckAt(ctx, X, Y, r, glow) {
  ctx.save();
  if (glow > 0) { const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 4.2); g.addColorStop(0, `rgba(255,220,120,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 4.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ff7a1c'; ctx.beginPath(); ctx.ellipse(X, Y, r, r * 0.78, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1c1410'; ctx.beginPath(); ctx.ellipse(X, Y + r * 0.1, r * 0.72, r * 0.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = Math.max(1, r * 0.25); ctx.beginPath(); ctx.ellipse(X, Y, r, r * 0.78, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

// A person, front or back view, standing at (X, Y) with feet on the ground. `o`: team, back, arms (0 down .. 1 up), lean, step.
export function drawPerson(ctx, X, Y, s, o) {
  const T = TEAM[o.team ?? 0], k = Math.max(s, 1) * (o.big || 1), bob = o.bob || 0;
  const legH = 0.82 * k, torso = 0.68 * k, tw = 0.5 * k, headR = 0.15 * k;
  const hipY = Y - legH + bob * k, shY = hipY - torso, lean = (o.lean || 0) * k;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.24)'; ctx.beginPath(); ctx.ellipse(X, Y, 0.5 * k, 0.12 * k, 0, 0, TAU); ctx.fill();
  // legs
  const sp = (o.step || 0) * 0.14 * k;
  ctx.strokeStyle = '#26304a'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.4, 0.2 * k);
  ctx.beginPath(); ctx.moveTo(X - 0.12 * k, hipY); ctx.lineTo(X - 0.14 * k - sp, Y); ctx.moveTo(X + 0.12 * k, hipY); ctx.lineTo(X + 0.14 * k + sp, Y); ctx.stroke();
  ctx.strokeStyle = '#141a2b'; ctx.lineWidth = Math.max(1.6, 0.22 * k); ctx.beginPath(); ctx.moveTo(X - 0.14 * k - sp, Y - 0.02 * k); ctx.lineTo(X - 0.17 * k - sp, Y); ctx.moveTo(X + 0.14 * k + sp, Y - 0.02 * k); ctx.lineTo(X + 0.17 * k + sp, Y); ctx.stroke();
  // arms (behind the torso when raised overhead)
  const arms = o.arms || 0, hand = (sx) => ({ x: X + sx * (0.34 + 0.05 * arms) * k + lean * 0.6, y: shY + 0.1 * k - arms * 0.9 * k + (1 - arms) * 0.5 * k });
  ctx.strokeStyle = T.shirt; ctx.lineWidth = Math.max(1.4, 0.17 * k);
  if (arms > 0.02) { ctx.beginPath(); for (const sx of [-1, 1]) { const h = hand(sx); ctx.moveTo(X + sx * tw * 0.5 + lean * 0.5, shY + 0.1 * k); ctx.lineTo(h.x, h.y); } ctx.stroke(); }
  // torso
  const tg = ctx.createLinearGradient(X - tw / 2, 0, X + tw / 2, 0); tg.addColorStop(0, T.light); tg.addColorStop(0.45, T.shirt); tg.addColorStop(1, T.dark);
  ctx.fillStyle = tg; rr(ctx, X - tw / 2 + lean * 0.3, shY, tw, torso + 0.04 * k, tw * 0.28); ctx.fill();
  ctx.fillStyle = T.trim; ctx.fillRect(X - tw / 2 + lean * 0.3, shY + torso * 0.62, tw, Math.max(1, 0.07 * k));
  if (arms <= 0.02) { ctx.strokeStyle = T.shirt; ctx.lineWidth = Math.max(1.4, 0.17 * k); ctx.beginPath(); ctx.moveTo(X - tw * 0.5, shY + 0.1 * k); ctx.lineTo(X - tw * 0.62, shY + 0.5 * k); ctx.moveTo(X + tw * 0.5, shY + 0.1 * k); ctx.lineTo(X + tw * 0.62, shY + 0.5 * k); ctx.stroke(); }
  // head
  const hx = X + lean, hy = shY - headR * 0.85;
  ctx.fillStyle = '#e6b48f'; ctx.beginPath(); ctx.arc(hx, hy, headR, 0, TAU); ctx.fill();
  ctx.fillStyle = o.back ? '#4a3220' : '#5a3d28'; ctx.beginPath(); ctx.arc(hx, hy - headR * 0.12, headR * 1.02, Math.PI, TAU); ctx.fill();
  if (o.back) { ctx.beginPath(); ctx.arc(hx, hy, headR * 0.98, 0, TAU); ctx.fill(); }
  else if (k > 12) { ctx.fillStyle = '#2a1b12'; ctx.fillRect(hx - headR * 0.45, hy - headR * 0.05, headR * 0.2, headR * 0.2); ctx.fillRect(hx + headR * 0.25, hy - headR * 0.05, headR * 0.2, headR * 0.2); }
  ctx.restore();
  return { hx: X, topY: hy - headR, shY, hand: (sx) => hand(sx), k };
}

// The Schindel: a wooden board on a short grip. (X, Y) = the board's centre; s = px/m; `rot` radians; `size` scales it.
export function drawBoard(ctx, X, Y, s, rot = 0, a = 1, hot = false) {
  const w = Math.max(9, 1.9 * s), h = Math.max(6, 1.15 * s);
  ctx.save(); ctx.translate(X, Y); ctx.rotate(rot); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, -w / 2 + 2, -h / 2 + 3, w, h, h * 0.12); ctx.fill();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#f0c27a'); g.addColorStop(0.5, '#d49a52'); g.addColorStop(1, '#a8702e');
  ctx.fillStyle = g; rr(ctx, -w / 2, -h / 2, w, h, h * 0.12); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,16,0.55)'; ctx.lineWidth = Math.max(1, s * 0.05);
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 2, -h / 2 + i * h / 4); ctx.lineTo(w / 2 - 2, -h / 2 + i * h / 4); ctx.stroke(); }
  ctx.strokeStyle = hot ? '#fff2a8' : '#5a3416'; ctx.lineWidth = Math.max(1.4, s * 0.1); rr(ctx, -w / 2, -h / 2, w, h, h * 0.12); ctx.stroke();
  ctx.restore();
}

// The Träf: a long flexible rod. Base at the hands (bx, by); `ang` = direction (radians, 0 = right, -PI/2 = up); `bend` bends it
// (positive curls the tip toward the screen's left/back). Returns the tip.
export function drawRod(ctx, bx, by, ang, len, bend, w) {
  const pts = []; let x = bx, y = by, a = ang;
  const n = 14;
  for (let i = 0; i <= n; i++) { pts.push([x, y]); a += bend / n * (0.4 + i / n * 1.2); x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = w + 2; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + 2, py + 3) : ctx.moveTo(px + 2, py + 3))); ctx.stroke();
  ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
  ctx.strokeStyle = '#e8b36a'; ctx.lineWidth = Math.max(1, w * 0.4); ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py - w * 0.15) : ctx.moveTo(px, py - w * 0.15))); ctx.stroke();
  const tip = pts[n], tp = pts[n - 1], ta = Math.atan2(tip[1] - tp[1], tip[0] - tp[0]);
  ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(ta); ctx.fillStyle = '#2b2118'; rr(ctx, -w * 0.5, -w * 1.1, w * 2.6, w * 2.2, w * 0.5); ctx.fill(); ctx.restore();
  ctx.restore();
  return { x: tip[0], y: tip[1], a: ta };
}

// ---- panel + small UI art ----------------------------------------------------------------------------------------------------------
export function drawPanel(ctx, x, y, w, h) {
  // a carved walnut frame around a parchment card, brass inner line
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 9;
  const fg = ctx.createLinearGradient(0, y, 0, y + h); fg.addColorStop(0, '#5a3a20'); fg.addColorStop(1, '#2b1a0c');
  ctx.fillStyle = fg; rr(ctx, x, y, w, h, 28); ctx.fill(); ctx.restore();
  const fr = 11;
  const pg = ctx.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, '#fbf3df'); pg.addColorStop(1, '#e8d8b2');
  ctx.fillStyle = pg; rr(ctx, x + fr, y + fr, w - 2 * fr, h - 2 * fr, 20); ctx.fill();
  ctx.save(); rr(ctx, x + fr, y + fr, w - 2 * fr, h - 2 * fr, 20); ctx.clip();
  const sh = ctx.createLinearGradient(0, y + fr, 0, y + fr + 26); sh.addColorStop(0, 'rgba(60,30,10,0.28)'); sh.addColorStop(1, 'rgba(60,30,10,0)'); ctx.fillStyle = sh; ctx.fillRect(x, y, w, fr + 26); ctx.restore();
  const eg = ctx.createLinearGradient(0, y, 0, y + h); eg.addColorStop(0, '#fbe392'); eg.addColorStop(0.5, '#c79a34'); eg.addColorStop(1, '#8c6620');
  ctx.strokeStyle = eg; ctx.lineWidth = 3; rr(ctx, x + 2, y + 2, w - 4, h - 4, 27); ctx.stroke();
  ctx.strokeStyle = 'rgba(163,38,42,0.5)'; ctx.lineWidth = 2; rr(ctx, x + fr + 7, y + fr + 7, w - 2 * fr - 14, h - 2 * fr - 14, 14); ctx.stroke();
  for (const [px, py] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) { const g = ctx.createRadialGradient(px - 1, py - 1, 0.5, px, py, 4.5); g.addColorStop(0, '#fff2b8'); g.addColorStop(1, '#8a6420'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fill(); }
}
