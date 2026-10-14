// Hoop Rolling Trundle: all the painting that is not the interface. A chase view down a road in pseudo-3D (the road is drawn as a stack
// of perspective strips that bend with the course), with sky, hills, roadside props, gates, puddles, planks, the hoop and the child.
// Pure canvas 2D; every function depends only on its arguments and the clock passed in (no wall clock, no random: scenery uses a hash).
import { kappaAt, halfWidthAt, heightAt, zoneAt, LOOKS } from './courses.js';
import { gl } from './glhook.js';

export const PAL = {
  ink: '#0d1b26', deep: '#12303f', gold: '#ffd35a', goldDeep: '#d9962b', cream: '#fff6e2', text: '#f7f3ea', dim: 'rgba(247,243,234,0.68)',
  jade: '#27b59a', jadeHi: '#8ff0d6', vermilion: '#e8472f', sun: '#ff9d3a', rose: '#ff8a9a', sky: '#7fd0ff', ember: '#ff7a3a',
  teal: '#27b59a', tealHi: '#8ff0d6', leaf: '#4fae45',
};
export const DISPLAY = '"Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif';
export const UI = '"Fredoka", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const mix = (a, b, t) => {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

// ---- the camera --------------------------------------------------------------------------------------------------------------------
// z is metres ahead of the hoop along the road. The camera sits CAM_DIST behind it. F = pixels per metre at distance 1 from the camera.
export const CAM_DIST = 6;
export const HOOP_CHEAT = 1.38, CHILD_CHEAT = 1.12;      // the hoop and child are drawn larger than life so they read on a phone
// z samples: fine near the camera, coarse far away
export const ZS = [];
for (let z = -3.6; z < 90;) { ZS.push(z); z += z < 6 ? 0.5 : z < 24 ? 1 : z < 50 ? 2 : 3; }

// The curvature for the camera only, interpolated between the 0.5 m table samples so the bend of the picture is continuous as the road passes
// (the simulation keeps its own stepped lookup).
function kappaLerp(C, s) {
  const f = Math.max(0, s) / 0.5, i = Math.floor(f), k = f - i, a = C.kap[Math.min(C.kap.length - 1, i)], b = C.kap[Math.min(C.kap.length - 1, i + 1)];
  return a + (b - a) * k;
}

export function makeCam(S, W, me, t, frac) {
  const C = W.course, wide = S.w > S.h * 1.1;
  const ppm0 = clamp(S.w / 2 / (wide ? 4.2 : 3.0), 38, 190);
  const hoopY = S.y + S.h * (frac ?? (wide ? 0.80 : 0.78)), hy = hoopY - S.h * (wide ? 0.42 : 0.48) * (frac ? frac / 0.78 : 1);
  const camH = (hoopY - hy) / ppm0;
  const cam = { S, C, cx: S.x + S.w / 2, hy, hoopY, F: ppm0 * CAM_DIST, camH, ppm0, camLat: me.d * 0.78, sMe: me.s, t, ox: [], hd: [], hg: [], wide, VIS: 0.38 };
  // integrate the road ahead: heading h(z), lateral offset ox(z) and the height of the road relative to the hoop
  let h = 0, ox = 0, z = ZS[0];
  const h0 = heightAt(C, me.s);
  for (let i = 0; i < ZS.length; i++) {
    const zi = ZS[i];
    if (i > 0) {
      const dz = zi - z, kk = kappaLerp(C, me.s + (zi + z) / 2) * cam.VIS * 2.2;
      h += kk * dz; ox += Math.sin(h) * dz;
    }
    z = zi;
    cam.ox.push(ox); cam.hd.push(h); cam.hg.push(heightAt(C, me.s + zi) - h0);
  }
  return cam;
}
function lerpTab(tab, z) {
  if (z <= ZS[0]) return tab[0];
  if (z >= ZS[ZS.length - 1]) return tab[ZS.length - 1];
  let i = 1; while (ZS[i] < z) i++;
  const a = ZS[i - 1], b = ZS[i], f = (z - a) / (b - a);
  return tab[i - 1] + (tab[i] - tab[i - 1]) * f;
}
// A road-frame point (z ahead of the hoop, e sideways of the centre line, y up) to the screen.
export function proj(cam, z, e, y = 0) {
  const zc = Math.max(0.6, z + CAM_DIST), ox = lerpTab(cam.ox, z), h = lerpTab(cam.hd, z), hg = lerpTab(cam.hg, z);
  const k = cam.F / zc;
  return { x: cam.cx + (ox + e * Math.cos(h) - cam.camLat) * k, y: cam.hy + (cam.camH - (y + hg)) * k, k, h };
}

// The same road point in the 3D presenter's metric frame: X lateral (camera-relative), Y road height, Z ahead of the hoop, h the heading.
export function roadPoint(cam, z, e) {
  const ox = lerpTab(cam.ox, z), h = lerpTab(cam.hd, z), hg = lerpTab(cam.hg, z);
  return { X: ox + e * Math.cos(h) - cam.camLat, Y: hg, Z: z, h };
}

