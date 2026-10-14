// Tejo world: a Boyacá village court at golden hour. Everything is in metres, +Y up, the thrower looks toward -Z.
// The clay box is a real 1 m x 1 m clay face on a steel-and-timber frame, inclined toward the thrower; its local frame is
// X = right, Y = up the slope (far edge), Z = out of the clay. Sim coordinates (u, v in cm, 0..100) map to local (x, y) = ((u-50)/100, (v-50)/100).
// Real sizes: disc 8.8 cm across x 2.2 cm thick (about 680 g in steel), bocín (ring) 16 cm outer, mechas about 5 cm.
import { THREE, board3d as B, buildScenery } from '../vendor3d/index.js';
import { RING, MECHA, mecha as mechaPos } from '../src/sim.js';

export const THETA = (60 * Math.PI) / 180;           // incline of the clay face from the ground
export const BOX_Y = 0.14 + 0.5 * Math.sin(THETA);   // world height of the clay centre
export const NORMAL = new THREE.Vector3(0, Math.cos(THETA), Math.sin(THETA));
export const SLOPE = new THREE.Vector3(0, Math.sin(THETA), -Math.cos(THETA));
export const DISC = { r: 0.044, t: 0.022 };

const TAU = Math.PI * 2;
export const toLocal = (u, v) => ({ x: (u - 50) / 100, y: (v - 50) / 100 });
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  if (!o.linear) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
// lathe around Y, turned so its axis becomes the local Z (out of the clay)
const lathe = (profile, seg = 48) => { const g = B.lathe(profile, seg); g.rotateX(Math.PI / 2); return g; };

// ---- textures --------------------------------------------------------------------------------------------------------------------
export function clayTextures() {
  const S = 1024, r = rng(11);
  const a = cv(S), x = a.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#c4673a'); g.addColorStop(0.5, '#b0502c'); g.addColorStop(1, '#8e3b20');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const bumpC = cv(S), b = bumpC.getContext('2d'); b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {                      // soft mottling: wet and dry patches of clay
    const px = r() * S, py = r() * S, rr = 30 + r() * 120, d = r() < 0.5;
    const gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, d ? 'rgba(70,22,8,0.12)' : 'rgba(255,196,140,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 3600; i++) {                      // grit and tiny pebbles
    const px = r() * S, py = r() * S, rr = 0.8 + r() * 2.6, lit = r() < 0.5;
    x.fillStyle = lit ? `rgba(255,214,170,${0.05 + r() * 0.1})` : `rgba(50,14,6,${0.07 + r() * 0.12})`;
    x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill();
    b.fillStyle = lit ? `rgba(255,255,255,${0.35 + r() * 0.3})` : `rgba(0,0,0,${0.3 + r() * 0.3})`; b.beginPath(); b.arc(px, py, rr, 0, TAU); b.fill();
  }
  for (let i = 0; i < 70; i++) {                        // wet finger and board marks: long soft streaks
    const px = r() * S, py = r() * S, L = 60 + r() * 220, ang = -0.25 + (r() - 0.5) * 0.5, w = 3 + r() * 9;
    x.save(); x.translate(px, py); x.rotate(ang); x.strokeStyle = r() < 0.5 ? 'rgba(255,200,150,0.10)' : 'rgba(60,18,8,0.13)'; x.lineWidth = w; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, 0); x.lineTo(L, 0); x.stroke(); x.restore();
    b.save(); b.translate(px, py); b.rotate(ang); b.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)'; b.lineWidth = w; b.lineCap = 'round'; b.beginPath(); b.moveTo(0, 0); b.lineTo(L, 0); b.stroke(); b.restore();
  }
  for (let i = 0; i < 0; i++) {                         // hairline drying cracks
    let px = r() * S, py = r() * S; x.strokeStyle = 'rgba(40,10,4,0.35)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py);
    b.strokeStyle = 'rgba(0,0,0,0.5)'; b.lineWidth = 2; b.beginPath(); b.moveTo(px, py);
    for (let k = 0; k < 7; k++) { px += (r() - 0.5) * 60; py += (r() - 0.35) * 40; x.lineTo(px, py); b.lineTo(px, py); }
    x.stroke(); b.stroke();
  }
  return { map: ctex(a), bump: ctex(bumpC, { linear: true }) };
}

