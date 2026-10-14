// The zurkhaneh room: a sunken octagonal pit of raked clay, a raised step and brick walls with tiled panels and pointed niches, hanging
// lamps, and the dark tiled hall around it. Everything is procedural (canvas textures, primitives): no image files.
// The camera is a cut-away view: the wall nearest the viewer is not drawn (its faces point away from the camera).
import { THREE } from '../vendor3d/index.js';
import { CAM } from '../src/cam.js';

const T = THREE;
export const RW = CAM.rw;                       // metres that the layout's pit.R stands for
export const FLOOR_R = 0.8 * RW, STEP_R = 0.95 * RW, STEP_Y = 0.38, WALL_Y = 2.45, DAIS_R = 0.25 * RW, DAIS_Y = 0.42;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function canvasTex(w, h, draw, { repeat = false, aniso = 4 } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
  return t;
}

// Eight-point star tile motif used on the dado and the hall floor.
function tile(g, x, y, s, base, line, star) {
  g.fillStyle = base; g.fillRect(x, y, s, s);
  g.strokeStyle = line; g.lineWidth = Math.max(1, s * 0.05); g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  const cx = x + s / 2, cy = y + s / 2;
  g.beginPath();
  for (let k = 0; k < 16; k++) { const r = k % 2 ? s * 0.17 : s * 0.4, a = (k * Math.PI) / 8 - Math.PI / 2; k ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.closePath(); g.fillStyle = star; g.fill(); g.stroke();
}

function floorTexture() {
  return canvasTex(1024, 1024, (g, W) => {
    const c = W / 2, F = W / 2;                                  // circumradius of the octagon = half the canvas
    const gr = g.createRadialGradient(c - F * 0.1, c - F * 0.15, F * 0.05, c, c, F);
    gr.addColorStop(0, '#f1c78f'); gr.addColorStop(0.55, '#dca86c'); gr.addColorStop(1, '#a8683c');
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
    const r = rng(11);
    // raked clay: faint concentric arcs and speckle
    g.strokeStyle = 'rgba(110,60,25,0.10)'; g.lineWidth = 2;
    for (let i = 0; i < 46; i++) { g.beginPath(); g.arc(c + (r() - 0.5) * 60, c + (r() - 0.5) * 60, 60 + i * 9.5, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 6000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,230,180,0.10)' : 'rgba(90,45,15,0.10)'; g.fillRect(r() * W, r() * W, 1 + r() * 2.5, 1 + r() * 2.5); }
    // star lines from the dais to the wall, as in the painted pit
    g.strokeStyle = 'rgba(90,46,20,0.35)'; g.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; g.beginPath(); g.moveTo(c + Math.cos(a) * F * 0.34, c + Math.sin(a) * F * 0.34); g.lineTo(c + Math.cos(a) * F * 0.97, c + Math.sin(a) * F * 0.97); g.stroke(); }
    const oct = (rad, rot) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = rot + (i * Math.PI) / 4; const x = c + Math.cos(a) * rad, y = c + Math.sin(a) * rad; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    g.strokeStyle = 'rgba(23,128,111,0.95)'; g.lineWidth = 10; oct(F * 0.7, Math.PI / 8); g.stroke();
    g.strokeStyle = 'rgba(246,234,210,0.45)'; g.lineWidth = 4; oct(F * 0.75, Math.PI / 8); g.stroke();
  }, { aniso: 8 });
}

function wallTexture() {
  const P = 256, H = 512;
  return canvasTex(P * 8, H, (g, W) => {
    const r = rng(7);
    for (let p = 0; p < 8; p++) {
      const x0 = p * P;
      // brick field
      g.fillStyle = '#6b3d28'; g.fillRect(x0, 0, P, H);
      for (let row = 0; row < 24; row++) {
        const y = 70 + row * 12, off = row % 2 ? 0 : 18;
        for (let b = -1; b < 8; b++) { const x = x0 + b * 36 + off; const k = 0.82 + r() * 0.3; g.fillStyle = `rgb(${Math.round(150 * k)},${Math.round(84 * k)},${Math.round(52 * k)})`; g.fillRect(Math.max(x0, x), y, Math.min(34, x0 + P - Math.max(x0, x)), 10); }
      }
      // frieze: pale plaster with a row of small pointed arches
      const fg = g.createLinearGradient(0, 0, 0, 70); fg.addColorStop(0, '#d9c8a2'); fg.addColorStop(1, '#bfa77c');
      g.fillStyle = fg; g.fillRect(x0, 0, P, 70);
      g.fillStyle = '#35d0c0'; g.fillRect(x0, 62, P, 8);
      g.fillStyle = '#a8742a'; g.fillRect(x0, 58, P, 4);
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 3;
      for (let k = 0; k < 4; k++) { const ax = x0 + 32 + k * 64; g.beginPath(); g.moveTo(ax - 18, 52); g.lineTo(ax - 18, 30); g.quadraticCurveTo(ax - 14, 12, ax, 8); g.quadraticCurveTo(ax + 14, 12, ax + 18, 30); g.lineTo(ax + 18, 52); g.stroke(); }
      // tall pointed niche with a lapis-tiled back
      const cx = x0 + P / 2, top = 108, bot = 352, hw = 62;
      g.save(); g.beginPath(); g.moveTo(cx - hw, bot); g.lineTo(cx - hw, top + 70); g.quadraticCurveTo(cx - hw, top + 22, cx, top); g.quadraticCurveTo(cx + hw, top + 22, cx + hw, top + 70); g.lineTo(cx + hw, bot); g.closePath(); g.clip();
      const ng = g.createLinearGradient(0, top, 0, bot); ng.addColorStop(0, '#1d3f9a'); ng.addColorStop(1, '#0c1d52');
      g.fillStyle = ng; g.fillRect(cx - hw, top, hw * 2, bot - top);
      g.strokeStyle = 'rgba(138,164,255,0.5)'; g.lineWidth = 2;
      for (let yy = top; yy < bot; yy += 26) for (let xx = cx - hw; xx < cx + hw; xx += 26) { g.strokeRect(xx + 0.5, yy + 0.5, 26, 26); g.beginPath(); g.moveTo(xx, yy + 13); g.lineTo(xx + 13, yy); g.lineTo(xx + 26, yy + 13); g.lineTo(xx + 13, yy + 26); g.closePath(); g.stroke(); }
      g.restore();
      g.strokeStyle = '#e8c88a'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(cx - hw, bot); g.lineTo(cx - hw, top + 70); g.quadraticCurveTo(cx - hw, top + 22, cx, top); g.quadraticCurveTo(cx + hw, top + 22, cx + hw, top + 70); g.lineTo(cx + hw, bot); g.stroke();
      // gold trim and the tiled dado
      g.fillStyle = '#c9942e'; g.fillRect(x0, 352, P, 10);
      for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 8; tx++) tile(g, x0 + tx * 32, 362 + ty * 37.5, tx % 2 ^ ty % 2 ? 32 : 32, (tx + ty) % 2 ? '#1f8f86' : '#e9f3ee', '#0e4d4a', (tx + ty) % 2 ? '#e9f3ee' : '#2f5fc4');
      g.fillStyle = 'rgba(0,0,0,0.0)';
      // panel edge shading so the eight faces read as an octagon
      const eg = g.createLinearGradient(x0, 0, x0 + P, 0); eg.addColorStop(0, 'rgba(0,0,0,0.28)'); eg.addColorStop(0.12, 'rgba(0,0,0,0)'); eg.addColorStop(0.88, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,0.28)');
      g.fillStyle = eg; g.fillRect(x0, 0, P, H);
    }
    void W;
  }, { aniso: 8 });
}