// ---- backdrop -------------------------------------------------------------------------------------------------------------------------
export function drawSky(ctx, cam, t) {
  const { S, hy } = cam, th = cam.C.theme;
  const sk = ctx.createLinearGradient(0, S.y, 0, hy);
  sk.addColorStop(0, th.sky[0]); sk.addColorStop(0.6, th.sky[1]); sk.addColorStop(1, th.sky[2]);
  ctx.fillStyle = sk; ctx.fillRect(S.x, S.y, S.w, hy - S.y + 2);
  const turn = cam.hd[cam.hd.length - 1] * 140;               // the far hills slide as the road bends
  const sx = S.x + S.w * 0.72 - turn * 0.25, sy = S.y + (hy - S.y) * 0.42;
  const g = ctx.createRadialGradient(sx, sy, 3, sx, sy, Math.max(S.w, S.h) * 0.42);
  g.addColorStop(0, 'rgba(255,250,220,0.95)'); g.addColorStop(0.07, 'rgba(255,238,180,0.55)'); g.addColorStop(1, 'rgba(255,225,150,0)');
  ctx.fillStyle = g; ctx.fillRect(S.x, S.y, S.w, hy - S.y);
  for (let i = 0; i < 6; i++) {
    const w = (150 + hash(i) * 170) * clamp(S.w / 720, 0.7, 1.4);
    const span = S.w + 500, x = S.x - 150 + (((hash(i * 3 + 1) * span - turn * (0.12 + 0.03 * i) + t * (5 + i * 1.7)) % span) + span) % span;
    const y = S.y + (hy - S.y) * (0.12 + 0.42 * hash(i * 7 + 2));
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 1.5) * w * 0.22, y + (j % 2 ? -4 : 4), w * 0.2, w * 0.082, 0, 0, TAU); ctx.fill(); }
  }
  for (let layer = 0; layer < 2; layer++) {
    const amp = (hy - S.y) * (layer ? 0.16 : 0.26), base = hy - 1, off = turn * (layer ? 0.55 : 0.28);
    ctx.fillStyle = cam.C.theme.far[layer]; ctx.beginPath(); ctx.moveTo(S.x, base);
    for (let x = 0; x <= S.w + 20; x += 20) {
      const wx = (x + off + 5000) / (layer ? 170 : 240);
      ctx.lineTo(S.x + x, base - amp * (0.45 + 0.35 * Math.sin(wx * 1.3 + layer * 2) + 0.2 * Math.sin(wx * 3.1 + 1)));
    }
    ctx.lineTo(S.x + S.w, base); ctx.closePath(); ctx.fill();
  }
  const hz = ctx.createLinearGradient(0, hy - 40, 0, hy + 6);
  hz.addColorStop(0, 'rgba(255,240,210,0)'); hz.addColorStop(1, 'rgba(255,240,210,0.5)');
  ctx.fillStyle = hz; ctx.fillRect(S.x, hy - 40, S.w, 46);
}