function dirtTexture() {
  const W = 512, H = 512, r = rng(5), c = cv(W, H), x = c.getContext('2d');
  x.fillStyle = '#8f7050'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const px = r() * W, py = r() * H, rr = 20 + r() * 60; const gr = x.createRadialGradient(px, py, 1, px, py, rr); const d = r() < 0.5; gr.addColorStop(0, d ? 'rgba(60,40,22,0.1)' : 'rgba(224,196,150,0.09)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 5200; i++) { x.fillStyle = r() < 0.5 ? `rgba(50,34,18,${0.08 + r() * 0.14})` : `rgba(230,205,160,${0.08 + r() * 0.14})`; const rr = 0.6 + r() * 1.8; x.beginPath(); x.arc(r() * W, r() * H, rr, 0, TAU); x.fill(); }
  const al = cv(64, 64), ax = al.getContext('2d'); const g = ax.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.2, 'rgba(255,255,255,0.9)'); g.addColorStop(0.8, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ax.fillStyle = g; ax.fillRect(0, 0, 64, 64);
  return { map: ctex(c, { repeat: [5, 15] }), alpha: ctex(al, { linear: true }) };
}
function plankTexture(base, seed = 3) {
  const S = 512, r = rng(seed), c = cv(S), x = c.getContext('2d');
  const n = 16, pw = S / n;
  for (let i = 0; i < n; i++) {
    const k = 0.86 + r() * 0.28; x.fillStyle = base; x.fillRect(i * pw, 0, pw, S);
    x.fillStyle = `rgba(${k > 1 ? '255,235,200' : '20,10,4'},${Math.abs(k - 1) * 0.5})`; x.fillRect(i * pw, 0, pw, S);
    for (let j = 0; j < 9; j++) { x.strokeStyle = r() < 0.5 ? 'rgba(20,10,4,0.12)' : 'rgba(255,230,190,0.08)'; x.lineWidth = 1 + r() * 1.6; const gx = i * pw + r() * pw; x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx + (r() - 0.5) * 4, S); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(i * pw, 0, 2, S);
  }
  return ctex(c, { repeat: [3, 1] });
}
function woodTexture(seed = 7, base = '#6b4524', w = 512, h = 128) {
  const r = rng(seed), c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { x.strokeStyle = r() < 0.5 ? `rgba(30,16,6,${0.06 + r() * 0.12})` : `rgba(190,140,86,${0.05 + r() * 0.1})`; x.lineWidth = 0.8 + r() * 2.6; const y0 = r() * h, a = (r() - 0.5) * 5, ph = r() * 6; x.beginPath(); x.moveTo(0, y0); for (let s = 1; s <= 16; s++) x.lineTo((s / 16) * w, y0 + Math.sin(ph + s * 0.5) * a); x.stroke(); }
  return ctex(c);
}
function dentTexture() {
  const S = 128, c = cv(S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.24, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(30,8,2,0.78)'); g.addColorStop(0.62, 'rgba(40,10,4,0.5)'); g.addColorStop(0.82, 'rgba(255,200,150,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return ctex(c);
}
export function softTexture(rgb = '255,255,255', size = 64, hard = 0.0) {
  const c = cv(size), x = c.getContext('2d'), m = size / 2, g = x.createRadialGradient(m, m, m * hard, m, m, m);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.45, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return ctex(c);
}

// ---- the disc: a heavy steel disc with a coloured painted rim band ----------------------------------------------------------------
let steelMat = null;
const TEAM_COL = ['#f4b92e', '#3d78ff'];
export function makeDisc(side = 0) {
  const R = DISC.r, T = DISC.t, g = new THREE.Group();
  if (!steelMat) steelMat = new THREE.MeshStandardMaterial({ color: '#7d8590', metalness: 0.75, roughness: 0.38, envMapIntensity: 0.5 });
  const gv = 0.0012;
  const body = lathe([[0, 0], [R * 0.86, 0], [R * 0.97, 0.0025], [R, 0.006], [R, T - 0.006], [R * 0.97, T - 0.0025], [R * 0.9, T],
    [R * 0.74, T], [R * 0.72, T - gv], [R * 0.7, T], [R * 0.52, T], [R * 0.5, T - gv], [R * 0.48, T], [R * 0.34, T], [R * 0.28, T - 0.004], [R * 0.22, T - 0.0045], [0, T - 0.0045]], 56);
  const m = new THREE.Mesh(body, steelMat); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const col = new THREE.Color(TEAM_COL[side] || TEAM_COL[0]);
  const band = new THREE.Mesh(lathe([[R * 0.68, T], [R * 0.68, T + 0.0016], [R * 0.46, T + 0.0016], [R * 0.46, T]], 40), new THREE.MeshStandardMaterial({ color: col, roughness: 0.38, metalness: 0.25, emissive: col, emissiveIntensity: 0.25 }));
  g.add(band);
  const edge = new THREE.Mesh(lathe([[R * 0.99, T * 0.38], [R * 1.003, T * 0.38], [R * 1.003, T * 0.62], [R * 0.99, T * 0.62]], 56), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2 }));
  g.add(edge);
  g.userData = { side, band, edge };
  return g;
}
export function setDiscSide(d, side) {
  const c = new THREE.Color(TEAM_COL[side] || TEAM_COL[0]);
  for (const k of ['band', 'edge']) { const m = d.userData[k].material; m.color.copy(c); if (m.emissive) m.emissive.copy(c); }
  d.userData.side = side;
}

// ---- a mecha: a folded paper triangle of powder, cream with a red band and a twist of fuse ------------------------------------------
export function makeMecha(seed = 0) {
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: '#f3ead2', roughness: 0.85 });
  const red = new THREE.MeshStandardMaterial({ color: '#cf2a2a', roughness: 0.7 });
  const hw = 0.028, L = 0.062;                                  // a folded triangle of paper, about 5.6 x 6 cm: point outward (+Y)
  const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0.0, L); sh.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0016, bevelSegments: 1 }), paper);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const st = new THREE.Shape(); st.moveTo(-hw * 0.62, L * 0.2); st.lineTo(hw * 0.62, L * 0.2); st.lineTo(hw * 0.34, L * 0.52); st.lineTo(-hw * 0.34, L * 0.52); st.closePath();
  const band = new THREE.Mesh(new THREE.ShapeGeometry(st), red); band.position.z = 0.0092; g.add(band);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.018, 5), new THREE.MeshStandardMaterial({ color: '#2a1b0e', roughness: 1 }));
  fuse.position.set(0.002, L + 0.007, 0.004); g.add(fuse);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb23a' })); ember.position.set(0.002, L + 0.017, 0.004); g.add(ember);
  g.userData.ember = ember; g.rotation.x = 0.0;
  return g;
}

