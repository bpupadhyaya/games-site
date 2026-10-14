// Candlepin Bowling 3D models: the lane and the retro 1960s New England alley around it, the slim candlepin at real scale
// (38.7 cm tall, 6.9 cm at the belly, two red neck rings), the palm-size ball (11.4 cm) and small props.
// Everything is procedural (canvas textures, lathe geometry). Presentation only.
// Coordinates: the sim is x across, y down the lane from the foul line (y = 0), z up. Three.js is y-up, so
//   three = (x, z, -y): the lane runs along -Z and the bowler stands at +Z looking down it.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { LANE, PIN_XY } from '../src/sim.js';
import { ALLEYS } from '../src/art.js';

export const TAU = Math.PI * 2;
export const PITCH = 1.5;                       // centre to centre of neighbouring lanes
export const LANE_LEN = LANE.pitY;
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; if (draw) draw(c.getContext('2d'), w, h); return c; };
export function tex(canvas, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0, ...o });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const mix = (a, b, t) => { const A = new THREE.Color(a), Bc = new THREE.Color(b); return `#${A.lerp(Bc, t).getHexString()}`; };

// ---------------------------------------------------------------- textures
// 39 boards of hard maple, grain along the lane (canvas y), butt joints, a long varnish gradient.
export function mapleCanvas(c0 = '#f0c27a', c1 = '#c98f3f', seed = 5, w = 468, h = 1024) {
  const r = rng(seed);
  return cvs(w, h, (g) => {
    const n = 39, bw = w / n;
    for (let i = 0; i < n; i++) {
      const t = 0.15 + r() * 0.7;
      let y = 0;
      while (y < h) {
        const len = 120 + r() * 520, tone = mix(c0, c1, Math.min(1, Math.max(0, t + (r() - 0.5) * 0.25)));
        g.fillStyle = tone; g.fillRect(i * bw, y, bw + 0.5, Math.min(len, h - y) + 0.5);
        for (let k = 0; k < 6; k++) { // grain streaks
          g.strokeStyle = `rgba(${r() < 0.6 ? '90,48,12' : '255,236,190'},${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.1;
          const gx = i * bw + r() * bw; g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + (r() - 0.5) * 3, y + Math.min(len, h - y)); g.stroke();
        }
        g.fillStyle = 'rgba(70,35,8,0.35)'; g.fillRect(i * bw, y, bw, 1.2);   // butt joint
        y += len;
      }
      g.fillStyle = 'rgba(70,35,8,0.30)'; g.fillRect(i * bw, 0, 1, h);        // board seam
    }
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.05)'); v.addColorStop(0.5, 'rgba(0,0,0,0.05)'); v.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}
// arrows, dots, the foul-line stripe row for the approach end of the lane (1.054 m wide, 7 m long) on a transparent canvas
function laneMarksCanvas() {
  const W = 300, H = Math.round(300 * 7 / 1.054), ppm = W / 1.054;
  return cvs(W, H, (g) => {
    const X = (x) => W / 2 + x * ppm, Y = (y) => y * ppm;
    g.fillStyle = 'rgba(55,28,6,0.62)';
    for (let i = -3; i <= 3; i++) {   // arrows: a "V" of seven, point toward the pins, at about 4.6 m
      const x = i * 0.12, y = 4.55 + (3 - Math.abs(i)) * 0.0 + Math.abs(i) * -0.0, d = 0.11 - Math.abs(i) * 0.012;
      g.beginPath(); g.moveTo(X(x), Y(y + 0.2)); g.lineTo(X(x - 0.022), Y(y)); g.lineTo(X(x + 0.022), Y(y)); g.closePath(); g.fill();
      void d;
    }
    for (const i of [-2, 0, 2]) { g.beginPath(); g.arc(X(i * 0.13), Y(1.5), 0.012 * ppm, 0, TAU); g.fill(); }  // range dots
    for (const i of [-3, -2, -1, 0, 1, 2, 3]) { g.beginPath(); g.arc(X(i * 0.12), Y(0.22), 0.006 * ppm, 0, TAU); g.fill(); }
  });
}
// the pin deck: ten spot marks (small ring + dot)
function deckMarksCanvas() {
  const W = 512, wm = 1.5, hm = 1.3, ppm = W / wm, H = Math.round(hm * ppm);
  return cvs(W, H, (g) => {
    g.strokeStyle = 'rgba(40,20,4,0.65)'; g.fillStyle = 'rgba(40,20,4,0.5)'; g.lineWidth = 2;
    for (const [x, y] of PIN_XY) {
      const px = W / 2 + x * ppm, py = (y - (LANE.headY - 0.15)) * ppm;
      g.beginPath(); g.arc(px, py, 0.026 * ppm, 0, TAU); g.stroke();
      g.beginPath(); g.arc(px, py, 0.006 * ppm, 0, TAU); g.fill();
    }
  });
}
// 1960s carpet: dark ground with boomerangs, stars and bowling-pin confetti
export function carpetCanvas(base = '#16233d', accent = '#37e0d4', accent2 = '#ff4fa3', seed = 9) {
  const r = rng(seed);
  return cvs(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = [accent, accent2, '#ffc24a', '#f7f0dc'];
    for (let i = 0; i < 46; i++) {
      const x = r() * w, y = r() * h, s = 10 + r() * 22, a = r() * TAU;
      g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = 0.5 + r() * 0.35; g.fillStyle = cols[i % 4];
      if (i % 3 === 0) { g.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? s * 0.28 : s * 0.7, aa = (k / 10) * TAU; g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } g.closePath(); g.fill(); }
      else if (i % 3 === 1) { g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.9, s, 0); g.quadraticCurveTo(0, -s * 0.25, -s, 0); g.fill(); }
      else { g.beginPath(); g.ellipse(0, 0, s * 0.18, s * 0.5, 0, 0, TAU); g.fill(); g.fillRect(-s * 0.06, -s * 0.9, s * 0.12, s * 0.5); }
      g.restore();
    }
    g.globalAlpha = 1;
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = (r() - 0.5) * 18; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  });
}
function wallCanvas(c0, c1) {
  return cvs(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2;
    for (let x = 4; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
}
function radial(color, size = 128) {
  return cvs(size, size, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, color); gr.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
}
export const glowTexture = (color = 'rgba(255,255,255,1)') => tex(radial(color), {});
// neon marquee for the pinsetter hood
function signCanvas(text, glow, ink = '#fff6e4') {
  return cvs(1024, 256, (g, w, h) => {
    g.fillStyle = '#0b0c16'; g.fillRect(0, 0, w, h);
    g.strokeStyle = glow; g.lineWidth = 6; g.shadowColor = glow; g.shadowBlur = 18; g.strokeRect(14, 14, w - 28, h - 28);
    g.font = '900 150px "Didot","Bodoni 72","Playfair Display",Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowBlur = 36; g.fillStyle = glow; g.fillText(text, w / 2, h / 2 + 6);
    g.shadowBlur = 8; g.fillStyle = ink; g.fillText(text, w / 2, h / 2 + 6);
    g.shadowBlur = 0; g.fillStyle = glow;
    for (const sx of [64, w - 64]) { g.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 9 : 24, aa = (k / 10) * TAU - Math.PI / 2; g.lineTo(sx + Math.cos(aa) * rr, h / 2 + Math.sin(aa) * rr); } g.closePath(); g.fill(); }
  });
}

// ---------------------------------------------------------------- the pin
// silhouette [height, radius] in metres (the 2D art's profile; 38.7 cm tall, 6.9 cm at the belly)
const PROFILE = [[0, 0.021], [0.012, 0.027], [0.06, 0.032], [0.12, 0.0345], [0.19, 0.03], [0.25, 0.022], [0.29, 0.0185], [0.325, 0.0215], [0.355, 0.0225], [0.372, 0.0195], [0.381, 0.013], [0.3855, 0.0065], [0.387, 0.0]];
const BANDS = [[0.262, 0.276], [0.294, 0.316]];     // the two red rings on the neck: y ranges
export const PIN_CENTRE = 0.19;
let _pinGeo = null, _pinMat = null;
export function pinGeometry() {
  if (_pinGeo) return _pinGeo;
  // Catmull-Rom through the silhouette points, resampled evenly
  const P = PROFILE.map(([y, r]) => [r, y]), out = [];
  const at = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), steps = 8;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([Math.max(0, f(0)), f(1) - PIN_CENTRE]);
    }
  }
  out.push([0, PROFILE[PROFILE.length - 1][0] - PIN_CENTRE]);
  const pts = out;
  pts[0] = [0, pts[0][1]]; pts.splice(1, 0, [pts[1][0] * 0.55, pts[0][1]]);   // flat foot
  pts[pts.length - 1] = [0, pts[pts.length - 1][1]];
  _pinGeo = B.lathe(pts, 28);
  _pinGeo.userData.profile = pts;
  return _pinGeo;
}
function pinCanvas() {
  // v runs up the pin along arc length: build a lookup from y to v with the same profile B.lathe uses
  const pts = pinGeometry().userData.profile;
  let total = 0; const cum = [0];
  for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(total); }
  const vOf = (y) => { for (let i = 1; i < pts.length; i++) if (pts[i][1] + PIN_CENTRE >= y) { const f = (y - (pts[i - 1][1] + PIN_CENTRE)) / Math.max(1e-6, pts[i][1] - pts[i - 1][1]); return (cum[i - 1] + f * (cum[i] - cum[i - 1])) / total; } return 1; };
  return cvs(8, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff7e6'); gr.addColorStop(1, '#f4ead2'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (const [y0, y1] of BANDS) {
      const a = (1 - vOf(y1)) * h, b = (1 - vOf(y0)) * h;
      g.fillStyle = '#c4202c'; g.fillRect(0, a, w, b - a);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, a, w, 1.5);
    }
    // a faint worn ring at the belly where balls strike
    const m = (1 - vOf(0.12)) * h; g.fillStyle = 'rgba(120,90,40,0.10)'; g.fillRect(0, m - 18, w, 36);
  });
}
export function pinMaterial() {
  if (_pinMat) return _pinMat;
  _pinMat = new THREE.MeshPhysicalMaterial({ map: tex(pinCanvas(), {}), color: 0xffffff, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 0.9 });
  return _pinMat;
}
const blobT = () => (blobT.t ||= tex(radial('rgba(0,0,0,1)'), {}));
export function blobShadow(radius, opacity = 0.55) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: blobT(), transparent: true, opacity, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.renderOrder = 2; return m;
}
// a pin ready to be placed: group (root, at the pin's centre of mass) -> mesh, plus a blob shadow kept on the floor by the presenter
export function makePin() {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(pinGeometry(), pinMaterial()); mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  const shadow = blobShadow(0.07, 0.6);
  return { root: g, mesh, shadow };
}

// ---------------------------------------------------------------- the ball
let _ballMat = null;
export function ballMaterial() {
  if (_ballMat) return _ballMat;
  const map = cvs(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#171922'); gr.addColorStop(1, '#0a0b12'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(77);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.14})`; g.beginPath(); g.arc(r() * w, r() * h, 0.8 + r() * 1.6, 0, TAU); g.fill(); }
    g.fillStyle = '#e8e2d2'; g.fillRect(0, h * 0.5 - 3, w, 6);                      // a thin white equator ring: shows the roll
    g.fillStyle = '#c4202c'; for (const x of [w * 0.25, w * 0.75]) { g.beginPath(); g.arc(x, h * 0.5, 9, 0, TAU); g.fill(); }
  });
  _ballMat = new THREE.MeshPhysicalMaterial({ map: tex(map, {}), color: 0xffffff, roughness: 0.18, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5 });
  return _ballMat;
}
export function makeBall() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(LANE.ballR, 40, 28), ballMaterial());
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  return { root: g, mesh, shadow: blobShadow(0.1, 0.7) };
}

