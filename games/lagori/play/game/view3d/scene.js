// The Lagori street court in 3D: swept dirt ground with chalk, a plastered back wall with arched doorways, low side walls, bunting,
// houses behind, plus the seven stones, the ball and its trail. Display only: the presenter moves the props from the simulation.
import { S, wx, wz, STONE_H, STONE_R0, BALL_R, VIS } from './world.js';
import { STONE_COLORS } from '../src/art.js';
import { stoneR, TOWER, LINE_Y } from '../src/engine.js';

const TAU = Math.PI * 2;
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function canvasTex(THREE, w, h, draw, { repeat = null, aniso = 8, srgb = true } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}

export const COURT_RECT = { x0: 24, y0: 104, x1: 696, y1: 936 };

export function buildScene(stage, THREE, { quality = 'high', V3 = null } = {}) {
  const scene = stage.scene;
  const root = new THREE.Group(); scene.add(root);
  const aniso = quality === 'low' ? 2 : 8;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---- village backdrop: sky, far meadow, a row of houses either side of the lane, trees, lanterns (view3d scenery kit) -------------------------
  let scenery = null;
  scene.background = new THREE.Color(0xf3d6a8);
  scene.fog = new THREE.Fog(0xf1d6ab, 48, 130);
  if (V3 && V3.buildScenery) {
    try {
      scenery = V3.buildScenery({ timeOfDay: 'dusk', quality, culture: 'south-asian', wind: 0.5, radius: 150, layers: [
        { t: 'sky', id: 'sky-day' }, { t: 'backdrop', id: 'bd-meadow-day' },
        { t: 'band', id: 'band-village-row', r: 24, h: 12, arc: [-168, -108] }, { t: 'band', id: 'band-village-row', r: 24, h: 12, arc: [-72, -12] },
        { t: 'band', id: 'band-village-row', r: 38, h: 15, arc: [-130, -50] },
        { t: 'cutouts', id: 'tr-round-tree', count: 5, r: [20, 34], scale: [6, 9], seed: 4, sway: 0.35, arc: [-160, -20] },
      ] });
      root.add(scenery.group);
    } catch (e) { scenery = null; }
  }

  // ---- ground: swept dirt all round ------------------------------------------------------------------------------------------------------
  const dirt = canvasTex(THREE, 512, 512, (g, w, h) => {
    g.fillStyle = '#c98857'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { const dk = hash(i * 5) > 0.5, a = 0.04 + hash(i * 5 + 1) * 0.08; g.fillStyle = dk ? `rgba(96,44,18,${a})` : `rgba(255,226,186,${a * 1.1})`; g.beginPath(); g.ellipse(hash(i * 5 + 2) * w, hash(i * 5 + 3) * h, 1 + hash(i * 5 + 4) * 9, 0.8 + hash(i * 5 + 4) * 3.5, hash(i) * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(64,30,12,${0.25 + hash(i + 900) * 0.3})`; g.beginPath(); g.ellipse(hash(i * 3 + 700) * w, hash(i * 3 + 701) * h, 1.5 + hash(i) * 3, 1 + hash(i + 3) * 2, 0, 0, TAU); g.fill(); }
  }, { repeat: [16, 16], aniso });
  const grassTex = canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#8c9a4a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { const a = 0.08 + hash(i * 5) * 0.2; g.strokeStyle = hash(i * 5 + 1) > 0.5 ? `rgba(60,92,30,${a})` : `rgba(206,196,110,${a})`; g.lineWidth = 1; const x = hash(i * 5 + 2) * w, y = hash(i * 5 + 3) * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i) - 0.5) * 5, y - 3 - hash(i + 4) * 7); g.stroke(); }
  }, { repeat: [60, 60], aniso });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.01; grass.receiveShadow = true; root.add(grass);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(15, 26), new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -1.2); ground.receiveShadow = true; root.add(ground);
  { // the trodden verge: a soft dark edge where the lane meets the grass
    const edge = canvasTex(THREE, 64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5); gr.addColorStop(0, 'rgba(90,50,22,0)'); gr.addColorStop(1, 'rgba(90,50,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { aniso: 1 });
    void edge;
  }

  // ---- the court: a lighter swept rectangle with chalk ----------------------------------------------------------------------------------
  const CR = COURT_RECT, cw = (CR.x1 - CR.x0), ch = (CR.y1 - CR.y0), PXU = 1.5;
  const courtTex = canvasTex(THREE, Math.round(cw * PXU), Math.round(ch * PXU), (g, w, h) => {
    const u = (x) => (x - CR.x0) * PXU, v = (y) => (y - CR.y0) * PXU;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e2a574'); gr.addColorStop(0.5, '#ecb98c'); gr.addColorStop(1, '#dc9c6c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const dk = hash(i * 7) > 0.55, a = 0.03 + hash(i * 7 + 1) * 0.07; g.fillStyle = dk ? `rgba(112,52,24,${a})` : `rgba(255,238,204,${a * 1.2})`; g.beginPath(); g.ellipse(hash(i * 7 + 2) * w, hash(i * 7 + 3) * h, 1 + hash(i * 7 + 4) * 10, 0.7 + hash(i * 7 + 5) * 4, hash(i * 7 + 6) * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(120,60,28,${0.05 + hash(i + 40) * 0.07})`; g.lineWidth = 1 + hash(i + 80) * 2.4; g.beginPath(); const y = hash(i + 120) * h, x = hash(i + 160) * w; g.moveTo(x, y); g.bezierCurveTo(x + 90, y - 20 + hash(i + 200) * 40, x + 190, y + hash(i + 240) * 28 - 14, x + 250 + hash(i + 280) * 120, y + hash(i + 320) * 16 - 8); g.stroke(); }
    // soft darker edge so the court sits on the ground
    const eg = g.createLinearGradient(0, 0, 36, 0); eg.addColorStop(0, 'rgba(70,30,10,0.35)'); eg.addColorStop(1, 'rgba(70,30,10,0)'); g.fillStyle = eg; g.fillRect(0, 0, 36, h);
    const eg2 = g.createLinearGradient(w, 0, w - 36, 0); eg2.addColorStop(0, 'rgba(70,30,10,0.35)'); eg2.addColorStop(1, 'rgba(70,30,10,0)'); g.fillStyle = eg2; g.fillRect(w - 36, 0, 36, h);
    // chalk
    const chalk = (a) => `rgba(255,252,240,${a})`;
    g.lineCap = 'round';
    g.strokeStyle = chalk(0.85); g.lineWidth = 6 * PXU / 1.5; g.beginPath(); g.roundRect(u(44), v(124), (676 - 44) * PXU, (916 - 124) * PXU, 26); g.stroke();
    g.strokeStyle = chalk(0.95); g.lineWidth = 8; g.beginPath(); g.moveTo(u(60), v(LINE_Y + 8)); g.lineTo(u(660), v(LINE_Y + 8)); g.stroke();
    g.strokeStyle = chalk(0.6); g.lineWidth = 4; for (let x = 76; x < 650; x += 38) { g.beginPath(); g.moveTo(u(x), v(LINE_Y + 34)); g.lineTo(u(x + 20), v(LINE_Y + 34)); g.stroke(); }
    // the tower circle (a real circle on the ground)
    g.fillStyle = 'rgba(120,56,24,0.14)'; g.beginPath(); g.arc(u(TOWER.x), v(TOWER.y), 62 * PXU, 0, TAU); g.fill();
    g.strokeStyle = chalk(0.92); g.lineWidth = 6; g.beginPath(); g.arc(u(TOWER.x), v(TOWER.y), 62 * PXU, 0, TAU); g.stroke();
    g.strokeStyle = chalk(0.5); g.lineWidth = 4; g.setLineDash([3, 14]); g.beginPath(); g.arc(u(TOWER.x), v(TOWER.y), 118 * PXU, 0, TAU); g.stroke(); g.setLineDash([]);
    // runners' boxes on the line
    g.strokeStyle = chalk(0.55); g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.roundRect(u(110 + k * 56) - 22 * PXU, v(850) - 20 * PXU, 44 * PXU, 40 * PXU, 8); g.stroke(); }
  }, { aniso });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(cw * S, ch * S), new THREE.MeshStandardMaterial({ map: courtTex, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  court.rotation.x = -Math.PI / 2; court.position.set(wx((CR.x0 + CR.x1) / 2), 0.004, wz((CR.y0 + CR.y1) / 2)); court.receiveShadow = true; root.add(court);

  // ---- the back wall: plaster, brick patches, arched doorways, a shuttered window ---------------------------------------------------------
  const WALL_Z = wz(98), SIDE_X = Math.abs(wx(CR.x0)) + 0.8, WALL_W = 2 * SIDE_X + 7, WALL_H = 2.1;
  const wallTex = canvasTex(THREE, 2048, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6d29c'); gr.addColorStop(1, '#e9a867');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(150,70,30,${0.03 + hash(i * 3) * 0.06})`; g.fillRect(hash(i * 3 + 1) * w, hash(i * 3 + 2) * h, 12 + hash(i) * 70, 2 + hash(i + 5) * 6); }
    // exposed brick patches
    for (const [x, y, ww, hh] of [[140, 250, 190, 150], [1180, 300, 240, 130], [1760, 140, 200, 160]]) {
      g.fillStyle = '#b95a39'; g.fillRect(x, y, ww, hh);
      for (let r = 0; r < hh; r += 16) for (let c = (r / 16) % 2 ? -26 : 0; c < ww; c += 52) { g.fillStyle = `rgba(${150 + hash(r * 9 + c) * 60},${60 + hash(r + c) * 30},${34},0.9)`; g.fillRect(x + Math.max(0, c) + 1, y + r + 1, Math.min(50, ww - Math.max(0, c)) - 2, 14); }
    }
    // painted band at the foot of the wall
    g.fillStyle = '#7a3a24'; g.fillRect(0, h - 74, w, 74); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 78, w, 6);
    const arch = (cx, ww, hh, col, inner) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx - ww / 2, h - 74); g.lineTo(cx - ww / 2, h - 74 - hh + ww / 2); g.arc(cx, h - 74 - hh + ww / 2, ww / 2, Math.PI, 0); g.lineTo(cx + ww / 2, h - 74); g.closePath(); g.fill(); g.fillStyle = inner; g.beginPath(); const i2 = 18; g.moveTo(cx - ww / 2 + i2, h - 74); g.lineTo(cx - ww / 2 + i2, h - 74 - hh + ww / 2 + 4); g.arc(cx, h - 74 - hh + ww / 2 + 4, ww / 2 - i2, Math.PI, 0); g.lineTo(cx + ww / 2 - i2, h - 74); g.closePath(); g.fill(); };
    arch(520, 200, 400, '#7a2e22', '#2f1412'); arch(1530, 200, 400, '#1f6f7a', '#0f2f35');
    // window with shutters
    g.fillStyle = '#6a3a2a'; g.fillRect(990, 150, 150, 130); g.fillStyle = '#ffe9a8'; g.fillRect(1002, 162, 126, 106); g.fillStyle = 'rgba(80,40,20,0.85)'; g.fillRect(1063, 162, 4, 106); g.fillRect(1002, 212, 126, 4);
    g.fillStyle = '#2b7fe0'; g.fillRect(960, 148, 30, 134); g.fillRect(1140, 148, 30, 134);
    // a hand-painted wicket (three stumps) and a chalk circle, as street courts have
    g.strokeStyle = 'rgba(255,252,240,0.8)'; g.lineWidth = 6; for (const x of [1330, 1362, 1394]) { g.beginPath(); g.moveTo(x, h - 80); g.lineTo(x, h - 230); g.stroke(); }
  }, { aniso });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_W, WALL_H, 0.4), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
  wall.position.set(0, WALL_H / 2, WALL_Z - 0.2); wall.castShadow = true; wall.receiveShadow = true; root.add(wall);
  // wall cap
  const cap = new THREE.Mesh(new THREE.BoxGeometry(WALL_W + 0.2, 0.14, 0.6), new THREE.MeshStandardMaterial({ color: 0xc66a3c, roughness: 1 }));
  cap.position.set(0, WALL_H + 0.07, WALL_Z - 0.2); root.add(cap);

  // ---- low side walls ------------------------------------------------------------------------------------------------------------------------
  const sideTex = canvasTex(THREE, 512, 128, (g, w, h) => {
    g.fillStyle = '#e9b27a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(140,66,28,${0.04 + hash(i * 3) * 0.08})`; g.fillRect(hash(i * 3 + 1) * w, hash(i * 3 + 2) * h, 8 + hash(i) * 40, 2 + hash(i + 5) * 5); }
    g.fillStyle = '#8a4a2e'; g.fillRect(0, h - 28, w, 28);
  }, { repeat: [5, 1], aniso });
  const FRONT_Z = wz(982), sideLen = FRONT_Z - WALL_Z;
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.25, sideLen), new THREE.MeshStandardMaterial({ map: sideTex, roughness: 1 }));
    m.position.set(sx * SIDE_X, 0.625, WALL_Z + sideLen / 2); m.castShadow = true; m.receiveShadow = true; root.add(m);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, sideLen), new THREE.MeshStandardMaterial({ color: 0xc66a3c, roughness: 1 }));
    c2.position.set(sx * SIDE_X, 1.3, WALL_Z + sideLen / 2); root.add(c2);
  }
  // the near end of the yard: a low wall with a gate gap, so the court reads as a courtyard from the camera side too
  for (const sx of [-1, 1]) {
    const len = SIDE_X - 1.1, m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.3), new THREE.MeshStandardMaterial({ map: sideTex, roughness: 1 }));
    m.position.set(sx * (1.1 + len / 2), 0.45, FRONT_Z); m.castShadow = true; m.receiveShadow = true; root.add(m);
    const c3 = new THREE.Mesh(new THREE.BoxGeometry(len + 0.16, 0.1, 0.46), new THREE.MeshStandardMaterial({ color: 0xc66a3c, roughness: 1 })); c3.position.set(sx * (1.1 + len / 2), 0.95, FRONT_Z); root.add(c3);
  }

  // ---- a tree beside the wall (the village row comes from the scenery kit) ------------------------------------------------------------------
  // ---- village houses: a row of two-storey facades behind the wall, with tiled eaves, shuttered windows, balconies and flat roofs --------------
  const facade = (i) => canvasTex(THREE, 256, 320, (g, w, h) => {
    const plaster = ['#f2c9a0', '#e8a98a', '#f0dca0', '#c8dcc0', '#e6b8c0', '#b8d0e0', '#efd2a8'][i % 7], trim = ['#7a3a22', '#2d6e78', '#8a2f3a', '#4c5a8a'][i % 4];
    g.fillStyle = plaster; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(110,60,30,${0.03 + hash(k * 3 + i) * 0.06})`; g.fillRect(hash(k * 3 + 1 + i) * w, hash(k * 3 + 2 + i) * h, 6 + hash(k) * 40, 2 + hash(k + 7) * 5); }
    g.fillStyle = 'rgba(70,40,20,0.35)'; g.fillRect(0, h - 30, w, 30);
    g.fillStyle = trim; g.fillRect(0, h * 0.5 - 4, w, 8);      // floor band
    const win = (x, y, ww, hh) => { g.fillStyle = '#3a2418'; g.fillRect(x - 4, y - 4, ww + 8, hh + 8); g.fillStyle = hash(x + y + i) > 0.5 ? '#ffd88a' : '#2a3550'; g.fillRect(x, y, ww, hh); g.fillStyle = 'rgba(40,20,10,0.8)'; g.fillRect(x + ww / 2 - 1.5, y, 3, hh); g.fillRect(x, y + hh * 0.5, ww, 3); g.fillStyle = trim; g.fillRect(x - 16, y - 2, 14, hh + 4); g.fillRect(x + ww + 2, y - 2, 14, hh + 4); g.fillRect(x - 8, y + hh + 4, ww + 16, 6); };
    win(44, 46, 44, 66); win(w - 88, 46, 44, 66);
    win(44, h * 0.5 + 34, 44, 62);
    g.fillStyle = trim; g.beginPath(); g.moveTo(w - 100, h - 30); g.lineTo(w - 100, h * 0.5 + 80); g.arc(w - 72, h * 0.5 + 80, 28, Math.PI, 0); g.lineTo(w - 44, h - 30); g.fill();
    g.fillStyle = '#20120a'; g.beginPath(); g.moveTo(w - 92, h - 30); g.lineTo(w - 92, h * 0.5 + 82); g.arc(w - 72, h * 0.5 + 82, 20, Math.PI, 0); g.lineTo(w - 52, h - 30); g.fill();
    if (i % 3 === 0) { g.fillStyle = '#d6336c'; g.fillRect(24, 24, 18, 3); }
  }, { aniso });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb4522f, roughness: 0.95 }), capMat = new THREE.MeshStandardMaterial({ color: 0xe0c9a0, roughness: 1 });
  const houseCount = 7, hz0 = WALL_Z - 3.5;
  for (let i = 0; i < houseCount; i++) {
    const w = 3.6 + hash(i + 11) * 1.4, h = 4.4 + (i % 3) * 0.7, d = 3.2, x = -10.5 + i * 3.7 + (hash(i) - 0.5) * 0.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [0, 1, 2, 3, 4, 5].map((f) => (f === 4 ? new THREE.MeshStandardMaterial({ map: facade(i), roughness: 1 }) : new THREE.MeshStandardMaterial({ color: 0xe5c49a, roughness: 1 }))));
    body.position.set(x, h / 2, hz0 - 0.2 * hash(i + 5)); body.castShadow = true; body.receiveShadow = true; root.add(body);
    // sloped tiled eave over the front, parapet on the roof
    const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.12, 0.9), roofMat); eave.position.set(x, h * 0.5 + 0.02, body.position.z + d / 2 + 0.35); eave.rotation.x = 0.28; eave.castShadow = true; root.add(eave);
    const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.35, d + 0.1), capMat); par.position.set(x, h + 0.17, body.position.z); root.add(par);
    if (i % 2 === 0) { const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 14), new THREE.MeshStandardMaterial({ color: 0x2a6fb0, roughness: 0.6 })); tank.position.set(x + w * 0.2, h + 0.75, body.position.z); tank.castShadow = true; root.add(tank); }
  }
  // a raised step behind the wall: the neighbours stand here and watch over it
  { const step = new THREE.Mesh(new THREE.BoxGeometry(WALL_W + 3, 0.5, 1.7), new THREE.MeshStandardMaterial({ color: 0xd9a876, roughness: 1 })); step.position.set(0, 0.25, WALL_Z - 1.15); step.receiveShadow = true; root.add(step); }
  // a plank bench at the near end of the yard, where the elders sit and watch the game (seen from behind)
  { const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 }), z = FRONT_Z + 1.5;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.07, 0.5), wood); seat.position.set(0, 0.4, z); seat.castShadow = true; seat.receiveShadow = true; root.add(seat);
    for (const x of [-2.4, 0, 2.4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.4), wood); leg.position.set(x, 0.2, z); leg.castShadow = true; root.add(leg); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 0.06), wood); back.position.set(0, 0.7, z + 0.26); root.add(back); }
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x6a4630, roughness: 1 })); trunk.position.y = 1.7; tree.add(trunk);
  for (const [x, y, z, r, c] of [[0, 4.2, 0, 1.5, 0x3f8f45], [-0.9, 3.7, 0.2, 1.1, 0x4da24f], [0.95, 3.8, -0.1, 1.2, 0x357f3d], [0.1, 5.1, 0.1, 1.0, 0x58b05a]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), new THREE.MeshStandardMaterial({ color: c, roughness: 1 })); l.position.set(x, y, z); l.castShadow = true; tree.add(l); }
  tree.position.set(SIDE_X + 1.6, 0, WALL_Z - 1.7); tree.traverse((o) => { if (o.isMesh) o.castShadow = true; }); root.add(tree);

  // ---- clay pots at the foot of the wall -----------------------------------------------------------------------------------------------
  for (const [x, z, r] of [[-SIDE_X + 0.7, WALL_Z + 0.5, 0.3], [SIDE_X - 0.8, WALL_Z + 0.45, 0.36], [SIDE_X - 0.25, WALL_Z + 0.6, 0.26]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.0, r * 0.7, r * 1.9, 14), new THREE.MeshStandardMaterial({ color: 0xb4522f, roughness: 0.9 })); pot.position.set(x, r * 0.95, z); pot.castShadow = true; root.add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4a9a48, roughness: 1 })); leaf.position.set(x, r * 2.5, z); leaf.scale.y = 0.8; leaf.castShadow = true; root.add(leaf);
  }

  // ---- bunting across the court, in front of the wall -------------------------------------------------------------------------------------
  let flagAnim = () => {};
  {
    const flags = [0xe2412f, 0xf0a31b, 0x2b7fe0, 0x17b394, 0xd6336c, 0x8a46c4];
    const pos = [], col = [], n = 22, x0 = -SIDE_X + 0.1, x1 = SIDE_X - 0.1, y0 = 2.7, sag = 0.5, z = WALL_Z + 0.35;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t0 = (i + 0.2) / n, t1 = (i + 0.8) / n, xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1, ya = y0 - sag * 4 * t0 * (1 - t0), yb = y0 - sag * 4 * t1 * (1 - t1);
      const xm = (xa + xb) / 2, ym = Math.min(ya, yb) - 0.34;
      pos.push(xa, ya, z, xb, yb, z, xm, ym, z, xa, ya, z, xm, ym, z, xb, yb, z);
      c.set(flags[i % flags.length]); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const bunting = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); root.add(bunting);
    // flags hang from the rope and flutter in the evening breeze: the bottom corner of every pennant swings, the rope ends stay put
    const base = Float32Array.from(pos), attr = geo.getAttribute('position');
    flagAnim = (t) => {
      const a = attr.array;
      for (let i = 0; i < n; i++) {
        const o = i * 18 + 6, ph = i * 0.9, sw = Math.sin(t * 1.7 + ph) * 0.07 + Math.sin(t * 3.1 + ph * 2.3) * 0.025;
        a[o] = base[o] + sw; a[o + 2] = base[o + 2] + Math.sin(t * 2.3 + ph) * 0.12; a[o + 1] = base[o + 1] + Math.sin(t * 2.9 + ph) * 0.02;
        a[o + 12] = a[o]; a[o + 14] = a[o + 2]; a[o + 13] = a[o + 1];
      }
      attr.needsUpdate = true;
    };
    const sp = []; for (let i = 0; i <= 24; i++) { const t = i / 24; sp.push(x0 + (x1 - x0) * t, y0 - sag * 4 * t * (1 - t), z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    root.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x4a2a14 })));
  }

  // ---- stones: seven flat, graded river stones (real size: 12 cm down to 7 cm across, 1.7 cm thick; drawn 1.3x) ---------------------------------------
  const stoneGroup = new THREE.Group(); root.add(stoneGroup);
  const stones = [];
  const grain = canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const a = 0.02 + hash(i * 3) * 0.07; g.fillStyle = hash(i * 3 + 1) > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; g.beginPath(); g.arc(hash(i * 3 + 1) * w, hash(i * 3 + 2) * h, 0.5 + hash(i) * 1.4, 0, TAU); g.fill(); }
  }, { aniso: 2 });
  for (let i = 0; i < 7; i++) {
    const r = (STONE_R0 - i * 0.0055) * VIS, t = STONE_H * VIS, [hi, mid, lo] = STONE_COLORS[i];
    // a chiselled edge: rounded shoulder top and bottom (lathe profile), with a painted rim on the top face
    const prof = [[0, -t / 2], [r * 0.9, -t / 2], [r * 0.99, -t * 0.34], [r, -t * 0.08], [r, t * 0.12], [r * 0.95, t * 0.4], [r * 0.82, t / 2], [0, t / 2]];
    const pts = prof.map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(pts, 26); geo.computeVertexNormals();
    const body = new THREE.MeshStandardMaterial({ color: mid, map: grain, roughness: 0.7, metalness: 0.0 });
    const m = new THREE.Mesh(geo, body); m.castShadow = true; m.receiveShadow = true;
    const holder = new THREE.Group(); holder.add(m);
    // a bright painted ring on the top face and a soft coloured pool on the ground, so a 6 cm stone still reads on a phone
    const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.52, r * 0.7, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(hi), transparent: true, opacity: 0.95 }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = t / 2 + 0.0008; holder.add(rim);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(hi), transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    pool.rotation.x = -Math.PI / 2; pool.name = 'pool'; holder.add(pool);
    holder.userData.r = r; holder.userData.pool = pool; stoneGroup.add(holder); stones.push(holder);
  }

  // ---- the ball: a tennis-size rubber ball with a stitched seam; yellow so it reads on the dirt --------------------------------------------------
  const ballTex = canvasTex(THREE, 128, 64, (g, w, h) => {
    g.fillStyle = '#e8d52e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(90,80,0,${0.05 + hash(i) * 0.1})`; g.fillRect(hash(i + 1) * w, hash(i + 2) * h, 1.5, 1.5); }
    g.strokeStyle = 'rgba(255,255,240,0.95)'; g.lineWidth = 3.2; g.beginPath();
    for (let x = 0; x <= w; x += 2) { const y = h * 0.5 + Math.sin(x / w * TAU * 2) * h * 0.26; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  }, { aniso: 4 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * VIS, 22, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.8 }));
  ball.castShadow = true; ball.name = 'ball'; root.add(ball);
  const soft = canvasTex(THREE, 64, 64, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }, { aniso: 1 });
  const trail = [];
  for (let i = 0; i < 30; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, transparent: true, depthWrite: false, color: 0xffffff })); sp.visible = false; sp.renderOrder = 5; root.add(sp); trail.push(sp); }
  // a small dark disc under the ball tells how high it is
  const bShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: 0x2a0c02, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  bShadow.rotation.x = -Math.PI / 2; bShadow.position.y = 0.012; root.add(bShadow);
  // soft contact patches under the stones and people on low quality are handled by the stage's blob shadows

  // ---- the tower mark: a painted ring and a soft warm pool under the stack so a 12 cm tower reads from the whole court ---------------------------------
  const beacon = new THREE.Group(); beacon.position.set(wx(TOWER.x), 0.012, wz(TOWER.y)); root.add(beacon);
  { const pool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 36), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    pool.rotation.x = -Math.PI / 2; beacon.add(pool);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.46, 40), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    ring.rotation.x = -Math.PI / 2; beacon.add(ring); beacon.userData = { pool, ring }; }
  // ---- dust puffs (a knock, a stone landing, a runner's push-off): a pool of soft sprites that rise and fade ------------------------------------
  const dust = [];
  for (let i = 0; i < 40; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, transparent: true, depthWrite: false, color: 0xd9b88c, opacity: 0 })); sp.visible = false; sp.renderOrder = 4; root.add(sp); dust.push({ sp, age: 9, life: 1, v: V(), s0: 0.2, s1: 0.8 }); }
  let dustI = 0;
  const puff = (x, y, z, { n = 6, speed = 0.6, size = 0.5, life = 0.9, up = 0.5 } = {}) => {
    for (let k = 0; k < n; k++) {
      const d = dust[dustI++ % dust.length], a = hash(dustI * 7) * TAU, sp = speed * (0.4 + hash(dustI * 3));
      d.age = 0; d.life = life * (0.7 + hash(dustI * 5) * 0.6); d.v.set(Math.cos(a) * sp, up * (0.3 + hash(dustI)), Math.sin(a) * sp); d.s0 = size * 0.4; d.s1 = size * (0.9 + hash(dustI * 11));
      d.sp.position.set(x, y, z); d.sp.visible = true;
    }
  };
  const update = (dt, t) => {
    flagAnim(t);
    { const k = 1 + Math.sin(t * 3.2) * 0.06; beacon.scale.set(k, 1, k); }
    if (scenery) scenery.update(dt, stage.camera);
    for (const d of dust) {
      if (d.age >= d.life) { if (d.sp.visible) { d.sp.visible = false; } continue; }
      d.age += dt; const u = Math.min(1, d.age / d.life);
      d.sp.position.addScaledVector(d.v, dt); d.v.multiplyScalar(Math.exp(-dt * 2.2));
      const sc = d.s0 + (d.s1 - d.s0) * Math.sqrt(u); d.sp.scale.set(sc, sc, 1); d.sp.material.opacity = 0.55 * (1 - u) * Math.min(1, u * 8);
    }
  };

  return { root, stones, stoneGroup, ball, trail, bShadow, soft, V, wall, scenery, beacon, puff, update, SIDE_X, WALL_Z, FRONT_Z };
}
