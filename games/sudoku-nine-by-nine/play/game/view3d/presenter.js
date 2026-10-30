// Sudoku 3D presenter (game-owned). READS the game state and what the 2D layer published for this frame (src/v3.js: the board
// rectangle, every cell's face colour and lift), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas.
// The scene is a steel-framed slate tray with nine raised plates and 81 glazed ceramic tiles on a lamp-lit desk. The camera looks
// straight down from DIST units so the plane of the tile tops maps EXACTLY onto the 2D layer's virtual units: taps, digits, notes and
// rings need no projection, while the tile sides, plates, rim and shadows give real depth (parallax towards the screen edges).
// No WebGL, or a lost context: v3.on = false and the 2D layer draws the flat tray and tiles as before; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';

const TOP = 27, PLATE = 3, FLOOR = -30, RIM_TOP = 10, DIST = 560, LIFT = 4;
const TIERS = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

function rrShape(w, h, r, hole = null) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  const path = (p, x0, y0, ww, hh, rr) => { p.moveTo(x0 + rr, y0); p.lineTo(x0 + ww - rr, y0); p.quadraticCurveTo(x0 + ww, y0, x0 + ww, y0 + rr); p.lineTo(x0 + ww, y0 + hh - rr); p.quadraticCurveTo(x0 + ww, y0 + hh, x0 + ww - rr, y0 + hh); p.lineTo(x0 + rr, y0 + hh); p.quadraticCurveTo(x0, y0 + hh, x0, y0 + hh - rr); p.lineTo(x0, y0 + rr); p.quadraticCurveTo(x0, y0, x0 + rr, y0); };
  path(s, x, y, w, h, r);
  if (hole) { const p = new THREE.Path(); path(p, -hole.w / 2, -hole.h / 2, hole.w, hole.h, hole.r); s.holes.push(p); }
  return s;
}
// extruded rounded slab standing on y = y0, `depth` tall, with a small bevel; centred on x, z
function slab(w, h, r, y0, depth, bevel = 1.6, hole = null) {
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * bevel, h - 2 * bevel, Math.max(1, r - bevel), hole && { w: hole.w + 2 * bevel, h: hole.h + 2 * bevel, r: hole.r + bevel }), { depth: Math.max(0.5, depth - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0); g.computeVertexNormals();
  return g;
}

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false, wrap: (g) => g }; }
  if (!renderer.getContext()) return { ok: false, wrap: (g) => g };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 50, 4000);
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x2a3048, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1de, 1.75); sun.castShadow = true; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.18); fill.position.set(500, 300, 400); scene.add(fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  const col = (s) => new THREE.Color().setStyle(s);
  const mats = {
    steel: new THREE.MeshPhysicalMaterial({ color: 0xb9c6da, metalness: 0.95, roughness: 0.3, clearcoat: 0.3 }),
    slate: new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.78, metalness: 0.05 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x2b3650, roughness: 0.55, metalness: 0.1 }),
    inlay: new THREE.MeshStandardMaterial({ color: 0x35d6c0, emissive: 0x1d9c8c, emissiveIntensity: 0.55, roughness: 0.4 }),
    desk: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 }),
    tile: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
  };
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mats.desk); desk.rotation.x = -Math.PI / 2; desk.position.y = FLOOR; desk.receiveShadow = true; scene.add(desk);
  const tray = new THREE.Group(); scene.add(tray);
  let tiles = null, trayKey = '', lookKey = '', tileS = 0;
  const deskTex = (T) => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    const g = x.createRadialGradient(256, 200, 10, 256, 256, 330); g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    // fine woven grain so the desk reads as cloth, not a flat fill
    x.globalAlpha = 0.03; for (let i = 0; i < 512; i += 4) { x.fillStyle = i % 8 ? '#fff' : '#000'; x.fillRect(i, 0, 2, 512); x.fillRect(0, i, 512, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  function theme(T) {
    const k = `${T.name}|${T.bg0}`; if (k === lookKey) return; lookKey = k;
    if (mats.desk.map) mats.desk.map.dispose();
    const t = deskTex(T); mats.desk.map = t; mats.desk.needsUpdate = true;
    const dark = T.dark; mats.slate.color.setStyle(dark ? '#161d30' : '#6f624b'); mats.plate.color.setStyle(dark ? '#27324c' : '#8b7b5e');
    mats.steel.color.setStyle(dark ? '#b8c5da' : '#d8d2c3');
  }
  function buildTray(b, plates, s) {
    const key = `${b.x}|${b.y}|${b.size}|${s}`; if (key === trayKey) return; trayKey = key;
    tray.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    tray.clear();
    const B = b.size, cx = b.x + B / 2, cz = b.y + B / 2, R = B * 0.04, RW = B * 0.022;
    const add = (g, m, x, y, z, cast = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; tray.add(o); return o; };
    add(slab(B, B, R, FLOOR, RIM_TOP - FLOOR, 2.2, { w: B - 2 * RW, h: B - 2 * RW, r: R * 0.55 }), mats.steel, cx, 0, cz);
    add(slab(B - 2 * RW + 2, B - 2 * RW + 2, R * 0.6, FLOOR, -FLOOR + 0.4, 0.4), mats.slate, cx, 0, cz, false);
    for (const p of plates) add(slab(p.w, p.h, s * 0.2, 0, PLATE, 0.9), mats.plate, p.x + p.w / 2, 0, p.y + p.h / 2);
    // teal inlay lines in the gutters between the nine plates
    const gx = [plates[0], plates[1], plates[2]].map((p) => p.x + p.w), gy = [plates[0], plates[3], plates[6]].map((p) => p.y + p.h);
    const g0 = plates[0], gw = Math.max(2, (plates[1].x - (g0.x + g0.w)) * 0.34);
    for (const x of gx.slice(0, 2)) add(new THREE.BoxGeometry(gw, 1.6, B - 2 * RW - 6), mats.inlay, x + (plates[1].x - (g0.x + g0.w)) / 2, PLATE - 0.4, cz, false);
    for (const y of gy.slice(0, 2)) add(new THREE.BoxGeometry(B - 2 * RW - 6, 1.6, gw), mats.inlay, cx, PLATE - 0.4, y + (plates[3].y - (g0.y + g0.h)) / 2, false);
    sun.position.set(cx - B * 0.55, 900, cz - B * 0.7); sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; sc.left = -B * 0.8; sc.right = B * 0.8; sc.top = B * 0.8; sc.bottom = -B * 0.8; sc.near = 200; sc.far = 2200; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25; sun.shadow.radius = 3;
  }
  function buildTiles(s) {
    if (tiles) { tiles.geometry.dispose(); scene.remove(tiles); }
    tiles = new THREE.InstancedMesh(slab(s, s, s * 0.17, PLATE, TOP - PLATE, Math.max(1.4, s * 0.035)), mats.tile, 81);
    tiles.castShadow = true; tiles.receiveShadow = true; tiles.frustumCulled = false; tiles.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(tiles); tileS = s;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  const _m = new THREE.Matrix4(), _c = new THREE.Color();
  function draw(fr, T) {
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight), cpu = meta.cssPerUnit || Math.min(W, H) / 720;
    const b = fr.b;
    theme(T);
    if (!tiles || Math.abs(tileS - b.s) > 0.05) buildTiles(b.s);
    buildTray(b, b.plates, b.s);
    const vx = meta.width / 2, vz = meta.height / 2;
    camera.fov = (2 * Math.atan((H / cpu / 2) / DIST)) * 180 / Math.PI; camera.aspect = W / H;
    camera.position.set(vx, TOP + DIST, vz); camera.up.set(0, 0, -1); camera.lookAt(vx, TOP, vz); camera.updateProjectionMatrix();
    scene.background = col(T.bg1);
    for (let i = 0; i < 81; i++) {
      const c = fr.cells[i]; if (!c) continue;
      _m.makeTranslation(c.x + b.s / 2, c.lift * LIFT, c.y + b.s / 2); tiles.setMatrixAt(i, _m);
      tiles.setColorAt(i, _c.setStyle(c.face));
    }
    tiles.instanceMatrix.needsUpdate = true; if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    renderer.render(scene, camera);
  }

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { buildEnv(); applyTier(); trayKey = ''; lookKey = ''; if (tiles) { tiles.geometry.dispose(); scene.remove(tiles); tiles = null; } lost = false; v3.on = true; });
  v3.on = true;

  function frame(game) {
    const s = game.getState();
    const play = v3.on && !lost && s.scene === 'play' && v3.frame && v3.frameT === s.t;
    canvas.style.visibility = play ? 'visible' : 'hidden';
    if (play) draw(v3.frame, v3.frame.T);
  }
  return { ok: true, scene, renderer, wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); frame(game); }; return game; } };
}