// ---------------------------------------------------------------- the alley
function box(w, h, d, mat, x, y, z, cast = false, recv = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, z + h / 2 * 0 + 0, -y); m.position.y = z; // caller gives the vertical CENTRE as z
  m.castShadow = cast; m.receiveShadow = recv; return m;
}
const place = (m, x, y, z) => { m.position.set(x, z, -y); return m; };
const plane = (w, d, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; };

export function buildAlley(id = 'harbor', quality = 'high') {
  const A = ALLEYS[id] ?? ALLEYS.harbor;
  const root = new THREE.Group(); root.name = `alley:${id}`;
  const lights = { spots: [], points: [], neon: [], screens: [] };
  const len = LANE.pitY + 0.02;
  const sx = 3 * PITCH;                              // half width of the lane bank (five lanes)

  // materials
  const mapleTex = tex(mapleCanvas(A.maple[0], A.maple[1], 11), { repeat: [1, len / 1.9] });
  const laneMat = new THREE.MeshPhysicalMaterial({ map: mapleTex, color: 0xffffff, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.1 });
  const apprTex = tex(mapleCanvas(mix(A.maple[0], '#ffffff', 0.18), mix(A.maple[1], '#ffffff', 0.12), 21), { repeat: [1, 2.4] });
  const apprMat = new THREE.MeshPhysicalMaterial({ map: apprTex, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.8 });
  const capMat = std('#e9dcc0', { roughness: 0.55 });
  const gutMat = new THREE.MeshStandardMaterial({ color: '#12141e', roughness: 0.32, metalness: 0.5, side: THREE.DoubleSide, envMapIntensity: 1 });
  const darkWood = phys('#3a2412', { roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const carpetTex = tex(carpetCanvas(A.carpet[1], A.glow, A.sign, 3), { repeat: [14, 14] });
  const carpetMat = std('#ffffff', { map: carpetTex, roughness: 0.95 });
  const wallTex = tex(wallCanvas(A.wall[0], A.wall[1]), { repeat: [6, 1] });
  const wallMat = std('#ffffff', { map: wallTex, roughness: 0.8 });
  const blackGloss = phys('#07080d', { roughness: 0.25, clearcoat: 0.8 });

  // floor around the lanes
  const carpet = plane(60, 60, carpetMat); place(carpet, 0, 6, -0.03); root.add(carpet);

  // approach (blonde maple, satin) across the whole bank
  const appr = plane(2 * sx, 4.6, apprMat); place(appr, 0, -2.3, 0); root.add(appr);
  // a row of slide dots
  const dots = new THREE.Mesh(new THREE.PlaneGeometry(2 * sx, 0.4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); place(dots, 0, -1.5, 0.001);

  // one lane (reused) -- surface, gutters, kickbacks, pit, pinsetter opening
  const marks = tex(laneMarksCanvas(), {}), deckMarks = tex(deckMarksCanvas(), {});
  const markMat = new THREE.MeshBasicMaterial({ map: marks, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.9 });
  const deckMat = new THREE.MeshBasicMaterial({ map: deckMarks, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.9 });
  const foulMat = new THREE.MeshBasicMaterial({ color: 0xd4262f });
  const laneGeo = new THREE.PlaneGeometry(2 * LANE.halfW, len);
  const gutGeo = new THREE.CylinderGeometry(0.052, 0.052, len, 14, 1, true, Math.PI * 0.5, Math.PI);   // lower half, opens upward
  gutGeo.rotateX(Math.PI / 2);
  const kickGeo = new THREE.BoxGeometry(0.06, 0.2, LANE.pitY - LANE.deckStart);
  const kickCapGeo = new THREE.BoxGeometry(0.1, 0.014, LANE.pitY - LANE.deckStart);
  const laneProto = new THREE.Group();
  {
    const top = new THREE.Mesh(laneGeo, laneMat); top.rotation.x = -Math.PI / 2; top.position.set(0, 0, -len / 2); top.receiveShadow = true; laneProto.add(top);
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(2 * LANE.halfW, 7), markMat); mk.rotation.x = -Math.PI / 2; mk.position.set(0, 0.0015, -3.5); laneProto.add(mk);
    const dk = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), deckMat); dk.rotation.x = -Math.PI / 2; dk.position.set(0, 0.0015, -(LANE.headY - 0.15 + 0.65)); laneProto.add(dk);
    const foul = new THREE.Mesh(new THREE.PlaneGeometry(2 * LANE.halfW, 0.05), foulMat); foul.rotation.x = -Math.PI / 2; foul.position.set(0, 0.002, -0.0); laneProto.add(foul);
    for (const sgn of [-1, 1]) {
      const g = new THREE.Mesh(gutGeo, gutMat); g.position.set(sgn * (LANE.halfW + 0.05), -0.002, -len / 2); laneProto.add(g);
      const k = new THREE.Mesh(kickGeo, darkWood); k.position.set(sgn * (LANE.deckHalf + 0.03), 0.1, -(LANE.deckStart + LANE.pitY) / 2); k.castShadow = true; k.receiveShadow = true; laneProto.add(k);
      const kc = new THREE.Mesh(kickCapGeo, phys('#b98a4d', { roughness: 0.35, clearcoat: 0.8 })); kc.position.set(sgn * (LANE.deckHalf + 0.02), 0.207, -(LANE.deckStart + LANE.pitY) / 2); laneProto.add(kc);
    }
    // caps between lanes (cream) and the bed under the pit
    const capW = PITCH - 2 * (LANE.halfW + 0.1);
    for (const sgn of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(capW / 2 + 0.02, len), capMat); c.rotation.x = -Math.PI / 2; c.position.set(sgn * (LANE.halfW + 0.1 + capW / 4), -0.001, -len / 2); c.receiveShadow = true; laneProto.add(c);
    }
    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.1), blackGloss); pit.position.set(0, -0.4, -(LANE.pitY + 0.55)); laneProto.add(pit);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), blackGloss); apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.001, -(LANE.pitY + 0.25)); laneProto.add(apron);
  }
  for (const i of [-2, -1, 0, 1, 2]) { const l = i === 0 ? laneProto : laneProto.clone(true); l.position.x = i * PITCH; root.add(l); }
  // foul-line plus a faint dividing line across the approach per lane is part of laneProto; the approach is one slab.

  // caps outside the bank and the ball-return hoods (low walnut boxes at the approach end of each lane)
  for (const i of [-2, -1, 0, 1, 2]) {
    const bx = new THREE.Mesh(B.roundedBox(0.22, 0.26, 0.9, 0.05, 3), darkWood); bx.position.set(i * PITCH + 0.9, 0.13, 1.2); bx.castShadow = true; root.add(bx);
    const lid = new THREE.Mesh(B.roundedBox(0.24, 0.03, 0.92, 0.012, 2), new THREE.MeshStandardMaterial({ color: '#d7dbe6', metalness: 1, roughness: 0.2 })); lid.position.set(i * PITCH + 0.9, 0.275, 1.2); root.add(lid);
  }
  // the pinsetter machines: a continuous hood across the bank, curtains to the pit, a masking unit above it
  const hoodZ0 = 0.95, hoodZ1 = 2.55, hy = LANE.pitY + 0.5;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2 * sx + 1, hoodZ1 - hoodZ0, 1.2), std(mix(A.wall[1], '#000000', 0.25), { roughness: 0.75, metalness: 0 }));
  hood.position.set(0, (hoodZ0 + hoodZ1) / 2, -hy); hood.castShadow = true; root.add(hood);
  const chrome = new THREE.Mesh(new THREE.BoxGeometry(2 * sx + 1.05, 0.06, 1.25), new THREE.MeshStandardMaterial({ color: '#d7dbe6', metalness: 1, roughness: 0.18 })); chrome.position.set(0, hoodZ0, -hy); root.add(chrome);
  const signMat = new THREE.MeshBasicMaterial({ map: tex(signCanvas('CANDLEPIN', A.sign), {}), toneMapped: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), signMat); sign.position.set(0, hoodZ0 + 0.8, -(hy - 0.62)); root.add(sign);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.2), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,170,60,1)'), color: new THREE.Color(A.sign), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.position.set(0, hoodZ0 + 0.8, -(hy - 0.65)); root.add(glow);
  for (const i of [-2, -1, 0, 1, 2]) {   // curtains
    const cu = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.95), blackGloss); cu.position.set(i * PITCH, 0.475, -(LANE.pitY - 0.02)); root.add(cu);
  }
  // overhead scoring monitors above the machines (canvas updated by the presenter)
  const scoreCanvas = cvs(1024, 256);
  const scoreTex = tex(scoreCanvas, {});
  const scoreMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: scoreTex, toneMapped: false }));
  scoreMesh.position.set(0, hoodZ1 + 0.62, -(hy - 0.5)); scoreMesh.rotation.x = 0.1; root.add(scoreMesh);
  const scoreFrame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.98, 0.14), new THREE.MeshStandardMaterial({ color: '#2a2f3c', metalness: 0.6, roughness: 0.4 })); scoreFrame.position.set(0, hoodZ1 + 0.62, -(hy - 0.44)); scoreFrame.rotation.x = 0.1; root.add(scoreFrame);
  lights.scoreCanvas = scoreCanvas; lights.scoreTex = scoreTex;

  // walls, ceiling, neon, back wall
  const wallL = new THREE.Mesh(new THREE.PlaneGeometry(40, 5), wallMat); wallL.position.set(-sx - 3.5, 2.5, -8); wallL.rotation.y = Math.PI / 2; root.add(wallL);
  const wallR = wallL.clone(); wallR.position.x = sx + 3.5; wallR.rotation.y = -Math.PI / 2; root.add(wallR);
  const wallB = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), wallMat); wallB.position.set(0, 3, -(LANE.pitY + 2.6)); root.add(wallB);
  const wallF = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), wallMat); wallF.position.set(0, 3, 11); wallF.rotation.y = Math.PI; root.add(wallF);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std('#10131e', { roughness: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.6, -8); root.add(ceil);
  const neonMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  for (const [c, z] of [[A.glow, 1.55], [A.sign, 2.35]]) {
    for (const sgn of [-1, 1]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 36, 8), neonMat(c)); tube.rotation.x = Math.PI / 2; tube.position.set(sgn * (sx + 3.45), z, -8); root.add(tube);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(36, 0.9), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,255,255,1)'), color: c, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      halo.rotation.y = sgn > 0 ? -Math.PI / 2 : Math.PI / 2; halo.position.set(sgn * (sx + 3.42), z, -8); root.add(halo);
    }
  }
  // ceiling light rows with lamps
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false });
  for (let i = 0; i < 6; i++) {
    const y = 0.5 + i * 3.7;
    for (const x of [-PITCH * 1.5, 0, PITCH * 1.5]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.22), lampMat); lamp.position.set(x, 4.55, -y); root.add(lamp);
    }
  }
  // the lounge behind the foul line: vinyl bench seats, tables, a score desk
  const vinyl = (c) => phys(c, { roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const seatCols = [A.sign, A.glow, '#f7f0dc', A.trim];
  const lounge = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const x = -4.6 + k * 1.84;
    const base = new THREE.Mesh(B.roundedBox(1.5, 0.42, 0.62, 0.1, 4), vinyl(seatCols[k % 4])); base.position.set(x, 0.21, 0); base.castShadow = true;
    const back = new THREE.Mesh(B.roundedBox(1.5, 0.55, 0.16, 0.07, 4), vinyl(seatCols[k % 4])); back.position.set(x, 0.66, 0.3); back.rotation.x = -0.12; back.castShadow = true;
    lounge.add(base, back);
  }
  const deskTop = new THREE.Mesh(B.roundedBox(2.0, 0.08, 0.9, 0.04, 3), phys('#2a1a10', { roughness: 0.3, clearcoat: 1 })); deskTop.position.set(0, 1.0, 1.5); lounge.add(deskTop);
  const deskBase = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.8), std('#1a1d2a')); deskBase.position.set(0, 0.5, 1.5); lounge.add(deskBase);
  lounge.position.set(0, 0, 5.4); root.add(lounge);   // three z = +5.4 => 5.4 m behind the foul line

  // adjacent lane pins: instanced standing pins on the four neighbouring lanes
  const neighbours = [];
  for (const i of [-2, -1, 1, 2]) for (const [x, y] of PIN_XY) neighbours.push([i * PITCH + x, y]);
  const inst = new THREE.InstancedMesh(pinGeometry(), pinMaterial(), neighbours.length);
  const m4 = new THREE.Matrix4();
  neighbours.forEach(([x, y], k) => { m4.makeTranslation(x, PIN_CENTRE, -y); inst.setMatrixAt(k, m4); });
  inst.castShadow = false; root.add(inst);

  return { root, lights, lampMat, signMat, sign, glow, scoreCanvas, scoreTex, A, laneMat };
}

// spectators: points for the lounge behind the foul line (three coordinates, y = floor under the seat)
export function loungePoints() {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const x = -4.6 + k * 1.84;
    for (const dx of [-0.35, 0.35]) pts.push({ x: x + dx, y: 0.42, z: 5.4 + 0.02, yaw: Math.PI, seated: true });
  }
  return pts;
}
