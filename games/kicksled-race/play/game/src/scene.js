// The side-on winter scene: sky, parallax scenery per course theme, the snow track with its surfaces, bends, bumps,
// start and finish gates, the racers, snow spray and falling snow. Pure drawing from a snapshot; no state is changed.
import { hashf, clamp, lerp, SURF } from './sim.js';
import { drawRider, shade } from './art.js';

export const EXAG = 1.5;            // visual slope exaggeration
const vn = (t) => { const i = Math.floor(t), f = t - i, e = f * f * (3 - 2 * f); return lerp(hashf(i), hashf(i + 1), e); };
const TAU = Math.PI * 2;

const THEMES = {
  town: { top: '#6fa9e0', mid: '#bcd6ee', bot: '#fbe3cc', sun: [0.76, 0.2, '255,238,196'], far: '#b6c9df', hill: '#8ea8c6', snow: ['#fbfdff', '#c9dcee'], trees: '#3f5b6e', light: 'day' },
  lake: { top: '#17224f', mid: '#4a5fa3', bot: '#f4b497', sun: [0.2, 0.34, '255,190,150'], far: '#6c78ae', hill: '#46558c', snow: ['#eef6ff', '#a9c3e2'], trees: '#1f3550', aurora: true, light: 'evening' },
  forest: { top: '#8fa7bd', mid: '#c6d4df', bot: '#eef2f4', sun: [0.5, 0.18, '255,255,255'], far: '#9db0c0', hill: '#70889c', snow: ['#f7fbff', '#bfd2e4'], trees: '#264a44', snowfall: 2, light: 'day' },
  harbour: { top: '#3f84c6', mid: '#9cc4e6', bot: '#ffc98c', sun: [0.28, 0.42, '255,200,130'], far: '#86a5c4', hill: '#5f84ad', snow: ['#fcfdff', '#cfdcec'], trees: '#33506a', sea: true, light: 'evening' },
};
export const themeOf = (id) => THEMES[id] ?? THEMES.town;

function pine(ctx, x, base, h, col, snowy) {
  // three lit tiers: the sun side is lighter, the far side darker, with a lit snow load on each tier and a trunk in the shade
  const w = h * 0.42, tiers = 4;
  ctx.fillStyle = shade(col, -0.35); ctx.fillRect(x - w * 0.05, base - h * 0.2, w * 0.1, h * 0.2);
  for (let i = tiers - 1; i >= 0; i--) {
    const yTop = base - h + (h * i) / tiers * 0.9, yBot = base - h + (h * (i + 1)) / tiers + h * 0.04, ww = w * ((i + 1) / tiers) * 0.55 + w * 0.12;
    ctx.fillStyle = shade(col, 0.1); ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x - ww, yBot); ctx.lineTo(x, yBot - h * 0.025); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(col, -0.2); ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + ww, yBot); ctx.lineTo(x, yBot - h * 0.025); ctx.closePath(); ctx.fill();
    if (snowy) {
      const cut = yTop + (yBot - yTop) * 0.5, cw = ww * 0.5;
      ctx.fillStyle = '#f5f9ff'; ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x - cw, cut); ctx.quadraticCurveTo(x - cw * 0.4, cut + h * 0.035, x, cut - h * 0.01); ctx.quadraticCurveTo(x + cw * 0.4, cut + h * 0.04, x + cw, cut); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(150,175,215,0.55)'; ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + cw, cut); ctx.lineTo(x, cut - h * 0.01); ctx.closePath(); ctx.fill();
    }
  }
}