// ---- the clay box ------------------------------------------------------------------------------------------------------------------
export function buildBox(opts = {}) {
  const root = new THREE.Group(); root.name = 'box';
  const { map, bump } = clayTextures();
  const N = opts.low ? 40 : 90;
  const geo = new THREE.PlaneGeometry(1, 1, N, N);
  const p = geo.attributes.position, r = rng(9);
  const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
  for (let i = 0; i < p.count; i++) {      // gentle swells of a hand-packed surface (1.5 mm)
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, 0.0018 * (Math.sin(x * 9 + ph[0]) * Math.cos(y * 7 + ph[1]) + 0.6 * Math.sin(x * 21 + y * 17 + ph[2]) + 0.4 * Math.cos(x * 33 - y * 29 + ph[3])));
  }
  geo.computeVertexNormals();
  const clayMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.9, color: '#ffffff', roughness: 0.92, metalness: 0.0 });
  const clay = new THREE.Mesh(geo, clayMat); clay.receiveShadow = true; clay.name = 'clay'; root.add(clay);
  // frame: heavy timber boards bound in dark steel, with bolts
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(3, '#5a3a1c'), roughness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ color: '#4a525f', metalness: 0.85, roughness: 0.45, envMapIntensity: 1.2 });
  const FW = 0.085, FD = 0.13, half = 0.5 + FW / 2 - 0.004;
  const board = (w, h, x, y) => { const m = new THREE.Mesh(B.roundedBox(w, h, FD, 0.012, 3), wood); m.position.set(x, y, -FD / 2 + 0.012); m.castShadow = true; m.receiveShadow = true; root.add(m); };
  board(1 + FW * 2, FW, 0, half); board(1 + FW * 2, FW, 0, -half); board(FW, 1, -half, 0); board(FW, 1, half, 0);
  const strap = (w, h, x, y) => { const m = new THREE.Mesh(B.roundedBox(w, h, 0.012, 0.003, 2), steel); m.position.set(x, y, 0.014); m.castShadow = true; root.add(m); };
  strap(1 + FW * 2.1, 0.012, 0, half - FW / 2 + 0.008); strap(1 + FW * 2.1, 0.012, 0, -half + FW / 2 - 0.008); strap(0.012, 1.0, -half + FW / 2 - 0.008, 0); strap(0.012, 1.0, half - FW / 2 + 0.008, 0);
  const boltG = new THREE.CylinderGeometry(0.008, 0.008, 0.008, 10); boltG.rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 0, 1]) { const b = new THREE.Mesh(boltG, steel); b.position.set(sx * half, sy * 0.4, 0.022); root.add(b); }
  for (const sy of [-1, 1]) for (const sx of [-1, 0, 1]) { const b = new THREE.Mesh(boltG, steel); b.position.set(sx * 0.4, sy * half, 0.022); root.add(b); }
  // the bocín: a heavy brass ring set flush in the clay; inside, the clay is dark and worn
  const ringC = toLocal(RING.u, RING.v);
  const brass = new THREE.MeshStandardMaterial({ color: '#d1a03a', metalness: 0.75, roughness: 0.36, envMapIntensity: 0.55 });
  const R0 = RING.hole / 100 * 0.98, R1 = RING.outer / 100;
  const ring = new THREE.Mesh(lathe([[R1, -0.008], [R1, 0.012], [R1 - 0.0035, 0.0175], [R0 + 0.0035, 0.0175], [R0, 0.012], [R0, -0.008]], 72), brass);
  ring.position.set(ringC.x, ringC.y, 0); ring.castShadow = true; ring.receiveShadow = true; ring.name = 'ring'; root.add(ring);
  const pit = new THREE.Mesh(new THREE.CircleGeometry(R0, 48), new THREE.MeshStandardMaterial({ color: '#6a2c18', roughness: 1 }));
  pit.position.set(ringC.x, ringC.y, 0.0028); pit.material.polygonOffset = true; pit.material.polygonOffsetFactor = -2; root.add(pit);
  const glowTex = softTexture('255,226,140', 128, 0.1);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(ringC.x, ringC.y, 0.02); glow.name = 'ringGlow'; root.add(glow);
  // the mechas
  const mechas = [];
  for (let i = 0; i < 2; i++) {
    const m = makeMecha(i), q = toLocal(mechaPos(i).u, mechaPos(i).v);
    const aw = ((MECHA.angles[i] - 90) * Math.PI) / 180;           // the pouch points away from the ring centre
    m.position.set(q.x - Math.sin(aw) * 0.0, q.y, 0.0175); m.rotation.z = aw + (i ? 0.12 : -0.1); m.userData.baseZ = 0.0175;
    root.add(m); mechas.push(m);
  }
  const scorch = [];
  for (let i = 0; i < 2; i++) {
    const q = toLocal(mechaPos(i).u, mechaPos(i).v);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ map: softTexture('20,8,4', 64), transparent: true, opacity: 0, depthWrite: false }));
    s.position.set(q.x, q.y, 0.003); root.add(s); scorch.push(s);
  }
  // reference marks scratched into the clay: the throw box edges are not marked; a faint cross at the ring helps the eye
  return { root, clay, ring, glow, mechas, scorch, dentTex: dentTexture() };
}

