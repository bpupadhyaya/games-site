// Nonogram 3D presenter (game-owned). READS what the 2D layer published for this frame (src/v3.js: the card, the grid window, the pan
// offset, each square's state and pop), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas.
// Scene: a walnut-and-brass frame holding a ceramic card; in its grid well, bone-white tiles that sink and turn glossy ink-lacquer when
// filled. The camera looks straight down from DIST units so the tile-top plane maps EXACTLY onto the 2D layer's virtual units: taps,
// crosses, guide lines, hints and clue numbers need no projection, while the sides, rim and shadows give real depth.
// No WebGL, or a lost context: v3.on = false and the 2D layer draws the flat paper card and tiles as before; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';

const FLOOR = -30, CARD_TOP = 12, BASE_TOP = 13.5, RIM_TOP = 24, TILE_D = 14, TILE_Y = 8, TOP = TILE_Y + TILE_D, DIST = 560;
const TIERS = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

function rrShape(w, h, r, hole = null) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  const path = (p, x0, y0, ww, hh, rr) => { p.moveTo(x0 + rr, y0); p.lineTo(x0 + ww - rr, y0); p.quadraticCurveTo(x0 + ww, y0, x0 + ww, y0 + rr); p.lineTo(x0 + ww, y0 + hh - rr); p.quadraticCurveTo(x0 + ww, y0 + hh, x0 + ww - rr, y0 + hh); p.lineTo(x0 + rr, y0 + hh); p.quadraticCurveTo(x0, y0 + hh, x0, y0 + hh - rr); p.lineTo(x0, y0 + rr); p.quadraticCurveTo(x0, y0, x0 + rr, y0); };
  path(s, x, y, w, h, r);
  if (hole) { const p = new THREE.Path(); path(p, hole.cx - hole.w / 2, hole.cy - hole.h / 2, hole.w, hole.h, hole.r); s.holes.push(p); }
  return s;
}
// extruded rounded slab standing on y = y0, `depth` tall, small bevel, centred on x, z (hole centre is relative to that)
function slab(w, h, r, y0, depth, bevel = 1.6, hole = null) {
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * bevel, h - 2 * bevel, Math.max(1, r - bevel), hole && { ...hole, w: hole.w + 2 * bevel, h: hole.h + 2 * bevel, r: hole.r + bevel }), { depth: Math.max(0.5, depth - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0); g.computeVertexNormals();
  return g;
}

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 50, 4000);
  scene.add(new THREE.HemisphereLight(0xfff3e2, 0x2a2430, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.7); sun.castShadow = true; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xc8d6ff, 0.2); fill.position.set(500, 300, 400); scene.add(fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.2; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  const mats = {
    frame: new THREE.MeshPhysicalMaterial({ color: 0xb08a4e, metalness: 0.85, roughness: 0.34, clearcoat: 0.25 }),
    card: new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.62, metalness: 0.02 }),
    base: new THREE.MeshStandardMaterial({ color: 0x3a2d22, roughness: 0.8, metalness: 0.05 }),
    desk: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 }),
    tile: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, clippingPlanes: planes, clipShadows: true }),
  };
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mats.desk); desk.rotation.x = -Math.PI / 2; desk.position.y = FLOOR; desk.receiveShadow = true; scene.add(desk);
  const tray = new THREE.Group(); scene.add(tray);
  let tiles = null, trayKey = '', lookKey = '', tileKey = '';
  const deskTex = (th) => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    const g = x.createRadialGradient(256, 200, 10, 256, 256, 340); g.addColorStop(0, th.bg[1]); g.addColorStop(1, th.bg[0]); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    x.globalAlpha = 0.04; for (let i = 0; i < 512; i += 3) { x.fillStyle = i % 6 ? '#fff' : '#000'; x.fillRect(0, i, 512, 1); }   // fine linen grain
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const dark = (h, k) => new THREE.Color(h).multiplyScalar(k);
  function theme(th) {
    if (th.id === lookKey) return; lookKey = th.id;
    if (mats.desk.map) mats.desk.map.dispose();
    mats.desk.map = deskTex(th); mats.desk.needsUpdate = true;
    mats.card.color.set(th.card[0]); mats.base.color.copy(dark(th.card[1], 0.38));
    mats.frame.color.set(th.cardEdge).lerp(new THREE.Color(0xd6b06a), 0.55);
  }
  const add = (g, m, x, y, z, cast = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; tray.add(o); return o; };
  function buildTray(c, v) {
    const key = `${c.x}|${c.y}|${c.w}|${c.h}|${v.x}|${v.y}|${v.w}|${v.h}`; if (key === trayKey) return; trayKey = key;
    tray.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    tray.clear();
    const cx = c.x + c.w / 2, cz = c.y + c.h / 2, R = 22, F = 9;   // F: frame width round the card
    add(slab(c.w + 2 * F, c.h + 2 * F, R + F, FLOOR, RIM_TOP - FLOOR, 2.4, { cx: 0, cy: 0, w: c.w - 2, h: c.h - 2, r: R }), mats.frame, cx, 0, cz);
    add(slab(c.w, c.h, R, FLOOR, CARD_TOP - FLOOR, 1.2), mats.card, cx, 0, cz, false);
    add(slab(v.w + 6, v.h + 6, 7, CARD_TOP - 1, BASE_TOP - CARD_TOP + 1, 0.8), mats.base, v.x + v.w / 2, 0, v.y + v.h / 2, false);
    const B = Math.max(c.w, c.h);
    sun.position.set(cx - B * 0.55, 900, cz - B * 0.7); sun.target.position.set(cx, 0, cz); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; sc.left = -B * 0.8; sc.right = B * 0.8; sc.top = B * 0.8; sc.bottom = -B * 0.8; sc.near = 200; sc.far = 2200; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25; sun.shadow.radius = 3;
  }
  function buildTiles(s, n) {
    const key = `${s.toFixed(2)}|${n}`; if (key === tileKey) return; tileKey = key;
    if (tiles) { tiles.geometry.dispose(); scene.remove(tiles); }
    const w = s * 0.92;
    tiles = new THREE.InstancedMesh(slab(w, w, s * 0.14, 0, TILE_D, Math.max(1.2, s * 0.035)), mats.tile, n);
    tiles.castShadow = true; tiles.receiveShadow = true; tiles.frustumCulled = false; tiles.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(tiles);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  const _m = new THREE.Matrix4(), _c = new THREE.Color(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const ink = new THREE.Color();
  function draw(fr) {
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight), cpu = meta.cssPerUnit || Math.min(W, H) / 720;
    const { th, g, w, h, cells, scales } = fr, v = g.view;
    theme(th);
    buildTray(g.card, v);
    buildTiles(g.s, w * h);
    planes[0].constant = -v.x; planes[1].constant = v.x + v.w; planes[2].constant = -v.y; planes[3].constant = v.y + v.h;
    const vx = meta.width / 2, vz = meta.height / 2;
    camera.fov = (2 * Math.atan((H / cpu / 2) / DIST)) * 180 / Math.PI; camera.aspect = W / H;
    camera.position.set(vx, TOP + DIST, vz); camera.up.set(0, 0, -1); camera.lookAt(vx, TOP, vz); camera.updateProjectionMatrix();
    scene.background = ink.set(th.bg[0]);
    const fillC = new THREE.Color(th.fill[0]), tileC = new THREE.Color(th.tile), crossC = new THREE.Color(th.tileLo);
    for (let i = 0; i < w * h; i++) {
      const c = i % w, r = (i / w) | 0, k = cells[i];
      const sc = k === 1 ? scales[i] : 1;
      _p.set(v.x + c * g.s - g.ox + g.s / 2, TILE_Y - (k === 1 ? 6.5 : k === 2 ? 2.5 : 0), v.y + r * g.s - g.oy + g.s / 2); _s.set(sc, 1, sc);
      tiles.setMatrixAt(i, _m.compose(_p, _q, _s));
      tiles.setColorAt(i, _c.copy(k === 1 ? fillC : k === 2 ? crossC : tileC));
    }
    tiles.instanceMatrix.needsUpdate = true; if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    renderer.render(scene, camera);
  }

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { buildEnv(); applyTier(); trayKey = ''; lookKey = ''; tileKey = ''; if (tiles) { tiles.geometry.dispose(); scene.remove(tiles); tiles = null; } lost = false; v3.on = true; });
  v3.on = true;

  return {
    ok: true, scene, renderer,
    // called right after the 2D layer drew a frame: show the 3D board only if that frame published one
    frame() { const fr = v3.frame, show = v3.on && !lost && Boolean(fr); canvas.style.visibility = show ? 'visible' : 'hidden'; if (show) draw(fr); },
  };
}