const FACADES = ['#c8503c', '#e0a93c', '#4f86a8', '#8a5a3c', '#b8473a', '#d9c7a0'];
function house(ctx, x, base, w, h, seed, night) {
  const col = FACADES[Math.floor(hashf(seed) * FACADES.length)];
  const g = ctx.createLinearGradient(0, base - h, 0, base);
  g.addColorStop(0, shade(col, 0.06)); g.addColorStop(1, shade(col, -0.12));
  ctx.fillStyle = g; ctx.fillRect(x, base - h, w, h);
  // snowy gable roof
  ctx.fillStyle = '#4a4f63';
  ctx.beginPath(); ctx.moveTo(x - w * 0.06, base - h); ctx.lineTo(x + w / 2, base - h - w * 0.34); ctx.lineTo(x + w * 1.06, base - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4f9ff';
  ctx.beginPath(); ctx.moveTo(x - w * 0.06, base - h); ctx.lineTo(x + w / 2, base - h - w * 0.34); ctx.lineTo(x + w * 1.06, base - h);
  ctx.lineTo(x + w * 0.98, base - h - w * 0.02); ctx.lineTo(x + w / 2, base - h - w * 0.29); ctx.lineTo(x + w * 0.02, base - h - w * 0.02); ctx.closePath(); ctx.fill();
  // windows
  const cols = Math.max(2, Math.floor(w / 26)), rows = Math.max(1, Math.floor(h / 40));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lit = hashf(seed * 31 + r * 7 + c) < (night ? 0.8 : 0.45);
    const wx = x + (c + 0.5) * (w / cols) - 5, wy = base - h + 10 + r * (h - 20) / rows;
    ctx.fillStyle = lit ? '#ffd27a' : 'rgba(30,45,70,0.75)';
    ctx.fillRect(wx, wy, 10, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(wx - 1, wy + 14, 12, 2);
  }
}

function lamp(ctx, x, base, h, warm) {
  ctx.strokeStyle = '#2a3342'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.quadraticCurveTo(x, base - h - 10, x + 12, base - h - 10); ctx.stroke();
  const g = ctx.createRadialGradient(x + 14, base - h - 4, 2, x + 14, base - h - 4, 46);
  g.addColorStop(0, warm ? 'rgba(255,214,130,0.85)' : 'rgba(255,240,200,0.5)'); g.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 40, base - h - 52, 110, 100);
  ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.arc(x + 14, base - h - 4, 5, 0, TAU); ctx.fill();
}

// sky, sun, aurora, far mountains, mid hills and the theme's mid-distance objects
function backdrop(ctx, R, scn, th) {
  const { x, y, w } = R;
  const horizon = scn.horizon, K = clamp((horizon - R.y) / 420, 0.75, 2.2);
  const w3 = globalThis.__world3d;
  if (w3 && w3.draw && w3.draw(ctx, R, scn.race.course.theme, scn.camX, horizon, scn.t, scn.s)) { ridge(ctx, R, scn, th, horizon); return; }
  const g = ctx.createLinearGradient(0, y, 0, horizon);
  g.addColorStop(0, th.top); g.addColorStop(0.55, th.mid); g.addColorStop(1, th.bot);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, horizon - y + 2);
  const [sx, sy, sc] = th.sun, scx = x + w * sx, scy = y + (horizon - y) * sy;
  const sg = ctx.createRadialGradient(scx, scy, 4, scx, scy, 220);
  sg.addColorStop(0, `rgba(${sc},0.95)`); sg.addColorStop(0.2, `rgba(${sc},0.4)`); sg.addColorStop(1, `rgba(${sc},0)`);
  ctx.fillStyle = sg; ctx.fillRect(x, y, w, horizon - y + 2);
  if (th.aurora) {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const t = scn.t * 0.15 + k;
      ctx.moveTo(x, y + 20);
      for (let i = 0; i <= 24; i++) { const px = x + (w * i) / 24; ctx.lineTo(px, y + 30 + k * 36 + Math.sin(i * 0.5 + t) * 22 + Math.sin(i * 0.19 - t * 0.7) * 16); }
      for (let i = 24; i >= 0; i--) { const px = x + (w * i) / 24; ctx.lineTo(px, y + 90 + k * 36 + Math.sin(i * 0.5 + t) * 22 + Math.sin(i * 0.19 - t * 0.7) * 16 + 40); }
      ctx.closePath();
      const ag = ctx.createLinearGradient(0, y + 20, 0, y + 180);
      ag.addColorStop(0, k % 2 ? 'rgba(120,255,200,0.0)' : 'rgba(90,255,190,0.0)'); ag.addColorStop(0.4, k % 2 ? 'rgba(120,230,255,0.28)' : 'rgba(110,255,190,0.3)'); ag.addColorStop(1, 'rgba(180,120,255,0)');
      ctx.fillStyle = ag; ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++) { const px = x + hashf(i * 3) * w, py = y + hashf(i * 5 + 1) * (horizon - y) * 0.55; ctx.globalAlpha = 0.4 + 0.5 * hashf(i + Math.floor(scn.t * 2)); ctx.fillRect(px, py, 2, 2); }
    ctx.globalAlpha = 1;
  }
  // far mountains (slow) with bright snow caps
  const layer = (par, base, amp, wl, col, seed, cap) => {
    const off = scn.camPx * par;
    ctx.beginPath(); ctx.moveTo(x, horizon);
    const pts = [];
    for (let sxp = x; sxp <= x + w + 8; sxp += 8) {
      const lx = sxp - x + off;
      const h = base + amp * (0.62 * vn(lx / wl + seed) + 0.38 * vn(lx / (wl * 0.33) + seed * 2.7));
      pts.push([sxp, horizon - h]); ctx.lineTo(sxp, horizon - h);
    }
    ctx.lineTo(x + w, horizon); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    if (cap) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(([px, py]) => ctx.lineTo(px, py));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 14 + 10 * vn(pts[i][0] / 40 + seed));
      ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    }
  };
  layer(0.05, 70 * K, 150 * K, 420, th.far, 1.3, true);
  layer(0.11, 40 * K, 90 * K, 300, th.hill, 7.1, false);
  if (th.sea) {
    const sg2 = ctx.createLinearGradient(0, horizon - 40, 0, horizon);
    sg2.addColorStop(0, 'rgba(70,120,170,0.0)'); sg2.addColorStop(1, 'rgba(60,110,160,0.55)');
    ctx.fillStyle = sg2; ctx.fillRect(x, horizon - 40, w, 40);
  }
  // mid-distance objects
  const par = 0.3, sp = th === THEMES.forest ? 54 : 120, off = scn.camPx * par;
  const i0 = Math.floor(off / sp) - 1, i1 = Math.floor((off + w) / sp) + 2;
  for (let i = i0; i <= i1; i++) {
    const px = x + i * sp - off + hashf(i * 7) * sp * 0.5, base = horizon + 6;
    if (px < x - 160 || px > x + w + 160) continue;
    if (th === THEMES.town) {
      if (hashf(i * 13) < 0.7) house(ctx, px, base, (70 + hashf(i) * 50) * K, (70 + hashf(i + 9) * 60) * K, i, false);
      else pine(ctx, px, base, (90 + hashf(i) * 40) * K, th.trees, true);
    } else if (th === THEMES.forest) {
      pine(ctx, px, base, (110 + hashf(i) * 70) * K, th.trees, true);
    } else if (th === THEMES.lake) {
      if (hashf(i * 17) < 0.25) house(ctx, px, base, 50 * K, 40 * K, i + 100, true);
      else if (hashf(i * 5) < 0.6) pine(ctx, px, base, (50 + hashf(i) * 40) * K, th.trees, true);
    } else {
      if (hashf(i * 3) < 0.5) { ctx.fillStyle = '#43566e'; ctx.fillRect(px, base - 56 - hashf(i) * 30, 70, 56 + hashf(i) * 30); ctx.fillStyle = '#e8f1fa'; ctx.fillRect(px - 3, base - 60 - hashf(i) * 30, 76, 6); }
      else { ctx.strokeStyle = '#33414f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, base - 90 - hashf(i) * 50); ctx.moveTo(px - 24, base - 70); ctx.lineTo(px + 24, base - 70); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px, base - 85); ctx.lineTo(px + 28, base - 12); ctx.lineTo(px, base - 12); ctx.closePath(); ctx.fillStyle = 'rgba(240,246,252,0.85)'; ctx.fill(); }
    }
  }
  ridge(ctx, R, scn, th, horizon);
}