// ---- the ground and the road ------------------------------------------------------------------------------------------------------------
const KERB_W = 0.45;
export function drawRoad(ctx, cam) {
  const { S, C } = cam, th = C.theme, s0 = cam.sMe, water = th.water;
  ctx.fillStyle = th.ground; ctx.fillRect(S.x, cam.hy, S.w, S.y + S.h - cam.hy);
  const n = ZS.length;
  for (let i = n - 2; i >= 0; i--) {
    const z0 = ZS[i], z1 = ZS[i + 1], sm = s0 + (z0 + z1) / 2;
    const a = proj(cam, z1, 0, 0), b = proj(cam, z0, 0, 0);          // far, near
    const y0 = a.y, y1 = b.y + 1;
    if (y1 < cam.hy - 2 || y0 > S.y + S.h + 2) continue;
    const band = Math.floor(sm / 3) & 1;
    const zone = zoneAt(C, sm), plank = zone && zone.kind === 'plank';
    const hwF = halfWidthAt(C, s0 + z1), hwN = halfWidthAt(C, s0 + z0);
    ctx.fillStyle = band ? th.ground2 : th.ground; ctx.fillRect(S.x, y0, S.w, Math.max(1, y1 - y0));
    if (water && (plank || th.waterSide === 'left')) {
      const lf = proj(cam, z1, -hwF - KERB_W - 0.2, 0), ln = proj(cam, z0, -hwN - KERB_W - 0.2, 0);
      ctx.fillStyle = band ? mix(water, '#ffffff', 0.12) : water;
      ctx.beginPath(); ctx.moveTo(S.x - 5, y0); ctx.lineTo(lf.x, y0); ctx.lineTo(ln.x, y1); ctx.lineTo(S.x - 5, y1); ctx.fill();
      if (plank) {
        const rf = proj(cam, z1, hwF + KERB_W + 0.2, 0), rn = proj(cam, z0, hwN + KERB_W + 0.2, 0);
        ctx.beginPath(); ctx.moveTo(rf.x, y0); ctx.lineTo(S.x + S.w + 5, y0); ctx.lineTo(S.x + S.w + 5, y1); ctx.lineTo(rn.x, y1); ctx.fill();
      }
    }
    const kc = (Math.floor(sm / 2) & 1) ? th.kerb[0] : th.kerb[1];
    for (const sg of [-1, 1]) {
      const f0 = proj(cam, z1, sg * hwF, 0), f1 = proj(cam, z1, sg * (hwF + KERB_W), 0), n0 = proj(cam, z0, sg * hwN, 0), n1 = proj(cam, z0, sg * (hwN + KERB_W), 0);
      ctx.fillStyle = plank ? '#7a4f26' : kc;
      ctx.beginPath(); ctx.moveTo(f0.x, y0); ctx.lineTo(f1.x, y0); ctx.lineTo(n1.x, y1); ctx.lineTo(n0.x, y1); ctx.closePath(); ctx.fill();
    }
    const lF = proj(cam, z1, -hwF, 0), rF = proj(cam, z1, hwF, 0), lN = proj(cam, z0, -hwN, 0), rN = proj(cam, z0, hwN, 0);
    let col = band ? th.road : th.roadHi;
    if (plank) col = band ? '#a8742f' : '#bd8640';
    else if (zone && zone.kind === 'mud') col = band ? '#5e3f24' : '#6c4a2c';
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(lF.x, y0); ctx.lineTo(rF.x, y0); ctx.lineTo(rN.x, y1); ctx.lineTo(lN.x, y1); ctx.closePath(); ctx.fill();
    if (zone && zone.kind === 'cobble') {
      const cells = 7;
      for (let c = 0; c < cells; c++) {
        const tint = hash(Math.floor(sm * 1.3) * 11 + c * 3.7);
        const e0 = -1 + (2 * c) / cells, e1 = -1 + (2 * (c + 1)) / cells;
        const p0 = proj(cam, z1, e0 * hwF, 0), p1 = proj(cam, z1, e1 * hwF, 0), q0 = proj(cam, z0, e0 * hwN, 0), q1 = proj(cam, z0, e1 * hwN, 0);
        ctx.fillStyle = tint > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(30,20,10,0.16)';
        ctx.beginPath(); ctx.moveTo(p0.x + 0.6, y0); ctx.lineTo(p1.x - 0.6, y0); ctx.lineTo(q1.x - 0.6, y1); ctx.lineTo(q0.x + 0.6, y1); ctx.closePath(); ctx.fill();
      }
    } else if (plank) {
      ctx.strokeStyle = 'rgba(50,28,8,0.55)'; ctx.lineWidth = Math.max(1, b.k * 0.03);
      ctx.beginPath(); ctx.moveTo(lN.x, y1 - 0.5); ctx.lineTo(rN.x, y1 - 0.5); ctx.stroke();
    } else if (zone && zone.kind === 'mud' && hash(Math.floor(sm * 2)) > 0.6) {
      const m = proj(cam, z0, (hash(Math.floor(sm)) - 0.5) * hwN, 0); ctx.fillStyle = 'rgba(190,150,100,0.25)'; ctx.beginPath(); ctx.ellipse(m.x, y1 - 1, m.k * 0.5, m.k * 0.08, 0, 0, TAU); ctx.fill();
    }
    if (!plank && (Math.floor(sm / 2.2) & 1)) {
      const c0 = proj(cam, z1, -0.07, 0), c1 = proj(cam, z1, 0.07, 0), d0 = proj(cam, z0, -0.07, 0), d1 = proj(cam, z0, 0.07, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.moveTo(c0.x, y0); ctx.lineTo(c1.x, y0); ctx.lineTo(d1.x, y1); ctx.lineTo(d0.x, y1); ctx.closePath(); ctx.fill();
    }
  }
}

// ---- roadside props ---------------------------------------------------------------------------------------------------------------------
const PROPS = {
  village: ['house', 'tree', 'bush', 'house', 'bamboo', 'tree'],
  market: ['stall', 'lantern', 'stall', 'house', 'crate', 'stall'],
  canal: ['willow', 'reed', 'house', 'lamp', 'bush', 'willow'],
  terrace: ['terrace', 'bamboo', 'bush', 'terrace', 'tree', 'terrace'],
  harbour: ['crate', 'lamp', 'shed', 'bollard', 'crate', 'shed'],
  rain: ['tree', 'bush', 'house', 'rock', 'tree', 'bamboo'],
  hills: ['pine', 'rock', 'pine', 'bush', 'pine', 'rock'],
  festival: ['crowd', 'banner', 'lantern', 'stall', 'crowd', 'banner'],
};
const ROOFS = ['#b8432c', '#2f6f8f', '#8a5a2a', '#4a7a3a', '#a03a58', '#6a4aa0'];
const WALLS = ['#f0e2c4', '#e8d4a8', '#f4ecd8', '#d9c9a0'];

function drawProp(ctx, kind, x, y, k, seed, t, cam) {
  const R = hash(seed);
  const rect = (a, b, w, h) => ctx.fillRect(x + a * k, y - b * k, w * k, -h * k);
  ctx.save();
  ctx.fillStyle = 'rgba(20,30,10,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 0.9 * k, 0.16 * k, 0, 0, TAU); ctx.fill();
  if (kind === 'house' || kind === 'shed') {
    const w = 3.0 + R * 1.4, h = 2.3 + R * 0.8, roof = ROOFS[Math.floor(R * 6) % 6];
    ctx.fillStyle = kind === 'shed' ? '#9aa5ac' : WALLS[Math.floor(R * 4) % 4]; rect(-w / 2, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; rect(w * 0.12, 0, w * 0.38, h);
    ctx.fillStyle = kind === 'shed' ? '#5f6d78' : roof;
    ctx.beginPath(); ctx.moveTo(x - (w / 2 + 0.35) * k, y - h * k); ctx.lineTo(x - (w / 2 - 0.5) * k, y - (h + 1.1) * k); ctx.lineTo(x + (w / 2 - 0.5) * k, y - (h + 1.1) * k); ctx.lineTo(x + (w / 2 + 0.35) * k, y - h * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#35566a'; rect(-w * 0.32, 0.8, 0.7, 0.9); rect(w * 0.12, 0.8, 0.7, 0.9);
    ctx.fillStyle = '#6d4222'; rect(-0.3, 0, 0.6, 1.2);
  } else if (kind === 'tree' || kind === 'willow') {
    const h = 2.6 + R * 1.6;
    ctx.fillStyle = '#6b4a2a'; rect(-0.14, 0, 0.28, h * 0.6);
    ctx.fillStyle = mix(cam.C.theme.ground2, '#1c4a1c', 0.45 + R * 0.25);
    for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 1) * 0.55 * k, y - (h * 0.7 + (j % 2) * 0.35) * k, 0.9 * k, 0.85 * k, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.ellipse(x - 0.3 * k, y - h * 0.8 * k, 0.5 * k, 0.4 * k, 0, 0, TAU); ctx.fill();
    if (kind === 'willow') { ctx.strokeStyle = 'rgba(70,130,60,0.7)'; ctx.lineWidth = Math.max(1, 0.05 * k); for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(x + j * 0.4 * k, y - h * 0.75 * k); ctx.lineTo(x + j * 0.45 * k + Math.sin(t * 1.2 + j) * 0.06 * k, y - h * 0.3 * k); ctx.stroke(); } }
  } else if (kind === 'pine') {
    const h = 3.2 + R * 1.8;
    ctx.fillStyle = '#5b3d22'; rect(-0.12, 0, 0.24, 0.9);
    for (let j = 0; j < 4; j++) {
      const wj = (1.15 - j * 0.24) * (1 + R * 0.2), yj = 0.6 + j * h * 0.22;
      ctx.fillStyle = mix('#2c6b3a', '#1a4527', j / 4);
      ctx.beginPath(); ctx.moveTo(x - wj * k, y - yj * k); ctx.lineTo(x, y - (yj + h * 0.34) * k); ctx.lineTo(x + wj * k, y - yj * k); ctx.closePath(); ctx.fill();
    }
  } else if (kind === 'bush') {
    ctx.fillStyle = mix(cam.C.theme.ground2, '#1c4a1c', 0.35);
    ctx.beginPath(); ctx.ellipse(x, y - 0.35 * k, 0.9 * k, 0.5 * k, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.ellipse(x - 0.2 * k, y - 0.5 * k, 0.4 * k, 0.22 * k, 0, 0, TAU); ctx.fill();
  } else if (kind === 'bamboo' || kind === 'reed') {
    ctx.strokeStyle = kind === 'bamboo' ? '#8fae3a' : '#a8b860'; ctx.lineWidth = Math.max(1.5, 0.1 * k); ctx.lineCap = 'round';
    for (let j = 0; j < 5; j++) {
      const bx = (j - 2) * 0.28, bh = (kind === 'bamboo' ? 3.4 : 1.8) + hash(seed + j) * 1.2, sw = Math.sin(t * 1.3 + j + R * 6) * 0.1;
      ctx.beginPath(); ctx.moveTo(x + bx * k, y); ctx.quadraticCurveTo(x + (bx + sw) * k, y - bh * 0.6 * k, x + (bx + sw * 2 + (j - 2) * 0.12) * k, y - bh * k); ctx.stroke();
    }
  } else if (kind === 'stall') {
    const w = 2.6, c1 = ROOFS[Math.floor(R * 6) % 6];
    ctx.fillStyle = '#6d4a28'; rect(-w / 2, 0, 0.12, 2.1); rect(w / 2 - 0.12, 0, 0.12, 2.1);
    ctx.fillStyle = '#8a5a30'; rect(-w / 2, 0, w, 0.9);
    for (let j = 0; j < 6; j++) { ctx.fillStyle = j % 2 ? '#fff4dc' : c1; ctx.beginPath(); ctx.moveTo(x + (-w / 2 + j * w / 6 - 0.05) * k, y - 2.1 * k); ctx.lineTo(x + (-w / 2 + (j + 1) * w / 6 + 0.05) * k, y - 2.1 * k); ctx.lineTo(x + (-w / 2 + (j + 1) * w / 6 + 0.12) * k, y - 1.55 * k); ctx.lineTo(x + (-w / 2 + j * w / 6 - 0.02) * k, y - 1.55 * k); ctx.fill(); }
    ctx.fillStyle = ['#e8472f', '#f3b21b', '#7ac043'][Math.floor(R * 3)]; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(x + (j - 1.5) * 0.5 * k, y - 1.0 * k, 0.19 * k, 0, TAU); ctx.fill(); }
  } else if (kind === 'lantern' || kind === 'lamp') {
    ctx.fillStyle = '#4a3a30'; rect(-0.06, 0, 0.12, 3.6);
    if (kind === 'lantern') {
      ctx.fillStyle = 'rgba(255,200,90,0.3)'; ctx.beginPath(); ctx.arc(x, y - 3.5 * k, 0.9 * k, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8472f'; ctx.beginPath(); ctx.ellipse(x, y - 3.5 * k, 0.4 * k, 0.5 * k, 0, 0, TAU); ctx.fill();
    } else { ctx.fillStyle = '#ffe8a0'; ctx.beginPath(); ctx.arc(x, y - 3.7 * k, 0.22 * k, 0, TAU); ctx.fill(); }
  } else if (kind === 'crate') {
    const n = 1 + Math.floor(R * 3);
    for (let j = 0; j < n; j++) { ctx.fillStyle = j % 2 ? '#a4723a' : '#b8854a'; rect(-0.5 + j * 0.9 - n * 0.2, 0, 0.9, 0.9); ctx.strokeStyle = 'rgba(60,30,8,0.6)'; ctx.lineWidth = Math.max(1, 0.04 * k); ctx.strokeRect(x + (-0.5 + j * 0.9 - n * 0.2) * k, y - 0.9 * k, 0.9 * k, 0.9 * k); }
  } else if (kind === 'bollard') {
    ctx.fillStyle = '#2f3a44'; rect(-0.22, 0, 0.44, 0.9); ctx.fillStyle = '#e8472f'; rect(-0.22, 0.65, 0.44, 0.18);
  } else if (kind === 'rock') {
    ctx.fillStyle = '#8f8c82'; ctx.beginPath(); ctx.ellipse(x, y - 0.4 * k, (0.9 + R * 0.6) * k, 0.55 * k, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(x - 0.2 * k, y - 0.6 * k, 0.5 * k, 0.25 * k, 0, 0, TAU); ctx.fill();
  } else if (kind === 'terrace') {
    ctx.fillStyle = '#8c8b78'; rect(-1.8, 0, 3.6, 0.7);
    ctx.fillStyle = '#6cb847'; rect(-1.8, 0.7, 3.6, 0.22);
    ctx.fillStyle = '#4fa8c8'; rect(-1.5, 0.92, 3.0, 0.1);
    ctx.fillStyle = '#7acb58'; for (let j = 0; j < 6; j++) rect(-1.5 + j * 0.5, 0.95, 0.12, 0.35);
  } else if (kind === 'banner') {
    ctx.fillStyle = '#5a3a22'; rect(-0.06, 0, 0.12, 4.2);
    const c = ROOFS[Math.floor(R * 6) % 6], sw = Math.sin(t * 2.2 + seed) * 0.12;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + 0.06 * k, y - 4.1 * k); ctx.lineTo(x + (1.4 + sw) * k, y - 3.7 * k); ctx.lineTo(x + (1.3 - sw) * k, y - 2.9 * k); ctx.lineTo(x + 0.06 * k, y - 3.0 * k); ctx.fill();
    ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(x + 0.7 * k, y - 3.55 * k, 0.22 * k, 0, TAU); ctx.fill();
  } else if (kind === 'crowd') {
    for (let j = 0; j < 4; j++) {
      const px = (j - 1.5) * 0.62, ph = 1.0 + hash(seed + j * 5) * 0.35, wave = Math.sin(t * 5 + j * 1.7 + seed) * 0.15;
      const col = ROOFS[(Math.floor(R * 6) + j) % 6];
      ctx.fillStyle = col; rect(px - 0.2, 0, 0.4, ph * 0.7);
      ctx.fillStyle = ['#b9774a', '#8a5532', '#d49a6a', '#7a4a2c'][(j + Math.floor(R * 4)) % 4]; ctx.beginPath(); ctx.arc(x + px * k, y - (ph * 0.7 + 0.2) * k, 0.2 * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, 0.09 * k); ctx.beginPath(); ctx.moveTo(x + (px + 0.18) * k, y - ph * 0.55 * k); ctx.lineTo(x + (px + 0.3 + wave) * k, y - (ph * 0.95 + wave * 0.5) * k); ctx.stroke();
    }
  }
  ctx.restore();
}

// Everything standing in the world, far to near: props, gates, puddles, the finish, rivals and the player.
export function drawWorldItems(ctx, cam, W, me, st) {
  const C = cam.C, th = C.theme, t = cam.t, s0 = cam.sMe;
  const list = [];
  const kinds = PROPS[C.themeId] ?? PROPS.village;
  const STEPP = cam.wide ? 7.2 : 8.4;
  const kA = Math.floor((s0 - 5) / STEPP), kB = Math.floor((s0 + 90) / STEPP);
  for (let k = kA; k <= kB; k++) {
    for (const sg of [-1, 1]) {
      const sd = k * 2 + (sg > 0 ? 1 : 0) + C.seed * 101;
      if (hash(sd * 3.3) < 0.2) continue;
      const kind = kinds[Math.floor(hash(sd * 1.7) * kinds.length) % kinds.length];
      const sPos = k * STEPP + hash(sd * 5.1) * STEPP * 0.7;
      const hw = halfWidthAt(C, sPos);
      let e = sg * (hw + KERB_W + 1.2 + hash(sd * 7.7) * (cam.wide ? 4.5 : 3));
      if (th.waterSide === 'left' && e < 0 && kind !== 'reed' && kind !== 'willow' && kind !== 'lamp') e = -e;       // keep houses off the water
      list.push({ z: sPos - s0, e, kind, seed: sd, type: 'prop' });
    }
  }
  for (let i = Math.max(0, me.gi - 1); i < C.gates.length; i++) {
    const g = C.gates[i];
    if (g.s - s0 > 90) break;
    if (g.s - s0 < -4) continue;
    list.push({ z: g.s - s0, type: 'gate', g, i });
  }
  for (const p of C.puddles) if (p.s - s0 > -3 && p.s - s0 < 80) list.push({ z: p.s - s0 - 0.01, type: 'puddle', p });
  if (C.length - s0 < 90 && C.length - s0 > -4) list.push({ z: C.length - s0, type: 'finish' });
  if (s0 < 8) list.push({ z: -s0, type: 'start' });
  for (const r of W.racers) {
    if (r.id === 0) continue;
    const z = r.s - s0;
    if (z > -3 && z < 85) list.push({ z, type: 'rival', r });
  }
  list.push({ z: 0, type: 'me' });
  list.sort((a, b) => b.z - a.z || (a.type === 'me' ? 1 : 0));
  if (cam.G3) {            // the 3D layer draws the world; the 2D side keeps only what must sit on top (gate numbers, name chips, particles)
    const G = cam.G3.items;
    for (const it of list) {
      if (it.type === 'prop') G.props.push({ z: it.z, e: it.e, kind: it.kind, seed: it.seed });
      else if (it.type === 'gate') {
        const state = it.i < me.gi ? (st.gateRes?.[it.i] ?? 'good') : it.i === me.gi ? 'next' : 'ahead';
        G.gates.push({ i: it.i, g: it.g, state }); drawGateOverlay(ctx, cam, it.g, it.i, state, t);
      } else if (it.type === 'finish') G.finish = it.z;
      else if (it.type === 'start') G.start = it.z;
      else if (it.type === 'rival') drawRival(ctx, cam, it.r, it.z, t);
      else if (it.type === 'me') drawMe(ctx, cam, me, t, st);
    }
    G.puddles = null;
    if (st.parts) drawParticles(ctx, cam, st.parts);
    return;
  }
  for (const it of list) {
    if (it.type === 'prop') {
      const p = proj(cam, it.z, it.e, 0);
      if (p.x < cam.S.x - p.k * 6 || p.x > cam.S.x + cam.S.w + p.k * 6 || it.z < -3.4 || p.y < cam.hy - 1) continue;
      ctx.globalAlpha = clamp((90 - it.z) / 30, 0, 1);
      drawProp(ctx, it.kind, p.x, p.y, p.k, it.seed, t, cam);
      ctx.globalAlpha = 1;
    } else if (it.type === 'gate') drawGate(ctx, cam, it.g, it.i, it.i < me.gi ? (st.gateRes?.[it.i] ?? 'good') : it.i === me.gi ? 'next' : 'ahead', t, th);
    else if (it.type === 'puddle') drawPuddle(ctx, cam, it.p, t);
    else if (it.type === 'finish') drawFinish(ctx, cam, it.z, t);
    else if (it.type === 'start') drawStart(ctx, cam, it.z);
    else if (it.type === 'rival') drawRival(ctx, cam, it.r, it.z, t);
    else if (it.type === 'me') { drawMe(ctx, cam, me, t, st); if (st.parts) drawParticles(ctx, cam, st.parts); }
  }
}

function drawPuddle(ctx, cam, p, t) {
  const a = proj(cam, p.s - cam.sMe, p.d, 0);
  if (a.y < cam.hy) return;
  const rx = p.rd * a.k, ry = Math.max(2, p.rs * 0.55 * a.k * (cam.camH / (cam.camH + 2)));
  const g = ctx.createRadialGradient(a.x, a.y, 1, a.x, a.y, rx);
  g.addColorStop(0, 'rgba(190,230,250,0.9)'); g.addColorStop(0.7, 'rgba(120,190,225,0.82)'); g.addColorStop(1, 'rgba(90,150,190,0.65)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, a.y, rx, ry, 0, 0, TAU); ctx.fill();
  const rr = (t * 0.5) % 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, a.k * 0.03);
  ctx.beginPath(); ctx.ellipse(a.x + rx * 0.2, a.y, rx * 0.25 * (0.5 + rr), ry * 0.25 * (0.5 + rr), 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,80,110,0.5)'; ctx.lineWidth = Math.max(1, a.k * 0.04); ctx.beginPath(); ctx.ellipse(a.x, a.y, rx, ry, 0, 0, TAU); ctx.stroke();
}

// A gate: two striped posts with a string of pennants across the top; the ground line between them lights up for the next gate.
function drawGate(ctx, cam, g, idx, state, t, th) {
  const z = g.s - cam.sMe;
  const L = proj(cam, z, g.d - g.w / 2, 0), Rr = proj(cam, z, g.d + g.w / 2, 0);
  if (L.y < cam.hy - 5 || z < -3.5) return;
  const k = L.k, h = 2.2;
  const col = state === 'perfect' ? '#ffd35a' : state === 'good' ? '#8ff0d6' : state === 'miss' ? '#9a8a88' : state === 'next' ? '#ffffff' : '#ffe9c2';
  if (state === 'next' || state === 'ahead') {
    ctx.strokeStyle = state === 'next' ? `rgba(255,255,255,${0.55 + 0.35 * Math.sin(t * 6)})` : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(2, k * 0.08); ctx.setLineDash([k * 0.3, k * 0.22]);
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(Rr.x, Rr.y); ctx.stroke(); ctx.setLineDash([]);
  }
  const c1 = state === 'miss' ? '#7a6a68' : th.kerb[1];
  const post = (p) => {
    const w = Math.max(2, k * 0.17);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 1.4, w * 0.5, 0, 0, TAU); ctx.fill();
    for (let j = 0; j < 6; j++) { ctx.fillStyle = j % 2 ? '#fff6e2' : c1; ctx.fillRect(p.x - w / 2, p.y - (j + 1) * h * k / 6, w, h * k / 6 + 0.5); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y - h * k - w * 0.4, w * 0.75, 0, TAU); ctx.fill();
  };
  post(L); post(Rr);
  const ax = L.x, ay = L.y - h * k, bx = Rr.x, by = Rr.y - h * k, n = 7;
  const sag = (f) => Math.sin(f * Math.PI) * k * 0.22;
  ctx.strokeStyle = 'rgba(60,40,20,0.8)'; ctx.lineWidth = Math.max(1, k * 0.03);
  ctx.beginPath(); for (let j = 0; j <= 20; j++) { const f = j / 20, x = ax + (bx - ax) * f, y = ay + (by - ay) * f + sag(f); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
  const cols = state === 'perfect' ? ['#ffd35a', '#fff0b0'] : state === 'miss' ? ['#8a7a78', '#a09290'] : ['#e8472f', '#ffd35a', '#27b59a', '#fff6e2'];
  for (let j = 0; j < n; j++) {
    const f = (j + 0.5) / n, x = ax + (bx - ax) * f, y = ay + (by - ay) * f + sag(f), sw = Math.sin(t * 3 + j * 1.1 + idx) * k * 0.04;
    ctx.fillStyle = cols[j % cols.length];
    ctx.beginPath(); ctx.moveTo(x - k * 0.17, y); ctx.lineTo(x + k * 0.17, y); ctx.lineTo(x + sw, y + k * 0.42); ctx.closePath(); ctx.fill();
  }
  if (state === 'next') {
    const fs = Math.max(12, Math.min(40, k * 0.5));
    ctx.font = `700 ${fs}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, fs * 0.2); ctx.strokeStyle = 'rgba(10,20,30,0.8)'; ctx.fillStyle = '#fff';
    const tx = (L.x + Rr.x) / 2, ty = ay - fs * 0.9;
    ctx.strokeText(String(idx + 1), tx, ty); ctx.fillText(String(idx + 1), tx, ty);
  }
}

// 2D marks on top of the 3D gate: the dashed ground line and the number of the gate that is next.
function drawGateOverlay(ctx, cam, g, idx, state, t) {
  const z = g.s - cam.sMe;
  const L = proj(cam, z, g.d - g.w / 2, 0), Rr = proj(cam, z, g.d + g.w / 2, 0);
  if (L.y < cam.hy - 5 || z < -3.5) return;
  const k = L.k;
  if (state === 'next' || state === 'ahead') {
    ctx.save();
    ctx.strokeStyle = state === 'next' ? `rgba(255,255,255,${0.55 + 0.35 * Math.sin(t * 6)})` : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(2, k * 0.08); ctx.setLineDash([k * 0.3, k * 0.22]);
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(Rr.x, Rr.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  if (state === 'next') {
    const fs = Math.max(12, Math.min(40, k * 0.5));
    ctx.save(); ctx.font = `700 ${fs}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, fs * 0.2); ctx.strokeStyle = 'rgba(10,20,30,0.8)'; ctx.fillStyle = '#fff';
    const tx = (L.x + Rr.x) / 2, ty = L.y - 2.3 * k - fs * 0.9;
    ctx.strokeText(String(idx + 1), tx, ty); ctx.fillText(String(idx + 1), tx, ty);
    ctx.restore();
  }
}

function drawFinish(ctx, cam, z, t) {
  const C = cam.C, hw = halfWidthAt(C, C.length) + 0.4;
  const L = proj(cam, z, -hw, 0), Rr = proj(cam, z, hw, 0), k = L.k, h = 3.6;
  const n = 12;
  for (let j = 0; j < n; j++) {
    const e0 = -hw + (2 * hw * j) / n, e1 = -hw + (2 * hw * (j + 1)) / n;
    const a = proj(cam, z, e0, 0), b = proj(cam, z, e1, 0), a2 = proj(cam, z - 0.6, e0, 0), b2 = proj(cam, z - 0.6, e1, 0);
    ctx.fillStyle = j % 2 ? '#111' : '#fff'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(a2.x, a2.y); ctx.closePath(); ctx.fill();
  }
  const pw = Math.max(3, k * 0.28);
  for (const p of [L, Rr]) { ctx.fillStyle = '#f4ead6'; ctx.fillRect(p.x - pw / 2, p.y - h * k, pw, h * k); ctx.fillStyle = '#d83a3a'; ctx.fillRect(p.x - pw / 2, p.y - h * k * 0.5, pw, h * k * 0.1); }
  const top = L.y - h * k, bh = k * 0.9;
  ctx.fillStyle = '#c0392b'; ctx.fillRect(L.x, top, Rr.x - L.x, bh);
  ctx.fillStyle = '#ffd35a'; ctx.fillRect(L.x, top + bh * 0.08, Rr.x - L.x, bh * 0.1); ctx.fillRect(L.x, top + bh * 0.82, Rr.x - L.x, bh * 0.1);
  ctx.font = `700 ${Math.max(10, bh * 0.5)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff6e2';
  ctx.fillText('FINISH', (L.x + Rr.x) / 2, top + bh * 0.5);
  for (let j = 0; j < 8; j++) { const x = L.x + (Rr.x - L.x) * (j + 0.5) / 8; ctx.fillStyle = ['#27b59a', '#ffd35a', '#e8472f', '#fff6e2'][j % 4]; ctx.beginPath(); ctx.moveTo(x - k * 0.12, top + bh); ctx.lineTo(x + k * 0.12, top + bh); ctx.lineTo(x + Math.sin(t * 3 + j) * k * 0.08, top + bh + k * 0.55); ctx.closePath(); ctx.fill(); }
}
function drawStart(ctx, cam, z) {
  const hw = halfWidthAt(cam.C, 0);
  const a = proj(cam, z, -hw, 0), b = proj(cam, z, hw, 0), a2 = proj(cam, z + 0.5, -hw, 0), b2 = proj(cam, z + 0.5, hw, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(a2.x, a2.y); ctx.closePath(); ctx.fill();
}

// ---- the hoop and the child ---------------------------------------------------------------------------------------------------------
// The hoop seen from behind and slightly to the right: a thin steel ring that leans with the balance and narrows as it yaws.
export function drawHoop(ctx, x, gy, k, r, o = {}) {
  const rr = 0.36 * (o.cheat ?? HOOP_CHEAT) * k;
  const tilt = clamp(r.lam, -1.2, 1.2) * 0.62;
  const wr = clamp(0.2 + 0.2 * Math.abs(Math.sin(r.psi * 1.2 + 0.42)), 0.16, 0.5);
  const fall = r.phase === 'down' ? clamp(r.downT / 0.45, 0, 1) : 0;
  const dir = r.downKind === 'water' ? 0 : (r.lam >= 0 ? 1 : -1);
  ctx.fillStyle = 'rgba(15,20,10,0.32)'; ctx.beginPath(); ctx.ellipse(x + tilt * rr * 0.4, gy + 1, rr * (0.35 + 0.65 * fall), rr * 0.09 * (1 + fall), 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(x, gy);
  ctx.rotate(tilt + dir * fall * 1.45);
  const cy = -rr * (1 - fall * 0.35), rx = rr * wr * (1 + fall * 2.2), ry = rr * (1 - fall * 0.62);
  ctx.lineCap = 'round';
  const lw = Math.max(3, rr * 0.16);
  ctx.strokeStyle = 'rgba(10,16,24,0.9)'; ctx.lineWidth = lw + 3; ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  const gr = ctx.createLinearGradient(-rx, 0, rx, 0);
  gr.addColorStop(0, '#6c7a86'); gr.addColorStop(0.45, '#f4f8fb'); gr.addColorStop(1, '#c8d3dc');
  ctx.strokeStyle = gr; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  const a = r.spin, mx = Math.sin(a) * rx, my = cy - Math.cos(a) * ry;
  ctx.fillStyle = o.tape ?? '#e8472f'; ctx.beginPath(); ctx.arc(mx, my, lw * 0.9, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(10,16,24,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(-mx, 2 * cy - my, lw * 0.75, 0, TAU); ctx.fill();
  ctx.restore();
}

// A running child seen from behind, feet at (x, gy), k px per metre. The stick runs from the hand to (hx, hy), the rim of the hoop.
export function drawChild(ctx, x0, gy, k, look, phase, hx, hy, o = {}) {
  // amp (0..1) fades the gait in and out with speed, so a slowing child eases to a standing pose instead of freezing mid-stride.
  // Everything is a smooth function of the phase: no abs() kinks, lifts are smoothstepped.
  const sc = (o.cheat ?? CHILD_CHEAT) * k, amp = o.amp ?? 1;
  const s1 = Math.sin(phase), s2 = -s1, bob = 0.04 * amp * s1 * s1, sway = s1 * 0.014 * amp;
  const x = x0 + sway * sc;
  const P = (a, b) => [x + a * sc, gy - b * sc];
  const lifted = (v) => { const m = Math.max(0, v); return m * m * (3 - 2 * m) * amp; };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(15,20,10,0.3)'; ctx.beginPath(); ctx.ellipse(x, gy + 1, 0.34 * sc, 0.07 * sc, 0, 0, TAU); ctx.fill();
  const leg = (side, s) => {
    const hip = P(side * 0.075, 0.5 + bob), lift = lifted(s);
    const knee = P(side * 0.09, 0.27 + 0.07 * lift), foot = P(side * 0.075, 0.03 + 0.12 * lift);
    ctx.strokeStyle = look.skin; ctx.lineWidth = 0.1 * sc; ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke();
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.12 * sc; ctx.beginPath(); ctx.moveTo(foot[0] - 0.03 * sc, foot[1]); ctx.lineTo(foot[0] + 0.03 * sc, foot[1]); ctx.stroke();
  };
  leg(-1, s1); leg(1, s2);
  const hipY = 0.52 + bob;
  ctx.fillStyle = look.shorts; ctx.beginPath(); ctx.roundRect(x - 0.17 * sc, gy - hipY * sc, 0.34 * sc, 0.2 * sc, 0.05 * sc); ctx.fill();
  ctx.save(); ctx.translate(x, gy - (hipY + 0.14) * sc); ctx.rotate((o.lean ?? 0) * 0.25 + 0.06 - s1 * 0.035 * amp);
  ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.roundRect(-0.18 * sc, -0.5 * sc, 0.36 * sc, 0.55 * sc, 0.1 * sc); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-0.02 * sc, -0.48 * sc, 0.2 * sc, 0.5 * sc);
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(0, -0.62 * sc, 0.15 * sc, 0, TAU); ctx.fill();
  ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(0, -0.65 * sc, 0.155 * sc, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  if (look.style === 'long') { ctx.beginPath(); ctx.roundRect(-0.16 * sc, -0.68 * sc, 0.32 * sc, 0.36 * sc, 0.1 * sc); ctx.fill(); }
  else if (look.style === 'cap') { ctx.fillStyle = look.accent; ctx.beginPath(); ctx.arc(0, -0.66 * sc, 0.165 * sc, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(-0.17 * sc, -0.67 * sc, 0.34 * sc, 0.04 * sc); }
  else if (look.style === 'scarf') { ctx.fillStyle = look.accent; ctx.fillRect(-0.15 * sc, -0.5 * sc, 0.3 * sc, 0.07 * sc); }
  ctx.restore();
  const sh = [x + 0.15 * sc, gy - (hipY + 0.5) * sc], hand = [x + 0.42 * sc, gy - (hipY + 0.2 + 0.03 * s1 * amp) * sc];
  ctx.strokeStyle = look.skin; ctx.lineWidth = 0.09 * sc; ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
  // the free arm swings opposite the legs
  const sh2 = [x - 0.15 * sc, gy - (hipY + 0.46) * sc], hand2 = [x - 0.27 * sc + 0.06 * sc * s1 * amp, gy - (hipY + 0.16 + 0.08 * s2 * amp) * sc];
  ctx.strokeStyle = look.skin; ctx.lineWidth = 0.085 * sc; ctx.beginPath(); ctx.moveTo(sh2[0], sh2[1]); ctx.lineTo(hand2[0], hand2[1]); ctx.stroke();
  if (hx !== undefined) {
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = Math.max(2, 0.06 * sc);
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = Math.max(1, 0.025 * sc);
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(hand[0], hand[1], 0.055 * sc, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Where the hoop's rim is on screen (the point the stick pushes), and the child's feet, for the player.
export function playerAnchor(cam, me) {
  const a = proj(cam, 0, me.d, 0);
  return { x: a.x, y: a.y, k: a.k, rim: { x: a.x - 0.05 * a.k, y: a.y - 0.36 * HOOP_CHEAT * a.k * 0.9 }, child: proj(cam, -0.85, me.d - 0.62, 0) };
}

function drawMe(ctx, cam, me, t, st) {
  const A = playerAnchor(cam, me), look = LOOKS[me.look] ?? LOOKS[0];
  if (cam.G3) { cam.G3.people.push({ id: 0, r: me, look, z: 0, e: me.d, cz: -0.85, ce: me.d - 0.62, hoopCheat: HOOP_CHEAT, childCheat: CHILD_CHEAT }); void t; void st; return; }
  const down = me.phase === 'down';
  if (!down || me.downT < 1.3) {
    const wob = down ? clamp(me.downT / 0.4, 0, 1) : 0;
    ctx.save();
    if (down) { ctx.translate(A.child.x, A.child.y); ctx.rotate(-0.45 * wob); ctx.translate(-A.child.x, -A.child.y); }
    drawChild(ctx, A.child.x, A.child.y, A.child.k, look, me.stride * 3.4, A.rim.x, A.rim.y, { lean: me.lam, cheat: CHILD_CHEAT, amp: clamp(me.v / 2.2, 0, 1) });
    ctx.restore();
  }
  drawHoop(ctx, A.x, A.y, A.k, me, { tape: '#e8472f' });
  void t; void st;
}

function drawRival(ctx, cam, r, z, t) {
  const a = proj(cam, z, r.d, 0), k = a.k;
  if (a.y < cam.hy + 1) return;
  const look = LOOKS[r.look] ?? LOOKS[0];
  const rim = { x: a.x - 0.04 * k, y: a.y - 0.36 * 1.15 * k * 0.9 };
  const c = proj(cam, z - 0.85, r.d - 0.62, 0);
  if (cam.G3) cam.G3.people.push({ id: r.id, r, look, z, e: r.d, cz: z - 0.85, ce: r.d - 0.62, hoopCheat: 1.15, childCheat: 0.98 });
  else if (r.phase !== 'down' || r.downT < 1.3) drawChild(ctx, c.x, c.y, c.k, look, r.stride * 3.4, rim.x, rim.y, { lean: r.lam, cheat: 0.98, amp: clamp(r.v / 2.2, 0, 1) });
  if (!cam.G3) drawHoop(ctx, a.x, a.y, k, r, { cheat: 1.15, tape: look.shirt });
  if (z > -2 && z < 45) {
    const fs = Math.max(11, Math.min(20, k * 0.36));
    ctx.font = `600 ${fs}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(r.name).width + 20, h = fs * 1.5, ty = a.y - 0.36 * 1.15 * k * 2.1 - h;
    ctx.fillStyle = 'rgba(13,27,38,0.72)'; ctx.beginPath(); ctx.roundRect(a.x - w / 2, ty - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.arc(a.x - w / 2 + 8, ty, 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(r.name, a.x + 4, ty + 1);
  }
  void t;
}

// ---- particles (road frame: s along the road, e sideways, y up) ---------------------------------------------------------------------
export function burst(list, rng, s, e, n, col, power = 1, up = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), sp = rng.range(0.4, 1.7) * power;
    list.push({ z: s, e, y: 0.05, vz: Math.cos(a) * sp * 0.6, ve: Math.sin(a) * sp, vy: (Math.abs(Math.sin(a)) * 1.3 * up + 0.8) * 1.2, life: 0, max: rng.range(0.35, 0.85), r: rng.range(2, 4.5), col });
  }
  if (list.length > 140) list.splice(0, list.length - 140);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.life += dt; p.z += p.vz * dt; p.e += p.ve * dt; p.y += p.vy * dt; p.vy -= 7 * dt; if (p.y < 0) { p.y = 0; p.vy = 0; p.vz *= 0.8; p.ve *= 0.8; } }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
export function drawParticles(ctx, cam, list) {
  for (const p of list) {
    const q = proj(cam, p.z - cam.sMe, p.e, p.y);
    ctx.globalAlpha = clamp(1 - p.life / p.max, 0, 1) * 0.9;
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.5, p.r * (q.k / 90)), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let q = 0; q < 10; q++) { const r = q % 2 ? size * 0.45 : size, a = -Math.PI / 2 + q * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < n ? '#a8741a' : 'rgba(255,255,255,0.25)'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}
