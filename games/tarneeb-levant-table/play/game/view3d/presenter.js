// Tarneeb 3D presenter: a Levantine cafe card table. READS the game state (game.getState()), never writes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas: green baize in a walnut frame inlaid with mother-of-pearl stars,
// turned legs on a patterned cement-tile floor, a glass of tea with steam, the paper score pad with its running tally, and the cards
// themselves: dealt one by one across the felt, the three other hands fanned face down in front of their seats, played cards
// flying in (an opponent's card turns over in the air), a trick swept together and stacked crosswise on the winning side's pile.
// The 2D canvas keeps your own hand, every panel, button and text. Positions come from the same layout as the 2D art (layout.js):
// a 2D point is cast onto the felt, so the HUD never moves. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen
// draws the flat painted table; a restored context rebuilds what it needs and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3, covers } from '../src/v3.js';
import { meta } from '../src/game.js';
import { L, handLayout } from '../src/layout.js';
import { teamOf } from '../src/rules.js';
import { paintCard, star8, suitPath, CW, CH } from '../src/art.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const ease = (f) => f * f * (3 - 2 * f);
const tick = () => new Promise((r) => setTimeout(r, 0));
// World units are centimetres. The felt top is y = 0 and the trick centre is the origin.
const U = 0.074;                       // cm per 2D table design unit (a trick card is 100 units = 7.4 cm wide)
const CW3 = 7.4, CH3 = CW3 * CH / CW;  // card 7.4 x 10.8 cm (real cards 6.3 x 8.8: about 1.17x for phone readability)
const F = 37.5, RW = 7.5, RAIL_H = 1.5; // felt half-size, rail width, rail rise above the felt
const FLOOR = -74;
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const HZ_ICON = -24;                   // the icon moves the fan up against the inlaid rail
const HERO = [24, 25, 50, 38, 12];     // the title fan: K hearts, A hearts, K clubs, A diamonds and the ace of spades in front

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function texOf(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ---------------------------------------------------------------------------------------------------- procedural textures
function walnut(size, seed, dark = 0) {
  const c = cv(size), x = c.getContext('2d'), r = rng(seed);
  const g = x.createLinearGradient(0, 0, size, size * 0.2); g.addColorStop(0, dark ? '#2a160a' : '#4a2a14'); g.addColorStop(0.5, dark ? '#3a2010' : '#5e3519'); g.addColorStop(1, dark ? '#24130a' : '#43240f');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 140; i++) {
    const y = r() * size, amp = 2 + r() * 9, ph = r() * TAU, fr = 0.004 + r() * 0.01, a = 0.05 + r() * 0.16, d = r() < 0.7;
    x.strokeStyle = d ? `rgba(20,8,2,${a})` : `rgba(160,100,55,${a * 0.7})`; x.lineWidth = 0.6 + r() * 2; x.beginPath();
    for (let s = 0; s <= size; s += 8) { const yy = y + Math.sin(s * fr + ph) * amp; s ? x.lineTo(s, yy) : x.moveTo(s, yy); }
    x.stroke();
  }
  return c;
}
// the rail top: walnut with mother-of-pearl rosettes (one 7.5 cm tile, repeated along the rail)
function inlayTexture() {
  const S = 512, c = walnut(S, 11), x = c.getContext('2d');
  const pearl = (cx, cy, r) => {
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.1);
    g.addColorStop(0, '#fffdf6'); g.addColorStop(0.45, '#efe6da'); g.addColorStop(0.75, '#dfe6ee'); g.addColorStop(1, '#e9dccb');
    return g;
  };
  x.save(); x.translate(S / 2, S / 2);
  for (let k = 0; k < 2; k++) { x.save(); x.rotate(k * Math.PI / 4); x.fillStyle = pearl(0, 0, S * 0.3); x.fillRect(-S * 0.2, -S * 0.2, S * 0.4, S * 0.4); x.restore(); }
  x.fillStyle = '#4a2a14'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; x.lineTo(Math.cos(a) * S * 0.12, Math.sin(a) * S * 0.12); } x.closePath(); x.fill();
  x.fillStyle = pearl(0, 0, S * 0.08); x.beginPath(); x.arc(0, 0, S * 0.07, 0, TAU); x.fill();
  x.restore();
  for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S]]) { x.fillStyle = pearl(cx, cy, S * 0.12); x.beginPath(); x.moveTo(cx, cy - S * 0.1); x.lineTo(cx + S * 0.1, cy); x.lineTo(cx, cy + S * 0.1); x.lineTo(cx - S * 0.1, cy); x.closePath(); x.fill(); }
  const r = rng(5); x.strokeStyle = 'rgba(255,240,220,0.05)'; for (let i = 0; i < 30; i++) { x.beginPath(); const a = r() * S, b = r() * S; x.moveTo(a, b); x.lineTo(a + (r() - 0.5) * 80, b + (r() - 0.5) * 20); x.stroke(); }
  return c;
}
// the baize: woven green with a warm pool, an embroidered gold star medallion in the middle and a brass-thread border
function feltTexture() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(9);
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.72); g.addColorStop(0, '#2f7653'); g.addColorStop(0.6, '#205c41'); g.addColorStop(1, '#14412e');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)'; x.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1); }
  x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,0.05)'; x.beginPath(); for (let i = -S; i < S; i += 5) { x.moveTo(i, 0); x.lineTo(i + S, S); } x.stroke();
  x.save(); x.globalAlpha = 0.3; x.lineWidth = 3; star8(x, S / 2, S / 2, S * 0.24, 'rgba(232,196,120,0.75)'); x.lineWidth = 2; star8(x, S / 2, S / 2, S * 0.17, 'rgba(232,196,120,0.6)');
  x.beginPath(); x.arc(S / 2, S / 2, S * 0.265, 0, TAU); x.stroke(); x.restore();
  x.strokeStyle = 'rgba(226,190,112,0.45)'; x.lineWidth = 3; x.strokeRect(S * 0.035, S * 0.035, S * 0.93, S * 0.93);
  x.strokeStyle = 'rgba(226,190,112,0.25)'; x.lineWidth = 1.5; x.strokeRect(S * 0.05, S * 0.05, S * 0.9, S * 0.9);
  return c;
}
// cement tiles (the patterned floor of an old cafe): one 20 cm tile
function floorTexture() {
  const S = 256, c = cv(S), x = c.getContext('2d');
  x.fillStyle = '#4a3e33'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#2c3534'; x.beginPath(); x.moveTo(S / 2, 8); x.lineTo(S - 8, S / 2); x.lineTo(S / 2, S - 8); x.lineTo(8, S / 2); x.closePath(); x.fill();
  x.fillStyle = '#5a2c22'; for (const [a, b] of [[0, 0], [S, 0], [0, S], [S, S]]) { x.beginPath(); x.arc(a, b, S * 0.22, 0, TAU); x.fill(); }
  x.fillStyle = '#8a7a5e'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.16, 0, TAU); x.fill();
  x.lineWidth = 3; star8(x, S / 2, S / 2, S * 0.3, '#8a7a5e');
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; x.strokeRect(0, 0, S, S);
  const r = rng(3); for (let i = 0; i < 4000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * S, r() * S, 2, 2); }
  return c;
}
function radialTex(rgb, a = 1, inner = 0) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  if (inner) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.15, `rgba(${rgb},${a})`); } else g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return texOf(c);
}
// a soft rounded-rect shadow for a card lying on the felt (slightly bigger than the card)
function cardShadowTex() {
  const c = cv(128, 160), x = c.getContext('2d');
  for (let i = 0; i < 12; i++) { const k = i * 1.6; x.fillStyle = 'rgba(0,0,0,0.075)'; x.beginPath(); x.roundRect(22 + k, 24 + k, 84 - 2 * k, 112 - 2 * k, 10 + k); x.fill(); }
  return texOf(c);
}

