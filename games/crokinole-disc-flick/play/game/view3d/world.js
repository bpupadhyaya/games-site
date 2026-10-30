// Procedural 3D parts for the Disc Flick Table: a walnut-rimmed maple board with brass pegs and pocket on a red buffalo-plaid wool cloth,
// and lacquered bakelite discs. Everything is generated here (no files). Board units = the sim's pixels (disc radius 19).
import * as THREE from '../vendor3d/three.js';
import { R_DISC, R_POCKET, R_PEG, R_PLAY, R_BOARD, RINGS, PEGS, MAX_U, U_ANGLE, R_BASE } from '../src/sim.js';
import { FONT, leafPath, starPath, drawDisc } from '../src/art.js';

const TAU = Math.PI * 2;
export const DISC_H = 11, CLOTH_Y = -30;
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; };

export function plaidTexture() {
  const S = 256, c = cvs(S, S), x = c.getContext('2d'), h = S / 2;
  x.fillStyle = '#a3201f'; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(40,6,8,0.52)'; x.fillRect(h, 0, h, h); x.fillRect(0, h, h, h);
  x.fillStyle = 'rgba(8,0,2,0.82)'; x.fillRect(h, h, h, h);
  const r = lcg(5);
  for (let i = 0; i < S; i += 3) { x.fillStyle = `rgba(255,170,150,${0.03 + r() * 0.05})`; x.fillRect(i, 0, 1, S); x.fillRect(0, i + 1, S, 1); }
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,190,170'},${0.04 + r() * 0.07})`; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1); }
  return tex(c, true);
}
export function buildCloth() {
  const t = plaidTexture(); t.repeat.set(30, 30);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6600, 6600), new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.6, roughness: 1, metalness: 0, color: 0xd8d0d0 }));
  m.rotation.x = -Math.PI / 2; m.position.y = CLOTH_Y; m.receiveShadow = true; return m;
}

function ringPath(ctx, r) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); }
// The playing surface painted onto a square covering +-R_PLAY (canvas px <-> board x, z; pegs and the pocket are real 3D parts).
export function surfaceTexture(S) {
  const c = cvs(S, S), ctx = c.getContext('2d'), k = S / (2 * R_PLAY);
  ctx.translate(S / 2, S / 2); ctx.scale(k, k);
  let g = ctx.createRadialGradient(-60, -80, 20, 0, 0, R_PLAY);
  g.addColorStop(0, '#f4dfae'); g.addColorStop(0.6, '#e8c993'); g.addColorStop(1, '#d2a96a');
  ctx.fillStyle = g; ringPath(ctx, R_PLAY + 2); ctx.fill();
  ctx.save(); ringPath(ctx, R_PLAY); ctx.clip();
  const r = lcg(11);
  for (let i = 0; i < 150; i++) {
    const x = -R_PLAY + (i / 150) * R_PLAY * 2 + (r() - 0.5) * 10, amp = (r() - 0.5) * 34, w = 0.8 + r() * 2.2;
    ctx.strokeStyle = r() < 0.6 ? `rgba(120,76,28,${0.05 + r() * 0.09})` : `rgba(255,250,226,${0.1 + r() * 0.12})`;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, -R_PLAY);
    ctx.bezierCurveTo(x + amp, -R_PLAY * 0.35, x - amp, R_PLAY * 0.35, x + amp * 0.4, R_PLAY); ctx.stroke();
  }
  [[R_PLAY, 'rgba(60,40,10,0)'], [RINGS[2].r, 'rgba(70,120,96,0.13)'], [RINGS[1].r, 'rgba(210,150,60,0.13)'], [RINGS[0].r, 'rgba(210,80,50,0.16)']].forEach(([rr, col]) => { ctx.fillStyle = col; ringPath(ctx, rr); ctx.fill(); });
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,40,14,0.85)'; ctx.lineWidth = 3.2; RINGS.forEach((q) => { ringPath(ctx, q.r); ctx.stroke(); });
  ctx.strokeStyle = 'rgba(255,248,224,0.45)'; ctx.lineWidth = 1.2; RINGS.forEach((q) => { ringPath(ctx, q.r + 2.5); ctx.stroke(); });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [[RINGS[0].r * 0.72, '15', 22], [(RINGS[0].r + RINGS[1].r) / 2, '10', 26], [(RINGS[1].r + RINGS[2].r) / 2, '5', 26]].forEach(([rr, t, fs]) => {
    for (let q = 0; q < 4; q++) {
      const a = Math.PI / 4 + (q * Math.PI) / 2; ctx.save(); ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2);
      ctx.font = `700 ${fs}px ${FONT}`; ctx.fillStyle = 'rgba(255,248,224,0.55)'; ctx.fillText(t, 1, 1.5); ctx.fillStyle = 'rgba(92,52,18,0.7)'; ctx.fillText(t, 0, 0); ctx.restore();
    }
  });
  for (let q = 0; q < 4; q++) { const a = (q * Math.PI) / 2, rr = (RINGS[1].r + RINGS[2].r) / 2; ctx.fillStyle = 'rgba(176,38,36,0.24)'; leafPath(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 24, a + Math.PI / 2 + Math.PI); ctx.fill(); }
  for (let side = 0; side < 2; side++) {
    const cc = side === 0 ? Math.PI / 2 : -Math.PI / 2, half = MAX_U * U_ANGLE + 0.12;
    ctx.strokeStyle = 'rgba(70,40,14,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R_BASE + R_DISC + 1, cc - half, cc + half); ctx.stroke();
    ctx.strokeStyle = side === 0 ? 'rgba(190,40,40,0.38)' : 'rgba(40,110,180,0.38)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, R_BASE + R_DISC - 4, cc - half, cc + half); ctx.stroke();
  }
  g = ctx.createRadialGradient(-6, -8, 2, 0, 0, R_POCKET + 2); g.addColorStop(0, '#000'); g.addColorStop(1, '#150b05');
  ctx.fillStyle = g; ringPath(ctx, R_POCKET + 2); ctx.fill();
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,220,130,0.8)'; ctx.fillText('20', 0, 1);
  const t = tex(c); return t;
}