function ridge(ctx, R, scn, th, horizon) {
  const { x, w } = R;
  // a snowy ridge hiding the base of the objects
  ctx.fillStyle = th.snow[0]; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(x, horizon + 14);
  for (let sxp = x; sxp <= x + w + 12; sxp += 12) ctx.lineTo(sxp, horizon + 6 + 5 * vn((sxp + scn.camPx * 0.34) / 70));
  ctx.lineTo(x + w, horizon + 40); ctx.lineTo(x, horizon + 40); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}

// everything: rect R is the drawing area; scn = { race, camX, camE, s, anchor, t, parts, ghost, skip }
export function drawScene(ctx, R, scn) {
  const race = scn.race, course = race.course, th = themeOf(course.theme), s = scn.s;
  const ox = R.x + R.w * scn.anchor;
  const trackTop = R.y + R.h * (scn.gyF ?? 0.62);                 // ground line for elevation = camE
  scn.horizon = trackTop - s * 0.9;
  scn.camPx = scn.camX * s;
  const X = (wx) => ox + (wx - scn.camX) * s;
  const Y = (wx) => trackTop - (course.elevAt(wx) - scn.camE) * s * EXAG;
  ctx.save();
  ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  backdrop(ctx, R, scn, th);

  // ---- snow ground ----
  const wx0 = scn.camX - (ox - R.x) / s - 2, wx1 = scn.camX + (R.x + R.w - ox) / s + 2;
  const step = Math.max(3, 6 / Math.max(1, s / 30));
  const bottom = R.y + R.h + 4;
  const near = 2.0;                                               // metres of track depth in front of the far edge
  const gg = ctx.createLinearGradient(0, trackTop - 80, 0, bottom);
  gg.addColorStop(0, th.snow[0]); gg.addColorStop(1, th.snow[1]);
  ctx.beginPath(); ctx.moveTo(X(wx0), bottom);
  for (let wx = wx0; wx <= wx1 + step / s; wx += step / s) ctx.lineTo(X(wx), Y(wx) - 0.35 * s);
  ctx.lineTo(X(wx1), bottom); ctx.closePath(); ctx.fillStyle = gg; ctx.fill();
  // distant snow texture: soft drifts
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = Math.floor(wx0 / 6); i < wx1 / 6; i++) {
    const wx = i * 6 + hashf(i) * 4;
    ctx.beginPath(); ctx.ellipse(X(wx), Y(wx) - 0.2 * s + (0.8 + hashf(i + 5)) * 0.35 * s, 1.6 * s * (0.6 + hashf(i + 2)), 0.12 * s, 0, 0, TAU); ctx.fill();
  }

  // sun-side sheen on the snow and blue shadow of the trees: the ground takes the sky's colour near the horizon and deepens toward the viewer
  {
    const hz = ctx.createLinearGradient(0, trackTop - 70, 0, trackTop + 120);
    hz.addColorStop(0, th.light === 'evening' ? 'rgba(255,196,150,0.45)' : 'rgba(255,248,235,0.4)'); hz.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hz; ctx.fillRect(R.x, trackTop - 70, R.w, 190);
    const dp = ctx.createLinearGradient(0, trackTop + 120, 0, bottom);
    dp.addColorStop(0, 'rgba(120,150,205,0)'); dp.addColorStop(1, th.light === 'evening' ? 'rgba(96,100,170,0.5)' : 'rgba(110,150,205,0.42)');
    ctx.fillStyle = dp; ctx.fillRect(R.x, trackTop + 120, R.w, bottom - trackTop - 120);
    // twinkling ice crystals (they glint when the light catches them)
    const nS = 46;
    for (let i = 0; i < nS; i++) {
      const gx = (hashf(i * 3.7) * R.w * 1.4 + R.x - scn.camPx * (0.25 + hashf(i + 3) * 0.6)) % (R.w * 1.4);
      const px = R.x + (gx + R.w * 1.4) % (R.w * 1.4) - R.w * 0.2, py = trackTop + 8 + hashf(i * 5.1) * (bottom - trackTop - 40);
      const tw = Math.max(0, Math.sin(scn.t * (1.6 + hashf(i) * 2.4) + i * 2.1));
      if (tw < 0.55) continue;
      const a = (tw - 0.55) / 0.45, r = 1.5 + 3.5 * hashf(i + 9) * a;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - r, py - 0.6, r * 2, 1.2); ctx.fillRect(px - 0.6, py - r, 1.2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- the track surface, per segment ----
  for (const sg of course.segs) {
    if (sg.x1 < wx0 || sg.x0 > wx1) continue;
    const a = Math.max(sg.x0, wx0), b = Math.min(sg.x1, wx1);
    const sf = sg.surf;
    const top = (wx) => Y(wx) + 0.05 * s, low = (wx) => Y(wx) + near * s;
    ctx.beginPath(); ctx.moveTo(X(a), top(a));
    for (let wx = a; wx <= b + 0.001; wx += step / s) ctx.lineTo(X(wx), top(wx));
    ctx.lineTo(X(b), top(b));
    for (let wx = b; wx >= a - 0.001; wx -= step / s) ctx.lineTo(X(wx), low(wx));
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, trackTop - 60, 0, bottom);
    if (sf === 'ice') { tg.addColorStop(0, '#d6f0ff'); tg.addColorStop(1, '#8ec6ea'); }
    else if (sf === 'fresh') { tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#e3eefa'); }
    else if (sf === 'slush') { tg.addColorStop(0, '#c7ccd2'); tg.addColorStop(1, '#8e98a4'); }
    else { tg.addColorStop(0, '#eef6fd'); tg.addColorStop(1, '#bcd2e6'); }
    ctx.fillStyle = tg; ctx.fill();
    // grain: runner lines, ice glints, fresh-snow sparkle
    ctx.save(); ctx.clip();
    if (sf === 'ice') {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
      for (let i = Math.floor(a / 9); i < b / 9; i++) { const wx = i * 9 + hashf(i + 40) * 6, ry = 0.3 + hashf(i + 3) * 1.0; ctx.beginPath(); ctx.moveTo(X(wx), Y(wx) + ry * s); ctx.lineTo(X(wx + 2.2 + hashf(i) * 2), Y(wx) + ry * s - 0.05 * s); ctx.stroke(); }
    } else if (sf === 'fresh') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (let i = Math.floor(a / 2.2); i < b / 2.2; i++) { const wx = i * 2.2 + hashf(i + 70), ry = 0.15 + hashf(i + 11) * 1.2; ctx.fillRect(X(wx), Y(wx) + ry * s, 3, 3); }
    } else if (sf === 'slush') {
      ctx.fillStyle = 'rgba(70,80,92,0.25)';
      for (let i = Math.floor(a / 3); i < b / 3; i++) { const wx = i * 3 + hashf(i + 90) * 2, ry = 0.2 + hashf(i + 13) * 1.1; ctx.beginPath(); ctx.ellipse(X(wx), Y(wx) + ry * s, 0.5 * s * hashf(i + 2) + 4, 0.09 * s, 0, 0, TAU); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(70,100,140,0.22)'; ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let wx = a; wx <= b + 0.001; wx += step / s) { const px = X(wx), py = Y(wx) + (0.62 + k * 0.42) * s; wx === a ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.stroke(); }
    }
    ctx.restore();
    // bend: banked snow wall on the outside and warning boards
    if (sg.bend) {
      ctx.beginPath(); ctx.moveTo(X(a), top(a) - 0.1 * s);
      for (let wx = a; wx <= b + 0.001; wx += step / s) ctx.lineTo(X(wx), top(wx) - (0.25 + 0.2 * Math.sin(((wx - sg.x0) / (sg.x1 - sg.x0)) * Math.PI)) * s);
      for (let wx = b; wx >= a - 0.001; wx -= step / s) ctx.lineTo(X(wx), top(wx) - 0.08 * s);
      ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgba(80,110,150,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  // lane edge highlight
  ctx.beginPath();
  for (let wx = wx0; wx <= wx1 + 0.001; wx += step / s) { const px = X(wx), py = Y(wx) + 0.05 * s; wx === wx0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.stroke();

  // ---- furniture along the far edge: lamps, fence, pines, reeds ----
  const sp = th === THEMES.forest ? 11 : 17;
  for (let i = Math.floor(wx0 / sp); i <= wx1 / sp; i++) {
    const wx = i * sp + hashf(i + 11) * 4, px = X(wx), base = Y(wx) + 0.02 * s;
    if (th === THEMES.town) {
      if (i % 2 === 0) lamp(ctx, px, base, 2.6 * s, true);
      else { ctx.fillStyle = '#6b4b2f'; ctx.fillRect(px, base - 0.7 * s, 0.1 * s, 0.7 * s); ctx.fillRect(px + 2.5 * s, base - 0.7 * s, 0.1 * s, 0.7 * s); ctx.fillRect(px - 0.2 * s, base - 0.6 * s, 3.0 * s, 0.1 * s); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(px - 0.25 * s, base - 0.66 * s, 3.1 * s, 0.07 * s); }
    } else if (th === THEMES.forest) {
      pine(ctx, px, base - 0.1 * s, (2.2 + hashf(i) * 1.6) * s, shade(th.trees, hashf(i + 5) * 0.08), true);
    } else if (th === THEMES.lake) {
      ctx.strokeStyle = '#8d8a62'; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(px + k * 5, base); ctx.quadraticCurveTo(px + k * 5 + 3, base - 0.8 * s, px + k * 5 + 8 * (hashf(i + k) - 0.5), base - (1.2 + hashf(i + k * 3)) * s); ctx.stroke(); }
      if (i % 5 === 0) { ctx.fillStyle = '#f7a24a'; ctx.beginPath(); ctx.arc(px, base - 1.8 * s, 0.15 * s, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, base - 1.8 * s); ctx.stroke(); }
    } else {
      if (i % 2 === 0) { ctx.fillStyle = '#3a4a5c'; ctx.fillRect(px, base - 0.5 * s, 0.22 * s, 0.5 * s); ctx.strokeStyle = '#e7edf3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + 0.1 * s, base - 0.5 * s); ctx.quadraticCurveTo(px + 8 * (s / 30), base - 0.3 * s, px + sp * s * 0.9, base - 0.45 * s); ctx.stroke(); }
      else lamp(ctx, px, base, 2.2 * s, false);
    }
  }

  // bend boards, bump mounds, start and finish
  for (const sg of course.segs) {
    if (!sg.bend || sg.x0 > wx1 + 12 || sg.x0 < wx0 - 15) continue;
    const bx = X(sg.x0 - 10), by = Y(sg.x0 - 10) + 0.04 * s;
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(bx - 2, by - 1.7 * s, 5, 1.7 * s);
    ctx.fillStyle = '#ffcb2f'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(bx - 0.5 * s, by - 2.5 * s, s, s, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.font = `800 ${Math.round(s * 0.38)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round(sg.bend * 3.6)), bx, by - 2.0 * s);
    ctx.beginPath(); ctx.moveTo(bx - 0.22 * s, by - 2.4 * s); ctx.lineTo(bx, by - 2.2 * s - 0.02 * s); ctx.lineTo(bx + 0.22 * s, by - 2.4 * s); ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.stroke();
  }
  for (const b of course.bumps) {
    if (b < wx0 - 4 || b > wx1 + 14) continue;
    const bx = X(b), by = Y(b) + 0.8 * s;
    ctx.beginPath(); ctx.moveTo(bx - 1.4 * s, by + 0.3 * s); ctx.quadraticCurveTo(bx, by - 0.55 * s, bx + 1.4 * s, by + 0.3 * s); ctx.closePath();
    const bg = ctx.createLinearGradient(0, by - 0.5 * s, 0, by + 0.3 * s); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#b9d0e6');
    ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(70,100,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    // warning stakes
    const wx = b - 6, px = X(wx), py = Y(wx) + 0.05 * s;
    ctx.fillStyle = '#e34b2e'; ctx.fillRect(px - 2, py - 1.5 * s, 5, 1.5 * s);
    ctx.fillStyle = '#fff'; ctx.fillRect(px - 2, py - 1.15 * s, 5, 0.3 * s);
    ctx.fillStyle = '#ffcb2f'; ctx.beginPath(); ctx.moveTo(px, py - 2.3 * s); ctx.lineTo(px + 0.45 * s, py - 1.5 * s); ctx.lineTo(px - 0.45 * s, py - 1.5 * s); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#222'; ctx.font = `800 ${Math.round(s * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', px, py - 1.78 * s);
  }
  gate(ctx, X(0), Y(0), s, '#2a8fd6', 'START');
  gate(ctx, X(course.len), Y(course.len), s, '#d33b2f', 'FINISH');
  // a cheering crowd behind the finish line (smooth bobbing, waving arms; fixed 12 figures): real 3D people when the presentation layer is ready
  if (course.len + 12 > wx0 && course.len - 12 < wx1) {
    const PAL = ['#d6423a', '#2a8fd6', '#f2b53f', '#4bb88a', '#a56bd6', '#e8e8f0'];
    const HATS = ['#d33b2f', '#2b3646', '#ffd36a', '#f4f6f8', '#2fa58a'];
    const SKINS = ['light', 'tan', 'original', 'brown', 'light'], HAIRS = ['brown', 'black', 'blond', 'ginger', 'black'];
    const r3 = globalThis.__rider3d;
    for (let k = 0; k < 12; k++) {
      const m = course.len - 10 + k * 1.55 + hashf(k + 40) * 0.6, px = X(m), by = Y(m) + (0.62 + hashf(k + 7) * 0.3) * s;
      if (r3 && r3.drawSpectator) {
        ctx.save(); ctx.translate(px, by);
        const sz = s * (0.74 + hashf(k + 3) * 0.1);
        const ok = r3.drawSpectator(ctx, { s: sz, k, t: scn.t, coat: PAL[k % PAL.length], hat: HATS[k % HATS.length], skin: SKINS[k % 5], hair: HAIRS[(k + 2) % 5], fem: k % 3 === 1, wave: k % 4 !== 3, dir: -1 });
        ctx.restore();
        if (ok) continue;
      }
      const bob = Math.abs(Math.sin(scn.t * 3.4 + k * 1.7)) * 0.1 * s, wv = Math.sin(scn.t * 5.2 + k * 2.3);
      const bw = 0.36 * s, bh = (0.62 + hashf(k + 3) * 0.12) * s, top = by - bob - bh;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2b3646'; ctx.lineWidth = 0.1 * s;
      ctx.beginPath(); ctx.moveTo(px - 0.07 * s, by - bob - 0.05 * s); ctx.lineTo(px - 0.07 * s, by); ctx.moveTo(px + 0.07 * s, by - bob - 0.05 * s); ctx.lineTo(px + 0.07 * s, by); ctx.stroke();
      ctx.fillStyle = PAL[k % PAL.length]; ctx.beginPath(); ctx.roundRect(px - bw / 2, top, bw, bh, bw * 0.45); ctx.fill();
      ctx.strokeStyle = PAL[k % PAL.length]; ctx.lineWidth = 0.09 * s;
      ctx.beginPath(); ctx.moveTo(px - bw / 2 + 0.04 * s, top + 0.14 * s); ctx.lineTo(px - bw / 2 - 0.1 * s - wv * 0.05 * s, top - 0.2 * s - wv * 0.1 * s);
      ctx.moveTo(px + bw / 2 - 0.04 * s, top + 0.14 * s); ctx.lineTo(px + bw / 2 + 0.1 * s + wv * 0.05 * s, top - 0.2 * s + wv * 0.1 * s); ctx.stroke();
      ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(px, top - 0.12 * s, 0.13 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = k % 3 === 0 ? '#d33b2f' : k % 3 === 1 ? '#2b3646' : '#ffd36a'; ctx.beginPath(); ctx.arc(px, top - 0.16 * s, 0.135 * s, Math.PI, TAU); ctx.fill();
    }
  }
  // distance posts every 100 m
  for (let m = 100; m < course.len; m += 100) {
    if (m < wx0 || m > wx1) continue;
    const px = X(m), py = Y(m) + 0.05 * s;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#33506a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(px - 0.55 * s, py - 1.5 * s, 1.1 * s, 0.6 * s, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#33506a'; ctx.font = `700 ${Math.round(s * 0.34)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${m}`, px, py - 1.2 * s);
    ctx.fillRect(px - 2, py - 0.9 * s, 4, 0.9 * s);
  }

  // twin runner grooves left in the snow behind each sled (they stay where the sled was: the course scrolls past them)
  for (const c of race.racers) {
    const r = c.r; if (!r || !(race.go || r.x > 0.5)) continue;
    const lane = c.lane, dep = near - 0.28 - lane * 0.5, len = Math.min(r.x, 24), n = 10;
    for (const off of [-0.12, 0.14]) {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) { const wx = r.x - 0.6 - len * (k / n), px = X(wx), py = Y(wx) + (dep + 0.27 + off * 0.5) * s; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      const gt = ctx.createLinearGradient(X(r.x - 0.6), 0, X(r.x - 0.6 - len), 0);
      gt.addColorStop(0, 'rgba(70,100,150,0.55)'); gt.addColorStop(1, 'rgba(70,100,150,0)');
      ctx.strokeStyle = gt; ctx.lineWidth = Math.max(1.5, s * 0.035); ctx.stroke();
    }
  }

  // ---- racers: far lanes first ----
  const laneOf = (c) => c.lane;
  const list = [];
  if (scn.ghost && scn.ghost.x !== undefined) list.push({ ghost: true, lane: 0, x: scn.ghost.x, r: null });
  for (const c of race.racers) list.push(c);
  list.sort((a, b) => b.lane - a.lane || (a.ghost ? -1 : 1));
  for (const c of list) {
    const lane = laneOf(c), ls = s * (1 - 0.055 * lane), dep = near - 0.28 - lane * 0.5;
    const rx = c.ghost ? c.x : c.r.x;
    const px = X(rx), py = Y(rx) + (dep + 0.25) * s;
    const g1 = course.gradeAt(rx - 1), g2 = course.gradeAt(rx + 1);
    const ang = Math.atan(((g1 + g2) / 2) * EXAG);
    const r = c.r;
    if (r && r.skid > 0.2) spray(ctx, px, py, s, r.skid, scn.t);
    drawRider(ctx, {
      x: px, y: py, s: ls * 0.92, ang, p: r ? r.p : 1, push: r ? r.push : 0, side: r ? r.side : 0, tuck: r ? r.tuck : false, tuckT: r ? r.tuckT : 0,
      wobble: r ? r.wobble : 0, hop: r ? r.hop : 0, v: r ? r.v : 6, t: scn.t + lane, jacket: c.ghost ? '#cfe6ff' : c.color, hat: c.ghost ? '#ffffff' : lane === 0 ? '#d33b2f' : shade(c.color, -0.25), ghost: c.ghost, who: c.ghost ? 'ghost' : c.name, light: th.light,
    });
    if (!c.ghost && r) {
      // breath in the cold: a soft puff every ~1.3 s that drifts back and up, quicker when the legs are working
      const cyc = 1.25 - 0.35 * clamp(r.v / 14, 0, 1), ph = ((scn.t + lane * 0.37) % cyc) / cyc;
      if (ph < 0.8) {
        const a = Math.sin(ph / 0.8 * Math.PI) * 0.5, hx = px + 0.38 * ls - ph * 0.9 * ls - Math.min(r.v, 14) * 0.03 * ls * ph, hy = py - 1.78 * ls - ph * 0.45 * ls;
        ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(hx - k * 0.13 * ls * ph, hy - k * 0.04 * ls, ls * (0.05 + 0.1 * ph) * (1 + k * 0.4), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    if (!c.ghost && c.human === false && !scn.noNames) {
      ctx.font = `700 ${Math.round(Math.max(12, s * 0.34))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(10,30,50,0.7)'; const tw = ctx.measureText(c.name).width + 12;
      ctx.beginPath(); ctx.roundRect(px - tw / 2 + 0.2 * s, py - 2.55 * ls, tw, Math.max(18, s * 0.42), 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(c.name, px + 0.2 * s, py - 2.55 * ls + Math.max(13, s * 0.31));
    }
  }

  // ---- foreground snow mounds and marker poles (they slide faster than the track: depth) ----
  {
    const par = 1.5, off = scn.camPx * par, sp = 7 * s;
    for (let i = Math.floor(off / sp) - 1; i <= Math.floor((off + R.w) / sp) + 1; i++) {
      const px = R.x + i * sp - off + hashf(i * 3) * sp * 0.6, hh = (0.25 + hashf(i + 17) * 0.45) * s, ww = (1.4 + hashf(i + 3) * 1.8) * s;
      const by = R.y + R.h + 4;
      const mg = ctx.createLinearGradient(0, by - hh, 0, by);
      mg.addColorStop(0, '#ffffff'); mg.addColorStop(1, th.snow[1]);
      ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(px, by, ww, hh, 0, Math.PI, TAU); ctx.fill();
      if (hashf(i * 11) < 0.35) { ctx.fillStyle = '#d6423a'; ctx.fillRect(px + ww * 0.2, by - hh - 1.1 * s, 0.1 * s, 1.1 * s); ctx.fillStyle = '#fff'; ctx.fillRect(px + ww * 0.2, by - hh - 0.7 * s, 0.1 * s, 0.25 * s); }
    }
  }
  // ---- spray and falling snow ----
  for (const q of scn.parts) {
    const a = clamp(1 - q.t / q.max, 0, 1);
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = q.col ?? '#ffffff';
    ctx.beginPath(); ctx.arc(X(q.x), Y(q.x) + (near - 0.2) * s - q.h * s, q.size * (0.6 + 0.6 * (1 - a)), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const flakes = (th.snowfall ? 70 : 34) * (scn.dense ? 1 : 1);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < flakes; i++) {
    const fx = hashf(i * 5), fy = hashf(i * 7 + 3), sp2 = 0.04 + 0.06 * hashf(i + 9);
    const px = R.x + ((fx + scn.t * (0.01 + sp2 * 0.5) - scn.camX * 0.0006 * (1 + hashf(i))) % 1 + 1) % 1 * R.w;
    const py = R.y + ((fy + scn.t * sp2) % 1) * R.h;
    ctx.fillRect(px, py, 2 + hashf(i) * 2, 2 + hashf(i) * 2);
  }
  ctx.restore();
}

function spray(ctx, px, py, s, k, t) {
  ctx.fillStyle = `rgba(255,255,255,${0.5 * k})`;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(px - 0.6 * s - i * 0.28 * s, py - 0.05 * s - Math.abs(Math.sin(t * 9 + i)) * 0.35 * s, 0.14 * s * (1 - i * 0.1), 0, TAU); ctx.fill(); }
}

function gate(ctx, x, y, s, col, label) {
  const h = 4.2 * s, w = 5.6 * s, y0 = y + 1.45 * s;
  ctx.fillStyle = '#e9eef4'; ctx.strokeStyle = '#4a5a6c'; ctx.lineWidth = 3;
  ctx.fillRect(x - 0.15 * s, y0 - h, 0.3 * s, h); ctx.fillRect(x - 0.15 * s + w * 0.0, y0 - h, 0.3 * s, h);
  // arch banner across the whole track (drawn as a board above the lane)
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x - w / 2, y0 - h - 0.2 * s, w, 0.9 * s, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(s * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y0 - h + 0.25 * s);
  ctx.fillStyle = '#4a5a6c'; ctx.fillRect(x - w / 2, y0 - h - 0.2 * s, 0.2 * s, h + 0.2 * s);
  ctx.fillRect(x + w / 2 - 0.2 * s, y0 - h - 0.2 * s, 0.2 * s, h + 0.2 * s);
  // checks on the line
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(x - 0.12 * s, y + 0.05 * s + i * 0.18 * s, 0.24 * s, 0.18 * s); }
}