function stepWallTexture() {
  return canvasTex(1024, 128, (g, W, H) => {
    const r = rng(3);
    g.fillStyle = '#5a2e1c'; g.fillRect(0, 0, W, H);
    for (let row = 0; row < 8; row++) for (let b = -1; b < 30; b++) { const x = b * 36 + (row % 2 ? 0 : 18), k = 0.8 + r() * 0.3; g.fillStyle = `rgb(${Math.round(140 * k)},${Math.round(78 * k)},${Math.round(48 * k)})`; g.fillRect(x, row * 16, 34, 14); }
  });
}

function hallTexture() {
  return canvasTex(512, 512, (g, W) => {
    g.fillStyle = '#0b1a20'; g.fillRect(0, 0, W, W);
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) tile(g, tx * 128, ty * 128, 128, (tx + ty) % 2 ? '#10303a' : '#0d2830', 'rgba(53,208,192,0.28)', (tx + ty) % 2 ? 'rgba(53,208,192,0.14)' : 'rgba(138,164,255,0.12)');
  }, { repeat: true, aniso: 4 });
}

function glowTexture() {
  return canvasTex(64, 64, (g, W) => { const gr = g.createRadialGradient(W / 2, W / 2, 1, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,225,150,0.95)'); gr.addColorStop(0.35, 'rgba(255,190,90,0.35)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); });
}