const walnut = () => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, color: 0x7a4721, roughness: 0.38, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.35 });
export function buildBoard(texSize) {
  const grp = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CircleGeometry(R_PLAY, 96), new THREE.MeshPhysicalMaterial({ map: surfaceTexture(texSize), roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.5 }));
  top.rotation.x = -Math.PI / 2;
  // CircleGeometry uv = (x/r+1)/2, (y/r+1)/2 and rotateX(-90deg) sends y to -z: canvas row 0 is the screen top, matching the 2D board.
  top.receiveShadow = true; grp.add(top);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R_PLAY, R_PLAY, 40, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: 0.5 }));
  wall.position.y = -20; wall.castShadow = true; grp.add(wall);
  const gut = new THREE.Mesh(new THREE.RingGeometry(R_PLAY, R_BOARD + 1, 96), new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.55 }));
  gut.rotation.x = -Math.PI / 2; gut.position.y = -6; gut.receiveShadow = true; grp.add(gut);
  const prof = [[R_BOARD, -6], [R_BOARD, 12], [R_BOARD + 3, 16], [R_BOARD + 13, 17], [R_BOARD + 20, 11], [R_BOARD + 23, 0], [R_BOARD + 23, CLOTH_Y]].map(([r, y], i) => new THREE.Vector2(r, y));
  const rim = new THREE.Mesh(new THREE.LatheGeometry(prof, 120), walnut()); rim.castShadow = true; rim.receiveShadow = true; grp.add(rim);
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(R_BOARD + 9, 1.4, 8, 120), new THREE.MeshStandardMaterial({ color: 0xd9a84a, metalness: 1, roughness: 0.28 }));
  inlay.rotation.x = Math.PI / 2; inlay.position.y = 17.2; grp.add(inlay);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a84a, metalness: 1, roughness: 0.3 });
  const pr = new THREE.Mesh(new THREE.TorusGeometry(R_POCKET + 4, 2.6, 12, 64), brass); pr.rotation.x = Math.PI / 2; pr.position.y = 1.2; pr.castShadow = true; grp.add(pr);
  const pegs = PEGS.map((p) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xe2b455, metalness: 1, roughness: 0.26, emissive: 0xffe9a0, emissiveIntensity: 0 });
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(R_PEG * 1.2, R_PEG * 1.3, 10, 20), m); s.position.y = 5; g.add(s);
    const d = new THREE.Mesh(new THREE.SphereGeometry(R_PEG * 1.2, 20, 12, 0, TAU, 0, Math.PI / 2), m); d.position.y = 10; d.scale.y = 0.7; g.add(d);
    g.position.set(p.x, 0, p.y); g.traverse((o) => { o.castShadow = true; }); grp.add(g); g.userData.mat = m; return g;
  });
  grp.userData.pegs = pegs; return grp;
}

const faceCache = [];
function faceTexture(team) {
  if (faceCache[team]) return faceCache[team];
  const c = cvs(256, 256), x = c.getContext('2d');
  drawDisc(x, 128, 128, team, 0, { ghost: true, scale: 128 / R_DISC });
  const t = tex(c); faceCache[team] = t; return t;
}
const sideMats = [];
const sideMat = (team) => sideMats[team] || (sideMats[team] = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, color: team ? 0x14529a : 0xc3241f, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 }));
export function makeDisc(team) {
  const g = new THREE.Group(), R = R_DISC;
  const prof = [[0.01, 0], [R - 3, 0], [R - 0.8, 1.3], [R, 3.2], [R, DISC_H - 3.4], [R - 1.2, DISC_H - 1.1], [R - 3.2, DISC_H], [0.01, DISC_H]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), sideMat(team)); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(R - 3.1, 40), new THREE.MeshPhysicalMaterial({ map: faceTexture(team), roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.35 }));
  face.rotation.x = -Math.PI / 2; face.position.y = DISC_H + 0.06; g.add(face);
  const glow = new THREE.Mesh(new THREE.RingGeometry(R + 1, R + 9, 40), new THREE.MeshBasicMaterial({ color: team ? 0x6fb4ff : 0xff7b62, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.4; g.add(glow);
  g.userData = { face, glow, body };
  return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff1e2, 0x4a1a16, 0.42); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.55); sun.position.set(-330, 760, -380); sun.castShadow = true;
  const c = sun.shadow.camera; c.left = -470; c.right = 470; c.top = 470; c.bottom = -470; c.near = 100; c.far = 1700; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.9; sun.shadow.radius = 3;
  scene.add(sun); return { hemi, sun };
}
export function disposeGroup(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
void starPath;
