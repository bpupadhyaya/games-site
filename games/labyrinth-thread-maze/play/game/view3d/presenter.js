// Labyrinth Thread Maze 3D presenter. READS what the 2D layer published this frame (src/v3.js: board rectangle, camera, maze, lamp) and never
// writes game state. One WebGL canvas sits behind the kit's canvas; on the play screen the kit canvas has a hole cut over the board and the
// labyrinth underneath is real 3D: flagstone floor tiles, chiselled sandstone wall blocks with soft shadows, a stepped stone frame with a
// Greek-key top and four bronze braziers, carved door posts, a wooden spool of red thread, a lapis-and-gold heart rosette and a clay oil lamp
// with a living flame that lights the stone. The camera is orthographic and looks straight down, fitted to the 2D camera (cells -> pixels),
// with a small height shear, so a drag on the glass hits exactly the corridor cell the 2D hit-test finds. The thread, hint glow, fog and
// torch darkness stay as the 2D overlay on top. No WebGL, or a lost context that never comes back: v3.on = false and the flat 2D art draws all.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { theme } from '../src/ui.js';
import { wallRuns } from '../src/scene.js';
import { MARGIN, centerOf, spoolOf } from '../src/play.js';
import { E, W, N, S, cellX, cellY } from '../src/maze.js';

