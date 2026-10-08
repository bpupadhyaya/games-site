// The 3D arena: floor, barriers, crowd backdrop, table, net, ball, paddles, arms, particles. Pure presentation: it only READS the
// state the game publishes (state.v3) and never writes back. Units are metres, the same as the simulation.
import { THREE } from '../vendor3d/index.js';

const T = THREE;
const doc = globalThis.document;
const mk = (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, { repeat = false, aniso = 4 } = {}) => {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
  return t;
};
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---- textures -----------------------------------------------------------------------------------------------------------
function tableTexture() {
  const [c, g] = mk(1024, 1840);                       // 670 px per metre
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, '#0f4aa8'); grd.addColorStop(0.5, '#0c3f94'); grd.addColorStop(1, '#0f4aa8');
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  // faint lacquer grain
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${rand() * 0.035})`; g.fillRect(rand() * c.width, rand() * c.height, 1 + rand() * 40, 1); }
  g.strokeStyle = '#f4f8ff'; g.lineWidth = 14; g.strokeRect(7, 7, c.width - 14, c.height - 14);
  g.lineWidth = 6; g.beginPath(); g.moveTo(c.width / 2, 10); g.lineTo(c.width / 2, c.height - 10); g.stroke();
  return tex(c, { aniso: 8 });
}
function floorTexture() {
  const [c, g] = mk(1024, 1024);
  g.fillStyle = '#1b3550'; g.fillRect(0, 0, 1024, 1024);
  const r = g.createRadialGradient(512, 512, 40, 512, 512, 560);
  r.addColorStop(0, 'rgba(120,190,230,0.55)'); r.addColorStop(0.5, 'rgba(60,120,170,0.22)'); r.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = r; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.012 + rand() * 0.02})`; g.fillRect(0, i * 11.5, 1024, 2); }
  g.strokeStyle = 'rgba(235,245,255,0.7)'; g.lineWidth = 6; g.strokeRect(150, 70, 724, 884);       // court rectangle
  return tex(c);
}
function netTexture() {
  const [c, g] = mk(512, 64);
  g.clearRect(0, 0, 512, 64);
  g.strokeStyle = 'rgba(235,240,250,0.7)'; g.lineWidth = 1.4;
  for (let x = 0; x <= 512; x += 6) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 64); g.stroke(); }
  for (let y = 8; y <= 64; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.fillStyle = '#f7f9ff'; g.fillRect(0, 0, 512, 9);
  return tex(c);
}
function ballTexture() {
  const [c, g] = mk(256, 128);
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ff7a1a'; g.fillRect(0, 58, 256, 12);                                  // equator band
  g.fillStyle = '#1c2b4a';
  for (const x of [32, 96, 160, 224]) { g.beginPath(); g.arc(x, 30, 9, 0, 6.3); g.fill(); g.beginPath(); g.arc(x + 32, 98, 9, 0, 6.3); g.fill(); }
  return tex(c);
}
function rubberTexture(base, dot) {
  const [c, g] = mk(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) { g.fillStyle = dot; g.globalAlpha = 0.25 + rand() * 0.35; g.beginPath(); g.arc(rand() * 256, rand() * 256, 1 + rand() * 1.5, 0, 6.3); g.fill(); }
  g.globalAlpha = 1;
  return tex(c);
}
function crowdTexture() {
  const [c, g] = mk(2048, 640);
  const bg = g.createLinearGradient(0, 0, 0, 640);
  bg.addColorStop(0, '#05080f'); bg.addColorStop(0.55, '#0b1424'); bg.addColorStop(1, '#13233a');
  g.fillStyle = bg; g.fillRect(0, 0, 2048, 640);
  // bokeh lights
  for (let i = 0; i < 70; i++) {
    const x = rand() * 2048, y = 20 + rand() * 280, r = 10 + rand() * 38, h = [200, 190, 45, 330, 260][Math.floor(rand() * 5)];
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, hsl(h, 80, 70, 0.55)); rg.addColorStop(1, hsl(h, 80, 60, 0));
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // crowd rows: soft, muted, out-of-focus
  for (let row = 0; row < 8; row++) {
    const y = 300 + row * 40, sz = 11 + row * 2.6;
    for (let x = -20; x < 2080; x += sz * 1.7) {
      const px = x + rand() * 8, py = y + rand() * 6, h = [215, 225, 200, 25, 350, 160][Math.floor(rand() * 6)], lit = 10 + row * 1.6 + rand() * 6;
      g.fillStyle = hsl(h, 22, lit); g.beginPath(); g.ellipse(px, py + sz * 0.95, sz * 0.72, sz * 0.8, 0, 0, 6.3); g.fill();
      g.fillStyle = hsl(24 + rand() * 12, 22, 20 + row * 1.8 + rand() * 6); g.beginPath(); g.arc(px, py, sz * 0.4, 0, 6.3); g.fill();
      if (rand() < 0.012) { const rg = g.createRadialGradient(px, py - sz, 0, px, py - sz, sz * 1.2); rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(px - sz * 1.3, py - sz * 2.3, sz * 2.6, sz * 2.6); }
    }
    g.fillStyle = `rgba(6,12,24,${0.22 + row * 0.02})`; g.fillRect(0, y - 24, 2048, 4);
  }
  const fade = g.createLinearGradient(0, 300, 0, 660); fade.addColorStop(0, 'rgba(5,10,20,0.62)'); fade.addColorStop(1, 'rgba(5,10,20,0.28)');
  g.fillStyle = fade; g.fillRect(0, 300, 2048, 360);
  return tex(c);
}
function boardTexture(hue) {
  const [c, g] = mk(2048, 160);
  const bg = g.createLinearGradient(0, 0, 0, 160);
  bg.addColorStop(0, hsl(hue, 70, 24)); bg.addColorStop(1, hsl(hue, 75, 14)); g.fillStyle = bg; g.fillRect(0, 0, 2048, 160);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 2048, 6);
  g.font = '800 38px system-ui, sans-serif'; g.textBaseline = 'middle';
  const words = ['TABLE TENNIS RALLY', 'ARCFORGE', 'WORLD HERITAGE GAMES'];
  let x = 20, i = 0;
  while (x < 2048) { const s = words[i++ % 3]; g.fillStyle = i % 3 === 2 ? hsl(hue + 40, 80, 72) : 'rgba(235,245,255,0.92)'; g.fillText(s, x, 84); x += g.measureText(s).width + 90; g.fillStyle = hsl(hue, 80, 60); g.fillRect(x - 70, 74, 28, 12); }
  return tex(c);
}
function glowTexture() {
  const [c, g] = mk(64, 64);
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return tex(c);
}