function grainTexture(a, b) {
  return canvasTex(256, 256, (g, W) => {
    g.fillStyle = a; g.fillRect(0, 0, W, W); const r = rng(5);
    for (let i = 0; i < 90; i++) { g.strokeStyle = r() > 0.5 ? b : 'rgba(255,240,200,0.18)'; g.globalAlpha = 0.18 + r() * 0.3; g.lineWidth = 1 + r() * 2.2; const y = r() * W; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 14, W * 0.6, y + (r() - 0.5) * 14, W, y + (r() - 0.5) * 8); g.stroke(); }
    g.globalAlpha = 1;
  }, { repeat: true });
}
function rugTexture() {
  return canvasTex(512, 512, (g, W) => {
    g.fillStyle = '#7a1c1c'; g.fillRect(0, 0, W, W); const c = W / 2;
    g.strokeStyle = '#e8c88a'; g.lineWidth = 8; g.strokeRect(14, 14, W - 28, W - 28);
    g.strokeStyle = '#1d3f9a'; g.lineWidth = 14; g.strokeRect(34, 34, W - 68, W - 68);
    g.fillStyle = '#1d3f9a'; g.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 60 : 150, a = (k * Math.PI) / 8; k ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = '#e8c88a'; g.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 26 : 84, a = (k * Math.PI) / 8 + Math.PI / 16; k ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fill();
    const r = rng(9); for (let i = 0; i < 2500; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,230,180,0.08)' : 'rgba(0,0,0,0.12)'; g.fillRect(r() * W, r() * W, 2, 2); }
  });
}
function domeTexture() {
  return canvasTex(1024, 256, (g, W, H) => {
    const bg = g.createLinearGradient(0, H, 0, 0); bg.addColorStop(0, '#0f3f8a'); bg.addColorStop(1, '#0a2a5c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let row = 0; row < 8; row++) for (let i = 0; i < 48; i++) {
      const x = i * (W / 48) + (row % 2 ? W / 96 : 0), y = H - (row + 0.5) * (H / 8), s = H / 8 * 0.46;
      g.fillStyle = (i + row) % 2 ? '#1f8f86' : '#e9f3ee'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.8, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.8, y); g.closePath(); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(232,200,138,0.55)'; g.lineWidth = 1.5; g.stroke();
    }
    g.strokeStyle = '#e8c88a'; g.lineWidth = 4; for (let k = 0; k < 24; k++) { const x = (k * W) / 24; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
  });
}
function shaftTexture() {
  return canvasTex(8, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,236,180,0.0)'); gr.addColorStop(0.15, 'rgba(255,230,160,0.14)'); gr.addColorStop(1, 'rgba(255,214,130,0.02)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
}