// ---- village court: pavilion, bunting, lights, crates, lane -------------------------------------------------------------------------
function flagStrip(n, span, sag, colors, seed = 1) {
  const g = new THREE.Group(), r = rng(seed);
  const geo = new THREE.BufferGeometry(); const pos = [], col = [], c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = -span / 2 + t * span, y = -sag * 4 * t * (1 - t), w = span / n * 0.36, h = 0.3 + r() * 0.05;
    c.set(colors[i % colors.length]);
    pos.push(x - w, y, 0, x + w, y, 0, x, y - h, 0.0); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
  g.add(m);
  const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(-span / 2 + t * span, -sag * 4 * t * (1 - t) + 0.01, 0)); }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2a1a0c' })); g.add(line);
  return g;
}

export function buildCourt({ quality = 'high', scenery = true } = {}) {
  const group = new THREE.Group(); group.name = 'court';
  const out = { group, sway: [], bulbs: [], scenery: null };
  if (scenery) {
    try {
      const sc = buildScenery({
        layers: [
          { t: 'sky', id: 'sky-golden' }, { t: 'backdrop', id: 'bd-golden-ridges', mix: ['bd-dusk-meadow'], seed: 3 },
          { t: 'ground', id: 'gr-dust-grass', size: 150, repeat: 34 },
          { t: 'band', id: 'band-hills-green', r: 70, h: 20, arc: [-170, -10] },
          { t: 'band', id: 'band-village-row', r: 22, h: 9, arc: [-170, -10] },
          { t: 'cutouts', id: 'st-wood-house', count: 3, r: [18, 26], scale: [5, 7], seed: 4, arc: [-160, -20] },
          { t: 'cutouts', id: 'tr-round-tree', count: 4, r: [20, 34], scale: [6, 9], seed: 7, sway: 0.4, arc: [-160, -20] },
        ], timeOfDay: 'dusk', quality, clouds: 0.6,
      });
      group.add(sc.group); out.scenery = sc;
    } catch (e) { console.warn('scenery failed', e); }
  }
  // the packed lane
  const d = dirtTexture();
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(10, 30), new THREE.MeshStandardMaterial({ map: d.map, alphaMap: d.alpha, transparent: true, roughness: 1, depthWrite: false }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.004, 12.4); lane.receiveShadow = true; group.add(lane);
  // throwing line: a chalked board
  const chalk = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.07), new THREE.MeshBasicMaterial({ color: '#f1ead8', transparent: true, opacity: 0.8 }));
  chalk.rotation.x = -Math.PI / 2; chalk.position.set(0, 0.008, 0.82); group.add(chalk);
  // timber back wall painted in the three flag bands, with a corrugated roof edge
  const wall = new THREE.Group(); wall.position.set(0, 0, -1.55);
  const bands = ['#e8b81c', '#1f4fb8', '#c8262d'];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.55, 0.08), new THREE.MeshStandardMaterial({ map: plankTexture(bands[i], 20 + i), roughness: 0.85 }));
    m.position.set(0, 0.28 + i * 0.55, 0); m.castShadow = true; m.receiveShadow = true; wall.add(m);
  }
  for (let k = -3; k <= 3; k++) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), new THREE.MeshStandardMaterial({ map: woodTexture(40 + k, '#4a2c14', 64, 256), roughness: 0.85 })); post.position.set(k * 1.25, 1.3, 0.02); post.castShadow = true; wall.add(post); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.06, 2.4), new THREE.MeshStandardMaterial({ color: '#7a8088', metalness: 0.55, roughness: 0.55 }));
  roof.position.set(0, 2.62, 0.7); roof.rotation.x = -0.1; roof.castShadow = true; wall.add(roof);
  group.add(wall);
  // bunting across the court, string lights under the roof
  const flags = ['#f7c600', '#1f4fb8', '#d3272f'];
  for (const [z, y, span, sag] of [[-0.3, 2.35, 5.2, 0.22], [1.2, 2.55, 6.2, 0.28], [-1.2, 2.2, 7.2, 0.18]]) {
    const f = flagStrip(Math.round(span * 3.2), span, sag, flags, z * 10 + 3); f.position.set(0, y, z); f.rotation.z = 0.0; group.add(f); out.sway.push(f);
  }
  const bulbTex = softTexture('255,214,140', 64, 0.05);
  for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12, x = -3.4 + t * 6.8, y = 2.18 - 0.2 * 4 * t * (1 - t);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff0c0' })); b.position.set(x, y, -1.38); group.add(b);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bulbTex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.scale.setScalar(0.5); s.position.set(x, y, -1.34); group.add(s); out.bulbs.push(s);
  }
  // crates (plain, unbranded): stacked at both sides, one used as a seat
  const crateMat = new THREE.MeshStandardMaterial({ map: woodTexture(77, '#7c5a2c', 128, 128), roughness: 0.9 });
  const crate = (x, y, z, ry) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.32), crateMat); box.position.y = 0.15; box.castShadow = true; box.receiveShadow = true; g.add(box);
    for (const s of [-1, 1]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.035, 0.335), new THREE.MeshStandardMaterial({ color: '#3a2412', roughness: 1 })); sl.position.set(0, 0.15 + s * 0.06, 0); g.add(sl); }
    g.position.set(x, y, z); g.rotation.y = ry; return g;
  };
  group.add(crate(-1.75, 0, -0.35, 0.2), crate(-1.78, 0.3, -0.38, -0.1), crate(1.8, 0, -0.3, -0.25));
  // a plank bench for the next thrower
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.3), new THREE.MeshStandardMaterial({ map: woodTexture(88, '#8a6034', 256, 64), roughness: 0.85 })); bench.position.set(1.9, 0.42, 0.9); bench.castShadow = true; group.add(bench);
  for (const s of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.26), crateMat); leg.position.set(1.9 + s, 0.21, 0.9); leg.castShadow = true; group.add(leg); }
  // support legs behind the box
  const legMat = new THREE.MeshStandardMaterial({ map: woodTexture(5, '#4a2c14', 64, 256), roughness: 0.85 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.1), legMat); leg.position.set(s * 0.46, 0.34, -0.5); leg.rotation.x = 0.55; leg.castShadow = true; group.add(leg);
  }
  return out;
}

// ---- the thrower's costume (all simple shapes): ruana (wool poncho), sombrero, linen trousers -----------------------------------------
export function ruanaGeo() {
  // an open poncho: a half cone hanging from the shoulders, split at the front
  const g = new THREE.CylinderGeometry(0.2, 0.46, 0.62, 28, 1, true, 0.35, TAU - 0.7);
  return g;
}