// ---------------------------------------------------------------------------------------------------- geometry
function cardGeometry(w, h, r) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / w, (p.getY(i) - y0) / h);
  g.rotateX(-Math.PI / 2);          // lies on the felt, face up (+y); the card's top edge points away from you (-z)
  return g;
}
function frameGeometry() {
  const o = F + RW, sh = new THREE.Shape(); sh.moveTo(-o, -o); sh.lineTo(o, -o); sh.lineTo(o, o); sh.lineTo(-o, o); sh.lineTo(-o, -o);
  const hole = new THREE.Path(); hole.moveTo(-F, -F); hole.lineTo(-F, F); hole.lineTo(F, F); hole.lineTo(F, -F); hole.lineTo(-F, -F); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 3.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 4, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, RAIL_H - 3.8, 0);
  return g;
}
function lathe(pts, seg = 48) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const noop = { ok: false };
  const iconMode = qs.has('icon'), HZ = iconMode ? HZ_ICON : 0;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: iconMode }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = iconMode ? 0.82 : 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  await tick();
  // ---------------------------------------------------------------- scene, lights, environment
  const scene = new THREE.Scene();
  const bg = new THREE.Color(0x0c0705);
  scene.background = bg; scene.fog = new THREE.Fog(0x0c0705, 140, 320);
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 900);
  const lamp = new THREE.SpotLight(0xffd9a8, 5200, 0, 0.62, 0.85, 1.35);    // the pendant lamp over the table
  lamp.position.set(-14, 118, 34); lamp.target.position.set(0, 0, -2);
  if (iconMode) { lamp.angle = 0.13; lamp.penumbra = 1; lamp.intensity = 7800; lamp.target.position.set(1, 0, 1 + HZ_ICON); }
  lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4;
  Object.assign(lamp.shadow.camera, { near: 60, far: 220 });
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x1a0e06, iconMode ? 0.12 : 0.4);
  const rim = new THREE.DirectionalLight(0x9fb6ff, 0.55); rim.position.set(50, 40, -90);
  const flame = new THREE.PointLight(0xff9a40, 0, 160, 1.6);                // an oil lantern on the next table: warm flicker
  flame.position.set(-70, 40, -80);
  scene.add(lamp, lamp.target, hemi, rim, flame);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();

  await tick();
  // ---------------------------------------------------------------- the table
  const feltMat = new THREE.MeshStandardMaterial({ map: texOf(feltTexture()), roughness: 0.96, metalness: 0 });
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(2 * F + 0.4, 2 * F + 0.4), feltMat); felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; scene.add(felt);
  const inlayTex = texOf(inlayTexture(), { repeat: [1 / RW, 1 / RW] });
  const railMat = new THREE.MeshPhysicalMaterial({ map: inlayTex, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  await tick();
  const woodMat = new THREE.MeshPhysicalMaterial({ map: texOf(walnut(512, 4, 1), { repeat: [0.04, 0.04] }), roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const frame = new THREE.Mesh(frameGeometry(), [railMat, woodMat]); frame.castShadow = true; frame.receiveShadow = true; scene.add(frame);   // inlaid top, plain walnut sides
  const apron = new THREE.Mesh(new THREE.BoxGeometry(2 * (F + RW) - 3, 6, 2 * (F + RW) - 3), woodMat); apron.position.y = -5.5; apron.castShadow = true; scene.add(apron);
  const legGeo = lathe([[0.01, FLOOR], [2.2, FLOOR], [2.4, FLOOR + 3], [1.7, FLOOR + 8], [1.6, -36], [2.6, -30], [1.8, -24], [2.4, -14], [2.6, -8.5], [0.01, -8.5]], 24);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(legGeo, woodMat); l.position.set(a * (F + RW - 6), 0, b * (F + RW - 6)); l.castShadow = true; scene.add(l); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: texOf(floorTexture(), { repeat: [70, 70] }), roughness: 0.82, color: 0x8a8076 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; scene.add(floor);
  for (const [x, z] of [[-150, -120], [140, -150]]) {      // two more cafe tables in the dark beyond the lamp's pool
    const t = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 3, 40), woodMat); t.position.set(x, -1.5, z); t.receiveShadow = true; scene.add(t);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, -FLOOR - 2, 12), woodMat); leg.position.set(x, FLOOR / 2 - 1, z); scene.add(leg);
  }

  await tick();
  // ---------------------------------------------------------------- props: tea glass + saucer + steam, score pad + pencil, trump token
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f6f8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const teaMat = new THREE.MeshPhysicalMaterial({ color: 0x5e1a02, roughness: 0.15, transparent: true, opacity: 0.94, emissive: 0x4a1200, emissiveIntensity: 0.55, clearcoat: 1 });
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf6f1e6, roughness: 0.25, clearcoat: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.28, metalness: 1 });
  const tea = new THREE.Group();
  const saucer = new THREE.Mesh(lathe([[0.01, 0], [4.6, 0.05], [5.6, 0.45], [5.9, 0.75], [0.01, 0.3]]), porcelain); saucer.castShadow = true; saucer.receiveShadow = true;
  const rimG = new THREE.Mesh(new THREE.TorusGeometry(5.75, 0.09, 6, 48), gold); rimG.rotation.x = Math.PI / 2; rimG.position.y = 0.72;
  const glassPts = [[0.01, 0.35], [2.0, 0.35], [2.1, 0.7], [1.75, 2.6], [1.45, 4.1], [1.65, 5.6], [2.2, 8.4], [2.25, 8.6], [2.12, 8.6], [2.06, 8.3], [1.52, 5.6], [1.32, 4.1], [1.62, 2.6], [1.9, 0.9], [0.01, 0.9]];
  const glass = new THREE.Mesh(lathe(glassPts), glassMat); glass.renderOrder = 5;
  const teaBody = new THREE.Mesh(lathe([[0.01, 0.92], [1.86, 0.95], [1.58, 2.6], [1.3, 4.1], [1.5, 5.6], [1.86, 7.2], [0.01, 7.2]]), teaMat); teaBody.renderOrder = 4; teaBody.castShadow = true;
  const goldBand = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 6, 48), gold); goldBand.rotation.x = Math.PI / 2; goldBand.position.y = 8.2;
  tea.add(saucer, rimG, teaBody, glass, goldBand);
  const steamTex = radialTex('255,255,255', 0.5);
  const steam = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 6; tea.add(s); steam.push(s); }
  scene.add(tea);

  // score pad: lined paper on a card backing, with the running tally (old totals struck through, as on paper)
  const padCanvas = cv(256, 352), padTex = texOf(padCanvas);
  const pad = new THREE.Group();
  const padBody = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 13.2), [porcelain, porcelain, new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.9 }), porcelain, porcelain, porcelain]);
  padBody.position.y = 0.25; padBody.castShadow = true; padBody.receiveShadow = true;
  const pencil = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 13, 6), new THREE.MeshStandardMaterial({ color: 0x2c5e3a, roughness: 0.5 }));
  const pWood = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.36, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.8 })); pWood.position.y = 7.3;
  pBody.castShadow = true; pencil.add(pBody, pWood); pencil.rotation.set(0, 0.5, Math.PI / 2); pencil.position.set(5.6, 0.4, 0.6);
  pad.add(padBody, pencil); scene.add(pad);
  let padKey = '';
  function drawPad(hist, target) {
    const key = hist.map((h) => h.join(':')).join(',') + '|' + target; if (key === padKey) return; padKey = key;
    const x = padCanvas.getContext('2d'), W = 256, H = 352;
    x.fillStyle = '#f4ecd8'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(70,110,160,0.35)'; x.lineWidth = 1.5; for (let y = 70; y < H; y += 28) { x.beginPath(); x.moveTo(8, y); x.lineTo(W - 8, y); x.stroke(); }
    x.strokeStyle = 'rgba(40,40,40,0.75)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(W / 2, 22); x.lineTo(W / 2, H - 12); x.stroke(); x.beginPath(); x.moveTo(14, 64); x.lineTo(W - 14, 64); x.stroke();
    x.fillStyle = '#26303a'; x.textAlign = 'center'; x.font = '700 30px "Cormorant Garamond", Georgia, serif';
    x.fillText('لنا', W / 4, 34); x.fillText('لهم', W * 3 / 4, 34);
    x.font = '700 15px system-ui, sans-serif'; x.fillText('US', W / 4, 56); x.fillText('THEM', W * 3 / 4, 56);
    x.font = 'italic 600 26px "Cormorant Garamond", Georgia, serif';
    const rows = hist.slice(-9);
    rows.forEach((h, i) => {
      const y = 92 + i * 28, last = i === rows.length - 1;
      for (let s = 0; s < 2; s++) {
        const cx = W / 4 + s * W / 2 + ((i * 7 + s * 3) % 5) - 2; x.fillStyle = last ? '#1d2630' : '#5a6068'; x.fillText(String(h[s]), cx, y);
        if (!last) { x.strokeStyle = 'rgba(30,30,30,0.7)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 18, y - 8); x.lineTo(cx + 18, y - 10); x.stroke(); }
      }
    });
    x.font = '600 14px system-ui, sans-serif'; x.fillStyle = 'rgba(40,40,40,0.6)'; x.fillText(`to ${target}`, W / 2, H - 6);
    padTex.needsUpdate = true;
  }
  drawPad([[0, 0]], 31);

  // trump token: a brass coin with the suit in enamel, dropped in the middle of the felt when trump is named
  const tokCanvas = cv(256), tokTex = texOf(tokCanvas);
  const tokTop = new THREE.MeshStandardMaterial({ map: tokTex, roughness: 0.3, metalness: 0.85, color: 0xffffff });
  const token = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.45, 48), [gold, tokTop, gold]);
  token.castShadow = true; token.receiveShadow = true; scene.add(token);
  let tokSuit = -2;
  function drawToken(s) {
    if (s === tokSuit) return; tokSuit = s;
    const x = tokCanvas.getContext('2d'), g = x.createRadialGradient(100, 100, 10, 128, 128, 128);
    g.addColorStop(0, '#fff1c2'); g.addColorStop(0.6, '#d9ad55'); g.addColorStop(1, '#8a6224'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(80,50,10,0.8)'; x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 112, 0, TAU); x.stroke();
    x.lineWidth = 2; star8(x, 128, 128, 104, 'rgba(90,60,15,0.45)');
    if (s >= 0) { suitPath(x, s, 128, 132, 58); x.fillStyle = s === 1 || s === 2 ? '#a3121e' : '#16141a'; x.fill(); x.strokeStyle = 'rgba(255,230,160,0.8)'; x.lineWidth = 3; x.stroke(); }
    tokTex.needsUpdate = true;
  }
  drawToken(-1);

  await tick();
  // ---------------------------------------------------------------- cards
  const cardGeo = cardGeometry(CW3, CH3, 0.55);
  const backCanvas = cv(CW * 3, CH * 3); { const x = backCanvas.getContext('2d'); x.scale(3, 3); paintCard(x, -1, false); }
  const backTex = texOf(backCanvas);
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.55 });
  const backGeoDown = cardGeo.clone(); backGeoDown.rotateZ(Math.PI);     // underside of a face-up card
  const MAXB = 200;
  const backs = new THREE.InstancedMesh(cardGeo, backMat, MAXB); backs.count = 0; backs.frustumCulled = false; backs.receiveShadow = true; backs.castShadow = true; scene.add(backs);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.8 });
  const edges = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edgeMat, 64); edges.count = 0; edges.frustumCulled = false; edges.castShadow = true; edges.receiveShadow = true; scene.add(edges);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: cardShadowTex(), transparent: true, depthWrite: false, opacity: 0.7 }), 120);
  shadows.count = 0; shadows.frustumCulled = false; shadows.renderOrder = 1; scene.add(shadows);
  const glows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('255,255,255', 0.95, 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 8);
  glows.count = 0; glows.frustumCulled = false; glows.renderOrder = 3; glows.setColorAt(0, new THREE.Color()); scene.add(glows);
  // face cards: individual meshes (a texture each, cached), at most a trick + flights + the title fan at once
  const faceTex = new Map(), texScale = iconMode ? 7 : 3;
  const faceTexOf = (c, big) => {
    const k = c * 2 + (big ? 1 : 0); let t = faceTex.get(k);
    if (!t) { const cc = cv(CW * texScale, CH * texScale), x = cc.getContext('2d'); x.scale(texScale, texScale); paintCard(x, c, big); t = texOf(cc); faceTex.set(k, t); }
    return t;
  };
  const facePool = [];
  function face(i) {
    if (!facePool[i]) {
      const g = new THREE.Group(), m = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ roughness: 0.5 })), b = new THREE.Mesh(backGeoDown, backMat);
      m.castShadow = true; b.castShadow = true; m.receiveShadow = true; m.position.y = 0.012; g.add(m, b); g.userData = { m, card: -9, big: false }; scene.add(g); facePool[i] = g;
    }
    return facePool[i];
  }
  let nFace = 0, nBack = 0, nEdge = 0, nShadow = 0, nGlow = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  function putFace(card, big, x, y, z, yaw, flip = 0, roll = 0) {
    const g = face(nFace++), u = g.userData;
    if (u.card !== card || u.big !== big) { u.card = card; u.big = big; u.m.material.map = faceTexOf(card, big); u.m.material.needsUpdate = true; }
    g.visible = true; g.position.set(x, y, z); g.rotation.set(0, 0, 0); g.rotateY(yaw); g.rotateZ(flip); g.rotateX(roll);
  }
  function putBack(x, y, z, yaw, tiltX = 0) { if (nBack >= MAXB) return; _e.set(tiltX, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(1, 1, 1); _m.compose(_p, _q, _s); backs.setMatrixAt(nBack++, _m); }
  function putEdge(x, y, z, yaw, h) { if (nEdge >= 64) return; _e.set(0, yaw, 0, 'XYZ'); _q.setFromEuler(_e); _p.set(x, y + h / 2, z); _s.set(CW3 - 0.25, h, CH3 - 0.25); _m.compose(_p, _q, _s); edges.setMatrixAt(nEdge++, _m); }
  function putShadow(x, z, yaw, k = 1, sx = 1, sz = 1) { if (nShadow >= 120) return; _e.set(0, yaw, 0, 'XYZ'); _q.setFromEuler(_e); _p.set(x + 0.35, 0.02, z + 0.45); _s.set(CW3 * 1.5 * k * sx, 1, CH3 * 1.45 * k * sz); _m.compose(_p, _q, _s); shadows.setMatrixAt(nShadow++, _m); }
  function putGlow(x, z, s, r, g, b) { if (nGlow >= 8) return; _q.identity(); _p.set(x, 0.05, z); _s.set(s, 1, s * 1.3); _m.compose(_p, _q, _s); glows.setMatrixAt(nGlow, _m); glows.setColorAt(nGlow++, _c.setRGB(r, g, b)); }

  let sizeKey = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(iconMode ? 1 : Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    sizeKey = '';
  }
  applyTier();

  // ---------------------------------------------------------------- camera fitting (tilt/yaw/fov per screen; distance + off-axis shift fitted to a rectangle)
  const cur = { yaw: 0, tilt: 58, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  let snapNext = true;
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, b) {
    const p = { ...b, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 };
    let bb = null;
    for (let it = 0; it < 7; it++) {
      place(fitCam, p);
      bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  // a 2D layout point (virtual units) cast onto the horizontal plane y = h (world)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2();
  function onTable(vx, vy, h = 0, out = new THREE.Vector3()) {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera); plane.constant = -h;
    if (!ray.ray.intersectPlane(plane, out)) out.set(0, h, 0);
    return out;
  }

  // ---------------------------------------------------------------- framing per screen
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, viewKey = '', camMode = '';
  if (iconMode) kitCanvas.style.visibility = 'hidden';
  const heroPts = [[-15, 0, -8], [15, 0, -8], [-15, 0, 9], [15, 0, 9], [10, 9, -8]];
  function framing(state) {
    if (iconMode) return { yaw: -10, tilt: 36, fov: 26, dist: 37, ox: 0, oy: 0, tx: 1.2, ty: 0, tz: -2.4 + HZ_ICON };
    const drift = calm || state.calm ? 0 : 1, t = state.t;
    if (state.scene === 'title' || !state.tb) {
      const TG = L.title[state.saved ? 1 : 0], A = TG.art;
      const r = L.wide ? { x: A.cx - A.w / 2 + 30, y: L.U.y0 + 24, w: A.w - 60, h: A.h * 0.58 } : { x: 30, y: L.U.y0 + 40, w: L.w - 60, h: Math.max(160, A.h * 0.56) };
      return fit(rectCss(r), heroPts, { yaw: -10 + 7 * Math.sin(t * TAU / 26) * drift, tilt: 40 + 3 * Math.sin(t * TAU / 19) * drift, fov: 30, tx: 0, ty: 0, tz: 0 });
    }
    const T = L.T[state.tb.mode];
    const cyD = (T.ccy - T.oy) / T.k, z0 = -cyD * U, z1 = (T.HD - cyD) * U, x1 = 320 * U;
    const pts = [[-x1, 0, z0], [x1, 0, z0], [-x1, 0, z1], [x1, 0, z1]];
    // the camera looks at the trick centre; the design box is fitted to the 2D table box so the HUD keeps its places
    return fit(rectCss(T.box), pts, { yaw: 0, tilt: L.wide ? 62 : 57, fov: 30, tx: 0, ty: 0, tz: 0 });
  }

  // ---------------------------------------------------------------- per-match memory (only for the score pad's running tally)
  let tbRef = null, hist = [[0, 0]];
  const dealCounts = (tb) => { const c = [0, 0, 0, 0]; for (let k = 0; k < 52; k++) if (tb.deal.t >= k * 0.028 + 0.32) c[(tb.H.dealer + 1 + k) % 4]++; return c; };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), seatW = [0, 1, 2, 3].map(() => new THREE.Vector3()), slotW = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const pileAt = (team) => (team === 0 ? { x: -19, z: -23.5 } : { x: 19, z: -23.5 });
  // card i of n of seat p's hand, lying fanned face down in front of that seat: [x, z, yaw]
  const fc = [0, 0, 0];
  function fanCard(p, i, n, out) {
    const c = seatW[p], k = n > 1 ? i - (n - 1) / 2 : 0, spread = Math.min(1.55, 17 / Math.max(1, n)), arc = k * 0.022;
    if (p === 2) { out[0] = c.x - k * spread; out[1] = c.z - k * k * 0.03; out[2] = Math.PI - arc; }
    else { const s = p === 1 ? 1 : -1; out[0] = c.x + k * k * 0.03 * s; out[1] = c.z + k * spread * s; out[2] = s * Math.PI / 2 + arc; }
    return out;
  }
  const seatYaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2];     // a card dealt toward seat p turns to face that seat

  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    if (!covers(state.scene) && !iconMode) return;
    const mode = state.scene === 'title' ? 'title' : `play${state.tb ? state.tb.mode : ''}`;
    const vk = `${cssW()}x${cssH()}|${L.key}`;
    if (vk !== viewKey || mode !== camMode) { viewKey = vk; camMode = mode; snapNext = true; }
    const goal = framing(state);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const a = snapNext ? 1 : 1 - Math.exp(-dt * 6);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState();
    if (!covers(state.scene) && !iconMode) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const t = state.t, title = state.scene === 'title' || iconMode || !state.tb, tb = title ? null : state.tb;
    nFace = 0; nBack = 0; nEdge = 0; nShadow = 0; nGlow = 0;

    if (title) {
      // the hero: a hand fanned on the felt, the deck beside it, tea and the pad
      HERO.forEach((c, i) => {
        const a = (i - 2) * 0.2 + (calm || state.calm ? 0 : Math.sin(t * 0.7 + i) * 0.006), L0 = CH3 * 0.55;
        const x = 0.5 + Math.sin(a) * L0, z = 6.5 - Math.cos(a) * L0 + HZ;
        putFace(c, false, x, 0.03 + i * 0.035, z, -a); putShadow(x, z, -a, 1);
      });
      for (let i = 0; i < 14; i++) putBack(-12.5 + (i % 3) * 0.04, 0.03 + i * 0.03, -2.5 - (i % 2) * 0.05, 0.32 + ((i * 37) % 7) * 0.004);
      putEdge(-12.5, 0, -2.5, 0.32, 0.4); putShadow(-12.5, -2.5, 0.32, 1.05);
      tea.position.set(10.5, 0, -8.5); tea.visible = !iconMode;
      pad.position.set(-16, 0, 9); pad.rotation.y = 0.35; pad.visible = !iconMode;
      drawPad([[0, 0]], 31); token.visible = false;
    } else {
      const H = tb.H, T = L.T[tb.mode], open = tb.mode === 'puzzle' || tb.mode === 'auto', big = state.big;
      if (tbRef !== tb) { tbRef = tb; hist = [[tb.scores[0], tb.scores[1]]]; }
      const last = hist[hist.length - 1]; if (last[0] !== tb.scores[0] || last[1] !== tb.scores[1]) hist.push([tb.scores[0], tb.scores[1]]);
      drawPad(hist, tb.target);
      for (let p = 0; p < 4; p++) onTable(T.slot[p].x, T.slot[p].y, 0, slotW[p]);
      for (let p = 1; p < 4; p++) onTable(T.seat[p].x, T.seat[p].y, 0, seatW[p]);
      onTable(L.hand.cx, L.handY + L.hand.ch * 0.2, 0, seatW[0]);
      pad.visible = true; pad.position.set(29, 0, -29); pad.rotation.y = 0.3;
      tea.visible = true; tea.position.set(-29.5, 0, -30);
      // the three other hands, face down and fanned (open hands in Auto Play / the Daily Deal stay in the 2D layer)
      const dealing = tb.deal, seq = dealing ? dealCounts(tb) : null;
      if (!open) for (let p = 1; p < 4; p++) {
        const n = dealing ? seq[p] : H.hands[p].length;
        for (let i = 0; i < n; i++) { fanCard(p, i, n, fc); putBack(fc[0], 0.03 + i * 0.022, fc[1], fc[2]); }
        if (n) putShadow(seatW[p].x, seatW[p].z, p === 2 ? 0 : Math.PI / 2, 1, p === 2 ? 1 + n * 0.14 : 1, p === 2 ? 1 : 1 + n * 0.1);
      }
      // won tricks: squared packets of four, stacked crosswise on each side's pile
      for (let team = 0; team < 2; team++) {
        const n = Math.max(0, H.tricks[team] - (tb.collect && teamOf(tb.collect.winner) === team ? 1 : 0)), at = pileAt(team);
        for (let k = 0; k < n; k++) {
          const yaw = (k % 2 ? Math.PI / 2 : 0) + (((k * 53) % 9) - 4) * 0.012, y = k * 0.13;
          putEdge(at.x, y, at.z, yaw, 0.11); putBack(at.x, y + 0.115, at.z, yaw);
        }
        if (n) putShadow(at.x, at.z, 0, 1.15);
      }
      // the deal: one card at a time skimming over the felt to each seat in turn
      if (dealing) {
        const deck = onTable(T.deck.x, T.deck.y, 0, _a), dx = deck.x, dz = deck.z;
        const left = 52 - Math.floor(dealing.t / 0.028);
        if (left > 0) { putEdge(dx, 0, dz, 0.1, left * 0.012); putBack(dx, left * 0.012 + 0.01, dz, 0.1); putShadow(dx, dz, 0.1, 1.05); }
        for (let k = 0; k < 52; k++) {
          const st = k * 0.028, f = (dealing.t - st) / 0.32; if (f <= 0 || f >= 1) continue;
          const seat = (H.dealer + 1 + k) % 4, to = seatW[seat], e = ease(f);
          const x = dx + (to.x - dx) * e, z = dz + (to.z - dz) * e, y = 0.6 + Math.sin(Math.PI * e) * 2.2;
          putBack(x, y, z, 0.1 + (seatYaw[seat] - 0.1) * e + Math.sin(e * Math.PI) * 0.6, Math.sin(e * Math.PI) * 0.12);
          putShadow(x, z, seatYaw[seat] * e, 0.9 + y * 0.02);
        }
      }
      // the trick on the felt, or being swept to the winner's pile
      const flying = new Set(tb.flights.map((f) => f.c));
      const rot = (c) => (((c * 7) % 9) - 4) * 0.03;
      if (tb.collect) {
        const col = tb.collect, sw = clamp01((col.t - 0.7) / 0.4), win = slotW[col.winner], pile = pileAt(teamOf(col.winner));
        const gat = ease(clamp01(sw / 0.45)), go = ease(clamp01((sw - 0.45) / 0.55));
        if (col.t > 0.12 && sw < 0.5) { const g = clamp01((col.t - 0.12) / 0.2) * (1 - sw * 2), pl = 1 + 0.05 * Math.sin(t * 7); putGlow(win.x, win.z, CW3 * 2.3 * pl, 0.95 * g, 0.75 * g, 0.32 * g); }
        col.cards.forEach((cd, i) => {
          if (flying.has(cd.c)) return;
          const s = slotW[cd.p];
          const gx = s.x + (win.x - s.x) * gat, gz = s.z + (win.z - s.z) * gat;
          const x = gx + (pile.x - win.x) * go, z = gz + (pile.z - win.z) * go, y = 0.03 + i * 0.03 + Math.sin(go * Math.PI) * 3 + gat * 0.2;
          const yaw = rot(cd.c) * (1 - gat);
          putFace(cd.c, big, x, y, z, yaw, Math.PI * ease(clamp01((sw - 0.3) / 0.35)));
          putShadow(x, z, yaw, 1 + y * 0.03);
        });
      } else {
        H.trick.forEach((cd, i) => { if (flying.has(cd.c)) return; const s = slotW[cd.p]; putFace(cd.c, big, s.x, 0.03 + i * 0.02, s.z, rot(cd.c)); putShadow(s.x, s.z, rot(cd.c)); });
      }
      // cards in the air: yours leave your hand face up; theirs turn over on the way in
      for (const f of tb.flights) {
        const e = ease(clamp01(f.t / f.dur)), to = slotW[f.p];
        let from;
        if (f.hand !== undefined) { const r = handLayout(f.n)[f.hand]; from = onTable(r.x + r.w / 2, r.y + r.h / 2 - (f.lift || 0), 7, _b); }
        else if (f.pos) from = onTable(f.pos.x, f.pos.y, 7, _b);
        else { const sp = seatW[f.p]; from = _b.set(sp.x, 0.6, sp.z); }
        const mine = f.hand !== undefined || !!f.pos;
        const x = from.x + (to.x - from.x) * e, z = from.z + (to.z - from.z) * e, y = from.y + (0.05 - from.y) * e + Math.sin(Math.PI * e) * 3.2;
        const yaw = mine ? rot(f.c) * e : seatYaw[f.p] * (1 - e) + rot(f.c) * e;
        putFace(f.c, big, x, y, z, yaw, mine ? 0 : Math.PI * (1 - ease(clamp01(e * 1.25))), mine ? (1 - e) * 0.5 : 0);
        putShadow(x, z, yaw, 1 + y * 0.04);
        if (e > 0.82) { const g = (1 - e) / 0.18; putGlow(to.x, to.z, CW3 * 1.9 * (1.3 - g * 0.3), 0.22 * g, 0.2 * g, 0.14 * g); }
      }
      // trump token in the middle of the trick cross once trump is named
      const tr = H.trump >= 0 && H.phase !== 'bid' ? H.trump : -1;
      token.visible = tr >= 0;
      if (tr >= 0) {
        drawToken(tr);
        if (!token.userData.at || token.userData.s !== tr) { token.userData.at = t; token.userData.s = tr; }
        const age = t - token.userData.at, f = clamp01(age / 0.45), bounce = f < 1 ? Math.abs(Math.sin(f * Math.PI * 2.2)) * (1 - f) * 2.6 : 0;
        token.position.set(0, 0.23 + bounce, 0); token.rotation.set(Math.sin(age * 9) * 0.12 * (1 - f), 0.3, 0);
        putShadow(0, 0, 0, 0.55);
      } else token.userData.at = 0;
    }
    for (let i = nFace; i < facePool.length; i++) facePool[i].visible = false;
    backs.count = nBack; backs.instanceMatrix.needsUpdate = true;
    edges.count = nEdge; edges.instanceMatrix.needsUpdate = true;
    shadows.count = nShadow; shadows.instanceMatrix.needsUpdate = true;
    glows.count = nGlow; glows.instanceMatrix.needsUpdate = true; if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    // steam curling up from the tea, a flickering lantern on the next table
    const still = calm || state.calm;
    steam.forEach((s, i) => {
      const ph = ((t * 0.32 + i / steam.length) % 1);
      s.position.set(Math.sin(t * 0.9 + i * 2) * 0.7 * ph, 9 + ph * 9, Math.cos(t * 0.7 + i) * 0.5 * ph);
      const sc = 2.2 + ph * 5; s.scale.set(sc, sc, 1); s.material.opacity = still ? 0 : 0.22 * Math.sin(ph * Math.PI);
    });
    flame.intensity = 2600 * (still ? 1 : 0.85 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 13.1) * 0.05 + Math.sin(t * 2.1) * 0.04);

    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    const sk = `${cssW()}x${cssH()}|${tier}`;
    if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(cssW(), cssH(), false); }
    scene.fog.near = cur.dist * 1.25; scene.fog.far = cur.dist * 3.4;
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); padKey = ''; tokSuit = -2; applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; snapNext = true;
  });

  let loseExt = null;
  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  for (const c of HERO) faceTexOf(c, false);
  await tick();

  return {
    ok: true,
    renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; snapNext = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    // offline store icon (scratch tool): one square render of the hero fan at size x size
    iconPng(size = 2048) {
      pre(); post();
      renderer.setPixelRatio(1); renderer.setSize(size, size, false);
      Object.assign(cur, framing(game.getState())); camera.aspect = 1; place(camera, cur); camera.aspect = 1; camera.clearViewOffset(); camera.updateProjectionMatrix();
      renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png');
    },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return loseExt; },
    restoreContext() { loseExt?.restoreContext(); return loseExt; },
  };
}