const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 512 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 256 }, { name: 'low', dpr: 1, shadow: 0, tex: 256 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SHEAR = 0.46, WALL = 0.21, WH = 0.5, FH = 0.16, GAP = 0.006;
const hash = (i) => ((Math.imul(i + 1, 2654435761) >>> 0) / 4294967296);
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const hex = (c) => new THREE.Color(c.length === 7 ? c : '#b69470');

function canvasTex(w, h, paint, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
// grey sandstone grain, multiplied by the vertex colours
function grainTex(n) {
  return canvasTex(n, n, (g, w, h) => {
    const r = lcg(11); g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 14; i++) { const v = 150 + Math.floor(r() * 105); g.fillStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.4, 1 + r() * 1.6); }
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(60,50,40,${0.05 + r() * 0.08})`; g.lineWidth = 0.6 + r() * 1.2; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 18; g.lineTo(x, y); } g.stroke(); }
  });
}
function keyTex(n) {
  return canvasTex(n * 2, n / 2, (g, w, h) => {
    g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a3a1c'; g.lineWidth = Math.max(2, h * 0.06); g.lineJoin = 'miter';
    const sz = h * 0.5, y = h * 0.25, st = sz * 1.1; g.beginPath();
    for (let x = 0; x < w; x += st) { g.moveTo(x, y + sz); g.lineTo(x, y); g.lineTo(x + sz, y); g.lineTo(x + sz, y + sz * 0.7); g.lineTo(x + sz * 0.35, y + sz * 0.7); g.lineTo(x + sz * 0.35, y + sz * 0.35); g.lineTo(x + sz * 0.7, y + sz * 0.35); }
    g.stroke();
  });
}
function roseTex(T) {
  return canvasTex(256, 256, (g) => {
    g.translate(128, 128); g.scale(128 / 0.46, 128 / 0.46);
    g.fillStyle = '#16305a'; g.beginPath(); g.arc(0, 0, 0.46, 0, 7); g.fill(); g.lineWidth = 0.035; g.strokeStyle = T.gold; g.stroke();
    for (let i = 0; i < 8; i++) { g.save(); g.rotate((i * Math.PI) / 4); g.fillStyle = i % 2 ? '#d1693f' : '#f0d58a'; g.beginPath(); g.moveTo(0, -0.07); g.quadraticCurveTo(0.12, -0.2, 0, -0.38); g.quadraticCurveTo(-0.12, -0.2, 0, -0.07); g.fill(); g.restore(); }
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(0, 0, 0.09, 0, 7); g.fill();
  });
}
const glowTex = (rgb) => canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},0.55)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });

// ---- tiny box-mesh builder: positions, normals, uvs and vertex colours in one BufferGeometry (no bottom faces)
class Boxes {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.idx = []; }
  quad(a, b, c, d, nx, ny, nz, ua, ub, col) {
    const base = this.p.length / 3;
    for (const v of [a, b, c, d]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); }
    this.u.push(ua[0], ua[1], ub[0], ua[1], ub[0], ub[1], ua[0], ub[1]);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  box(x0, y0, z0, x1, y1, z1, col, k = 1.7, side = 0.8) {
    const sc = col.map((v) => v * side);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, [x0 * k, z0 * k], [x1 * k, z1 * k], col);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, [x0 * k, y0 * k], [x1 * k, y1 * k], sc);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, [x0 * k, y0 * k], [x1 * k, y1 * k], sc);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, [z0 * k, y0 * k], [z1 * k, y1 * k], sc.map((v) => v * 0.94));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, [z0 * k, y0 * k], [z1 * k, y1 * k], sc.map((v) => v * 0.94));
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.idx); return g;
  }
}

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const qt = new URLSearchParams(location.search).get('tier'); if (qt != null && TIERS[+qt]) tier = +qt;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120a08);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 5, 200);
  const hemi = new THREE.HemisphereLight(0xfff0dc, 0x4a3a2c, 0.9);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.3);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3; sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  const lampLight = new THREE.PointLight(0xffb866, 6, 9, 1.6);
  scene.add(hemi, sun, sun.target, lampLight);
  await tick();

  const shear = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, SHEAR, SHEAR * 50, 0, 0, 1, 0, 0, 0, 0, 1);
  const glowMat = new THREE.SpriteMaterial({ map: glowTex('255,190,100'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, emissive: 0x5c3f1c, emissiveIntensity: 0.7 });
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9b6a2e, roughness: 0.34, metalness: 0.85 });
  const clay = new THREE.MeshStandardMaterial({ color: 0xe08a4c, roughness: 0.5, emissive: 0x6a2c10, emissiveIntensity: 0.5 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const tex = {};

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    for (const k of Object.keys(tex)) tex[k].dispose();
    tex.grain = grainTex(t.tex); tex.floor = grainTex(t.tex);
    stoneMat.map = tex.grain; floorMat.map = tex.floor; floorMat.bumpMap = tex.floor; floorMat.bumpScale = 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();
  await tick();

  // ---- the labyrinth model (rebuilt when the maze or the look changes)
  let built = null, lookId = null;
  const model = new THREE.Group(); scene.add(model);
  const anim = { flames: [], rose: null, lampGroup: null, lampFlame: null, lampGlow: null };
  function build(m, look) {
    model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    model.clear(); anim.flames = []; anim.rose = null;
    const T = theme(), cols = m.cols, rows = m.rows, M = MARGIN;
    const top = hex(T.wallTop), top2 = hex(T.wallTop2);
    // floor: flagstone tiles on a dark bed
    const bed = new THREE.Mesh(new THREE.BoxGeometry(cols + 0.1, 0.2, rows + 0.1), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 }));
    bed.position.set(cols / 2, -0.12, rows / 2); bed.receiveShadow = true; model.add(bed);
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), floorMat, cols * rows);
    const fa = hex(T.floorA), fb = hex(T.floorB), mtx = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < cols * rows; i++) {
      const h = hash(i), h2 = hash(i * 7 + 3), hh = 0.02 + h2 * 0.022;
      mtx.makeScale(0.982, hh, 0.982).setPosition(cellX(m, i) + 0.5, hh / 2 - 0.02, cellY(m, i) + 0.5); tiles.setMatrixAt(i, mtx);
      col.copy(fa).lerp(fb, h > 0.45 ? 0.35 + 0.65 * h : 0).multiplyScalar(0.92 + h2 * 0.16); tiles.setColorAt(i, col);
    }
    tiles.receiveShadow = true; model.add(tiles);
    // walls: sandstone blocks with a proud cap on a dark core
    const Bx = new Boxes(), core = new Boxes(), hw = WALL / 2, cd = hw - 0.012;
    const runs = wallRuns(m, 0, 0, cols - 1, rows - 1, null);
    let bi = 0;
    const tone = (h) => top.clone().lerp(top2, h * 0.7).multiplyScalar(1.12 + h * 0.15).toArray();
    for (const [ax, ay, bx, by] of runs) {
      const horiz = ay === by, a = (horiz ? ax : ay) - hw, b = (horiz ? bx : by) + hw, c = horiz ? ay : ax;
      const len = b - a, n = Math.max(1, Math.round(len / 0.5)), seg = len / n;
      const put = (g, lo, hi, y0, y1, half, colr) => (horiz ? g.box(lo, y0, c - half, hi, y1, c + half, colr) : g.box(c - half, y0, lo, c + half, y1, hi, colr));
      put(core, a + 0.02, b - 0.02, 0, WH * 0.9, cd, [0.2, 0.15, 0.1]);
      for (let k = 0; k < n; k++, bi++) {
        const h = hash(bi * 13 + 5), lo = a + k * seg + GAP, hi = a + (k + 1) * seg - GAP, hgt = WH * (0.93 + h * 0.07);
        put(Bx, lo, hi, 0, hgt - 0.06, hw, tone(h));
        put(Bx, lo - 0.004, hi + 0.004, hgt - 0.06, hgt, hw + 0.012, tone(Math.min(1, h + 0.25)));
      }
    }
    const wall = new THREE.Mesh(Bx.geometry(), stoneMat); wall.castShadow = true; wall.receiveShadow = true; model.add(wall);
    const cm = new THREE.Mesh(core.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); cm.receiveShadow = true; model.add(cm);
    // frame: stepped stone ring with a Greek-key top
    const keyMap = keyTex(tier === 0 ? 512 : 256), side = new THREE.MeshStandardMaterial({ color: hex(T.frame0).lerp(new THREE.Color(0xffffff), 0.1), roughness: 0.9 });
    const fr = (x0, z0, x1, z1, vert) => {
      const mat = new THREE.MeshStandardMaterial({ color: hex(T.frame0).lerp(new THREE.Color(0xffffff), 0.55), roughness: 0.8, map: keyMap.clone() });
      const L = vert ? z1 - z0 : x1 - x0; mat.map.needsUpdate = true; mat.map.repeat.set(Math.max(1, L / 2.1), 1); mat.map.center.set(0.5, 0.5); mat.map.rotation = vert ? Math.PI / 2 : 0;
      const msh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, FH, z1 - z0), [side, side, mat, side, side, side]);
      msh.position.set((x0 + x1) / 2, FH / 2 - 0.02, (z0 + z1) / 2); msh.castShadow = true; msh.receiveShadow = true; model.add(msh);
    };
    fr(-M, -M, cols + M, 0, false); fr(-M, rows, cols + M, rows + M, false); fr(-M, 0, 0, rows, true); fr(cols, 0, cols + M, rows, true);
    // braziers in the four corners
    for (const [bx, bz] of [[-M / 2, -M / 2], [cols + M / 2, -M / 2], [-M / 2, rows + M / 2], [cols + M / 2, rows + M / 2]]) {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: top.clone().multiplyScalar(0.8), roughness: 0.9 })); plinth.position.set(bx, FH + 0.03, bz); plinth.castShadow = true;
      const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.14, 0.02], [0.2, 0.12], [0.24, 0.22], [0.2, 0.22], [0.15, 0.14], [0.001, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)), 18), bronze); bowl.position.set(bx, FH + 0.08, bz); bowl.castShadow = true;
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), flameMat); fl.scale.set(1, 1.9, 1); fl.position.set(bx, FH + 0.38, bz);
      const gl = new THREE.Sprite(glowMat); gl.scale.set(1.3, 1.3, 1); gl.position.set(bx, FH + 0.4, bz);
      model.add(plinth, bowl, fl, gl); anim.flames.push({ fl, gl, ph: bx * 3.1 + bz });
    }
    // door posts and threshold
    { const c = centerOf(m, m.start), dx = m.door === E ? 0.5 : m.door === W ? -0.5 : 0, dz = m.door === S ? 0.5 : m.door === N ? -0.5 : 0, px = dz ? 0.5 : 0, pz = dx ? 0.5 : 0;
      const th = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.22 : 1, 0.06, dz ? 0.22 : 1), new THREE.MeshStandardMaterial({ color: top.clone().multiplyScalar(0.75), roughness: 0.85 })); th.position.set(c.x + dx, 0.03, c.y + dz); th.receiveShadow = true; model.add(th);
      for (const sg of [-1, 1]) {
        const x = c.x + dx + sg * px, z = c.y + dz + sg * pz, mat = new THREE.MeshStandardMaterial({ color: top.clone().multiplyScalar(0.95), roughness: 0.8 });
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), mat); post.position.set(x, 0.3, z); post.castShadow = true; post.receiveShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.38), mat); cap.position.set(x, 0.635, z); cap.castShadow = true;
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), bronze); orb.position.set(x, 0.74, z);
        model.add(post, cap, orb);
      } }
    // spool of red thread
    { const p = spoolOf(m), g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.55 }), th = new THREE.MeshStandardMaterial({ color: hex(T.thread1), roughness: 0.8 });
      const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 28), wood), d2 = d1.clone(), core2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 28), th);
      d1.position.y = 0.025; core2.position.y = 0.12; d2.position.y = 0.215; g.add(d1, core2, d2); g.position.set(p.x, FH - 0.02, p.y); g.traverse((o) => { o.castShadow = true; }); model.add(g); }
    // heart rosette
    { const gp = centerOf(m, m.goal), gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.8, roughness: 0.35 }), rt = roseTex(T);
      const face = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.4, metalness: 0.25, emissive: 0xffc860, emissiveMap: rt, emissiveIntensity: 0.15 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.07, 40), [gold, face, gold]);
      disc.position.set(gp.x, 0.05, gp.y); disc.castShadow = true; disc.receiveShadow = true; model.add(disc); anim.rose = face; }
    // lamp
    const lg = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), clay); body.scale.set(1, 0.58, 0.8); body.position.y = 0.1;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.055, 0.15, 10), clay); spout.rotation.z = Math.PI / 2 - 0.2; spout.position.set(0.19, 0.14, 0);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 14, Math.PI * 1.3), clay); handle.position.set(-0.19, 0.12, 0); handle.rotation.z = Math.PI * 0.85;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), flameMat); flame.scale.set(0.8, 2.1, 0.8); flame.position.set(0.27, 0.27, 0);
    const lglow = new THREE.Sprite(glowMat); lglow.scale.set(1.6, 1.6, 1); lglow.position.set(0.27, 0.3, 0);
    lg.add(body, spout, handle, flame, lglow); lg.traverse((o) => { if (o.isMesh && o !== flame) o.castShadow = true; }); lg.scale.setScalar(1.8);
    model.add(lg); anim.lampGroup = lg; anim.lampFlame = flame; anim.lampGlow = lglow;
    built = m; lookId = look;
  }

  // ---- camera fitted to the 2D board rectangle and camera (cells -> css pixels)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(f) {
    const W = cssW(), H = cssH(), cpu = W / (f.w || meta.width), k = cpu * f.rect.w / f.cam.v;
    const rcx = f.rect.x + f.rect.w / 2, rcy = f.rect.y + f.rect.h / 2;
    const camx = f.cam.cx - (rcx * cpu - W / 2) / k, camz = f.cam.cy - (rcy * cpu - H / 2) / k;
    camera.left = -W / (2 * k); camera.right = W / (2 * k); camera.top = H / (2 * k); camera.bottom = -H / (2 * k);
    camera.position.set(camx, 50, camz); camera.up.set(0, 0, -1); camera.lookAt(camx, 0, camz);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    camera.projectionMatrix.multiply(shear);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const half = f.cam.v * 0.62 + 1;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half }); sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(f.cam.cx - 7, 16, f.cam.cy - 5); sun.target.position.set(f.cam.cx, 0, f.cam.cy); sun.target.updateMatrixWorld();
  }

  let lastStamp = -1, last = performance.now(), slow = 0, nf = 0, first = true;
  function resize() { const W = cssW(), H = cssH(); if (canvas.__w !== W || canvas.__h !== H) { canvas.__w = W; canvas.__h = H; renderer.setSize(W, H, false); } }
  function loop(now) {
    requestAnimationFrame(loop);
    const f = v3.frame;
    if (!f || f.stamp === lastStamp) return;
    lastStamp = f.stamp;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const T = theme();
    if (f.maze !== built || f.look !== lookId) {
      const dk = T.dark;
      hemi.intensity = dk ? 1.25 : 1.3; sun.intensity = dk ? 4.6 : 4.0; sun.color.set(dk ? 0xffd9a8 : 0xfff2dc); scene.background.set(T.tray);
      build(f.maze, f.look);
    }
    resize(); place(f);
    const fl = 1 + 0.09 * Math.sin(f.t * 11) + 0.05 * Math.sin(f.t * 27.3);
    anim.lampGroup.position.set(f.lamp.x, 0.0, f.lamp.y); anim.lampFlame.scale.set(0.8, 2.1 * fl, 0.8); anim.lampGlow.scale.setScalar(1.5 * fl);
    lampLight.position.set(f.lamp.x + 0.2, 1.3, f.lamp.y); lampLight.distance = f.fog ? f.fog + 1.5 : 9; lampLight.intensity = (T.dark ? 9 : 3) * (0.96 + 0.04 * fl) * (f.map ? 0.4 : 1);
    for (const a of anim.flames) { const q = 1 + 0.1 * Math.sin(f.t * 9 + a.ph) + 0.06 * Math.sin(f.t * 21 + a.ph * 2); a.fl.scale.set(q * 0.95, 1.9 * q, q * 0.95); }
    if (anim.rose) anim.rose.emissiveIntensity = (0.12 + 0.1 * Math.sin(f.t * 2.2)) * f.glow;
    renderer.render(scene, camera);
    if (first) { first = false; v3.on = true; }
    nf++; if (dt > 0.034) slow++;
    if (nf >= 90) { if (slow > 45 && tier < 2) { tier++; applyTier(); lookId = null; } nf = 0; slow = 0; }
  }
  v3.alive = true;
  requestAnimationFrame(loop);
  canvas.addEventListener('webglcontextlost', () => { v3.on = false; }, false);
  canvas.addEventListener('webglcontextrestored', () => { applyTier(); lastStamp = -1; first = true; lookId = null; }, false);
  return { ok: true };
}