export function buildRoom({ quality = 'high' } = {}) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x0a161c);
  const rot = Math.PI / 8;                                        // vertices off the +Z axis: a flat edge faces the viewer
  const lit = (o) => { o.receiveShadow = quality !== 'low'; return o; };
  const R = {};

  // pit floor
  const floorM = new T.MeshStandardMaterial({ map: floorTexture(), roughness: 0.92, metalness: 0 });
  const floorG = new T.CircleGeometry(FLOOR_R, 8, rot); floorG.rotateX(-Math.PI / 2);
  R.floor = lit(new T.Mesh(floorG, floorM));
  // sunken side (from the pit floor up to the step), seen from inside only
  const sideM = new T.MeshStandardMaterial({ map: stepWallTexture(), roughness: 0.95, side: T.BackSide });
  const sideG = new T.CylinderGeometry(FLOOR_R, FLOOR_R, STEP_Y, 8, 1, true, rot); sideG.translate(0, STEP_Y / 2, 0);
  const side = lit(new T.Mesh(sideG, sideM));
  // the step: a flat octagonal ring in warm wood, with a darker lip
  const stepG = new T.RingGeometry(FLOOR_R, STEP_R, 8, 1, rot); stepG.rotateX(-Math.PI / 2); stepG.translate(0, STEP_Y, 0);
  const stepM = new T.MeshStandardMaterial({ color: 0xb0794a, roughness: 0.8 });
  const step = lit(new T.Mesh(stepG, stepM));
  const lipG = new T.RingGeometry(FLOOR_R, FLOOR_R + 0.07, 8, 1, rot); lipG.rotateX(-Math.PI / 2); lipG.translate(0, STEP_Y + 0.004, 0);
  const lip = new T.Mesh(lipG, new T.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.7 }));
  // walls (brick, niches, tiled dado), inside faces only
  const wallM = new T.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9, side: T.BackSide });
  const wallG = new T.CylinderGeometry(STEP_R, STEP_R, WALL_Y - STEP_Y, 8, 1, true, rot); wallG.translate(0, STEP_Y + (WALL_Y - STEP_Y) / 2, 0);
  const wall = lit(new T.Mesh(wallG, wallM));
  // the hall around (with the octagonal hole where the pit is)
  const ht = hallTexture(); ht.repeat.set(30, 30);
  const hallG = new T.RingGeometry(STEP_R - 0.02, 60, 8, 1, rot); hallG.rotateX(-Math.PI / 2); hallG.translate(0, STEP_Y, 0);
  const hallUV = hallG.attributes.uv, hp = hallG.attributes.position;
  for (let i = 0; i < hallUV.count; i++) hallUV.setXY(i, hp.getX(i) / 4, hp.getZ(i) / 4);
  ht.repeat.set(1, 1);
  const hall = lit(new T.Mesh(hallG, new T.MeshStandardMaterial({ map: ht, roughness: 0.95, color: 0x8a9a9a })));
  scene.add(R.floor, side, step, lip, wall, hall);

  // the morshed's platform (sardam): a raised octagonal wooden dais with a woven rug, brass trim and a low step
  const dais = new T.Group();
  const rugM = new T.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 });
  const woodM = new T.MeshStandardMaterial({ map: grainTexture('#8a5528', '#5a3418'), roughness: 0.55 });
  const dBody = new T.Mesh(new T.CylinderGeometry(DAIS_R, DAIS_R * 1.08, DAIS_Y - 0.03, 8, 1, false, rot), woodM);
  dBody.position.y = (DAIS_Y - 0.03) / 2; dBody.castShadow = quality !== 'low'; dBody.receiveShadow = quality !== 'low';
  const rug = new T.Mesh(new T.CircleGeometry(DAIS_R * 0.9, 8, rot), rugM); rug.rotation.x = -Math.PI / 2; rug.position.y = DAIS_Y - 0.026; rug.receiveShadow = quality !== 'low';
  rug.rotation.z = 0;
  const brassM = new T.MeshStandardMaterial({ color: 0xd9a73a, roughness: 0.3, metalness: 0.85 });
  const dRing = new T.Mesh(new T.TorusGeometry(DAIS_R * 0.94, 0.018, 8, 8), brassM);
  dRing.rotation.set(Math.PI / 2, 0, rot); dRing.position.y = DAIS_Y - 0.02;
  const step1 = new T.Mesh(new T.CylinderGeometry(DAIS_R * 1.22, DAIS_R * 1.24, 0.1, 8, 1, false, rot), woodM); step1.position.y = 0.05; step1.receiveShadow = quality !== 'low';
  dais.add(step1, dBody, rug, dRing);
  scene.add(dais);

  // lamps at the eight wall corners, hanging a little way down from the frieze
  const glow = new T.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const lampM = new T.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa83a, emissiveIntensity: 1.4, roughness: 0.4 });
  R.lamps = [];
  for (let k = 0; k < 8; k++) {
    const a = rot + (k * Math.PI) / 4, x = Math.cos(a) * (STEP_R - 0.18), z = Math.sin(a) * (STEP_R - 0.18);
    const lamp = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 0.22, 10), lampM); lamp.position.set(x, WALL_Y - 0.55, -z * -1);
    // CylinderGeometry azimuth: three uses x = sin(theta), z = cos(theta); the wall vertex k sits at theta = rot + k*pi/4
    const th = rot + (k * Math.PI) / 4; lamp.position.set(Math.sin(th) * (STEP_R - 0.16), WALL_Y - 0.55, Math.cos(th) * (STEP_R - 0.16));
    const sp = new T.Sprite(glow); sp.scale.set(0.9, 0.9, 1); sp.position.copy(lamp.position);
    const chain = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.5, 4), new T.MeshStandardMaterial({ color: 0x3a2a1a })); chain.position.set(lamp.position.x, lamp.position.y + 0.36, lamp.position.z);
    scene.add(lamp, sp, chain); R.lamps.push(sp);
  }

  // pulse and inlay rings (additive, on the floor)
  const pulse = new T.Mesh(new T.RingGeometry(0.96, 1.0, 72), new T.MeshBasicMaterial({ color: 0xf4b942, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.012; scene.add(pulse); R.pulse = pulse;
  const inlay = new T.Mesh(new T.RingGeometry(0.7 * FLOOR_R - 0.05, 0.7 * FLOOR_R + 0.05, 8, 1, rot), new T.MeshBasicMaterial({ color: 0x35d0c0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.014; scene.add(inlay); R.inlay = inlay;

  // ---- premium hall: pilasters, pointed arch frames, muqarnas corbels, cornice, tiled half-dome with an oculus and a light shaft ----
  const goldM = new T.MeshStandardMaterial({ color: 0xd9a73a, roughness: 0.32, metalness: 0.8, emissive: 0x2a1a04 });
  const tileM = new T.MeshStandardMaterial({ color: 0x1f8f86, roughness: 0.35, metalness: 0.1 });
  const apo = STEP_R * Math.cos(Math.PI / 8);
  const arch = (hw, hs, H, d) => {
    const sh = new T.Shape(); sh.moveTo(-hw, 0); sh.lineTo(-hw, hs); sh.quadraticCurveTo(-hw, hs + (H - hs) * 0.62, 0, H); sh.quadraticCurveTo(hw, hs + (H - hs) * 0.62, hw, hs); sh.lineTo(hw, 0); sh.lineTo(hw - 0.07, 0); sh.lineTo(hw - 0.07, hs);
    sh.quadraticCurveTo(hw - 0.07, hs + (H - 0.07 - hs) * 0.62, 0, H - 0.09); sh.quadraticCurveTo(-hw + 0.07, hs + (H - 0.07 - hs) * 0.62, -hw + 0.07, hs); sh.lineTo(-hw + 0.07, 0); sh.closePath();
    return new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
  };
  const archG = arch(0.6, 0.55, 1.08, 0.07);
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4;                                   // face centres sit at multiples of 45 degrees
    if (Math.cos(th) > 0.1) continue;                               // the near walls are cut away
    const a = new T.Mesh(archG, goldM); a.position.set(Math.sin(th) * (apo - 0.07), STEP_Y + 2.07 - 1.42 - 0.02, Math.cos(th) * (apo - 0.07)); a.rotation.y = th + Math.PI;
    scene.add(a);
    for (let c = -2; c <= 2; c++) {                                 // muqarnas corbels under the cornice
      const w = 0.32, off = c * 0.42, bx = Math.sin(th) * (apo - 0.1) + Math.cos(th) * off, bz = Math.cos(th) * (apo - 0.1) - Math.sin(th) * off;
      const m = new T.Mesh(new T.BoxGeometry(w, 0.16, 0.14), c % 2 ? tileM : goldM); m.position.set(bx, WALL_Y - 0.28, bz); m.rotation.y = th + Math.PI; scene.add(m);
      const m2 = new T.Mesh(new T.BoxGeometry(w * 0.7, 0.12, 0.1), c % 2 ? goldM : tileM); m2.position.set(bx, WALL_Y - 0.42, bz); m2.rotation.y = th + Math.PI; scene.add(m2);
    }
  }
  for (let k = 0; k < 8; k++) {                                     // corner pilasters with base and capital
    const th = rot + (k * Math.PI) / 4, x = Math.sin(th) * (STEP_R - 0.08), z = Math.cos(th) * (STEP_R - 0.08);
    if (Math.cos(th) > 0.5) continue;
    const col = new T.Mesh(new T.CylinderGeometry(0.085, 0.1, WALL_Y - STEP_Y, 12), new T.MeshStandardMaterial({ map: grainTexture('#e6d3a8', '#c9b080'), roughness: 0.6 }));
    col.position.set(x, STEP_Y + (WALL_Y - STEP_Y) / 2, z); col.castShadow = quality !== 'low';
    const cap = new T.Mesh(new T.CylinderGeometry(0.15, 0.09, 0.14, 12), goldM); cap.position.set(x, WALL_Y - 0.12, z);
    const bas = new T.Mesh(new T.CylinderGeometry(0.11, 0.14, 0.12, 12), goldM); bas.position.set(x, STEP_Y + 0.06, z);
    scene.add(col, cap, bas);
  }
  const corn = new T.Mesh(new T.CylinderGeometry(STEP_R - 0.03, STEP_R - 0.03, 0.2, 8, 1, true, rot), new T.MeshStandardMaterial({ color: 0x1b6fb0, roughness: 0.4, side: T.BackSide, emissive: 0x06182a }));
  corn.position.y = WALL_Y + 0.1; scene.add(corn);
  const lip2 = new T.Mesh(new T.CylinderGeometry(STEP_R - 0.01, STEP_R - 0.01, 0.07, 8, 1, true, rot), new T.MeshStandardMaterial({ color: 0xd9a73a, roughness: 0.3, metalness: 0.8, side: T.BackSide })); lip2.position.y = WALL_Y + 0.22; scene.add(lip2);
  // half-dome behind the far wall (the near half is open to the camera)
  const domeR = STEP_R + 0.02;
  const domeG = new T.SphereGeometry(domeR, 48, 20, Math.PI - 0.3, Math.PI + 0.6, 0, Math.PI / 2);
  const dome = new T.Mesh(domeG, new T.MeshStandardMaterial({ map: domeTexture(), roughness: 0.5, side: T.BackSide, emissive: 0x0a2230, emissiveMap: null }));
  dome.position.y = WALL_Y + 0.2; dome.scale.set(1, 0.95, 1); scene.add(dome);
  const oculus = new T.Mesh(new T.CircleGeometry(0.55, 24), new T.MeshBasicMaterial({ color: 0xfff1c8 })); oculus.rotation.x = Math.PI / 2; oculus.position.set(0, WALL_Y + 0.2 + domeR * 0.95 - 0.03, 0); scene.add(oculus);
  // the light shaft from the oculus, faint, with dust turning in it (dust itself is animated by the presenter)
  const shaft = new T.Mesh(new T.CylinderGeometry(0.6, 1.9, WALL_Y + 0.2 + domeR * 0.95, 20, 1, true), new T.MeshBasicMaterial({ map: shaftTexture(), transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  shaft.position.y = (WALL_Y + 0.2 + domeR * 0.95) / 2; scene.add(shaft); R.shaft = shaft;
  // a bench of old planks all round the step, where the spectators sit
  const benchM = new T.MeshStandardMaterial({ map: grainTexture('#8a5a2e', '#5a381a'), roughness: 0.7 });
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4, r = FLOOR_R + 0.27, w = 2 * r * Math.tan(Math.PI / 8) * 1.0;
    if (Math.cos(th) > 0.5) continue;
    const b = new T.Mesh(new T.BoxGeometry(w, 0.34, 0.34), benchM); b.position.set(Math.sin(th) * r, STEP_Y + 0.17, Math.cos(th) * r); b.rotation.y = th; b.castShadow = quality !== 'low'; b.receiveShadow = quality !== 'low'; scene.add(b);
  }
  R.goldM = goldM;

  // lights
  const hemi = new T.HemisphereLight(0xfff0d8, 0x4a3420, 0.95); scene.add(hemi);
  const key = new T.DirectionalLight(0xffedd0, 2.1); key.position.set(-3.5, 8.5, 5.5); key.target.position.set(0, 0, 0);
  if (quality !== 'low') {
    key.castShadow = true; key.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    const sc = key.shadow.camera; sc.left = -4.6; sc.right = 4.6; sc.top = 4.6; sc.bottom = -4.6; sc.near = 1; sc.far = 24; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  }
  scene.add(key, key.target);
  const fill = new T.DirectionalLight(0x9cb4ff, 0.55); fill.position.set(5, 4, -3); scene.add(fill);
  R.floorR = FLOOR_R; R.stepY = STEP_Y;
  R.scene = scene; R.key = key; R.hemi = hemi; R.dais = dais;
  return R;
}
