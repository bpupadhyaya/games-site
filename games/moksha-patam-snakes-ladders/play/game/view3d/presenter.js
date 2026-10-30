// Snakes & Ladders 3D presenter. READS what the 2D layer asked for this frame (src/v3.js: board, pawns, dice, tray) and never writes game
// state. One WebGL canvas sits behind the kit's transparent 2D canvas: a painted cloth board with carved bamboo ladders and clay serpents
// on a dark teak table, a woven dice tray, lacquer pawns, teak dice. The camera is fitted every frame to the layout's board rectangle
// (play) or the hero rectangle (title); v3.proj hands the 2D layer exact screen positions on the tilted cloth for rings and sparks.
// No WebGL, ?flat=1 or a lost context: v3.ready = false and every screen draws the flat 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { COLORS } from '../src/rules.js';
import { K, BW, BCX, BCY, hgt, buildCloth, buildTable, buildCreatures, disposeGroup, makePawn, makeDie, upQuat, buildTray, buildLights, radialTex } from './world.js';

const D2R = Math.PI / 180;
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const rgbaOf = (s) => { const m = (s || '').match(/[\d.]+/g); return m ? { c: new THREE.Color(+m[0] / 255, +m[1] / 255, +m[2] / 255), a: m[3] === undefined ? 1 : +m[3] } : null; };
const boardKey = (b) => b.ladders.map((l) => l.from + '-' + l.to).join(',') + ';' + b.snakes.map((l) => l.from + '-' + l.to).join(',');

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? Math.max(0, Math.min(2, Number(qs.get('tier')))) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120a06);
  const camera = new THREE.PerspectiveCamera(22, 1, 5, 2000);
  const lights = buildLights(scene);
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ }
  await tick();
  scene.add(buildTable());
  let cloth = null;
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    if (cloth) { scene.remove(cloth); cloth.traverse((o) => o.material && o.material.map && o.material.map.dispose()); }
    cloth = buildCloth(t.tex); scene.add(cloth);
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier(); await tick();
  const pawns = COLORS.map((c) => { const p = makePawn(new THREE.Color(c)); p.visible = false; scene.add(p); return p; });
  const dice = [0, 1].map(() => { const d = makeDie(); d.visible = false; scene.add(d); return d; });
  const glowT = radialTex('255,255,255', 1);
  const glows = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m); return m; });
  let creatures = null, creatKey = '', tray = null, trayKey = '';

  // ---- camera ---------------------------------------------------------------------------------------------------------------
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const V = new THREE.Vector3(), cam = { tilt: 70, dist: 200, ox: 0, oy: 0 };
  function place(p) {
    const W = cssW(), H = cssH(), t = p.tilt * D2R;
    camera.aspect = W / H; camera.position.set(0, Math.sin(t) * p.dist, Math.cos(t) * p.dist); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    if (p.ox || p.oy) camera.setViewOffset(W, H, p.ox, p.oy, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const toCss = (x, y, z, o = {}) => { V.set(x, y, z).project(camera); o.x = (V.x + 1) / 2 * cssW(); o.y = (1 - V.y) / 2 * cssH(); return o; };
  const h = BW / 2, CORN = [[-h, -h], [h, -h], [h, h], [-h, h]], q0 = {};
  function fit(rc, tilt) {
    const p = { tilt, dist: 160, ox: 0, oy: 0 }; let bb;
    for (let i = 0; i < 6; i++) {
      place(p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, z] of CORN) { toCss(x, 0, z, q0); bb.x0 = Math.min(bb.x0, q0.x); bb.x1 = Math.max(bb.x1, q0.x); bb.y0 = Math.min(bb.y0, q0.y); bb.y1 = Math.max(bb.y1, q0.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.001) break; p.dist /= s;
    }
    place(p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    for (const [x, z] of CORN) { toCss(x, 0, z, q0); bb.x0 = Math.min(bb.x0, q0.x); bb.x1 = Math.max(bb.x1, q0.x); bb.y0 = Math.min(bb.y0, q0.y); bb.y1 = Math.max(bb.y1, q0.y); }
    p.ox = -((rc.x + rc.w / 2) - (bb.x0 + bb.x1) / 2); p.oy = -((rc.y + rc.h / 2) - (bb.y0 + bb.y1) / 2); place(p);
    Object.assign(cam, p);
  }
  const vper = () => 720 / Math.max(1, Math.min(cssW(), cssH())), cper = () => Math.min(cssW(), cssH()) / 720;   // virtual per css px, css px per virtual
  const a0 = {}, a1 = {}, a2 = {};
  v3.proj = (cx, cy, hh = 0) => {
    const x = (cx - BCX) * K, z = (cy - BCY) * K, y = hgt(x, z) + hh * K, k = vper();
    toCss(x, y, z, a0); toCss(x + K, y, z, a1); toCss(x, y, z + K, a2);
    const s = Math.hypot(a1.x - a0.x, a1.y - a0.y) * k, t = Math.hypot(a2.x - a0.x, a2.y - a0.y) * k;
    return { x: a0.x * k, y: a0.y * k, s, q: t / Math.max(1e-6, s) };
  };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function ground(cxPx, cyPx, out) {   // css px -> point on y = 0
    ndc.set(cxPx / cssW() * 2 - 1, -(cyPx / cssH() * 2 - 1)); ray.setFromCamera(ndc, camera); const o = ray.ray.origin, d = ray.ray.direction, t = -o.y / d.y; return out.set(o.x + d.x * t, 0, o.z + d.z * t);
  }
  const G = new THREE.Vector3(), G2 = new THREE.Vector3();

  let lastW = 0, lastH = 0;
  function frame(time) {
    // board (ladders + serpents)
    if (v3.board) { const k = boardKey(v3.board); if (k !== creatKey) { if (creatures) { scene.remove(creatures); disposeGroup(creatures); } creatures = buildCreatures(v3.board); scene.add(creatures); creatKey = k; } }
    const c = cper();
    let rc;
    if (v3.titleRect) { const r = v3.titleRect, kx = cssW() / kitCanvas.width; rc = { x: r.x * kx, y: r.y * kx, w: r.w * kx, h: r.h * kx }; fit(rc, 56); }
    else if (v3.boardRect) { const r = v3.boardRect; rc = { x: r.x * c, y: r.y * c, w: r.w * c, h: r.h * c }; fit(rc, 70); }
    // pawns
    pawns.forEach((p) => { p.visible = false; });
    for (const q of v3.pawns) {
      const p = pawns[q.i]; if (!p) continue; const x = (q.x - BCX) * K, z = (q.y - BCY) * K;
      p.visible = true; p.position.set(x, hgt(x, z) + (q.lift || 0) * K, z); p.scale.set(1 / Math.sqrt(q.squash || 1), q.squash || 1, 1 / Math.sqrt(q.squash || 1));
      const em = q.glow ? 0.35 : 0; p.userData.body.material.emissive.setRGB(em, em * 0.8, em * 0.3);
    }
    // tray
    if (v3.tray) {
      const T = v3.tray; ground(T.x * c, T.y * c, G); ground((T.x + T.w) * c, (T.y + T.h) * c, G2);
      const w = Math.abs(G2.x - G.x), d = Math.abs(G2.z - G.z), key = `${w.toFixed(0)}x${d.toFixed(0)}`;
      if (key !== trayKey) { if (tray) { scene.remove(tray); disposeGroup(tray); } tray = buildTray(w, d); scene.add(tray); trayKey = key; }
      tray.position.set((G.x + G2.x) / 2, 0, (G.z + G2.z) / 2); tray.visible = true;
    } else if (tray) tray.visible = false;
    // dice
    dice.forEach((d) => { d.visible = false; }); glows.forEach((g) => { g.visible = false; });
    v3.dice.forEach((D, i) => {
      const d = dice[i]; if (!d) return; ground(D.x * c, D.y * c, G);
      toCss(G.x, 0, G.z, a0); toCss(G.x + 1, 0, G.z, a1); const ppw = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1, edge = (D.s * c) / ppw * 0.9, wpv = edge / D.s;
      const lift = (D.lift || 0) * wpv * 0.9;
      d.visible = true; d.scale.setScalar(edge); d.position.set(G.x, 0.05 + edge / 2 + lift, G.z);
      const rest = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(D.angle || 0)).multiply(upQuat(D.v));
      const tm = D.tumble || 0;
      if (tm > 0) { const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(tm * 7.5 + i, tm * 3.2, tm * 9.1, 'XYZ')); d.quaternion.copy(tq.multiply(rest)); } else d.quaternion.copy(rest);
      const gl = rgbaOf(D.glow || D.ring); if (gl) { const g = glows[i]; g.visible = true; g.position.set(G.x, 0.12, G.z); g.scale.setScalar(edge * 2.1); g.material.color.copy(gl.c); g.material.opacity = Math.min(1, gl.a * 0.9); }
    });
    // gentle light drift so the cloth feels lit by a lamp
    lights.sun.position.x = -34 + Math.sin(time * 0.0003) * 4;
    const sw = cssW(), sh = cssH(); if (sw !== lastW || sh !== lastH) { renderer.setSize(sw, sh, false); lastW = sw; lastH = sh; }
    renderer.render(scene, camera);
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.ready = false; });
  canvas.addEventListener('webglcontextrestored', () => { creatKey = ''; trayKey = ''; applyTier(); lastW = 0; v3.ready = true; });
  return { ok: true, canvas, camera, cam, frame, tier: () => TIERS[tier].name, setTier: (t) => { tier = t; applyTier(); } };
}