// ---- the arena -----------------------------------------------------------------------------------------------------------
export function buildArena(renderer, quality = 'high') {
  const scene = new T.Scene();
  scene.background = new T.Color(0x070b14);
  scene.fog = new T.Fog(0x070b14, 14, 38);
  const q = quality === 'low' ? { shadow: 0, env: false } : quality === 'medium' ? { shadow: 1024, env: true } : { shadow: 2048, env: true };
  if (q.env) {
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    pm.dispose();
  }
  if (q.shadow) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; }
  const hemi = new T.HemisphereLight(0xcfe2ff, 0x1a2638, 0.9);
  const key = new T.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(-2.2, 6.5, 3.2); key.target.position.set(0, 0.7, 0);
  if (q.shadow) {
    key.castShadow = true; key.shadow.mapSize.set(q.shadow, q.shadow);
    Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.8, bottom: -2.8, near: 2, far: 14 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.015; key.shadow.radius = 4;
  }
  const rim = new T.DirectionalLight(0x7fb4ff, 1.1); rim.position.set(3, 3, -6);
  scene.add(hemi, key, key.target, rim);

  const mats = {};
  const M = (name, m) => (mats[name] = m);

  // floor
  const floorT = floorTexture();
  const floor = new T.Mesh(new T.PlaneGeometry(9, 11), M('floor', new T.MeshStandardMaterial({ map: floorT, roughness: 0.55, metalness: 0.0 })));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const outer = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.9 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; scene.add(outer);

  // backdrop and barriers
  const crowdT = crowdTexture();
  const back = new T.Mesh(new T.PlaneGeometry(34, 10.6), M('crowd', new T.MeshBasicMaterial({ map: crowdT, fog: false })));
  back.position.set(0, 5.4, -8.6); scene.add(back);
  const sideL = new T.Mesh(new T.PlaneGeometry(26, 9), new T.MeshBasicMaterial({ map: crowdT, fog: false, color: 0x8a96aa })); sideL.position.set(-6.6, 4.6, 1); sideL.rotation.y = Math.PI / 2; scene.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = 6.6; sideR.rotation.y = -Math.PI / 2; scene.add(sideR);
  const boardMat = M('board', new T.MeshStandardMaterial({ map: boardTexture(205), roughness: 0.45, metalness: 0.1 }));
  const boardBack = new T.Mesh(new T.BoxGeometry(11, 0.55, 0.06), boardMat); boardBack.position.set(0, 0.275, -5.6); scene.add(boardBack);
  const boardL = new T.Mesh(new T.BoxGeometry(0.06, 0.55, 9), boardMat); boardL.position.set(-4.1, 0.275, -0.7); scene.add(boardL);
  const boardR = boardL.clone(); boardR.position.x = 4.1; scene.add(boardR);
  boardBack.receiveShadow = boardL.receiveShadow = boardR.receiveShadow = true;
  for (const b of [boardBack, boardL, boardR]) { b.material = boardMat; }
  // ceiling lights
  const lampMat = new T.MeshBasicMaterial({ color: 0xf2f7ff, fog: false });
  for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.BoxGeometry(4.2, 0.08, 0.35), lampMat); l.position.set(0, 6.6, -4.5 + i * 3); scene.add(l); }

  // table
  const table = new T.Group(); scene.add(table);
  const topMat = M('top', new T.MeshStandardMaterial({ map: tableTexture(), roughness: 0.34, metalness: 0.0, envMapIntensity: 0.9 }));
  const sideMat = new T.MeshStandardMaterial({ color: 0x0a2f70, roughness: 0.5 });
  const slab = new T.Mesh(new T.BoxGeometry(1.525, 0.03, 2.74), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  slab.position.y = 0.745; slab.castShadow = true; slab.receiveShadow = true; table.add(slab);
  const legMat = new T.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.5, metalness: 0.4 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new T.Mesh(new T.BoxGeometry(0.06, 0.73, 0.06), legMat); leg.position.set(sx * 0.66, 0.365, sz * 1.14); leg.castShadow = true; table.add(leg);
  }
  for (const sx of [-1, 1]) { const br = new T.Mesh(new T.BoxGeometry(0.04, 0.04, 2.3), legMat); br.position.set(sx * 0.66, 0.2, 0); table.add(br); }
  // net
  const netMat = new T.MeshBasicMaterial({ map: netTexture(), transparent: true, side: T.DoubleSide, depthWrite: false });
  const net = new T.Mesh(new T.PlaneGeometry(1.83, 0.1525), netMat); net.position.set(0, 0.76 + 0.0762, 0); table.add(net);
  const postMat = new T.MeshStandardMaterial({ color: 0x15181f, roughness: 0.4, metalness: 0.5 });
  for (const sx of [-1, 1]) {
    const post = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.19, 12), postMat); post.position.set(sx * 0.9, 0.85, 0); post.castShadow = true; table.add(post);
    const clamp = new T.Mesh(new T.BoxGeometry(0.05, 0.035, 0.05), postMat); clamp.position.set(sx * 0.82, 0.78, 0); table.add(clamp);
  }

  // ball
  const BALL_VIS = 1.55;
  const ballMesh = new T.Mesh(new T.SphereGeometry(0.02 * BALL_VIS, 24, 16), new T.MeshStandardMaterial({ map: ballTexture(), roughness: 0.35, metalness: 0 }));
  ballMesh.castShadow = true; scene.add(ballMesh);
  const glow = glowTexture();
  const blob = new T.Mesh(new T.CircleGeometry(0.05, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob);

  // paddles: the prop origin is the butt of a SHORT handle; +Y runs handle -> blade, +Z is the face with the front rubber.
  const PAD = { S: 1.0, hl: 0.1, R: 0.08 };          // regulation-size blade (16 cm wide) and a 10 cm handle; total about 26 cm
  PAD.cy = PAD.hl + PAD.R * 0.93;                   // blade centre along +Y from the butt
  function makePaddle(front, back) {
    const g = new T.Group();
    const S = PAD.S;
    const wood = new T.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.6 });
    const bladeG = new T.Group(); bladeG.position.y = PAD.cy; g.add(bladeG);
    const blade = new T.Mesh(new T.CylinderGeometry(PAD.R, PAD.R, 0.011 * S, 40), wood); blade.rotation.x = Math.PI / 2; blade.castShadow = true; bladeG.add(blade);
    const rf = new T.Mesh(new T.CircleGeometry(PAD.R * 0.955, 40), new T.MeshStandardMaterial({ map: rubberTexture(front[0], front[1]), roughness: 0.5 })); rf.position.z = 0.0072 * S; bladeG.add(rf);
    const rb = new T.Mesh(new T.CircleGeometry(PAD.R * 0.955, 40), new T.MeshStandardMaterial({ map: rubberTexture(back[0], back[1]), roughness: 0.5 })); rb.position.z = -0.0072 * S; rb.rotation.y = Math.PI; bladeG.add(rb);
    const handle = new T.Mesh(new T.BoxGeometry(0.024 * S, PAD.hl + 0.02, 0.018 * S), wood); handle.position.y = (PAD.hl + 0.02) / 2 - 0.0; handle.castShadow = true; g.add(handle);
    const cap = new T.Mesh(new T.BoxGeometry(0.03 * S, 0.014, 0.022 * S), new T.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.7 })); cap.position.y = -0.002; g.add(cap);
    scene.add(g);
    return g;
  }
  const padP = makePaddle(['#c8141c', '#7a0a10'], ['#17171c', '#40404a']);
  const padO = makePaddle(['#16171c', '#40404a'], ['#1a62d0', '#0b3a8a']);

  // the player's bat: first-person, no body. Origin = centre of the blade; +Y toward the tip, +Z the face (front rubber); the handle hangs
  // toward -Y and, in the player's view, reaches the bottom of the screen.
  function starTexture() {
    const [c, g] = mk(256, 256);
    g.fillStyle = '#b8101c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(70,0,8,0.35)'; g.beginPath(); g.arc(rand() * 256, rand() * 256, 0.8 + rand() * 1.4, 0, 6.3); g.fill(); }
    const r = g.createRadialGradient(100, 90, 10, 128, 128, 170); r.addColorStop(0, 'rgba(255,120,120,0.28)'); r.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,230,200,0.5)'; g.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? 11 : 24, a = -1.5708 + i * 0.6283; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    return tex(c, { aniso: 8 });
  }
  function tapeTexture() {
    const [c, g] = mk(64, 256);
    g.fillStyle = '#16161c'; g.fillRect(0, 0, 64, 256);
    for (let y = -64; y < 320; y += 14) { g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, y + 64); g.lineTo(64, y); g.stroke(); }
    return tex(c);
  }
  function blackTexture() {
    const [c, g] = mk(256, 256);
    g.fillStyle = '#121318'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1100; i++) { g.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.1})`; g.beginPath(); g.arc(rand() * 256, rand() * 256, 0.7 + rand() * 1.3, 0, 6.3); g.fill(); }
    const r = g.createRadialGradient(90, 80, 10, 128, 128, 180); r.addColorStop(0, 'rgba(120,150,255,0.16)'); r.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 30, 0, 6.3); g.stroke();
    g.fillStyle = 'rgba(255,200,120,0.85)'; g.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? 9 : 20, a = -1.5708 + i * 0.6283; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    return tex(c, { aniso: 8 });
  }
  const BAT = { R: 0.1, hl: 0.19, th: 0.013 };
  function makeBat() {
    const g = new T.Group(), mats = [];
    const M = (m) => { m.transparent = true; mats.push(m); return m; };
    const wood = M(new T.MeshStandardMaterial({ color: 0xcf9d62, roughness: 0.5, metalness: 0.02 }));
    const blade = new T.Group(); g.add(blade);
    const core = new T.Mesh(new T.CylinderGeometry(BAT.R, BAT.R, BAT.th, 56), wood); core.rotation.x = Math.PI / 2; core.castShadow = true; blade.add(core);
    const edge = new T.Mesh(new T.TorusGeometry(BAT.R, 0.0052, 12, 64), M(new T.MeshStandardMaterial({ color: 0x15151a, roughness: 0.6 }))); blade.add(edge);
    const front = new T.Mesh(new T.CircleGeometry(BAT.R * 0.985, 56), M(new T.MeshStandardMaterial({ map: starTexture(), roughness: 0.42, metalness: 0.05 }))); front.position.z = BAT.th / 2 + 0.0012; blade.add(front);
    const back = new T.Mesh(new T.CircleGeometry(BAT.R * 0.985, 56), M(new T.MeshStandardMaterial({ map: blackTexture(), roughness: 0.45, metalness: 0.06 }))); back.position.z = -BAT.th / 2 - 0.0012; back.rotation.y = Math.PI; blade.add(back);
    // neck, flared handle with grip tape, end cap
    const neck = new T.Mesh(new T.BoxGeometry(0.05, 0.05, BAT.th * 0.9), wood); neck.position.y = -BAT.R * 0.96; g.add(neck);
    const hgeo = new T.CylinderGeometry(0.0145, 0.0185, BAT.hl, 20); const handle = new T.Mesh(hgeo, M(new T.MeshStandardMaterial({ map: tapeTexture(), roughness: 0.75 })));
    handle.scale.z = 0.78; handle.position.y = -BAT.R * 0.96 - BAT.hl / 2 - 0.02; handle.castShadow = true; g.add(handle);
    const wrapTop = new T.Mesh(new T.CylinderGeometry(0.0158, 0.0158, 0.012, 20), wood); wrapTop.scale.z = 0.8; wrapTop.position.y = -BAT.R * 0.96 - 0.016; g.add(wrapTop);
    const cap = new T.Mesh(new T.CylinderGeometry(0.0215, 0.0215, 0.016, 20), M(new T.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 }))); cap.scale.z = 0.8; cap.position.y = -BAT.R * 0.96 - BAT.hl - 0.028; g.add(cap);
    // timing ring and impact ring (additive, drawn on the face)
    const glow = new T.Mesh(new T.RingGeometry(BAT.R * 0.55, BAT.R * 0.72, 48), new T.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); glow.position.z = BAT.th / 2 + 0.003; blade.add(glow);
    const impact = new T.Mesh(new T.RingGeometry(BAT.R * 0.3, BAT.R * 0.36, 48), new T.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); impact.position.z = BAT.th / 2 + 0.004; blade.add(impact);
    scene.add(g);
    return { g, blade, glow, impact, mats };
  }
  const bat = makeBat();
  const batBlob = new T.Mesh(new T.CircleGeometry(0.11, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })); batBlob.rotation.x = -Math.PI / 2; scene.add(batBlob);
  // short ribbon behind a fast swing
  const TR = 12, trailGeo = new T.BufferGeometry();
  trailGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(TR * 2 * 3), 3));
  trailGeo.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(TR * 2 * 3), 3));
  const idx = []; for (let i = 0; i < TR - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx);
  const batTrail = new T.Mesh(trailGeo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); batTrail.frustumCulled = false; batTrail.visible = false; scene.add(batTrail);
  // toss preview: dots along the arc of the serve toss
  const tossDots = []; for (let i = 0; i < 9; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0xfff0b0, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); tossDots.push(s); }

  // ball machine (rally challenge): a body with a barrel aimed at the table
  const machine = new T.Group();
  const mBody = new T.Mesh(new T.BoxGeometry(0.5, 0.42, 0.5), new T.MeshStandardMaterial({ color: 0x2b3446, roughness: 0.5, metalness: 0.4 })); mBody.position.y = 0.62; mBody.castShadow = true; machine.add(mBody);
  const mStripe = new T.Mesh(new T.BoxGeometry(0.52, 0.06, 0.52), new T.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.4 })); mStripe.position.y = 0.7; machine.add(mStripe);
  const mBarrel = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.4, 16), new T.MeshStandardMaterial({ color: 0x111621, roughness: 0.4, metalness: 0.6 })); mBarrel.rotation.x = Math.PI / 2 - 0.25; mBarrel.position.set(0, 0.85, 0.3); machine.add(mBarrel);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const lg = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.42, 8), legMat); lg.position.set(lx, 0.21, lz); machine.add(lg); }
  machine.position.set(0, 0, -2.2); machine.visible = false; scene.add(machine);

  // particles
  const parts = [];
  const sprMat = (c) => new T.SpriteMaterial({ map: glow, color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 });
  for (let i = 0; i < 90; i++) { const s = new T.Sprite(sprMat(0xffffff)); s.visible = false; scene.add(s); parts.push({ s, life: 0, max: 1, v: new T.Vector3(), size: 0.1, grow: 0, drag: 0, g: 0 }); }
  const trail = [];
  for (let i = 0; i < 16; i++) { const s = new T.Sprite(sprMat(0xffffff)); s.visible = false; scene.add(s); trail.push({ s, x: 0, y: -9, z: 0, a: 0 }); }
  // bounce rings on the table
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const m = new T.Mesh(new T.RingGeometry(0.03, 0.04, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); rings.push({ m, life: 0, max: 0.45 });
  }

  return { bat, BAT, batBlob, batTrail, TR, tossDots, machine, PAD, scene, key, hemi, rim, table, ballMesh, blob, padP, padO, parts, trail, rings, mats, BALL_VIS, glow, boardMat, floor };
}
