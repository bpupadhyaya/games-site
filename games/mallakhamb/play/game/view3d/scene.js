// The 3D set for the pole: oiled sheesham-wood pole with grain, rope bindings and chalk, a packed-earth pit, a colonnade, string lights
// with soft bokeh, a spotlight cone and a standing crowd. Presentation only: it never touches the sim. Everything is procedural
// (canvas textures) so no new asset files are shipped.
import { THREE } from '../vendor3d/index.js';

const { Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, CylinderGeometry, SphereGeometry, PlaneGeometry, BoxGeometry, TorusGeometry, CanvasTexture,
  RepeatWrapping, SRGBColorSpace, Color, AdditiveBlending, Sprite, SpriteMaterial, DoubleSide, BackSide, Vector3, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Line } = THREE;

const TAU = Math.PI * 2;
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const cv = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { srgb = true, repeat = true, aniso = 4 } = {}) => {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};
// draw a shape three times so it wraps horizontally on a seamless texture
const wrapX = (W, x, fn) => { fn(x - W); fn(x); fn(x + W); };

// ---- textures -------------------------------------------------------------------------------------------------------------------
/** Oiled sheesham: warm brown heartwood, long grain streaks, a few knots, polish. Colour map + bump map (seamless sideways). */
export function woodTextures() {
  const W = 512, H = 1024, R = rng(11);
  const col = cv(W, H), bmp = cv(W, H), g = col.getContext('2d'), b = bmp.getContext('2d');
  g.fillStyle = '#7b4723'; g.fillRect(0, 0, W, H);
  b.fillStyle = '#8a8a8a'; b.fillRect(0, 0, W, H);
  // broad heartwood / sapwood bands
  for (let i = 0; i < 70; i++) {
    const x = R() * W, w = 10 + R() * 55, a = 0.06 + R() * 0.14, c = R() < 0.5 ? '168,104,52' : '58,26,12';
    wrapX(W, x, (xx) => { const gr = g.createLinearGradient(xx - w, 0, xx + w, 0); gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.5, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(xx - w, 0, 2 * w, H); });
  }
  // fine grain: long, slightly wandering streaks
  for (let i = 0; i < 1100; i++) {
    const x = R() * W, y0 = R() * H, len = 150 + R() * 800, w = 0.5 + R() * 1.7, dark = R() < 0.62;
    const a = 0.1 + R() * 0.3, tone = dark ? `rgba(48,22,8,${a})` : `rgba(214,150,86,${a * 0.7})`;
    const wob = (R() - 0.5) * 14, bump = dark ? 40 + R() * 40 : 190;
    for (const [ctx, st] of [[g, tone], [b, `rgba(${bump},${bump},${bump},${0.35 + R() * 0.4})`]]) {
      wrapX(W, x, (xx) => { ctx.strokeStyle = st; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.bezierCurveTo(xx + wob, y0 + len * 0.3, xx - wob * 0.6, y0 + len * 0.7, xx + wob * 0.3, y0 + len); ctx.stroke(); });
    }
  }
  // pores
  for (let i = 0; i < 2600; i++) {
    const x = R() * W, y = R() * H, l = 3 + R() * 9;
    g.fillStyle = 'rgba(30,12,4,0.34)'; g.fillRect(x, y, 0.9, l); b.fillStyle = 'rgba(40,40,40,0.5)'; b.fillRect(x, y, 0.9, l);
  }
  // knots / swirls
  for (let i = 0; i < 5; i++) {
    const x = R() * W, y = R() * H, r = 7 + R() * 9;
    wrapX(W, x, (xx) => { for (let k = 4; k > 0; k--) { g.strokeStyle = `rgba(34,14,6,${0.2 + 0.1 * k})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(xx, y, r * k * 0.42, r * k * 1.15, 0, 0, TAU); g.stroke(); b.strokeStyle = 'rgba(60,60,60,0.5)'; b.lineWidth = 1.2; b.beginPath(); b.ellipse(xx, y, r * k * 0.42, r * k * 1.15, 0, 0, TAU); b.stroke(); } g.fillStyle = 'rgba(30,12,4,0.55)'; g.beginPath(); g.ellipse(xx, y, r * 0.3, r * 0.7, 0, 0, TAU); g.fill(); });
  }
  // chalk smears where the hands grip (drawn on the colour map only)
  for (let i = 0; i < 38; i++) {
    const x = R() * W, y = R() * H, w = 6 + R() * 26, l = 10 + R() * 40;
    wrapX(W, x, (xx) => { g.fillStyle = `rgba(240,232,214,${0.025 + R() * 0.07})`; g.beginPath(); g.ellipse(xx, y, w, l, (R() - 0.5) * 0.4, 0, TAU); g.fill(); });
  }
  return { map: tex(col), bump: tex(bmp, { srgb: false }) };
}

/** Jute rope wound diagonally: colour + bump. */
export function ropeTextures() {
  const S = 256, R = rng(5);
  const col = cv(S, S), bmp = cv(S, S), g = col.getContext('2d'), b = bmp.getContext('2d');
  g.fillStyle = '#7d6232'; g.fillRect(0, 0, S, S); b.fillStyle = '#404040'; b.fillRect(0, 0, S, S);
  const strands = 8;
  for (let i = -strands; i < strands * 2; i++) {
    const x0 = (i / strands) * S;
    for (const [ctx, c0, c1] of [[g, '#c9aa6a', '#6d5226'], [b, '#f0f0f0', '#101010']]) {
      const gr = ctx.createLinearGradient(x0, 0, x0 + S / strands, 0); gr.addColorStop(0, c1); gr.addColorStop(0.45, c0); gr.addColorStop(1, c1);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + S / strands, 0); ctx.lineTo(x0 + S / strands + S * 0.45, S); ctx.lineTo(x0 + S * 0.45, S); ctx.closePath(); ctx.fill();
    }
  }
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,240,200' : '40,24,8'},0.16)`; g.fillRect(R() * S, R() * S, 1, 2 + R() * 4); }
  return { map: tex(col), bump: tex(bmp, { srgb: false }) };
}

/** Packed earth tile (seamless). */
function earthTexture() {
  const S = 512, R = rng(21), c = cv(S, S), g = c.getContext('2d');
  g.fillStyle = '#5c3624'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S, r = 20 + R() * 60, d = R() < 0.5; wrapX(S, x, (xx) => { const gr = g.createRadialGradient(xx, y, 0, xx, y, r); gr.addColorStop(0, d ? 'rgba(60,28,16,0.18)' : 'rgba(190,120,80,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(xx - r, y - r, 2 * r, 2 * r); }); }
  const im = g.getImageData(0, 0, S, S), d = im.data; let s = 99;
  for (let i = 0; i < d.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.28; d[i] += n; d[i + 1] += n * 0.8; d[i + 2] += n * 0.7; }
  g.putImageData(im, 0, 0);
  for (let i = 0; i < 2600; i++) { const x = R() * S, y = R() * S; g.fillStyle = R() < 0.5 ? 'rgba(255,215,170,0.35)' : 'rgba(40,18,10,0.4)'; g.fillRect(x, y, 1 + R() * 1.6, 1 + R() * 1.2); }
  return tex(c, { aniso: 8 });
}

/** The pit around the pole: darker oil-packed earth, raked arcs, footprints, a chalk ring. RGBA decal. */
function pitTexture() {
  const S = 1024, R = rng(33), c = cv(S, S), g = c.getContext('2d'), m = S / 2;
  const base = g.createRadialGradient(m, m, 0, m, m, m);
  base.addColorStop(0, 'rgba(60,32,20,0.95)'); base.addColorStop(0.5, 'rgba(92,54,34,0.92)'); base.addColorStop(0.9, 'rgba(120,76,50,0.7)'); base.addColorStop(1, 'rgba(120,76,50,0)');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.save(); g.beginPath(); g.arc(m, m, m * 0.98, 0, TAU); g.clip();
  // raked arcs
  for (let i = 0; i < 26; i++) { const r = 60 + i * 17 + R() * 3; g.strokeStyle = R() < 0.5 ? 'rgba(20,8,4,0.1)' : 'rgba(210,150,100,0.06)'; g.lineWidth = 1.2 + R() * 1.4; g.beginPath(); g.arc(m + (R() - 0.5) * 6, m + (R() - 0.5) * 6, r, R() * TAU, R() * TAU + 2 + R() * 4); g.stroke(); }
  // footprints
  for (let i = 0; i < 16; i++) { const a = R() * TAU, r = 60 + R() * 330, x = m + Math.cos(a) * r, y = m + Math.sin(a) * r; g.save(); g.translate(x, y); g.rotate(R() * TAU); g.fillStyle = 'rgba(25,10,6,0.28)'; g.beginPath(); g.ellipse(0, 0, 9, 22, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(25,10,6,0.2)'; g.beginPath(); g.ellipse(0, 22, 6, 9, 0, 0, TAU); g.fill(); g.restore(); }
  // chalk ring + dust
  g.strokeStyle = 'rgba(240,228,205,0.5)'; g.lineWidth = 5; g.beginPath(); g.arc(m, m, m * 0.74, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(240,228,205,0.18)'; g.lineWidth = 16; g.beginPath(); g.arc(m, m, m * 0.74, 0, TAU); g.stroke();
  for (let i = 0; i < 1500; i++) { const a = R() * TAU, r = Math.sqrt(R()) * m * 0.9; g.fillStyle = R() < 0.5 ? 'rgba(255,225,190,0.22)' : 'rgba(20,8,4,0.3)'; g.fillRect(m + Math.cos(a) * r, m + Math.sin(a) * r, 1 + R() * 2, 1 + R() * 2); }
  g.restore();
  return tex(c, { repeat: false, aniso: 8 });
}

function glowTexture(inner = 'rgba(255,230,170,1)', mid = 'rgba(255,170,70,0.45)') {
  const c = cv(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.18, inner); gr.addColorStop(0.45, mid); gr.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c, { repeat: false });
}
function bokehTexture() {
  const c = cv(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,214,150,0.55)'); gr.addColorStop(0.82, 'rgba(255,196,120,0.6)'); gr.addColorStop(0.95, 'rgba(255,230,190,0.85)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
  return tex(c, { repeat: false });
}
function coneTexture() {
  const c = cv(8, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,226,170,0)'); gr.addColorStop(0.3, 'rgba(255,226,170,0.35)'); gr.addColorStop(1, 'rgba(255,214,150,0.6)');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  return tex(c, { repeat: false });
}

/** Golden-hour sky for the store icon: deep indigo to ember to gold, a low sun, nothing else. */
function sunsetTexture() {
  const W = 512, H = 512, c = cv(W, H), g = c.getContext('2d');
  const sk = g.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, '#120a2e'); sk.addColorStop(0.35, '#4a1c52'); sk.addColorStop(0.58, '#b3452f'); sk.addColorStop(0.75, '#f08a3c'); sk.addColorStop(0.88, '#ffc66a'); sk.addColorStop(1, '#ffd98a');
  g.fillStyle = sk; g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.68, H * 0.8, 4, W * 0.68, H * 0.8, W * 0.6);
  sun.addColorStop(0, 'rgba(255,248,214,1)'); sun.addColorStop(0.1, 'rgba(255,226,150,0.9)'); sun.addColorStop(0.35, 'rgba(255,160,70,0.45)'); sun.addColorStop(1, 'rgba(255,100,40,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  return tex(c, { repeat: false });
}

/** Painted far backdrop: dusk sky, moon glow, lit arcade seen through the colonnade. 2048x1024. */
function backdropTexture() {
  const W = 2048, H = 1024, R = rng(77), c = cv(W, H), g = c.getContext('2d');
  const sk = g.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, '#070516'); sk.addColorStop(0.4, '#1c0f38'); sk.addColorStop(0.6, '#4a1f45'); sk.addColorStop(0.74, '#9a4132'); sk.addColorStop(0.86, '#d98a44'); sk.addColorStop(1, '#f0b878');
  g.fillStyle = sk; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,240,215,${0.15 + R() * 0.55})`; g.fillRect(R() * W, R() * H * 0.5, 1 + R() * 1.5, 1 + R() * 1.5); }
  const mg = g.createRadialGradient(W * 0.72, H * 0.52, 4, W * 0.72, H * 0.52, W * 0.3);
  mg.addColorStop(0, 'rgba(255,226,170,0.8)'); mg.addColorStop(0.2, 'rgba(255,190,120,0.35)'); mg.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = mg; g.fillRect(0, 0, W, H);
  // far rooflines, trees and domes in layered haze
  const layer = (base, amp, col, seed) => { const r2 = rng(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, base - Math.abs(Math.sin(x * 0.011 + seed)) * amp - r2() * amp * 0.25); g.lineTo(W, H); g.fill(); };
  layer(H * 0.7, 46, 'rgba(110,48,60,0.8)', 3); layer(H * 0.76, 38, 'rgba(70,30,52,0.9)', 8);
  for (let i = 0; i < 9; i++) { const x = (i + 0.5) * W / 9 + (R() - 0.5) * 60, y = H * 0.7 - 34, r = 26 + R() * 24; g.fillStyle = 'rgba(66,28,50,0.95)'; g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.fill(); g.fillRect(x - r, y, 2 * r, H); g.fillStyle = 'rgba(255,200,120,0.5)'; g.fillRect(x - 3, y - r - 14, 6, 14); }
  // warm lit windows
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,${180 + R() * 50 | 0},${90 + R() * 60 | 0},${0.35 + R() * 0.5})`; g.fillRect(R() * W, H * 0.76 + R() * H * 0.2, 4 + R() * 6, 7 + R() * 8); }
  // haze at the horizon line
  const hz = g.createLinearGradient(0, H * 0.62, 0, H * 0.95); hz.addColorStop(0, 'rgba(255,170,100,0)'); hz.addColorStop(1, 'rgba(255,200,130,0.45)');
  g.fillStyle = hz; g.fillRect(0, H * 0.62, W, H * 0.4);
  return tex(c, { repeat: false });
}

// ---- the pole -------------------------------------------------------------------------------------------------------------------
export const POLE_R = 0.062;
export const POLE_Z = -0.16;

function buildPole(height = 7) {
  const group = new Group();
  const { map, bump } = woodTextures();
  map.repeat.set(1, height / 0.9); bump.repeat.copy(map.repeat);
  const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 1.6, roughness: 0.5, metalness: 0.0, envMapIntensity: 1.3, clearcoat: 0.7, clearcoatRoughness: 0.22, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new Color(0xffb36a) });   // oiled sheesham: grain under a wet-looking coat
  const body = new Mesh(new CylinderGeometry(POLE_R * 0.92, POLE_R * 1.06, height, 56, 1, true), mat);
  body.position.y = height / 2; body.castShadow = true; body.receiveShadow = true;
  const cap = new Mesh(new SphereGeometry(POLE_R * 0.92, 24, 14, 0, TAU, 0, Math.PI / 2), mat); cap.position.y = height; cap.castShadow = true;
  group.add(body, cap);
  // rope bindings: at the foot and every 1.2 m up the pole (jute, wound)
  const rt = ropeTextures();
  const ropeMat = new MeshStandardMaterial({ map: rt.map, bumpMap: rt.bump, bumpScale: 2.2, roughness: 0.95, metalness: 0 });
  const bind = (y, len) => {
    const t = rt.map.clone(); t.repeat.set(5, Math.max(1, len / 0.05)); t.needsUpdate = true;
    const tb = rt.bump.clone(); tb.repeat.copy(t.repeat); tb.needsUpdate = true;
    const mm = ropeMat.clone(); mm.map = t; mm.bumpMap = tb;
    const r = POLE_R * (1.06 - 0.14 * (y / height)) + 0.006;
    const m = new Mesh(new CylinderGeometry(r, r, len, 40, 1, true), mm); m.position.y = y; m.castShadow = true; m.receiveShadow = true;
    const rim1 = new Mesh(new TorusGeometry(r, 0.006, 8, 40), mm), rim2 = rim1.clone();
    rim1.rotation.x = rim2.rotation.x = Math.PI / 2; rim1.position.y = y + len / 2; rim2.position.y = y - len / 2;
    group.add(m, rim1, rim2);
  };
  bind(0.16, 0.3);
  for (let y = 1.3; y < height - 0.2; y += 1.4) bind(y, 0.07);
  // soil mound at the foot
  const mound = new Mesh(new CylinderGeometry(POLE_R * 2.2, POLE_R * 4.2, 0.07, 36), new MeshStandardMaterial({ color: 0x5a3320, roughness: 1 }));
  mound.position.y = 0.0; mound.receiveShadow = true; group.add(mound);
  return { group, body };
}

// ---- the whole set --------------------------------------------------------------------------------------------------------------
export function buildWorld(stage, { quality = 'medium' } = {}) {
  const scene = stage.scene;
  const root = new Group();        // everything that moves with the climb (ground, pole, colonnade, crowd)
  const screen = new Group();      // things fixed to the screen (string lights, bokeh): placed per frame
  scene.add(root, screen);
  const world = { root, screen, quality };

  // ground: a big tile of earth and the pit decal under the pole
  const et = earthTexture(); et.repeat.set(14, 14);
  const ground = new Mesh(new PlaneGeometry(70, 70), new MeshStandardMaterial({ map: et, roughness: 1, metalness: 0, color: 0xffffff }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const pit = new Mesh(new PlaneGeometry(4.6, 4.6), new MeshStandardMaterial({ map: pitTexture(), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  pit.rotation.x = -Math.PI / 2; pit.position.set(0, 0.004, POLE_Z); pit.receiveShadow = true; root.add(pit);

  // pole
  const pole = buildPole(7.2);
  pole.group.position.set(0, 0, 0);
  root.add(pole.group);
  world.pole = pole.group;

  // painted backdrop + colonnade
  const bd = new Mesh(new PlaneGeometry(90, 45), new MeshBasicMaterial({ map: backdropTexture(), fog: false }));
  bd.position.set(0, 13, -28); root.add(bd); world.bd = bd;
  const iconSky = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: sunsetTexture(), fog: false, depthWrite: false })); iconSky.visible = false; iconSky.renderOrder = -1; screen.add(iconSky); world.iconSky = iconSky;
  const plaster = new MeshStandardMaterial({ color: 0x40222a, roughness: 0.95, metalness: 0 });
  const trim = new MeshStandardMaterial({ color: 0x5e3a30, roughness: 0.9 });
  const glowCol = new MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.1, depthWrite: false, blending: AdditiveBlending });
  const colon = new Group(); root.add(colon); world.colon = colon;
  for (let x = -26; x <= 26.01; x += 3.4) {
    const p = new Mesh(new BoxGeometry(0.62, 4.6, 0.62), plaster); p.position.set(x, 2.3, -14); p.receiveShadow = false; colon.add(p);
    const cap = new Mesh(new BoxGeometry(0.86, 0.22, 0.86), trim); cap.position.set(x, 4.7, -14); colon.add(cap);
    const base = new Mesh(new BoxGeometry(0.8, 0.3, 0.8), trim); base.position.set(x, 0.15, -14); colon.add(base);
    // warm light inside every bay
    const bay = new Mesh(new PlaneGeometry(2.4, 4.0), glowCol); bay.position.set(x + 1.7, 2.1, -14.4); colon.add(bay);
  }
  const beam = new Mesh(new BoxGeometry(60, 0.5, 0.7), plaster); beam.position.set(0, 5.0, -14); colon.add(beam);
  const parapet = new Mesh(new BoxGeometry(60, 0.5, 0.5), trim); parapet.position.set(0, 5.6, -14); colon.add(parapet);
  // low rope barrier and sand ring around the pit is implied by the pit decal

  // spot cone
  const coneMat = new MeshBasicMaterial({ map: coneTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, opacity: 0.2, fog: false });
  const cone = new Mesh(new CylinderGeometry(0.4, 2.6, 11, 40, 1, true), coneMat); cone.position.set(0.3, 5.7, POLE_Z - 0.2); root.add(cone);
  world.cone = coneMat;

  // a ring of clay oil lamps round the pit: small bowls with a warm flame sprite
  {
    const bowlMat = new MeshStandardMaterial({ color: 0x9a4a28, roughness: 0.9 });
    const flameTex = glowTexture('rgba(255,244,200,1)', 'rgba(255,170,60,0.55)');
    const N = 18, Rr = 2.5;
    world.diyas = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + 0.1, x = Math.cos(a) * Rr, z = POLE_Z + Math.sin(a) * Rr * 0.9;
      const bowl = new Mesh(new SphereGeometry(0.05, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), bowlMat); bowl.scale.set(1, 0.55, 1); bowl.position.set(x, 0.035, z); bowl.rotation.x = Math.PI; root.add(bowl);
      const fl = new Sprite(new SpriteMaterial({ map: flameTex, blending: AdditiveBlending, depthWrite: false, transparent: true }));
      fl.position.set(x, 0.1, z); fl.scale.set(0.32, 0.38, 1); fl.userData.ph = i * 1.7; root.add(fl); world.diyas.push(fl);
      world.diyaMeshes = (world.diyaMeshes || []).concat([bowl, fl]);
    }
  }

  // string lights and bokeh (fixed to the screen, placed each frame from the view)
  const bulbTex = glowTexture();
  const bokehTex = bokehTexture();
  const wire = [];
  const bulbs = [], bokeh = [];
  const R = rng(4);
  for (let row = 0; row < 3; row++) {
    const n = 18, line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0x2a1a14, transparent: true, opacity: 0.8 }));
    line.userData = { row, n }; screen.add(line); wire.push(line);
    for (let i = 0; i < n; i++) {
      const sp = new Sprite(new SpriteMaterial({ map: bulbTex, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      sp.userData = { row, i, n, ph: R() * TAU }; screen.add(sp); bulbs.push(sp);
    }
  }
  for (let i = 0; i < 26; i++) {
    const sp = new Sprite(new SpriteMaterial({ map: bokehTex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.03 + R() * 0.07, fog: false }));
    sp.userData = { u: R(), v: 0.06 + R() * 0.42, s: 0.35 + R() * 0.6, ph: R() * TAU, z: -7 - R() * 6 }; screen.add(sp); bokeh.push(sp);
  }
  world.bulbs = bulbs; world.bokeh = bokeh; world.wire = wire;

  /** Place screen-fixed lights from the camera frame: halfW/halfH are the visible half extents (metres) at depth z=0, camY the view centre. */
  world.layoutScreen = (cam, t, pulse, excite) => {
    const D = cam.D;
    for (const l of wire) {
      const { row, n } = l.userData, z = -3.5 - row * 2.2, vis = (D - z) / D, hw = cam.halfW * vis * 1.1, hh = cam.halfH * vis;
      const y0 = cam.cy + hh * (0.88 - row * 0.1), sag = hh * 0.09;
      const pts = [];
      for (let s = 0; s <= 40; s++) { const u = s / 40, x = cam.cx + (u * 2 - 1) * hw; pts.push(x, y0 - Math.sin(u * Math.PI * (2.5 + row * 0.5)) * sag * 0 - Math.abs(Math.sin(u * Math.PI * (3 + row))) * sag, z); }
      l.geometry.setAttribute('position', new Float32BufferAttribute(pts, 3)); l.geometry.computeBoundingSphere();
    }
    for (const s of bulbs) {
      const { row, i, n, ph } = s.userData, z = -3.5 - row * 2.2, vis = (D - z) / D, hw = cam.halfW * vis * 1.1, hh = cam.halfH * vis;
      const u = (i + 0.5) / n, x = cam.cx + (u * 2 - 1) * hw, y0 = cam.cy + hh * (0.88 - row * 0.1), sag = hh * 0.09;
      const y = y0 - Math.abs(Math.sin(u * Math.PI * (3 + row))) * sag - 0.02;
      s.position.set(x, y, z);
      const tw = 0.78 + 0.22 * Math.sin(t * 2.4 + ph) + pulse * 0.15;
      const size = (0.26 + row * 0.07) * (0.9 + 0.2 * tw) * vis;
      s.scale.set(size, size, 1); s.material.opacity = 0.62 * tw;
    }
    for (const s of bokeh) {
      const { u, v, s: sz, ph, z } = s.userData, vis = (D - z) / D;
      const x = cam.cx + (u * 2 - 1) * cam.halfW * vis, y = cam.cy + cam.halfH * vis * (1 - v * 2) * 0.9;
      s.position.set(x + Math.sin(t * 0.2 + ph) * 0.06, y + Math.cos(t * 0.17 + ph) * 0.04, z);
      const size = sz * 0.9 * vis; s.scale.set(size, size, 1);
    }
  };
  return world;
}

/** The standing crowd: a pool of view3d humans placed in two arcs behind the pit. */
export async function buildCrowd(stage, loadHuman, createCrowd, { base, count = 14, characters = ['athlete_m'], parent = null } = {}) {
  const crowd = createCrowd(stage, { farEvery: 2 });
  const R = rng(91);
  const tops = ['#b9ad94', '#8a6a1c', '#1f4f52', '#6e2a2a', '#a79e88', '#2b3a68', '#8a4418', '#3d5428', '#c4bba5', '#5e2a48', '#8c6a3a', '#1f4260'];
  const bottoms = ['#4a3c30', '#1c1822', '#5a4a3a', '#2c201b', '#6a5a48', '#1e2a3c'];
  const skins = ['#c98a5b', '#b07040', '#d9a070', '#8a5530', '#a8643a', '#e0b080'];
  const hairs = ['black', 'black', 'black', 'brown', 'black', 'grey'];
  const people = [];
  for (let i = 0; i < count; i++) {
    const h = await loadHuman({
      character: characters[i % characters.length], base, lod: 'auto',
      kit: { top: tops[Math.floor(R() * tops.length)], bottoms: bottoms[Math.floor(R() * bottoms.length)], socks: '#4a3c30' },
      skin: skins[Math.floor(R() * skins.length)], hair: hairs[Math.floor(R() * hairs.length)],
    });
    h.setLOD(count > 10 ? 1 : 0);
    h.groundClamp = 'feet'; h.footPlanting = false;
    h.mats.forEach((m) => { if (m.color) m.color.setScalar(0.62); });
    h.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
    crowd.add(h, { phase: R() });
    if (parent) parent.add(h.root);
    people.push({ h, seed: R(), clip: '' });
  }
  return { crowd, people };
}
